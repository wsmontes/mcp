# File Attachment System Documentation

## Overview

The File Attachment System provides a standardized way to handle file attachments across different LLM providers in the MCP Tabajara application. It ensures that files are properly processed, validated, and formatted according to each provider's specific requirements.

## Architecture

### Core Components

1. **FileAttachmentManager** (`js/modules/files/FileAttachmentManager.js`)
   - Central coordinator for file attachment operations
   - Manages provider-specific handlers
   - Handles validation, processing, and formatting

2. **BaseLLMClient** (`js/modules/agents/BaseLLMClient.js`)
   - Abstract base class with file attachment capabilities
   - Defines standard interface for file handling

3. **Provider-Specific Clients** (e.g., `OpenAIClient.js`)
   - Implement provider-specific file processing logic
   - Handle format conversion and validation

4. **ChatManager** (`js/modules/chat/ChatManager.js`)
   - Integrates file attachments with chat messages
   - Manages attachment lifecycle

5. **UIManager** (`js/modules/ui/UIManager.js`)
   - Provides user interface for file attachment
   - Handles drag-and-drop and file selection

## Provider Support

### OpenAI
- **Supported Types**: `text/*`, `image/*`, `application/pdf`
- **Max File Size**: 20MB
- **Max Files**: 10
- **Format**: Uses `image_url` for images, text extraction for PDFs

### Anthropic Claude
- **Supported Types**: `text/*`, `image/*`
- **Max File Size**: 10MB
- **Max Files**: 5
- **Format**: Uses base64 encoding for images

### Google Gemini
- **Supported Types**: `text/*`, `image/*`
- **Max File Size**: 20MB
- **Max Files**: 10
- **Format**: Uses `inlineData` for images

### DeepSeek
- **Supported Types**: `text/*`, `image/*`
- **Max File Size**: 10MB
- **Max Files**: 5
- **Format**: Uses `image_url` for images

### LM Studio
- **Supported Types**: `text/*`
- **Max File Size**: 5MB
- **Max Files**: 3
- **Format**: Text-only, content included in message

## Usage

### Basic File Attachment

```javascript
// Get files from input
const files = Array.from(fileInput.files);

// Process attachments for a specific provider
const result = await attachmentManager.processAttachments(files, 'openai');

// Send message with attachments
eventBus.emit('chat:message:send', {
    content: 'Please analyze these files',
    attachments: files,
    providerId: 'openai'
});
```

### File Validation

```javascript
// Validate files before processing
const validation = await attachmentManager.validateAttachments(files, 'openai');

if (validation.valid) {
    console.log('Files are valid for OpenAI');
} else {
    console.log('Validation errors:', validation.validations);
}
```

### Provider Capabilities

```javascript
// Get capabilities for a specific provider
const capabilities = attachmentManager.getProviderCapabilities('openai');

console.log('OpenAI supports:', capabilities.supportedTypes);
console.log('Max file size:', capabilities.maxFileSize);
console.log('Max files:', capabilities.maxFiles);
```

## API Reference

### FileAttachmentManager

#### Constructor
```javascript
new FileAttachmentManager(eventBus, fileManager)
```

#### Methods

##### `processAttachments(files, providerId)`
Processes files for attachment to a specific provider.

**Parameters:**
- `files` (Array): Array of File objects
- `providerId` (string): Provider identifier

**Returns:** Promise resolving to processed attachments

##### `validateAttachments(files, providerId)`
Validates files for a specific provider.

**Parameters:**
- `files` (Array): Array of File objects
- `providerId` (string): Provider identifier

**Returns:** Promise resolving to validation result

##### `formatAttachmentsForProvider(attachments, providerId)`
Formats attachments for a specific provider.

**Parameters:**
- `attachments` (Array): Processed attachments
- `providerId` (string): Provider identifier

**Returns:** Promise resolving to formatted attachments

##### `getProviderCapabilities(providerId)`
Gets capabilities for a specific provider.

**Parameters:**
- `providerId` (string): Provider identifier

**Returns:** Provider capabilities object

##### `getAllProviderCapabilities()`
Gets capabilities for all providers.

**Returns:** Object mapping provider IDs to capabilities

### BaseLLMClient

#### Abstract Methods

##### `processFileAttachments(files)`
Process file attachments for this provider.

##### `validateFileAttachments(files)`
Validate file attachments for this provider.

##### `formatMessagesWithAttachments(messages, attachments)`
Format messages with attachments for this provider.

## Event System

### Events Emitted

- `attachment:process` - Trigger file processing
- `attachment:validate` - Trigger file validation
- `attachment:format` - Trigger attachment formatting
- `attachment:clear` - Clear attachment cache
- `message:attachments:updated` - Notify when message attachments are updated
- `attachment:capabilities:loaded` - Notify when capabilities are loaded

### Event Listeners

The system listens for these events to coordinate file attachment operations across components.

## UI Integration

### HTML Structure

