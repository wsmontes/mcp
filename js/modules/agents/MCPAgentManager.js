import { LMStudioClient } from './LMStudioClient.js';
import { OpenAIClient } from './OpenAIClient.js';
import { DeepSeekClient } from './DeepSeekClient.js';

/**
 * MCP Agent Manager - Handles Model Context Protocol agents and communication
 * Implements the Strategy pattern for different agent types with LM Studio and OpenAI integration
 */
export class MCPAgentManager {
    constructor(eventBus) {
        this.eventBus = eventBus;
        this.agents = new Map();
        this.activeAgent = null;
        this.requestQueue = [];
        this.isProcessing = false;
        
        // Multiple AI providers
        this.lmStudioClient = null;
        this.openaiClient = null;
        this.deepseekClient = null;
        this.availableModels = [];
        this.streamingEnabled = true;
        this.conversationHistory = new Map(); // Chat ID -> messages array
        
        // Provider status
        this.providerStatus = {
            lmstudio: { connected: false, models: [] },
            openai: { connected: false, models: [] },
            deepseek: { connected: false, models: [] }
        };
    }

    async initialize() {
        this.setupEventListeners();
        await this.initializeProviders();
        await this.loadAgents();
        
        console.log('🤖 MCP Agent Manager initialized');
    }

    /**
     * Initialize all AI providers (LM Studio, OpenAI, and DeepSeek)
     */
    async initializeProviders() {
        await Promise.all([
            this.initializeLMStudio(),
            this.initializeOpenAI(),
            this.initializeDeepSeek()
        ]);
        
        // Combine models from all providers
        this.updateAvailableModels();
    }

    /**
     * Initialize LM Studio client
     */
    async initializeLMStudio() {
        try {
            this.lmStudioClient = new LMStudioClient({
                baseUrl: 'http://localhost:1234',
                defaultModel: 'google/gemma-3-4b'
            });

            // Test connection
            const connectionTest = await this.lmStudioClient.testConnection();
            if (connectionTest.connected) {
                console.log('✅ Connected to LM Studio');
                
                // Load available models
                const lmStudioModels = await this.lmStudioClient.getModels();
                this.providerStatus.lmstudio = {
                    connected: true,
                    models: lmStudioModels
                };
                
                console.log(`📋 Loaded ${lmStudioModels.length} models from LM Studio`);
                
                this.eventBus.emit('agent:lmstudio:connected', {
                    models: lmStudioModels
                });
            } else {
                console.warn('⚠️ LM Studio not available:', connectionTest.error);
                this.providerStatus.lmstudio = { connected: false, models: [] };
                this.eventBus.emit('agent:lmstudio:disconnected', connectionTest);
            }
        } catch (error) {
            console.error('Failed to initialize LM Studio:', error);
            this.providerStatus.lmstudio = { connected: false, models: [] };
            this.eventBus.emit('ui:notification', {
                message: 'LM Studio connection failed. Please ensure LM Studio is running with a loaded model.',
                type: 'warning',
                duration: 3000
            });
        }
    }

    /**
     * Initialize OpenAI client
     */
    async initializeOpenAI() {
        try {
            // Load OpenAI configuration from storage
            const settings = JSON.parse(localStorage.getItem('mcp-tabajara-settings') || '{}');
            const openaiConfig = settings.openai || {};

            this.openaiClient = new OpenAIClient({
                apiKey: openaiConfig.apiKey || '',
                defaultModel: openaiConfig.defaultModel || 'gpt-4o-mini',
                organization: openaiConfig.organization || null
            });

            // Test connection if API key is available
            const connectionTest = await this.openaiClient.testConnection();
            if (connectionTest.connected) {
                console.log('✅ Connected to OpenAI');
                
                // Load available models
                const openaiModels = await this.openaiClient.getModels();
                this.providerStatus.openai = {
                    connected: true,
                    models: openaiModels
                };
                
                console.log(`📋 Loaded ${openaiModels.length} models from OpenAI`);
                
                this.eventBus.emit('agent:openai:connected', {
                    models: openaiModels
                });
            } else {
                console.log('ℹ️ OpenAI not configured or unavailable:', connectionTest.error);
                this.providerStatus.openai = { connected: false, models: [] };
                this.eventBus.emit('agent:openai:disconnected', connectionTest);
            }
        } catch (error) {
            console.error('Failed to initialize OpenAI:', error);
            this.providerStatus.openai = { connected: false, models: [] };
        }
    }

    /**
     * Initialize DeepSeek client
     */
    async initializeDeepSeek() {
        try {
            // Load DeepSeek configuration from storage
            const settings = JSON.parse(localStorage.getItem('mcp-tabajara-settings') || '{}');
            const deepseekConfig = settings.deepseek || {};

            this.deepseekClient = new DeepSeekClient({
                apiKey: deepseekConfig.apiKey || '',
                defaultModel: deepseekConfig.defaultModel || 'deepseek-chat'
            });

            // Test connection if API key is available
            const connectionTest = await this.deepseekClient.testConnection();
            if (connectionTest.connected) {
                console.log('✅ Connected to DeepSeek');
                
                // Load available models
                const deepseekModels = await this.deepseekClient.getModels();
                this.providerStatus.deepseek = {
                    connected: true,
                    models: deepseekModels
                };
                
                console.log(`📋 Loaded ${deepseekModels.length} models from DeepSeek`);
                
                this.eventBus.emit('agent:deepseek:connected', {
                    models: deepseekModels
                });
            } else {
                console.log('ℹ️ DeepSeek not configured or unavailable:', connectionTest.error);
                this.providerStatus.deepseek = { connected: false, models: [] };
                this.eventBus.emit('agent:deepseek:disconnected', connectionTest);
            }
        } catch (error) {
            console.error('Failed to initialize DeepSeek:', error);
            this.providerStatus.deepseek = { connected: false, models: [] };
        }
    }

