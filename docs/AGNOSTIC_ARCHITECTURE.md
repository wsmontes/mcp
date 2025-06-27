# Agnostic LLM Architecture

This document describes the comprehensive agnostic architecture implemented to manage different LLM providers with standardized processes and services.

## 🎯 Architecture Overview

The application now uses a provider-agnostic architecture that allows seamless integration and management of multiple LLM providers while maintaining consistent interfaces and capabilities.

### Key Components

1. **BaseLLMClient** - Abstract base class defining the standard interface
2. **LLMProviderRegistry** - Centralized provider management and discovery
3. **AgnosticMCPManager** - Provider-agnostic request management
4. **LLMConfigSchema** - Standardized configuration definitions

## 🏗️ Component Architecture

### 1. BaseLLMClient (Abstract Base Class)

**File**: `js/modules/agents/BaseLLMClient.js`

**Purpose**: Defines the standard interface that all LLM providers must implement.

**Key Features**:
- Standardized method signatures for all providers
- Common metrics tracking across providers
- Unified configuration management
- Provider capability system
- Built-in retry logic with exponential backoff
- Standard message formatting methods

**Abstract Methods** (must be implemented by subclasses):
```javascript
async getModels()
async createChatCompletion(messages, options)
async createStreamingChatCompletion(messages, options, onChunk)
async testConnection()
getHeaders()
```

**Standardized Methods** (inherited by all providers):
```javascript
async initialize()
updateConfig(newConfig)
getConfig()
getProviderInfo()
getCapabilities()
getMetrics()
calculateCost(usage)
formatMessages(messages)
createSystemMessage(content)
createUserMessage(content)
createAssistantMessage(content)
```

### 2. LLMProviderRegistry

**File**: `js/modules/agents/LLMProviderRegistry.js`

**Purpose**: Centralized registry for managing all LLM providers.

**Key Features**:
- Dynamic provider registration and discovery
- Configuration management for all providers
- Provider health monitoring and status tracking
- Capability-based provider selection
- Load balancing and failover support
- Import/export of provider configurations

**Core Methods**:
```javascript
registerProvider(providerId, ProviderClass, defaultConfig, metadata)
configureProvider(providerId, config)
createProviderInstance(providerId)
getProviderInstance(providerId)
findProvidersByCapability(capabilities)
getBestProviderForTask(requirements)
```

### 3. AgnosticMCPManager

**File**: `js/modules/agents/AgnosticMCPManager.js`

**Purpose**: Provider-agnostic request management and orchestration.

**Key Features**:
- Automatic provider selection based on capabilities
- Request queuing and load balancing
- Health monitoring and failover
- Conversation history management
- Metrics and analytics collection
- Standardized error handling

**Core Methods**:
```javascript
async initialize()
async processMessage(chatId, message, options)
async configureProvider(providerId, config)
async switchProvider(providerId)
getAvailableModels()
getSystemStatus()
```

### 4. LLMConfigSchema

**File**: `js/modules/core/LLMConfigSchema.js`

**Purpose**: Standardized configuration schema for all providers.

**Key Features**:
- Common configuration fields for all providers
- Provider-specific configuration extensions
- Configuration validation and type checking
- Default value generation
- UI schema generation for forms

## 🔌 Provider Implementation

### Current Providers

#### OpenAI Provider
- **Capabilities**: Streaming, Function Calling, Vision, Reasoning
- **Models**: GPT-4o, GPT-4o-mini, GPT-4-turbo, GPT-4, GPT-3.5-turbo
- **Pricing**: Token-based with detailed cost tracking
- **Special Features**: Organization support, comprehensive model options

#### DeepSeek Provider
- **Capabilities**: Streaming, Function Calling, Advanced Reasoning
- **Models**: deepseek-chat, deepseek-reasoner
- **Pricing**: Competitive token-based pricing
- **Special Features**: Specialized reasoning capabilities

#### LM Studio Provider
- **Capabilities**: Streaming, Local deployment
- **Models**: Dynamic model detection from LM Studio
- **Pricing**: Free (local deployment)
- **Special Features**: No API key required, privacy-focused

### Adding New Providers

To add a new LLM provider:

1. **Create Provider Class** extending `BaseLLMClient`:
```javascript
import { BaseLLMClient } from './BaseLLMClient.js';

export class NewProviderClient extends BaseLLMClient {
    constructor(config = {}) {
        super({
            providerId: 'newprovider',
            providerName: 'New Provider',
            baseUrl: 'https://api.newprovider.com',
            defaultModel: 'default-model',
            ...config
        });

        // Update capabilities
        this.updateCapabilities({
            streaming: true,
            functionCalling: false,
            vision: false,
            reasoning: false,
            maxContextLength: 4096,
            supportedFormats: ['text']
        });
    }

    // Implement abstract methods
    async getModels() { /* ... */ }
    async createChatCompletion(messages, options) { /* ... */ }
    async createStreamingChatCompletion(messages, options, onChunk) { /* ... */ }
    async testConnection() { /* ... */ }
    getHeaders() { /* ... */ }
}
```

2. **Register Provider** in `AgnosticMCPManager`:
```javascript
this.registry.registerProvider(
    'newprovider',
    NewProviderClient,
    defaultConfig,
    metadata
);
```

3. **Add Schema** to `LLMConfigSchema`:
```javascript
newprovider: {
    name: 'New Provider',
    description: 'Configuration for New Provider',
    fields: {
        // Provider-specific fields
    }
}
```

