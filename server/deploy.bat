@echo off
echo 🚀 Starting Railway Deployment for e-Traffic Backend...

REM Check if Railway CLI is installed
railway --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Railway CLI not found. Installing...
    npm install -g @railway/cli
)

REM Login to Railway
echo 🔐 Logging into Railway...
railway login

REM Initialize project if not already done
if not exist "railway.json" (
    echo 📁 Initializing Railway project...
    railway init
)

REM Add MySQL database
echo 🗄️ Adding MySQL database...
railway add

REM Set environment variables
echo ⚙️ Setting environment variables...
railway variables set NODE_ENV=production
railway variables set JWT_SECRET=e_traffic_super_secret_key_2024_change_this_in_production
railway variables set CORS_ORIGIN=https://your-frontend-domain.vercel.app

REM Deploy
echo 🚀 Deploying to Railway...
railway up

REM Show status
echo 📊 Deployment Status:
railway status

echo ✅ Deployment complete! Check the status above for your backend URL.
echo 🔗 Test your backend: [YOUR_URL]/health
pause
