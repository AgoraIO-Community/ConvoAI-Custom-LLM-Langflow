import { LangflowClient } from '@datastax/langflow-client'
import { functions } from '../libs/toolDefinitions'
import { functionMap, FunctionArgs } from '../libs/tools'
import { getFormattedRagData } from './ragService'
import { config } from '../libs/utils'

// Define types that match OpenAI's interface for compatibility
interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'function'
  content?: string
  name?: string
}

interface ChatCompletionOptions {
  model?: string
  stream?: boolean
  userId: string
  channel: string
  appId: string
}

interface RequestContext {
  userId: string
  channel: string
  appId: string
}

// Initialize Langflow client
const langflowClient = new LangflowClient({
  apiKey: config.langflow.apiKey,
  baseUrl: config.langflow.url,
})

// Session management for Langflow
const activeSessions = new Map<string, any>()

/**
 * Creates a system message with RAG data
 * @returns {string} System message content with RAG data
 */
function createSystemMessage(): string {
  return (
    `You are a helpful and friendly assistant. Here is some background knowledge that may help:\n\n` +
    getFormattedRagData()
  )
}

/**
 * Process a chat completion request with Langflow
 * @param {ChatMessage[]} messages - Chat messages
 * @param {ChatCompletionOptions} options - Additional options
 * @returns {Promise<Object>} Langflow response formatted to match OpenAI Chat Completions API
 */
async function processChatCompletion(messages: ChatMessage[], options: ChatCompletionOptions) {
  const { model = 'langflow', stream = false, userId, channel, appId } = options

  console.log(`Processing request with Langflow, streaming: ${stream}`)

  // Create session key for this conversation
  const sessionKey = `${appId}_${channel}_${userId}`

  // Get or create session
  let sessionId = activeSessions.get(sessionKey)
  if (!sessionId) {
    sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    activeSessions.set(sessionKey, sessionId)
    console.log(`Created new Langflow session: ${sessionId}`)
  }

  // Add system message with RAG data and prepare conversation
  const systemMessage = createSystemMessage()
  const conversationHistory = messages
    .map((msg) => {
      if (msg.role === 'system') {
        return `System: ${msg.content}`
      } else if (msg.role === 'user') {
        return `User: ${msg.content}`
      } else if (msg.role === 'assistant') {
        return `Assistant: ${msg.content}`
      } else if (msg.role === 'function') {
        return `Function (${msg.name}): ${msg.content}`
      }
      return `${msg.role}: ${msg.content}`
    })
    .join('\n\n')

  // Combine system message with conversation
  const input = `${systemMessage}\n\n${conversationHistory}`

  // Get the last user message for function calling context
  const userMessages = messages.filter((msg) => msg.role === 'user')
  const lastUserMessage = userMessages[userMessages.length - 1]?.content || ''

  if (!stream) {
    // Non-streaming mode
    return processNonStreamingRequest(input, sessionId, lastUserMessage, {
      userId,
      channel,
      appId,
    })
  } else {
    // Streaming mode
    return processStreamingRequest(input, sessionId, lastUserMessage, {
      userId,
      channel,
      appId,
    })
  }
}

/**
 * Process a non-streaming request
 * @param {string} input - Formatted input message
 * @param {string} sessionId - Session ID for Langflow
 * @param {string} lastUserMessage - Last user message for function calling
 * @param {RequestContext} context - Request context
 * @returns {Promise<Object>} Final response formatted to match OpenAI Chat Completions API
 */
async function processNonStreamingRequest(
  input: string,
  sessionId: string,
  lastUserMessage: string,
  context: RequestContext,
) {
  const { userId, channel, appId } = context

  try {
    console.log('Sending request to Langflow...')

    // Get flow reference and run it
    const flow = langflowClient.flow(config.langflow.flowId)
    const response = await flow.run(input, {
      session_id: sessionId,
      input_type: 'chat',
      output_type: 'chat',
    })

    console.log('Received response from Langflow')

    // Extract text response from Langflow using the convenience method
    let responseText = response.chatOutputText() || ''

    // If no text from convenience method, use a simple fallback
    if (!responseText) {
      console.log('No text from chatOutputText(), using fallback...')
      responseText = 'I received your message but could not generate a proper response.'
    }

    // Check if we should attempt function calling based on the response or user input
    const shouldTryFunctionCall = checkForFunctionCallIntent(responseText, lastUserMessage)

    if (shouldTryFunctionCall && functions.length > 0) {
      // Try to extract and execute function calls
      const functionCallResult = await attemptFunctionCall(responseText, lastUserMessage, appId, userId, channel)

      if (functionCallResult) {
        // If function was called, get a follow-up response from Langflow
        const followUpInput = `${input}\n\nAssistant: ${responseText}\n\nFunction Result: ${functionCallResult}\n\nUser: Please provide a response based on the function result.`

        const finalResponse = await flow.run(followUpInput, {
          session_id: sessionId,
          input_type: 'chat',
          output_type: 'chat',
        })

        const finalText = finalResponse.chatOutputText() || responseText
        responseText = finalText
      }
    }

    return formatAsCompletion(responseText, sessionId)
  } catch (error: unknown) {
    console.error('Langflow error:', error)

    let errorMessage = 'Unknown error'
    if (error instanceof Error) {
      errorMessage = error.message
    }

    throw new Error(`Langflow error: ${errorMessage}`)
  }
}

