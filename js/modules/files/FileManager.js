/**
 * File Manager - Handles file operations, uploads, and processing
 * Implements File System Access API with fallback support
 */
export class FileManager {
    constructor(eventBus) {
        this.eventBus = eventBus;
        this.uploadedFiles = new Map();
        this.fileSystemSupported = this.checkFileSystemSupport();
        this.maxFileSize = 10 * 1024 * 1024; // 10MB default
        this.allowedTypes = [
            'text/*',
            'image/*',
            'application/pdf',
            'application/json',
            'application/xml',
            'application/csv'
        ];
    }

    async initialize() {
        this.setupEventListeners();
        this.setupDragAndDrop();
        console.log('📁 File Manager initialized');
    }

    /**
     * Check if File System Access API is supported
     */
    checkFileSystemSupport() {
        return 'showOpenFilePicker' in window;
    }

    /**
     * Set up event listeners
     */
    setupEventListeners() {
        this.eventBus.on('file:upload', async (files) => {
            await this.handleFileUpload(files);
        });

        this.eventBus.on('file:select', async () => {
            await this.selectFiles();
        });

        this.eventBus.on('file:save', async (data) => {
            await this.saveFile(data);
        });

        this.eventBus.on('file:delete', async (fileId) => {
            await this.deleteFile(fileId);
        });

        this.eventBus.on('file:process', async (fileId) => {
            await this.processFile(fileId);
        });
    }

