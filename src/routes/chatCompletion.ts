import { Router, Request, Response, RequestHandler } from 'express'
import { processChatCompletion as processOpenAI } from '../services/openaiCompletionsService'
import { processResponses } from '../services/openaiResponsesService'
import { processChatCompletion as processLangflow } from '../services/langflowService'
import { validateRequest } from '../middleware/auth'
import { config } from '../libs/utils'

const router = Router()

// Middleware to validate API token
router.use(validateRequest as RequestHandler)

// Chat completion endpoint
router.post('/completion', (async (req: Request, res: Response) => {
  try {
    const {
      messages,
      model = 'gpt-4o-mini',
      stream = false,
      channel = 'ccc',
      userId = '111',
      appId = '20b7c51ff4c644ab80cf5a4e646b0537',
    } = req.body

    if (!messages) {
      return res.status(400).json({ error: 'Missing "messages" in request body' })
    }

    if (!appId) {
      return res.status(400).json({ error: 'Missing "appId" in request body' })
    }

    // This server supports both Langflow and OpenAI (Chat Completions and Responses APIs)

    // Select the correct handler based on provider
    let processHandler
    if (config.llm.provider === 'langflow') {
      processHandler = processLangflow
      console.log('Using Langflow LLM provider for request')
    } else if (config.llm.provider === 'openai' && config.llm.useResponsesApi) {
      processHandler = processResponses
      console.log('Using OpenAI Responses API for request')
    } else {
      processHandler = processOpenAI
      console.log('Using OpenAI Chat Completions API for request')
    }

    const result = await processHandler(messages, {
      model,
      stream,
      channel,
      userId,
      appId,
    })

    if (stream) {
      // Set SSE headers
      res.setHeader('Content-Type', 'text/event-stream')
      res.setHeader('Cache-Control', 'no-cache')
      res.setHeader('Connection', 'keep-alive')

      if (result instanceof ReadableStream) {
        // Handle Web ReadableStream
        const reader = result.getReader()

        // Process stream chunks
        while (true) {
          const { done, value } = await reader.read()
          if (done) {
            break
          }

          // Write chunks to response
          res.write(value)
        }

        // End the response
        res.end()
      } else {
        // Fallback for non-streaming response
        res.json(result)
      }
    } else {
      res.json(result)
    }
  } catch (err: any) {
    console.error('Chat Completions Error:', err)
    res.status(500).json({ error: err.message })
  }
}) as RequestHandler)

export const chatCompletionRouter = router
