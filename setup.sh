#!/bin/bash

# Setup script for Agora Convo AI Custom LLM Express

echo "🚀 Setting up Agora Convo AI Custom LLM Express..."

# Check if .env file exists
if [ ! -f .env ]; then
    echo "📝 Creating .env file from .env.example..."
    cp .env.example .env
    echo "✅ .env file created. Please edit it with your actual values."
else
    echo "✅ .env file already exists."
fi

# Check if Docker is installed
if command -v docker &> /dev/null; then
    echo "✅ Docker is installed."
else
    echo "❌ Docker is not installed. Please install Docker to use Docker deployment."
fi

# Check if Docker Compose is installed
if command -v docker-compose &> /dev/null; then
    echo "✅ Docker Compose is installed."
else
    echo "❌ Docker Compose is not installed. Please install Docker Compose to use Docker deployment."
fi

# Check if Node.js is installed
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo "✅ Node.js is installed: $NODE_VERSION"
else
    echo "❌ Node.js is not installed. Please install Node.js 18+ for local development."
fi

echo ""
echo "🎯 Quick Start Options:"
echo ""
echo "For Docker deployment:"
echo "  npm run start:docker          # Start with Docker Compose (builds and runs)"
echo "  npm run start:docker:detached # Start in background"
echo "  npm run stop:docker           # Stop Docker containers"
echo "  npm run logs                  # View Docker logs"
echo ""
echo "For local development:"
echo "  npm install                   # Install dependencies"
echo "  npm run build                 # Build TypeScript"
echo "  npm start                     # Start the server"
echo "  npm run dev                   # Start in development mode"
echo ""
echo "📚 Don't forget to:"
echo "  1. Edit .env with your actual API keys and configuration"
echo "  2. Make sure your Langflow instance is running and accessible"
echo "  3. Test the /ping endpoint to verify everything is working"
echo ""
echo "🔗 Deployment options:"
echo "  - Heroku: Use the Deploy to Heroku button in README"
echo "  - Vercel: Use the Deploy to Vercel button in README"
echo "  - Render: Use the Deploy to Render button in README"
echo "  - Netlify: Use the Deploy to Netlify button in README"
echo ""
echo "✨ Setup complete! Happy coding!" 