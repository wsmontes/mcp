import { BaseLLMClient } from './BaseLLMClient.js';

/**
 * Google Gemini Client - Handles communication with Google's Gemini API
 * Supports Gemini Pro, Gemini Flash, and other Gemini models with streaming and non-streaming responses
 */
export class GeminiClient extends BaseLLMClient {
    constructor(config = {}) {
        super({
            providerId: 'gemini',
            providerName: 'Google Gemini',
            baseUrl: 'http://localhost:3001/api/gemini',
            apiVersion: 'v1',
            timeout: 60000,
            defaultModel: 'gemini-1.5-flash',
            ...config
        });

        // Model pricing per 1M characters (as of 2024)
        this.modelPricing = {
            'gemini-1.5-flash': { input: 0.075, output: 0.30 },
            'gemini-1.5-pro': { input: 3.50, output: 10.50 },
            'gemini-1.5-flash-exp': { input: 0.075, output: 0.30 },
            'gemini-1.5-pro-exp': { input: 3.50, output: 10.50 },
            'gemini-1.0-pro': { input: 1.50, output: 4.50 },
            'gemini-1.0-pro-vision': { input: 1.50, output: 4.50 }
        };

        // Update capabilities for Gemini
        this.updateCapabilities({
            streaming: true,
            functionCalling: true,
            vision: true,
            imageGeneration: false, // Not via chat completions
            reasoning: true,
            maxContextLength: 1000000, // Gemini 1.5 context
            supportedFormats: ['text', 'image'],
            customParameters: ['temperature', 'top_p', 'top_k', 'max_output_tokens', 'candidate_count']
        });
    }

