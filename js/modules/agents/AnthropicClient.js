import { BaseLLMClient } from './BaseLLMClient.js';

/**
 * Anthropic Claude Client - Handles communication with Anthropic's Claude API
 * Supports Claude 3, Claude 3.5, and Claude 4 models with streaming and non-streaming responses
 */
export class AnthropicClient extends BaseLLMClient {
    constructor(config = {}) {
        // Always force proxy server URL for CORS compliance
        const proxyConfig = {
            ...config,
            baseUrl: 'http://localhost:3001/api/anthropic'
        };
        
        super({
            providerId: 'anthropic',
            providerName: 'Anthropic Claude',
            apiVersion: 'v1',
            timeout: 60000, // Claude can be slower for complex reasoning
            defaultModel: 'claude-3-5-sonnet-20241022',
            ...proxyConfig
        });

        this.organization = config.organization || null;
        this.anthropicVersion = config.anthropicVersion || '2023-06-01';

        // Model pricing per 1K tokens (as of 2025)
        this.modelPricing = {
            'claude-3-5-sonnet-20241022': { input: 0.003, output: 0.015 },
            'claude-3-5-haiku-20241022': { input: 0.0008, output: 0.004 },
            'claude-3-opus-20240229': { input: 0.015, output: 0.075 },
            'claude-3-sonnet-20240229': { input: 0.003, output: 0.015 },
            'claude-3-haiku-20240307': { input: 0.00025, output: 0.00125 }
        };

        // Update capabilities for Anthropic Claude
        this.updateCapabilities({
            streaming: true,
            functionCalling: true,
            vision: true,
            imageGeneration: false,
            reasoning: true,
            maxContextLength: 200000, // Claude has very large context windows
            supportedFormats: ['text', 'image', 'document'],
            customParameters: ['temperature', 'top_p', 'top_k', 'max_tokens', 'stop_sequences']
        });

        // Claude-specific parameters
        this.defaultParams = {
            temperature: 1.0,
            top_p: 1.0,
            top_k: 0,
            max_tokens: 4096
        };
    }

    /**
     * Get available models from Anthropic
     * Fetches models from the API dynamically
     */
    async getModels() {
        if (!this.config.apiKey) {
            console.warn('Anthropic API key not configured');
            return [];
        }

        try {
            console.log('🔍 Fetching Anthropic models from API...');
            const response = await fetch(`${this.config.baseUrl}/${this.config.apiVersion}/models`, {
                method: 'GET',
                headers: this.getHeaders(),
                signal: AbortSignal.timeout(this.config.timeout)
            });
            
            if (response.ok) {
                const data = await response.json();
                console.log('📋 Anthropic API response:', data);
                
                // Anthropic API returns { data: [...], has_more: boolean, ... }
                if (data.data && Array.isArray(data.data)) {
                    console.log(`✅ Successfully fetched ${data.data.length} Anthropic models`);
                    return data.data.map(model => ({
                        ...model,
                        provider: 'anthropic',
                        display_name: model.display_name || model.id
                    }));
                } else {
                    console.warn('❌ Unexpected Anthropic API response format:', data);
                    return [];
                }
            } else {
                const errorData = await response.json().catch(() => ({}));
                console.error('❌ Anthropic model fetch failed:', response.status, errorData);
                return [];
            }
        } catch (err) {
            console.error('❌ Anthropic model fetch error:', err.message);
            return [];
        }
    }

