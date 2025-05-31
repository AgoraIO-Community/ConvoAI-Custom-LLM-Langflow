FROM node:20-slim

WORKDIR /app

# Copy package files
COPY package*.json ./

# Copy source code and config files
COPY . .

# Install all dependencies (including dev dependencies for building)
RUN npm ci

# Build TypeScript code
RUN npm run build

# Remove dev dependencies to reduce image size
RUN npm prune --production

# Expose the port the app runs on
EXPOSE 3000

# Command to run the application
CMD ["npm", "start"] 