    /**
     * Update available models from all providers
     */
    updateAvailableModels() {
        this.availableModels = [
            ...this.providerStatus.lmstudio.models.map(model => ({ ...model, provider: 'lmstudio' })),
            ...this.providerStatus.openai.models.map(model => ({ ...model, provider: 'openai' })),
            ...this.providerStatus.deepseek.models.map(model => ({ ...model, provider: 'deepseek' }))
        ];
        
        console.log(`📊 Total available models: ${this.availableModels.length} (LM Studio: ${this.providerStatus.lmstudio.models.length}, OpenAI: ${this.providerStatus.openai.models.length}, DeepSeek: ${this.providerStatus.deepseek.models.length})`);
    }

    /**
     * Set up event listeners
     */
    setupEventListeners() {
        this.eventBus.on('agent:message:process', async (data) => {
            await this.processMessage(data.chatId, data.message);
        });

        this.eventBus.on('agent:select', (agentId) => {
            this.selectAgent(agentId);
        });

        this.eventBus.on('agent:add', async (agentConfig) => {
            await this.addAgent(agentConfig);
        });

        this.eventBus.on('agent:remove', async (agentId) => {
            await this.removeAgent(agentId);
        });

        this.eventBus.on('agent:configure', async (agentId, config) => {
            await this.configureAgent(agentId, config);
        });

        this.eventBus.on('agent:reconnect', async () => {
            await this.initializeProviders();
        });

        this.eventBus.on('agent:reconnect:lmstudio', async () => {
            await this.initializeLMStudio();
            this.updateAvailableModels();
        });

        this.eventBus.on('agent:reconnect:openai', async () => {
            await this.initializeOpenAI();
            this.updateAvailableModels();
        });

        this.eventBus.on('agent:configure:openai', async (config) => {
            await this.configureOpenAI(config);
        });

        this.eventBus.on('agent:reconnect:deepseek', async () => {
            await this.initializeDeepSeek();
            this.updateAvailableModels();
        });

        this.eventBus.on('agent:configure:deepseek', async (config) => {
            await this.configureDeepSeek(config);
        });

        this.eventBus.on('agent:toggle-streaming', (enabled) => {
            this.streamingEnabled = enabled;
        });

        // New agent management events
        this.eventBus.on('agents:request:list', () => {
            this.eventBus.emit('agents:list:response', Array.from(this.agents.values()));
        });

        this.eventBus.on('models:request:list', (callback) => {
            const models = this.availableModels.map(model => ({ id: model.id, ...model }));
            if (callback && typeof callback === 'function') {
                callback(models);
            } else {
                // Include performance metrics with models
                const performanceMetrics = this.lmStudioClient ? this.lmStudioClient.getMetrics() : null;
                this.eventBus.emit('models:list:response', { models, performance: performanceMetrics });
            }
        });

        this.eventBus.on('agent:create', async (agentData) => {
            await this.createCustomAgent(agentData);
        });

        this.eventBus.on('agent:update', async (agentData) => {
            await this.updateAgent(agentData);
        });

        this.eventBus.on('agent:delete', async (agentId) => {
            await this.deleteAgent(agentId);
        });

        this.eventBus.on('agent:request:get', (agentId, callback) => {
            const agent = this.agents.get(agentId);
            if (callback && typeof callback === 'function') {
                callback(agent);
            }
        });

        this.eventBus.on('agent:create:from-template', (templateId) => {
            this.createAgentFromTemplate(templateId);
        });

        this.eventBus.on('agents:import', async (agents) => {
            await this.importAgents(agents);
        });

        this.eventBus.on('agents:export', (callback) => {
            const exportData = Array.from(this.agents.values())
                .filter(agent => agent.type === 'custom'); // Only export custom agents
            if (callback && typeof callback === 'function') {
                callback(exportData);
            }
        });
    }

