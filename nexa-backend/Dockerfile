# Use Node.js as base image
FROM node:18-alpine

# Install git
RUN apk add --no-cache git

# Set working directory
WORKDIR /app-backend

# Set ARG for branch (to be provided during build)
ARG REPO_BRANCH=main
ARG BUILD_DATE
ARG APP_PORT=4000

# Copy the latest code from the repository
COPY . .

# Pull latest changes from the specified branch
RUN echo "Pulling latest changes from ${REPO_BRANCH} at ${BUILD_DATE}" && \
    git pull origin ${REPO_BRANCH}

# Install dependencies
RUN npm install

# Install nodemon globally
RUN npm install -g nodemon

# Expose port
EXPOSE ${APP_PORT}

# Start the application
CMD ["npm", "run", "start"]
