import { BaseLLMClient } from './BaseLLMClient.js';

/**
 * OpenAI Client - Handles communication with OpenAI's API
 * Supports GPT-4, GPT-3.5, and other OpenAI models with streaming and non-streaming responses
 */
export class OpenAIClient extends BaseLLMClient {
    constructor(config = {}) {
        super({
            providerId: 'openai',
            providerName: 'OpenAI',
            baseUrl: 'https://api.openai.com',
            apiVersion: 'v1',
            timeout: 60000, // OpenAI can be slower than local models
            defaultModel: 'gpt-4o-mini',
            ...config
        });

        this.organization = config.organization || null;

        // Model pricing per 1K tokens (as of 2024)
        this.modelPricing = {
            'gpt-4o': { input: 0.005, output: 0.015 },
            'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
            'gpt-4-turbo': { input: 0.01, output: 0.03 },
            'gpt-4': { input: 0.03, output: 0.06 },
            'gpt-3.5-turbo': { input: 0.0015, output: 0.002 },
            'gpt-3.5-turbo-instruct': { input: 0.0015, output: 0.002 }
        };

        // Update capabilities for OpenAI
        this.updateCapabilities({
            streaming: true,
            functionCalling: true,
            vision: true,
            imageGeneration: false, // Not via chat completions
            reasoning: true,
            maxContextLength: 128000, // GPT-4 context
            supportedFormats: ['text', 'image'],
            customParameters: ['temperature', 'top_p', 'frequency_penalty', 'presence_penalty', 'max_tokens'],
            fileAttachments: true,
            maxFileSize: 20 * 1024 * 1024, // 20MB
            maxFiles: 10,
            supportedFileTypes: ['text/*', 'image/*', 'application/pdf']
        });
    }

