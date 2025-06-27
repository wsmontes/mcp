import { BaseLLMClient } from './BaseLLMClient.js';

/**
 * DeepSeek Client - Handles communication with DeepSeek's API
 * Supports deepseek-chat and deepseek-reasoner models with streaming and non-streaming responses
 */
export class DeepSeekClient extends BaseLLMClient {
    constructor(config = {}) {
        super({
            providerId: 'deepseek',
            providerName: 'DeepSeek',
            baseUrl: config.baseUrl || 'https://api.deepseek.com',
            apiVersion: 'v1',
            timeout: config.timeout || 120000,
            defaultModel: config.defaultModel || 'deepseek-chat',
            ...config
        });
        
        this.config = {
            apiKey: config.apiKey || '',
            baseUrl: config.baseUrl || 'https://api.deepseek.com',
            timeout: config.timeout || 60000,
            defaultModel: config.defaultModel || 'deepseek-chat'
        };

        // Model pricing per 1K tokens (estimated based on DeepSeek pricing)
        this.modelPricing = {
            'deepseek-chat': { input: 0.00014, output: 0.00028 }, // Estimated competitive pricing
            'deepseek-reasoner': { input: 0.00055, output: 0.0022 } // Higher pricing for reasoning model
        };

        // Update capabilities for DeepSeek
        this.updateCapabilities({
            streaming: true,
            functionCalling: true,
            vision: false,
            imageGeneration: false,
            reasoning: true, // DeepSeek's strength
            maxContextLength: 64000, // DeepSeek context
            supportedFormats: ['text'],
            customParameters: ['temperature', 'top_p', 'frequency_penalty', 'presence_penalty', 'max_tokens']
        });
    }

