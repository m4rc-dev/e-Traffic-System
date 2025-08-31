# Frontend Deployment Guide

## Prerequisites
- Node.js 18+ installed
- Git repository set up
- API backend deployed and accessible

## Option 1: Vercel Deployment (Recommended)

### 1. Install Vercel CLI
```bash
npm install -g vercel
```

### 2. Login to Vercel
```bash
vercel login
```

### 3. Deploy
```bash
cd client
vercel --prod
```

### 4. Set Environment Variables
In Vercel dashboard, set:
- `REACT_APP_API_URL`: Your production API URL
- `REACT_APP_ENV`: production

## Option 2: Netlify Deployment

### 1. Install Netlify CLI
```bash
npm install -g netlify-cli
```

### 2. Login to Netlify
```bash
netlify login
```

### 3. Build and Deploy
```bash
cd client
npm run build
netlify deploy --prod --dir=build
```

### 4. Set Environment Variables
In Netlify dashboard, set:
- `REACT_APP_API_URL`: Your production API URL

## Option 3: Manual Deployment

### 1. Build the Application
```bash
cd client
npm run build:prod
```

### 2. Upload to Web Server
Upload the `build` folder contents to your web server's public directory.

### 3. Configure Server
Ensure your server is configured to serve `index.html` for all routes (SPA routing).

## Environment Variables

### Development (.env.local)
```
REACT_APP_API_URL=http://localhost:5000/api
```

### Production
```
REACT_APP_API_URL=https://your-production-api.com/api
REACT_APP_ENV=production
```

## Important Notes

1. **API URL**: Update `REACT_APP_API_URL` to point to your deployed backend
2. **CORS**: Ensure your backend allows requests from your frontend domain
3. **HTTPS**: Production deployments should use HTTPS
4. **Build Optimization**: The build process optimizes and minifies your code
5. **Environment**: Use different environment files for different deployment stages

## Troubleshooting

### Build Errors
- Ensure all dependencies are installed: `npm install`
- Check for syntax errors in your code
- Verify environment variables are set correctly

### Runtime Errors
- Check browser console for errors
- Verify API endpoints are accessible
- Ensure CORS is configured correctly on backend

### Deployment Issues
- Check deployment logs in your platform's dashboard
- Verify build output directory is correct
- Ensure all required environment variables are set
