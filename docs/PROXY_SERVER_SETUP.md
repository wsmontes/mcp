# Anthropic Claude Proxy Server Setup

## 🚨 Important: CORS Restriction Solution

Claude models require a **proxy server** to bypass browser CORS restrictions. The Anthropic API cannot be accessed directly from a web browser due to security policies.

## 📋 Prerequisites

1. **Node.js** (v14.0.0 or higher) - [Download here](https://nodejs.org/)
2. **npm** (comes with Node.js)
3. **Anthropic API Key** - [Get one here](https://console.anthropic.com/)

## ⚡ Quick Start

### Option 1: Automated Setup (Recommended)
```bash
# Run the startup script (automatically installs dependencies)
./start-proxy.sh
```

### Option 2: Manual Setup
```bash
# Install dependencies
npm install

# Start the proxy server
npm start
```

## 🔧 Configuration

### Default Settings
- **Proxy Server**: `http://localhost:3001`
- **Target API**: `https://api.anthropic.com/v1`
- **CORS**: Enabled for all origins
- **Streaming**: Fully supported

### Environment Variables (Optional)
```bash
# Set custom port
export PORT=3001

# Set in terminal before starting
PORT=3002 npm start
```

## 🏗️ Architecture Overview

```
[Browser] → [Proxy Server :3001] → [Anthropic API]
    ↓              ↓                      ↓
  CORS OK      Handles CORS         No CORS headers
               & Streaming
```

### How it Works
1. **Browser** sends requests to `localhost:3001/api/anthropic/*`
2. **Proxy Server** adds proper headers and forwards to Anthropic API
3. **Responses** are forwarded back with CORS headers enabled
4. **Streaming** responses are properly handled and piped through

## 📡 API Endpoints

### Health Check
```
GET http://localhost:3001/health
```
Response:
```json
{
  "status": "ok",
  "timestamp": "2025-01-25T14:30:00.000Z"
}
```

### Claude API Proxy
```
POST http://localhost:3001/api/anthropic/messages
```
- Forwards to: `https://api.anthropic.com/v1/messages`
- Headers: Automatically adds CORS and forwards API key
- Supports both streaming and non-streaming requests

## 🔐 Security Features

### API Key Handling
- API keys are passed through `x-api-key` header
- Keys are not logged or stored by the proxy
- Proxy only forwards authorized requests

### CORS Configuration
```javascript
// Enabled for all origins during development
app.use(cors());

// For production, consider restricting origins:
app.use(cors({
  origin: ['http://localhost:8000', 'https://yourdomain.com']
}));
```

### Request Validation
- Validates presence of API key header
- Checks request format before forwarding
- Handles errors gracefully without exposing internals

## 🚀 Usage in MCP-Tabajara

### 1. Start the Proxy Server
```bash
./start-proxy.sh
```

### 2. Configure Claude in Settings
- Enter your Anthropic API key
- Select your preferred Claude model
- Test the connection (should show "Connected" if proxy is running)

### 3. Start Using Claude
- The system automatically routes Claude requests through the proxy
- No additional configuration needed
- Works with streaming and non-streaming requests

## 🔍 Troubleshooting

### Common Issues

#### ❌ "Connection Refused" Error
**Problem**: Proxy server is not running
**Solution**: 
```bash
./start-proxy.sh
```

#### ❌ "CORS Error" 
**Problem**: Trying to access Anthropic API directly
**Solution**: Ensure proxy is running and configure baseUrl in AnthropicClient

#### ❌ "API Key Invalid"
**Problem**: Incorrect or missing API key
**Solution**: 
1. Verify API key in Anthropic Console
2. Check key format (should start with `sk-ant-`)
3. Test connection in MCP-Tabajara settings

#### ❌ Port Already in Use
**Problem**: Port 3001 is occupied
**Solution**: 
```bash
# Use different port
PORT=3002 npm start
```
Then update AnthropicClient baseUrl to match.

### Debug Mode
```bash
# Start with verbose logging
npm run dev
```

### Logs Location
- **Console**: Real-time logs in terminal
- **Request Headers**: Logged (without sensitive data)
- **Errors**: Detailed error messages with context

## 🔄 Development & Testing

### Testing the Proxy
```bash
# Test health endpoint
curl http://localhost:3001/health

# Test proxy with your API key
curl -X POST http://localhost:3001/api/anthropic/messages \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -d '{
    "model": "claude-3-sonnet-20240229",
    "max_tokens": 100,
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
```

### Hot Reload (Development)
```bash
# Install nodemon globally
npm install -g nodemon

# Start with auto-restart
npm run dev
```

## 📊 Performance Considerations

### Resource Usage
- **Memory**: ~50MB typical usage
- **CPU**: Low (mainly I/O bound)
- **Network**: 1:1 proxy ratio with Anthropic API

### Scaling
- Single instance handles 100+ concurrent requests
- For high load, consider:
  - Load balancer with multiple proxy instances
  - Connection pooling
  - Rate limiting

### Monitoring
```javascript
// Built-in request logging
console.log(`Proxying request to: ${anthropicUrl}`);
console.log('Headers:', Object.keys(headers));
```

## 🔒 Production Deployment

### Security Checklist
- [ ] Restrict CORS origins to your domain
- [ ] Use HTTPS for production
- [ ] Implement rate limiting
- [ ] Add request logging
- [ ] Use environment variables for sensitive config

### Docker Deployment (Optional)
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3001
CMD ["npm", "start"]
```

## 🆘 Support

### Getting Help
1. Check the proxy server console for error messages
2. Verify your Anthropic API key is valid
3. Test the health endpoint: `http://localhost:3001/health`
4. Ensure no firewall blocking port 3001

### Common Commands
```bash
# Start proxy
./start-proxy.sh

# Stop proxy
Ctrl+C

# Restart proxy
./start-proxy.sh

# Check proxy status
curl http://localhost:3001/health
```

---

## ✅ Quick Verification

After setup, verify everything works:

1. ✅ Proxy server starts without errors
2. ✅ Health check returns `{"status": "ok"}`
3. ✅ MCP-Tabajara settings show "Connected" for Claude
4. ✅ Can send test messages to Claude models
5. ✅ Streaming responses work properly

**🎉 Success!** You can now use Claude models in MCP-Tabajara without CORS restrictions. 