    /**
     * Load available agents
     */
    async loadAgents() {
        // Get primary models from each provider
        const lmStudioModels = this.providerStatus.lmstudio.models;
        const openaiModels = this.providerStatus.openai.models;
        const deepseekModels = this.providerStatus.deepseek.models;
        
        const primaryLMModel = lmStudioModels.length > 0 ? lmStudioModels[0].id : 'google/gemma-3-4b';
        const primaryOpenAIModel = openaiModels.length > 0 ? openaiModels[0].id : 'gpt-4o-mini';
        const primaryDeepSeekModel = deepseekModels.length > 0 ? deepseekModels[0].id : 'deepseek-chat';

        // Default built-in agents with multi-provider support
        const defaultAgents = [];

        // Add LM Studio agents if available
        if (this.providerStatus.lmstudio.connected) {
            defaultAgents.push(
                {
                    id: 'lm-general',
                    name: 'General Assistant (LM Studio)',
                    type: 'lm-studio',
                    description: 'General purpose AI assistant powered by LM Studio',
                    capabilities: ['chat', 'code', 'analysis', 'creative'],
                    config: {
                        model: primaryLMModel,
                        temperature: 0.7,
                        maxTokens: -1,
                        systemPrompt: 'You are a helpful AI assistant. Provide clear, accurate, and helpful responses.'
                    },
                    status: 'active'
                },
                {
                    id: 'lm-code',
                    name: 'Code Assistant (LM Studio)',
                    type: 'lm-studio',
                    description: 'Specialized coding assistant with expertise in multiple programming languages',
                    capabilities: ['code', 'debug', 'review', 'documentation'],
                    config: {
                        model: primaryLMModel,
                        temperature: 0.3,
                        maxTokens: -1,
                        systemPrompt: 'You are an expert programming assistant. Help with coding tasks, debugging, code review, and technical documentation. Provide clear explanations and well-commented code examples.'
                    },
                    status: 'active'
                },
                {
                    id: 'lm-research',
                    name: 'Research Assistant (LM Studio)',
                    type: 'lm-studio',
                    description: 'Research and analysis specialist',
                    capabilities: ['research', 'analysis', 'summarization', 'fact-checking'],
                    config: {
                        model: primaryLMModel,
                        temperature: 0.4,
                        maxTokens: -1,
                        systemPrompt: 'You are a research assistant specialized in analysis, summarization, and information synthesis. Provide well-structured, evidence-based responses with clear reasoning.'
                    },
                    status: 'active'
                },
                {
                    id: 'lm-creative',
                    name: 'Creative Assistant (LM Studio)',
                    type: 'lm-studio',
                    description: 'Creative writing and content generation specialist',
                    capabilities: ['creative-writing', 'storytelling', 'brainstorming', 'content'],
                    config: {
                        model: primaryLMModel,
                        temperature: 0.8,
                        maxTokens: -1,
                        systemPrompt: 'You are a creative writing assistant. Help with storytelling, creative content generation, brainstorming ideas, and artistic expression. Be imaginative and inspiring.'
                    },
                    status: 'active'
                }
            );
        }

        // Add OpenAI agents if available
        if (this.providerStatus.openai.connected) {
            defaultAgents.push(
                {
                    id: 'openai-general',
                    name: 'General Assistant (OpenAI)',
                    type: 'openai',
                    description: 'General purpose AI assistant powered by OpenAI GPT models',
                    capabilities: ['chat', 'code', 'analysis', 'creative', 'reasoning'],
                    config: {
                        model: primaryOpenAIModel,
                        temperature: 0.7,
                        maxTokens: 4096,
                        systemPrompt: 'You are a helpful AI assistant. Provide clear, accurate, and helpful responses.'
                    },
                    status: 'active'
                },
                {
                    id: 'openai-code',
                    name: 'Code Assistant (OpenAI)',
                    type: 'openai',
                    description: 'Advanced coding assistant with GPT-4 level programming expertise',
                    capabilities: ['code', 'debug', 'review', 'documentation', 'architecture'],
                    config: {
                        model: primaryOpenAIModel,
                        temperature: 0.2,
                        maxTokens: 4096,
                        systemPrompt: 'You are an expert programming assistant with deep knowledge of software development, algorithms, and best practices. Help with coding tasks, debugging, code review, and technical documentation. Provide clear explanations and well-commented code examples.'
                    },
                    status: 'active'
                },
                {
                    id: 'openai-research',
                    name: 'Research Assistant (OpenAI)',
                    type: 'openai',
                    description: 'Advanced research and analysis specialist with GPT reasoning capabilities',
                    capabilities: ['research', 'analysis', 'summarization', 'fact-checking', 'reasoning'],
                    config: {
                        model: primaryOpenAIModel,
                        temperature: 0.3,
                        maxTokens: 4096,
                        systemPrompt: 'You are an advanced research assistant with strong analytical and reasoning capabilities. Provide well-structured, evidence-based responses with clear reasoning, critical analysis, and comprehensive summaries.'
                    },
                    status: 'active'
                },
                {
                    id: 'openai-creative',
                    name: 'Creative Assistant (OpenAI)',
                    type: 'openai',
                    description: 'Creative writing and content generation with advanced language capabilities',
                    capabilities: ['creative-writing', 'storytelling', 'brainstorming', 'content', 'poetry'],
                    config: {
                        model: primaryOpenAIModel,
                        temperature: 0.9,
                        maxTokens: 4096,
                        systemPrompt: 'You are a creative writing assistant with exceptional language skills and imagination. Help with storytelling, creative content generation, brainstorming ideas, poetry, and artistic expression. Be imaginative, inspiring, and linguistically sophisticated.'
                    },
                    status: 'active'
                }
            );
        }

        // Add DeepSeek agents if available
        if (this.providerStatus.deepseek.connected) {
            defaultAgents.push(
                {
                    id: 'deepseek-general',
                    name: 'General Assistant (DeepSeek)',
                    type: 'deepseek',
                    description: 'General purpose AI assistant powered by DeepSeek models',
                    capabilities: ['chat', 'code', 'analysis', 'reasoning', 'creative'],
                    config: {
                        model: primaryDeepSeekModel,
                        temperature: 0.7,
                        maxTokens: 4096,
                        systemPrompt: 'You are a helpful AI assistant with strong reasoning capabilities. Provide clear, accurate, and helpful responses.'
                    },
                    status: 'active'
                },
                {
                    id: 'deepseek-code',
                    name: 'Code Assistant (DeepSeek)',
                    type: 'deepseek',
                    description: 'Advanced coding assistant with deep reasoning capabilities',
                    capabilities: ['code', 'debug', 'review', 'documentation', 'architecture'],
                    config: {
                        model: primaryDeepSeekModel,
                        temperature: 0.2,
                        maxTokens: 4096,
                        systemPrompt: 'You are an expert programming assistant with advanced reasoning and deep technical knowledge. Help with coding tasks, debugging, code review, and technical documentation. Provide clear explanations and well-commented code examples.'
                    },
                    status: 'active'
                },
                {
                    id: 'deepseek-research',
                    name: 'Research Assistant (DeepSeek)',
                    type: 'deepseek',
                    description: 'Advanced research and analysis specialist with deep reasoning',
                    capabilities: ['research', 'analysis', 'summarization', 'fact-checking', 'reasoning'],
                    config: {
                        model: primaryDeepSeekModel,
                        temperature: 0.3,
                        maxTokens: 4096,
                        systemPrompt: 'You are an advanced research assistant with exceptional reasoning and analytical capabilities. Provide well-structured, evidence-based responses with clear reasoning, critical analysis, and comprehensive summaries.'
                    },
                    status: 'active'
                },
                {
                    id: 'deepseek-reasoning',
                    name: 'Reasoning Specialist (DeepSeek)',
                    type: 'deepseek',
                    description: 'Specialized agent for complex reasoning and problem-solving tasks',
                    capabilities: ['reasoning', 'problem-solving', 'analysis', 'logic', 'mathematics'],
                    config: {
                        model: 'deepseek-reasoner',
                        temperature: 0.1,
                        maxTokens: 8192,
                        systemPrompt: 'You are a reasoning specialist with exceptional analytical and problem-solving capabilities. Focus on step-by-step logical analysis, mathematical reasoning, and complex problem decomposition. Show your thinking process clearly.'
                    },
                    status: 'active'
                }
            );
        }

        // Add individual model agents for variety
        this.availableModels.forEach((model, index) => {
            const modelName = model.id.split('/').pop() || model.id;
            const provider = model.provider || 'unknown';
            
            // Skip if this model is already used as a primary model
            if ((provider === 'lmstudio' && model.id === primaryLMModel) || 
                (provider === 'openai' && model.id === primaryOpenAIModel) ||
                (provider === 'deepseek' && model.id === primaryDeepSeekModel)) {
                return;
            }
            
            defaultAgents.push({
                id: `${provider}-model-${index}`,
                name: `${modelName} (${provider.toUpperCase()})`,
                type: provider,
                description: `Direct access to ${model.id} model via ${provider}`,
                capabilities: ['chat', 'general'],
                config: {
                    model: model.id,
                    temperature: 0.7,
                    maxTokens: (provider === 'openai' || provider === 'deepseek') ? 4096 : -1,
                    systemPrompt: 'You are a helpful AI assistant.'
                },
                status: 'active'
            });
        });

        // Load agents into map
        defaultAgents.forEach(agent => {
            this.agents.set(agent.id, agent);
        });

        // Load custom agents from storage
        await this.loadCustomAgentsFromStorage();

        // Select default agent (prefer DeepSeek if available, then OpenAI, otherwise LM Studio)
        this.activeAgent = this.agents.get('deepseek-general') || this.agents.get('openai-general') || this.agents.get('lm-general') || Array.from(this.agents.values())[0];
        
        this.eventBus.emit('agents:loaded', Array.from(this.agents.values()));
    }

