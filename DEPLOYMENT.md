# 🚀 Deployment Guide

This guide covers all the ways you can deploy your Agora Convo AI Custom LLM Express application.

## 🏃‍♂️ Quick Start

1. **Run the setup script:**
   ```bash
   ./setup.sh
   ```

2. **Edit your environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env with your actual API keys and configuration
   ```

3. **Choose your deployment method below**

## 🐳 Docker Deployment (Recommended)

### Prerequisites
- Docker and Docker Compose installed
- `.env` file configured with your API keys

### Commands

```bash
# Start the application (builds and runs)
npm run start:docker

# Start in background (detached mode)
npm run start:docker:detached

# View logs
npm run logs

# Stop the application
npm run stop:docker

# Clean up everything (containers, volumes, images)
npm run clean:docker
```

### What happens:
- Builds a multi-stage Docker image for optimal size
- Runs the application on port 3000
- Includes health checks
- Automatically restarts on failure
- Mounts logs directory for persistence

## 💻 Local Development

### Prerequisites
- Node.js 18+ installed
- `.env` file configured

### Commands

```bash
# Install dependencies and build
npm install

# Start in production mode
npm start

# Start in development mode (with auto-reload)
npm run dev

# Build TypeScript manually
npm run build

# Clean build artifacts
npm run clean
```

## ☁️ Cloud Deployment

### One-Click Deployments

| Platform | Button | Notes |
|----------|--------|-------|
| **Heroku** | [![Deploy to Heroku](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy) | Uses `app.json` and `Procfile` |
| **Render** | [![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/AgoraIO-Community/agora-convo-ai-custom-llm-express) | Uses `render.yaml` |
| **Vercel** | [![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/AgoraIO-Community/agora-convo-ai-custom-llm-express) | Uses `vercel.json` |
| **Netlify** | [![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/AgoraIO-Community/agora-convo-ai-custom-llm-express) | Uses `netlify.toml` |

### Manual Cloud Deployment

#### Docker-based platforms (Railway, Fly.io, etc.)
```bash
# These platforms can use your Dockerfile directly
# Just connect your GitHub repo and they'll build automatically
```

#### Traditional hosting (VPS, AWS EC2, etc.)
```bash
# Clone your repo
git clone <your-repo-url>
cd langflow-llm

# Run setup
./setup.sh

# Edit environment variables
nano .env

# Start with Docker
npm run start:docker:detached
```

## 🔧 Environment Variables

### Required Variables
```env
# Agora Configuration
AGORA_APP_ID=your_app_id
AGORA_APP_CERTIFICATE=your_certificate
AGORA_CUSTOMER_ID=your_customer_id
AGORA_CUSTOMER_SECRET=your_customer_secret

# Agent Configuration
AGENT_ID=your_agent_id

# LLM Provider (choose one)
LLM_PROVIDER=langflow  # or openai

# For Langflow
LANGFLOW_URL=https://api.langflow.astra.datastax.com/lf/your-instance
LANGFLOW_API_KEY=your_langflow_api_key
LANGFLOW_FLOW_ID=your_flow_id

# For OpenAI (if using OpenAI provider)
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=gpt-4o-mini
USE_RESPONSES_API=false
```

### Optional Variables
```env
# Server Configuration
PORT=3000
NODE_ENV=production
```

## 🧪 Testing Your Deployment

### Health Check
```bash
curl http://localhost:3000/ping
# Should return: {"message":"pong"}
```

### Chat Completion Test
```bash
curl -X POST http://localhost:3000/v1/chat/completion \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{"role": "user", "content": "Hello!"}],
    "userId": "test-user",
    "channel": "test-channel",
    "appId": "test-app"
  }'
```

## 🔍 Troubleshooting

### Common Issues

1. **"langflowId is not supported" error**
   - ✅ Fixed in latest version
   - Make sure you've pulled the latest code

2. **Port 3000 already in use**
   ```bash
   # Change port in .env file
   PORT=3001
   ```

3. **Docker build fails**
   ```bash
   # Clean Docker cache
   docker system prune -a
   npm run clean:docker
   ```

4. **Environment variables not loading**
   - Make sure `.env` file exists in project root
   - Check that variables don't have quotes around values
   - Restart the application after changes

### Logs and Debugging

```bash
# Docker logs
npm run logs

# Local development logs
npm run dev  # Shows detailed logs

# Check if services are running
docker-compose ps
```

## 📊 Monitoring

### Health Checks
- Docker includes automatic health checks
- Endpoint: `GET /ping`
- Returns 200 OK when healthy

### Logs
- Application logs are written to `./logs/` directory
- Docker logs available via `npm run logs`
- Structured logging with timestamps

## 🔒 Security Notes

- Never commit `.env` files to version control
- Use environment variables for all secrets
- The Docker image runs as non-root user
- Health checks don't expose sensitive information

## 🚀 Production Recommendations

1. **Use Docker deployment** for consistency
2. **Set up monitoring** (health checks, logs)
3. **Use a reverse proxy** (nginx, Cloudflare) for HTTPS
4. **Set resource limits** in production
5. **Regular backups** of configuration
6. **Monitor API usage** and rate limits

---

Need help? Check the main [README.md](./README.md) or open an issue! 