    /**
     * Get available models from DeepSeek
     */
    async getModels() {
        if (!this.config.apiKey) {
            console.warn('DeepSeek API key not configured');
            return [];
        }

        try {
            console.log('🔍 Fetching DeepSeek models from API...');
            const response = await fetch(`${this.config.baseUrl}/models`, {
                method: 'GET',
                headers: this.getHeaders(),
                signal: AbortSignal.timeout(this.config.timeout)
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                console.error('❌ DeepSeek model fetch failed:', response.status, errorData);
                return [];
            }

            const data = await response.json();
            console.log('📋 DeepSeek API response:', data);
            
            // Filter and sort DeepSeek models
            const deepseekModels = data.data
                .filter(model => model.id.includes('deepseek'))
                .sort((a, b) => {
                    // Prioritize deepseek-chat, then deepseek-reasoner
                    const priority = { 'deepseek-chat': 1, 'deepseek-reasoner': 2 };
                    return (priority[a.id] || 99) - (priority[b.id] || 99);
                })
                .map(model => ({
                    ...model,
                    provider: 'deepseek',
                    display_name: model.id // DeepSeek models don't have display_name, use id
                }));

            console.log(`✅ Successfully fetched ${deepseekModels.length} DeepSeek models`);
            return deepseekModels;
        } catch (error) {
            console.error('❌ Error fetching DeepSeek models:', error);
            return [];
        }
    }

    /**
     * Create a chat completion (non-streaming)
     */
    async createChatCompletion(messages, options = {}) {
        if (!this.config.apiKey) {
            throw new Error('DeepSeek API key is required. Please configure it in settings.');
        }

        const startTime = Date.now();
        const model = options.model || this.config.defaultModel;
        const isReasoningModel = model === 'deepseek-reasoner';
        
        // Clean messages for reasoning model (remove reasoning_content from previous responses)
        const cleanMessages = isReasoningModel ? this.cleanMessagesForReasoning(messages) : messages;
        
        const requestBody = {
            model: model,
            messages: cleanMessages,
            max_tokens: options.maxTokens > 0 ? options.maxTokens : (isReasoningModel ? 32768 : 4096),
            stream: false,
            ...options.additionalParams
        };

        // Add parameters that are supported for non-reasoning models
        if (!isReasoningModel) {
            requestBody.temperature = options.temperature ?? 1;
            requestBody.top_p = options.topP ?? 1;
            requestBody.frequency_penalty = options.frequencyPenalty ?? 0;
            requestBody.presence_penalty = options.presencePenalty ?? 0;
        }

        try {
            this.metrics.totalRequests++;
            
            const responseTime = Date.now() - startTime;
            this.updateMetrics(responseTime, true, requestBody.usage);
            
            return this.parseCompletion(await this.fetchResponse(requestBody, isReasoningModel));
        } catch (error) {
            // Track failed request
            const responseTime = Date.now() - startTime;
            this.updateMetrics(responseTime, false);
            
            if (error.name === 'AbortError') {
                throw new Error('Request timed out');
            }
            throw error;
        }
    }

    /**
     * Create a streaming chat completion
     */
    async createStreamingChatCompletion(messages, options = {}, onChunk = null) {
        if (!this.config.apiKey) {
            throw new Error('DeepSeek API key is required. Please configure it in settings.');
        }

        const startTime = Date.now();
        const model = options.model || this.config.defaultModel;
        const isReasoningModel = model === 'deepseek-reasoner';
        
        // Clean messages for reasoning model (remove reasoning_content from previous responses)
        const cleanMessages = isReasoningModel ? this.cleanMessagesForReasoning(messages) : messages;
        
        const requestBody = {
            model: model,
            messages: cleanMessages,
            max_tokens: options.maxTokens > 0 ? options.maxTokens : (isReasoningModel ? 32768 : 4096),
            stream: true,
            ...options.additionalParams
        };

        // Add parameters that are supported for non-reasoning models
        if (!isReasoningModel) {
            requestBody.temperature = options.temperature ?? 1;
            requestBody.top_p = options.topP ?? 1;
            requestBody.frequency_penalty = options.frequencyPenalty ?? 0;
            requestBody.presence_penalty = options.presencePenalty ?? 0;
        }

        try {
            this.metrics.totalRequests++;
            
            // Use longer timeout for reasoning model
            const requestTimeout = isReasoningModel ? 180000 : this.config.timeout; // 3 minutes for reasoning
            
            const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify(requestBody),
                signal: AbortSignal.timeout(requestTimeout)
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(`DeepSeek API request failed: ${response.status} - ${errorData.error?.message || response.statusText}`);
            }

            const result = await this.handleStreamingResponse(response, onChunk, requestBody);
            
            // Track successful request
            const responseTime = Date.now() - startTime;
            this.updateMetrics(responseTime, true, result.usage);
            
            return result;
        } catch (error) {
            // Track failed request
            const responseTime = Date.now() - startTime;
            this.updateMetrics(responseTime, false);
            
            if (error.name === 'AbortError') {
                throw new Error('Request timed out');
            }
            throw error;
        }
    }

    /**
     * Clean messages for reasoning model
     * Removes reasoning_content from previous assistant messages to prevent API errors
     */
    cleanMessagesForReasoning(messages) {
        return messages.map(message => {
            // Create a clean copy of the message
            const cleanMessage = {
                role: message.role,
                content: message.content
            };
            
            // Remove reasoning_content if present (to prevent API 400 errors)
            if (message.reasoning_content) {
                console.log('🧠 Removing reasoning_content from message for reasoning model');
            }
            
            return cleanMessage;
        });
    }

    /**
     * Handle streaming response from DeepSeek
     */
    async handleStreamingResponse(response, onChunk, requestBody) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullContent = '';
        let fullReasoningContent = '';
        let buffer = '';
        let usage = null;
        const isReasoningModel = requestBody.model === 'deepseek-reasoner';

