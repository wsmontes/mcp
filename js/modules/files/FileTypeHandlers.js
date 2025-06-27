/**
 * File Type Handlers - Provides specialized handling for different file types
 * Handles file type detection, validation, and processing
 */
export class FileTypeHandlers {
    constructor() {
        this.handlers = new Map();
        this.mimeTypes = new Map();
        this.initializeHandlers();
    }

    /**
     * Initialize default file type handlers
     */
    initializeHandlers() {
        // Text files
        this.registerHandler('text/plain', {
            name: 'Plain Text',
            extensions: ['.txt', '.text'],
            icon: '📄',
            processor: this.processTextFile.bind(this),
            validator: this.validateTextFile.bind(this)
        });

        // JSON files
        this.registerHandler('application/json', {
            name: 'JSON',
            extensions: ['.json'],
            icon: '🔧',
            processor: this.processJsonFile.bind(this),
            validator: this.validateJsonFile.bind(this)
        });

        // CSV files
        this.registerHandler('text/csv', {
            name: 'CSV',
            extensions: ['.csv'],
            icon: '📊',
            processor: this.processCsvFile.bind(this),
            validator: this.validateCsvFile.bind(this)
        });

        // XML files
        this.registerHandler('application/xml', {
            name: 'XML',
            extensions: ['.xml'],
            icon: '📰',
            processor: this.processXmlFile.bind(this),
            validator: this.validateXmlFile.bind(this)
        });

        // Image files
        this.registerHandler('image/jpeg', {
            name: 'JPEG Image',
            extensions: ['.jpg', '.jpeg'],
            icon: '🖼️',
            processor: this.processImageFile.bind(this),
            validator: this.validateImageFile.bind(this)
        });

        this.registerHandler('image/png', {
            name: 'PNG Image',
            extensions: ['.png'],
            icon: '🖼️',
            processor: this.processImageFile.bind(this),
            validator: this.validateImageFile.bind(this)
        });

        // PDF files
        this.registerHandler('application/pdf', {
            name: 'PDF Document',
            extensions: ['.pdf'],
            icon: '📕',
            processor: this.processPdfFile.bind(this),
            validator: this.validatePdfFile.bind(this)
        });

        // JavaScript files
        this.registerHandler('application/javascript', {
            name: 'JavaScript',
            extensions: ['.js', '.mjs'],
            icon: '⚙️',
            processor: this.processJavaScriptFile.bind(this),
            validator: this.validateJavaScriptFile.bind(this)
        });

        // HTML files
        this.registerHandler('text/html', {
            name: 'HTML',
            extensions: ['.html', '.htm'],
            icon: '🌐',
            processor: this.processHtmlFile.bind(this),
            validator: this.validateHtmlFile.bind(this)
        });
    }

    /**
     * Register a new file type handler
     */
    registerHandler(mimeType, handler) {
        this.handlers.set(mimeType, handler);
        
        // Register file extensions mapping to mime type
        if (handler.extensions) {
            handler.extensions.forEach(ext => {
                this.mimeTypes.set(ext.toLowerCase(), mimeType);
            });
        }
    }

    /**
     * Get handler for a file type
     */
    getHandler(mimeType) {
        return this.handlers.get(mimeType);
    }

    /**
     * Get handler by file extension
     */
    getHandlerByExtension(filename) {
        const ext = this.getFileExtension(filename);
        const mimeType = this.mimeTypes.get(ext);
        return mimeType ? this.handlers.get(mimeType) : null;
    }

    /**
     * Get file extension from filename
     */
    getFileExtension(filename) {
        const lastDot = filename.lastIndexOf('.');
        return lastDot > 0 ? filename.slice(lastDot).toLowerCase() : '';
    }

    /**
     * Detect file type from content
     */
    detectFileType(content, filename) {
        // Try to detect from filename first
        const handlerByExt = this.getHandlerByExtension(filename);
        if (handlerByExt) {
            return handlerByExt;
        }

        // Try to detect from content
        if (typeof content === 'string') {
            // JSON detection
            if (this.isValidJson(content)) {
                return this.handlers.get('application/json');
            }
            
            // XML detection
            if (content.trim().startsWith('<?xml') || content.includes('<') && content.includes('>')) {
                return this.handlers.get('application/xml');
            }
            
            // CSV detection (simple heuristic)
            if (content.includes(',') && content.split('\n').length > 1) {
                return this.handlers.get('text/csv');
            }
        }

        // Default to text
        return this.handlers.get('text/plain');
    }

