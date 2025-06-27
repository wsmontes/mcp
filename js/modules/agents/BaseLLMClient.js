/**
 * Base LLM Client - Abstract base class defining the standard interface for all LLM providers
 * This ensures consistency and agnosticism across different LLM implementations
 */
export class BaseLLMClient {
    constructor(config = {}) {
        if (this.constructor === BaseLLMClient) {
            throw new Error('BaseLLMClient is abstract and cannot be instantiated directly');
        }
        
        this.config = {
            apiKey: config.apiKey || '',
            baseUrl: config.baseUrl || '',
            defaultModel: config.defaultModel || '',
            timeout: config.timeout || 30000,
            retryAttempts: config.retryAttempts || 3,
            retryDelay: config.retryDelay || 1000,
            ...config
        };
        
        this.providerId = config.providerId || this.constructor.name.toLowerCase().replace('client', '');
        this.providerName = config.providerName || this.providerId;
        
        // Standard metrics tracking
        this.metrics = {
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            totalResponseTime: 0,
            avgResponseTime: 0,
            totalTokensUsed: 0,
            totalCost: 0,
            lastUpdated: Date.now(),
            lastRequestTime: null,
            lastError: null
        };
        
        // Provider capabilities
        this.capabilities = {
            streaming: true,
            functionCalling: false,
            vision: false,
            imageGeneration: false,
            reasoning: false,
            maxContextLength: 4096,
            supportedFormats: ['text'],
            customParameters: [],
            fileAttachments: false,
            maxFileSize: 0,
            maxFiles: 0,
            supportedFileTypes: []
        };
        
        this.isInitialized = false;
    }

    // ========== ABSTRACT METHODS (must be implemented by subclasses) ==========

    /**
     * Get available models from the provider
     * @returns {Promise<Array>} Array of model objects
     */
    async getModels() {
        throw new Error('getModels() must be implemented by subclass');
    }

    /**
     * Create a chat completion (non-streaming)
     * @param {Array} messages - Array of message objects
     * @param {Object} options - Request options
     * @returns {Promise<Object>} Completion result
     */
    async createChatCompletion(messages, options = {}) {
        throw new Error('createChatCompletion() must be implemented by subclass');
    }

    /**
     * Create a streaming chat completion
     * @param {Array} messages - Array of message objects
     * @param {Object} options - Request options
     * @param {Function} onChunk - Callback for streaming chunks
     * @returns {Promise<Object>} Completion result
     */
    async createStreamingChatCompletion(messages, options = {}, onChunk = null) {
        throw new Error('createStreamingChatCompletion() must be implemented by subclass');
    }

    /**
     * Test connection to the provider
     * @returns {Promise<Object>} Connection test result
     */
    async testConnection() {
        throw new Error('testConnection() must be implemented by subclass');
    }

    /**
     * Get request headers for API calls
     * @returns {Object} Headers object
     */
    getHeaders() {
        throw new Error('getHeaders() must be implemented by subclass');
    }

    /**
     * Process file attachments for this provider
     * @param {Array} files - Array of File objects
     * @returns {Promise<Array>} Processed attachments
     */
    async processFileAttachments(files) {
        throw new Error('processFileAttachments() must be implemented by subclass');
    }

    /**
     * Validate file attachments for this provider
     * @param {Array} files - Array of File objects
     * @returns {Promise<Object>} Validation result
     */
    async validateFileAttachments(files) {
        throw new Error('validateFileAttachments() must be implemented by subclass');
    }

    /**
     * Format messages with attachments for this provider
     * @param {Array} messages - Array of message objects
     * @param {Array} attachments - Array of processed attachments
     * @returns {Array} Formatted messages with attachments
     */
    formatMessagesWithAttachments(messages, attachments) {
        throw new Error('formatMessagesWithAttachments() must be implemented by subclass');
    }

    // ========== STANDARDIZED METHODS (implemented for all providers) ==========

