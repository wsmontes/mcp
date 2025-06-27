# Anthropic Claude Integration Guide

## 🤖 Overview

The MCP-Tabajara project now includes comprehensive support for Anthropic's Claude models, featuring the latest Claude 4, Claude 3.7, Claude 3.5, and Claude 3 variants. This integration follows the same agnostic architecture as other providers, allowing seamless switching between different LLM providers.

## 🚨 IMPORTANT: Proxy Server Required

**Claude models cannot be accessed directly from browsers due to CORS restrictions.** You must run the included proxy server to use Claude models.

### Quick Setup
1. **Start the proxy server** (keep running while using Claude):
   ```bash
   ./start-proxy.sh
   ```

2. **Configure your API key** in MCP-Tabajara settings

3. **Start using Claude models**

📖 **Detailed proxy setup**: See `PROXY_SERVER_SETUP.md` for complete documentation.

## 🚀 Supported Models

### Claude 4 Series (Latest)
- **Claude Opus 4** (`claude-opus-4-20250514`) - Most capable, best for complex reasoning
- **Claude Sonnet 4** (`claude-sonnet-4-20250514`) - **Recommended** - Best balance of performance and cost

### Claude 3.7 Series
- **Claude Sonnet 3.7** (`claude-sonnet-3.7-20250514`) - Enhanced version of Sonnet 3.5

### Claude 3.5 Series
- **Claude Sonnet 3.5** (`claude-sonnet-3.5-20241022`) - High intelligence and speed
- **Claude Haiku 3.5** (`claude-haiku-3.5-20241022`) - Fast and lightweight

### Claude 3 Series (Legacy)
- **Claude Opus 3** (`claude-opus-3-20240229`) - Most capable Claude 3 model
- **Claude Sonnet 3** (`claude-sonnet-3-20240229`) - Balanced Claude 3 model
- **Claude Haiku 3** (`claude-haiku-3-20240307`) - Fastest Claude 3 model

## ⚙️ Configuration

### 1. Getting Your API Key