    /**
     * Create a chat completion (non-streaming)
     */
    async createChatCompletion(messages, options = {}) {
        if (!this.config.apiKey) {
            throw new Error('Anthropic API key is required. Please configure it in settings.');
        }

        const startTime = Date.now();
        
        // PATCH: Use correct formatting for attachments
        let formattedMessages;
        if (options.attachments && options.attachments.length > 0) {
            formattedMessages = this.formatMessagesWithAttachments(messages, options.attachments);
        } else {
            const { systemPrompt, formattedMessages: baseMessages } = this.formatMessagesForClaude(messages);
            formattedMessages = baseMessages;
            if (systemPrompt) {
                options.systemPrompt = systemPrompt;
            }
        }
        
        const requestBody = {
            model: options.model || this.config.defaultModel,
            messages: formattedMessages,
            max_tokens: options.maxTokens || this.defaultParams.max_tokens,
            temperature: options.temperature ?? this.defaultParams.temperature,
            top_p: options.topP ?? this.defaultParams.top_p,
            top_k: options.topK ?? this.defaultParams.top_k,
            stream: false,
            ...options.additionalParams
        };

        // Add system prompt if present
        if (options.systemPrompt) {
            requestBody.system = options.systemPrompt;
        }

        // Add stop sequences if specified
        if (options.stopSequences) {
            requestBody.stop_sequences = options.stopSequences;
        }

        console.log('🔧 Anthropic request:', {
            url: `${this.config.baseUrl}/${this.config.apiVersion}/messages`,
            model: requestBody.model,
            hasApiKey: !!this.config.apiKey,
            apiKeyPrefix: this.config.apiKey ? this.config.apiKey.substring(0, 10) + '...' : 'none',
            hasAttachments: options.attachments ? options.attachments.length : 0
        });

        try {
            const response = await fetch(`${this.config.baseUrl}/${this.config.apiVersion}/messages`, {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify(requestBody),
                signal: AbortSignal.timeout(this.config.timeout)
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                console.error('❌ Anthropic API error:', {
                    status: response.status,
                    statusText: response.statusText,
                    error: errorData
                });
                
                // Provide more specific error messages
                if (response.status === 401) {
                    throw new Error('Invalid Anthropic API key. Please check your API key in settings.');
                } else if (response.status === 404) {
                    throw new Error(`Model '${requestBody.model}' not found. Please check the model name.`);
                } else if (response.status === 429) {
                    throw new Error('Rate limit exceeded. Please try again later.');
                } else {
                    throw new Error(`Anthropic API request failed: ${response.status} - ${errorData.error?.message || response.statusText}`);
                }
            }

            const data = await response.json();
            const result = this.parseCompletion(data);
            
            // Track successful request and costs
            const responseTime = Date.now() - startTime;
            this.updateMetrics(responseTime, true, data.usage);
            
            console.log('✅ Anthropic request successful:', {
                model: requestBody.model,
                responseTime: `${responseTime}ms`,
                tokens: data.usage
            });
            
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
            throw new Error('Anthropic API key is required. Please configure it in settings.');
        }

        const startTime = Date.now();
        
        // PATCH: Use correct formatting for attachments in streaming
        let formattedMessages;
        if (options.attachments && options.attachments.length > 0) {
            formattedMessages = this.formatMessagesWithAttachments(messages, options.attachments);
        } else {
            const { systemPrompt, formattedMessages: baseMessages } = this.formatMessagesForClaude(messages);
            formattedMessages = baseMessages;
            if (systemPrompt) {
                options.systemPrompt = systemPrompt;
            }
        }
        
        const requestBody = {
            model: options.model || this.config.defaultModel,
            messages: formattedMessages,
            max_tokens: options.maxTokens || this.defaultParams.max_tokens,
            temperature: options.temperature ?? this.defaultParams.temperature,
            top_p: options.topP ?? this.defaultParams.top_p,
            top_k: options.topK ?? this.defaultParams.top_k,
            stream: true,
            ...options.additionalParams
        };

        // Add system prompt if present
        if (options.systemPrompt) {
            requestBody.system = options.systemPrompt;
        }

        // Add stop sequences if specified
        if (options.stopSequences) {
            requestBody.stop_sequences = options.stopSequences;
        }

        console.log('🔧 Anthropic streaming request:', {
            url: `${this.config.baseUrl}/${this.config.apiVersion}/messages`,
            model: requestBody.model,
            hasApiKey: !!this.config.apiKey,
            apiKeyPrefix: this.config.apiKey ? this.config.apiKey.substring(0, 10) + '...' : 'none',
            hasAttachments: options.attachments ? options.attachments.length : 0
        });

        try {
            const response = await fetch(`${this.config.baseUrl}/${this.config.apiVersion}/messages`, {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify(requestBody),
                signal: AbortSignal.timeout(this.config.timeout)
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                console.error('❌ Anthropic streaming API error:', {
                    status: response.status,
                    statusText: response.statusText,
                    error: errorData
                });
                
                // Provide more specific error messages
                if (response.status === 401) {
                    throw new Error('Invalid Anthropic API key. Please check your API key in settings.');
                } else if (response.status === 404) {
                    throw new Error(`Model '${requestBody.model}' not found. Please check the model name.`);
                } else if (response.status === 429) {
                    throw new Error('Rate limit exceeded. Please try again later.');
                } else {
                    throw new Error(`Anthropic API request failed: ${response.status} - ${errorData.error?.message || response.statusText}`);
                }
            }

            const result = await this.handleStreamingResponse(response, onChunk, requestBody);
            
            // Track successful request
            const responseTime = Date.now() - startTime;
            this.updateMetrics(responseTime, true, result.usage);
            
            console.log('✅ Anthropic streaming request successful:', {
                model: requestBody.model,
                responseTime: `${responseTime}ms`,
                tokens: result.usage
            });
            
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
     * Handle streaming response from Anthropic API
     */
    async handleStreamingResponse(response, onChunk, requestBody) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        
        let fullContent = '';
        let usage = null;
        let stopReason = null;
        let modelUsed = requestBody.model;
        let isStreamComplete = false;
        
        try {
            while (true) {
                const { done, value } = await reader.read();
                
                if (done) break;
                
                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n');
                
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const dataStr = line.slice(6);
                        
                        if (dataStr === '[DONE]') {
                            isStreamComplete = true;
                            continue;
                        }
                        
                        try {
                            const data = JSON.parse(dataStr);
                            
                            if (data.type === 'message_start') {
                                // Initialize message
                                modelUsed = data.message?.model || modelUsed;
                                usage = data.message?.usage || usage;
                            } else if (data.type === 'content_block_delta') {
                                // Content delta for text
                                if (data.delta?.type === 'text_delta') {
                                    const content = data.delta.text || '';
                                    fullContent += content;
                                    
                                    if (onChunk) {
                                        onChunk({
                                            content,
                                            fullContent,
                                            finished: false
                                        });
                                    }
                                }
                            } else if (data.type === 'message_delta') {
                                // Message delta with stop reason and usage
                                if (data.delta?.stop_reason) {
                                    stopReason = data.delta.stop_reason;
                                    isStreamComplete = true;
                                }
                                if (data.usage) {
                                    usage = { ...usage, ...data.usage };
                                }
                            } else if (data.type === 'message_stop') {
                                // Message stop event
                                isStreamComplete = true;
                            }
                        } catch (parseError) {
                            console.warn('Failed to parse streaming chunk:', parseError);
                        }
                    }
                }
            }
        } finally {
            reader.releaseLock();
        }
        
        // Final chunk notification - CRITICAL: Use 'finished: true' to match UI expectations
        if (onChunk) {
            console.log('🔚 AnthropicClient: Emitting final streaming chunk');
            onChunk({
                content: '',
                fullContent,
                finished: true,
                usage: usage,
                stopReason: stopReason
            });
        }
        
        return {
            content: fullContent,
            usage: usage || this.estimateUsage(requestBody.messages, fullContent, modelUsed),
            model: modelUsed,
            stopReason: stopReason || 'end_turn',
            finishReason: this.mapStopReasonToFinishReason(stopReason)
        };
    }

    /**
     * Test connection to Anthropic API
     */
    async testConnection() {
        if (!this.config.apiKey) {
            return {
                success: false,
                error: 'API key is required',
                details: 'Please configure your Anthropic API key in settings'
            };
        }

        try {
            // Test with a simple message
            const testMessages = [
                { role: 'user', content: 'Hello! Please respond with just "Hello" to confirm the connection.' }
            ];

            const result = await this.createChatCompletion(testMessages, {
                model: this.config.defaultModel,
                maxTokens: 10,
                temperature: 0
            });

            return {
                success: true,
                model: result.model,
                usage: result.usage,
                response: result.content
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                details: 'Failed to connect to Anthropic API'
            };
        }
    }

    /**
     * Get request headers for Anthropic API
     */
    getHeaders() {
        const headers = {
            'Content-Type': 'application/json',
            'x-api-key': this.config.apiKey,
            'anthropic-version': this.anthropicVersion
        };

        if (this.organization) {
            headers['anthropic-organization-id'] = this.organization;
        }

        return headers;
    }

    /**
     * Format messages for Claude API format
     */
    formatMessagesForClaude(messages) {
        let systemPrompt = '';
        const formattedMessages = [];

        for (const message of messages) {
            if (message.role === 'system') {
                // Claude uses a separate system parameter
                systemPrompt += message.content + '\n';
            } else if (message.role === 'user' || message.role === 'assistant') {
                formattedMessages.push({
                    role: message.role,
                    content: this.formatMessageContent(message.content)
                });
            }
        }

        return {
            systemPrompt: systemPrompt.trim() || null,
            formattedMessages
        };
    }

    /**
     * Format message content for Claude API
     */
    formatMessageContent(content) {
        if (typeof content === 'string') {
            return content;
        }

        if (Array.isArray(content)) {
            // Handle multi-modal content
            return content.map(item => {
                if (item.type === 'text') {
                    return { type: 'text', text: item.text };
                } else if (item.type === 'image') {
                    return {
                        type: 'image',
                        source: {
                            type: 'base64',
                            media_type: item.source?.media_type || 'image/jpeg',
                            data: item.source?.data || item.image_url?.url?.split(',')[1] || ''
                        }
                    };
                }
                return item;
            });
        }

        return String(content);
    }

    /**
     * Parse completion response from Anthropic API
     */
    parseCompletion(data) {
        const content = data.content?.[0]?.text || '';
        
        return {
            content,
            usage: data.usage || {},
            model: data.model,
            stopReason: data.stop_reason,
            finishReason: this.mapStopReasonToFinishReason(data.stop_reason),
            id: data.id,
            created: Math.floor(Date.now() / 1000)
        };
    }

    /**
     * Map Claude stop reasons to OpenAI-style finish reasons for compatibility
     */
    mapStopReasonToFinishReason(stopReason) {
        const mapping = {
            'end_turn': 'stop',
            'max_tokens': 'length',
            'stop_sequence': 'stop',
            'tool_use': 'tool_calls',
            'pause_turn': 'pause',
            'refusal': 'content_filter'
        };
        return mapping[stopReason] || 'stop';
    }

    /**
     * Estimate usage for requests without detailed usage data
     */
    estimateUsage(messages, response, model) {
        // Rough estimation based on character count
        const inputChars = messages.reduce((sum, msg) => sum + String(msg.content).length, 0);
        const outputChars = response.length;
        
        // Approximate token counts (Claude typically ~3.5 chars per token)
        const inputTokens = Math.ceil(inputChars / 3.5);
        const outputTokens = Math.ceil(outputChars / 3.5);
        
        return {
            input_tokens: inputTokens,
            output_tokens: outputTokens,
            total_tokens: inputTokens + outputTokens
        };
    }

    /**
     * Calculate cost based on usage and model
     */
    calculateCost(usage, model) {
        if (!usage || !model) return 0;
        
        const pricing = this.modelPricing[model];
        if (!pricing) return 0;
        
        const inputCost = (usage.input_tokens || 0) * pricing.input / 1000;
        const outputCost = (usage.output_tokens || 0) * pricing.output / 1000;
        
        return inputCost + outputCost;
    }

    /**
     * Update configuration with Anthropic-specific validation
     */
    updateConfig(newConfig) {
        super.updateConfig(newConfig);
        
        // Update Anthropic version if provided
        if (newConfig.anthropicVersion) {
            this.anthropicVersion = newConfig.anthropicVersion;
        }
    }

    /**
     * Get configuration without sensitive data
     */
    getConfig() {
        const config = super.getConfig();
        config.anthropicVersion = this.anthropicVersion;
        return config;
    }

    /**
     * Validate API key format
     */
    static validateApiKey(apiKey) {
        if (!apiKey || typeof apiKey !== 'string') {
            return false;
        }
        
        // Anthropic API keys typically start with 'sk-ant-'
        return apiKey.startsWith('sk-ant-') && apiKey.length > 20;
    }

    /**
     * Get model-specific capabilities
     */
    getModelCapabilities(modelId) {
        const baseCapabilities = {
            contextLength: 200000,
            supportsVision: true,
            supportsTools: true,
            supportsStreaming: true
        };

        // Model-specific adjustments
        if (modelId?.includes('opus')) {
            return { ...baseCapabilities, contextLength: 200000, reasoning: 'advanced' };
        } else if (modelId?.includes('sonnet')) {
            return { ...baseCapabilities, contextLength: 200000, reasoning: 'good' };
        } else if (modelId?.includes('haiku')) {
            return { ...baseCapabilities, contextLength: 200000, reasoning: 'basic', speed: 'fast' };
        }

        return baseCapabilities;
    }

    /**
     * Get required configuration fields
     */
    getRequiredConfigFields() {
        return ['apiKey'];
    }

    // ========== FILE ATTACHMENT METHODS ==========

    /**
     * Process file attachments for Anthropic
     */
    async processFileAttachments(files) {
        const processedAttachments = [];
        
        for (const file of files) {
            try {
                const processed = await this.processFileForAnthropic(file);
                processedAttachments.push(processed);
            } catch (error) {
                console.error(`Failed to process file ${file.name}:`, error);
                throw error;
            }
        }
        
        return processedAttachments;
    }

    /**
     * Validate file attachments for Anthropic
     */
    async validateFileAttachments(files) {
        const validations = [];
        const maxSize = 10 * 1024 * 1024; // 10MB
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
                validation.error = `File size (${(file.size / 1024 / 1024).toFixed(1)}MB) exceeds Anthropic limit (${maxSize / 1024 / 1024}MB)`;
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
                validation.error = `File type ${file.type} not supported by Anthropic`;
            }

            validations.push(validation);
        }