```html
<!-- File Attachment Container -->
<div id="attachment-container" class="mt-3">
    <div id="attachment-list" class="space-y-2">
        <!-- Attachment items will be dynamically added here -->
    </div>
    <div id="attachment-info" class="text-center text-sm text-chat-secondary">
        <!-- Attachment info will be displayed here -->
    </div>
    <div class="flex justify-between items-center mt-2">
        <button id="attachment-remove-btn" class="text-xs text-chat-error hover:text-red-400 transition-colors">
            Remove All
        </button>
        <div id="attachment-preview" class="max-w-xs">
            <!-- Image preview will be shown here -->
        </div>
    </div>
</div>
```

### CSS Classes

- `.attachment-item` - Individual attachment display
- `.attachment-icon` - File type icon
- `.attachment-details` - File name and size
- `.attachment-remove` - Remove button
- `.message-attachment` - Attachment in message display
- `.attachment-loading` - Loading state
- `.attachment-error` - Error state
- `.attachment-success` - Success state

## Extending the System

### Adding a New Provider

1. **Update BaseLLMClient capabilities:**
```javascript
this.updateCapabilities({
    // ... existing capabilities
    fileAttachments: true,
    maxFileSize: 10 * 1024 * 1024,
    maxFiles: 5,
    supportedFileTypes: ['text/*', 'image/*']
});
```

2. **Implement file attachment methods:**
```javascript
async processFileAttachments(files) {
    // Provider-specific file processing
}

async validateFileAttachments(files) {
    // Provider-specific validation
}

formatMessagesWithAttachments(messages, attachments) {
    // Provider-specific formatting
}
```

3. **Register provider handler in FileAttachmentManager:**
```javascript
this.registerProviderHandler('newprovider', {
    name: 'New Provider',
    supportedTypes: ['text/*', 'image/*'],
    maxFileSize: 10 * 1024 * 1024,
    maxFiles: 5,
    processFile: this.processFileForNewProvider.bind(this),
    formatAttachment: this.formatAttachmentForNewProvider.bind(this),
    validateAttachment: this.validateAttachmentForNewProvider.bind(this)
});
```

### Adding New File Types

1. **Update FileTypeHandlers:**
```javascript
this.registerHandler('application/newtype', {
    name: 'New File Type',
    extensions: ['.new'],
    icon: '📄',
    processor: this.processNewTypeFile.bind(this),
    validator: this.validateNewTypeFile.bind(this)
});
```

2. **Update provider capabilities** to include the new MIME type.

## Testing

### Test File
Use `test-file-attachments.html` to test the file attachment system:

1. **Attachment Manager Test** - Verifies initialization
2. **Provider Capabilities Test** - Checks provider support
3. **File Validation Test** - Tests file validation
4. **File Processing Test** - Tests file processing
5. **UI Integration Test** - Tests UI components

### Manual Testing

1. Open the main application
2. Click the attachment button (📎)
3. Select files to attach
4. Verify preview and validation
5. Send message with attachments
6. Check that attachments are processed correctly

## Error Handling

### Common Errors

- **File too large** - Exceeds provider's max file size
- **Unsupported file type** - File type not supported by provider
- **Too many files** - Exceeds provider's max file count
- **Processing failed** - Error during file processing

### Error Recovery

- Invalid files are automatically filtered out
- Processing errors are logged and displayed to user
- Fallback to text-only mode for unsupported providers

## Performance Considerations

### File Size Limits
- Total attachment size limited to 50MB per message
- Individual file size limits per provider
- Automatic compression for large images (future enhancement)

### Processing Optimization
- Files are processed asynchronously
- Progress indicators for large files
- Caching of processed attachments

### Memory Management
- Attachments are cleared after message processing
- Large files are processed in chunks
- Automatic cleanup of temporary data

## Security Considerations

### File Validation
- MIME type verification
- File size limits
- Extension validation
- Content scanning (future enhancement)

### Data Privacy
- Files are processed locally when possible
- No permanent storage of file contents
- Secure transmission to providers

## Future Enhancements

### Planned Features
- **File compression** - Automatic compression for large files
- **Batch processing** - Process multiple files simultaneously
- **Progress tracking** - Real-time upload progress
- **File preview** - Enhanced preview for various file types
- **Drag and drop** - Improved drag and drop interface

### Potential Improvements
- **OCR support** - Extract text from images
- **PDF parsing** - Better PDF text extraction
- **File conversion** - Convert unsupported formats
- **Cloud storage** - Integration with cloud storage providers

## Troubleshooting

### Common Issues

1. **Files not attaching**
   - Check file size and type
   - Verify provider capabilities
   - Check browser console for errors

2. **Processing errors**
   - Ensure files are valid
   - Check network connection
   - Verify provider configuration

3. **UI not updating**
   - Check event listeners
   - Verify DOM elements exist
   - Check CSS styles

### Debug Mode

Enable debug mode to see detailed logs:

```javascript
// In browser console
localStorage.setItem('debug', 'true');
```

This will show detailed information about file processing, validation, and formatting operations. 