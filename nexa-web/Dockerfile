# Use Node.js as base image
FROM node:18-alpine

# Install git
RUN apk add --no-cache git

# Set working directory
WORKDIR /app-frontend

# Set ARG for branch (to be provided during build)
ARG REPO_BRANCH=main
ARG BUILD_DATE
ARG APP_PORT=3000

# Copy the latest code from the repository
COPY . .

# Pull latest changes from the specified branch
RUN echo "Pulling latest changes from ${REPO_BRANCH} at ${BUILD_DATE}" && \
    git pull origin ${REPO_BRANCH}

# Install dependencies
RUN npm install

# Build the application
RUN npm run build

# Install serve to run the built application
RUN npm install -g serve

# Expose port
EXPOSE ${APP_PORT}

# Set environment variable for port
ENV PORT=${APP_PORT}

# Start the application
CMD ["sh", "-c", "serve -s dist -l $PORT"]