    /**
     * Get available models from Gemini
     */
    async getModels() {
        if (!this.config.apiKey) {
            console.warn('Gemini API key not configured');
            return [];
        }

        try {
            console.log('🔍 Fetching Gemini models from API...');
            const response = await fetch(`${this.config.baseUrl}/models`, {
                method: 'GET',
                headers: this.getHeaders(),
                signal: AbortSignal.timeout(this.config.timeout)
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                console.error('❌ Gemini model fetch failed:', response.status, errorData);
                return [];
            }

            const data = await response.json();
            console.log('📋 Gemini API response:', data);
            
            // Filter and sort Gemini models
            const geminiModels = data.models
                .filter(model => model.name.startsWith('models/gemini-'))
                .sort((a, b) => {
                    // Prioritize Flash models, then Pro models
                    const priority = { 
                        'gemini-1.5-flash': 1, 
                        'gemini-1.5-flash-exp': 2, 
                        'gemini-1.5-pro': 3, 
                        'gemini-1.5-pro-exp': 4,
                        'gemini-1.0-pro': 5,
                        'gemini-1.0-pro-vision': 6
                    };
                    const aName = a.name.replace('models/', '');
                    const bName = b.name.replace('models/', '');
                    return (priority[aName] || 99) - (priority[bName] || 99);
                })
                .map(model => ({
                    id: model.name,
                    name: model.name,
                    display_name: model.displayName || model.name.replace('models/', ''),
                    description: model.description || '',
                    provider: 'gemini',
                    supported_generation_methods: model.supportedGenerationMethods || ['generateContent'],
                    input_token_limit: model.inputTokenLimit || 1000000,
                    output_token_limit: model.outputTokenLimit || 8192
                }));

            console.log(`✅ Successfully fetched ${geminiModels.length} Gemini models`);
            return geminiModels;
        } catch (error) {
            console.error('❌ Error fetching Gemini models:', error);
            return [];
        }
    }

    /**
     * Create a chat completion (non-streaming)
     */
    async createChatCompletion(messages, options = {}) {
        if (!this.config.apiKey) {
            throw new Error('Gemini API key is required. Please configure it in settings.');
        }

        const startTime = Date.now();
        
        // PATCH: Use correct formatting for attachments
        let formattedContents;
        if (options.attachments && options.attachments.length > 0) {
            formattedContents = this.formatMessagesWithAttachments(messages, options.attachments);
        } else {
            formattedContents = this.formatMessagesForGemini(messages);
        }
        
        const requestBody = {
            contents: formattedContents,
            generationConfig: {
                temperature: options.temperature ?? 0.7,
                topP: options.topP ?? 1.0,
                topK: options.topK ?? 40,
                maxOutputTokens: options.maxTokens > 0 ? options.maxTokens : 8192,
                candidateCount: options.candidateCount ?? 1,
                ...options.additionalParams
            },
            safetySettings: options.safetySettings || this.getDefaultSafetySettings()
        };

        // Debug: Log the request body
        console.log('Gemini API Request:', requestBody);

        try {
            const response = await fetch(`${this.config.baseUrl}/${options.model || this.config.defaultModel}:generateContent`, {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify(requestBody),
                signal: AbortSignal.timeout(this.config.timeout)
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(`Gemini API request failed: ${response.status} - ${errorData.error?.message || response.statusText}`);
            }

            const data = await response.json();
            const result = this.parseGeminiCompletion(data);
            
            // Track successful request and costs
            const responseTime = Date.now() - startTime;
            this.updateMetrics(responseTime, true, this.estimateGeminiUsage(messages, data, options.model));
            
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
            throw new Error('Gemini API key is required. Please configure it in settings.');
        }

        const startTime = Date.now();
        
        // PATCH: Use correct formatting for attachments in streaming
        let formattedContents;
        if (options.attachments && options.attachments.length > 0) {
            formattedContents = this.formatMessagesWithAttachments(messages, options.attachments);
        } else {
            formattedContents = this.formatMessagesForGemini(messages);
        }
        
        const requestBody = {
            contents: formattedContents,
            generationConfig: {
                temperature: options.temperature ?? 0.7,
                topP: options.topP ?? 1.0,
                topK: options.topK ?? 40,
                maxOutputTokens: options.maxTokens > 0 ? options.maxTokens : 8192,
                candidateCount: options.candidateCount ?? 1,
                ...options.additionalParams
            },
            safetySettings: options.safetySettings || this.getDefaultSafetySettings()
        };

        // Debug: Log the request body for streaming
        console.log('Gemini Streaming API Request:', requestBody);

        try {
            const response = await fetch(`${this.config.baseUrl}/${options.model || this.config.defaultModel}:streamGenerateContent`, {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify(requestBody),
                signal: AbortSignal.timeout(this.config.timeout)
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(`Gemini API request failed: ${response.status} - ${errorData.error?.message || response.statusText}`);
            }

            // Check if response is streaming (text/event-stream) or JSON
            const contentType = response.headers.get('content-type');
            console.log('📋 Response content-type:', contentType);

            if (contentType && contentType.includes('text/event-stream')) {
                const result = await this.handleGeminiStreamingResponse(response, onChunk, requestBody);
                
                // Track successful request
                const responseTime = Date.now() - startTime;
                this.updateMetrics(responseTime, true, result.usage);
                
                return result;
            } else {
                // Non-streaming response
                const data = await response.json();
                const result = this.parseGeminiCompletion(data);
                
                // Track successful request
                const responseTime = Date.now() - startTime;
                this.updateMetrics(responseTime, true, this.estimateGeminiUsage(messages, data, options.model));
                
                return result;
            }
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
     * Handle streaming response from Gemini
     */
    async handleGeminiStreamingResponse(response, onChunk, requestBody) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullContent = '';
        let usage = null;
        let buffer = '';

        console.log('🔄 Starting Gemini streaming response handling...');

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value);
                console.log('📦 Raw chunk:', chunk);
                buffer += chunk;

                // Try to parse complete JSON objects from the buffer
                let bracketCount = 0;
                let startIndex = -1;
                let jsonObjects = [];

                for (let i = 0; i < buffer.length; i++) {
                    if (buffer[i] === '[' && startIndex === -1) {
                        startIndex = i;
                        bracketCount = 1;
                    } else if (buffer[i] === '[' && startIndex !== -1) {
                        bracketCount++;
                    } else if (buffer[i] === ']' && startIndex !== -1) {
                        bracketCount--;
                        if (bracketCount === 0) {
                            // Complete JSON array found
                            const jsonString = buffer.substring(startIndex, i + 1);
                            try {
                                const parsed = JSON.parse(jsonString);
                                jsonObjects.push(parsed);
                                console.log('📋 Parsed JSON array:', parsed);
                            } catch (parseError) {
                                console.warn('Failed to parse JSON array:', parseError);
                            }
                            startIndex = -1;
                        }
                    }
                }

                // Process each parsed JSON object
                for (const parsed of jsonObjects) {
                    if (Array.isArray(parsed)) {
                        // Handle array of objects
                        for (const item of parsed) {
                            if (item.candidates && item.candidates[0]) {
                                const candidate = item.candidates[0];
                                if (candidate.content && candidate.content.parts) {
                                    const text = candidate.content.parts
                                        .filter(part => part.text)
                                        .map(part => part.text)
                                        .join('');
                                    
                                    if (text) {
                                        console.log('📝 Extracted text:', text);
                                        fullContent += text;
                                        if (onChunk) {
                                            onChunk({
                                                content: text,
                                                role: 'assistant',
                                                finishReason: candidate.finishReason || null
                                            });
                                        }
                                    }
                                }
                            }
                            
                            // Extract usage information
                            if (item.usageMetadata) {
                                usage = item.usageMetadata;
                            }
                        }
                    } else if (parsed.candidates && parsed.candidates[0]) {
                        // Handle single object
                        const candidate = parsed.candidates[0];
                        if (candidate.content && candidate.content.parts) {
                            const text = candidate.content.parts
                                .filter(part => part.text)
                                .map(part => part.text)
                                .join('');
                            
                            if (text) {
                                console.log('📝 Extracted text:', text);
                                fullContent += text;
                                if (onChunk) {
                                    onChunk({
                                        content: text,
                                        role: 'assistant',
                                        finishReason: candidate.finishReason || null
                                    });
                                }
                            }
                        }
                        
                        // Extract usage information
                        if (parsed.usageMetadata) {
                            usage = parsed.usageMetadata;
                        }
                    }
                }

                // Clear processed data from buffer
                if (startIndex !== -1) {
                    buffer = buffer.substring(startIndex);
                } else {
                    buffer = '';
                }
            }

            console.log('🏁 Final content:', fullContent);
            return {
                content: fullContent,
                role: 'assistant',
                usage: usage || this.estimateGeminiUsage(requestBody.contents, { content: fullContent }, requestBody.model),
                finishReason: 'STOP'
            };
        } finally {
            reader.releaseLock();
        }
    }

    /**
     * Parse Gemini completion response
     */
    parseGeminiCompletion(data) {
        if (!data.candidates || data.candidates.length === 0) {
            throw new Error('No candidates returned from Gemini API');
        }

        const candidate = data.candidates[0];
        const content = candidate.content?.parts
            ?.filter(part => part.text)
            ?.map(part => part.text)
            ?.join('') || '';

        return {
            content,
            role: 'assistant',
            usage: data.usageMetadata || this.estimateGeminiUsage([], { content }, data.model),
            finishReason: candidate.finishReason || 'STOP'
        };
    }

    /**
     * Format messages for Gemini API
     */
    formatMessagesForGemini(messages) {
        return messages.map(message => {
            const geminiMessage = {
                role: message.role === 'user' ? 'user' : 'model',
                parts: []
            };

            if (message.content) {
                if (typeof message.content === 'string') {
                    geminiMessage.parts.push({ text: message.content });
                } else if (Array.isArray(message.content)) {
                    message.content.forEach(part => {
                        if (typeof part === 'string') {
                            geminiMessage.parts.push({ text: part });
                        } else if (part.type === 'text') {
                            geminiMessage.parts.push({ text: part.text });
                        } else if (part.type === 'image_url') {
                            geminiMessage.parts.push({
                                inlineData: {
                                    mimeType: this.getMimeTypeFromUrl(part.image_url.url),
                                    data: this.extractBase64Data(part.image_url.url)
                                }
                            });
                        }
                    });
                }
            }

            return geminiMessage;
        });
    }

    /**
     * Get MIME type from image URL
     */
    getMimeTypeFromUrl(url) {
        if (url.startsWith('data:')) {
            const match = url.match(/data:([^;]+);/);
            return match ? match[1] : 'image/jpeg';
        }
        
        const extension = url.split('.').pop()?.toLowerCase();
        const mimeTypes = {
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'png': 'image/png',
            'gif': 'image/gif',
            'webp': 'image/webp'
        };
        return mimeTypes[extension] || 'image/jpeg';
    }

    /**
     * Extract base64 data from data URL
     */
    extractBase64Data(url) {
        if (url.startsWith('data:')) {
            const match = url.match(/data:[^;]+;base64,(.+)/);
            return match ? match[1] : '';
        }
        return '';
    }

    /**
     * Get default safety settings for Gemini
     */
    getDefaultSafetySettings() {
        return [
            {
                category: 'HARM_CATEGORY_HARASSMENT',
                threshold: 'BLOCK_MEDIUM_AND_ABOVE'
            },
            {
                category: 'HARM_CATEGORY_HATE_SPEECH',
                threshold: 'BLOCK_MEDIUM_AND_ABOVE'
            },
            {
                category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
                threshold: 'BLOCK_MEDIUM_AND_ABOVE'
            },
            {
                category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
                threshold: 'BLOCK_MEDIUM_AND_ABOVE'
            }
        ];
    }

    /**
     * Test connection to Gemini API
     */
    async testConnection() {
        try {
            console.log('🔍 Testing Gemini API connection...');
            
            const response = await fetch(`${this.config.baseUrl}/models`, {
                method: 'GET',
                headers: this.getHeaders(),
                signal: AbortSignal.timeout(10000)
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                return {
                    success: false,
                    error: `API request failed: ${response.status} - ${errorData.error?.message || response.statusText}`,
                    status: response.status
                };
            }

            const data = await response.json();
            const modelCount = data.models?.length || 0;
            
            return {
                success: true,
                message: `Successfully connected to Gemini API. Found ${modelCount} models.`,
                models: data.models || []
            };
        } catch (error) {
            console.error('❌ Gemini connection test failed:', error);
            return {
                success: false,
                error: error.message,
                status: 'connection_error'
            };
        }
    }

    /**
     * Get request headers for Gemini API
     */
    getHeaders() {
        return {
            'Content-Type': 'application/json',
            'x-api-key': this.config.apiKey
        };
    }

    /**
     * Estimate token usage for Gemini
     */
    estimateGeminiUsage(messages, response, model) {
        // Gemini uses character count instead of tokens
        let inputChars = 0;
        let outputChars = 0;

        // Count input characters
        messages.forEach(message => {
            if (typeof message.content === 'string') {
                inputChars += message.content.length;
            } else if (Array.isArray(message.content)) {
                message.content.forEach(part => {
                    if (typeof part === 'string') {
                        inputChars += part.length;
                    } else if (part.type === 'text') {
                        inputChars += part.text.length;
                    }
                });
            }
        });

        // Count output characters
        if (response.content) {
            outputChars = response.content.length;
        }

        return {
            prompt_tokens: Math.ceil(inputChars / 4), // Rough estimate: 1 token ≈ 4 characters
            completion_tokens: Math.ceil(outputChars / 4),
            total_tokens: Math.ceil((inputChars + outputChars) / 4),
            input_characters: inputChars,
            output_characters: outputChars
        };
    }

    /**
     * Calculate cost for Gemini usage
     */
    calculateCost(usage, model = this.config.defaultModel) {
        const pricing = this.modelPricing[model] || this.modelPricing['gemini-1.5-flash'];
        
        // Convert tokens to characters (rough estimate)
        const inputChars = usage.input_characters || (usage.prompt_tokens * 4);
        const outputChars = usage.output_characters || (usage.completion_tokens * 4);
        
        const inputCost = (inputChars / 1000000) * pricing.input;
        const outputCost = (outputChars / 1000000) * pricing.output;
        
        return inputCost + outputCost;
    }

    /**
     * Get required configuration fields for Gemini
     */
    getRequiredConfigFields() {
        return ['apiKey'];
    }

    /**
     * Get model capabilities for specific Gemini model
     */
    getModelCapabilities(modelId) {
        const baseCapabilities = { ...this.capabilities };
        
        // Model-specific capabilities
        if (modelId.includes('vision')) {
            baseCapabilities.vision = true;
        }
        
        if (modelId.includes('1.5')) {
            baseCapabilities.maxContextLength = 1000000; // 1M tokens
        } else {
            baseCapabilities.maxContextLength = 30000; // 30K tokens for 1.0 models
        }
        
        return baseCapabilities;
    }

    /**
     * Validate Gemini API key format
     */
    static validateApiKey(apiKey) {
        return apiKey && apiKey.length > 0 && apiKey.startsWith('AIza');
    }

    // ========== FILE ATTACHMENT METHODS ==========

    /**
     * Process file attachments for Gemini
     */
    async processFileAttachments(files) {
        const processedAttachments = [];
        
        for (const file of files) {
            try {
                const processed = await this.processFileForGemini(file);
                processedAttachments.push(processed);
            } catch (error) {
                console.error(`Failed to process file ${file.name}:`, error);
                throw error;
            }
        }
        
        return processedAttachments;
    }

    /**
     * Validate file attachments for Gemini
     */
    async validateFileAttachments(files) {
        const validations = [];
        const maxSize = 20 * 1024 * 1024; // 20MB
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
                validation.error = `File size (${(file.size / 1024 / 1024).toFixed(1)}MB) exceeds Gemini limit (${maxSize / 1024 / 1024}MB)`;
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
                validation.error = `File type ${file.type} not supported by Gemini`;
            }

            validations.push(validation);
        }

        return {
            valid: validations.every(v => v.valid),
            validations: validations
        };
    }

