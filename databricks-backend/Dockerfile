FROM node:20-alpine

# Install git for simple-git
RUN apk add --no-cache git

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY src ./src

# Build TypeScript
RUN npm run build

# Create logs directory
RUN mkdir -p logs

# Expose port
EXPOSE 3002

# Start server
CMD ["node", "dist/server.js"]
