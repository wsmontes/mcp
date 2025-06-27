import { LLMProviderRegistry } from './LLMProviderRegistry.js';
import { OpenAIClient } from './OpenAIClient.js';
import { DeepSeekClient } from './DeepSeekClient.js';
import { LMStudioClient } from './LMStudioClient.js';
import { AnthropicClient } from './AnthropicClient.js';
import { GeminiClient } from './GeminiClient.js';

/**
 * Agnostic MCP Agent Manager - Provider-agnostic LLM management
 * Uses the registry pattern and standardized interfaces for true agnosticism
 */
export class AgnosticMCPManager {
    constructor(eventBus) {
        this.eventBus = eventBus;
        this.registry = new LLMProviderRegistry(eventBus);
        
        // Request management
        this.requestQueue = [];
        this.isProcessing = false;
        this.activeRequests = new Map();
        this.requestHistory = [];
        
        // Conversation management
        this.conversationHistory = new Map(); // Chat ID -> messages array
        this.conversationMetadata = new Map(); // Chat ID -> metadata
        
        // Configuration
        this.config = {
            maxConcurrentRequests: 3,
            requestTimeout: 60000,
            retryAttempts: 3,
            streamingEnabled: true,
            fallbackEnabled: false,
            loadBalancing: true,
            healthCheckInterval: 0
        };

        // Provider health monitoring
        this.healthCheckTimer = null;
        this.providerHealth = new Map();
        
        // Model selection state
        this.selectedModel = null;
        this.availableModels = [];
        
        console.log('🤖 Agnostic MCP Manager initialized');
        
        // Debug: Log all available methods
        console.log('Available methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(this)).filter(name => name !== 'constructor'));
    }

    /**
     * Initialize the manager and register all providers
     */
    async initialize() {
        try {
            console.log('🔄 Starting AgnosticMCPManager initialization...');
            
            console.log('1️⃣ Setting up event listeners...');
            this.setupEventListeners();
            console.log('✅ Event listeners setup complete');
            
            console.log('2️⃣ Registering default providers...');
            await this.registerDefaultProviders();
            console.log('✅ Default providers registered');
            
            console.log('3️⃣ Loading provider configurations...');
            await this.loadProviderConfigurations();
            console.log('✅ Provider configurations loaded');
            
            console.log('4️⃣ Initializing active providers...');
            const results = await this.initializeActiveProviders();
            console.log('Provider initialization results:', results);
            console.log('✅ Active providers initialized');
            
            console.log('5️⃣ Starting health monitoring...');
            this.startHealthMonitoring();
            console.log('✅ Health monitoring started');
            
            console.log('6️⃣ Loading agents for UI compatibility...');
            await this.loadAgents();
            console.log('✅ Agents loaded');
            
            console.log('7️⃣ Loading available models...');
            await this.loadAvailableModels();
            console.log('✅ Available models loaded');
            
            // If models need refresh after configuration changes, do it now
            if (this.modelsNeedRefresh) {
                console.log('🔄 Refreshing models after configuration changes...');
                await this.refreshAvailableModels();
                this.modelsNeedRefresh = false;
                console.log('✅ Models refreshed after configuration changes');
            }
            
            console.log('✅ Agnostic MCP Manager fully initialized');
            
            // Debug: Check if API keys are configured
            const settings = JSON.parse(localStorage.getItem('mcp-tabajara-settings') || '{}');
            console.log('🔑 API Key Status:', {
                openai: settings.openai?.apiKey ? '✅ Configured' : '❌ Missing',
                anthropic: settings.anthropic?.apiKey ? '✅ Configured' : '❌ Missing',
                deepseek: settings.deepseek?.apiKey ? '✅ Configured' : '❌ Missing',
                gemini: settings.gemini?.apiKey ? '✅ Configured' : '❌ Missing'
            });
        } catch (error) {
            console.error('❌ Failed to initialize Agnostic MCP Manager:', error);
            console.error('❌ Error stack:', error.stack);
            throw error;
        }
    }

    /**
     * Register default providers with the registry
     */
    async registerDefaultProviders() {
        // Register OpenAI
        this.registry.registerProvider(
            'openai',
            OpenAIClient,
            {
                baseUrl: 'https://api.openai.com',
                apiVersion: 'v1',
                defaultModel: 'gpt-4o-mini',
                timeout: 60000
            },
            {
                name: 'OpenAI',
                description: 'OpenAI\'s GPT models including GPT-4 and GPT-3.5',
                version: '1.0.0',
                homepage: 'https://openai.com',
                supportLevel: 'official',
                tags: ['gpt', 'openai', 'commercial', 'advanced']
            }
        );

        // Register DeepSeek
        this.registry.registerProvider(
            'deepseek',
            DeepSeekClient,
            {
                baseUrl: 'https://api.deepseek.com',
                defaultModel: 'deepseek-chat',
                timeout: 60000
            },
            {
                name: 'DeepSeek',
                description: 'DeepSeek\'s reasoning-focused AI models',
                version: '1.0.0',
                homepage: 'https://deepseek.com',
                supportLevel: 'official',
                tags: ['deepseek', 'reasoning', 'commercial']
            }
        );

        // Register LM Studio
        this.registry.registerProvider(
            'lmstudio',
            LMStudioClient,
            {
                baseUrl: 'http://localhost:1234',
                apiVersion: 'v1',
                defaultModel: 'google/gemma-3-4b',
                timeout: 30000
            },
            {
                name: 'LM Studio',
                description: 'Local model hosting via LM Studio',
                version: '1.0.0',
                homepage: 'https://lmstudio.ai',
                supportLevel: 'community',
                tags: ['local', 'self-hosted', 'privacy', 'open-source']
            }
        );

        // Register Anthropic Claude
        this.registry.registerProvider(
            'anthropic',
            AnthropicClient,
            {
                baseUrl: 'http://localhost:3001/api/anthropic',
                apiVersion: 'v1',
                defaultModel: 'claude-3-5-sonnet-20241022',
                timeout: 60000
            },
            {
                name: 'Anthropic Claude',
                description: 'Anthropic\'s Claude models with advanced reasoning capabilities',
                version: '1.0.0',
                homepage: 'https://anthropic.com',
                supportLevel: 'official',
                tags: ['claude', 'anthropic', 'reasoning', 'commercial', 'advanced']
            }
        );

        // Register Google Gemini
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
    }

    /**
     * Load provider configurations from storage
     */
    async loadProviderConfigurations() {
        try {
            const settings = JSON.parse(localStorage.getItem('mcp-tabajara-settings') || '{}');
            console.log('📋 Loaded settings from storage:', settings);
            
            // Configure each provider based on stored settings, or use defaults
            const openaiConfig = settings.openai || {};
            console.log('🔧 Configuring OpenAI with:', openaiConfig);
            this.registry.configureProvider('openai', openaiConfig);
            
            const deepseekConfig = settings.deepseek || {};
            console.log('🔧 Configuring DeepSeek with:', deepseekConfig);
            this.registry.configureProvider('deepseek', deepseekConfig);
            
            const lmstudioConfig = settings.lmstudio || {};
            console.log('🔧 Configuring LMStudio with:', lmstudioConfig);
            this.registry.configureProvider('lmstudio', lmstudioConfig);

            const anthropicConfig = settings.anthropic || {};
            console.log('🔧 Configuring Anthropic with:', anthropicConfig);
            this.registry.configureProvider('anthropic', anthropicConfig);

            const geminiConfig = settings.gemini || {};
            console.log('🔧 Configuring Gemini with:', geminiConfig);
            this.registry.configureProvider('gemini', geminiConfig);

            // Note: We don't import providerRegistry config here because it contains sanitized API keys
            // The individual provider configurations above already contain the real API keys
            
        } catch (error) {
            console.warn('Failed to load provider configurations:', error);
        }
    }

    /**
     * Initialize all configured providers
     */
    async initializeActiveProviders() {
        const results = await this.registry.initializeAllProviders();
        
        // Set a default provider if none is set
        if (!this.registry.getDefaultProvider() && results.success.length > 0) {
            // Prefer OpenAI, then Anthropic, then DeepSeek, then Gemini, then LMStudio
            const preferredOrder = ['openai', 'anthropic', 'deepseek', 'gemini', 'lmstudio'];
            const defaultProvider = preferredOrder.find(id => results.success.includes(id)) || results.success[0];
            
            try {
                this.registry.setDefaultProvider(defaultProvider);
            } catch (error) {
                console.warn('Failed to set default provider:', error);
            }
        }

        return results;
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        this.eventBus.on('agent:message:process', async (data) => {
            // Handle the event structure from ChatManager
            const chatId = data.message.chatId;
            const message = data.message;
            const options = {
                ...data.options,
                attachments: data.attachments, // Pass attachments from ChatManager
                providerId: data.providerId // Pass provider ID
            };
            
            await this.processMessage(chatId, message, options);
        });

        this.eventBus.on('agent:provider:configure', async (data) => {
            await this.configureProvider(data.providerId, data.config);
        });

        this.eventBus.on('agent:provider:switch', async (data) => {
            await this.switchProvider(data.providerId);
        });

        this.eventBus.on('agent:conversation:clear', (data) => {
            this.clearConversationHistory(data.chatId);
        });

        this.eventBus.on('agent:refresh:models', async () => {
            await this.triggerModelRefresh();
        });

        this.eventBus.on('model:select', (modelData) => {
            this.selectModel(modelData);
        });

        this.eventBus.on('models:request:all', async () => {
            await this.loadAvailableModels();
            this.eventBus.emit('models:loaded', this.availableModels);
        });

        this.eventBus.on('models:refresh', async () => {
            await this.refreshAvailableModels();
        });

        // Legacy compatibility listeners for UI events
        this.eventBus.on('agent:configure:openai', async (config) => {
            console.log('🔧 Legacy OpenAI configuration event received:', config);
            await this.configureProvider('openai', config);
        });

        this.eventBus.on('agent:configure:deepseek', async (config) => {
            console.log('🔧 Legacy DeepSeek configuration event received:', config);
            await this.configureProvider('deepseek', config);
        });

        this.eventBus.on('agent:configure:lmstudio', async (config) => {
            console.log('🔧 Legacy LMStudio configuration event received:', config);
            await this.configureProvider('lmstudio', config);
        });

        this.eventBus.on('agent:configure:anthropic', async (config) => {
            console.log('🔧 Legacy Anthropic configuration event received:', config);
            await this.configureProvider('anthropic', config);
        });

        this.eventBus.on('agent:configure:gemini', async (config) => {
            console.log('🔧 Legacy Gemini configuration event received:', config);
            await this.configureProvider('gemini', config);
        });

        // Debug listeners
        this.eventBus.on('agent:request:completed', (data) => {
            console.log('✅ Request completed:', {
                providerId: data.providerId,
                duration: data.duration,
                tokenUsage: data.tokenUsage
            });
        });

        this.eventBus.on('agent:request:failed', (data) => {
            console.log('❌ Request failed:', data.error);
        });
    }

    /**
     * Process a message with the selected provider
     */
    async processMessage(chatId, message, options = {}) {
        const request = {
            id: this.generateRequestId(),
            chatId: chatId,
            message: message,
            options: options,
            timestamp: Date.now(),
            status: 'pending'
        };

        // Handle file attachments if present
        if (options.attachments && options.attachments.length > 0) {
            console.log('📎 Processing attachments for message:', {
                messageId: message.id,
                attachmentCount: options.attachments.length,
                providerId: options.providerId
            });
            
            // Attachments are already processed by ChatManager, just pass them through
            request.attachments = options.attachments;
            request.options.attachments = options.attachments;
        }

        this.requestQueue.push(request);
        this.eventBus.emit('request:queued', request);
        
        if (!this.isProcessing) {
            this.processQueue();
        }
        
        return request;
    }

    /**
     * Process the request queue
     */
    async processQueue() {
        if (this.isProcessing || this.requestQueue.length === 0) {
            return;
        }

        this.isProcessing = true;

        while (this.requestQueue.length > 0 && this.activeRequests.size < this.config.maxConcurrentRequests) {
            const request = this.requestQueue.shift();
            this.executeRequest(request);
        }

        this.isProcessing = false;
    }

    /**
     * Execute a request with the selected provider
     */
    async executeRequest(request) {
        try {
            console.log('🚀 Executing request:', request.id);
            
            // Select the best provider for this request
            const selectedProviderId = this.selectProviderForRequest(request);
            
            if (!selectedProviderId) {
                throw new Error('No suitable provider available for this request. Please configure API keys for your preferred provider.');
            }
            
            const provider = this.registry.getProviderInstance(selectedProviderId);
            
            if (!provider) {
                throw new Error(`Provider ${selectedProviderId} not found or not initialized.`);
            }
            
            console.log(`🎯 Using provider: ${selectedProviderId} (${provider.providerName})`);
            
            // Prepare messages for the provider
            let messages = this.prepareMessagesForProvider(request.message, provider);
            
            // Format messages with attachments if present
            if (request.attachments && request.attachments.length > 0) {
                console.log('📎 Formatting messages with attachments:', {
                    attachmentCount: request.attachments.length,
                    providerId: selectedProviderId
                });
                
                try {
                    // Use the provider's method to format messages with attachments
                    if (provider.formatMessagesWithAttachments) {
                        messages = provider.formatMessagesWithAttachments(messages, request.attachments);
                        console.log('✅ Messages formatted with attachments:', messages);
                    } else {
                        console.warn(`Provider ${selectedProviderId} does not support formatMessagesWithAttachments method`);
                    }
                } catch (error) {
                    console.error('❌ Failed to format messages with attachments:', error);
                    throw new Error(`Failed to process attachments: ${error.message}`);
                }
            }
            
            // Execute the request with the selected provider
            const result = await this.executeWithProvider(provider, messages, request);
            
            // Update conversation history
            this.updateConversationHistory(request.chatId, messages, result);
            
            // Add to request history
            this.addToRequestHistory(request, result);
            
            // Note: chat:message:received event is emitted in executeWithProvider
            // to avoid duplicate emissions
            
            return result;
            
        } catch (error) {
            console.error('❌ Request execution failed:', error);
            
            // Add to request history with error
            this.addToRequestHistory(request, null, error);
            
            // Emit error event
            this.eventBus.emit('chat:message:error', {
                id: request.id,
                chatId: request.chatId,
                error: error.message,
                timestamp: new Date().toISOString()
            });
            
            throw error;
        }
    }

    /**
     * Execute request with a specific provider
     */
    async executeWithProvider(provider, messages, request) {
        const startTime = Date.now();
        
        try {
            let result;
            
            if (request.options.streaming) {
                let accumulatedContent = '';
                result = await provider.createStreamingChatCompletion(
                    messages,
                    request.options,
                    (chunk) => {
                        // Handle different chunk formats from different providers
                        const content = chunk.fullContent || chunk.content || '';
                        const finished = chunk.finished || chunk.finishReason === 'STOP';
                        
                        if (content) {
                            accumulatedContent = chunk.fullContent || (accumulatedContent + content);
                        }
                        
                        this.eventBus.emit('chat:message:streaming', {
                            requestId: request.id,
                            chatId: request.chatId,
                            content: accumulatedContent,
                            finished: finished
                        });
                    }
                );
            } else {
                result = await provider.createChatCompletion(messages, request.options);
            }

            const duration = Date.now() - startTime;
            
            this.eventBus.emit('agent:request:completed', {
                requestId: request.id,
                chatId: request.chatId,
                result: result.content,
                providerId: provider.providerId,
                duration,
                tokenUsage: result.usage
            });

            // For non-streaming requests, create the assistant message
            if (!request.options.streaming && result.content) {
                this.eventBus.emit('chat:message:received', {
                    id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                    chatId: request.chatId,
                    role: 'assistant',
                    content: result.content,
                    timestamp: new Date().toISOString(),
                    metadata: {
                        providerId: provider.providerId,
                        model: request.options.model || provider.config.defaultModel,
                        requestId: request.id,
                        duration,
                        tokenUsage: result.usage
                    }
                });
            }

            return result;
            
        } catch (error) {
            // Update provider health on error
            this.updateProviderHealth(provider.providerId, false, error.message);
            throw error;
        }
    }

    /**
     * Handle request errors and retry logic
     */
    async handleRequestError(request, error) {
        request.attempts++;
        
        if (request.attempts < this.config.retryAttempts) {
            // Implement exponential backoff
            const delay = Math.pow(2, request.attempts - 1) * 1000;
            
            setTimeout(() => {
                this.requestQueue.unshift(request); // Add back to front of queue
                this.processQueue();
            }, delay);
            
            return true; // Will retry
        }
        
        return false; // No more retries
    }

    /**
     * Select the best provider for a request
     */
    selectProviderForRequest(request) {
        // If a specific model is selected, find the provider that has this model
        if (request.options.model && request.options.providerId) {
            const provider = this.registry.getProviderInstance(request.options.providerId);
            if (provider && provider.isInitialized && this.isProviderConfigured(request.options.providerId, provider)) {
                console.log(`🎯 Using provider ${request.options.providerId} for model ${request.options.model}`);
                return request.options.providerId;
            } else {
                console.warn(`Provider ${request.options.providerId} for model ${request.options.model} is not available or properly configured.`);
                
                // Don't use fallback - return null to indicate failure
                if (!this.config.fallbackEnabled) {
                    console.log('❌ Fallback disabled - not switching to another provider');
                    return null;
                }
                
                // Fallback logic is disabled - this code should not execute
                console.log('⚠️ Fallback logic should be disabled');
                return null;
            }
        }

        const requirements = {
            capabilities: request.options.requiredCapabilities || [],
            preferredProviders: request.options.preferredProviders || [],
            excludeProviders: request.options.excludeProviders || []
        };

        // If a specific provider is requested, check if it's configured
        if (request.options.providerId) {
            const provider = this.registry.getProviderInstance(request.options.providerId);
            if (provider && provider.isInitialized && this.isProviderConfigured(request.options.providerId, provider)) {
                return request.options.providerId;
            } else {
                console.warn(`Requested provider ${request.options.providerId} is not available or properly configured.`);
                return null;
            }
        }

        // Use registry to find the best provider
        const bestProvider = this.registry.getBestProviderForTask(requirements);
        
        // Don't use fallback - return the best provider or null
        if (!bestProvider) {
            console.warn('No suitable provider found for the request.');
            return null;
        }
        
        return bestProvider || this.registry.getDefaultProvider();
    }

    /**
     * Configure a specific provider
     */
    async configureProvider(providerId, config) {
        try {
            this.registry.configureProvider(providerId, config);
            
            // Always recreate the provider instance to apply new configuration
            console.log(`🔄 Recreating provider instance: ${providerId}`);
            await this.registry.createProviderInstance(providerId);
            
            // Save configuration
            await this.saveProviderConfiguration(providerId, config);
            
            // Mark that models need to be refreshed (but don't do it immediately)
            this.modelsNeedRefresh = true;
            
            this.eventBus.emit('agent:provider:configured', {
                providerId,
                success: true
            });
            
        } catch (error) {
            console.error(`Failed to configure provider ${providerId}:`, error);
            
            this.eventBus.emit('agent:provider:configured', {
                providerId,
                success: false,
                error: error.message
            });
        }
    }

    /**
     * Switch to a different default provider
     */
    async switchProvider(providerId) {
        try {
            const provider = this.registry.getProviderInstance(providerId);
            
            if (!provider) {
                // Try to initialize the provider first
                await this.registry.createProviderInstance(providerId);
            }
            
            this.registry.setDefaultProvider(providerId);
            
            this.eventBus.emit('agent:provider:switched', {
                providerId,
                success: true
            });
            
        } catch (error) {
            console.error(`Failed to switch to provider ${providerId}:`, error);
            
            this.eventBus.emit('agent:provider:switched', {
                providerId,
                success: false,
                error: error.message
            });
        }
    }

    /**
     * Get conversation messages for a chat
     */
    getConversationMessages(chatId) {
        return this.conversationHistory.get(chatId) || [];
    }

    /**
     * Update conversation history
     */
    updateConversationHistory(chatId, messages, result) {
        const history = [...messages];
        
        if (result && result.content) {
            // Add the assistant's response
            history.push({
                role: 'assistant',
                content: result.content,
                timestamp: Date.now(),
                usage: result.usage
            });
        }

        this.conversationHistory.set(chatId, history);
        
        // Update metadata
        const metadata = this.conversationMetadata.get(chatId) || {};
        metadata.lastUpdated = Date.now();
        metadata.messageCount = history.length;
        this.conversationMetadata.set(chatId, metadata);
    }

    /**
     * Clear conversation history for a chat
     */
    clearConversationHistory(chatId) {
        this.conversationHistory.delete(chatId);
        this.conversationMetadata.delete(chatId);
        
        this.eventBus.emit('agent:conversation:cleared', { chatId });
    }

    /**
     * Add request to history for analytics
     */
    addToRequestHistory(request, result, error) {
        const historyEntry = {
            requestId: request.id,
            chatId: request.chatId,
            timestamp: request.timestamp,
            message: request.message,
            options: request.options,
            attempts: request.attempts,
            success: !error,
            error: error?.message,
            result: result?.content,
            usage: result?.usage,
            duration: Date.now() - request.timestamp
        };

        this.requestHistory.push(historyEntry);
        
        // Keep only last 1000 requests
        if (this.requestHistory.length > 1000) {
            this.requestHistory = this.requestHistory.slice(-1000);
        }
    }

    /**
     * Start health monitoring for providers
     */
    startHealthMonitoring() {
        // Clear any existing timers
        if (this.healthCheckTimer) {
            clearInterval(this.healthCheckTimer);
            this.healthCheckTimer = null;
        }

        if (this.modelRefreshTimer) {
            clearInterval(this.modelRefreshTimer);
            this.modelRefreshTimer = null;
        }

        // Only start health monitoring if interval is greater than 0
        if (this.config.healthCheckInterval > 0) {
            this.healthCheckTimer = setInterval(async () => {
                await this.performHealthChecks();
            }, this.config.healthCheckInterval);
        } else {
            console.log('🔄 Health monitoring disabled to prevent unnecessary API calls');
        }

        // Disable periodic model refresh to prevent unnecessary API calls
        console.log('🔄 Periodic model refresh disabled to prevent unnecessary API calls');
    }

    /**
     * Perform health checks on all providers
     */
    async performHealthChecks() {
        const instances = this.registry.getAllProviderInstances();
        
        for (const [providerId, instance] of instances) {
            try {
                const result = await instance.testConnection();
                this.updateProviderHealth(providerId, result.connected, result.error);
            } catch (error) {
                this.updateProviderHealth(providerId, false, error.message);
            }
        }
    }

    /**
     * Update provider health status
     */
    updateProviderHealth(providerId, isHealthy, error = null) {
        const currentHealth = this.providerHealth.get(providerId) || {};
        
        const newHealth = {
            ...currentHealth,
            isHealthy,
            lastCheck: Date.now(),
            error,
            consecutiveFailures: isHealthy ? 0 : (currentHealth.consecutiveFailures || 0) + 1
        };

        this.providerHealth.set(providerId, newHealth);
        this.registry.updateProviderStatus(providerId, newHealth);
    }

    /**
     * Save provider configuration to storage
     */
    async saveProviderConfiguration(providerId, config) {
        try {
            const settings = JSON.parse(localStorage.getItem('mcp-tabajara-settings') || '{}');
            settings[providerId] = config;
            
            localStorage.setItem('mcp-tabajara-settings', JSON.stringify(settings));
        } catch (error) {
            console.error('Failed to save provider configuration:', error);
        }
    }

    /**
     * Get comprehensive system status
     */
    getSystemStatus() {
        return {
            registry: this.registry.getStats(),
            providers: this.registry.getRegisteredProviders(),
            health: Object.fromEntries(this.providerHealth),
            queue: {
                pending: this.requestQueue.length,
                active: this.activeRequests.size,
                total: this.requestHistory.length
            },
            conversations: {
                active: this.conversationHistory.size,
                totalMessages: Array.from(this.conversationHistory.values())
                    .reduce((sum, messages) => sum + messages.length, 0)
            },
            config: this.config
        };
    }

    /**
     * Register a new provider at runtime
     */
    registerProvider(providerId, ProviderClass, defaultConfig, metadata) {
        this.registry.registerProvider(providerId, ProviderClass, defaultConfig, metadata);
    }

    // ========== COMPATIBILITY METHODS (for UI compatibility) ==========
    
    /**
     * Get agents (compatibility method)
     * Returns available providers formatted as agents for UI compatibility
     */
    getAgents() {
        const providers = this.registry.getRegisteredProviders();
        const agents = [];
        
        providers.forEach(provider => {
            const config = this.registry.getProviderConfig(provider.id);
            
            // Ensure we always have a valid config structure for the UI
            const safeConfig = config || {
                model: provider.defaultConfig?.model || 'default-model',
                temperature: provider.defaultConfig?.temperature || 0.7,
                maxTokens: provider.defaultConfig?.maxTokens || 4096
            };
            
            agents.push({
                id: provider.id,
                name: provider.name,
                description: provider.description,
                isActive: provider.isInitialized,
                config: safeConfig,
                capabilities: provider.capabilities || {},
                status: provider.status
            });
        });
        
        return agents;
    }

    /**
     * Get active agent (compatibility method)
     * Returns the current default provider as the active agent
     */
    getActiveAgent() {
        const defaultProviderId = this.registry.getDefaultProvider();
        if (!defaultProviderId) return null;
        
        const provider = this.registry.getProviderInstance(defaultProviderId);
        if (!provider) return null;
        
        return {
            id: provider.providerId,
            name: provider.providerName,
            config: provider.getConfig(),
            capabilities: provider.getCapabilities(),
            metrics: provider.getMetrics()
        };
    }

    /**
     * Load agents (compatibility method)
     * This is now handled by initialize() but keeping for compatibility
     */
    async loadAgents() {
        try {
            console.log('📋 Loading agents for UI...');
            
            const agents = this.getAgents();
            const activeAgent = this.getActiveAgent();
            
            console.log('Available agents:', agents);
            console.log('Active agent:', activeAgent);
            
            // Already handled by initialize(), but emit event for UI
            // The UI expects the agents array directly, not wrapped in an object
            this.eventBus.emit('agents:loaded', agents);
            
            console.log('✅ Agents loaded and event emitted');
        } catch (error) {
            console.error('❌ Failed to load agents:', error);
            throw error;
        }
    }

    /**
     * Select agent (compatibility method) 
     * Maps to switching default provider
     */
    async selectAgent(agentId) {
        try {
            // Find the agent
            const agents = this.getAgents();
            const agent = agents.find(a => a.id === agentId);
            
            if (!agent) {
                console.warn('Agent not found:', agentId);
                return false;
            }
            
            // Update selected model to match the agent's model
            if (agent.config && agent.config.model) {
                const agentModel = this.availableModels.find(model => 
                    model.id === agent.config.model || 
                    `${model.providerId}:${model.id}` === agent.config.model
                );
                
                if (agentModel) {
                    this.selectModel(agentModel);
                } else {
                    console.warn(`Model ${agent.config.model} not found in available models`);
                }
            }
            
            this.eventBus.emit('agent:selected', agent);
            return true;
        } catch (error) {
            console.error('Failed to select agent:', error);
            return false;
        }
    }

    /**
     * Get provider status (compatibility method)
     */
    getProviderStatus() {
        return this.registry.getAllProviderStatuses();
    }

    /**
     * Get available models (compatibility method - alias)
     */
    getAvailableModels() {
        return this.getAllAvailableModels();
    }

    /**
     * Get all available models from all providers
     */
    async getAllAvailableModels() {
        const allModels = [];
        const instances = this.registry.getAllProviderInstances();
        
        console.log(`🔍 Processing ${instances.size} provider instances for models...`);
        
        for (const [providerId, instance] of instances) {
            console.log(`🔍 Processing provider: ${providerId}`);
            
            if (instance.isInitialized) {
                console.log(`✅ Provider ${providerId} is initialized`);
                
                try {
                    // Check if provider is properly configured
                    const isConfigured = this.isProviderConfigured(providerId, instance);
                    console.log(`🔧 Provider ${providerId} configured: ${isConfigured}`);
                    
                    if (!isConfigured) {
                        console.warn(`⚠️ Skipping models from ${providerId}: not properly configured`);
                        continue;
                    }
                    
                    console.log(`📡 Fetching models from ${providerId}...`);
                    const models = await instance.getModels();
                    console.log(`📋 Received ${models.length} models from ${providerId}`);
                    
                    models.forEach(model => {
                        allModels.push({
                            ...model,
                            providerId,
                            providerName: instance.providerName,
                            capabilities: instance.getModelCapabilities(model.id)
                        });
                    });
                    
                    console.log(`✅ Successfully processed ${models.length} models from ${providerId}`);
                } catch (error) {
                    console.warn(`❌ Failed to get models from ${providerId}:`, error);
                }
            } else {
                console.warn(`⚠️ Provider ${providerId} is not initialized, skipping`);
            }
        }

        console.log(`📊 Total models collected: ${allModels.length}`);
        return allModels;
    }

    /**
     * Check if a provider is properly configured
     */
    isProviderConfigured(providerId, instance) {
        // LM Studio doesn't need API key (local) - let it try to get models
        if (providerId === 'lmstudio') {
            // Always allow LM Studio to try - it will return a default model if not connected
            return true;
        }
        
        // OpenAI and DeepSeek need API keys
        if (providerId === 'openai' || providerId === 'deepseek') {
            return instance.config && instance.config.apiKey && instance.config.apiKey.length > 0;
        }
        
        // Anthropic needs API key
        if (providerId === 'anthropic') {
            return instance.config && instance.config.apiKey && instance.config.apiKey.length > 0;
        }
        
        // Gemini needs API key
        if (providerId === 'gemini') {
            return instance.config && instance.config.apiKey && instance.config.apiKey.length > 0;
        }
        
        return true; // Default to true for unknown providers
    }

    /**
     * Load and cache all available models from all providers using live API calls
     */
    async loadAvailableModels() {
        try {
            console.log('🔄 Fetching models from all providers via API...');
            this.availableModels = await this.getAllAvailableModels();
            
            // If no model is selected, select the best available one
            if (!this.selectedModel && this.availableModels.length > 0) {
                // Prefer OpenAI models (best first), then Anthropic, then DeepSeek, then Gemini, then LMStudio
                const preferredOrder = ['openai', 'anthropic', 'deepseek', 'gemini', 'lmstudio'];
                let selectedModel = null;
                
                for (const providerId of preferredOrder) {
                    const providerModels = this.availableModels.filter(model => model.providerId === providerId);
                    if (providerModels.length > 0) {
                        // Select best model from this provider
                        if (providerId === 'openai') {
                            const priority = { 'gpt-4o': 1, 'gpt-4o-mini': 2, 'gpt-4-turbo': 3, 'gpt-4': 4 };
                            selectedModel = providerModels.sort((a, b) => (priority[a.id] || 99) - (priority[b.id] || 99))[0];
                        } else if (providerId === 'deepseek') {
                            selectedModel = providerModels.find(m => m.id === 'deepseek-chat') || providerModels[0];
                        } else if (providerId === 'gemini') {
                            const priority = { 'gemini-1.5-flash': 1, 'gemini-1.5-flash-exp': 2, 'gemini-1.5-pro': 3, 'gemini-1.5-pro-exp': 4 };
                            selectedModel = providerModels.sort((a, b) => (priority[a.id] || 99) - (priority[b.id] || 99))[0];
                        } else {
                            selectedModel = providerModels[0];
                        }
                        break;
                    }
                }
                
                selectedModel = selectedModel || this.availableModels[0];
                this.selectModel(selectedModel);
            }
            
            console.log(`📋 Loaded ${this.availableModels.length} models from all providers:`, 
                this.availableModels.map(m => `${m.id} (${m.providerId})`));
            
            // Emit models loaded event for UI
            this.eventBus.emit('models:loaded', this.availableModels);
            
        } catch (error) {
            console.error('Failed to load available models:', error);
            this.eventBus.emit('models:loaded', []);
        }
    }

    /**
     * Refresh models from all providers (can be called periodically)
     */
    async refreshAvailableModels() {
        console.log('🔄 [AgnosticMCPManager] refreshAvailableModels called');
        await this.loadAvailableModels();
        // Ensure models:loaded is emitted after refresh
        this.eventBus.emit('models:loaded', this.availableModels);
    }

    /**
     * Manually trigger model refresh (for UI events)
     */
    async triggerModelRefresh() {
        console.log('🔄 [AgnosticMCPManager] triggerModelRefresh called');
        await this.refreshAvailableModels();
    }

    /**
     * Select a specific model for use
     */
    selectModel(modelData) {
        if (!modelData) {
            console.warn('No model data provided for selection');
            return;
        }
        
        // Find the full model object if only ID was provided
        let selectedModel = modelData;
        if (typeof modelData === 'string') {
            // Handle format "providerId:modelId"
            if (modelData.includes(':')) {
                const [providerId, modelId] = modelData.split(':', 2);
                selectedModel = this.availableModels.find(model => 
                    model.providerId === providerId && model.id === modelId
                );
            } else {
                // Just model ID
                selectedModel = this.availableModels.find(model => 
                    model.id === modelData
                );
            }
        }
        
        if (!selectedModel) {
            console.warn('Model not found:', modelData);
            this.eventBus.emit('ui:notification', {
                message: `Model ${modelData} not found. Please check your model selection.`,
                type: 'error'
            });
            return;
        }
        
        // Validate that the provider is properly configured
        const provider = this.registry.getProviderInstance(selectedModel.providerId);
        if (!provider || !this.isProviderConfigured(selectedModel.providerId, provider)) {
            console.warn(`⚠️ Provider ${selectedModel.providerId} for model ${selectedModel.id} is not properly configured`);
            
            // Don't use fallback - notify user to configure the provider
            this.eventBus.emit('ui:notification', {
                message: `Model ${selectedModel.id} requires API key configuration for ${selectedModel.providerName}. Please configure your API keys in settings.`,
                type: 'error'
            });
            return;
        }
        
        this.selectedModel = selectedModel;
        
        console.log(`🎯 Selected model: ${selectedModel.id} (${selectedModel.providerName})`);
        
        // Emit model selection event for UI updates
        this.eventBus.emit('model:selected', {
            model: selectedModel,
            providerId: selectedModel.providerId,
            providerName: selectedModel.providerName
        });
    }

    /**
     * Find a fallback model from configured providers
     */
    findFallbackModel() {
        for (const model of this.availableModels) {
            const provider = this.registry.getProviderInstance(model.providerId);
            if (provider && this.isProviderConfigured(model.providerId, provider)) {
                return model;
            }
        }
        return null;
    }

    /**
     * Get the currently selected model
     */
    getSelectedModel() {
        return this.selectedModel;
    }

    /**
     * Get models filtered by provider
     */
    getModelsByProvider(providerId) {
        return this.availableModels.filter(model => model.providerId === providerId);
    }

    /**
     * Update LM Studio config (compatibility method)
     */
    updateLMStudioConfig(config) {
        return this.configureProvider('lmstudio', config);
    }

    /**
     * Configure OpenAI (compatibility method)
     */
    async configureOpenAI(config) {
        try {
            await this.configureProvider('openai', config);
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Configure DeepSeek (compatibility method)
     */
    async configureDeepSeek(config) {
        try {
            await this.configureProvider('deepseek', config);
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Configure Anthropic (compatibility method)
     */
    async configureAnthropic(config) {
        try {
            await this.configureProvider('anthropic', config);
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Configure Gemini (compatibility method)
     */
    async configureGemini(config) {
        try {
            await this.configureProvider('gemini', config);
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Reconnect LM Studio (compatibility method)
     */
    async reconnectLMStudio() {
        try {
            await this.registry.createProviderInstance('lmstudio');
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Get LM Studio status (compatibility method)
     */
    getLMStudioStatus() {
        return this.registry.getProviderStatus('lmstudio');
    }

    /**
     * Create custom agent (compatibility method)
     * Maps to registering a custom provider
     */
    async createCustomAgent(agentData) {
        // This would need to be implemented based on the agentData structure
        // For now, return a placeholder response
        return {
            success: false,
            message: 'Custom agent creation not yet implemented in agnostic architecture'
        };
    }

    /**
     * Add agent (compatibility method)
     */
    async addAgent(agentConfig) {
        // This would map to adding a new provider configuration
        return this.createCustomAgent(agentConfig);
    }

    /**
     * Remove agent (compatibility method)
     */
    async removeAgent(agentId) {
        try {
            this.registry.unregisterProvider(agentId);
            return true;
        } catch (error) {
            console.error('Failed to remove agent:', error);
            return false;
        }
    }

    /**
     * Configure agent (compatibility method)
     */
    async configureAgent(agentId, newConfig) {
        return this.configureProvider(agentId, newConfig);
    }

    /**
     * Import agents (compatibility method)
     */
    async importAgents(importedAgents) {
        // This would need to be implemented based on the importedAgents structure
        return {
            success: false,
            message: 'Agent import not yet implemented in agnostic architecture'
        };
    }

    /**
     * Save agents to storage (compatibility method)
     */
    async saveAgentsToStorage() {
        try {
            // Note: We don't save the registry config here because it would contain sanitized API keys
            // Individual provider configurations are already saved separately in saveProviderConfiguration
            console.log('📦 Agents configuration already saved via individual provider saves');
            return true;
        } catch (error) {
            console.error('Failed to save agents to storage:', error);
            return false;
        }
    }

    /**
     * Load custom agents from storage (compatibility method)
     */
    async loadCustomAgentsFromStorage() {
        // Already handled by loadProviderConfigurations()
        return true;
    }

    // ========== END COMPATIBILITY METHODS ==========

    /**
     * Cleanup resources
     */
    cleanup() {
        if (this.healthCheckTimer) {
            clearInterval(this.healthCheckTimer);
        }
        
        if (this.modelRefreshTimer) {
            clearInterval(this.modelRefreshTimer);
        }
        
        this.registry.cleanup();
        this.requestQueue = [];
        this.activeRequests.clear();
        this.conversationHistory.clear();
        this.conversationMetadata.clear();
        this.requestHistory = [];
        this.providerHealth.clear();
        
        console.log('🧹 Agnostic MCP Manager cleanup completed');
    }

    /**
     * Prepare messages for a specific provider
     */
    prepareMessagesForProvider(message, provider) {
        // Get conversation history
        const messages = this.getConversationMessages(message.chatId || 'default');
        
        // Extract content from message object
        const messageContent = typeof message === 'string' ? message : message.content;
        
        // Add the new user message
        messages.push(provider.createUserMessage(messageContent));
        
        return messages;
    }

    // ========== HELPER METHODS ==========

    /**
     * Generate a unique request ID
     */
    generateRequestId() {
        return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Get the currently selected provider ID
     */
    getSelectedProviderId() {
        if (this.selectedModel) {
            return this.selectedModel.providerId;
        }
        
        // Fallback to first available provider
        const providers = this.registry.getActiveProviders();
        if (providers.length > 0) {
            return providers[0].providerId;
        }
        
        return 'openai'; // Default fallback
    }
}