    /**
     * Set up drag and drop functionality
     */
    setupDragAndDrop() {
        const dropZone = document.getElementById('chat-container');
        if (!dropZone) return;

        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('drag-over');
        });

        dropZone.addEventListener('dragleave', (e) => {
            e.preventDefault();
            dropZone.classList.remove('drag-over');
        });

        dropZone.addEventListener('drop', async (e) => {
            e.preventDefault();
            dropZone.classList.remove('drag-over');
            
            const files = Array.from(e.dataTransfer.files);
            if (files.length > 0) {
                await this.handleFileUpload(files);
            }
        });
    }

    /**
     * Handle file upload
     */
    async handleFileUpload(files) {
        try {
            const validFiles = this.validateFiles(files);
            const uploadPromises = validFiles.map(file => this.uploadFile(file));
            const results = await Promise.allSettled(uploadPromises);
            
            const successful = results.filter(r => r.status === 'fulfilled').map(r => r.value);
            const failed = results.filter(r => r.status === 'rejected').map(r => r.reason);
            
            if (successful.length > 0) {
                this.eventBus.emit('ui:notification', {
                    message: `Successfully uploaded ${successful.length} file(s)`,
                    type: 'success'
                });
                
                this.eventBus.emit('files:uploaded', successful);
            }
            
            if (failed.length > 0) {
                console.error('File upload failures:', failed);
                this.eventBus.emit('ui:notification', {
                    message: `Failed to upload ${failed.length} file(s)`,
                    type: 'error'
                });
            }
            
        } catch (error) {
            console.error('File upload error:', error);
            this.eventBus.emit('ui:error', { message: 'File upload failed' });
        }
    }

    /**
     * Validate uploaded files
     */
    validateFiles(files) {
        const validFiles = [];
        
        for (const file of files) {
            // Check file size
            if (file.size > this.maxFileSize) {
                this.eventBus.emit('ui:notification', {
                    message: `File ${file.name} is too large (max ${this.maxFileSize / 1024 / 1024}MB)`,
                    type: 'warning'
                });
                continue;
            }
            
            // Check file type
            const isValidType = this.allowedTypes.some(type => {
                if (type.endsWith('/*')) {
                    return file.type.startsWith(type.slice(0, -2));
                }
                return file.type === type;
            });
            
            if (!isValidType) {
                this.eventBus.emit('ui:notification', {
                    message: `File type ${file.type} not supported`,
                    type: 'warning'
                });
                continue;
            }
            
            validFiles.push(file);
        }
        
        return validFiles;
    }

    /**
     * Upload a single file
     */
    async uploadFile(file) {
        const fileId = this.generateFileId();
        const fileInfo = {
            id: fileId,
            name: file.name,
            type: file.type,
            size: file.size,
            uploadedAt: new Date().toISOString(),
            status: 'uploading'
        };
        
        try {
            // Read file content
            const content = await this.readFileContent(file);
            
            fileInfo.content = content;
            fileInfo.status = 'uploaded';
            
            // Store file info
            this.uploadedFiles.set(fileId, fileInfo);
            
            // Process file based on type
            await this.processFileContent(fileInfo);
            
            return fileInfo;
            
        } catch (error) {
            fileInfo.status = 'error';
            fileInfo.error = error.message;
            throw error;
        }
    }

    /**
     * Read file content based on type
     */
    async readFileContent(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (e) => {
                resolve(e.target.result);
            };
            
            reader.onerror = (e) => {
                reject(new Error('Failed to read file'));
            };
            
            // Read based on file type
            if (file.type.startsWith('text/') || 
                file.type === 'application/json' || 
                file.type === 'application/xml') {
                reader.readAsText(file);
            } else if (file.type.startsWith('image/')) {
                reader.readAsDataURL(file);
            } else {
                reader.readAsArrayBuffer(file);
            }
        });
    }

    /**
     * Process file content based on type
     */
    async processFileContent(fileInfo) {
        try {
            let processedContent = null;
            
            switch (true) {
                case fileInfo.type === 'application/json':
                    processedContent = this.processJSON(fileInfo.content);
                    break;
                    
                case fileInfo.type === 'text/csv':
                    processedContent = this.processCSV(fileInfo.content);
                    break;
                    
                case fileInfo.type.startsWith('text/'):
                    processedContent = this.processText(fileInfo.content);
                    break;
                    
                case fileInfo.type.startsWith('image/'):
                    processedContent = this.processImage(fileInfo.content);
                    break;
                    
                case fileInfo.type === 'application/pdf':
                    processedContent = await this.processPDF(fileInfo.content);
                    break;
                    
                default:
                    processedContent = { type: 'binary', size: fileInfo.size };
            }
            
            fileInfo.processed = processedContent;
            fileInfo.status = 'processed';
            
            this.eventBus.emit('file:processed', fileInfo);
            
        } catch (error) {
            console.error('File processing error:', error);
            fileInfo.status = 'process_error';
            fileInfo.error = error.message;
        }
    }

    /**
     * Process JSON files
     */
    processJSON(content) {
        try {
            const data = JSON.parse(content);
            return {
                type: 'json',
                data: data,
                keys: Object.keys(data),
                summary: `JSON object with ${Object.keys(data).length} properties`
            };
        } catch (error) {
            throw new Error('Invalid JSON format');
        }
    }

    /**
     * Process CSV files
     */
    processCSV(content) {
        const lines = content.split('\n');
        const headers = lines[0].split(',').map(h => h.trim());
        const rows = lines.slice(1)
            .filter(line => line.trim())
            .map(line => line.split(',').map(cell => cell.trim()));
        
        return {
            type: 'csv',
            headers: headers,
            rows: rows,
            summary: `CSV with ${headers.length} columns and ${rows.length} rows`
        };
    }

    /**
     * Process text files
     */
    processText(content) {
        const wordCount = content.split(/\s+/).length;
        const lineCount = content.split('\n').length;
        
        return {
            type: 'text',
            content: content,
            wordCount: wordCount,
            lineCount: lineCount,
            summary: `Text file with ${wordCount} words and ${lineCount} lines`
        };
    }

    /**
     * Process image files
     */
    processImage(dataUrl) {
        return {
            type: 'image',
            dataUrl: dataUrl,
            summary: 'Image file uploaded'
        };
    }

    /**
     * Process PDF files (basic implementation)
     */
    async processPDF(arrayBuffer) {
        // This is a basic implementation
        // In a real scenario, you would use a PDF parsing library like PDF.js
        return {
            type: 'pdf',
            size: arrayBuffer.byteLength,
            summary: 'PDF document uploaded'
        };
    }

    /**
     * Select files using File System Access API or fallback
     */
    async selectFiles() {
        if (this.fileSystemSupported) {
            try {
                const fileHandles = await window.showOpenFilePicker({
                    multiple: true,
                    types: [
                        {
                            description: 'Supported files',
                            accept: {
                                'text/*': ['.txt', '.md', '.json', '.csv', '.xml'],
                                'image/*': ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
                                'application/pdf': ['.pdf']
                            }
                        }
                    ]
                });
                
                const files = await Promise.all(
                    fileHandles.map(handle => handle.getFile())
                );
                
                await this.handleFileUpload(files);
                
            } catch (error) {
                if (error.name !== 'AbortError') {
                    console.error('File selection error:', error);
                }
            }
        } else {
            // Fallback to traditional file input
            const input = document.getElementById('file-input');
            if (input) {
                input.click();
            }
        }
    }

    /**
     * Save file using File System Access API or download
     */
    async saveFile(data) {
        const { filename, content, type = 'text/plain' } = data;
        
        if (this.fileSystemSupported) {
            try {
                const fileHandle = await window.showSaveFilePicker({
                    suggestedName: filename,
                    types: [
                        {
                            description: 'Text files',
                            accept: { 'text/plain': ['.txt'] }
                        }
                    ]
                });
                
                const writable = await fileHandle.createWritable();
                await writable.write(content);
                await writable.close();
                
                this.eventBus.emit('ui:notification', {
                    message: `File saved as ${filename}`,
                    type: 'success'
                });
                
            } catch (error) {
                if (error.name !== 'AbortError') {
                    console.error('File save error:', error);
                    this.fallbackDownload(filename, content, type);
                }
            }
        } else {
            this.fallbackDownload(filename, content, type);
        }
    }

    /**
     * Fallback download method
     */
    fallbackDownload(filename, content, type) {
        const blob = new Blob([content], { type });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        
        URL.revokeObjectURL(url);
    }

    /**
     * Delete a file
     */
    async deleteFile(fileId) {
        try {
            if (this.uploadedFiles.has(fileId)) {
                this.uploadedFiles.delete(fileId);
                this.eventBus.emit('file:deleted', fileId);
                this.eventBus.emit('ui:notification', {
                    message: 'File deleted successfully',
                    type: 'success'
                });
            }
        } catch (error) {
            console.error('File deletion error:', error);
            this.eventBus.emit('ui:error', { message: 'Failed to delete file' });
        }
    }

    /**
     * Get file information
     */
    getFile(fileId) {
        return this.uploadedFiles.get(fileId);
    }

    /**
     * Get all uploaded files
     */
    getAllFiles() {
        return Array.from(this.uploadedFiles.values());
    }

    /**
     * Generate unique file ID
     */
    generateFileId() {
        return 'file_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    /**
     * Update file configuration
     */
    updateConfig(config) {
        if (config.maxFileSize) {
            this.maxFileSize = config.maxFileSize;
        }
        
        if (config.allowedTypes) {
            this.allowedTypes = config.allowedTypes;
        }
    }

    /**
     * Clear all uploaded files
     */
    clearAllFiles() {
        this.uploadedFiles.clear();
        this.eventBus.emit('files:cleared');
    }

    /**
     * Get file statistics
     */
    getStats() {
        const files = Array.from(this.uploadedFiles.values());
        const totalSize = files.reduce((sum, file) => sum + file.size, 0);
        const typeCount = {};
        
        files.forEach(file => {
            const mainType = file.type.split('/')[0];
            typeCount[mainType] = (typeCount[mainType] || 0) + 1;
        });
        
        return {
            totalFiles: files.length,
            totalSize: totalSize,
            typeBreakdown: typeCount,
            averageSize: files.length > 0 ? totalSize / files.length : 0
        };
    }

    /**
     * Cleanup resources
     */
    cleanup() {
        this.uploadedFiles.clear();
    }
} 