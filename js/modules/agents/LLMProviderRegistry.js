/**
 * LLM Provider Registry - Centralized management of all LLM providers
 * Implements the Registry pattern for provider management and discovery
 */
export class LLMProviderRegistry {
    constructor(eventBus) {
        this.eventBus = eventBus;
        this.providers = new Map();
        this.providerConfigs = new Map();
        this.providerInstances = new Map();
        this.defaultProvider = null;
        this.loadOrder = [];
        
        // Provider status tracking
        this.providerStatus = new Map();
        
        // Provider capability index for quick filtering
        this.capabilityIndex = new Map();
        
        console.log('🔧 LLM Provider Registry initialized');
    }

    /**
     * Register a provider class
     * @param {string} providerId - Unique provider identifier
     * @param {Class} ProviderClass - Provider class that extends BaseLLMClient
     * @param {Object} defaultConfig - Default configuration for this provider
     * @param {Object} metadata - Provider metadata (name, description, etc.)
     */
    registerProvider(providerId, ProviderClass, defaultConfig = {}, metadata = {}) {
        if (this.providers.has(providerId)) {
            console.warn(`Provider ${providerId} is already registered. Overwriting...`);
        }

        const providerInfo = {
            id: providerId,
            class: ProviderClass,
            defaultConfig: {
                providerId,
                providerName: metadata.name || providerId,
                ...defaultConfig
            },
            metadata: {
                name: metadata.name || providerId,
                description: metadata.description || `${providerId} LLM provider`,
                version: metadata.version || '1.0.0',
                homepage: metadata.homepage || '',
                documentation: metadata.documentation || '',
                tags: metadata.tags || [],
                supportLevel: metadata.supportLevel || 'community', // official, community, experimental
                ...metadata
            },
            registered: Date.now()
        };

        this.providers.set(providerId, providerInfo);
        this.loadOrder.push(providerId);
        
        console.log(`📦 Registered provider: ${providerId} (${providerInfo.metadata.name})`);
        
        this.eventBus?.emit('registry:provider:registered', {
            providerId,
            providerInfo
        });
    }

    /**
     * Unregister a provider
     * @param {string} providerId - Provider identifier to unregister
     */
    unregisterProvider(providerId) {
        if (!this.providers.has(providerId)) {
            console.warn(`Provider ${providerId} is not registered`);
            return false;
        }

        // Cleanup instance if exists
        if (this.providerInstances.has(providerId)) {
            const instance = this.providerInstances.get(providerId);
            if (typeof instance.cleanup === 'function') {
                instance.cleanup();
            }
            this.providerInstances.delete(providerId);
        }

        // Remove from all tracking
        this.providers.delete(providerId);
        this.providerConfigs.delete(providerId);
        this.providerStatus.delete(providerId);
        
        // Remove from load order
        const index = this.loadOrder.indexOf(providerId);
        if (index > -1) {
            this.loadOrder.splice(index, 1);
        }

        // Update capability index
        this.updateCapabilityIndex();

        console.log(`🗑️ Unregistered provider: ${providerId}`);
        
        this.eventBus?.emit('registry:provider:unregistered', { providerId });
        
        return true;
    }

    /**
     * Get all registered providers
     * @returns {Array} Array of provider information
     */
    getRegisteredProviders() {
        return Array.from(this.providers.values()).map(provider => ({
            ...provider.metadata,
            id: provider.id,
            isConfigured: this.providerConfigs.has(provider.id),
            isInitialized: this.providerInstances.has(provider.id) && 
                          this.providerInstances.get(provider.id).isInitialized,
            status: this.providerStatus.get(provider.id) || { connected: false }
        }));
    }

    /**
     * Configure a provider
     * @param {string} providerId - Provider identifier
     * @param {Object} config - Provider configuration
     */
    configureProvider(providerId, config) {
        if (!this.providers.has(providerId)) {
            throw new Error(`Provider ${providerId} is not registered`);
        }

        const providerInfo = this.providers.get(providerId);
        const fullConfig = {
            ...providerInfo.defaultConfig,
            ...config
        };

        this.providerConfigs.set(providerId, fullConfig);
        
        console.log(`⚙️ Configured provider: ${providerId}`, this.sanitizeConfig(fullConfig));
        
        this.eventBus?.emit('registry:provider:configured', {
            providerId,
            config: this.sanitizeConfig(fullConfig)
        });
    }

    /**
     * Get provider configuration
     * @param {string} providerId - Provider identifier
     * @returns {Object} Provider configuration
     */
    getProviderConfig(providerId) {
        const config = this.providerConfigs.get(providerId);
        return config ? this.sanitizeConfig(config) : null;
    }

