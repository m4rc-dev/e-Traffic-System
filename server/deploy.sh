#!/bin/bash

echo "🚀 Starting Railway Deployment for e-Traffic Backend..."

# Check if Railway CLI is installed
if ! command -v railway &> /dev/null; then
    echo "❌ Railway CLI not found. Installing..."
    npm install -g @railway/cli
fi

# Login to Railway
echo "🔐 Logging into Railway..."
railway login

# Initialize project if not already done
if [ ! -f "railway.json" ]; then
    echo "📁 Initializing Railway project..."
    railway init
fi

# Add MySQL database if not exists
echo "🗄️ Adding MySQL database..."
railway add

# Set environment variables
echo "⚙️ Setting environment variables..."
railway variables set NODE_ENV=production
railway variables set JWT_SECRET=e_traffic_super_secret_key_2024_change_this_in_production
railway variables set CORS_ORIGIN=https://your-frontend-domain.vercel.app

# Deploy
echo "🚀 Deploying to Railway..."
railway up

# Show status
echo "📊 Deployment Status:"
railway status

echo "✅ Deployment complete! Check the status above for your backend URL."
echo "🔗 Test your backend: [YOUR_URL]/health"
