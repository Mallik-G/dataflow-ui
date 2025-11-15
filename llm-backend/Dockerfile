FROM node:20-alpine

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
EXPOSE 3003

# Start server
CMD ["node", "dist/server.js"]