    /**
     * Create and initialize a provider instance
     * @param {string} providerId - Provider identifier
     * @returns {Promise<Object>} Provider instance
     */
    async createProviderInstance(providerId) {
        if (!this.providers.has(providerId)) {
            throw new Error(`Provider ${providerId} is not registered`);
        }

        const providerInfo = this.providers.get(providerId);
        const config = this.providerConfigs.get(providerId) || providerInfo.defaultConfig;

        try {
            const instance = new providerInfo.class(config);
            const initResult = await instance.initialize();
            
            if (initResult.success) {
                this.providerInstances.set(providerId, instance);
                this.updateProviderStatus(providerId, { connected: true, error: null });
                this.updateCapabilityIndex();
                
                console.log(`🚀 Created and initialized provider instance: ${providerId}`);
                
                this.eventBus?.emit('registry:provider:initialized', {
                    providerId,
                    capabilities: instance.getCapabilities()
                });
                
                return instance;
            } else {
                this.updateProviderStatus(providerId, { 
                    connected: false, 
                    error: initResult.error 
                });
                throw new Error(initResult.error);
            }
        } catch (error) {
            this.updateProviderStatus(providerId, { 
                connected: false, 
                error: error.message 
            });
            
            console.error(`❌ Failed to create provider instance: ${providerId}`, error);
            
            this.eventBus?.emit('registry:provider:error', {
                providerId,
                error: error.message
            });
            
            throw error;
        }
    }

    /**
     * Get a provider instance
     * @param {string} providerId - Provider identifier
     * @returns {Object|null} Provider instance or null if not found
     */
    getProviderInstance(providerId) {
        return this.providerInstances.get(providerId) || null;
    }

    /**
     * Get all active provider instances
     * @returns {Map} Map of provider instances
     */
    getAllProviderInstances() {
        return new Map(this.providerInstances);
    }

    /**
     * Initialize all configured providers
     * @returns {Promise<Object>} Results of initialization
     */
    async initializeAllProviders() {
        const results = {
            success: [],
            failed: [],
            total: this.providerConfigs.size
        };

        const initPromises = Array.from(this.providerConfigs.keys()).map(async (providerId) => {
            try {
                await this.createProviderInstance(providerId);
                results.success.push(providerId);
            } catch (error) {
                results.failed.push({ providerId, error: error.message });
            }
        });

        await Promise.all(initPromises);
        
        console.log(`🎯 Provider initialization complete: ${results.success.length}/${results.total} successful`);
        
        this.eventBus?.emit('registry:providers:initialized', results);
        
        return results;
    }

    /**
     * Find providers by capability
     * @param {string|Array} capabilities - Capability or array of capabilities to search for
     * @returns {Array} Array of provider IDs that support the capabilities
     */
    findProvidersByCapability(capabilities) {
        const caps = Array.isArray(capabilities) ? capabilities : [capabilities];
        const providers = [];

        for (const [providerId, instance] of this.providerInstances) {
            if (instance.isInitialized) {
                const providerCaps = instance.getCapabilities();
                const hasAllCapabilities = caps.every(cap => {
                    if (typeof providerCaps[cap] === 'boolean') {
                        return providerCaps[cap];
                    }
                    return providerCaps[cap] !== undefined;
                });

                if (hasAllCapabilities) {
                    providers.push(providerId);
                }
            }
        }

        return providers;
    }

    /**
     * Get the best provider for a specific task
     * @param {Object} requirements - Task requirements
     * @returns {string|null} Best provider ID or null if none found
     */
    getBestProviderForTask(requirements = {}) {
        const {
            capabilities = [],
            preferredProviders = [],
            excludeProviders = [],
            modelRequirements = {}
        } = requirements;

        // Get providers that support required capabilities
        let candidates = capabilities.length > 0 
            ? this.findProvidersByCapability(capabilities)
            : Array.from(this.providerInstances.keys());

        // Filter out excluded providers
        candidates = candidates.filter(id => !excludeProviders.includes(id));

        // Prefer specified providers
        const preferred = candidates.filter(id => preferredProviders.includes(id));
        if (preferred.length > 0) {
            candidates = preferred;
        }

        // If no candidates, return null
        if (candidates.length === 0) {
            return null;
        }

        // Sort by provider metrics (success rate, response time, etc.)
        candidates.sort((a, b) => {
            const instanceA = this.providerInstances.get(a);
            const instanceB = this.providerInstances.get(b);
            
            const metricsA = instanceA.getMetrics();
            const metricsB = instanceB.getMetrics();
            
            // Prioritize by success rate, then by response time
            if (metricsA.successRate !== metricsB.successRate) {
                return metricsB.successRate - metricsA.successRate;
            }
            
            return metricsA.avgResponseTime - metricsB.avgResponseTime;
        });

        return candidates[0];
    }

