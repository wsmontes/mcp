# MCP Tabajara - Phase 1 & 2 Testing Checklist

## Phase 1: Essential UI/UX Features ✅

### 1.1 Agent Management UI
- [ ] **Agent Selector Dropdown**: Click agent selector in chat header
  - Should show list of available agents
  - Should allow switching between agents
  - Should update current agent info display
  
- [ ] **Current Model Display**: Check chat header
  - Should show current model name
  - Should show temperature setting
  - Should update when agent changes

- [ ] **Agent Status Indicators**: Check status display
  - Should show connection status (green/red dot)
  - Should show "LM Studio Ready" or error message
  - Should update dynamically based on connection

### 1.2 Message Management
- [ ] **Copy Message**: Hover over AI message, click copy button
  - Should copy message content to clipboard
  - Should show notification "Message copied to clipboard"
  
- [ ] **Edit User Messages**: Hover over user message, click edit button
  - Should make message editable
  - Should save changes on Enter key
  - Should update message in chat history
  
- [ ] **Regenerate AI Messages**: Hover over AI message, click regenerate button
  - Should send same prompt again
  - Should replace old response with new one
  - Should maintain conversation context
  
- [ ] **Delete Messages**: Hover over any message, click delete button
  - Should show confirmation dialog
  - Should remove message from chat
  - Should update conversation history

- [ ] **Message Action Buttons**: Hover over messages
  - Should show action buttons on hover
  - Should hide when not hovering
  - Should have smooth transitions

### 1.3 Enhanced Formatting
- [ ] **Syntax Highlighting**: Send code in messages
  - Should highlight JavaScript, Python, HTML, CSS
  - Should detect language automatically
  - Should use Prism.js for highlighting
  
- [ ] **Markdown Support**: Send markdown text
  - Should render **bold**, *italic* text
  - Should render `inline code`
  - Should render links as clickable
  - Should render lists and tables
  