    /**
     * Format messages with attachments for Gemini
     */
    formatMessagesWithAttachments(messages, attachments) {
        if (!attachments || attachments.length === 0) {
            return this.formatMessagesForGemini(messages);
        }

        const formattedContents = [];
        
        for (const message of messages) {
            if (message.role === 'user') {
                // For user messages, combine text content with attachments
                const parts = [];
                
                // Add attachments first (Gemini format)
                parts.push(...attachments.map(att => att.processedData));
                
                // Add text content if present
                if (message.content) {
                    parts.push({
                        text: message.content
                    });
                }
                
                formattedContents.push({
                    role: 'user',
                    parts: parts
                });
            } else if (message.role === 'assistant') {
                // For assistant messages, keep as text
                formattedContents.push({
                    role: 'model',
                    parts: [{
                        text: message.content
                    }]
                });
            }
        }
        
        return formattedContents;
    }

    /**
     * Process a single file for Gemini
     */
    async processFileForGemini(file) {
        let processedData;

        if (file.type.startsWith('image/')) {
            // Convert image to base64 without data URL prefix (Gemini format)
            const base64 = await this.fileToBase64(file);
            const base64Data = base64.split(',')[1]; // Remove "data:image/jpeg;base64," prefix
            processedData = {
                inline_data: {
                    mime_type: file.type,
                    data: base64Data // Gemini expects just the base64 data without prefix
                }
            };
        } else {
            // Read as text
            const text = await this.fileToText(file);
            processedData = {
                text: text
            };
        }

        return {
            id: this.generateAttachmentId(),
            name: file.name,
            type: file.type,
            size: file.size,
            processedData: processedData,
            provider: 'gemini'
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