    /**
     * Reconnect to LM Studio
     */
    async reconnectLMStudio() {
        console.log('🔄 Attempting to reconnect to LM Studio...');
        await this.initializeLMStudio();
    }

    /**
     * Get LM Studio connection status
     */
    getLMStudioStatus() {
        if (!this.lmStudioClient) {
            return { connected: false, message: 'LM Studio client not initialized' };
        }
        
        return this.lmStudioClient.testConnection();
    }

    /**
     * Clear conversation history for a chat
     */
    clearConversationHistory(chatId) {
        if (this.conversationHistory.has(chatId)) {
            this.conversationHistory.delete(chatId);
        }
    }

    /**
     * Process a message through the active agent
     */
    async processMessage(chatId, message) {
        if (!this.activeAgent) {
            console.error('No active agent selected');
            return;
        }

        const messageId = 'req_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        
        try {
            // Show typing indicator
            this.eventBus.emit('chat:typing:start');
            
            // Queue the request
            const request = {
                id: messageId,
                chatId: chatId,
                message: message,
                agent: this.activeAgent,
                timestamp: new Date().toISOString()
            };
            
            this.requestQueue.push(request);
            
            if (!this.isProcessing) {
                await this.processQueue();
            }
            
        } catch (error) {
            console.error('Failed to process message:', error);
            this.eventBus.emit('ui:error', { message: 'Failed to process message with agent' });
            this.eventBus.emit('chat:typing:stop');
        }
    }

    /**
     * Process the request queue
     */
    async processQueue() {
        if (this.isProcessing || this.requestQueue.length === 0) {
            return;
        }
        
        this.isProcessing = true;
        
        while (this.requestQueue.length > 0) {
            const request = this.requestQueue.shift();
            await this.executeRequest(request);
        }
        
        this.isProcessing = false;
    }

    /**
     * Execute a single request
     */
    async executeRequest(request) {
        try {
            const agentType = request.agent.type;
            let response, wasStreaming;

            // Route to appropriate provider based on agent type
            if (agentType === 'lm-studio') {
                if (!this.lmStudioClient) {
                    throw new Error('LM Studio is not connected. Please ensure LM Studio is running and connected.');
                }
                ({ response, wasStreaming } = await this.processWithLMStudio(request));
            } else if (agentType === 'openai') {
                if (!this.openaiClient) {
                    throw new Error('OpenAI is not configured. Please add your API key in settings.');
                }
                ({ response, wasStreaming } = await this.processWithOpenAI(request));
            } else if (agentType === 'deepseek') {
                if (!this.deepseekClient) {
                    throw new Error('DeepSeek is not configured. Please add your API key in settings.');
                }
                ({ response, wasStreaming } = await this.processWithDeepSeek(request));
            } else {
                throw new Error(`Unknown agent type: ${agentType}`);
            }
            
            // Only emit regular message event if NOT streaming (to avoid duplicates)
            // Streaming messages are handled by the chat:message:streaming event
            if (!wasStreaming) {
                this.eventBus.emit('chat:message:received', {
                    id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                    chatId: request.chatId,
                    role: 'assistant',
                    content: response,
                    timestamp: new Date().toISOString(),
                    metadata: {
                        agent: request.agent.id,
                        model: request.agent.config.model,
                        provider: agentType
                    }
                });
            }
            
        } catch (error) {
            console.error('Request execution failed:', error);
            this.eventBus.emit('ui:error', { 
                message: `Agent request failed: ${error.message}` 
            });
        } finally {
            this.eventBus.emit('chat:typing:stop');
        }
    }