    /**
     * Update provider status
     * @param {string} providerId - Provider identifier
     * @param {Object} status - Status information
     */
    updateProviderStatus(providerId, status) {
        const currentStatus = this.providerStatus.get(providerId) || {};
        const newStatus = {
            ...currentStatus,
            ...status,
            lastUpdated: Date.now()
        };

        this.providerStatus.set(providerId, newStatus);
        
        this.eventBus?.emit('registry:provider:status', {
            providerId,
            status: newStatus
        });
    }

    /**
     * Get provider status
     * @param {string} providerId - Provider identifier
     * @returns {Object} Provider status
     */
    getProviderStatus(providerId) {
        return this.providerStatus.get(providerId) || { connected: false };
    }

    /**
     * Get all provider statuses
     * @returns {Object} Map of provider statuses
     */
    getAllProviderStatuses() {
        const statuses = {};
        for (const [providerId, status] of this.providerStatus) {
            statuses[providerId] = status;
        }
        return statuses;
    }

    /**
     * Update capability index for fast capability-based searches
     */
    updateCapabilityIndex() {
        this.capabilityIndex.clear();

        for (const [providerId, instance] of this.providerInstances) {
            if (instance.isInitialized) {
                const capabilities = instance.getCapabilities();
                
                for (const [capability, value] of Object.entries(capabilities)) {
                    if (!this.capabilityIndex.has(capability)) {
                        this.capabilityIndex.set(capability, new Set());
                    }
                    
                    if (value === true || (typeof value !== 'boolean' && value !== undefined)) {
                        this.capabilityIndex.get(capability).add(providerId);
                    }
                }
            }
        }
    }

    /**
     * Set default provider
     * @param {string} providerId - Provider identifier to set as default
     */
    setDefaultProvider(providerId) {
        if (!this.providerInstances.has(providerId)) {
            throw new Error(`Provider ${providerId} is not initialized`);
        }

        this.defaultProvider = providerId;
        
        console.log(`🎯 Set default provider: ${providerId}`);
        
        this.eventBus?.emit('registry:default:changed', { providerId });
    }

    /**
     * Get default provider
     * @returns {string|null} Default provider ID
     */
    getDefaultProvider() {
        return this.defaultProvider;
    }

    /**
     * Sanitize configuration by removing sensitive data
     * @param {Object} config - Configuration to sanitize
     * @returns {Object} Sanitized configuration
     */
    sanitizeConfig(config) {
        const sanitized = { ...config };
        const sensitiveFields = ['apiKey', 'secretKey', 'token', 'password', 'organization'];
        
        sensitiveFields.forEach(field => {
            if (sanitized[field]) {
                sanitized[field] = '***';
            }
        });

        return sanitized;
    }

    /**
     * Get registry statistics
     * @returns {Object} Registry statistics
     */
    getStats() {
        const totalProviders = this.providers.size;
        const configuredProviders = this.providerConfigs.size;
        const initializedProviders = this.providerInstances.size;
        const connectedProviders = Array.from(this.providerStatus.values())
            .filter(status => status.connected).length;

        return {
            totalProviders,
            configuredProviders,
            initializedProviders,
            connectedProviders,
            defaultProvider: this.defaultProvider,
            loadOrder: [...this.loadOrder]
        };
    }

    /**
     * Export registry configuration
     * @returns {Object} Exportable configuration
     */
    exportConfig() {
        const config = {};
        
        for (const [providerId, providerConfig] of this.providerConfigs) {
            config[providerId] = this.sanitizeConfig(providerConfig);
        }

        return {
            providers: config,
            defaultProvider: this.defaultProvider,
            exportedAt: Date.now()
        };
    }

    /**
     * Import registry configuration
     * @param {Object} config - Configuration to import
     */
    async importConfig(config) {
        if (config.providers) {
            for (const [providerId, providerConfig] of Object.entries(config.providers)) {
                if (this.providers.has(providerId)) {
                    this.configureProvider(providerId, providerConfig);
                }
            }
        }

        if (config.defaultProvider && this.providers.has(config.defaultProvider)) {
            this.defaultProvider = config.defaultProvider;
        }

        console.log('📥 Imported registry configuration');
        
        this.eventBus?.emit('registry:config:imported', { config });
    }

    /**
     * Cleanup all provider instances
     */
    cleanup() {
        for (const [providerId, instance] of this.providerInstances) {
            if (typeof instance.cleanup === 'function') {
                instance.cleanup();
            }
        }
        
        this.providerInstances.clear();
        this.providerStatus.clear();
        this.capabilityIndex.clear();
        
        console.log('🧹 Provider registry cleanup completed');
    }
} 