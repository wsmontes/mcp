/**
 * Configuration Manager - Handles application configuration and settings
 * Implements the Singleton pattern for centralized configuration management
 */
export class ConfigManager {
    constructor() {
        this.config = {};
        this.defaults = {
            app: {
                name: 'MCP Tabajara',
                version: '1.0.0',
                debug: false,
                theme: 'dark',
                language: 'en'
            },
            ui: {
                sidebar: {
                    defaultCollapsed: false,
                    width: 256
                },
                chat: {
                    maxHistoryItems: 100,
                    messageAnimation: true,
                    autoScroll: true,
                    typingIndicator: true
                },
                notifications: {
                    enabled: true,
                    duration: 3000,
                    position: 'top-right'
                }
            },
            agents: {
                timeout: 30000,
                retryAttempts: 3,
                retryDelay: 1000,
                concurrentRequests: 3
            },
            lmStudio: {
                baseUrl: 'http://localhost:1234',
                apiVersion: 'v1',
                defaultModel: 'google/gemma-3-4b',
                streamingEnabled: true,
                timeout: 30000
            },
            storage: {
                quotaWarningThreshold: 0.8,
                cleanupInterval: 86400000, // 24 hours
                maxCacheAge: 604800000 // 7 days
            },
            files: {
                maxFileSize: 10485760, // 10MB
                allowedTypes: ['text/*', 'image/*', 'application/pdf', 'application/json'],
                maxFiles: 10
            },
            performance: {
                enableWebWorkers: true,
                batchSize: 50,
                throttleDelay: 100
            }
        };
    }

    async initialize() {
        this.config = { ...this.defaults };
        await this.loadUserConfig();
        this.validateConfig();
        console.log('⚙️ Configuration Manager initialized');
    }

    /**
     * Load user configuration from storage
     */
    async loadUserConfig() {
        try {
            const userConfig = localStorage.getItem('mcp_tabajara_config');
            if (userConfig) {
                const parsed = JSON.parse(userConfig);
                this.config = this.mergeDeep(this.config, parsed);
            }
        } catch (error) {
            console.warn('Failed to load user configuration:', error);
        }
    }

    /**
     * Save current configuration to storage
     */
    async saveConfig() {
        try {
            localStorage.setItem('mcp_tabajara_config', JSON.stringify(this.config));
        } catch (error) {
            console.error('Failed to save configuration:', error);
            throw error;
        }
    }

    /**
     * Get a configuration value by path
     * @param {string} path - Dot-separated path to the config value
     * @param {*} defaultValue - Default value if path doesn't exist
     * @returns {*} Configuration value
     */
    get(path, defaultValue = null) {
        return this.getValueByPath(this.config, path) ?? defaultValue;
    }

    /**
     * Set a configuration value by path
     * @param {string} path - Dot-separated path to the config value
     * @param {*} value - Value to set
     */
    set(path, value) {
        this.setValueByPath(this.config, path, value);
        this.saveConfig();
    }

    /**
     * Update multiple configuration values
     * @param {Object} updates - Object with configuration updates
     */
    update(updates) {
        this.config = this.mergeDeep(this.config, updates);
        this.saveConfig();
    }

    /**
     * Reset configuration to defaults
     * @param {string} section - Optional section to reset (resets all if not provided)
     */
    reset(section = null) {
        if (section) {
            this.config[section] = { ...this.defaults[section] };
        } else {
            this.config = { ...this.defaults };
        }
        this.saveConfig();
    }

    /**
     * Validate configuration values
     */
    validateConfig() {
        const validators = {
            'ui.sidebar.width': (value) => typeof value === 'number' && value > 0,
            'ui.chat.maxHistoryItems': (value) => typeof value === 'number' && value > 0,
            'agents.timeout': (value) => typeof value === 'number' && value > 0,
            'agents.retryAttempts': (value) => typeof value === 'number' && value >= 0,
            'storage.quotaWarningThreshold': (value) => typeof value === 'number' && value > 0 && value <= 1,
            'files.maxFileSize': (value) => typeof value === 'number' && value > 0,
            'files.maxFiles': (value) => typeof value === 'number' && value > 0
        };

        for (const [path, validator] of Object.entries(validators)) {
            const value = this.get(path);
            if (!validator(value)) {
                console.warn(`Invalid configuration value for ${path}:`, value);
                // Reset to default
                this.set(path, this.getValueByPath(this.defaults, path));
            }
        }
    }