    /**
     * Process request using LM Studio
     */
    async processWithLMStudio(request) {
        try {
            // Get or create conversation history for this chat
            if (!this.conversationHistory.has(request.chatId)) {
                this.conversationHistory.set(request.chatId, []);
            }
            
            const history = this.conversationHistory.get(request.chatId);
            
            // Build messages array for API
            const messages = [];
            
            // Add system message if available
            if (request.agent.config.systemPrompt) {
                messages.push(this.lmStudioClient.createSystemMessage(request.agent.config.systemPrompt));
            }
            
            // Add conversation history (last 10 messages to avoid token limits)
            const recentHistory = history.slice(-10);
            messages.push(...recentHistory);
            
            // Add current user message
            const userMessage = this.lmStudioClient.createUserMessage(request.message.content);
            messages.push(userMessage);
            
            // Prepare options
            const options = {
                model: request.agent.config.model,
                temperature: request.agent.config.temperature,
                maxTokens: request.agent.config.maxTokens
            };
            
            let response;
            
            if (this.streamingEnabled) {
                // Use streaming for better UX
                let fullContent = '';
                let currentMessageElement = null;
                
                response = await this.lmStudioClient.createStreamingChatCompletion(
                    messages, 
                    options,
                    (chunk) => {
                        fullContent = chunk.fullContent;
                        
                        // Update UI with streaming content
                        this.eventBus.emit('chat:message:streaming', {
                            chatId: request.chatId,
                            content: fullContent,
                            finished: chunk.finished
                        });
                    }
                );
                
                response.content = fullContent;
            } else {
                // Use non-streaming
                response = await this.lmStudioClient.createChatCompletion(messages, options);
            }
            
            // Update conversation history
            history.push(userMessage);
            history.push(this.lmStudioClient.createAssistantMessage(response.content));
            
            // Keep history manageable (last 20 messages)
            if (history.length > 20) {
                history.splice(0, history.length - 20);
            }
            
            return { 
                response: response.content, 
                wasStreaming: this.streamingEnabled 
            };
            
        } catch (error) {
            console.error('LM Studio processing error:', error);
            
            // Show connection error if LM Studio is unreachable
            if (error.message.includes('fetch') || error.message.includes('network')) {
                this.eventBus.emit('ui:notification', {
                    message: 'Cannot connect to LM Studio. Please ensure it\'s running on localhost:1234',
                    type: 'error',
                    duration: 5000
                });
            }
            
            throw error;
        }
    }

    /**
     * Process request using OpenAI
     */
    async processWithOpenAI(request) {
        try {
            // Get or create conversation history for this chat
            if (!this.conversationHistory.has(request.chatId)) {
                this.conversationHistory.set(request.chatId, []);
            }
            
            const history = this.conversationHistory.get(request.chatId);
            
            // Build messages array for API
            const messages = [];
            
            // Add system message if available
            if (request.agent.config.systemPrompt) {
                messages.push(this.openaiClient.createSystemMessage(request.agent.config.systemPrompt));
            }
            
            // Add conversation history (last 15 messages for OpenAI's larger context)
            const recentHistory = history.slice(-15);
            messages.push(...recentHistory);
            
            // Add current user message
            const userMessage = this.openaiClient.createUserMessage(request.message.content);
            messages.push(userMessage);
            
            // Prepare options
            const options = {
                model: request.agent.config.model,
                temperature: request.agent.config.temperature,
                maxTokens: request.agent.config.maxTokens,
                topP: request.agent.config.topP,
                frequencyPenalty: request.agent.config.frequencyPenalty,
                presencePenalty: request.agent.config.presencePenalty
            };
            
            let response;
            
            if (this.streamingEnabled) {
                // Use streaming for better UX
                let fullContent = '';
                
                response = await this.openaiClient.createStreamingChatCompletion(
                    messages, 
                    options,
                    (chunk) => {
                        fullContent = chunk.fullContent;
                        
                        // Update UI with streaming content
                        this.eventBus.emit('chat:message:streaming', {
                            chatId: request.chatId,
                            content: fullContent,
                            finished: chunk.finished
                        });
                    }
                );
                
                response.content = fullContent;
            } else {
                // Use non-streaming
                response = await this.openaiClient.createChatCompletion(messages, options);
            }
            
            // Update conversation history
            history.push(userMessage);
            history.push(this.openaiClient.createAssistantMessage(response.content));
            
            // Keep history manageable (last 30 messages for OpenAI's larger context)
            if (history.length > 30) {
                history.splice(0, history.length - 30);
            }
            
            // Log usage and cost information
            if (response.usage) {
                const cost = this.openaiClient.calculateCost(response.usage, options.model);
                console.log(`💰 OpenAI Usage - Tokens: ${response.usage.total_tokens}, Cost: $${cost.toFixed(4)}`);
            }
            
            return { 
                response: response.content, 
                wasStreaming: this.streamingEnabled,
                usage: response.usage 
            };
            
        } catch (error) {
            console.error('OpenAI processing error:', error);
            
            // Show specific error messages for common OpenAI issues
            if (error.message.includes('API key')) {
                this.eventBus.emit('ui:notification', {
                    message: 'OpenAI API key is invalid or missing. Please check your settings.',
                    type: 'error',
                    duration: 5000
                });
            } else if (error.message.includes('quota')) {
                this.eventBus.emit('ui:notification', {
                    message: 'OpenAI API quota exceeded. Please check your billing.',
                    type: 'error',
                    duration: 5000
                });
            } else if (error.message.includes('rate limit')) {
                this.eventBus.emit('ui:notification', {
                    message: 'OpenAI API rate limit exceeded. Please wait a moment.',
                    type: 'warning',
                    duration: 3000
                });
            }
            
            throw error;
        }
    }