        return {
            valid: validations.every(v => v.valid),
            validations: validations
        };
    }

    /**
     * Format messages with attachments for Anthropic
     */
    formatMessagesWithAttachments(messages, attachments) {
        if (!attachments || attachments.length === 0) {
            const { systemPrompt, formattedMessages } = this.formatMessagesForClaude(messages);
            return formattedMessages;
        }

        const formattedMessages = [];
        
        for (const message of messages) {
            if (message.role === 'user') {
                // For user messages, combine text content with attachments
                const content = [];
                
                // Add text content if present
                if (message.content) {
                    content.push({
                        type: 'text',
                        text: message.content
                    });
                }
                
                // Add attachments
                content.push(...attachments.map(att => att.processedData));
                
                formattedMessages.push({
                    role: 'user',
                    content: content
                });
            } else {
                // For non-user messages, keep as is
                formattedMessages.push(message);
            }
        }
        
        return formattedMessages;
    }

    /**
     * Process a single file for Anthropic
     */
    async processFileForAnthropic(file) {
        let processedData;

        if (file.type.startsWith('image/')) {
            // Convert image to base64 without data URL prefix (Anthropic format)
            const base64 = await this.fileToBase64(file);
            const base64Data = base64.split(',')[1]; // Remove "data:image/jpeg;base64," prefix
            processedData = {
                type: 'image',
                source: {
                    type: 'base64',
                    media_type: file.type,
                    data: base64Data // Anthropic expects just the base64 data without prefix
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
            provider: 'anthropic'
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