    /**
     * Initialize the client
     */
    async initialize() {
        try {
            await this.validateConfiguration();
            this.isInitialized = true;
            console.log(`✅ ${this.providerName} client initialized`);
            return { success: true };
        } catch (error) {
            console.error(`❌ Failed to initialize ${this.providerName} client:`, error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Validate the client configuration
     */
    async validateConfiguration() {
        const required = this.getRequiredConfigFields();
        const missing = required.filter(field => !this.config[field]);
        
        if (missing.length > 0) {
            throw new Error(`Missing required configuration fields: ${missing.join(', ')}`);
        }
    }

    /**
     * Get required configuration fields for this provider
     * Can be overridden by subclasses
     */
    getRequiredConfigFields() {
        return ['apiKey']; // Most providers require at least an API key
    }

    /**
     * Update client configuration
     * @param {Object} newConfig - New configuration values
     */
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        this.isInitialized = false; // Require re-initialization
    }

    /**
     * Get current configuration (without sensitive data)
     */
    getConfig() {
        const config = { ...this.config };
        // Remove sensitive fields
        delete config.apiKey;
        delete config.organization;
        return config;
    }

    /**
     * Get provider information
     */
    getProviderInfo() {
        return {
            id: this.providerId,
            name: this.providerName,
            capabilities: this.capabilities,
            isInitialized: this.isInitialized,
            config: this.getConfig()
        };
    }

    /**
     * Get provider capabilities
     */
    getCapabilities() {
        return { ...this.capabilities };
    }

    /**
     * Update provider capabilities
     * @param {Object} newCapabilities - New capabilities to merge
     */
    updateCapabilities(newCapabilities) {
        this.capabilities = { ...this.capabilities, ...newCapabilities };
    }

    /**
     * Get metrics for this provider
     */
    getMetrics() {
        return {
            ...this.metrics,
            successRate: this.metrics.totalRequests > 0 
                ? (this.metrics.successfulRequests / this.metrics.totalRequests) * 100 
                : 0
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
            totalTokensUsed: 0,
            totalCost: 0,
            lastUpdated: Date.now(),
            lastRequestTime: null,
            lastError: null
        };
    }

    /**
     * Update metrics after a request
     * @param {number} responseTime - Request response time in ms
     * @param {boolean} success - Whether the request was successful
     * @param {Object} usage - Token usage information
     * @param {Error} error - Error object if request failed
     */
    updateMetrics(responseTime, success, usage = null, error = null) {
        this.metrics.totalRequests++;
        this.metrics.totalResponseTime += responseTime;
        this.metrics.avgResponseTime = this.metrics.totalResponseTime / this.metrics.totalRequests;
        this.metrics.lastRequestTime = Date.now();
        this.metrics.lastUpdated = Date.now();

        if (success) {
            this.metrics.successfulRequests++;
            if (usage) {
                this.metrics.totalTokensUsed += (usage.prompt_tokens || 0) + (usage.completion_tokens || 0);
                this.metrics.totalCost += this.calculateCost(usage);
            }
            this.metrics.lastError = null;
        } else {
            this.metrics.failedRequests++;
            this.metrics.lastError = error ? error.message : 'Unknown error';
        }
    }

    /**
     * Calculate cost for token usage
     * Can be overridden by subclasses with specific pricing
     * @param {Object} usage - Token usage object
     * @returns {number} Estimated cost
     */
    calculateCost(usage) {
        // Default implementation returns 0
        // Subclasses should override with actual pricing
        return 0;
    }

    /**
     * Format messages to the provider's expected format
     * Can be overridden by subclasses if needed
     * @param {Array} messages - Messages to format
     * @returns {Array} Formatted messages
     */
    formatMessages(messages) {
        return messages.map(msg => ({
            role: msg.role,
            content: msg.content
        }));
    }

    /**
     * Create a system message
     * @param {string} content - Message content
     */
    createSystemMessage(content) {
        return { role: 'system', content };
    }

    /**
     * Create a user message
     * @param {string} content - Message content
     */
    createUserMessage(content) {
        return { role: 'user', content };
    }

    /**
     * Create an assistant message
     * @param {string} content - Message content
     */
    createAssistantMessage(content) {
        return { role: 'assistant', content };
    }

    /**
     * Retry a failed request with exponential backoff
     * @param {Function} requestFn - Function to retry
     * @param {number} attempt - Current attempt number
     * @returns {Promise} Request result
     */
    async retryRequest(requestFn, attempt = 1) {
        try {
            return await requestFn();
        } catch (error) {
            if (attempt >= this.config.retryAttempts) {
                throw error;
            }
            
            const delay = this.config.retryDelay * Math.pow(2, attempt - 1);
            console.warn(`Request failed, retrying in ${delay}ms (attempt ${attempt}/${this.config.retryAttempts})`);
            
            await new Promise(resolve => setTimeout(resolve, delay));
            return this.retryRequest(requestFn, attempt + 1);
        }
    }

    /**
     * Cleanup resources
     */
    cleanup() {
        // Override in subclasses if needed
        console.log(`🧹 ${this.providerName} client cleanup completed`);
    }

    /**
     * Get model capabilities for a specific model
     * @param {string} modelId - Model identifier
     * @returns {Object} Model capabilities
     */
    getModelCapabilities(modelId) {
        // Default implementation, can be overridden by subclasses
        return {
            ...this.capabilities,
            modelId,
            maxTokens: 4096,
            supportsStreaming: this.capabilities.streaming
        };
    }

    /**
     * Validate API key format
     * @param {string} apiKey - API key to validate
     * @returns {boolean} Whether the API key is valid format
     */
    static validateApiKey(apiKey) {
        return typeof apiKey === 'string' && apiKey.length > 0;
    }
} 