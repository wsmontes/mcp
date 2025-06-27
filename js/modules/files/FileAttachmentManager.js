/**
 * File Attachment Manager - Standardized file attachment handling across LLM providers
 * Provides a unified interface for attaching files to messages with provider-specific implementations
 */
export class FileAttachmentManager {
    constructor(eventBus, fileManager) {
        this.eventBus = eventBus;
        this.fileManager = fileManager;
        this.providerHandlers = new Map();
        this.attachmentCache = new Map();
        this.maxAttachmentsPerMessage = 10;
        this.maxTotalAttachmentSize = 50 * 1024 * 1024; // 50MB
        
        this.initializeProviderHandlers();
        this.setupEventListeners();
    }

    /**
     * Initialize the File Attachment Manager
     */
    async initialize() {
        try {
            // Initialize provider handlers (already done in constructor)
            // Set up event listeners (already done in constructor)
            
            // Emit capabilities loaded event
            this.eventBus.emit('attachment:capabilities:loaded', this.getAllProviderCapabilities());
            
            console.log('📎 File Attachment Manager initialized');
            return { success: true };
        } catch (error) {
            console.error('❌ Failed to initialize File Attachment Manager:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Initialize provider-specific file handlers
     */
    initializeProviderHandlers() {
        // OpenAI handler
        this.registerProviderHandler('openai', {
            name: 'OpenAI',
            supportedTypes: ['text/*', 'image/*', 'application/pdf'],
            maxFileSize: 20 * 1024 * 1024, // 20MB
            maxFiles: 10,
            processFile: this.processFileForOpenAI.bind(this),
            formatAttachment: this.formatAttachmentForOpenAI.bind(this),
            validateAttachment: this.validateAttachmentForOpenAI.bind(this)
        });

        // Anthropic handler
        this.registerProviderHandler('anthropic', {
            name: 'Anthropic',
            supportedTypes: ['text/*', 'image/*', 'application/pdf'],
            maxFileSize: 10 * 1024 * 1024, // 10MB
            maxFiles: 5,
            processFile: this.processFileForAnthropic.bind(this),
            formatAttachment: this.formatAttachmentForAnthropic.bind(this),
            validateAttachment: this.validateAttachmentForAnthropic.bind(this)
        });

        // Gemini handler
        this.registerProviderHandler('gemini', {
            name: 'Gemini',
            supportedTypes: ['text/*', 'image/*', 'application/pdf'],
            maxFileSize: 20 * 1024 * 1024, // 20MB
            maxFiles: 10,
            processFile: this.processFileForGemini.bind(this),
            formatAttachment: this.formatAttachmentForGemini.bind(this),
            validateAttachment: this.validateAttachmentForGemini.bind(this)
        });

        // DeepSeek handler
        this.registerProviderHandler('deepseek', {
            name: 'DeepSeek',
            supportedTypes: ['text/*', 'image/*'],
            maxFileSize: 10 * 1024 * 1024, // 10MB
            maxFiles: 5,
            processFile: this.processFileForDeepSeek.bind(this),
            formatAttachment: this.formatAttachmentForDeepSeek.bind(this),
            validateAttachment: this.validateAttachmentForDeepSeek.bind(this)
        });

        // LM Studio handler
        this.registerProviderHandler('lmstudio', {
            name: 'LM Studio',
            supportedTypes: ['text/*', 'image/*'],
            maxFileSize: 10 * 1024 * 1024, // 10MB - increased for images
            maxFiles: 5,
            processFile: this.processFileForLMStudio.bind(this),
            formatAttachment: this.formatAttachmentForLMStudio.bind(this),
            validateAttachment: this.validateAttachmentForLMStudio.bind(this)
        });
    }

    /**
     * Register a provider-specific handler
     */
    registerProviderHandler(providerId, handler) {
        this.providerHandlers.set(providerId, handler);
    }

    /**
     * Get provider handler
     */
    getProviderHandler(providerId) {
        return this.providerHandlers.get(providerId);
    }

    /**
     * Set up event listeners
     */
    setupEventListeners() {
        this.eventBus.on('attachment:process', async (data) => {
            await this.processAttachments(data.files, data.providerId);
        });

        this.eventBus.on('attachment:validate', async (data) => {
            await this.validateAttachments(data.files, data.providerId);
        });

        this.eventBus.on('attachment:format', async (data) => {
            return await this.formatAttachmentsForProvider(data.attachments, data.providerId);
        });

        this.eventBus.on('attachment:clear', () => {
            this.clearAttachmentCache();
        });
    }

    /**
     * Process files for attachment to a specific provider
     */
    async processAttachments(files, providerId) {
        const handler = this.getProviderHandler(providerId);
        if (!handler) {
            const error = `No handler found for provider: ${providerId}`;
            this.eventBus.emit('attachment:error', { message: error });
            throw new Error(error);
        }

        const processedAttachments = [];
        const errors = [];

        for (const file of files) {
            try {
                // Validate file for this provider
                const validation = await handler.validateAttachment(file);
                if (!validation.valid) {
                    errors.push({ file: file.name, error: validation.error });
                    continue;
                }

                // Process file for this provider
                const processed = await handler.processFile(file);
                processedAttachments.push(processed);

            } catch (error) {
                errors.push({ file: file.name, error: error.message });
            }
        }

        // Check total size and count limits
        const totalSize = processedAttachments.reduce((sum, att) => sum + att.size, 0);
        if (totalSize > this.maxTotalAttachmentSize) {
            const error = `Total attachment size (${(totalSize / 1024 / 1024).toFixed(1)}MB) exceeds limit (${this.maxTotalAttachmentSize / 1024 / 1024}MB)`;
            this.eventBus.emit('attachment:error', { message: error });
            throw new Error(error);
        }

        if (processedAttachments.length > handler.maxFiles) {
            const error = `Too many files (${processedAttachments.length}) for ${handler.name}. Maximum: ${handler.maxFiles}`;
            this.eventBus.emit('attachment:error', { message: error });
            throw new Error(error);
        }

        const result = {
            attachments: processedAttachments,
            errors: errors,
            provider: handler.name
        };

        // Emit success event
        this.eventBus.emit('attachment:processed', result);

        return result;
    }

    /**
     * Validate attachments for a specific provider
     */
    async validateAttachments(files, providerId) {
        const handler = this.getProviderHandler(providerId);
        if (!handler) {
            return { valid: false, error: `No handler found for provider: ${providerId}` };
        }

        const validations = [];
        for (const file of files) {
            const validation = await handler.validateAttachment(file);
            validations.push({
                file: file.name,
                ...validation
            });
        }

        return {
            valid: validations.every(v => v.valid),
            validations: validations
        };
    }

    /**
     * Format attachments for a specific provider
     */
    async formatAttachmentsForProvider(attachments, providerId) {
        const handler = this.getProviderHandler(providerId);
        if (!handler) {
            throw new Error(`No handler found for provider: ${providerId}`);
        }

        return await handler.formatAttachment(attachments);
    }

    /**
     * Clear attachment cache
     */
    clearAttachmentCache() {
        this.attachmentCache.clear();
    }

    // ========== PROVIDER-SPECIFIC IMPLEMENTATIONS ==========

    // OpenAI Implementation
    async processFileForOpenAI(file) {
        const fileId = this.generateAttachmentId();
        let processedData;

        if (file.type.startsWith('image/')) {
            // Convert image to base64
            const base64 = await this.fileToBase64(file);
            processedData = {
                type: 'image_url',
                image_url: {
                    url: base64,
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
            id: fileId,
            name: file.name,
            type: file.type,
            size: file.size,
            processedData: processedData,
            provider: 'openai'
        };
    }

    formatAttachmentForOpenAI(attachments) {
        return attachments.map(att => att.processedData);
    }

    async validateAttachmentForOpenAI(file) {
        const maxSize = 20 * 1024 * 1024; // 20MB
        const supportedTypes = ['text/*', 'image/*', 'application/pdf'];

        if (file.size > maxSize) {
            return { valid: false, error: `File size (${(file.size / 1024 / 1024).toFixed(1)}MB) exceeds OpenAI limit (${maxSize / 1024 / 1024}MB)` };
        }

        const isSupported = supportedTypes.some(type => {
            if (type.endsWith('/*')) {
                return file.type.startsWith(type.slice(0, -2));
            }
            return file.type === type;
        });

        if (!isSupported) {
            return { valid: false, error: `File type ${file.type} not supported by OpenAI` };
        }

        return { valid: true };
    }

    // Anthropic Implementation
    async processFileForAnthropic(file) {
        const fileId = this.generateAttachmentId();
        let processedData;

        if (file.type.startsWith('image/')) {
            const base64 = await this.fileToBase64(file);
            processedData = {
                type: 'image',
                source: {
                    type: 'base64',
                    media_type: file.type,
                    data: base64.split(',')[1] // Remove data URL prefix
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
            const text = await this.fileToText(file);
            processedData = {
                type: 'text',
                text: text
            };
        }

        return {
            id: fileId,
            name: file.name,
            type: file.type,
            size: file.size,
            processedData: processedData,
            provider: 'anthropic'
        };
    }

    formatAttachmentForAnthropic(attachments) {
        return attachments.map(att => att.processedData);
    }

    async validateAttachmentForAnthropic(file) {
        const maxSize = 10 * 1024 * 1024; // 10MB
        const supportedTypes = ['text/*', 'image/*', 'application/pdf'];

        if (file.size > maxSize) {
            return { valid: false, error: `File size (${(file.size / 1024 / 1024).toFixed(1)}MB) exceeds Anthropic limit (${maxSize / 1024 / 1024}MB)` };
        }

        const isSupported = supportedTypes.some(type => {
            if (type.endsWith('/*')) {
                return file.type.startsWith(type.slice(0, -2));
            }
            return file.type === type;
        });

        if (!isSupported) {
            return { valid: false, error: `File type ${file.type} not supported by Anthropic` };
        }

        return { valid: true };
    }

    // Gemini Implementation
    async processFileForGemini(file) {
        const fileId = this.generateAttachmentId();
        let processedData;

        if (file.type.startsWith('image/')) {
            const base64 = await this.fileToBase64(file);
            processedData = {
                inlineData: {
                    mimeType: file.type,
                    data: base64.split(',')[1] // Remove data URL prefix
                }
            };
        } else {
            const text = await this.fileToText(file);
            processedData = {
                text: text
            };
        }

        return {
            id: fileId,
            name: file.name,
            type: file.type,
            size: file.size,
            processedData: processedData,
            provider: 'gemini'
        };
    }

    formatAttachmentForGemini(attachments) {
        return attachments.map(att => att.processedData);
    }

    async validateAttachmentForGemini(file) {
        const maxSize = 20 * 1024 * 1024; // 20MB
        const supportedTypes = ['text/*', 'image/*'];

        if (file.size > maxSize) {
            return { valid: false, error: `File size (${(file.size / 1024 / 1024).toFixed(1)}MB) exceeds Gemini limit (${maxSize / 1024 / 1024}MB)` };
        }

        const isSupported = supportedTypes.some(type => {
            if (type.endsWith('/*')) {
                return file.type.startsWith(type.slice(0, -2));
            }
            return file.type === type;
        });

        if (!isSupported) {
            return { valid: false, error: `File type ${file.type} not supported by Gemini` };
        }

        return { valid: true };
    }

    // DeepSeek Implementation
    async processFileForDeepSeek(file) {
        const fileId = this.generateAttachmentId();
        let processedData;

        if (file.type.startsWith('image/')) {
            const base64 = await this.fileToBase64(file);
            processedData = {
                type: 'image',
                image_url: {
                    url: base64
                }
            };
        } else {
            const text = await this.fileToText(file);
            processedData = {
                type: 'text',
                text: text
            };
        }

        return {
            id: fileId,
            name: file.name,
            type: file.type,
            size: file.size,
            processedData: processedData,
            provider: 'deepseek'
        };
    }

    formatAttachmentForDeepSeek(attachments) {
        return attachments.map(att => att.processedData);
    }

    async validateAttachmentForDeepSeek(file) {
        const maxSize = 10 * 1024 * 1024; // 10MB
        const supportedTypes = ['text/*', 'image/*'];

        if (file.size > maxSize) {
            return { valid: false, error: `File size (${(file.size / 1024 / 1024).toFixed(1)}MB) exceeds DeepSeek limit (${maxSize / 1024 / 1024}MB)` };
        }

        const isSupported = supportedTypes.some(type => {
            if (type.endsWith('/*')) {
                return file.type.startsWith(type.slice(0, -2));
            }
            return file.type === type;
        });

        if (!isSupported) {
            return { valid: false, error: `File type ${file.type} not supported by DeepSeek` };
        }

        return { valid: true };
    }

    // LM Studio Implementation
    async processFileForLMStudio(file) {
        const fileId = this.generateAttachmentId();
        let processedData;

        if (file.type.startsWith('image/')) {
            // For LM Studio vision models, we need to provide the image data
            // Since we're in a browser environment, we'll use base64 data URL
            const base64 = await this.fileToBase64(file);
            processedData = {
                type: 'image',
                // LM Studio expects either a path or base64 data
                // For browser environment, we'll use base64
                data: base64,
                mime_type: file.type
            };
        } else {
            // For text files, read as text
            const text = await this.fileToText(file);
            processedData = {
                type: 'text',
                text: text
            };
        }
        
        return {
            id: fileId,
            name: file.name,
            type: file.type,
            size: file.size,
            processedData: processedData,
            provider: 'lmstudio'
        };
    }

    formatAttachmentForLMStudio(attachments) {
        // LM Studio vision API expects images in an 'images' array and text in content
        const imageAttachments = attachments.filter(att => att.processedData.type === 'image');
        const textAttachments = attachments.filter(att => att.processedData.type === 'text');
        
        const result = {
            images: imageAttachments.map(att => ({
                data: att.processedData.data,
                mime_type: att.processedData.mime_type
            })),
            textContent: textAttachments.map(att => att.processedData.text).join('\n\n')
        };
        
        return result;
    }

    async validateAttachmentForLMStudio(file) {
        const maxSize = 10 * 1024 * 1024; // 10MB - increased for images
        const supportedTypes = ['text/*', 'image/*'];

        if (file.size > maxSize) {
            return { valid: false, error: `File size (${(file.size / 1024 / 1024).toFixed(1)}MB) exceeds LM Studio limit (${maxSize / 1024 / 1024}MB)` };
        }

        const isSupported = supportedTypes.some(type => {
            if (type.endsWith('/*')) {
                return file.type.startsWith(type.slice(0, -2));
            }
            return file.type === type;
        });

        if (!isSupported) {
            return { valid: false, error: `File type ${file.type} not supported by LM Studio` };
        }

        return { valid: true };
    }

    // ========== UTILITY METHODS ==========

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

    /**
     * Get provider capabilities for file attachments
     */
    getProviderCapabilities(providerId) {
        const handler = this.getProviderHandler(providerId);
        if (!handler) {
            return null;
        }

        return {
            name: handler.name,
            supportedTypes: handler.supportedTypes,
            maxFileSize: handler.maxFileSize,
            maxFiles: handler.maxFiles
        };
    }

    /**
     * Get all provider capabilities
     */
    getAllProviderCapabilities() {
        const capabilities = {};
        for (const [providerId, handler] of this.providerHandlers) {
            capabilities[providerId] = this.getProviderCapabilities(providerId);
        }
        return capabilities;
    }

    /**
     * Cleanup resources
     */
    cleanup() {
        this.clearAttachmentCache();
        this.providerHandlers.clear();
    }
} 