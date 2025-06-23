# MCP Tabajara - Intelligent Assistant Application

A sophisticated, modular HTML/JavaScript application that provides a ChatGPT-like interface for interacting with MCP (Model Context Protocol) agents. Built with modern web technologies and following SOLID principles.

## 🚀 Features

### Core Functionality
- **Modern Chat Interface**: ChatGPT-inspired UI with dark theme
- **MCP Agent Integration**: Support for multiple AI agents with different capabilities
- **Persistent Storage**: Uses IndexedDB with localStorage fallback
- **File Management**: Drag & drop file uploads with File System Access API
- **Web Workers**: Parallel processing for agent requests
- **Responsive Design**: Mobile-friendly layout

### Advanced Capabilities
- **Modular Architecture**: SOLID principles with dependency injection
- **Event-Driven Communication**: Decoupled modules using EventBus
- **Configuration Management**: Centralized settings with validation
- **Error Handling**: Comprehensive error management with user feedback
- **Performance Optimization**: Lazy loading and efficient resource management

## 🏗️ Architecture

### Module Structure
```
js/
├── main.js                 # Application entry point
└── modules/
    ├── core/
    │   ├── EventBus.js     # Event-driven communication
    │   └── ConfigManager.js # Configuration management
    ├── ui/
    │   └── UIManager.js    # User interface management
    ├── chat/
    │   └── ChatManager.js  # Chat session management
    ├── agents/
    │   └── MCPAgentManager.js # MCP agent handling
    ├── storage/
    │   └── StorageManager.js # Data persistence
    └── files/
        └── FileManager.js  # File operations
```

### Design Patterns Used
- **Repository Pattern**: Data access abstraction
- **Observer Pattern**: Event-driven communication
- **Strategy Pattern**: Multiple agent types
- **Singleton Pattern**: Configuration management
- **Command Pattern**: Message processing
- **Factory Pattern**: Object creation

## 🛠️ Technology Stack

- **Frontend**: HTML5, CSS3 (Tailwind CSS), JavaScript (ES6+)
- **Storage**: IndexedDB, localStorage (fallback)
- **APIs**: File System Access API, Web Workers API
- **Icons**: Font Awesome
- **Architecture**: Modular ES6 modules

## 🚦 Getting Started

### Prerequisites
- Modern web browser with ES6+ support
- Local web server (for module imports)
- **LM Studio** (for AI responses) - [Download here](https://lmstudio.ai/)

### Installation

1. **Install and Configure LM Studio**:
   - Download and install LM Studio
   - Download a model (recommended: `google/gemma-3-4b` or similar)
   - Start the local server on port 1234 (Settings → Developer → Start Local Server)

2. **Clone or download** the project files

3. **Start a local web server** in the project directory:
   ```bash
   # Using Python
   python -m http.server 8000
   
   # Using Node.js
   npx http-server
   
   # Using PHP
   php -S localhost:8000
   ```

4. **Open your browser** and navigate to `http://localhost:8000`

### Usage

#### Basic Chat
1. Ensure LM Studio is running with a loaded model
2. Type your message in the input field
3. Press Enter or click the send button
4. The LM Studio agent will process and respond to your message in real-time

#### LM Studio Integration
- **Connection Status**: Check the status indicator in the chat header
- **Model Selection**: Different agents use different models and system prompts
- **Streaming Responses**: Real-time response generation for better UX
- **Conversation Memory**: Each chat maintains context with the AI model

#### File Operations
- **Upload Files**: Drag & drop files or click the attachment button
- **Supported Types**: Text files, images, PDFs, JSON, CSV
- **File Processing**: Automatic content analysis and extraction

#### Agent Management
- **Switch Agents**: Different agents for coding, research, general chat
- **Agent Configuration**: Customize agent parameters
- **Web Worker Processing**: Parallel request handling

#### Chat Management
- **Multiple Chats**: Create and switch between chat sessions
- **Chat History**: Persistent conversation storage
- **Export/Import**: Save conversations as JSON

## 🔧 Configuration

The application uses a centralized configuration system. Settings can be modified through the UI or programmatically:

```javascript
// Example configuration
{
  app: {
    theme: 'dark',
    language: 'en',
    debug: false
  },
  ui: {
    sidebar: { defaultCollapsed: false },
    chat: { maxHistoryItems: 100 }
  },
  agents: {
    timeout: 30000,
    retryAttempts: 3
  },
  files: {
    maxFileSize: 10485760, // 10MB
    allowedTypes: ['text/*', 'image/*', 'application/pdf']
  }
}
```

## 🎨 UI Components

### Main Layout
- **Sidebar**: Chat history and navigation
- **Chat Area**: Message display and input
- **Header**: Current chat info and controls
- **Modals**: Settings and file management

### Key Features
- **Responsive Design**: Adapts to different screen sizes
- **Keyboard Shortcuts**: Ctrl+N (new chat), Ctrl+/ (toggle sidebar)
- **Drag & Drop**: File upload support
- **Typing Indicators**: Real-time feedback
- **Notifications**: User feedback system

## 🔌 Extending the Application

### Adding New Agents
```javascript
const newAgent = {
  id: 'custom-agent',
  name: 'Custom Agent',
  type: 'custom',
  description: 'Specialized agent',
  capabilities: ['custom-task'],
  config: {
    model: 'custom-model',
    temperature: 0.5
  }
};

eventBus.emit('agent:add', newAgent);
```

### Creating Custom Modules
```javascript
class CustomModule {
  constructor(eventBus) {
    this.eventBus = eventBus;
  }
  
  async initialize() {
    this.setupEventListeners();
  }
  
  setupEventListeners() {
    this.eventBus.on('custom:event', this.handleEvent.bind(this));
  }
}
```

## 🧪 Development

### Code Quality
- **ES6+ Modules**: Modern JavaScript structure
- **SOLID Principles**: Maintainable and extensible code
- **Error Handling**: Comprehensive error management
- **Documentation**: JSDoc comments throughout

### Performance Optimizations
- **Web Workers**: CPU-intensive tasks
- **IndexedDB**: Efficient data storage
- **Event Throttling**: Smooth user interactions
- **Lazy Loading**: On-demand resource loading

## 🌐 Browser Compatibility

### Required Features
- ES6 Modules
- IndexedDB
- Web Workers
- File API

### Optional Features
- File System Access API (for enhanced file operations)
- Drag & Drop API

## 🔒 Privacy & Security

- **Local Storage**: All data stored locally in browser
- **No External Requests**: Fully client-side application
- **File Security**: Safe file processing with validation
- **XSS Protection**: Content sanitization

## 📝 API Reference

### EventBus Events
- `chat:new` - Create new chat
- `chat:message:send` - Send message
- `agent:message:process` - Process with agent
- `file:upload` - Handle file upload
- `ui:notification` - Show notification

### Storage Operations
- `create(store, data)` - Create record
- `read(store, key)` - Read record
- `update(store, data)` - Update record
- `delete(store, key)` - Delete record

## 🤝 Contributing

1. Follow the existing code structure
2. Maintain SOLID principles
3. Add comprehensive error handling
4. Document new features
5. Test across different browsers

## 📄 License

MIT License - Feel free to use and modify as needed.

## 🆘 Troubleshooting

### Common Issues
1. **Module Loading Errors**: Ensure running on local server
2. **Storage Issues**: Check browser storage permissions
3. **File Upload Failures**: Verify file types and sizes
4. **Web Worker Errors**: Check browser console for details

### Browser Console
Enable developer tools to see detailed logging and error messages. 