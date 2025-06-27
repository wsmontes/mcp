# Deployment Guide

This guide explains how to deploy MCP Tabajara to various hosting platforms.

## Build Process

Before deploying, you need to build the application:

```bash
npm install
npm run build
```

This creates a `dist/` folder with optimized files ready for deployment.

## Deployment Options

### 1. Static Hosting (Recommended)

The application can be deployed to any static hosting service:

#### Netlify
1. Connect your repository to Netlify
2. Set build command: `npm run build`
3. Set publish directory: `dist`
4. Deploy automatically on push

#### Vercel
1. Connect your repository to Vercel
2. Framework preset: Other
3. Build command: `npm run build`
4. Output directory: `dist`
5. Deploy automatically on push

#### GitHub Pages
1. Enable GitHub Pages in repository settings
2. Set source to GitHub Actions
3. Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to GitHub Pages
on:
  push:
    branches: [ main ]
jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v2
    - uses: actions/setup-node@v2
      with:
        node-version: '18'
    - run: npm install
    - run: npm run build
    - uses: peaceiris/actions-gh-pages@v3
      with:
        github_token: ${{ secrets.GITHUB_TOKEN }}
        publish_dir: ./dist
```

### 2. Traditional Web Server

Upload the contents of the `dist/` folder to your web server:

```bash
# Example with rsync
rsync -avz dist/ user@your-server:/var/www/html/

# Example with scp
scp -r dist/* user@your-server:/var/www/html/
```

### 3. Docker Deployment

Create a `Dockerfile`:

```dockerfile
FROM nginx:alpine
COPY dist/ /usr/share/nginx/html/
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

Build and run:

```bash
docker build -t mcp-tabajara .
docker run -p 80:80 mcp-tabajara
```

## Proxy Server Deployment

If you need the CORS proxy server:

### 1. Separate Deployment
Deploy the proxy server separately:

```bash
# On your server
npm install
npm run proxy
```

### 2. Environment Variables
Set up environment variables for API keys:

```bash
export OPENAI_API_KEY=your_key
export ANTHROPIC_API_KEY=your_key
export DEEPSEEK_API_KEY=your_key
```

### 3. Process Management
Use PM2 for production:

```bash
npm install -g pm2
pm2 start proxy-server.js --name mcp-proxy
pm2 startup
pm2 save
```

## Configuration

### Environment Variables
Create a `.env` file for local development:

```env
OPENAI_API_KEY=your_openai_key
ANTHROPIC_API_KEY=your_anthropic_key
DEEPSEEK_API_KEY=your_deepseek_key
PROXY_URL=http://localhost:3001
```

### CORS Configuration
If deploying to a different domain than the proxy server, update the proxy server CORS settings in `proxy-server.js`.

## Performance Optimization

The Vite build process automatically optimizes:
- CSS minification and purging
- JavaScript bundling and minification
- Asset optimization
- Tree shaking

## Monitoring

### Frontend
- Use browser dev tools to monitor performance
- Check for console errors
- Monitor network requests

### Backend (Proxy)
- Monitor server logs
- Check API response times
- Monitor error rates

## Troubleshooting

### Common Issues

1. **CORS Errors**: Ensure proxy server is running and accessible
2. **API Key Issues**: Verify environment variables are set correctly
3. **Build Failures**: Check Node.js version (requires 14+)
4. **Styling Issues**: Ensure Tailwind CSS is building correctly

### Debug Commands

```bash
# Check build output
npm run build

# Preview production build
npm run preview

# Check proxy server
npm run proxy

# View logs
tail -f logs/app.log
```

## Security Considerations

1. **API Keys**: Never commit API keys to version control
2. **HTTPS**: Use HTTPS in production
3. **CORS**: Configure CORS properly for your domain
4. **Rate Limiting**: Implement rate limiting on the proxy server
5. **Input Validation**: Validate all user inputs

## Support

For deployment issues, check:
1. [Vite Documentation](https://vitejs.dev/guide/)
2. [Tailwind CSS Documentation](https://tailwindcss.com/docs)
3. [Express.js Documentation](https://expressjs.com/) 