    /**
     * Process request using DeepSeek
     */
    async processWithDeepSeek(request) {
        try {
            // Get or create conversation history for this chat
            if (!this.conversationHistory.has(request.chatId)) {
                this.conversationHistory.set(request.chatId, []);
            }
            
            const history = this.conversationHistory.get(request.chatId);
            
            // Build messages array for API
            const messages = [];
            
            // Add system message if available
            if (request.agent.config.systemPrompt) {
                messages.push(this.deepseekClient.createSystemMessage(request.agent.config.systemPrompt));
            }
            
            // Add conversation history (last 15 messages for DeepSeek context)
            const recentHistory = history.slice(-15);
            messages.push(...recentHistory);
            
            // Add current user message
            const userMessage = this.deepseekClient.createUserMessage(request.message.content);
            messages.push(userMessage);
            
            // Prepare options
            const options = {
                model: request.agent.config.model,
                temperature: request.agent.config.temperature,
                maxTokens: request.agent.config.maxTokens,
                topP: request.agent.config.topP,
                frequencyPenalty: request.agent.config.frequencyPenalty,
                presencePenalty: request.agent.config.presencePenalty
            };
            
            let response;
            
            if (this.streamingEnabled) {
                // Use streaming for better UX
                let fullContent = '';
                
                response = await this.deepseekClient.createStreamingChatCompletion(
                    messages, 
                    options,
                    (chunk) => {
                        fullContent = chunk.fullContent;
                        
                        // Update UI with streaming content
                        this.eventBus.emit('chat:message:streaming', {
                            chatId: request.chatId,
                            content: fullContent,
                            finished: chunk.finished
                        });
                    }
                );
                
                response.content = fullContent;
            } else {
                // Use non-streaming
                response = await this.deepseekClient.createChatCompletion(messages, options);
            }
            
            // Update conversation history
            history.push(userMessage);
            history.push(this.deepseekClient.createAssistantMessage(response.content));
            
            // Keep history manageable (last 30 messages for DeepSeek's context)
            if (history.length > 30) {
                history.splice(0, history.length - 30);
            }
            
            // Log usage and cost information
            if (response.usage) {
                const cost = this.deepseekClient.calculateCost(response.usage, options.model);
                console.log(`💰 DeepSeek Usage - Tokens: ${response.usage.total_tokens}, Cost: $${cost.toFixed(4)}`);
            }
            
            return { 
                response: response.content, 
                wasStreaming: this.streamingEnabled,
                usage: response.usage 
            };
            
        } catch (error) {
            console.error('DeepSeek processing error:', error);
            
            // Show specific error messages for common DeepSeek issues
            if (error.message.includes('API key')) {
                this.eventBus.emit('ui:notification', {
                    message: 'DeepSeek API key is invalid or missing. Please check your settings.',
                    type: 'error',
                    duration: 5000
                });
            } else if (error.message.includes('quota')) {
                this.eventBus.emit('ui:notification', {
                    message: 'DeepSeek API quota exceeded. Please check your billing.',
                    type: 'error',
                    duration: 5000
                });
            } else if (error.message.includes('rate limit')) {
                this.eventBus.emit('ui:notification', {
                    message: 'DeepSeek API rate limit exceeded. Please wait a moment.',
                    type: 'warning',
                    duration: 3000
                });
            }
            
            throw error;
        }
    }

    /**
     * Select an agent as active
     */
    selectAgent(agentId) {
        const agent = this.agents.get(agentId);
        if (agent) {
            this.activeAgent = agent;
            this.eventBus.emit('agent:selected', agent);
            this.eventBus.emit('agent:status:changed', {
                name: agent.name,
                status: 'active'
            });
        }
    }

    /**
     * Add a new agent
     */
    async addAgent(agentConfig) {
        try {
            const agent = {
                id: agentConfig.id || 'agent_' + Date.now(),
                name: agentConfig.name,
                type: agentConfig.type || 'custom',
                description: agentConfig.description || '',
                capabilities: agentConfig.capabilities || [],
                config: agentConfig.config || {},
                status: 'active',
                createdAt: new Date().toISOString()
            };
            
            this.agents.set(agent.id, agent);
            this.eventBus.emit('agent:added', agent);
            this.eventBus.emit('agents:updated', Array.from(this.agents.values()));
        } catch (error) {
            console.error('Failed to add agent:', error);
            this.eventBus.emit('ui:error', { message: 'Failed to add agent' });
        }
    }

