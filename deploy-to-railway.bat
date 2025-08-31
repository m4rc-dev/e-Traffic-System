@echo off
echo 🚀 Preparing deployment for Railway...

echo 📦 Building React client...
cd client
call npm run build
if %errorlevel% neq 0 (
    echo ❌ Client build failed!
    exit /b 1
)
cd ..

echo 📁 Copying client build to server...
if not exist "server\public" mkdir server\public
xcopy "client\build\*" "server\public\" /E /I /Y

echo ✅ Deployment preparation complete!
echo 🎯 Ready to deploy to Railway!
echo 📝 Don't forget to commit the changes including the server/public directory
