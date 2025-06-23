import { LMStudioClient } from './LMStudioClient.js';

/**
 * MCP Agent Manager - Handles Model Context Protocol agents and communication
 * Implements the Strategy pattern for different agent types and LM Studio integration
 */
export class MCPAgentManager {
    constructor(eventBus) {
        this.eventBus = eventBus;
        this.agents = new Map();
        this.activeAgent = null;
        this.requestQueue = [];
        this.isProcessing = false;
        this.lmStudioClient = null;
        this.availableModels = [];
        this.streamingEnabled = true;
        this.conversationHistory = new Map(); // Chat ID -> messages array
    }

    async initialize() {
        this.setupEventListeners();
        await this.initializeLMStudio();
        await this.loadAgents();
        
        console.log('🤖 MCP Agent Manager initialized');
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
                this.availableModels = await this.lmStudioClient.getModels();
                console.log(`📋 Loaded ${this.availableModels.length} models from LM Studio`);
                
                this.eventBus.emit('agent:lmstudio:connected', {
                    models: this.availableModels
                });
            } else {
                console.warn('⚠️ LM Studio not available:', connectionTest.error);
                this.eventBus.emit('agent:lmstudio:disconnected', connectionTest);
            }
        } catch (error) {
            console.error('Failed to initialize LM Studio:', error);
            this.eventBus.emit('ui:notification', {
                message: 'LM Studio connection failed. Please ensure LM Studio is running with a loaded model.',
                type: 'error',
                duration: 5000
            });
        }
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
            await this.initializeLMStudio();
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
        // Get the primary model from LM Studio
        const primaryModel = this.availableModels.length > 0 
            ? this.availableModels[0].id 
            : 'google/gemma-3-4b';

        // Default built-in agents with LM Studio integration
        const defaultAgents = [
            {
                id: 'lm-general',
                name: 'General Assistant',
                type: 'lm-studio',
                description: 'General purpose AI assistant powered by LM Studio',
                capabilities: ['chat', 'code', 'analysis', 'creative'],
                config: {
                    model: primaryModel,
                    temperature: 0.7,
                    maxTokens: -1,
                    systemPrompt: 'You are a helpful AI assistant. Provide clear, accurate, and helpful responses.'
                },
                status: 'active'
            },
            {
                id: 'lm-code',
                name: 'Code Assistant',
                type: 'lm-studio',
                description: 'Specialized coding assistant with expertise in multiple programming languages',
                capabilities: ['code', 'debug', 'review', 'documentation'],
                config: {
                    model: primaryModel,
                    temperature: 0.3,
                    maxTokens: -1,
                    systemPrompt: 'You are an expert programming assistant. Help with coding tasks, debugging, code review, and technical documentation. Provide clear explanations and well-commented code examples.'
                },
                status: 'active'
            },
            {
                id: 'lm-research',
                name: 'Research Assistant',
                type: 'lm-studio',
                description: 'Research and analysis specialist',
                capabilities: ['research', 'analysis', 'summarization', 'fact-checking'],
                config: {
                    model: primaryModel,
                    temperature: 0.4,
                    maxTokens: -1,
                    systemPrompt: 'You are a research assistant specialized in analysis, summarization, and information synthesis. Provide well-structured, evidence-based responses with clear reasoning.'
                },
                status: 'active'
            },
            {
                id: 'lm-creative',
                name: 'Creative Assistant',
                type: 'lm-studio',
                description: 'Creative writing and content generation specialist',
                capabilities: ['creative-writing', 'storytelling', 'brainstorming', 'content'],
                config: {
                    model: primaryModel,
                    temperature: 0.8,
                    maxTokens: -1,
                    systemPrompt: 'You are a creative writing assistant. Help with storytelling, creative content generation, brainstorming ideas, and artistic expression. Be imaginative and inspiring.'
                },
                status: 'active'
            }
        ];

        // Add agents for each available model
        this.availableModels.forEach((model, index) => {
            if (index > 0) { // Skip first model as it's already used above
                defaultAgents.push({
                    id: `lm-model-${index}`,
                    name: `${model.id.split('/').pop()} Model`,
                    type: 'lm-studio',
                    description: `Direct access to ${model.id} model`,
                    capabilities: ['chat', 'general'],
                    config: {
                        model: model.id,
                        temperature: 0.7,
                        maxTokens: -1,
                        systemPrompt: 'You are a helpful AI assistant.'
                    },
                    status: 'active'
                });
            }
        });

        // Load agents into map
        defaultAgents.forEach(agent => {
            this.agents.set(agent.id, agent);
        });

        // Load custom agents from storage
        await this.loadCustomAgentsFromStorage();

        // Select default agent
        this.activeAgent = this.agents.get('lm-general');
        
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
            if (!this.lmStudioClient) {
                throw new Error('LM Studio is not connected. Please ensure LM Studio is running and connected.');
            }
            
            const { response, wasStreaming } = await this.processWithLMStudio(request);
            
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
                        model: request.agent.config.model
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