# Google Gemini Integration

This document describes the implementation of Google Gemini models integration into the MCP Tabajara application using the proxy server architecture.

## Overview

The Gemini integration follows the same agnostic architecture pattern as other LLM providers, ensuring consistency and maintainability. The implementation includes:

1. **GeminiClient.js** - A complete client implementation extending BaseLLMClient
2. **Proxy Server Updates** - Enhanced proxy server to handle Gemini API calls
3. **Registry Integration** - Full integration with the LLM Provider Registry
4. **Configuration Management** - Support for Gemini API key configuration

## Architecture

### 1. GeminiClient.js

Located at `js/modules/agents/GeminiClient.js`, this client implements:

- **BaseLLMClient Extension**: Follows the standardized interface
- **Gemini API Compatibility**: Handles Gemini-specific request/response formats
- **Streaming Support**: Full streaming chat completion support
- **Vision Capabilities**: Support for image input via inline data
- **Safety Settings**: Configurable safety filters
- **Cost Tracking**: Character-based usage tracking and cost calculation

#### Key Features:

```javascript
// Model pricing per 1M characters (as of 2024)
this.modelPricing = {
    'gemini-1.5-flash': { input: 0.075, output: 0.30 },
    'gemini-1.5-pro': { input: 3.50, output: 10.50 },
    'gemini-1.5-flash-exp': { input: 0.075, output: 0.30 },
    'gemini-1.5-pro-exp': { input: 3.50, output: 10.50 },
    'gemini-1.0-pro': { input: 1.50, output: 4.50 },
    'gemini-1.0-pro-vision': { input: 1.50, output: 4.50 }
};

// Capabilities
this.updateCapabilities({
    streaming: true,
    functionCalling: true,
    vision: true,
    imageGeneration: false,
    reasoning: true,
    maxContextLength: 1000000, // 1M tokens
    supportedFormats: ['text', 'image'],
    customParameters: ['temperature', 'top_p', 'top_k', 'max_output_tokens', 'candidate_count']
});
```

### 2. Proxy Server Updates

The proxy server (`proxy-server.js`) now supports:

- **Gemini API Endpoint**: `/api/gemini/*` routes
- **Authentication**: API key forwarding via headers
- **Streaming Support**: Both streaming and non-streaming requests
- **Error Handling**: Comprehensive error handling for Gemini-specific errors

#### Proxy Routes:

```
GET  /api/gemini/models                    # List available models
POST /api/gemini/models/{model}:generateContent      # Non-streaming chat
POST /api/gemini/models/{model}:streamGenerateContent # Streaming chat
```

### 3. Registry Integration

The Gemini provider is fully integrated into the LLM Provider Registry:

```javascript
// Registration in AgnosticMCPManager.js
this.registry.registerProvider(
    'gemini',
    GeminiClient,
    {
        baseUrl: 'http://localhost:3001/api/gemini',
        apiVersion: 'v1',
        defaultModel: 'gemini-1.5-flash',
        timeout: 60000
    },
    {
        name: 'Google Gemini',
        description: 'Google\'s Gemini models with advanced reasoning and vision capabilities',
        version: '1.0.0',
        homepage: 'https://ai.google.dev/gemini',
        supportLevel: 'official',
        tags: ['gemini', 'google', 'reasoning', 'vision', 'commercial', 'advanced']
    }
);
```

## Configuration

### API Key Setup