    /**
     * Remove an agent
     */
    async removeAgent(agentId) {
        try {
            if (this.activeAgent && this.activeAgent.id === agentId) {
                // Select another agent
                const availableAgents = Array.from(this.agents.values()).filter(a => a.id !== agentId);
                if (availableAgents.length > 0) {
                    this.selectAgent(availableAgents[0].id);
                }
            }
            
            this.agents.delete(agentId);
            this.eventBus.emit('agent:removed', agentId);
            this.eventBus.emit('agents:updated', Array.from(this.agents.values()));
        } catch (error) {
            console.error('Failed to remove agent:', error);
            this.eventBus.emit('ui:error', { message: 'Failed to remove agent' });
        }
    }

    /**
     * Configure an agent
     */
    async configureAgent(agentId, newConfig) {
        try {
            const agent = this.agents.get(agentId);
            if (agent) {
                agent.config = { ...agent.config, ...newConfig };
                this.agents.set(agentId, agent);
                this.eventBus.emit('agent:configured', agent);
            }
        } catch (error) {
            console.error('Failed to configure agent:', error);
            this.eventBus.emit('ui:error', { message: 'Failed to configure agent' });
        }
    }

    /**
     * Get all available agents
     */
    getAgents() {
        return Array.from(this.agents.values());
    }

    /**
     * Get active agent
     */
    getActiveAgent() {
        return this.activeAgent;
    }

    /**
     * Get available models
     */
    getAvailableModels() {
        return this.availableModels;
    }

    /**
     * Update LM Studio configuration
     */
    updateLMStudioConfig(config) {
        if (this.lmStudioClient) {
            this.lmStudioClient.updateConfig(config);
        }
    }

    /**
     * Configure OpenAI settings
     */
    async configureOpenAI(config) {
        try {
            // Update OpenAI client configuration
            if (this.openaiClient) {
                this.openaiClient.updateConfig(config);
            } else {
                this.openaiClient = new OpenAIClient(config);
            }

            // Save configuration to storage
            const settings = JSON.parse(localStorage.getItem('mcp-tabajara-settings') || '{}');
            settings.openai = {
                apiKey: config.apiKey || '',
                defaultModel: config.defaultModel || 'gpt-4o-mini',
                organization: config.organization || null
            };
            localStorage.setItem('mcp-tabajara-settings', JSON.stringify(settings));

            // Test connection and reload models
            await this.initializeOpenAI();
            this.updateAvailableModels();
            await this.loadAgents();

            this.eventBus.emit('ui:notification', {
                message: 'OpenAI configuration updated successfully',
                type: 'success',
                duration: 3000
            });

        } catch (error) {
            console.error('Failed to configure OpenAI:', error);
            this.eventBus.emit('ui:notification', {
                message: `Failed to configure OpenAI: ${error.message}`,
                type: 'error',
                duration: 5000
            });
        }
    }

    /**
     * Configure DeepSeek settings
     */
    async configureDeepSeek(config) {
        try {
            // Update DeepSeek client configuration
            if (this.deepseekClient) {
                this.deepseekClient.updateConfig(config);
            } else {
                this.deepseekClient = new DeepSeekClient(config);
            }

            // Save configuration to storage
            const settings = JSON.parse(localStorage.getItem('mcp-tabajara-settings') || '{}');
            settings.deepseek = {
                apiKey: config.apiKey || '',
                defaultModel: config.defaultModel || 'deepseek-chat'
            };
            localStorage.setItem('mcp-tabajara-settings', JSON.stringify(settings));

            // Test connection and reload models
            await this.initializeDeepSeek();
            this.updateAvailableModels();
            await this.loadAgents();

            this.eventBus.emit('ui:notification', {
                message: 'DeepSeek configuration updated successfully',
                type: 'success',
                duration: 3000
            });

        } catch (error) {
            console.error('Failed to configure DeepSeek:', error);
            this.eventBus.emit('ui:notification', {
                message: `Failed to configure DeepSeek: ${error.message}`,
                type: 'error',
                duration: 5000
            });
        }
    }

    /**
     * Get provider status
     */
    getProviderStatus() {
        return {
            lmstudio: {
                ...this.providerStatus.lmstudio,
                client: this.lmStudioClient ? this.lmStudioClient.getConfig() : null
            },
            openai: {
                ...this.providerStatus.openai,
                client: this.openaiClient ? this.openaiClient.getConfig() : null
            },
            deepseek: {
                ...this.providerStatus.deepseek,
                client: this.deepseekClient ? this.deepseekClient.getConfig() : null
            }
        };
    }

    /**
     * Create custom agent
     */
    async createCustomAgent(agentData) {
        const agentId = `custom-${Date.now()}`;
        const agent = {
            id: agentId,
            name: agentData.name,
            type: 'custom',
            description: agentData.description || '',
            capabilities: ['chat', 'custom'],
            config: {
                model: agentData.config.model,
                temperature: agentData.config.temperature,
                maxTokens: agentData.config.maxTokens,
                systemPrompt: agentData.config.systemPrompt
            },
            icon: agentData.icon || 'fas fa-robot',
            status: 'active',
            createdAt: new Date().toISOString()
        };

        this.agents.set(agentId, agent);
        
        // Save to storage
        await this.saveAgentsToStorage();
        
        this.eventBus.emit('agents:updated', Array.from(this.agents.values()));
        
        return agent;
    }

    /**
     * Update existing agent
     */
    async updateAgent(agentData) {
        const agent = this.agents.get(agentData.id);
        if (!agent) {
            throw new Error('Agent not found');
        }

        // Update agent properties
        Object.assign(agent, {
            name: agentData.name,
            description: agentData.description,
            config: {
                ...agent.config,
                ...agentData.config
            },
            icon: agentData.icon,
            updatedAt: new Date().toISOString()
        });

        // Save to storage
        await this.saveAgentsToStorage();
        
        this.eventBus.emit('agents:updated', Array.from(this.agents.values()));
        
        return agent;
    }