## ⚡ Key Benefits

### 1. True Provider Agnosticism
- **Unified Interface**: All providers implement the same interface
- **Standardized Operations**: Same methods work across all providers
- **Consistent Behavior**: Error handling, retries, and metrics are standardized

### 2. Dynamic Provider Management
- **Runtime Registration**: Providers can be added/removed at runtime
- **Health Monitoring**: Automatic health checks and failover
- **Load Balancing**: Distribute requests across available providers

### 3. Capability-Based Selection
- **Smart Routing**: Automatically select the best provider for each task
- **Feature Detection**: Route requests based on required capabilities
- **Fallback Support**: Graceful degradation when providers fail

### 4. Comprehensive Configuration
- **Standardized Config**: Common configuration schema across providers
- **Validation**: Built-in configuration validation and type checking
- **UI Generation**: Automatic form generation for configuration

### 5. Advanced Features
- **Metrics & Analytics**: Detailed performance tracking per provider
- **Cost Tracking**: Token usage and cost estimation
- **Conversation Management**: Unified conversation history
- **Error Recovery**: Intelligent retry and failover mechanisms

## 🔄 Request Flow

1. **Request Initiation**: User sends a message through the UI
2. **Provider Selection**: System selects the best provider based on:
   - Required capabilities
   - Provider health status
   - Load balancing preferences
   - User preferences
3. **Request Execution**: Message is processed using the selected provider
4. **Response Handling**: Response is formatted and returned to the user
5. **Metrics Collection**: Request metrics are recorded for analytics
6. **Failover**: If provider fails, request is retried with another provider

## 📊 Provider Capabilities

### Capability System
Each provider declares its capabilities:

```javascript
{
    streaming: boolean,           // Real-time response streaming
    functionCalling: boolean,     // External function/tool calling
    vision: boolean,             // Image processing and understanding
    imageGeneration: boolean,    // Image generation from text
    reasoning: boolean,          // Advanced reasoning capabilities
    maxContextLength: number,    // Maximum context window size
    supportedFormats: array,     // Supported input formats
    customParameters: array      // Provider-specific parameters
}
```

### Capability-Based Routing
Requests can specify required capabilities:

```javascript
await mcpManager.processMessage(chatId, message, {
    requiredCapabilities: ['vision', 'reasoning'],
    preferredProviders: ['openai'],
    excludeProviders: ['lmstudio']
});
```

## 🛠️ Configuration Management

### Hierarchical Configuration
1. **Default Values**: Provider defaults from schema
2. **User Configuration**: User-specified values
3. **Runtime Overrides**: Dynamic configuration changes

### Configuration Storage
- **Local Storage**: Browser-based configuration persistence
- **Export/Import**: Configuration backup and sharing
- **Validation**: Real-time configuration validation

## 📈 Monitoring & Analytics

### Provider Health
- **Connection Status**: Real-time connection monitoring
- **Response Times**: Average and current response times
- **Success Rates**: Request success/failure ratios
- **Error Tracking**: Detailed error logging and analysis

### Usage Metrics
- **Request Counts**: Total and per-provider request counts
- **Token Usage**: Token consumption tracking
- **Cost Analysis**: Detailed cost breakdown per provider
- **Performance Trends**: Historical performance data

## 🔐 Security & Privacy

### API Key Management
- **Secure Storage**: Sensitive data is properly protected
- **Key Validation**: API key format validation
- **Sanitized Exports**: Sensitive data excluded from exports

### Local Provider Support
- **LM Studio**: Full support for local, private deployments
- **No External Dependencies**: Option to run completely offline
- **Privacy Controls**: Data never leaves the local environment

## 🚀 Future Extensibility

### Plugin Architecture
The agnostic architecture supports easy extension:
- **Custom Providers**: Easy addition of new LLM providers
- **Middleware**: Request/response transformation plugins
- **Custom Capabilities**: Define new capability types
- **Provider Adapters**: Adapt existing APIs to the standard interface

### Planned Enhancements
- **Multi-Modal Support**: Enhanced image and audio processing
- **Provider Chaining**: Chain multiple providers for complex tasks
- **Advanced Load Balancing**: Intelligent load distribution algorithms
- **Real-Time Configuration**: Dynamic configuration updates without restart

## 📝 Usage Examples

### Basic Usage
```javascript
// Initialize the agnostic manager
const manager = new AgnosticMCPManager(eventBus);
await manager.initialize();

// Process a message (automatically selects best provider)
const requestId = await manager.processMessage('chat1', 'Hello, world!');

// Configure a provider
await manager.configureProvider('openai', {
    apiKey: 'sk-...',
    defaultModel: 'gpt-4o'
});

// Switch default provider
await manager.switchProvider('deepseek');
```

### Advanced Usage
```javascript
// Process with specific requirements
await manager.processMessage('chat1', 'Analyze this image', {
    requiredCapabilities: ['vision'],
    preferredProviders: ['openai'],
    streaming: true,
    temperature: 0.7
});

// Get system status
const status = manager.getSystemStatus();
console.log('Active providers:', status.providers);
console.log('Queue status:', status.queue);

// Register custom provider
manager.registerProvider('customprovider', CustomProviderClient, config, metadata);
```

This agnostic architecture ensures that the application can seamlessly work with any LLM provider while maintaining consistent behavior, performance, and user experience across all providers. 