    /**
     * Get configuration schema for UI generation
     */
    getSchema() {
        return {
            app: {
                label: 'Application',
                fields: {
                    theme: {
                        type: 'select',
                        label: 'Theme',
                        options: ['dark', 'light'],
                        default: 'dark'
                    },
                    language: {
                        type: 'select',
                        label: 'Language',
                        options: ['en', 'es', 'fr', 'de'],
                        default: 'en'
                    },
                    debug: {
                        type: 'boolean',
                        label: 'Debug Mode',
                        default: false
                    }
                }
            },
            ui: {
                label: 'User Interface',
                fields: {
                    'sidebar.defaultCollapsed': {
                        type: 'boolean',
                        label: 'Collapse Sidebar by Default',
                        default: false
                    },
                    'chat.maxHistoryItems': {
                        type: 'number',
                        label: 'Max Chat History Items',
                        min: 10,
                        max: 1000,
                        default: 100
                    },
                    'chat.messageAnimation': {
                        type: 'boolean',
                        label: 'Enable Message Animations',
                        default: true
                    },
                    'notifications.enabled': {
                        type: 'boolean',
                        label: 'Enable Notifications',
                        default: true
                    },
                    'notifications.duration': {
                        type: 'number',
                        label: 'Notification Duration (ms)',
                        min: 1000,
                        max: 10000,
                        default: 3000
                    }
                }
            },
            agents: {
                label: 'MCP Agents',
                fields: {
                    timeout: {
                        type: 'number',
                        label: 'Request Timeout (ms)',
                        min: 5000,
                        max: 120000,
                        default: 30000
                    },
                    retryAttempts: {
                        type: 'number',
                        label: 'Retry Attempts',
                        min: 0,
                        max: 10,
                        default: 3
                    },
                    concurrentRequests: {
                        type: 'number',
                        label: 'Concurrent Requests',
                        min: 1,
                        max: 10,
                        default: 3
                    }
                }
            },
            files: {
                label: 'File Handling',
                fields: {
                    maxFileSize: {
                        type: 'number',
                        label: 'Max File Size (bytes)',
                        min: 1048576, // 1MB
                        max: 104857600, // 100MB
                        default: 10485760 // 10MB
                    },
                    maxFiles: {
                        type: 'number',
                        label: 'Max Files per Upload',
                        min: 1,
                        max: 50,
                        default: 10
                    }
                }
            }
        };
    }

    /**
     * Deep merge two objects
     */
    mergeDeep(target, source) {
        const result = { ...target };
        
        for (const key in source) {
            if (source.hasOwnProperty(key)) {
                if (this.isObject(source[key]) && this.isObject(result[key])) {
                    result[key] = this.mergeDeep(result[key], source[key]);
                } else {
                    result[key] = source[key];
                }
            }
        }
        
        return result;
    }

    /**
     * Get nested value by dot-separated path
     */
    getValueByPath(obj, path) {
        return path.split('.').reduce((current, key) => current?.[key], obj);
    }

    /**
     * Set nested value by dot-separated path
     */
    setValueByPath(obj, path, value) {
        const keys = path.split('.');
        const lastKey = keys.pop();
        const target = keys.reduce((current, key) => {
            if (!current[key] || typeof current[key] !== 'object') {
                current[key] = {};
            }
            return current[key];
        }, obj);
        
        target[lastKey] = value;
    }

    /**
     * Check if value is an object
     */
    isObject(value) {
        return value !== null && typeof value === 'object' && !Array.isArray(value);
    }

    /**
     * Export configuration as JSON
     */
    export() {
        return JSON.stringify(this.config, null, 2);
    }

    /**
     * Import configuration from JSON
     */
    import(jsonString) {
        try {
            const imported = JSON.parse(jsonString);
            this.config = this.mergeDeep(this.defaults, imported);
            this.validateConfig();
            this.saveConfig();
        } catch (error) {
            console.error('Failed to import configuration:', error);
            throw new Error('Invalid configuration format');
        }
    }

    /**
     * Get all configuration values
     */
    getAll() {
        return { ...this.config };
    }

    /**
     * Check if configuration has been modified from defaults
     */
    isModified() {
        return JSON.stringify(this.config) !== JSON.stringify(this.defaults);
    }
} 