/**
 * Process a streaming request
 * @param {string} input - Formatted input message
 * @param {string} sessionId - Session ID for Langflow
 * @param {string} lastUserMessage - Last user message for function calling
 * @param {RequestContext} context - Request context
 * @returns {Promise<ReadableStream>} Stream of events formatted to match OpenAI Chat Completions API
 */
async function processStreamingRequest(
  input: string,
  sessionId: string,
  lastUserMessage: string,
  context: RequestContext,
) {
  const { userId, channel, appId } = context

  console.log('Starting Langflow streaming request...')

  const encoder = new TextEncoder()

  return new ReadableStream({
    async start(controller) {
      try {
        // Try to use streaming if supported by the flow
        const flow = langflowClient.flow(config.langflow.flowId)

        try {
          // Check if the flow supports streaming
          const streamResponse = await flow.stream(input, {
            session_id: sessionId,
            input_type: 'chat',
            output_type: 'chat',
          })

          // Handle the streaming response
          for await (const event of streamResponse) {
            if (event.event === 'token' && event.data?.chunk) {
              const chunk = {
                id: `chatcmpl-${sessionId}`,
                object: 'chat.completion.chunk',
                created: Math.floor(Date.now() / 1000),
                model: 'langflow',
                choices: [
                  {
                    index: 0,
                    delta: {
                      content: event.data.chunk,
                    },
                    finish_reason: null,
                  },
                ],
              }
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`))
            } else if (event.event === 'end') {
              // Handle function calling if needed - simplified for now
              const shouldTryFunctionCall = checkForFunctionCallIntent('', lastUserMessage)

              if (shouldTryFunctionCall && functions.length > 0) {
                const functionCallResult = await attemptFunctionCall('', lastUserMessage, appId, userId, channel)

                if (functionCallResult) {
                  // Stream the function result as additional tokens
                  const followUpText = `\n\nBased on the function result: ${functionCallResult}`
                  const words = followUpText.split(' ')

                  for (const word of words) {
                    const chunk = {
                      id: `chatcmpl-${sessionId}`,
                      object: 'chat.completion.chunk',
                      created: Math.floor(Date.now() / 1000),
                      model: 'langflow',
                      choices: [
                        {
                          index: 0,
                          delta: {
                            content: word + ' ',
                          },
                          finish_reason: null,
                        },
                      ],
                    }
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`))
                    await new Promise((resolve) => setTimeout(resolve, 50))
                  }
                }
              }

              break
            }
          }
        } catch (streamError) {
          console.log('Streaming not supported, falling back to non-streaming...')

          // Fallback to regular response and simulate streaming
          const response = await flow.run(input, {
            session_id: sessionId,
            input_type: 'chat',
            output_type: 'chat',
          })

          let responseText = response.chatOutputText() || ''

          // Stream the response in chunks
          const words = responseText.split(' ')
          for (let i = 0; i < words.length; i++) {
            const chunk = {
              id: `chatcmpl-${sessionId}`,
              object: 'chat.completion.chunk',
              created: Math.floor(Date.now() / 1000),
              model: 'langflow',
              choices: [
                {
                  index: 0,
                  delta: {
                    content: words[i] + (i < words.length - 1 ? ' ' : ''),
                  },
                  finish_reason: null,
                },
              ],
            }

            controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`))
            await new Promise((resolve) => setTimeout(resolve, 50))
          }

          // Check for function calling after streaming the main response
          const shouldTryFunctionCall = checkForFunctionCallIntent(responseText, lastUserMessage)

          if (shouldTryFunctionCall && functions.length > 0) {
            const functionCallResult = await attemptFunctionCall(responseText, lastUserMessage, appId, userId, channel)

            if (functionCallResult) {
              const followUpText = `\n\nBased on the function result: ${functionCallResult}`
              const finalWords = followUpText.split(' ')

              for (const word of finalWords) {
                const chunk = {
                  id: `chatcmpl-${sessionId}`,
                  object: 'chat.completion.chunk',
                  created: Math.floor(Date.now() / 1000),
                  model: 'langflow',
                  choices: [
                    {
                      index: 0,
                      delta: {
                        content: word + ' ',
                      },
                      finish_reason: null,
                    },
                  ],
                }
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`))
                await new Promise((resolve) => setTimeout(resolve, 50))
              }
            }
          }
        }

        // Send final chunk
        const finalChunk = {
          id: `chatcmpl-${sessionId}`,
          object: 'chat.completion.chunk',
          created: Math.floor(Date.now() / 1000),
          model: 'langflow',
          choices: [
            {
              index: 0,
              delta: {},
              finish_reason: 'stop',
            },
          ],
        }

        controller.enqueue(encoder.encode(`data: ${JSON.stringify(finalChunk)}\n\n`))
        controller.enqueue(encoder.encode(`data: [DONE]\n\n`))
        controller.close()
      } catch (error) {
        console.error('Langflow streaming error:', error)
        controller.error(error)
      }
    },
  })
}