    /**
     * Delete agent
     */
    async deleteAgent(agentId) {
        const agent = this.agents.get(agentId);
        if (!agent) {
            throw new Error('Agent not found');
        }

        // Don't allow deletion of built-in agents
        if (agent.type !== 'custom') {
            throw new Error('Cannot delete built-in agents');
        }

        this.agents.delete(agentId);
        
        // If this was the active agent, select a different one
        if (this.activeAgent && this.activeAgent.id === agentId) {
            const remainingAgents = Array.from(this.agents.values());
            this.activeAgent = remainingAgents.length > 0 ? remainingAgents[0] : null;
        }

        // Save to storage
        await this.saveAgentsToStorage();
        
        this.eventBus.emit('agents:updated', Array.from(this.agents.values()));
    }

    /**
     * Create agent from template
     */
    createAgentFromTemplate(templateId) {
        const templates = {
            'general': {
                name: 'General Assistant',
                description: 'Helpful AI assistant for general tasks',
                icon: 'fas fa-user-tie',
                systemPrompt: 'You are a helpful AI assistant. Provide clear, accurate, and helpful responses.',
                temperature: 0.7,
                maxTokens: -1
            },
            'coder': {
                name: 'Code Expert',
                description: 'Programming and software development specialist',
                icon: 'fas fa-code',
                systemPrompt: 'You are an expert programming assistant. Help with coding tasks, debugging, code review, and technical documentation. Provide clear explanations and well-commented code examples.',
                temperature: 0.3,
                maxTokens: -1
            },
            'researcher': {
                name: 'Research Analyst',
                description: 'Research and analysis specialist',
                icon: 'fas fa-search',
                systemPrompt: 'You are a research assistant specialized in analysis, summarization, and information synthesis. Provide well-structured, evidence-based responses with clear reasoning.',
                temperature: 0.4,
                maxTokens: -1
            },
            'creative': {
                name: 'Creative Writer',
                description: 'Creative writing and content generation',
                icon: 'fas fa-feather-alt',
                systemPrompt: 'You are a creative writing assistant. Help with storytelling, creative content generation, brainstorming ideas, and artistic expression. Be imaginative and inspiring.',
                temperature: 0.8,
                maxTokens: -1
            },
            'teacher': {
                name: 'Educator',
                description: 'Educational content and tutoring specialist',
                icon: 'fas fa-chalkboard-teacher',
                systemPrompt: 'You are an educational assistant. Explain concepts clearly, provide examples, and adapt your teaching style to help users learn effectively.',
                temperature: 0.6,
                maxTokens: -1
            },
            'analyst': {
                name: 'Data Analyst',
                description: 'Data analysis and visualization expert',
                icon: 'fas fa-chart-bar',
                systemPrompt: 'You are a data analysis expert. Help with data interpretation, statistical analysis, and creating insights from data.',
                temperature: 0.3,
                maxTokens: -1
            }
        };

        const template = templates[templateId];
        if (!template) {
            this.eventBus.emit('ui:notification', {
                message: 'Template not found',
                type: 'error'
            });
            return;
        }

        // Pre-fill the agent editor with template data
        const agentData = {
            name: template.name,
            description: template.description,
            icon: template.icon,
            config: {
                model: this.availableModels.length > 0 ? this.availableModels[0].id : 'google/gemma-3-4b',
                temperature: template.temperature,
                maxTokens: template.maxTokens,
                systemPrompt: template.systemPrompt
            }
        };

        // Show the agent editor with pre-filled data
        this.eventBus.emit('ui:show-agent-editor', agentData);
    }

    /**
     * Import agents from file
     */
    async importAgents(importedAgents) {
        let importCount = 0;
        
        for (const agentData of importedAgents) {
            try {
                // Generate new ID to avoid conflicts
                const agentId = `imported-${Date.now()}-${importCount}`;
                const agent = {
                    ...agentData,
                    id: agentId,
                    type: 'custom',
                    status: 'active',
                    importedAt: new Date().toISOString()
                };

                this.agents.set(agentId, agent);
                importCount++;
            } catch (error) {
                console.error('Failed to import agent:', error);
            }
        }

        if (importCount > 0) {
            await this.saveAgentsToStorage();
            this.eventBus.emit('agents:updated', Array.from(this.agents.values()));
        }

        return importCount;
    }

    /**
     * Save agents to local storage
     */
    async saveAgentsToStorage() {
        try {
            const customAgents = Array.from(this.agents.values())
                .filter(agent => agent.type === 'custom');
            
            localStorage.setItem('mcp-custom-agents', JSON.stringify(customAgents));
        } catch (error) {
            console.error('Failed to save agents to storage:', error);
        }
    }

    /**
     * Load custom agents from storage
     */
    async loadCustomAgentsFromStorage() {
        try {
            const stored = localStorage.getItem('mcp-custom-agents');
            if (stored) {
                const customAgents = JSON.parse(stored);
                customAgents.forEach(agent => {
                    this.agents.set(agent.id, agent);
                });
                console.log(`Loaded ${customAgents.length} custom agents from storage`);
            }
        } catch (error) {
            console.error('Failed to load custom agents from storage:', error);
        }
    }

    /**
     * Cleanup resources
     */
    cleanup() {
        // Clear conversation histories
        this.conversationHistory.clear();
        
        // Clear request queue
        this.requestQueue.length = 0;
        this.isProcessing = false;
        
        // Reset LM Studio client
        this.lmStudioClient = null;
        this.availableModels = [];
    }
} 