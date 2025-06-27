# OpenAI Integration for MCP Tabajara

## Overview

MCP Tabajara now supports full OpenAI API integration alongside the existing LM Studio support. This provides access to GPT-4, GPT-3.5, and other OpenAI models with advanced capabilities including streaming responses, cost tracking, and comprehensive error handling.

## Features

### ✅ Supported OpenAI Models
- **GPT-4o** - Most advanced model with vision capabilities
- **GPT-4o Mini** - Faster, cheaper GPT-4 with vision (Recommended)
- **GPT-4 Turbo** - Latest GPT-4 with improved performance
- **GPT-4** - Original GPT-4 with high reasoning capabilities
- **GPT-3.5 Turbo** - Fast and efficient for most tasks

### ✅ Core Capabilities
- **Streaming Responses** - Real-time token-by-token streaming
- **Cost Tracking** - Automatic token usage and cost calculation
- **Error Handling** - Comprehensive error messages and recovery
- **Multi-Provider Support** - Works alongside LM Studio seamlessly
- **Conversation History** - Context-aware conversations with history management
- **Voice Integration** - Full compatibility with conversation mode and speech synthesis
- **Agent Templates** - Pre-configured agents for different use cases

## Setup Instructions

### 1. Get OpenAI API Key
1. Visit [OpenAI Platform](https://platform.openai.com/api-keys)
2. Sign in to your OpenAI account
3. Create a new API key
4. Copy the key (starts with `sk-`)

### 2. Configure in MCP Tabajara
1. **Open Settings**: Click the gear icon (⚙️) in the chat interface
2. **Find OpenAI Configuration**: Look for the "OpenAI Configuration" section
3. **Enter API Key**: Paste your API key in the "API Key" field
4. **Select Default Model**: Choose your preferred model (GPT-4o Mini recommended for balance of performance and cost)
5. **Organization ID** (Optional): Enter if you're part of an OpenAI organization
6. **Test Connection**: Click "Test Connection" to verify your setup
7. **Save Settings**: Click "Save Settings" to apply changes

### 3. Start Using OpenAI
- **Automatic Agent Creation**: OpenAI agents will appear in your agent list
- **Select OpenAI Agent**: Choose any agent with "(OpenAI)" in the name
- **Start Chatting**: Begin conversations with advanced GPT capabilities

## Available Agents

### General Assistant (OpenAI)
- **Model**: GPT-4o Mini (default)
- **Use Case**: General conversations, questions, and assistance
- **Temperature**: 0.7 (balanced creativity)

### Code Assistant (OpenAI)
- **Model**: GPT-4o Mini (default)
- **Use Case**: Programming, debugging, code review, architecture
- **Temperature**: 0.2 (focused and precise)
- **Capabilities**: Advanced coding assistance with GPT-4 level expertise

### Research Assistant (OpenAI)
- **Model**: GPT-4o Mini (default)
- **Use Case**: Research, analysis, summarization, fact-checking
- **Temperature**: 0.3 (analytical and structured)
- **Capabilities**: Strong reasoning and critical analysis

### Creative Assistant (OpenAI)
- **Model**: GPT-4o Mini (default)
- **Use Case**: Creative writing, storytelling, brainstorming, poetry
- **Temperature**: 0.9 (highly creative)
- **Capabilities**: Exceptional language skills and imagination

## Cost Management

### Automatic Cost Tracking
- **Token Usage**: Tracks input and output tokens for each request
- **Real-time Costs**: Calculates costs based on current OpenAI pricing
- **Usage Metrics**: View total tokens used and average cost per request
- **Console Logging**: Detailed usage information in browser console

### Current Pricing (per 1K tokens)
- **GPT-4o**: $0.005 input, $0.015 output
- **GPT-4o Mini**: $0.00015 input, $0.0006 output (Recommended)
- **GPT-4 Turbo**: $0.01 input, $0.03 output
- **GPT-4**: $0.03 input, $0.06 output
- **GPT-3.5 Turbo**: $0.0015 input, $0.002 output

### Cost Optimization Tips
1. **Use GPT-4o Mini**: Best balance of performance and cost
2. **Shorter Conversations**: Reduce token usage by clearing chat history periodically
3. **Appropriate Models**: Use GPT-3.5 for simple tasks, GPT-4 for complex reasoning
4. **Monitor Usage**: Check console logs for cost tracking

## Advanced Features

### Streaming Responses
- **Real-time Display**: See responses as they're generated
- **Better UX**: No waiting for complete responses
- **Automatic Handling**: Works seamlessly with conversation mode
- **Error Recovery**: Graceful handling of streaming interruptions

### Error Handling
- **API Key Validation**: Automatic format checking and validation
- **Rate Limiting**: Intelligent handling of rate limits with user feedback
- **Quota Management**: Clear messages when quotas are exceeded
- **Network Issues**: Timeout handling and retry suggestions

### Multi-Provider Architecture
- **Seamless Switching**: Switch between LM Studio and OpenAI agents
- **Independent Configuration**: Separate settings for each provider
- **Fallback Support**: Use one provider when another is unavailable
- **Unified Interface**: Same chat experience regardless of provider

## Conversation Mode Integration

### Voice Compatibility
- **Full Support**: OpenAI responses work with all voice features
- **Language Detection**: Automatic language detection for speech synthesis
- **Multi-language**: Supports all 35+ languages in conversation mode
- **Quality Voices**: Uses best available system voices for each language

### Speech Features
- **Real-time Synthesis**: Speak OpenAI responses as they arrive
- **Emoji Removal**: Smart emoji filtering for natural speech
- **Voice Selection**: Automatic voice selection based on response language
- **Rate Control**: Adjustable speech rate, pitch, and volume

## Troubleshooting

### Common Issues

#### "OpenAI API key is required"
- **Solution**: Enter your API key in Settings → OpenAI Configuration
- **Check**: Ensure key starts with `sk-` and is correctly copied

#### "Invalid API key"
- **Solution**: Verify your API key is active and correct
- **Check**: Test the key at [OpenAI Platform](https://platform.openai.com/api-keys)

#### "Rate limit exceeded"
- **Solution**: Wait a few minutes before trying again
- **Prevention**: Use GPT-4o Mini for better rate limits

#### "Quota exceeded"
- **Solution**: Check your OpenAI billing and add credits
- **Monitor**: Set up billing alerts in your OpenAI account

#### Connection timeout
- **Solution**: Check your internet connection
- **Retry**: Connection issues are usually temporary

### Performance Tips

#### For Best Performance
1. **Use GPT-4o Mini**: Fastest response times and lowest cost
2. **Enable Streaming**: Better perceived performance
3. **Manage History**: Clear long conversations to reduce token usage
4. **Stable Internet**: Ensure good connection for streaming

#### For Best Quality
1. **Use GPT-4o**: Highest quality responses with vision capabilities
2. **Detailed Prompts**: More specific prompts yield better results
3. **System Prompts**: Leverage agent-specific system prompts
4. **Context Management**: Maintain relevant conversation context

## API Limits and Considerations

### Rate Limits
- **Tier 1**: 500 RPM, 30,000 TPM (tokens per minute)
- **Tier 2**: 5,000 RPM, 450,000 TPM
- **Higher Tiers**: Available based on usage history

### Context Limits
- **GPT-4o/GPT-4o Mini**: 128,000 tokens context
- **GPT-4 Turbo**: 128,000 tokens context
- **GPT-4**: 8,192 tokens context
- **GPT-3.5 Turbo**: 16,385 tokens context

### Best Practices
1. **Monitor Usage**: Keep track of token consumption
2. **Optimize Prompts**: Clear, concise prompts work best
3. **Use Appropriate Models**: Match model to task complexity
4. **Manage Context**: Trim conversation history when needed

## Security and Privacy

### API Key Security
- **Local Storage**: API keys stored locally in browser
- **No Server Storage**: Keys never sent to our servers
- **HTTPS Only**: All OpenAI communication uses HTTPS
- **User Control**: You maintain full control of your API key

### Data Privacy
- **Direct Communication**: Your data goes directly to OpenAI
- **No Intermediary**: MCP Tabajara doesn't store or process your conversations
- **OpenAI Policy**: Subject to OpenAI's privacy policy and terms
- **Local History**: Conversation history stored locally in your browser

## Technical Architecture

### Client Architecture
```
OpenAIClient.js
├── Connection Management
├── Streaming Support
├── Error Handling
├── Cost Tracking
└── Model Management

MCPAgentManager.js
├── Multi-Provider Support
├── Agent Routing
├── History Management
└── Event Coordination

UIManager.js
├── Settings Interface
├── Connection Testing
├── Status Display
└── User Experience
```

### Integration Points
- **Event Bus**: Seamless communication between components
- **Storage**: Persistent settings and configuration
- **Voice System**: Full conversation mode integration
- **Agent System**: Dynamic agent creation and management

## Future Enhancements

### Planned Features
- **Vision Support**: Image analysis with GPT-4o models
- **Function Calling**: Tool use and function execution
- **Fine-tuned Models**: Support for custom fine-tuned models
- **Batch Processing**: Efficient batch request handling
- **Advanced Analytics**: Detailed usage analytics and insights

### Potential Integrations
- **Azure OpenAI**: Support for Azure-hosted OpenAI models
- **Custom Endpoints**: Support for OpenAI-compatible APIs
- **Model Comparison**: Side-by-side model comparison features
- **Cost Optimization**: Intelligent model selection based on task

## Support and Resources

### Documentation
- [OpenAI API Documentation](https://platform.openai.com/docs)
- [Model Capabilities](https://platform.openai.com/docs/models)
- [Rate Limits](https://platform.openai.com/docs/guides/rate-limits)
- [Pricing](https://openai.com/pricing)

### Getting Help
1. **Test Connection**: Use the built-in connection test
2. **Check Console**: Browser console shows detailed error messages
3. **Verify Settings**: Ensure API key and model selection are correct
4. **OpenAI Status**: Check [OpenAI Status Page](https://status.openai.com/)

### Community
- **GitHub Issues**: Report bugs and request features
- **Documentation**: Comprehensive setup and usage guides
- **Examples**: Real-world usage examples and best practices

---

**Note**: OpenAI API usage is subject to OpenAI's terms of service and pricing. Monitor your usage to avoid unexpected charges. The integration is designed to be transparent about costs and usage. 