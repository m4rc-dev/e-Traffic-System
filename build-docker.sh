#!/bin/bash

echo "Building e-Traffic System Docker image..."
echo

# Build the Docker image from the root directory
# This allows access to both client and server directories
docker build -f server/Dockerfile -t e-traffic-system .

if [ $? -eq 0 ]; then
    echo
    echo "✅ Docker build completed successfully!"
    echo
    echo "To run the container:"
    echo "docker run -p 8080:8080 e-traffic-system"
    echo
else
    echo
    echo "❌ Docker build failed!"
    echo
fi
