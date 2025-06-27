# MCP Tabajara - Intelligent Assistant

A modern, multi-provider AI chat interface that supports OpenAI, Anthropic Claude, DeepSeek, and LM Studio with advanced features like file handling, voice input, and conversation management.

## Features

- **Multi-Provider Support**: Connect to OpenAI, Anthropic Claude, DeepSeek, and LM Studio
- **File Upload & Analysis**: Upload and analyze various file types
- **Voice Input**: Speech-to-text functionality
- **Conversation Mode**: Continuous conversation with context preservation
- **Modern UI**: Clean, responsive interface with dark theme
- **Code Highlighting**: Syntax highlighting for code blocks
- **Chat History**: Persistent conversation history
- **Settings Management**: Easy configuration and API key management

## Quick Start

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd mcp-tabajara
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure API Keys**
   - Open the application in your browser
   - Click the settings icon (gear) in the sidebar
   - Add your API keys for the providers you want to use

4. **Start the development server**
   ```bash
   npm run dev
   ```
   This will start the Vite development server at `http://localhost:3000`

5. **Build for production**
   ```bash
   npm run build
   ```
   This creates optimized files in the `dist/` folder

6. **Start the proxy server (optional)**
   ```bash
   npm run proxy
   ```
   This starts the CORS proxy server for API requests

## Development

- **Development server**: `npm run dev` - Starts Vite dev server with hot reload
- **Build**: `npm run build` - Creates production build
- **Preview**: `npm run preview` - Preview production build locally
- **Proxy server**: `npm run proxy` - Start CORS proxy server
- **Proxy dev**: `npm run proxy:dev` - Start proxy server with auto-restart

## Technology Stack

- **Frontend**: Vanilla JavaScript with ES6 modules
- **Build Tool**: Vite for fast development and optimized builds
- **Styling**: Tailwind CSS with custom design system
- **Backend**: Express.js proxy server for CORS handling
- **Syntax Highlighting**: Prism.js
- **Icons**: Font Awesome

## Documentation

All detailed documentation is available in the `docs/` folder:

- [Architecture Overview](docs/AGNOSTIC_ARCHITECTURE.md)
- [OpenAI Integration](docs/OPENAI_INTEGRATION.md)
- [Anthropic Integration](docs/ANTHROPIC_INTEGRATION.md)
- [DeepSeek Integration](docs/DEEPSEEK_REASONING_INTEGRATION.md)
- [Proxy Server Setup](docs/PROXY_SERVER_SETUP.md)
- [Conversation Mode](docs/CONVERSATION_MODE.md)
- [Testing Checklist](docs/TESTING_CHECKLIST.md)

## Supported Providers

- **OpenAI**: GPT-3.5, GPT-4, and other OpenAI models
- **Anthropic**: Claude 3.5 Sonnet, Claude 3 Opus, and other Claude models
- **DeepSeek**: DeepSeek models with reasoning capabilities
- **LM Studio**: Local models via LM Studio

## File Support

The application supports various file types for analysis:
- Text files (.txt, .md, .json, etc.)
- Code files (.js, .py, .java, .cpp, etc.)
- Documents (.pdf, .docx, etc.)
- Images (with OCR capabilities)

## Browser Compatibility

- Chrome/Chromium (recommended)
- Firefox
- Safari
- Edge

## License

This project is open source and available under the MIT License.

## Contributing

Contributions are welcome! Please read the documentation in the `docs/` folder for development guidelines. 