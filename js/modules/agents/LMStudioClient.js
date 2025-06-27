import { BaseLLMClient } from './BaseLLMClient.js';

/**
 * LM Studio Client - Handles communication with LM Studio's OpenAI-compatible API
 * Supports both streaming and non-streaming responses
 */
export class LMStudioClient extends BaseLLMClient {
    constructor(config = {}) {
        super({
            providerId: 'lmstudio',
            providerName: 'LM Studio',
            baseUrl: 'http://localhost:1234',
            apiVersion: 'v1',
            timeout: 30000,
            defaultModel: 'google/gemma-3-4b',
            ...config
        });

        // Update capabilities for LM Studio
        this.updateCapabilities({
            streaming: true,
            functionCalling: false, // Depends on model
            vision: true, // Enable vision support for models like Gemma 3 4B
            imageGeneration: false,
            reasoning: false, // Depends on model
            maxContextLength: 8192, // Varies by model
            supportedFormats: ['text', 'image'],
            customParameters: ['temperature', 'max_tokens', 'top_p']
        });
    }

    /**
     * Override getRequiredConfigFields since LM Studio doesn't require API key
     */
    getRequiredConfigFields() {
        return ['baseUrl']; // Only baseURL is required for LM Studio
    }

    /**
     * Get available models from LM Studio
     */
    async getModels() {
        try {
            console.log('🔍 Fetching LM Studio models from API...');
            const response = await fetch(`${this.config.baseUrl}/${this.config.apiVersion}/models`, {
                method: 'GET',
                headers: this.getHeaders(),
                signal: AbortSignal.timeout(this.config.timeout)
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('❌ LM Studio model fetch failed:', response.status, errorText);
                return [];
            }

            const data = await response.json();
            console.log('📋 LM Studio API response:', data);
            
            const allModels = data.data || [];
            
            // Filter out non-chat models (embeddings, etc.)
            const chatModels = allModels
                .filter(model => this.isChatModel(model))
                .map(model => ({
                    ...model,
                    provider: 'lmstudio',
                    display_name: model.id // LM Studio models don't have display_name, use id
                }));
            
            console.log(`✅ Successfully fetched ${chatModels.length} LM Studio models`);
            return chatModels;
        } catch (error) {
            console.error('❌ Error fetching LM Studio models:', error);
            return [];
        }
    }

    /**
     * Check if a model is suitable for chat completion
     */
    isChatModel(model) {
        const modelId = model.id.toLowerCase();
        
        // Exclude embedding models
        if (modelId.includes('embedding') || modelId.includes('embed')) {
            return false;
        }
        
        // Exclude other specialized models
        const excludedPatterns = [
            'embedding',
            'embed',
            'retrieval',
            'search',
            'classifier',
            'sentiment'
        ];
        
        for (const pattern of excludedPatterns) {
            if (modelId.includes(pattern)) {
                return false;
            }
        }
        
        return true;
    }

    /**
     * Get request headers for LM Studio
     */
    getHeaders() {
        return {
            'Content-Type': 'application/json'
        };
    }

    /**
     * Create a chat completion (non-streaming)
     */
    async createChatCompletion(messages, options = {}) {
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
            max_tokens: options.maxTokens ?? -1,
            stream: false,
            ...options.additionalParams
        };

        // Debug: Log the request body
        console.log('LM Studio API Request:', requestBody);
        
        // Additional debugging for image attachments
        if (requestBody.messages && requestBody.messages.some(msg => msg.content && Array.isArray(msg.content))) {
            console.log('🖼️ Gemma 3 Image Debug:', {
                model: requestBody.model,
                messageCount: requestBody.messages.length,
                messagesWithContent: requestBody.messages.filter(msg => msg.content && Array.isArray(msg.content)).map(msg => ({
                    role: msg.role,
                    contentItems: msg.content.length,
                    contentTypes: msg.content.map(item => item.type),
                    hasImages: msg.content.some(item => item.type === 'image_url'),
                    hasText: msg.content.some(item => item.type === 'text'),
                    textLength: msg.content.find(item => item.type === 'text')?.text?.length || 0
                }))
            });
        }

        try {
            const response = await fetch(`${this.config.baseUrl}/${this.config.apiVersion}/chat/completions`, {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify(requestBody),
                signal: AbortSignal.timeout(this.config.timeout)
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`API request failed: ${response.status} - ${errorText}`);
            }

            const data = await response.json();
            const result = this.parseCompletion(data);
            
            // Track successful request
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
        const startTime = Date.now();
        
        // PATCH: Use correct formatting for attachments in streaming
        let formattedMessages;
        if (options.attachments && options.attachments.length > 0) {
            formattedMessages = this.formatMessagesWithAttachments(messages, options.attachments);
        } else {
            formattedMessages = messages;
        }
        
        const requestBody = {
            model: options.model || this.config.defaultModel,
            messages: formattedMessages,
            temperature: options.temperature ?? 0.7,
            max_tokens: options.maxTokens ?? -1,
            stream: true,
            ...options.additionalParams
        };

        // Debug: Log the request body for streaming
        console.log('LM Studio Streaming API Request:', requestBody);

        try {
            this.metrics.totalRequests++;
            
            const response = await fetch(`${this.config.baseUrl}/${this.config.apiVersion}/chat/completions`, {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify(requestBody),
                signal: AbortSignal.timeout(this.config.timeout)
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
            this.updateMetrics(responseTime, false, null, error);
            
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
            const response = await fetch(`${this.config.baseUrl}/${this.config.apiVersion}/models`, {
                method: 'GET',
                headers: this.getHeaders(),
                signal: AbortSignal.timeout(5000)
            });

            return {
                connected: response.ok,
                status: response.status,
                url: `${this.config.baseUrl}/${this.config.apiVersion}`
            };
        } catch (error) {
            return {
                connected: false,
                error: error.message,
                url: `${this.config.baseUrl}/${this.config.apiVersion}`
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
        if (newConfig.baseUrl) this.config.baseUrl = newConfig.baseUrl;
        if (newConfig.apiVersion) this.config.apiVersion = newConfig.apiVersion;
        if (newConfig.timeout) this.config.timeout = newConfig.timeout;
        if (newConfig.defaultModel) this.config.defaultModel = newConfig.defaultModel;
    }

    /**
     * Get current configuration
     */
    getConfig() {
        return {
            baseUrl: this.config.baseUrl,
            apiVersion: this.config.apiVersion,
            timeout: this.config.timeout,
            defaultModel: this.config.defaultModel
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

    // ========== FILE ATTACHMENT METHODS ==========

    /**
     * Process file attachments for LM Studio
     */
    async processFileAttachments(files) {
        const processedAttachments = [];
        
        for (const file of files) {
            try {
                const processed = await this.processFileForLMStudio(file);
                processedAttachments.push(processed);
            } catch (error) {
                console.error(`Failed to process file ${file.name}:`, error);
                throw error;
            }
        }
        
        return processedAttachments;
    }

    /**
     * Validate file attachments for LM Studio
     */
    async validateFileAttachments(files) {
        const validations = [];
        const maxSize = 10 * 1024 * 1024; // 10MB - increased for images
        const supportedTypes = ['text/*', 'image/*'];

        for (const file of files) {
            const validation = {
                file: file.name,
                valid: true,
                error: null
            };

            // Check file size
            if (file.size > maxSize) {
                validation.valid = false;
                validation.error = `File size (${(file.size / 1024 / 1024).toFixed(1)}MB) exceeds LM Studio limit (${maxSize / 1024 / 1024}MB)`;
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
                validation.error = `File type ${file.type} not supported by LM Studio`;
            }

            validations.push(validation);
        }

        return {
            valid: validations.every(v => v.valid),
            validations: validations
        };
    }

    /**
     * Format messages with attachments for LM Studio
     */
    formatMessagesWithAttachments(messages, attachments) {
        if (!attachments || attachments.length === 0) {
            return this.formatMessages(messages);
        }

        console.log('🔄 Formatting messages with attachments for Gemma 3:', {
            messageCount: messages.length,
            attachmentCount: attachments.length,
            messageTypes: messages.map(m => ({ role: m.role, contentType: Array.isArray(m.content) ? 'array' : typeof m.content }))
        });

        const formattedMessages = [];
        
        for (const message of messages) {
            if (message.role === 'user') {
                // Check if message already has the new Gemma 3 format
                if (Array.isArray(message.content)) {
                    // Message already has the correct format, just pass it through
                    formattedMessages.push(message);
                    continue;
                }
                
                // For user messages, create content array for Gemma 3 format
                const formattedMessage = { 
                    role: message.role,
                    content: []
                };
                
                const imageAttachments = attachments.filter(att => att.processedData.type === 'image');
                const textAttachments = attachments.filter(att => att.processedData.type === 'text');
                
                // Add images to content array (Gemma 3 format)
                if (imageAttachments.length > 0) {
                    imageAttachments.forEach(att => {
                        // Remove data URL prefix (e.g., "data:image/jpeg;base64,")
                        const base64Data = att.processedData.data.replace(/^data:[^;]+;base64,/, '');
                        
                        console.log('🖼️ Processing image for Gemma 3:', {
                            name: att.name,
                            type: att.processedData.mime_type,
                            originalDataLength: att.processedData.data.length,
                            base64DataLength: base64Data.length,
                            base64Preview: base64Data.substring(0, 50) + '...',
                            format: 'image_url with nested url object'
                        });
                        
                        // Use Gemma 3 format: content array with type and url
                        formattedMessage.content.push({
                            type: "image_url",
                            image_url: {
                                url: `data:${att.processedData.mime_type};base64,${base64Data}`
                            }
                        });
                    });
                }
                
                // Add text content to content array
                if (textAttachments.length > 0) {
                    const textContent = textAttachments.map(att => att.processedData.text).join('\n\n');
                    formattedMessage.content.push({
                        type: "text",
                        text: textContent
                    });
                }
                
                // Add original message text if it exists
                if (message.content && typeof message.content === 'string' && message.content.trim()) {
                    // If we already have text content, append to it
                    const existingTextContent = formattedMessage.content.find(item => item.type === "text");
                    if (existingTextContent) {
                        existingTextContent.text = `${message.content}\n\n${existingTextContent.text}`;
                    } else {
                        formattedMessage.content.push({
                            type: "text",
                            text: message.content
                        });
                    }
                }
                
                // Ensure we have at least some text content
                if (!formattedMessage.content.some(item => item.type === "text")) {
                    formattedMessage.content.push({
                        type: "text",
                        text: "Please analyze this image."
                    });
                }
                
                formattedMessages.push(formattedMessage);
            } else {
                // For non-user messages, keep as is
                formattedMessages.push(message);
            }
        }
        
        console.log('✅ Messages formatted for Gemma 3:', {
            formattedCount: formattedMessages.length,
            formattedTypes: formattedMessages.map(m => ({ 
                role: m.role, 
                contentType: Array.isArray(m.content) ? 'array' : typeof m.content,
                contentLength: Array.isArray(m.content) ? m.content.length : m.content?.length || 0
            }))
        });
        
        return formattedMessages;
    }

    /**
     * Process a single file for LM Studio
     */
    async processFileForLMStudio(file) {
        let processedData;

        if (file.type.startsWith('image/')) {
            // For LM Studio vision models, we need to provide the image data
            // Since we're in a browser environment, we'll use base64 data URL
            const base64 = await this.fileToBase64(file);
            processedData = {
                type: 'image',
                data: base64,
                mime_type: file.type
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
            provider: 'lmstudio'
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
     * Generate unique attachment ID
     */
    generateAttachmentId() {
        return `att_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
} 