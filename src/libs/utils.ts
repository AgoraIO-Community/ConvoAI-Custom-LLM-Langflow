import dotenv from 'dotenv'

// Load environment variables from .env file
dotenv.config()

interface AgoraConfig {
  appId: string
  appCertificate: string
  authToken: string
}

interface LLMConfig {
  openaiApiKey: string
  model: string
  useResponsesApi: boolean
  provider: 'openai' | 'langflow'
}

interface LangflowConfig {
  url: string
  apiKey: string
  flowId: string
}

interface Config {
  port: number
  agora: AgoraConfig
  llm: LLMConfig
  langflow: LangflowConfig
  agentId: string
}

function validateEnv(): Config {
  const requiredEnvVars = [
    'AGORA_APP_ID',
    'AGORA_APP_CERTIFICATE',
    'AGORA_CUSTOMER_ID',
    'AGORA_CUSTOMER_SECRET',
    'OPENAI_API_KEY',
    'OPENAI_MODEL',
    'AGENT_ID',
    'LANGFLOW_URL',
    'LANGFLOW_API_KEY',
    'LANGFLOW_FLOW_ID',
  ]

  const missingEnvVars = requiredEnvVars.filter((envVar) => !process.env[envVar])

  if (missingEnvVars.length > 0) {
    throw new Error(`Missing required environment variables: ${missingEnvVars.join(', ')}`)
  }

  const config: Config = {
    port: parseInt(process.env.PORT || '3000', 10),
    agora: {
      appId: process.env.AGORA_APP_ID!,
      appCertificate: process.env.AGORA_APP_CERTIFICATE!,
      authToken: `Basic ${Buffer.from(
        `${process.env.AGORA_CUSTOMER_ID!}:${process.env.AGORA_CUSTOMER_SECRET!}`,
      ).toString('base64')}`,
    },
    llm: {
      openaiApiKey: process.env.OPENAI_API_KEY!,
      model: process.env.OPENAI_MODEL!,
      useResponsesApi: process.env.USE_RESPONSES_API === 'true',
      provider: (process.env.LLM_PROVIDER as 'openai' | 'langflow') || 'langflow',
    },
    langflow: {
      url: process.env.LANGFLOW_URL!,
      apiKey: process.env.LANGFLOW_API_KEY!,
      flowId: process.env.LANGFLOW_FLOW_ID!,
    },
    agentId: process.env.AGENT_ID!,
  }

  return config
}

export const config = validateEnv()