1. **Sign Up**: Create an account at [Anthropic Console](https://console.anthropic.com/)
2. **Get API Key**: Navigate to [API Keys](https://console.anthropic.com/account/keys)
3. **Generate Key**: Create a new API key (starts with `sk-ant-`)
4. **Copy Key**: Save your API key securely

### 2. Configuring in MCP-Tabajara

1. **Open Settings**: Click the gear icon (⚙️) in the chat interface
2. **Find Anthropic Section**: Locate "Anthropic Claude Configuration"
3. **Enter API Key**: Paste your API key (format: `sk-ant-...`)
4. **Select Model**: Choose your preferred default model (Claude Sonnet 4 recommended)
5. **Set Version**: API version (default: `2023-06-01`)
6. **Test Connection**: Click "Test Connection" to verify setup
7. **Save Settings**: Click "Save Settings" to apply changes

### 3. Configuration Options

```javascript
{
  apiKey: "sk-ant-...",                    // Required: Your Anthropic API key
  defaultModel: "claude-sonnet-4-20250514", // Default model to use
  anthropicVersion: "2023-06-01"           // API version for compatibility
}
```

## 🔧 Technical Implementation

### Architecture Integration

The Anthropic integration follows the established provider pattern:

```
AnthropicClient extends BaseLLMClient
├── Implements all required abstract methods
├── Handles Claude-specific API format
├── Manages streaming and non-streaming responses
├── Provides model capabilities and pricing
└── Integrates with AgnosticMCPManager
```

### Key Features

- **Streaming Support**: Real-time response streaming with proper event handling
- **Multi-modal Input**: Support for text, images, and documents
- **System Prompts**: Proper handling of Claude's system prompt format
- **Tool Calling**: Support for function calling and tool use
- **Error Handling**: Comprehensive error detection and user-friendly messages
- **Rate Limiting**: Awareness of Anthropic's rate limits and proper retry logic
- **Cost Tracking**: Token usage and cost calculation for all models

### File Structure

```
js/modules/agents/
├── AnthropicClient.js        # New: Claude API client implementation
├── AgnosticMCPManager.js     # Updated: Added Anthropic provider registration
├── BaseLLMClient.js          # Base class (unchanged)
└── LLMProviderRegistry.js    # Registry system (unchanged)

js/modules/ui/
└── UIManager.js              # Updated: Added Anthropic settings UI
```

## 🌟 Claude-Specific Features

### 1. Advanced Reasoning
Claude models excel at:
- Complex analytical tasks
- Long-form reasoning
- Code analysis and generation
- Research and synthesis

### 2. Large Context Windows
- **200,000 tokens** context length
- Handle very long documents
- Maintain conversation context
- Process extensive code bases

### 3. Safety and Alignment
- Built-in safety measures
- Refuse harmful requests appropriately
- Ethical AI responses
- Content filtering

### 4. Multi-modal Capabilities
- **Vision**: Image analysis and description
- **Documents**: PDF and text document processing
- **Code**: Advanced code understanding

## 📊 Model Comparison

| Model | Speed | Intelligence | Cost | Use Case |
|-------|-------|-------------|------|----------|
| Claude Opus 4 | Slower | Highest | Highest | Complex reasoning, research |
| **Claude Sonnet 4** ⭐ | Medium | Very High | Medium | **Recommended for most tasks** |
| Claude Sonnet 3.7 | Medium | High | Medium | Enhanced balanced performance |
| Claude Sonnet 3.5 | Fast | High | Medium | General purpose |
| Claude Haiku 3.5 | Fastest | Good | Lowest | Quick tasks, simple queries |

## 🔒 Security Features

### API Key Validation
- Format validation (`sk-ant-` prefix)
- Length validation (minimum 20 characters)
- Secure storage in localStorage
- Masked display in UI

### Error Handling
- **401 Unauthorized**: Invalid API key
- **403 Forbidden**: Insufficient permissions
- **429 Rate Limited**: Too many requests
- **Network Errors**: Connection issues

### Privacy Protection
- API keys never logged to console
- Sensitive data excluded from exports
- No API key transmission in error messages

## 🚀 Advanced Usage

### Custom Parameters

Claude supports several advanced parameters:

```javascript
{
  temperature: 1.0,        // Creativity (0.0-1.0)
  top_p: 1.0,             // Nucleus sampling
  top_k: 0,               // Top-k sampling
  max_tokens: 4096,       // Maximum response length
  stop_sequences: ["END"] // Custom stop sequences
}
```

### System Prompts

Claude handles system prompts differently:

```javascript
// Input format (OpenAI style)
[
  { role: "system", content: "You are a helpful assistant" },
  { role: "user", content: "Hello" }
]

// Converted to Claude format
{
  system: "You are a helpful assistant",
  messages: [
    { role: "user", content: "Hello" }
  ]
}
```

### Streaming Response Format

Claude streaming uses Server-Sent Events (SSE):

```javascript
// Stream events
message_start    -> Initialize message
content_block_delta -> Text content chunks
message_delta    -> Final usage and stop reason
```

## 📈 Performance Metrics

### Token Pricing (per 1K tokens)

| Model | Input | Output |
|-------|-------|--------|
| Claude Opus 4 | $0.015 | $0.075 |
| Claude Sonnet 4 | $0.003 | $0.015 |
| Claude Sonnet 3.7 | $0.003 | $0.015 |
| Claude Sonnet 3.5 | $0.003 | $0.015 |
| Claude Haiku 3.5 | $0.0008 | $0.004 |

### Rate Limits (Tier 1)

| Model | Requests/min | Input tokens/min | Output tokens/min |
|-------|-------------|------------------|-------------------|
| Claude Opus 4 | 50 | 20,000 | 8,000 |
| Claude Sonnet 4 | 50 | 20,000 | 8,000 |
| Claude Sonnet 3.5 | 50 | 40,000 | 8,000 |
| Claude Haiku 3.5 | 50 | 50,000 | 10,000 |

## 🛠️ Troubleshooting

### Common Issues

#### 1. Connection Test Fails
- **Cause**: Invalid API key or network issues
- **Solution**: Verify API key format and internet connection
- **Check**: API key should start with `sk-ant-`

#### 2. Rate Limit Errors
- **Cause**: Too many requests too quickly
- **Solution**: Wait for rate limit reset or upgrade tier
- **Prevention**: Implement proper request spacing

#### 3. Authentication Errors
- **Cause**: Expired or invalid API key
- **Solution**: Generate new API key from Anthropic Console
- **Verify**: Test with simple API call

#### 4. Model Not Available
- **Cause**: Model ID incorrect or not accessible
- **Solution**: Check model availability and spelling
- **Update**: Use latest model IDs from documentation

### Debug Information

Enable debug logging to troubleshoot:

```javascript
// Check provider status
console.log(window.mcpApp.agnosticManager.getProviderStatus());

// Check available models
console.log(window.mcpApp.agnosticManager.getAvailableModels());

// Check provider health
console.log(window.mcpApp.agnosticManager.getSystemStatus());
```

## 🔄 Migration from Other Providers

### From OpenAI
- Similar API structure with some differences
- System prompts handled differently
- Response format variations
- Different model naming convention

### Provider Comparison

| Feature | OpenAI | Anthropic | DeepSeek |
|---------|--------|-----------|----------|
| Context Length | 128K | 200K | 64K |
| Vision | ✅ | ✅ | ❌ |
| Function Calling | ✅ | ✅ | ✅ |
| Streaming | ✅ | ✅ | ✅ |
| Safety Features | Good | Excellent | Good |

## 📚 Additional Resources

- **Anthropic Documentation**: [docs.anthropic.com](https://docs.anthropic.com/)
- **API Reference**: [console.anthropic.com](https://console.anthropic.com/)
- **Model Pricing**: [anthropic.com/pricing](https://anthropic.com/pricing)
- **Rate Limits**: [docs.anthropic.com/en/api/rate-limits](https://docs.anthropic.com/en/api/rate-limits)

## 🎯 Best Practices

### Model Selection
- **General Use**: Claude Sonnet 4 (best balance)
- **Complex Tasks**: Claude Opus 4 (highest capability)
- **Quick Tasks**: Claude Haiku 3.5 (fastest, cheapest)
- **Cost-Conscious**: Claude Haiku 3.5 or Sonnet 3.5

### API Usage
- Monitor token usage and costs
- Implement proper error handling
- Respect rate limits
- Use appropriate timeout values

### Security
- Rotate API keys regularly
- Store keys securely
- Monitor usage in Anthropic Console
- Set up billing alerts

## ✅ Integration Checklist

- [x] **AnthropicClient Implementation**: Complete Claude API client
- [x] **Provider Registration**: Integrated with AgnosticMCPManager
- [x] **UI Configuration**: Settings panel with all options
- [x] **Connection Testing**: Test API connectivity
- [x] **Model Support**: All major Claude models
- [x] **Streaming Support**: Real-time response streaming
- [x] **Error Handling**: Comprehensive error management
- [x] **Cost Tracking**: Token usage and pricing
- [x] **Rate Limit Awareness**: Proper limit handling
- [x] **Security Features**: API key validation and protection
- [x] **Documentation**: Complete integration guide

The Anthropic Claude integration is now fully functional and ready for production use! 