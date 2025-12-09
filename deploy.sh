#!/bin/bash

# Cube Connect Deployment Script
# Run this on your production VM to pull latest changes and redeploy

set -e  # Exit on any error

echo "🚀 Starting deployment..."

# Pull latest code
echo "📥 Pulling latest changes from GitHub..."
git pull origin main

# Stop running container
echo "🛑 Stopping running container..."
docker-compose down

# Rebuild image with latest code
echo "🔨 Building new Docker image..."
docker build -t cube-connect:latest .

# Start updated container
echo "▶️  Starting updated container..."
docker-compose up -d

# Wait a moment for container to start
sleep 2

# Verify it's running
echo "✅ Verifying deployment..."
docker ps | grep cube-connect

echo ""
echo "🎉 Deployment complete!"
echo "Check logs with: docker logs -f cube-connect"
