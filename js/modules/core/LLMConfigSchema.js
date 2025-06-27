/**
 * LLM Configuration Schema - Standardized configuration definitions for all LLM providers
 * Ensures consistent configuration across different providers while supporting provider-specific options
 */
export class LLMConfigSchema {
    constructor() {
        this.commonFields = this.getCommonFields();
        this.providerSchemas = this.getProviderSchemas();
        this.capabilityDefinitions = this.getCapabilityDefinitions();
    }

    /**
     * Get common configuration fields that apply to all providers
     */
    getCommonFields() {
        return {
            // Core identification
            providerId: {
                type: 'string',
                required: true,
                description: 'Unique identifier for the provider',
                readonly: true
            },
            providerName: {
                type: 'string',
                required: true,
                description: 'Human-readable name of the provider',
                readonly: true
            },
            enabled: {
                type: 'boolean',
                default: true,
                description: 'Whether this provider is enabled'
            },

            // Connection settings
            baseUrl: {
                type: 'url',
                required: true,
                description: 'Base URL for the provider API',
                validation: {
                    pattern: '^https?://.+',
                    message: 'Must be a valid HTTP or HTTPS URL'
                }
            },
            apiVersion: {
                type: 'string',
                default: 'v1',
                description: 'API version to use'
            },
            timeout: {
                type: 'integer',
                min: 1000,
                max: 300000,
                default: 30000,
                description: 'Request timeout in milliseconds'
            },

            // Authentication
            apiKey: {
                type: 'password',
                sensitive: true,
                description: 'API key for authentication',
                validation: {
                    minLength: 1,
                    message: 'API key is required for most providers'
                }
            },

            // Model settings
            defaultModel: {
                type: 'string',
                required: true,
                description: 'Default model to use for requests'
            },

            // Request behavior
            retryAttempts: {
                type: 'integer',
                min: 0,
                max: 10,
                default: 3,
                description: 'Number of retry attempts for failed requests'
            },
            retryDelay: {
                type: 'integer',
                min: 100,
                max: 30000,
                default: 1000,
                description: 'Initial delay between retries in milliseconds'
            }
        };
    }

    /**
     * Get provider-specific configuration schemas
     */
    getProviderSchemas() {
        return {
            openai: {
                name: 'OpenAI',
                description: 'Configuration for OpenAI GPT models',
                fields: {
                    ...this.commonFields,
                    baseUrl: {
                        ...this.commonFields.baseUrl,
                        default: 'https://api.openai.com'
                    },
                    defaultModel: {
                        ...this.commonFields.defaultModel,
                        default: 'gpt-4o-mini',
                        options: [
                            { value: 'gpt-4o', label: 'GPT-4o (Latest)' },
                            { value: 'gpt-4o-mini', label: 'GPT-4o Mini (Fast & Cheap)' },
                            { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
                            { value: 'gpt-4', label: 'GPT-4' },
                            { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' }
                        ]
                    },
                    organization: {
                        type: 'string',
                        optional: true,
                        description: 'OpenAI organization ID (optional)'
                    },
                    timeout: {
                        ...this.commonFields.timeout,
                        default: 60000 // OpenAI can be slower
                    }
                }
            },

            deepseek: {
                name: 'DeepSeek',
                description: 'Configuration for DeepSeek reasoning models',
                fields: {
                    ...this.commonFields,
                    baseUrl: {
                        ...this.commonFields.baseUrl,
                        default: 'https://api.deepseek.com'
                    },
                    defaultModel: {
                        ...this.commonFields.defaultModel,
                        default: 'deepseek-chat',
                        options: [
                            { value: 'deepseek-chat', label: 'DeepSeek Chat' },
                            { value: 'deepseek-reasoner', label: 'DeepSeek Reasoner' }
                        ]
                    },
                    timeout: {
                        ...this.commonFields.timeout,
                        default: 60000 // Reasoning can take time
                    }
                }
            },

            lmstudio: {
                name: 'LM Studio',
                description: 'Configuration for local LM Studio deployment',
                fields: {
                    ...this.commonFields,
                    apiKey: {
                        ...this.commonFields.apiKey,
                        required: false,
                        description: 'Not required for local LM Studio'
                    },
                    baseUrl: {
                        ...this.commonFields.baseUrl,
                        default: 'http://localhost:1234'
                    },
                    defaultModel: {
                        ...this.commonFields.defaultModel,
                        default: 'current-model',
                        description: 'Model currently loaded in LM Studio'
                    },
                    timeout: {
                        ...this.commonFields.timeout,
                        default: 30000 // Local should be faster
                    }
                }
            }
        };
    }

    /**
     * Get capability definitions and their descriptions
     */
    getCapabilityDefinitions() {
        return {
            streaming: {
                name: 'Streaming',
                description: 'Supports real-time response streaming',
                type: 'boolean'
            },
            functionCalling: {
                name: 'Function Calling',
                description: 'Supports calling external functions/tools',
                type: 'boolean'
            },
            vision: {
                name: 'Vision',
                description: 'Can process and understand images',
                type: 'boolean'
            },
            reasoning: {
                name: 'Advanced Reasoning',
                description: 'Specialized in complex reasoning tasks',
                type: 'boolean'
            },
            maxContextLength: {
                name: 'Context Length',
                description: 'Maximum number of tokens in context window',
                type: 'integer'
            },
            supportedFormats: {
                name: 'Supported Formats',
                description: 'Input formats supported by the provider',
                type: 'array'
            }
        };
    }

    /**
     * Get schema for a specific provider
     */
    getProviderSchema(providerId) {
        return this.providerSchemas[providerId] || null;
    }

    /**
     * Generate default configuration for a provider
     */
    generateDefaultConfig(providerId) {
        const schema = this.getProviderSchema(providerId);
        if (!schema) {
            throw new Error(`Unknown provider: ${providerId}`);
        }

        const config = {};
        
        for (const [fieldName, fieldSchema] of Object.entries(schema.fields)) {
            if (fieldSchema.default !== undefined) {
                config[fieldName] = fieldSchema.default;
            } else if (fieldName === 'providerId') {
                config[fieldName] = providerId;
            } else if (fieldName === 'providerName') {
                config[fieldName] = schema.name;
            }
        }

        return config;
    }
}