        try {
            while (true) {
                const { done, value } = await reader.read();
                
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || ''; // Keep incomplete line in buffer

                for (const line of lines) {
                    if (line.trim() === '') continue;
                    if (line.trim() === 'data: [DONE]') continue;

                    if (line.startsWith('data: ')) {
                        try {
                            const jsonStr = line.slice(6); // Remove 'data: ' prefix
                            const chunk = JSON.parse(jsonStr);
                            
                            if (chunk.choices && chunk.choices[0] && chunk.choices[0].delta) {
                                const delta = chunk.choices[0].delta;
                                
                                // Handle reasoning content for reasoning model
                                if (isReasoningModel && delta.reasoning_content) {
                                    fullReasoningContent += delta.reasoning_content;
                                }
                                
                                // Handle regular content
                                const content = delta.content || '';
                                if (content) {
                                    fullContent += content;
                                }
                                
                                // Emit chunk with both content and reasoning content
                                if (onChunk && (content || delta.reasoning_content)) {
                                    onChunk({
                                        content: content,
                                        reasoningContent: delta.reasoning_content || '',
                                        fullContent: fullContent,
                                        fullReasoningContent: fullReasoningContent,
                                        finished: chunk.choices[0].finish_reason !== null
                                    });
                                }
                                
                                // Check for finish
                                if (chunk.choices[0].finish_reason !== null) {
                                    usage = chunk.usage || this.estimateUsage(requestBody.messages, fullContent, requestBody.model);
                                }
                            }
                        } catch (parseError) {
                            console.warn('Failed to parse DeepSeek streaming chunk:', parseError);
                        }
                    }
                }
            }

            // Emit final completion chunk
            if (onChunk && (fullContent || fullReasoningContent)) {
                onChunk({
                    content: '',
                    reasoningContent: '',
                    fullContent: fullContent,
                    fullReasoningContent: fullReasoningContent,
                    finished: true
                });
            }

            return {
                content: fullContent,
                reasoningContent: fullReasoningContent,
                usage: usage || this.estimateUsage(requestBody.messages, fullContent, requestBody.model),
                model: requestBody.model,
                finished: true
            };
        } finally {
            reader.releaseLock();
        }
    }

    /**
     * Parse completion response
     */
    parseCompletion(data) {
        if (!data.choices || data.choices.length === 0) {
            throw new Error('No choices in response');
        }

        const choice = data.choices[0];
        const isReasoningModel = data.model === 'deepseek-reasoner';
        
        const result = {
            content: choice.message?.content || '',
            usage: data.usage,
            model: data.model,
            finishReason: choice.finish_reason,
            finished: true
        };
        
        // Add reasoning content for reasoning model
        if (isReasoningModel && choice.message?.reasoning_content) {
            result.reasoningContent = choice.message.reasoning_content;
            console.log('🧠 DeepSeek reasoning model response includes Chain of Thought');
        }
        
        return result;
    }

    /**
     * Test connection to DeepSeek
     */
    async testConnection() {
        if (!this.config.apiKey) {
            return {
                connected: false,
                error: 'API key not configured',
                url: this.config.baseUrl
            };
        }

        try {
            const response = await fetch(`${this.config.baseUrl}/models`, {
                method: 'GET',
                headers: this.getHeaders(),
                signal: AbortSignal.timeout(10000)
            });

            return {
                connected: response.ok,
                status: response.status,
                url: this.config.baseUrl,
                hasApiKey: !!this.config.apiKey
            };
        } catch (error) {
            return {
                connected: false,
                error: error.message,
                url: this.config.baseUrl,
                hasApiKey: !!this.config.apiKey
            };
        }
    }

    /**
     * Get request headers
     */
    getHeaders() {
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.config.apiKey}`
        };
    }

    /**
     * Estimate token usage for cost tracking
     */
    estimateUsage(messages, response, model) {
        // Rough estimation: ~4 characters per token
        const inputTokens = Math.ceil(JSON.stringify(messages).length / 4);
        const outputTokens = Math.ceil(response.length / 4);
        
        return {
            prompt_tokens: inputTokens,
            completion_tokens: outputTokens,
            total_tokens: inputTokens + outputTokens
        };
    }

    /**
     * Calculate cost based on usage
     */
    calculateCost(usage, model) {
        const pricing = this.modelPricing[model];
        if (!pricing || !usage) return 0;

        const inputCost = (usage.prompt_tokens / 1000) * pricing.input;
        const outputCost = (usage.completion_tokens / 1000) * pricing.output;
        
        return inputCost + outputCost;
    }

    /**
     * Update metrics
     */
    updateMetrics(responseTime, success, usage = null) {
        if (success) {
            this.metrics.successfulRequests++;
            this.metrics.totalResponseTime += responseTime;
            this.metrics.avgResponseTime = this.metrics.totalResponseTime / this.metrics.successfulRequests;
            
            if (usage) {
                this.metrics.totalTokensUsed += usage.total_tokens || 0;
                this.metrics.totalCost += this.calculateCost(usage, this.config.defaultModel);
            }
        } else {
            this.metrics.failedRequests++;
        }
        
        this.metrics.lastUpdated = Date.now();
    }

    /**
     * Get performance metrics
     */
    getMetrics() {
        return {
            ...this.metrics,
            successRate: this.metrics.totalRequests > 0 
                ? (this.metrics.successfulRequests / this.metrics.totalRequests * 100).toFixed(2) + '%'
                : '0%',
            avgCostPerRequest: this.metrics.successfulRequests > 0
                ? (this.metrics.totalCost / this.metrics.successfulRequests).toFixed(4)
                : '0'
        };
    }

    /**
     * Format messages for the API
     */
    formatMessages(messages) {
        return messages.map(msg => ({
            role: msg.role,
            content: msg.content
        }));
    }

    /**
     * Create system message
     */
    createSystemMessage(content) {
        return {
            role: 'system',
            content: content
        };
    }

    /**
     * Create user message
     */
    createUserMessage(content) {
        return {
            role: 'user',
            content: content
        };
    }

    /**
     * Create assistant message
     */
    createAssistantMessage(content) {
        return {
            role: 'assistant',
            content: content
        };
    }

    /**
     * Update configuration
     */
    updateConfig(newConfig) {
        if (newConfig.apiKey !== undefined) this.config.apiKey = newConfig.apiKey;
        if (newConfig.baseUrl) this.config.baseUrl = newConfig.baseUrl;
        if (newConfig.timeout) this.config.timeout = newConfig.timeout;
        if (newConfig.defaultModel) this.config.defaultModel = newConfig.defaultModel;
    }

    /**
     * Get current configuration
     */
    getConfig() {
        return {
            hasApiKey: !!this.config.apiKey,
            baseUrl: this.config.baseUrl,
            timeout: this.config.timeout,
            defaultModel: this.config.defaultModel
        };
    }

    /**
     * Validate configuration including API key format
     */
    async validateConfiguration() {
        // Check for required fields
        const required = this.getRequiredConfigFields();
        const missing = required.filter(field => !this.config[field]);
        
        if (missing.length > 0) {
            throw new Error(`Missing required configuration fields: ${missing.join(', ')}`);
        }
        
        // Validate API key format specifically for DeepSeek
        if (this.config.apiKey && !DeepSeekClient.validateApiKey(this.config.apiKey)) {
            throw new Error(`Invalid DeepSeek API key format. API key must start with 'sk-' followed by alphanumeric characters. Please check your API key at https://platform.deepseek.com/api_keys`);
        }
    }

    /**
     * Validate API key format
     */
    static validateApiKey(apiKey) {
        if (!apiKey || typeof apiKey !== 'string') {
            return false;
        }
        
        // DeepSeek API keys must start with 'sk-' followed by alphanumeric characters and hyphens
        // Updated pattern to allow hyphens in the middle of the key
        const deepseekKeyPattern = /^sk-[a-zA-Z0-9_-]+$/;
        return deepseekKeyPattern.test(apiKey);
    }

    /**
     * Get model capabilities
     */
    getModelCapabilities(modelId) {
        const capabilities = {
            'deepseek-chat': { 
                contextLength: 32768, 
                outputTokens: 8192, 
                multimodal: false, 
                tools: true,
                description: 'Advanced reasoning model for complex tasks'
            },
            'deepseek-reasoner': { 
                contextLength: 65536, 
                outputTokens: 8192, 
                multimodal: false, 
                tools: true,
                description: 'Enhanced reasoning model with deeper analytical capabilities'
            }
        };

        return capabilities[modelId] || {
            contextLength: 32768,
            outputTokens: 4096,
            multimodal: false,
            tools: false,
            description: 'Standard DeepSeek model'
        };
    }
} 