    /**
     * Get available models from OpenAI
     */
    async getModels() {
        if (!this.config.apiKey) {
            console.warn('OpenAI API key not configured');
            return [];
        }

        try {
            console.log('🔍 Fetching OpenAI models from API...');
            const response = await fetch(`${this.config.baseUrl}/${this.config.apiVersion}/models`, {
                method: 'GET',
                headers: this.getHeaders(),
                signal: AbortSignal.timeout(this.config.timeout)
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                console.error('❌ OpenAI model fetch failed:', response.status, errorData);
                return [];
            }

            const data = await response.json();
            console.log('📋 OpenAI API response:', data);
            
            // Filter and sort OpenAI models
            const openaiModels = data.data
                .filter(model => model.id.startsWith('gpt-') || model.id.startsWith('text-'))
                .sort((a, b) => {
                    // Prioritize GPT-4 models, then GPT-3.5
                    const priority = { 'gpt-4o': 1, 'gpt-4o-mini': 2, 'gpt-4-turbo': 3, 'gpt-4': 4, 'gpt-3.5-turbo': 5 };
                    return (priority[a.id] || 99) - (priority[b.id] || 99);
                })
                .map(model => ({
                    ...model,
                    provider: 'openai',
                    display_name: model.id // OpenAI models don't have display_name, use id
                }));

            console.log(`✅ Successfully fetched ${openaiModels.length} OpenAI models`);
            return openaiModels;
        } catch (error) {
            console.error('❌ Error fetching OpenAI models:', error);
            return [];
        }
    }

    /**
     * Create a chat completion (non-streaming)
     */
    async createChatCompletion(messages, options = {}) {
        if (!this.config.apiKey) {
            throw new Error('OpenAI API key is required. Please configure it in settings.');
        }

        const startTime = Date.now();
        
        // PATCH: Use correct formatting for attachments
        let formattedMessages;
        if (options.attachments && options.attachments.length > 0) {
            formattedMessages = this.formatMessagesWithAttachments(messages, options.attachments);
        } else {
            formattedMessages = this.formatMessages(messages);
        }

        const requestBody = {
            model: options.model || this.config.defaultModel,
            messages: formattedMessages,
            temperature: options.temperature ?? 0.7,
            max_tokens: options.maxTokens > 0 ? options.maxTokens : undefined,
            top_p: options.topP ?? 1,
            frequency_penalty: options.frequencyPenalty ?? 0,
            presence_penalty: options.presencePenalty ?? 0,
            stream: false,
            ...options.additionalParams
        };

        // Debug: Log the request body
        console.log('OpenAI API Request:', requestBody);

        try {
            const response = await fetch(`${this.config.baseUrl}/${this.config.apiVersion}/chat/completions`, {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify(requestBody),
                signal: AbortSignal.timeout(this.config.timeout)
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
            this.updateMetrics(responseTime, false, null, error);
            
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
            throw new Error('OpenAI API key is required. Please configure it in settings.');
        }

        const startTime = Date.now();
        
        // PATCH: Use correct formatting for attachments in streaming
        let formattedMessages;
        if (options.attachments && options.attachments.length > 0) {
            formattedMessages = this.formatMessagesWithAttachments(messages, options.attachments);
        } else {
            formattedMessages = this.formatMessages(messages);
        }
        
        const requestBody = {
            model: options.model || this.config.defaultModel,
            messages: formattedMessages,
            temperature: options.temperature ?? 0.7,
            max_tokens: options.maxTokens > 0 ? options.maxTokens : undefined,
            top_p: options.topP ?? 1,
            frequency_penalty: options.frequencyPenalty ?? 0,
            presence_penalty: options.presencePenalty ?? 0,
            stream: true,
            ...options.additionalParams
        };

        // Debug: Log the request body for streaming
        console.log('OpenAI Streaming API Request:', requestBody);

        try {
            const response = await fetch(`${this.config.baseUrl}/${this.config.apiVersion}/chat/completions`, {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify(requestBody),
                signal: AbortSignal.timeout(this.config.timeout)
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
            this.updateMetrics(responseTime, false, null, error);
            
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
        if (!this.config.apiKey) {
            return {
                connected: false,
                error: 'API key not configured',
                url: `${this.config.baseUrl}/${this.config.apiVersion}`,
                provider: this.providerName
            };
        }

        try {
            const response = await fetch(`${this.config.baseUrl}/${this.config.apiVersion}/models`, {
                method: 'GET',
                headers: this.getHeaders(),
                signal: AbortSignal.timeout(10000)
            });

            return {
                connected: response.ok,
                status: response.status,
                url: `${this.config.baseUrl}/${this.config.apiVersion}`,
                hasApiKey: !!this.config.apiKey,
                provider: this.providerName
            };
        } catch (error) {
            return {
                connected: false,
                error: error.message,
                url: `${this.config.baseUrl}/${this.config.apiVersion}`,
                hasApiKey: !!this.config.apiKey,
                provider: this.providerName
            };
        }
    }

    /**
     * Get request headers
     */
    getHeaders() {
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.config.apiKey}`
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
        if (!usage) return 0;
        
        const modelId = model || this.config.defaultModel;
        const pricing = this.modelPricing[modelId];
        if (!pricing) return 0;

        const inputCost = (usage.prompt_tokens / 1000) * pricing.input;
        const outputCost = (usage.completion_tokens / 1000) * pricing.output;
        
        return inputCost + outputCost;
    }

    /**
     * Override updateConfig to handle organization
     */
    updateConfig(newConfig) {
        super.updateConfig(newConfig);
        if (newConfig.organization !== undefined) {
            this.organization = newConfig.organization;
        }
    }

    /**
     * Override getConfig to include organization
     */
    getConfig() {
        const config = super.getConfig();
        return {
            ...config,
            hasApiKey: !!this.config.apiKey,
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
        // Check if model supports vision
        const visionModels = ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-4-vision-preview'];
        const hasVision = visionModels.some(model => modelId.includes(model));
        
        return {
            vision: hasVision,
            functionCalling: true,
            streaming: true,
            maxContextLength: modelId.includes('gpt-4') ? 128000 : 16385
        };
    }

    // ========== FILE ATTACHMENT METHODS ==========

    /**
     * Process file attachments for OpenAI
     */
    async processFileAttachments(files) {
        const processedAttachments = [];
        
        for (const file of files) {
            try {
                const processed = await this.processFileForOpenAI(file);
                processedAttachments.push(processed);
            } catch (error) {
                console.error(`Failed to process file ${file.name}:`, error);
                throw error;
            }
        }
        
        return processedAttachments;
    }

    /**
     * Validate file attachments for OpenAI
     */
    async validateFileAttachments(files) {
        const validations = [];
        const maxSize = 20 * 1024 * 1024; // 20MB
        const supportedTypes = ['text/*', 'image/*', 'application/pdf'];

        for (const file of files) {
            const validation = {
                file: file.name,
                valid: true,
                error: null
            };

            // Check file size
            if (file.size > maxSize) {
                validation.valid = false;
                validation.error = `File size (${(file.size / 1024 / 1024).toFixed(1)}MB) exceeds OpenAI limit (${maxSize / 1024 / 1024}MB)`;
            }

            // Check file type
            const isSupported = supportedTypes.some(type => {
                if (type.endsWith('/*')) {
                    return file.type.startsWith(type.slice(0, -2));
                }
                return file.type === type;
            });

            if (!isSupported) {
                validation.valid = false;
                validation.error = `File type ${file.type} not supported by OpenAI`;
            }

            validations.push(validation);
        }

        return {
            valid: validations.every(v => v.valid),
            validations: validations
        };
    }

    /**
     * Format messages with attachments for OpenAI
     */
    formatMessagesWithAttachments(messages, attachments) {
        if (!attachments || attachments.length === 0) {
            return this.formatMessages(messages);
        }

        const formattedMessages = [];
        
        for (const message of messages) {
            const formattedMessage = { ...message };
            
            // Add attachments to user messages
            if (message.role === 'user' && attachments.length > 0) {
                formattedMessage.content = [
                    { type: 'text', text: message.content },
                    ...attachments.map(att => att.processedData)
                ];
            }
            
            formattedMessages.push(formattedMessage);
        }
        
        return formattedMessages;
    }

    /**
     * Process a single file for OpenAI
     */
    async processFileForOpenAI(file) {
        let processedData;

        if (file.type.startsWith('image/')) {
            // Convert image to base64 with data URL format (OpenAI format)
            const base64 = await this.fileToBase64(file);
            processedData = {
                type: 'image_url',
                image_url: {
                    url: base64, // OpenAI expects full data URL: "data:image/jpeg;base64,/9j/4AAQ..."
                    detail: 'auto'
                }
            };
        } else if (file.type === 'application/pdf') {
            // Extract text from PDF
            const text = await this.extractTextFromPDF(file);
            processedData = {
                type: 'text',
                text: text
            };
        } else {
            // Read as text
            const text = await this.fileToText(file);
            processedData = {
                type: 'text',
                text: text
            };
        }

        return {
            id: this.generateAttachmentId(),
            name: file.name,
            type: file.type,
            size: file.size,
            processedData: processedData,
            provider: 'openai'
        };
    }

    /**
     * Convert file to base64
     */
    async fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    /**
     * Convert file to text
     */
    async fileToText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsText(file);
        });
    }

    /**
     * Extract text from PDF
     */
    async extractTextFromPDF(file) {
        // This is a simplified implementation
        // In a real application, you might want to use a PDF parsing library
        try {
            const arrayBuffer = await file.arrayBuffer();
            // For now, return a placeholder - in practice you'd use a PDF parser
            return `[PDF Content: ${file.name}] - Text extraction not implemented in this demo`;
        } catch (error) {
            throw new Error(`Failed to extract text from PDF: ${error.message}`);
        }
    }

    /**
     * Generate unique attachment ID
     */
    generateAttachmentId() {
        return `att_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
} 