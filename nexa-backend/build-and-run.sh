#!/bin/bash

echo "=== Building and Running Backend Service ==="

# Stop and remove existing backend container
echo "Cleaning up existing backend container..."
docker stop drai-backend 2>/dev/null || true
docker rm drai-backend 2>/dev/null || true

# Build backend
echo "Building backend..."
docker build --no-cache \
  --build-arg REPO_BRANCH=main \
  --build-arg BUILD_DATE="$(date '+%Y-%m-%d %H:%M:%S')" \
  --build-arg APP_PORT=4000 \
  -t drai-backend-image .

if [ $? -ne 0 ]; then
    echo "Backend build failed!"
    exit 1
fi
echo "Backend built successfully!"

# Start backend
echo "Starting backend..."
docker run -d \
  -p 4000:4000 \
  --name drai-backend \
  drai-backend-image

if [ $? -eq 0 ]; then
    echo "Backend started successfully!"
    echo "Backend URL: http://localhost:4000"
    echo "To view logs: docker logs drai-backend"
    echo "To stop: docker stop drai-backend"
else
    echo "Failed to start backend. Check logs:"
    docker logs drai-backend
    exit 1
fi 