    /**
     * Process file based on its type
     */
    async processFile(file, content) {
        const handler = this.getHandler(file.type) || this.detectFileType(content, file.name);
        
        if (!handler) {
            throw new Error(`No handler found for file type: ${file.type}`);
        }

        // Validate file
        if (handler.validator) {
            const validationResult = await handler.validator(content, file);
            if (!validationResult.valid) {
                throw new Error(`File validation failed: ${validationResult.error}`);
            }
        }

        // Process file
        const result = await handler.processor(content, file);
        
        return {
            ...result,
            handler: {
                name: handler.name,
                icon: handler.icon,
                mimeType: file.type
            }
        };
    }

    // File processors
    async processTextFile(content, file) {
        return {
            type: 'text',
            content: content,
            preview: content.slice(0, 500),
            metadata: {
                length: content.length,
                lines: content.split('\n').length
            }
        };
    }

    async processJsonFile(content, file) {
        try {
            const parsed = JSON.parse(content);
            return {
                type: 'json',
                content: parsed,
                preview: JSON.stringify(parsed, null, 2).slice(0, 500),
                metadata: {
                    keys: typeof parsed === 'object' ? Object.keys(parsed) : [],
                    size: Object.keys(parsed).length
                }
            };
        } catch (error) {
            throw new Error(`Invalid JSON: ${error.message}`);
        }
    }

    async processCsvFile(content, file) {
        const lines = content.split('\n').filter(line => line.trim());
        const headers = lines[0] ? lines[0].split(',') : [];
        
        return {
            type: 'csv',
            content: content,
            preview: lines.slice(0, 10).join('\n'),
            metadata: {
                rows: lines.length,
                columns: headers.length,
                headers: headers
            }
        };
    }

    async processXmlFile(content, file) {
        return {
            type: 'xml',
            content: content,
            preview: content.slice(0, 500),
            metadata: {
                length: content.length,
                tags: (content.match(/<[^>]+>/g) || []).length
            }
        };
    }

    async processImageFile(content, file) {
        return {
            type: 'image',
            content: content,
            preview: content, // Base64 data URL
            metadata: {
                size: file.size,
                type: file.type
            }
        };
    }

    async processPdfFile(content, file) {
        return {
            type: 'pdf',
            content: content,
            preview: 'PDF document',
            metadata: {
                size: file.size,
                pages: 'Unknown' // Would need PDF.js to determine
            }
        };
    }

    async processJavaScriptFile(content, file) {
        return {
            type: 'javascript',
            content: content,
            preview: content.slice(0, 500),
            metadata: {
                length: content.length,
                lines: content.split('\n').length
            }
        };
    }

    async processHtmlFile(content, file) {
        return {
            type: 'html',
            content: content,
            preview: content.slice(0, 500),
            metadata: {
                length: content.length,
                tags: (content.match(/<[^>]+>/g) || []).length
            }
        };
    }

    // File validators
    async validateTextFile(content, file) {
        return { valid: typeof content === 'string', error: null };
    }

    async validateJsonFile(content, file) {
        try {
            JSON.parse(content);
            return { valid: true, error: null };
        } catch (error) {
            return { valid: false, error: error.message };
        }
    }

    async validateCsvFile(content, file) {
        const lines = content.split('\n');
        return { 
            valid: lines.length > 0 && lines[0].includes(','), 
            error: lines.length === 0 ? 'Empty file' : null 
        };
    }

    async validateXmlFile(content, file) {
        const hasXmlDeclaration = content.trim().startsWith('<?xml');
        const hasTags = content.includes('<') && content.includes('>');
        return { 
            valid: hasXmlDeclaration || hasTags, 
            error: !hasTags ? 'No XML tags found' : null 
        };
    }

    async validateImageFile(content, file) {
        return { valid: file.type.startsWith('image/'), error: null };
    }

    async validatePdfFile(content, file) {
        return { valid: file.type === 'application/pdf', error: null };
    }

    async validateJavaScriptFile(content, file) {
        return { valid: typeof content === 'string', error: null };
    }

    async validateHtmlFile(content, file) {
        const hasHtmlTags = content.includes('<html') || content.includes('<HTML');
        return { valid: true, error: null }; // HTML validation is lenient
    }

    // Utility methods
    isValidJson(str) {
        try {
            JSON.parse(str);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Get all supported file types
     */
    getSupportedTypes() {
        const types = [];
        for (const [mimeType, handler] of this.handlers) {
            types.push({
                mimeType,
                name: handler.name,
                extensions: handler.extensions,
                icon: handler.icon
            });
        }
        return types;
    }

    /**
     * Get file type info
     */
    getFileTypeInfo(mimeType) {
        const handler = this.handlers.get(mimeType);
        return handler ? {
            name: handler.name,
            extensions: handler.extensions,
            icon: handler.icon
        } : null;
    }
}

// Export singleton instance
export const fileTypeHandlers = new FileTypeHandlers();
export default FileTypeHandlers; 