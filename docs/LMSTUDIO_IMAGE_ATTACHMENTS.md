# LM Studio Image Attachments

This document explains how to use image attachments with LM Studio vision models in the MCP Tabajara application.

## Prerequisites

### 1. LM Studio Setup
- **LM Studio Version**: v0.3.13+ (required for vision support)
- **llama.cpp Version**: v1.19+ (bundled with LM Studio)
- **Model**: Vision-enabled model like Gemma 3 4B (must include `mmproj` file)

### 2. Model Requirements
- Use a vision-enabled GGUF model (e.g., "Gemma 3 4B image-text to text")
- Ensure the model folder contains the `mmproj` file for vision processing
- Model should support the `images` field in chat completions

### 3. Server Setup
- Start LM Studio server: `lms server start` or use Developer → "Run as server"
- Server runs on `localhost:1234` by default
- API endpoint: `http://localhost:1234/v1/chat/completions`

## Implementation Details

### File Processing
The system processes images in the following way:

1. **Image Detection**: Files with MIME type starting with `image/` are processed as images
2. **Base64 Encoding**: Images are converted to base64 data URLs for browser compatibility
3. **Metadata**: Each image includes MIME type and size information

### Message Formatting
For LM Studio vision API, messages are formatted as:

```javascript
{
  "role": "user",
  "content": "Your text prompt here",
  "images": [
    {
      "data": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQ...",
      "mime_type": "image/jpeg"
    }
  ]
}
```

### API Request Structure
```javascript
{
  "model": "google/gemma-3-4b",
  "messages": [
    {
      "role": "user",
      "content": [
        {
          "type": "image_url",
          "image_url": {
            "url": "data:image/jpeg;base64,iVBORw0KGgoAAAANSUhEUgAA..."
          }
        },
        {
          "type": "text",
          "text": "What do you see in this image?"
        }
      ]
    }
  ],
  "temperature": 0.7,
  "max_tokens": 1000
}
```

## Usage

### 1. Testing
Use the test page: `test-file-attachments.html`

1. Navigate to "LM Studio Image Attachment Test" section
2. Select image files (JPEG, PNG, WebP supported)
3. Enter a prompt for the vision model
4. Click "Test LM Studio Vision"

### 2. Programmatic Usage

```javascript
import { FileAttachmentManager } from './js/modules/files/FileAttachmentManager.js';
import { LMStudioClient } from './js/modules/agents/LMStudioClient.js';

// Initialize components
const attachmentManager = new FileAttachmentManager(eventBus, fileManager);
const lmstudioClient = new LMStudioClient({
    baseUrl: 'http://localhost:1234',
    defaultModel: 'google/gemma-3-4b'
});

// Process image attachments
const files = [/* File objects */];
const processedAttachments = await attachmentManager.processAttachments(files, 'lmstudio');

// Format messages with attachments
const messages = [{ role: 'user', content: 'Describe this image' }];
const formattedMessages = lmstudioClient.formatMessagesWithAttachments(messages, processedAttachments.attachments);

// Send to LM Studio
const response = await lmstudioClient.createChatCompletion(formattedMessages);
```

## Supported File Types

### Images
- **JPEG** (`image/jpeg`)
- **PNG** (`image/png`)
- **WebP** (`image/webp`)
- **GIF** (`image/gif`)
- **BMP** (`image/bmp`)

### Text Files
- **Plain Text** (`text/plain`)
- **Markdown** (`text/markdown`)
- **JSON** (`application/json`)
- **CSV** (`text/csv`)

## Limitations

### File Size
- **Maximum file size**: 10MB per file
- **Total attachment size**: 50MB per message
- **Maximum files**: 5 files per message

### Browser Limitations
- Images are processed in the browser using base64 encoding
- Large images may impact performance
- No server-side file storage (all processing is client-side)

## Troubleshooting

### Common Issues

1. **Connection Failed**
   - Ensure LM Studio server is running on `localhost:1234`
   - Check firewall settings
   - Verify LM Studio version is v0.3.13+

2. **Model Not Found**
   - Load a vision-enabled model in LM Studio
   - Ensure model has `mmproj` file
   - Check model name in client configuration

3. **Vision Not Working**
   - Verify model supports vision (Gemma 3 4B, etc.)
   - Check for `<unused32>` responses (indicates vision processing issues)
   - Try disabling system prompts
   - Reload model in LM Studio

4. **File Processing Errors**
   - Check file size limits
   - Verify supported file types
   - Ensure files are valid images

### Debug Information
Enable console logging to see detailed processing information:

```javascript
// Check attachment processing
console.log('Processed attachments:', processedAttachments);

// Check message formatting
console.log('Formatted messages:', formattedMessages);

// Check API request
console.log('Request body:', requestBody);
```

## API Reference

### FileAttachmentManager
- `processAttachments(files, 'lmstudio')` - Process files for LM Studio
- `validateAttachments(files, 'lmstudio')` - Validate files for LM Studio

### LMStudioClient
- `formatMessagesWithAttachments(messages, attachments)` - Format messages with images
- `processFileAttachments(files)` - Process files directly
- `createChatCompletion(messages, options)` - Send chat completion request

## Examples

### Single Image
```javascript
const files = [imageFile];
const processed = await attachmentManager.processAttachments(files, 'lmstudio');
const messages = [{ role: 'user', content: 'What is this?' }];
const formatted = lmstudioClient.formatMessagesWithAttachments(messages, processed.attachments);
```

### Multiple Images
```javascript
const files = [image1, image2, image3];
const processed = await attachmentManager.processAttachments(files, 'lmstudio');
const messages = [{ role: 'user', content: 'Compare these images' }];
const formatted = lmstudioClient.formatMessagesWithAttachments(messages, processed.attachments);
```

### Mixed Content
```javascript
const files = [imageFile, textFile];
const processed = await attachmentManager.processAttachments(files, 'lmstudio');
const messages = [{ role: 'user', content: 'Analyze the image and text' }];
const formatted = lmstudioClient.formatMessagesWithAttachments(messages, processed.attachments);
```

## Future Enhancements

- Server-side file processing for better performance
- Support for more image formats
- Streaming image processing
- Image preprocessing (resize, compress)
- Batch processing capabilities 

## API Structure

Gemma 3 4B uses a specific format for vision-enabled models. Images and text are included in a `content` array within user messages:

```javascript
{
  "model": "google/gemma-3-4b",
  "messages": [
    {
      "role": "user",
      "content": [
        {
          "type": "image_url",
          "image_url": {
            "url": "data:image/jpeg;base64,iVBORw0KGgoAAAANSUhEUgAA..."
          }
        },
        {
          "type": "text",
          "text": "What do you see in this image?"
        }
      ]
    }
  ],
  "temperature": 0.7,
  "max_tokens": 1000
}
```

### Content Array Format

Gemma 3 uses a content array where each item has:
- **`type`**: Either `"text"` or `"image_url"`
- **`image_url`**: For images, an object with a `url` field containing the data URL
- **`text`**: For text content, the actual text string

### Example from Gemma 3 Documentation

```javascript
messages = [
    {
        "role": "user",
        "content": [
            {"type": "image_url", "image_url": {"url": "https://storage.googleapis.com/keras-cv/models/paligemma/cow_beach_1.png"}},
            {"type": "text", "text": "What you can see in this image?"}
        ]
    }
]
```

The MCP Tabajara implementation converts uploaded images to base64 data URLs for browser compatibility. 