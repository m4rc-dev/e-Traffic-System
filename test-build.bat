@echo off
echo Testing e-Traffic System Docker build...
echo.

REM Check if Docker is available
docker --version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Docker is not installed or not in PATH
    echo Please install Docker Desktop first
    pause
    exit /b 1
)

echo ✅ Docker is available
echo.

REM Clean any existing images
echo Cleaning existing images...
docker rmi e-traffic-system 2>nul
echo.

REM Build using traditional Docker build (not buildx)
echo Building Docker image...
docker build -f Dockerfile -t e-traffic-system .

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ✅ Docker build completed successfully!
    echo.
    echo To run the container:
    echo docker run -p 8080:8080 e-traffic-system
    echo.
) else (
    echo.
    echo ❌ Docker build failed!
    echo.
    echo Please check the error messages above
    echo.
)

pause
