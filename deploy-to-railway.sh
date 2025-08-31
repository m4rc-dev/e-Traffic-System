#!/bin/bash

echo "🚀 Preparing deployment for Railway..."

echo "📦 Building React client..."
cd client
npm run build
if [ $? -ne 0 ]; then
    echo "❌ Client build failed!"
    exit 1
fi
cd ..

echo "📁 Copying client build to server..."
mkdir -p server/public
cp -r client/build/* server/public/

echo "✅ Deployment preparation complete!"
echo "🎯 Ready to deploy to Railway!"
echo "📝 Don't forget to commit the changes including the server/public directory"
