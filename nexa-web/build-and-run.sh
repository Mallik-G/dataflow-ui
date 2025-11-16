#!/bin/bash

echo "=== Building and Running Frontend Service ==="

# Stop and remove existing frontend container
echo "Cleaning up existing frontend container..."
docker stop drai-frontend 2>/dev/null || true
docker rm drai-frontend 2>/dev/null || true

# Build frontend
echo "Building frontend..."
docker build --no-cache \
  --build-arg REPO_BRANCH=main \
  --build-arg BUILD_DATE="$(date '+%Y-%m-%d %H:%M:%S')" \
  --build-arg APP_PORT=3000 \
  -t drai-frontend-image .

if [ $? -ne 0 ]; then
    echo "Frontend build failed!"
    exit 1
fi
echo "Frontend built successfully!"

# Start frontend
echo "Starting frontend..."
docker run -d \
  -p 3000:3000 \
  --name drai-frontend \
  drai-frontend-image

if [ $? -eq 0 ]; then
    echo "Frontend started successfully!"
    echo "Frontend URL: http://localhost:3000"
    echo "To view logs: docker logs drai-frontend"
    echo "To stop: docker stop drai-frontend"
else
    echo "Failed to start frontend. Check logs:"
    docker logs drai-frontend
    exit 1
fi 