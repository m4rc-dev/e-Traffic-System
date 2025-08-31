# 🚀 Railway Deployment Guide for e-Traffic Backend

## Prerequisites
- Node.js installed
- GitHub account
- Railway account (free at railway.app)

## Step-by-Step Deployment

### 1. Install Railway CLI
```bash
npm install -g @railway/cli
```

### 2. Login to Railway
```bash
railway login
```
- Opens browser for authentication
- Authorize Railway to access your GitHub

### 3. Navigate to Server Directory
```bash
cd server
```

### 4. Initialize Railway Project
```bash
railway init
```
- Choose "Create a new project"
- Name: "e-traffic-backend"
- Select your GitHub repository

### 5. Add MySQL Database
```bash
railway add
```
- Select "MySQL" from the list
- This creates a MySQL service

### 6. Set Environment Variables
```bash
railway variables set NODE_ENV=production
railway variables set JWT_SECRET=e_traffic_super_secret_key_2024_change_this_in_production
railway variables set CORS_ORIGIN=https://your-frontend-domain.vercel.app
```

### 7. Deploy
```bash
railway up
```

### 8. Get Your Backend URL
```bash
railway status
```
- Copy the URL (e.g., https://your-app.railway.app)

### 9. Test Your Backend
Visit: `https://your-app.railway.app/health`

Expected response:
```json
{
  "status": "OK",
  "message": "e-Traffic System API is running",
  "timestamp": "2024-01-XX..."
}
```

## Environment Variables in Railway Dashboard

Go to your project → Variables tab and ensure these are set:

| Variable | Value | Description |
|----------|-------|-------------|
| NODE_ENV | production | Environment mode |
| JWT_SECRET | your_secret_key | JWT signing secret |
| CORS_ORIGIN | https://your-frontend.vercel.app | Frontend domain |
| DB_HOST | (auto-set) | MySQL host from Railway |
| DB_USER | (auto-set) | MySQL username |
| DB_PASSWORD | (auto-set) | MySQL password |
| DB_NAME | (auto-set) | MySQL database name |
| DB_PORT | (auto-set) | MySQL port |

## Troubleshooting

### Database Connection Issues
- Check if MySQL service is running
- Verify environment variables are set
- Check Railway logs: `railway logs`

### CORS Issues
- Update CORS_ORIGIN with your actual frontend domain
- Ensure frontend is deployed first

### Build Failures
- Check Railway logs: `railway logs`
- Verify package.json has correct start script
- Ensure all dependencies are in package.json

## Next Steps
1. ✅ Backend deployed to Railway
2. 🔄 Update frontend with new backend URL
3. 🚀 Deploy frontend to Vercel
4. 🔗 Test full application

## Support
- Railway Docs: https://docs.railway.app/
- Railway Discord: https://discord.gg/railway
