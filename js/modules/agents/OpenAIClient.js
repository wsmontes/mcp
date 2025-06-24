/**
 * OpenAI Client - Handles communication with OpenAI's API
 * Supports GPT-4, GPT-3.5, and other OpenAI models with streaming and non-streaming responses
 */
export class OpenAIClient {
    constructor(config = {}) {
        this.apiKey = config.apiKey || '';
        this.baseUrl = config.baseUrl || 'https://api.openai.com';
        this.apiVersion = config.apiVersion || 'v1';
        this.timeout = config.timeout || 60000; // OpenAI can be slower than local models
        this.defaultModel = config.defaultModel || 'gpt-4o-mini';
        this.organization = config.organization || null;
        
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

        // Model pricing per 1K tokens (as of 2024)
        this.modelPricing = {
            'gpt-4o': { input: 0.005, output: 0.015 },
            'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
            'gpt-4-turbo': { input: 0.01, output: 0.03 },
            'gpt-4': { input: 0.03, output: 0.06 },
            'gpt-3.5-turbo': { input: 0.0015, output: 0.002 },
            'gpt-3.5-turbo-instruct': { input: 0.0015, output: 0.002 }
        };
    }

    /**
     * Get available models from OpenAI
     */
    async getModels() {
        if (!this.apiKey) {
            console.warn('OpenAI API key not configured');
            return this.getDefaultModels();
        }

        try {
            const response = await fetch(`${this.baseUrl}/${this.apiVersion}/models`, {
                method: 'GET',
                headers: this.getHeaders(),
                signal: AbortSignal.timeout(this.timeout)
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch models: ${response.status}`);
            }

            const data = await response.json();
            
            // Filter and sort OpenAI models
            const openaiModels = data.data
                .filter(model => model.id.startsWith('gpt-') || model.id.startsWith('text-'))
                .sort((a, b) => {
                    // Prioritize GPT-4 models, then GPT-3.5
                    const priority = { 'gpt-4o': 1, 'gpt-4o-mini': 2, 'gpt-4-turbo': 3, 'gpt-4': 4, 'gpt-3.5-turbo': 5 };
                    return (priority[a.id] || 99) - (priority[b.id] || 99);
                });

            return openaiModels.length > 0 ? openaiModels : this.getDefaultModels();
        } catch (error) {
            console.error('Error fetching OpenAI models:', error);
            return this.getDefaultModels();
        }
    }

    /**
     * Get default models when API is unavailable
     */
    getDefaultModels() {
        return [
            { id: 'gpt-4o', object: 'model', created: Date.now(), owned_by: 'openai' },
            { id: 'gpt-4o-mini', object: 'model', created: Date.now(), owned_by: 'openai' },
            { id: 'gpt-4-turbo', object: 'model', created: Date.now(), owned_by: 'openai' },
            { id: 'gpt-4', object: 'model', created: Date.now(), owned_by: 'openai' },
            { id: 'gpt-3.5-turbo', object: 'model', created: Date.now(), owned_by: 'openai' }
        ];
    }

    /**
     * Create a chat completion (non-streaming)
     */
    async createChatCompletion(messages, options = {}) {
        if (!this.apiKey) {
            throw new Error('OpenAI API key is required. Please configure it in settings.');
        }

        const startTime = Date.now();
        
        const requestBody = {
            model: options.model || this.defaultModel,
            messages: messages,
            temperature: options.temperature ?? 0.7,
            max_tokens: options.maxTokens > 0 ? options.maxTokens : undefined,
            top_p: options.topP ?? 1,
            frequency_penalty: options.frequencyPenalty ?? 0,
            presence_penalty: options.presencePenalty ?? 0,
            stream: false,
            ...options.additionalParams
        };

        try {
            this.metrics.totalRequests++;
            
            const response = await fetch(`${this.baseUrl}/${this.apiVersion}/chat/completions`, {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify(requestBody),
                signal: AbortSignal.timeout(this.timeout)
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(`OpenAI API request failed: ${response.status} - ${errorData.error?.message || response.statusText}`);
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
            throw new Error('OpenAI API key is required. Please configure it in settings.');
        }

        const startTime = Date.now();
        
        const requestBody = {
            model: options.model || this.defaultModel,
            messages: messages,
            temperature: options.temperature ?? 0.7,
            max_tokens: options.maxTokens > 0 ? options.maxTokens : undefined,
            top_p: options.topP ?? 1,
            frequency_penalty: options.frequencyPenalty ?? 0,
            presence_penalty: options.presencePenalty ?? 0,
            stream: true,
            ...options.additionalParams
        };

        try {
            this.metrics.totalRequests++;
            
            const response = await fetch(`${this.baseUrl}/${this.apiVersion}/chat/completions`, {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify(requestBody),
                signal: AbortSignal.timeout(this.timeout)
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(`OpenAI API request failed: ${response.status} - ${errorData.error?.message || response.statusText}`);
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
     * Handle streaming response from OpenAI
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
                            console.warn('Failed to parse OpenAI streaming chunk:', parseError);
                        }
                    }
                }
            }

            // Emit final completion chunk
            if (onChunk && fullContent) {
                console.log('🔚 OpenAIClient: Emitting final streaming chunk');
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
     * Test connection to OpenAI
     */
    async testConnection() {
        if (!this.apiKey) {
            return {
                connected: false,
                error: 'API key not configured',
                url: `${this.baseUrl}/${this.apiVersion}`
            };
        }

        try {
            const response = await fetch(`${this.baseUrl}/${this.apiVersion}/models`, {
                method: 'GET',
                headers: this.getHeaders(),
                signal: AbortSignal.timeout(10000)
            });

            return {
                connected: response.ok,
                status: response.status,
                url: `${this.baseUrl}/${this.apiVersion}`,
                hasApiKey: !!this.apiKey
            };
        } catch (error) {
            return {
                connected: false,
                error: error.message,
                url: `${this.baseUrl}/${this.apiVersion}`,
                hasApiKey: !!this.apiKey
            };
        }
    }

    /**
     * Get request headers
     */
    getHeaders() {
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`
        };

        if (this.organization) {
            headers['OpenAI-Organization'] = this.organization;
        }

        return headers;
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
        if (newConfig.apiVersion) this.apiVersion = newConfig.apiVersion;
        if (newConfig.timeout) this.timeout = newConfig.timeout;
        if (newConfig.defaultModel) this.defaultModel = newConfig.defaultModel;
        if (newConfig.organization !== undefined) this.organization = newConfig.organization;
    }

    /**
     * Get current configuration
     */
    getConfig() {
        return {
            hasApiKey: !!this.apiKey,
            baseUrl: this.baseUrl,
            apiVersion: this.apiVersion,
            timeout: this.timeout,
            defaultModel: this.defaultModel,
            organization: this.organization
        };
    }

    /**
     * Validate API key format
     */
    static validateApiKey(apiKey) {
        return apiKey && typeof apiKey === 'string' && apiKey.startsWith('sk-') && apiKey.length > 20;
    }

    /**
     * Get model capabilities
     */
    getModelCapabilities(modelId) {
        const capabilities = {
            'gpt-4o': { 
                contextLength: 128000, 
                outputTokens: 4096, 
                multimodal: true, 
                tools: true,
                description: 'Most advanced GPT-4 model with vision capabilities'
            },
            'gpt-4o-mini': { 
                contextLength: 128000, 
                outputTokens: 16384, 
                multimodal: true, 
                tools: true,
                description: 'Faster, cheaper GPT-4 model with vision capabilities'
            },
            'gpt-4-turbo': { 
                contextLength: 128000, 
                outputTokens: 4096, 
                multimodal: false, 
                tools: true,
                description: 'Latest GPT-4 model with improved performance'
            },
            'gpt-4': { 
                contextLength: 8192, 
                outputTokens: 4096, 
                multimodal: false, 
                tools: true,
                description: 'Original GPT-4 model with high reasoning capabilities'
            },
            'gpt-3.5-turbo': { 
                contextLength: 16385, 
                outputTokens: 4096, 
                multimodal: false, 
                tools: true,
                description: 'Fast and efficient model for most tasks'
            }
        };

        return capabilities[modelId] || {
            contextLength: 4096,
            outputTokens: 2048,
            multimodal: false,
            tools: false,
            description: 'Standard OpenAI model'
        };
    }
} 