- [ ] **Code Blocks**: Send ```language code blocks
  - Should render with proper syntax highlighting
  - Should show language label
  - Should be properly formatted

### 1.4 File Attachment System
- [ ] **Attachment Button**: Click + button in input area
  - Should open attachment modal
  - Should show file type categories
  - Should allow file selection by type
  
- [ ] **File Upload**: Select and upload files
  - Should process different file types
  - Should show file size and type
  - Should display in chat as file message
  - Should show upload notifications

### 1.5 Voice Input
- [ ] **Voice Button**: Click microphone button
  - Should start voice recognition
  - Should show "Listening..." notification
  - Should transcribe speech to text
  - Should update input field with transcript
  - Should handle errors gracefully

### 1.6 More Options Menu
- [ ] **More Options Button**: Click three dots button
  - Should open options menu
  - Should show export, clear, fullscreen options
  - Should show keyboard shortcuts
  
- [ ] **Export Chat**: Click export option
  - Should download chat as JSON file
  - Should include all messages and metadata
  
- [ ] **Clear Chat**: Click clear option
  - Should show confirmation
  - Should clear all messages
  
- [ ] **Fullscreen Toggle**: Click fullscreen option
  - Should toggle fullscreen mode
  - Should hide/show browser UI

## Phase 2: Agent & Model Management ✅

### 2.1 Dynamic Agent Configuration
- [ ] **Settings Modal**: Click settings button
  - Should open comprehensive settings modal
  - Should have multiple tabs/sections
  - Should show current configuration
  
- [ ] **Agent Manager Button**: In settings, click "Agent Manager"
  - Should open agent management interface
  - Should show list of current agents
  - Should show agent templates
  
- [ ] **Agent Templates**: In agent manager
  - Should show 6 pre-built templates:
    - General Assistant
    - Code Expert  
    - Research Analyst
    - Creative Writer
    - Educator
    - Data Analyst
  - Should allow creating agents from templates

### 2.2 Agent Editor
- [ ] **Create New Agent**: Click "Create New Agent"
  - Should open agent editor modal
  - Should have empty form fields
  - Should allow setting all agent properties
  
- [ ] **Edit Existing Agent**: Click edit button on agent
  - Should pre-populate form with agent data
  - Should allow modifying all properties
  - Should save changes properly
  
- [ ] **Agent Editor Fields**: Check all form fields
  - Agent Name (required)
  - Description
  - Model selection dropdown
  - Temperature slider (0.0-2.0)
  - Max Tokens input
  - System Prompt textarea
  - Capabilities checkboxes

### 2.3 Model Management  
- [ ] **Model Detection**: Check model dropdown
  - Should load models from LM Studio automatically
  - Should show available models in dropdown
  - Should update when LM Studio models change
  
- [ ] **Model Selection**: Select different models
  - Should update agent configuration
  - Should persist model choice
  - Should show model in UI

### 2.4 Import/Export Functionality
- [ ] **Export Agents**: Click "Export Agents"
  - Should download JSON file with all agents
  - Should include complete agent configurations
  - Should be properly formatted
  
- [ ] **Import Agents**: Click "Import Agents"
  - Should open file selection dialog
  - Should accept JSON files
  - Should validate agent data
  - Should merge with existing agents
  - Should show success/error messages

### 2.5 Performance Metrics
- [ ] **Metrics Display**: Check settings modal
  - Should show performance metrics section
  - Should display average response time
  - Should show total requests count
  - Should show success rate percentage
  - Should update in real-time

### 2.6 Settings Persistence
- [ ] **Save Settings**: Modify settings and save
  - Should persist to localStorage
  - Should apply changes immediately
  - Should show success notification
  
- [ ] **Load Settings**: Refresh page
  - Should restore all saved settings
  - Should apply to UI components
  - Should maintain agent configurations

## Critical Integration Tests

### End-to-End Workflows
- [ ] **Complete Agent Workflow**:
  1. Create new agent from template
  2. Customize configuration
  3. Save agent
  4. Switch to new agent
  5. Send message and get response
  6. Use message management features
  7. Export agent configuration

- [ ] **File + Voice + Chat Workflow**:
  1. Upload a file via attachment
  2. Use voice input to ask about file
  3. Get AI response
  4. Edit the voice message
  5. Regenerate AI response
  6. Copy final response

- [ ] **Settings Persistence Workflow**:
  1. Change multiple settings
  2. Create custom agent
  3. Refresh browser
  4. Verify all settings restored
  5. Verify custom agent still exists

## Browser Compatibility Tests
- [ ] **Chrome/Chromium**: Test all features
- [ ] **Firefox**: Test all features  
- [ ] **Safari**: Test all features
- [ ] **Mobile**: Test responsive design

## Error Handling Tests
- [ ] **LM Studio Disconnected**: Stop LM Studio, test error handling
- [ ] **Invalid File Upload**: Try uploading unsupported files
- [ ] **Network Errors**: Test with poor connection
- [ ] **Storage Limits**: Test with full localStorage

## Performance Tests
- [ ] **Large Chat History**: Test with 100+ messages
- [ ] **Multiple File Uploads**: Upload multiple large files
- [ ] **Rapid Agent Switching**: Quickly switch between agents
- [ ] **Long Running Conversations**: Test memory usage over time

---

## Status Summary

### ✅ Confirmed Working
- Method binding issues resolved
- Event listeners properly attached
- All Phase 1 & 2 methods implemented
- Comprehensive error handling
- Settings persistence system
- Agent management system

### ⚠️ Needs Testing
- File upload functionality
- Voice input on different browsers
- Import/export features
- Performance under load
- Mobile responsiveness

### 🔧 Known Issues
- LM Studio model loading errors (system resource limits)
- Tailwind CDN warning (development only)

---

**Testing Instructions:**
1. Start HTTP server: `python -m http.server 8001`
2. Open browser: `http://localhost:8001`  
3. Start LM Studio with a smaller model (3B-7B parameters)
4. Work through checklist systematically
5. Report any issues found

**Priority Testing Order:**
1. Phase 1 core features (message management, UI interactions)
2. Phase 2 agent management (create, edit, import/export)
3. Integration workflows (end-to-end scenarios)
4. Error handling and edge cases 