/**
 * LM Studio Client - Handles communication with LM Studio's OpenAI-compatible API
 * Supports both streaming and non-streaming responses
 */
export class LMStudioClient {
    constructor(config = {}) {
        this.baseUrl = config.baseUrl || 'http://localhost:1234';
        this.apiVersion = config.apiVersion || 'v1';
        this.timeout = config.timeout || 30000;
        this.defaultModel = config.defaultModel || 'google/gemma-3-4b';
        
        // Performance tracking
        this.metrics = {
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            totalResponseTime: 0,
            avgResponseTime: 0,
            lastUpdated: Date.now()
        };
    }

    /**
     * Get available models from LM Studio
     */
    async getModels() {
        try {
            const response = await fetch(`${this.baseUrl}/${this.apiVersion}/models`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                },
                signal: AbortSignal.timeout(this.timeout)
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch models: ${response.status}`);
            }

            const data = await response.json();
            return data.data || [];
        } catch (error) {
            console.error('Error fetching models:', error);
            // Return default model if API call fails
            return [{
                id: this.defaultModel,
                object: 'model',
                created: Date.now(),
                owned_by: 'local'
            }];
        }
    }

    /**
     * Create a chat completion (non-streaming)
     */
    async createChatCompletion(messages, options = {}) {
        const startTime = Date.now();
        
        const requestBody = {
            model: options.model || this.defaultModel,
            messages: messages,
            temperature: options.temperature ?? 0.7,
            max_tokens: options.maxTokens ?? -1,
            stream: false,
            ...options.additionalParams
        };

        try {
            this.metrics.totalRequests++;
            
            const response = await fetch(`${this.baseUrl}/${this.apiVersion}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody),
                signal: AbortSignal.timeout(this.timeout)
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`API request failed: ${response.status} - ${errorText}`);
            }

            const data = await response.json();
            const result = this.parseCompletion(data);
            
            // Track successful request
            const responseTime = Date.now() - startTime;
            this.updateMetrics(responseTime, true);
            
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
        const startTime = Date.now();
        
        const requestBody = {
            model: options.model || this.defaultModel,
            messages: messages,
            temperature: options.temperature ?? 0.7,
            max_tokens: options.maxTokens ?? -1,
            stream: true,
            ...options.additionalParams
        };

        try {
            this.metrics.totalRequests++;
            
            const response = await fetch(`${this.baseUrl}/${this.apiVersion}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody),
                signal: AbortSignal.timeout(this.timeout)
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`API request failed: ${response.status} - ${errorText}`);
            }

            const result = await this.handleStreamingResponse(response, onChunk, requestBody);
            
            // Track successful request
            const responseTime = Date.now() - startTime;
            this.updateMetrics(responseTime, true);
            
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
     * Handle streaming response
     */
    async handleStreamingResponse(response, onChunk, requestBody) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullContent = '';
        let buffer = '';

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
                            }
                        } catch (parseError) {
                            console.warn('Failed to parse streaming chunk:', parseError);
                        }
                    }
                }
            }

            // CRITICAL FIX: Emit final completion chunk when streaming ends
            if (onChunk && fullContent) {
                console.log('🔚 LMStudioClient: Emitting final streaming chunk');
                onChunk({
                    content: '',
                    fullContent: fullContent,
                    finished: true
                });
            }

            return {
                content: fullContent,
                usage: null, // LM Studio doesn't always provide usage in streaming
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
     * Test connection to LM Studio
     */
    async testConnection() {
        try {
            const response = await fetch(`${this.baseUrl}/${this.apiVersion}/models`, {
                method: 'GET',
                signal: AbortSignal.timeout(5000)
            });

            return {
                connected: response.ok,
                status: response.status,
                url: `${this.baseUrl}/${this.apiVersion}`
            };
        } catch (error) {
            return {
                connected: false,
                error: error.message,
                url: `${this.baseUrl}/${this.apiVersion}`
            };
        }
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
        if (newConfig.baseUrl) this.baseUrl = newConfig.baseUrl;
        if (newConfig.apiVersion) this.apiVersion = newConfig.apiVersion;
        if (newConfig.timeout) this.timeout = newConfig.timeout;
        if (newConfig.defaultModel) this.defaultModel = newConfig.defaultModel;
    }

    /**
     * Get current configuration
     */
    getConfig() {
        return {
            baseUrl: this.baseUrl,
            apiVersion: this.apiVersion,
            timeout: this.timeout,
            defaultModel: this.defaultModel
        };
    }

    /**
     * Update performance metrics
     */
    updateMetrics(responseTime, success) {
        if (success) {
            this.metrics.successfulRequests++;
        } else {
            this.metrics.failedRequests++;
        }
        
        this.metrics.totalResponseTime += responseTime;
        this.metrics.avgResponseTime = this.metrics.totalResponseTime / this.metrics.totalRequests;
        this.metrics.lastUpdated = Date.now();
    }

    /**
     * Get performance metrics
     */
    getMetrics() {
        const successRate = this.metrics.totalRequests > 0 
            ? (this.metrics.successfulRequests / this.metrics.totalRequests * 100).toFixed(1) + '%'
            : '--';
            
        const avgResponseTime = this.metrics.avgResponseTime > 0 
            ? (this.metrics.avgResponseTime / 1000).toFixed(2) + 's'
            : '--';

        return {
            totalRequests: this.metrics.totalRequests,
            successfulRequests: this.metrics.successfulRequests,
            failedRequests: this.metrics.failedRequests,
            successRate,
            avgResponseTime,
            lastUpdated: this.metrics.lastUpdated
        };
    }

    /**
     * Reset metrics
     */
    resetMetrics() {
        this.metrics = {
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            totalResponseTime: 0,
            avgResponseTime: 0,
            lastUpdated: Date.now()
        };
    }
} 