1. **Get Gemini API Key**: Visit [Google AI Studio](https://aistudio.google.com/app/apikey)
2. **Configure in Settings**: Add your API key to the application settings
3. **Validation**: API keys must start with "AIza" (Gemini format)

### Model Selection

The integration supports all major Gemini models:

- **gemini-1.5-flash** (recommended for most use cases)
- **gemini-1.5-pro** (for complex reasoning tasks)
- **gemini-1.5-flash-exp** (experimental flash model)
- **gemini-1.5-pro-exp** (experimental pro model)
- **gemini-1.0-pro** (legacy model)
- **gemini-1.0-pro-vision** (legacy vision model)

## Usage Examples

### Basic Chat Completion

```javascript
import { GeminiClient } from './js/modules/agents/GeminiClient.js';

const client = new GeminiClient({
    apiKey: 'your-api-key',
    baseUrl: 'http://localhost:3001/api/gemini'
});

await client.initialize();

const response = await client.createChatCompletion([
    { role: 'user', content: 'Hello, how are you?' }
], {
    model: 'gemini-1.5-flash',
    temperature: 0.7
});

console.log(response.content);
```

### Streaming Chat

```javascript
const response = await client.createStreamingChatCompletion([
    { role: 'user', content: 'Tell me a story' }
], {
    model: 'gemini-1.5-flash'
}, (chunk) => {
    console.log('Streaming:', chunk.content);
});
```

### Vision Support

```javascript
const messages = [
    {
        role: 'user',
        content: [
            { type: 'text', text: 'What do you see in this image?' },
            { 
                type: 'image_url', 
                image_url: { 
                    url: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQ...' 
                } 
            }
        ]
    }
];

const response = await client.createChatCompletion(messages, {
    model: 'gemini-1.5-flash'
});
```

## Testing

A comprehensive test file is provided at `test-gemini.html` that includes:

1. **Proxy Server Test**: Verifies proxy server is running
2. **Client Initialization**: Tests Gemini client setup
3. **Model Fetching**: Retrieves available models
4. **Chat Completion**: Tests basic conversation

To test the integration:

1. Start the proxy server: `node proxy-server.js`
2. Open `test-gemini.html` in a browser
3. Enter your Gemini API key
4. Run the tests sequentially

## Error Handling

The integration includes comprehensive error handling:

- **Authentication Errors**: Invalid API key detection
- **Model Not Found**: Handles unavailable models gracefully
- **Rate Limiting**: Respects Gemini API limits
- **Network Errors**: Connection timeout handling
- **Streaming Errors**: Graceful stream interruption handling

## Cost Tracking

The integration tracks usage and calculates costs:

- **Character Counting**: Tracks input/output characters
- **Token Estimation**: Converts characters to tokens (4 chars ≈ 1 token)
- **Cost Calculation**: Uses current Gemini pricing
- **Usage Metrics**: Comprehensive request tracking

## Security

- **API Key Protection**: Keys are never logged or exposed
- **Proxy Security**: All requests go through the secure proxy
- **Input Validation**: Comprehensive input sanitization
- **Safety Settings**: Configurable content filtering

## Performance

- **Connection Pooling**: Efficient HTTP connection management
- **Request Batching**: Optimized for multiple concurrent requests
- **Caching**: Model list caching for improved performance
- **Timeout Handling**: Configurable request timeouts

## Troubleshooting

### Common Issues

1. **"API key not configured"**
   - Ensure API key is set in settings
   - Verify key starts with "AIza"

2. **"Proxy server not running"**
   - Start proxy server: `node proxy-server.js`
   - Check port 3001 is available

3. **"Model not found"**
   - Verify model name is correct
   - Check API key has access to requested model

4. **"Streaming error"**
   - Check network connectivity
   - Verify proxy server supports streaming

### Debug Mode

Enable debug logging by setting:

```javascript
localStorage.setItem('debug', 'true');
```

## Future Enhancements

Potential improvements for the Gemini integration:

1. **Function Calling**: Enhanced function calling support
2. **Multi-modal**: Better image and audio support
3. **Fine-tuning**: Support for custom models
4. **Embeddings**: Text embedding capabilities
5. **Batch Processing**: Efficient batch request handling

## Conclusion

The Gemini integration provides a robust, feature-complete implementation that follows the established architectural patterns. It offers full compatibility with the existing MCP Tabajara application while providing access to Google's advanced AI capabilities.

The implementation is production-ready and includes comprehensive error handling, cost tracking, and performance optimizations. 