/**
 * Check if the response or user message indicates a function call intent
 * @param {string} responseText - Response from Langflow
 * @param {string} userMessage - User message
 * @returns {boolean} Whether to attempt function calling
 */
function checkForFunctionCallIntent(responseText: string, userMessage: string): boolean {
  // Simple heuristics to detect function call intent
  const functionCallKeywords = [
    'send photo',
    'send picture',
    'send image',
    'photo',
    'picture',
    'image',
    'order sandwich',
    'sandwich',
    'food',
    'order',
  ]

  const combinedText = (responseText + ' ' + userMessage).toLowerCase()
  return functionCallKeywords.some((keyword) => combinedText.includes(keyword))
}

/**
 * Attempt to execute a function call based on the context
 * @param {string} responseText - Response from Langflow
 * @param {string} userMessage - User message
 * @param {string} appId - App ID
 * @param {string} userId - User ID
 * @param {string} channel - Channel
 * @returns {Promise<string|null>} Function result or null
 */
async function attemptFunctionCall(
  responseText: string,
  userMessage: string,
  appId: string,
  userId: string,
  channel: string,
): Promise<string | null> {
  try {
    const combinedText = (responseText + ' ' + userMessage).toLowerCase()

    // Example: Photo function
    if (
      (combinedText.includes('photo') || combinedText.includes('picture') || combinedText.includes('image')) &&
      functionMap['send_photo']
    ) {
      const args: FunctionArgs = {} // Empty args for send_photo
      return await functionMap['send_photo'](appId, userId, channel, args)
    }

    // Example: Sandwich function
    if (combinedText.includes('sandwich') && functionMap['order_sandwich']) {
      // Extract filling from the message (simplified)
      let filling = 'ham' // default
      if (combinedText.includes('turkey')) filling = 'turkey'
      else if (combinedText.includes('beef')) filling = 'beef'
      else if (combinedText.includes('chicken')) filling = 'chicken'
      else if (combinedText.includes('vegetarian') || combinedText.includes('veggie')) filling = 'vegetarian'

      const args: FunctionArgs = { filling }
      return await functionMap['order_sandwich'](appId, userId, channel, args)
    }

    return null
  } catch (error) {
    console.error('Function call error:', error)
    return null
  }
}

/**
 * Format a Langflow response to match the OpenAI Chat Completions API format
 * @param {string} responseText - Response text from Langflow
 * @param {string} sessionId - Session ID
 * @returns {Object} Formatted response matching Chat Completions API
 */
function formatAsCompletion(responseText: string, sessionId: string) {
  return {
    id: `chatcmpl-${sessionId}`,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model: 'langflow',
    choices: [
      {
        index: 0,
        message: {
          role: 'assistant',
          content: responseText,
        },
        finish_reason: 'stop',
      },
    ],
    usage: {
      prompt_tokens: 0, // Langflow doesn't provide token counts
      completion_tokens: 0,
      total_tokens: 0,
    },
  }
}

export { processChatCompletion }
export type { ChatMessage, ChatCompletionOptions, RequestContext }
