/**
 * DeepSeek Client - Handles communication with DeepSeek's API
 * Supports deepseek-chat and deepseek-reasoner models with streaming and non-streaming responses
 */
export class DeepSeekClient {
    constructor(config = {}) {
        this.apiKey = config.apiKey || '';
        this.baseUrl = config.baseUrl || 'https://api.deepseek.com';
        this.timeout = config.timeout || 60000;
        this.defaultModel = config.defaultModel || 'deepseek-chat';
        
        // Performance tracking
        this.metrics = {
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            totalResponseTime: 0,
            avgResponseTime: 0,
            totalTokensUsed: 0,
            totalCost: 0,
            lastUpdated: Date.now()
        };

        // Model pricing per 1K tokens (estimated based on DeepSeek pricing)
        this.modelPricing = {
            'deepseek-chat': { input: 0.00014, output: 0.00028 }, // Estimated competitive pricing
            'deepseek-reasoner': { input: 0.00055, output: 0.0022 } // Higher pricing for reasoning model
        };
    }

    /**
     * Get available models from DeepSeek
     */
    async getModels() {
        if (!this.apiKey) {
            console.warn('DeepSeek API key not configured');
            return this.getDefaultModels();
        }

        try {
            const response = await fetch(`${this.baseUrl}/models`, {
                method: 'GET',
                headers: this.getHeaders(),
                signal: AbortSignal.timeout(this.timeout)
            });

            if (!response.ok) {
                console.warn(`Failed to fetch DeepSeek models: ${response.status}`);
                return this.getDefaultModels();
            }

            const data = await response.json();
            
            // Filter and sort DeepSeek models
            const deepseekModels = data.data
                .filter(model => model.id.includes('deepseek'))
                .sort((a, b) => {
                    // Prioritize deepseek-chat, then deepseek-reasoner
                    const priority = { 'deepseek-chat': 1, 'deepseek-reasoner': 2 };
                    return (priority[a.id] || 99) - (priority[b.id] || 99);
                });

            return deepseekModels.length > 0 ? deepseekModels : this.getDefaultModels();
        } catch (error) {
            console.error('Error fetching DeepSeek models:', error);
            return this.getDefaultModels();
        }
    }

    /**
     * Get default models when API is unavailable
     */
    getDefaultModels() {
        return [
            { id: 'deepseek-chat', object: 'model', created: Date.now(), owned_by: 'deepseek' },
            { id: 'deepseek-reasoner', object: 'model', created: Date.now(), owned_by: 'deepseek' }
        ];
    }

    /**
     * Create a chat completion (non-streaming)
     */
    async createChatCompletion(messages, options = {}) {
        if (!this.apiKey) {
            throw new Error('DeepSeek API key is required. Please configure it in settings.');
        }

        const startTime = Date.now();
        
        const requestBody = {
            model: options.model || this.defaultModel,
            messages: messages,
            temperature: options.temperature ?? 1,
            max_tokens: options.maxTokens > 0 ? options.maxTokens : 4096,
            top_p: options.topP ?? 1,
            frequency_penalty: options.frequencyPenalty ?? 0,
            presence_penalty: options.presencePenalty ?? 0,
            stream: false,
            ...options.additionalParams
        };

        try {
            this.metrics.totalRequests++;
            
            const response = await fetch(`${this.baseUrl}/chat/completions`, {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify(requestBody),
                signal: AbortSignal.timeout(this.timeout)
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(`DeepSeek API request failed: ${response.status} - ${errorData.error?.message || response.statusText}`);
            }

            const data = await response.json();
            const result = this.parseCompletion(data);
            
            // Track successful request and costs
            const responseTime = Date.now() - startTime;
            this.updateMetrics(responseTime, true, data.usage);
            
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
     * Create a streaming chat completion
     */
    async createStreamingChatCompletion(messages, options = {}, onChunk = null) {
        if (!this.apiKey) {
            throw new Error('DeepSeek API key is required. Please configure it in settings.');
        }

        const startTime = Date.now();
        
        const requestBody = {
            model: options.model || this.defaultModel,
            messages: messages,
            temperature: options.temperature ?? 1,
            max_tokens: options.maxTokens > 0 ? options.maxTokens : 4096,
            top_p: options.topP ?? 1,
            frequency_penalty: options.frequencyPenalty ?? 0,
            presence_penalty: options.presencePenalty ?? 0,
            stream: true,
            ...options.additionalParams
        };

        try {
            this.metrics.totalRequests++;
            
            const response = await fetch(`${this.baseUrl}/chat/completions`, {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify(requestBody),
                signal: AbortSignal.timeout(this.timeout)
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
     * Handle streaming response from DeepSeek
     */
    async handleStreamingResponse(response, onChunk, requestBody) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullContent = '';
        let buffer = '';
        let usage = null;

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
                                const content = chunk.choices[0].delta.content || '';
                                if (content) {
                                    fullContent += content;
                                    if (onChunk) {
                                        onChunk({
                                            content: content,
                                            fullContent: fullContent,
                                            finished: chunk.choices[0].finish_reason !== null
                                        });
                                    }
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
            if (onChunk && fullContent) {
                console.log('🔚 DeepSeekClient: Emitting final streaming chunk');
                onChunk({
                    content: '',
                    fullContent: fullContent,
                    finished: true
                });
            }

            return {
                content: fullContent,
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
        return {
            content: choice.message?.content || '',
            usage: data.usage,
            model: data.model,
            finishReason: choice.finish_reason,
            finished: true
        };
    }

    /**
     * Test connection to DeepSeek
     */
    async testConnection() {
        if (!this.apiKey) {
            return {
                connected: false,
                error: 'API key not configured',
                url: this.baseUrl
            };
        }

        try {
            const response = await fetch(`${this.baseUrl}/models`, {
                method: 'GET',
                headers: this.getHeaders(),
                signal: AbortSignal.timeout(10000)
            });

            return {
                connected: response.ok,
                status: response.status,
                url: this.baseUrl,
                hasApiKey: !!this.apiKey
            };
        } catch (error) {
            return {
                connected: false,
                error: error.message,
                url: this.baseUrl,
                hasApiKey: !!this.apiKey
            };
        }
    }

    /**
     * Get request headers
     */
    getHeaders() {
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`
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
                this.metrics.totalCost += this.calculateCost(usage, this.defaultModel);
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
        if (newConfig.apiKey !== undefined) this.apiKey = newConfig.apiKey;
        if (newConfig.baseUrl) this.baseUrl = newConfig.baseUrl;
        if (newConfig.timeout) this.timeout = newConfig.timeout;
        if (newConfig.defaultModel) this.defaultModel = newConfig.defaultModel;
    }

    /**
     * Get current configuration
     */
    getConfig() {
        return {
            hasApiKey: !!this.apiKey,
            baseUrl: this.baseUrl,
            timeout: this.timeout,
            defaultModel: this.defaultModel
        };
    }

    /**
     * Validate API key format
     */
    static validateApiKey(apiKey) {
        return apiKey && typeof apiKey === 'string' && apiKey.length > 10;
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