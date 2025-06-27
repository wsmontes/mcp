/**
 * UI Manager - Handles all user interface interactions and DOM manipulations
 * Implements the View layer in MVP pattern
 * Version: 3.0 - Added hands-free conversation mode with voice recognition and speech synthesis
 */
export class UIManager {
    constructor(eventBus) {
        this.eventBus = eventBus;
        this.elements = {};
        this.currentChatId = null;
        this.sidebarCollapsed = false;
        this.isTyping = false;
        
        // Auto-scroll settings
        this.autoScroll = true;
        this.scrollBehavior = 'smooth';
        
        // Animation and interaction states
        this.animationQueue = [];
        this.isAnimating = false;
        
        // Voice conversation mode
        this.conversationMode = false;
        this.isListening = false;
        this.isSpeaking = false;
        this.recognition = null;
        this.speechSynthesis = window.speechSynthesis;
        this.currentUtterance = null;
        this.voiceSettings = {
            rate: 1.0,
            pitch: 1.0,
            volume: 0.8,
            voice: null,
            removeEmojis: true // Remove emojis from speech by default
        };
        this.silenceTimer = null;
        this.silenceThreshold = 2000; // 2 seconds of silence before processing
        this.conversationActive = false;

        // Language detection and multilingual support
        this.languageSettings = {
            currentLanguage: 'en',
            speechInputLanguage: 'en', // Language for speech recognition (manual selection only)
            speechOutputLanguage: 'en', // Language for AI response speech (manual selection only)
            preferredVoice: null, // User's preferred voice (overrides auto-selection)
            voicesByLanguage: new Map(),
            supportedLanguages: new Map([
                ['en', { name: 'English', speechLang: 'en-US', fallbacks: ['en-GB', 'en-AU'] }],
                ['es', { name: 'Spanish', speechLang: 'es-ES', fallbacks: ['es-MX', 'es-AR'] }],
                ['fr', { name: 'French', speechLang: 'fr-FR', fallbacks: ['fr-CA'] }],
                ['de', { name: 'German', speechLang: 'de-DE', fallbacks: ['de-AT'] }],
                ['it', { name: 'Italian', speechLang: 'it-IT', fallbacks: [] }],
                ['pt', { name: 'Portuguese', speechLang: 'pt-BR', fallbacks: ['pt-PT'] }],
                ['ru', { name: 'Russian', speechLang: 'ru-RU', fallbacks: [] }],
                ['ja', { name: 'Japanese', speechLang: 'ja-JP', fallbacks: [] }],
                ['ko', { name: 'Korean', speechLang: 'ko-KR', fallbacks: [] }],
                ['zh', { name: 'Chinese', speechLang: 'zh-CN', fallbacks: ['zh-TW', 'zh-HK'] }],
                ['ar', { name: 'Arabic', speechLang: 'ar-SA', fallbacks: ['ar-EG'] }],
                ['hi', { name: 'Hindi', speechLang: 'hi-IN', fallbacks: [] }],
                ['nl', { name: 'Dutch', speechLang: 'nl-NL', fallbacks: ['nl-BE'] }],
                ['sv', { name: 'Swedish', speechLang: 'sv-SE', fallbacks: [] }],
                ['no', { name: 'Norwegian', speechLang: 'nb-NO', fallbacks: [] }],
                ['da', { name: 'Danish', speechLang: 'da-DK', fallbacks: [] }],
                ['fi', { name: 'Finnish', speechLang: 'fi-FI', fallbacks: [] }],
                ['pl', { name: 'Polish', speechLang: 'pl-PL', fallbacks: [] }],
                ['tr', { name: 'Turkish', speechLang: 'tr-TR', fallbacks: [] }],
                ['he', { name: 'Hebrew', speechLang: 'he-IL', fallbacks: [] }],
                ['th', { name: 'Thai', speechLang: 'th-TH', fallbacks: [] }],
                ['vi', { name: 'Vietnamese', speechLang: 'vi-VN', fallbacks: [] }],
                ['cs', { name: 'Czech', speechLang: 'cs-CZ', fallbacks: [] }],
                ['hu', { name: 'Hungarian', speechLang: 'hu-HU', fallbacks: [] }],
                ['el', { name: 'Greek', speechLang: 'el-GR', fallbacks: [] }],
                ['bg', { name: 'Bulgarian', speechLang: 'bg-BG', fallbacks: [] }],
                ['ro', { name: 'Romanian', speechLang: 'ro-RO', fallbacks: [] }],
                ['hr', { name: 'Croatian', speechLang: 'hr-HR', fallbacks: [] }],
                ['sk', { name: 'Slovak', speechLang: 'sk-SK', fallbacks: [] }],
                ['sl', { name: 'Slovenian', speechLang: 'sl-SI', fallbacks: [] }],
                ['et', { name: 'Estonian', speechLang: 'et-EE', fallbacks: [] }],
                ['lv', { name: 'Latvian', speechLang: 'lv-LV', fallbacks: [] }],
                ['lt', { name: 'Lithuanian', speechLang: 'lt-LT', fallbacks: [] }],
                ['uk', { name: 'Ukrainian', speechLang: 'uk-UA', fallbacks: [] }],
                ['ca', { name: 'Catalan', speechLang: 'ca-ES', fallbacks: [] }],
                ['eu', { name: 'Basque', speechLang: 'eu-ES', fallbacks: [] }],
                ['gl', { name: 'Galician', speechLang: 'gl-ES', fallbacks: [] }]
            ])
        };

        // Chat management state
        this.allChats = [];
        this.currentSearchQuery = '';
        this.currentFilter = 'all';
        
        // File attachment state
        this.currentAttachments = [];
        this.pendingAttachments = []; // Store attachments that are being processed
    }

    async initialize() {
        this.cacheElements();
        this.setupEventListeners();
        this.setupResponsiveLayout();
        this.initializeComponents();
        
        // Load and apply saved settings
        const settings = this.loadSettings();
        this.applyAppSettings(settings.app);
        this.applyVoiceSettings(settings.voice);
        this.applyLanguageSettings(settings.language);
        
        // Apply provider configurations from saved settings
        this.applyProviderConfigurations(settings);
        
        console.log('🎨 UI Manager initialized');
    }

    /**
     * Cache frequently accessed DOM elements
     */
    cacheElements() {
        this.elements = {
            // Main layout
            sidebar: document.getElementById('sidebar'),
            toggleSidebar: document.getElementById('toggle-sidebar'),
            chatContainer: document.getElementById('chat-container'),
            chatMessages: document.getElementById('chat-messages'),
            
            // Input area
            messageInput: document.getElementById('message-input'),
            sendBtn: document.getElementById('send-btn'),
            attachBtn: document.getElementById('attach-btn'),
            inputContainer: document.getElementById('input-container'),
            
            // Header
            chatTitle: document.getElementById('chat-title'),
            agentStatus: document.getElementById('agent-status'),
            modelSelector: document.getElementById('model-selector'),
            currentModel: document.getElementById('current-model'),
            modelTemp: document.getElementById('model-temp'),
            
            // Sidebar
            newChatBtn: document.getElementById('new-chat-btn'),
            chatHistory: document.getElementById('chat-history'),
            settingsBtn: document.getElementById('settings-btn'),
            
            // Search and filters
            chatSearch: document.getElementById('chat-search'),
            filterAll: document.getElementById('filter-all'),
            filterRecent: document.getElementById('filter-recent'),
            filterArchived: document.getElementById('filter-archived'),
            emptyChatState: document.getElementById('empty-chat-state'),
            
            // Buttons
            voiceBtn: document.getElementById('voice-btn'),
            conversationBtn: document.getElementById('conversation-btn'),
            fileUploadBtn: document.getElementById('file-upload-btn'),
            debugAttachmentBtn: document.getElementById('debug-attachment-btn'),
            moreOptions: document.getElementById('more-options'),
            
            // Modals
            modalOverlay: document.getElementById('modal-overlay'),
            modalContent: document.getElementById('modal-content'),
            
            // Indicators
            typingIndicator: document.getElementById('typing-indicator'),
            
            // Quick actions
            quickActions: document.getElementById('quick-actions'),
            quickActionBtns: document.querySelectorAll('.quick-action-btn'),
            
            // File input
            fileInput: document.getElementById('file-input'),
            
            // File attachment UI
            attachmentContainer: document.getElementById('attachment-container'),
            attachmentList: document.getElementById('attachment-list'),
            attachmentPreview: document.getElementById('attachment-preview'),
            attachmentRemoveBtn: document.getElementById('attachment-remove-btn'),
            attachmentInfo: document.getElementById('attachment-info')
        };
    }

    /**
     * Set up event listeners for UI interactions
     */
    setupEventListeners() {
        // Sidebar toggle
        if (this.elements.toggleSidebar) {
            this.elements.toggleSidebar.addEventListener('click', this.toggleSidebar.bind(this));
        }

        // New chat button
        this.elements.newChatBtn?.addEventListener('click', () => {
            this.eventBus.emit('chat:new');
        });

        // Search functionality
        this.elements.chatSearch?.addEventListener('input', (e) => {
            this.handleChatSearch(e.target.value);
        });

        // Filter buttons
        this.elements.filterAll?.addEventListener('click', () => {
            this.setActiveFilter('all');
        });

        this.elements.filterRecent?.addEventListener('click', () => {
            this.setActiveFilter('recent');
        });

        this.elements.filterArchived?.addEventListener('click', () => {
            this.setActiveFilter('archived');
        });

        // Message input
        this.elements.messageInput?.addEventListener('input', (e) => {
            this.handleInputChange(e);
        });

        this.elements.messageInput?.addEventListener('keydown', (e) => {
            this.handleKeyDown(e);
        });

        // Send button
        if (this.elements.sendBtn) {
            this.elements.sendBtn.addEventListener('click', this.sendMessage.bind(this));
        }

        // Attach button
        if (this.elements.attachBtn) {
            this.elements.attachBtn.addEventListener('click', this.showAttachmentOptions.bind(this));
        }

        // File upload
        this.elements.fileUploadBtn?.addEventListener('click', () => {
            this.elements.fileInput?.click();
        });

        this.elements.fileInput?.addEventListener('change', (event) => {
            this.handleFileSelection(event);
        });

        // Debug attachment button
        this.elements.debugAttachmentBtn?.addEventListener('click', () => {
            this.debugAttachmentSystem();
        });

        // Voice button
        if (this.elements.voiceBtn) {
            this.elements.voiceBtn.addEventListener('click', this.toggleVoiceInput.bind(this));
        }

        // Conversation mode button
        if (this.elements.conversationBtn) {
            this.elements.conversationBtn.addEventListener('click', this.toggleConversationMode.bind(this));
        }

        // Quick actions
        this.elements.quickActionBtns?.forEach(btn => {
            btn.addEventListener('click', this.handleQuickAction.bind(this));
        });

        // Settings button
        if (this.elements.settingsBtn) {
            this.elements.settingsBtn.addEventListener('click', () => {
                this.showSettings();
            });
        }

        // Model selector (unified)
        this.elements.modelSelector?.addEventListener('change', (e) => {
            this.handleModelChange(e.target.value);
        });

        // More options button
        if (this.elements.moreOptions) {
            this.elements.moreOptions.addEventListener('click', this.showMoreOptions.bind(this));
        }

        // Modal overlay
        this.elements.modalOverlay?.addEventListener('click', (e) => {
            if (e.target === this.elements.modalOverlay) {
                this.hideModal();
            }
        });

        // Chat container scroll events
        this.elements.chatContainer?.addEventListener('scroll', () => {
            // Show/hide scroll to bottom button based on scroll position
            if (this.isNearBottom()) {
                this.hideScrollToBottomButton();
            } else {
                this.showScrollToBottomButton();
            }
        });

        // Global keyboard shortcuts
        document.addEventListener('keydown', this.handleGlobalKeyboard.bind(this));
        
        // Window resize
        window.addEventListener('resize', this.handleResize.bind(this));

        // Event bus listeners
        this.setupEventBusListeners();

        // Add language selector button before conversation mode
        if (this.elements.conversationBtn) {
            const languageBtn = document.createElement('button');
            languageBtn.id = 'language-selector-btn';
            languageBtn.className = 'p-2 rounded-lg bg-chat-light border border-chat-border hover:bg-chat-hover transition-colors text-chat-text';
            languageBtn.title = 'Select speech language';
            
            // Set initial language display
            const currentLang = this.languageSettings.speechInputLanguage;
            const langName = this.languageSettings.supportedLanguages.get(currentLang)?.name || currentLang;
            languageBtn.innerHTML = `<i class="fas fa-globe mr-1"></i>${langName}`;
            
            languageBtn.onclick = () => this.showQuickLanguageSelector();
            
            // Insert before conversation button
            this.elements.conversationBtn.parentNode.insertBefore(languageBtn, this.elements.conversationBtn);
        }

        // Attachment remove button
        this.elements.attachmentRemoveBtn?.addEventListener('click', () => {
            this.removeCurrentAttachment();
        });
    }

    /**
     * Set up event bus listeners
     */
    setupEventBusListeners() {
        // Combined message received handler to prevent duplicates
        this.eventBus.on('chat:message:received', (message) => {
            // For conversation mode user messages, display the original transcript
            // instead of the language-instructed version
            let displayMessage = message;
            if (message.metadata?.isConversationMode && message.role === 'user' && message.metadata?.originalTranscript) {
                displayMessage = {
                    ...message,
                    content: message.metadata.originalTranscript
                };
                console.log('🎤 Displaying original transcript for conversation mode:', message.metadata.originalTranscript);
            }
            
            // Display the message
            this.displayMessage(displayMessage);
            
            // Auto-speak AI responses in conversation mode
            console.log('📨 Message received event:', {
                role: message.role,
                conversationActive: this.conversationActive,
                content: message.content?.substring(0, 50) + '...'
            });
            
            if (message.role === 'assistant' && this.conversationActive) {
                console.log('🎯 Triggering speech synthesis for assistant message');
                // Small delay to ensure message is displayed first
                setTimeout(() => {
                    this.speakResponse(message);
                }, 100);
            }
        });

        this.eventBus.on('chat:typing:start', () => {
            this.showTypingIndicator();
        });

        this.eventBus.on('chat:typing:stop', () => {
            this.hideTypingIndicator();
        });

        this.eventBus.on('chat:history:loaded', (chats) => {
            this.updateChatHistory(chats);
        });

        this.eventBus.on('chat:selected', (chatId) => {
            // Chat selection is handled by ChatManager, UI just updates display
            this.updateSelectedChat(chatId);
        });

        this.eventBus.on('agent:status:changed', (status) => {
            this.updateAgentStatus(status);
        });

        this.eventBus.on('ui:notification', (notification) => {
            this.showNotification(notification);
        });

        this.eventBus.on('ui:error', (error) => {
            this.showError(error);
        });

        this.eventBus.on('chat:message:streaming', (data) => {
            this.handleStreamingMessage(data);
        });

        this.eventBus.on('agent:lmstudio:connected', (data) => {
            this.updateConnectionStatus(true, data.models);
        });

        this.eventBus.on('agent:lmstudio:disconnected', (data) => {
            this.updateConnectionStatus(false, [], data.error);
        });

        this.eventBus.on('models:loaded', (models) => {
            this.updateModelSelector(models);
        });

        this.eventBus.on('model:selected', (data) => {
            this.updateCurrentModelInfo(data);
            this.updateAgentStatus(data);
        });

        this.eventBus.on('message:delete', (data) => {
            this.handleMessageDelete(data);
        });

        this.eventBus.on('message:regenerate', (data) => {
            this.handleMessageRegenerate(data);
        });

        // Agent management events
        this.eventBus.on('agents:list:response', (agents) => {
            this.updateAgentList(agents);
        });

        this.eventBus.on('models:list:response', (data) => {
            if (data.performance) {
                this.updateModelPerformanceMetrics(data.performance);
            }
        });

        this.eventBus.on('ui:show-agent-editor', (agentData) => {
            this.showAgentEditor(agentData);
        });

        // Handle messages loaded when selecting a chat
        this.eventBus.on('chat:messages:loaded', (messages) => {
            this.displayMessages(messages);
        });

        this.eventBus.on('chat:created', (newChat) => {
            // The chat:history:updated event will handle updating the display
            // with the properly sorted list, so we don't need to manually add it here
            console.log('New chat created:', newChat.id);
        });

        this.eventBus.on('chat:deleted', (chatId) => {
            // The chat:history:updated event will handle updating the display
            // with the properly sorted list, so we don't need to manually remove it here
            console.log('Chat deleted:', chatId);
        });

        this.eventBus.on('chat:history:updated', (chats) => {
            this.updateChatHistory(chats);
        });

        this.eventBus.on('chat:renamed', (chatId, newTitle) => {
            // The chat:history:updated event will handle updating the display
            // with the properly sorted list, so we don't need to manually update it here
            console.log('Chat renamed:', chatId, newTitle);
        });

        this.eventBus.on('chat:archived', (chatId) => {
            // The chat:history:updated event will handle updating the display
            // with the properly sorted list, so we don't need to manually update it here
            console.log('Chat archived:', chatId);
        });

        this.eventBus.on('chat:cleared', (chatId) => {
            // The chat:history:updated event will handle updating the display
            // with the properly sorted list, so we don't need to manually update it here
            console.log('Chat cleared:', chatId);
        });

        this.eventBus.on('chat:updated', (updatedChat) => {
            // The chat:history:updated event will handle updating the display
            // with the properly sorted list, so we don't need to manually update it here
            console.log('Chat updated:', updatedChat.id);
        });

        this.eventBus.on('message:attachments:updated', (data) => {
            this.updateMessageAttachments(data.messageId, data.attachments);
        });

        this.eventBus.on('attachment:capabilities:loaded', (capabilities) => {
            this.updateAttachmentCapabilities(capabilities);
        });

        // Handle attachment processing completion
        this.eventBus.on('attachment:processed', (data) => {
            console.log('📎 Attachment processing completed:', data);
            // Clear pending attachments after successful processing
            this.pendingAttachments = [];
        });

        this.eventBus.on('attachment:error', (error) => {
            console.error('❌ Attachment processing error:', error);
            // Clear pending attachments on error
            this.pendingAttachments = [];
            this.showError({ message: `Attachment processing failed: ${error.message}` });
        });
    }

    /**
     * Initialize UI components
     */
    initializeComponents() {
        this.setupAutoResize();
        this.setupScrollBehavior();
        this.setupTooltips();
    }

    /**
     * Set up responsive layout
     */
    setupResponsiveLayout() {
        // Handle mobile view
        const isMobile = window.innerWidth < 768;
        if (isMobile) {
            this.sidebarCollapsed = true;
            this.elements.sidebar?.classList.add('hidden');
        }
    }

    /**
     * Toggle sidebar visibility
     */
    toggleSidebar() {
        this.sidebarCollapsed = !this.sidebarCollapsed;
        
        if (this.sidebarCollapsed) {
            this.elements.sidebar?.classList.add('-translate-x-full', 'lg:translate-x-0');
        } else {
            this.elements.sidebar?.classList.remove('-translate-x-full');
        }

        this.eventBus.emit('ui:sidebar:toggled', this.sidebarCollapsed);
    }

    /**
     * Handle input changes
     */
    handleInputChange(event) {
        const input = event.target;
        const hasText = input.value.trim().length > 0;
        
        // Enable/disable send button
        this.elements.sendBtn?.toggleAttribute('disabled', !hasText);
        
        // Auto-resize textarea
        this.autoResizeTextarea(input);
        
        // Emit typing event
        this.eventBus.emit('chat:typing', hasText);
    }

    /**
     * Handle keyboard shortcuts
     */
    handleKeyDown(event) {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            this.sendMessage();
        }
    }

    /**
     * Handle global keyboard shortcuts
     */
    handleGlobalKeyboard(event) {
        // Only handle shortcuts when not typing in input fields
        if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
            return;
        }

        const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
        const cmdOrCtrl = isMac ? event.metaKey : event.ctrlKey;

        // New chat: Cmd/Ctrl + N
        if (cmdOrCtrl && event.key === 'n') {
            event.preventDefault();
            this.eventBus.emit('chat:new');
        }

        // Search conversations: Cmd/Ctrl + K
        if (cmdOrCtrl && event.key === 'k') {
            event.preventDefault();
            this.elements.chatSearch?.focus();
        }

        // Toggle sidebar: Cmd/Ctrl + B
        if (cmdOrCtrl && event.key === 'b') {
            event.preventDefault();
            this.toggleSidebar();
        }

        // Clear current chat: Cmd/Ctrl + Shift + K
        if (cmdOrCtrl && event.shiftKey && event.key === 'K') {
            event.preventDefault();
            this.clearCurrentChat();
        }

        // Export current chat: Cmd/Ctrl + E
        if (cmdOrCtrl && event.key === 'e') {
            event.preventDefault();
            if (this.currentChatId) {
                this.exportChat(this.currentChatId);
            }
        }

        // Focus message input: Cmd/Ctrl + L
        if (cmdOrCtrl && event.key === 'l') {
            event.preventDefault();
            this.elements.messageInput?.focus();
        }

        // Toggle conversation mode: Cmd/Ctrl + M
        if (cmdOrCtrl && event.key === 'm') {
            event.preventDefault();
            this.toggleConversationMode();
        }

        // Escape key: Close modals, clear search
        if (event.key === 'Escape') {
            if (this.elements.modalOverlay && !this.elements.modalOverlay.classList.contains('hidden')) {
                this.hideModal();
            } else if (this.elements.chatSearch && this.elements.chatSearch.value) {
                this.elements.chatSearch.value = '';
                this.handleChatSearch('');
            }
        }
    }

    /**
     * Send message
     */
    sendMessage() {
        const message = this.elements.messageInput?.value.trim();
        if (!message) return;

        if (this.editingMessage) {
            // Handle message editing
            this.handleMessageEdit(message);
        } else {
            // Get current attachments from pending attachments
            const attachments = this.pendingAttachments.length > 0 ? this.pendingAttachments : this.getCurrentAttachments();
            const currentProvider = this.getCurrentProvider();
            
            // Send new message with attachments
            this.eventBus.emit('chat:message:send', {
                content: message,
                type: 'user',
                attachments: attachments,
                providerId: currentProvider
            });
            
            // Clear attachments after sending (but keep them in memory until processing is complete)
            if (attachments && attachments.length > 0) {
                // Clear the file input but keep pendingAttachments for processing
                if (this.elements.fileInput) {
                    this.elements.fileInput.value = '';
                }
                // Clear pending attachments after a short delay to ensure processing is complete
                setTimeout(() => {
                    this.pendingAttachments = [];
                    this.clearCurrentAttachments();
                }, 1000);
            }
        }

        // Clear input
        this.elements.messageInput.value = '';
        this.elements.sendBtn?.setAttribute('disabled', 'true');
        this.autoResizeTextarea(this.elements.messageInput);
        this.editingMessage = null;
    }
    
    /**
     * Handle message editing
     */
    handleMessageEdit(newContent) {
        if (!this.editingMessage) return;
        
        // Update message content
        this.editingMessage.content = newContent;
        
        // Update UI
        const messageElement = document.querySelector(`[data-message-id="${this.editingMessage.id}"]`);
        if (messageElement) {
            const contentElement = messageElement.querySelector('.prose');
            if (contentElement) {
                contentElement.innerHTML = this.formatMessageContent(newContent);
                this.applySyntaxHighlighting(messageElement);
            }
        }
        
        // Emit update event
        this.eventBus.emit('message:edit', {
            messageId: this.editingMessage.id,
            newContent: newContent,
            chatId: this.editingMessage.chatId
        });
        
        this.showNotification({
            message: 'Message updated successfully',
            type: 'success',
            duration: 2000
        });
    }

    /**
     * Display a message in the chat
     */
    displayMessage(message) {
        console.log('💬 Displaying message:', {
            role: message.role,
            content: message.content?.substring(0, 50) + '...',
            timestamp: message.timestamp
        });

        const messageElement = this.createMessageElement(message);
        this.elements.chatMessages?.appendChild(messageElement);
        
        // Apply syntax highlighting
        this.applySyntaxHighlighting(messageElement);
        
        // Ensure proper word wrapping
        this.handleResize();
        
        // Force scroll to bottom for new messages
        this.forceScrollToBottom();
        
        // Animate message in
        this.animateMessageIn(messageElement);
    }

    /**
     * Display multiple messages (for chat loading)
     */
    displayMessages(messages) {
        console.log('📋 Displaying multiple messages:', messages.length);
        
        // Clear existing messages first
        if (this.elements.chatMessages) {
            this.elements.chatMessages.innerHTML = '';
        }
        
        // Sort messages by timestamp to ensure correct order (ascending - oldest first)
        const sortedMessages = [...messages].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        
        // Display each message in order
        sortedMessages.forEach(message => {
            const messageElement = this.createMessageElement(message);
            this.elements.chatMessages?.appendChild(messageElement);
            
            // Apply syntax highlighting
            this.applySyntaxHighlighting(messageElement);
        });
        
        // Force scroll to bottom after all messages are displayed
        this.forceScrollToBottom();
        
        // Ensure proper word wrapping for all messages
        this.handleResize();
        
        console.log('✅ All messages displayed in chronological order');
    }

    /**
     * Handle streaming message updates
     */
    handleStreamingMessage(data) {
        const { chatId, content, reasoningContent, finished } = data;
        
        // console.log('🎬 Streaming message update:', {
        //     chatId,
        //     contentLength: content?.length,
        //     reasoningContentLength: reasoningContent?.length,
        //     finished,
        //     conversationActive: this.conversationActive
        // });
        
        // Find existing streaming message or create new one
        let streamingElement = this.elements.chatMessages?.querySelector('.streaming-message');
        
        if (!streamingElement) {
            // Create new streaming message element
            const message = {
                id: 'streaming',
                chatId: chatId,
                role: 'assistant',
                content: content,
                reasoningContent: reasoningContent,
                timestamp: new Date().toISOString(),
                streaming: true
            };
            
            streamingElement = this.createMessageElement(message);
            streamingElement.classList.add('streaming-message');
            this.elements.chatMessages?.appendChild(streamingElement);
            
            // Force scroll to bottom for new streaming message
            this.forceScrollToBottom();
        } else {
            // Update existing streaming message
            const contentElement = streamingElement.querySelector('.prose');
            if (contentElement) {
                contentElement.innerHTML = this.formatMessageContent(content);
            }
            
            // Update reasoning content if available
            if (reasoningContent !== undefined) {
                let reasoningContainer = streamingElement.querySelector('.reasoning-container');
                if (!reasoningContainer) {
                    // Create reasoning container if it doesn't exist
                    reasoningContainer = document.createElement('div');
                    reasoningContainer.className = 'reasoning-container mt-4 p-3 bg-chat-light border border-chat-border rounded-lg';
                    
                    const reasoningHeader = document.createElement('div');
                    reasoningHeader.className = 'flex items-center gap-2 mb-2 text-sm font-medium text-chat-secondary';
                    reasoningHeader.innerHTML = '<i class="fas fa-brain"></i> Chain of Thought Reasoning';
                    
                    const reasoningContentElement = document.createElement('div');
                    reasoningContentElement.className = 'reasoning-content prose prose-invert max-w-none break-words overflow-hidden text-sm';
                    
                    reasoningContainer.appendChild(reasoningHeader);
                    reasoningContainer.appendChild(reasoningContentElement);
                    
                    // Insert before the main content
                    const mainContent = streamingElement.querySelector('.prose');
                    if (mainContent) {
                        mainContent.parentNode.insertBefore(reasoningContainer, mainContent);
                    }
                }
                
                const reasoningContentElement = reasoningContainer.querySelector('.reasoning-content');
                if (reasoningContentElement) {
                    reasoningContentElement.innerHTML = this.formatMessageContent(reasoningContent);
                }
            }
            
            // Scroll to bottom during streaming updates
            this.scrollToBottom();
        }
        
        // Add blinking cursor for streaming
        if (!finished) {
            const contentElement = streamingElement.querySelector('.prose');
            if (contentElement && !contentElement.innerHTML.includes('streaming-cursor')) {
                contentElement.innerHTML += '<span class="streaming-cursor animate-pulse">▋</span>';
            }
            
            // Ensure proper word wrapping during streaming
            this.handleResize();
        } else {
            // Remove streaming indicators when finished
            streamingElement.classList.remove('streaming-message');
            const cursor = streamingElement.querySelector('.streaming-cursor');
            if (cursor) {
                cursor.remove();
            }
            
            // When streaming finishes, save the message to storage
            // and trigger speech synthesis for conversation mode
            const finalMessage = {
                id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                chatId: chatId,
                role: 'assistant',
                content: content,
                reasoningContent: reasoningContent,
                timestamp: new Date().toISOString(),
                streaming: false
            };
            
            // Emit message for storage
            console.log('💾 Emitting chat:message:store for final message');
            this.eventBus.emit('chat:message:store', finalMessage);
            
            // Direct speech synthesis trigger for conversation mode
            // (Don't emit chat:message:received as it would create a duplicate message)
            if (this.conversationActive) {
                console.log('🎬 Streaming finished, triggering speech synthesis directly');
                setTimeout(() => {
                    this.speakResponse(finalMessage);
                }, 100);
            }
            
            // Apply syntax highlighting when streaming is complete
            this.applySyntaxHighlighting(streamingElement);
            
            // Final scroll to bottom when streaming is complete
            this.forceScrollToBottom();
        }
    }

    /**
     * Create message element
     */
    createMessageElement(message) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${message.role} group flex gap-3 p-4 rounded-lg ${
            message.role === 'user' ? 'bg-chat-input ml-8' : 'bg-transparent'
        }`;
        messageDiv.setAttribute('data-message-id', message.id);
        
        const avatar = document.createElement('div');
        avatar.className = `w-8 h-8 rounded-full flex items-center justify-center ${
            message.role === 'user' ? 'bg-chat-primary' : 'bg-chat-primary'
        }`;
        avatar.innerHTML = `<i class="fas fa-${message.role === 'user' ? 'user' : 'robot'} text-sm"></i>`;
        
        const content = document.createElement('div');
        content.className = 'flex-1 relative';
        
        // Create main message content
        const messageContent = document.createElement('div');
        messageContent.className = 'prose prose-invert max-w-none break-words overflow-hidden';
        messageContent.innerHTML = this.formatMessageContent(message.content);
        
        // Add attachments if present
        if (message.metadata?.attachments && message.metadata.attachments.length > 0) {
            const attachmentContainer = document.createElement('div');
            attachmentContainer.className = 'message-attachments mt-3 space-y-2';
            
            message.metadata.attachments.forEach(attachment => {
                const attachmentElement = this.createMessageAttachmentElement(attachment);
                attachmentContainer.appendChild(attachmentElement);
            });
            
            // Add attachment container before the main content
            content.appendChild(attachmentContainer);
        }
        
        // Add reasoning content if available (for DeepSeek reasoning model)
        if (message.reasoningContent && message.role === 'assistant') {
            const reasoningContainer = document.createElement('div');
            reasoningContainer.className = 'mt-4 p-3 bg-chat-light border border-chat-border rounded-lg';
            
            const reasoningHeader = document.createElement('div');
            reasoningHeader.className = 'flex items-center gap-2 mb-2 text-sm font-medium text-chat-secondary';
            reasoningHeader.innerHTML = '<i class="fas fa-brain"></i> Chain of Thought Reasoning';
            
            const reasoningContent = document.createElement('div');
            reasoningContent.className = 'prose prose-invert max-w-none break-words overflow-hidden text-sm';
            reasoningContent.innerHTML = this.formatMessageContent(message.reasoningContent);
            
            reasoningContainer.appendChild(reasoningHeader);
            reasoningContainer.appendChild(reasoningContent);
            
            // Add reasoning container before the main content
            content.appendChild(reasoningContainer);
        }
        
        const messageFooter = document.createElement('div');
        messageFooter.className = 'flex items-center justify-between mt-1';
        
        const timestamp = document.createElement('div');
        timestamp.className = 'text-xs text-chat-secondary';
        timestamp.textContent = new Date(message.timestamp).toLocaleTimeString();
        
        // Message actions (shown on hover)
        const actions = document.createElement('div');
        actions.className = 'message-actions opacity-0 group-hover:opacity-100 transition-opacity flex items-center space-x-2';
        
        // Copy button
        const copyBtn = document.createElement('button');
        copyBtn.className = 'p-1 rounded hover:bg-chat-hover transition-colors';
        copyBtn.innerHTML = '<i class="fas fa-copy text-xs"></i>';
        copyBtn.title = 'Copy message';
        copyBtn.onclick = () => this.copyMessage(message);
        
        // Edit button (for user messages)
        if (message.role === 'user') {
            const editBtn = document.createElement('button');
            editBtn.className = 'p-1 rounded hover:bg-chat-hover transition-colors';
            editBtn.innerHTML = '<i class="fas fa-edit text-xs"></i>';
            editBtn.title = 'Edit message';
            editBtn.onclick = () => this.editMessage(message);
            actions.appendChild(editBtn);
        }
        
        // Regenerate button (for assistant messages)
        if (message.role === 'assistant') {
            const regenBtn = document.createElement('button');
            regenBtn.className = 'p-1 rounded hover:bg-chat-hover transition-colors';
            regenBtn.innerHTML = '<i class="fas fa-redo text-xs"></i>';
            regenBtn.title = 'Regenerate response';
            regenBtn.onclick = () => this.regenerateMessage(message);
            actions.appendChild(regenBtn);
        }
        
        // Delete button
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'p-1 rounded hover:bg-red-600 transition-colors';
        deleteBtn.innerHTML = '<i class="fas fa-trash text-xs"></i>';
        deleteBtn.title = 'Delete message';
        deleteBtn.onclick = () => this.deleteMessage(message);
        
        actions.appendChild(copyBtn);
        actions.appendChild(deleteBtn);
        
        messageFooter.appendChild(timestamp);
        messageFooter.appendChild(actions);
        
        content.appendChild(messageContent);
        content.appendChild(messageFooter);
        
        messageDiv.appendChild(avatar);
        messageDiv.appendChild(content);
        
        return messageDiv;
    }

    /**
     * Format message content (enhanced markdown support)
     */
    formatMessageContent(content) {
        let formatted = content;
        
        // Code blocks with syntax highlighting
        formatted = formatted.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
            const language = lang || 'text';
            const escapedCode = this.escapeHtml(code.trim());
            const highlightedCode = this.highlightCode(escapedCode, language);
            return `<pre class="bg-chat-light p-3 rounded-lg border border-chat-border my-2 overflow-x-auto break-words"><code class="language-${language} break-words">${highlightedCode}</code></pre>`;
        });
        
        // Inline code
        formatted = formatted.replace(/`([^`]+)`/g, '<code class="bg-chat-hover px-1 rounded text-green-400 break-words">$1</code>');
        
        // Bold text
        formatted = formatted.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        
        // Italic text
        formatted = formatted.replace(/\*([^*]+)\*/g, '<em>$1</em>');
        
        // Links
        formatted = formatted.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" class="text-blue-400 hover:underline break-all">$1</a>');
        
        // Lists
        formatted = formatted.replace(/^\* (.+)$/gm, '<li class="ml-4 break-words">• $1</li>');
        formatted = formatted.replace(/^\d+\. (.+)$/gm, '<li class="ml-4 break-words">$1</li>');
        
        // Tables (basic)
        formatted = formatted.replace(/\|(.+)\|/g, (match, content) => {
            const cells = content.split('|').map(cell => cell.trim());
            return '<tr>' + cells.map(cell => `<td class="border border-chat-border px-2 py-1 break-words">${cell}</td>`).join('') + '</tr>';
        });
        
        // Line breaks
        formatted = formatted.replace(/\n/g, '<br>');
        
        return formatted;
    }
    
    /**
     * Escape HTML characters
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    /**
     * Highlight code using Prism.js
     */
    highlightCode(code, language) {
        if (typeof window.Prism !== 'undefined' && window.Prism.languages[language]) {
            try {
                return window.Prism.highlight(code, window.Prism.languages[language], language);
            } catch (error) {
                console.warn('Prism highlighting failed:', error);
                return code;
            }
        }
        return code;
    }
    
    /**
     * Apply syntax highlighting to code blocks after DOM insertion
     */
    applySyntaxHighlighting(element) {
        if (typeof window.Prism !== 'undefined') {
            const codeBlocks = element.querySelectorAll('pre code[class*="language-"]');
            codeBlocks.forEach(block => {
                window.Prism.highlightElement(block);
            });
        }
    }
    
    /**
     * Copy message to clipboard
     */
    async copyMessage(message) {
        try {
            let textToCopy = message.content;
            
            // Include reasoning content if available
            if (message.reasoningContent) {
                textToCopy = `Chain of Thought Reasoning:\n${message.reasoningContent}\n\nFinal Answer:\n${message.content}`;
            }
            
            await navigator.clipboard.writeText(textToCopy);
            this.showNotification({
                message: 'Message copied to clipboard',
                type: 'success',
                duration: 2000
            });
        } catch (error) {
            console.error('Failed to copy message:', error);
            this.showNotification({
                message: 'Failed to copy message',
                type: 'error',
                duration: 3000
            });
        }
    }
    
    /**
     * Edit a user message
     */
    editMessage(message) {
        // Populate input with message content
        this.elements.messageInput.value = message.content;
        this.autoResizeTextarea(this.elements.messageInput);
        this.elements.messageInput.focus();
        
        // Store reference for replacing the message
        this.editingMessage = message;
        
        // Show editing indicator
        this.showNotification({
            message: 'Editing message - press Enter to send updated version',
            type: 'info',
            duration: 4000
        });
    }
    
    /**
     * Regenerate assistant response
     */
    regenerateMessage(message) {
        // Find the user message that preceded this assistant message
        const messages = Array.from(this.elements.chatMessages.querySelectorAll('.message'));
        const currentIndex = messages.findIndex(el => el.getAttribute('data-message-id') === message.id);
        
        if (currentIndex > 0) {
            const prevMessageEl = messages[currentIndex - 1];
            const prevMessageId = prevMessageEl.getAttribute('data-message-id');
            
            // Remove the current assistant message
            this.deleteMessage(message, false);
            
            // Re-send the previous user message
            this.eventBus.emit('message:regenerate', {
                messageId: prevMessageId,
                chatId: message.chatId
            });
        }
    }
    
    /**
     * Delete a message
     */
    deleteMessage(message, showConfirmation = true) {
        if (showConfirmation && !confirm('Are you sure you want to delete this message?')) {
            return;
        }
        
        // Remove from UI
        const messageElement = document.querySelector(`[data-message-id="${message.id}"]`);
        if (messageElement) {
            messageElement.remove();
        }
        
        // Emit delete event
        this.eventBus.emit('message:delete', {
            messageId: message.id,
            chatId: message.chatId
        });
        
        this.showNotification({
            message: 'Message deleted',
            type: 'info',
            duration: 2000
        });
    }

    /**
     * Show typing indicator
     */
    showTypingIndicator() {
        this.elements.typingIndicator?.classList.remove('hidden');
        this.isTyping = true;
    }

    /**
     * Hide typing indicator
     */
    hideTypingIndicator() {
        this.elements.typingIndicator?.classList.add('hidden');
        this.isTyping = false;
    }

    /**
     * Update selected chat UI state
     */
    updateSelectedChat(chatId) {
        // Update current chat ID
        this.currentChatId = chatId;
        
        // Remove previous selection
        const previousSelected = this.elements.chatHistory?.querySelector('.chat-history-item.selected');
        if (previousSelected) {
            previousSelected.classList.remove('selected', 'bg-chat-selected');
        }
        
        // Add selection to new chat
        const newSelected = this.elements.chatHistory?.querySelector(`[data-chat-id="${chatId}"]`);
        if (newSelected) {
            newSelected.classList.add('selected', 'bg-chat-selected');
        }
        
        // Clear chat messages for new chat
        if (this.elements.chatMessages) {
            this.elements.chatMessages.innerHTML = '';
        }
    }

    /**
     * Update chat history display
     */
    updateChatHistory(chats) {
        if (!this.elements.chatHistory) return;
        
        // Store all chats for filtering
        this.allChats = chats;
        
        // Clear existing items
        this.elements.chatHistory.innerHTML = '';
        
        // Add chat items
        chats.forEach(chat => {
            const chatElement = this.createChatHistoryItem(chat);
            this.elements.chatHistory.appendChild(chatElement);
        });
        
        // Update empty state
        this.updateEmptyState(chats.length === 0);
    }

    /**
     * Create chat history item
     */
    createChatHistoryItem(chat) {
        const item = document.createElement('div');
        item.className = 'chat-history-item group relative p-3 rounded-lg hover:bg-chat-hover cursor-pointer transition-all duration-200 border border-transparent hover:border-chat-border';
        item.dataset.chatId = chat.id;
        
        // Main content container
        const content = document.createElement('div');
        content.className = 'flex items-start space-x-3';
        
        // Chat icon
        const icon = document.createElement('div');
        icon.className = 'flex-shrink-0 w-8 h-8 bg-chat-primary rounded-lg flex items-center justify-center mt-1';
        icon.innerHTML = '<i class="fas fa-comment text-sm text-white"></i>';
        
        // Text content
        const textContent = document.createElement('div');
        textContent.className = 'flex-1 min-w-0';
        
        const title = document.createElement('div');
        title.className = 'text-sm font-medium truncate text-chat-text';
        title.textContent = chat.title || 'New Chat';
        
        const subtitle = document.createElement('div');
        subtitle.className = 'text-xs text-chat-secondary mt-1';
        
        // Format timestamp
        const timestamp = new Date(chat.timestamp);
        const now = new Date();
        const diffTime = Math.abs(now - timestamp);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays === 1) {
            subtitle.textContent = 'Today';
        } else if (diffDays === 2) {
            subtitle.textContent = 'Yesterday';
        } else if (diffDays <= 7) {
            subtitle.textContent = `${diffDays - 1} days ago`;
        } else {
            subtitle.textContent = timestamp.toLocaleDateString();
        }
        
        // Add message count if available
        if (chat.messageCount > 0) {
            subtitle.textContent += ` • ${chat.messageCount} messages`;
        }
        
        textContent.appendChild(title);
        textContent.appendChild(subtitle);
        
        // Actions menu (hidden by default, shown on hover)
        const actionsMenu = document.createElement('div');
        actionsMenu.className = 'absolute right-2 top-1/2 transform -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200';
        
        const menuButton = document.createElement('button');
        menuButton.className = 'p-1 rounded hover:bg-chat-input transition-colors';
        menuButton.innerHTML = '<i class="fas fa-ellipsis-v text-xs text-chat-secondary"></i>';
        menuButton.addEventListener('click', (e) => {
            e.stopPropagation();
            this.showChatContextMenu(chat, e);
        });
        
        actionsMenu.appendChild(menuButton);
        
        // Assemble the item
        content.appendChild(icon);
        content.appendChild(textContent);
        item.appendChild(content);
        item.appendChild(actionsMenu);
        
        // Click handler
        item.addEventListener('click', () => {
            this.eventBus.emit('chat:select', chat.id);
        });
        
        // Add selected state
        if (this.currentChatId === chat.id) {
            item.classList.add('bg-chat-hover', 'border-chat-primary');
        }
        
        return item;
    }

    /**
     * Auto-resize textarea
     */
    autoResizeTextarea(textarea) {
        textarea.style.height = 'auto';
        textarea.style.height = Math.min(textarea.scrollHeight, 128) + 'px';
    }

    /**
     * Scroll to bottom of chat
     */
    scrollToBottom() {
        if (!this.autoScroll || !this.elements.chatContainer) {
            return;
        }

        try {
            // Use requestAnimationFrame to ensure DOM is updated
            requestAnimationFrame(() => {
                const container = this.elements.chatContainer;
                const scrollHeight = container.scrollHeight;
                const clientHeight = container.clientHeight;
                const maxScrollTop = scrollHeight - clientHeight;

                // Only scroll if we're not already at the bottom (within 10px tolerance)
                const currentScrollTop = container.scrollTop;
                const isNearBottom = currentScrollTop >= maxScrollTop - 10;

                if (isNearBottom || this.scrollBehavior === 'auto') {
                    // Use smooth scrolling for better UX
                    container.scrollTo({
                        top: maxScrollTop,
                        behavior: this.scrollBehavior
                    });
                } else {
                    // If user has scrolled up, don't auto-scroll unless it's a new message
                    // This prevents interrupting user reading
                    console.log('User has scrolled up, not auto-scrolling');
                }
            });
        } catch (error) {
            console.warn('Failed to scroll to bottom:', error);
            // Fallback to immediate scroll
            try {
                this.elements.chatContainer.scrollTop = this.elements.chatContainer.scrollHeight;
            } catch (fallbackError) {
                console.error('Fallback scroll also failed:', fallbackError);
            }
        }
    }

    /**
     * Force scroll to bottom (used when new messages are added)
     */
    forceScrollToBottom() {
        if (!this.elements.chatContainer) {
            return;
        }

        try {
            // Force immediate scroll for new messages
            this.elements.chatContainer.scrollTo({
                top: this.elements.chatContainer.scrollHeight,
                behavior: 'smooth'
            });
        } catch (error) {
            console.warn('Failed to force scroll to bottom:', error);
            // Fallback
            this.elements.chatContainer.scrollTop = this.elements.chatContainer.scrollHeight;
        }
    }

    /**
     * Show notification
     */
    showNotification(notification) {
        // Create notification element
        const notificationEl = document.createElement('div');
        notificationEl.className = `fixed top-4 right-4 bg-chat-primary text-white px-4 py-2 rounded-lg shadow-lg z-50 transform translate-x-full transition-transform duration-300`;
        notificationEl.textContent = notification.message;
        
        document.body.appendChild(notificationEl);
        
        // Animate in
        setTimeout(() => {
            notificationEl.classList.remove('translate-x-full');
        }, 100);
        
        // Remove after delay
        setTimeout(() => {
            notificationEl.classList.add('translate-x-full');
            setTimeout(() => {
                document.body.removeChild(notificationEl);
            }, 300);
        }, notification.duration || 3000);
    }

    /**
     * Show error message
     */
    showError(error) {
        this.showNotification({
            message: error.message || 'An error occurred',
            type: 'error',
            duration: 5000
        });
    }

    /**
     * Show modal
     */
    showModal(content) {
        this.elements.modalContent.innerHTML = content;
        this.elements.modalOverlay?.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }

    /**
     * Hide modal
     */
    hideModal() {
        this.elements.modalOverlay?.classList.add('hidden');
        document.body.style.overflow = 'auto';
    }

    /**
     * Show attachment options
     */
    showAttachmentOptions() {
        const attachmentHTML = `
            <div class="space-y-4">
                <h3 class="text-lg font-semibold">Attach Files</h3>
                <div class="grid grid-cols-2 gap-3">
                    <button onclick="window.mcpApp.uiManager.selectFiles('document')" 
                            class="p-4 bg-chat-input hover:bg-chat-hover border border-chat-border rounded-lg transition-colors">
                        <i class="fas fa-file-alt text-2xl mb-2 text-blue-400"></i>
                        <div class="text-sm">Documents</div>
                        <div class="text-xs text-chat-secondary">PDF, DOC, TXT</div>
                    </button>
                    <button onclick="window.mcpApp.uiManager.selectFiles('image')" 
                            class="p-4 bg-chat-input hover:bg-chat-hover border border-chat-border rounded-lg transition-colors">
                        <i class="fas fa-image text-2xl mb-2 text-green-400"></i>
                        <div class="text-sm">Images</div>
                        <div class="text-xs text-chat-secondary">JPG, PNG, GIF</div>
                    </button>
                    <button onclick="window.mcpApp.uiManager.selectFiles('code')" 
                            class="p-4 bg-chat-input hover:bg-chat-hover border border-chat-border rounded-lg transition-colors">
                        <i class="fas fa-code text-2xl mb-2 text-purple-400"></i>
                        <div class="text-sm">Code Files</div>
                        <div class="text-xs text-chat-secondary">JS, PY, HTML</div>
                    </button>
                    <button onclick="window.mcpApp.uiManager.selectFiles('any')" 
                            class="p-4 bg-chat-input hover:bg-chat-hover border border-chat-border rounded-lg transition-colors">
                        <i class="fas fa-paperclip text-2xl mb-2 text-yellow-400"></i>
                        <div class="text-sm">Any File</div>
                        <div class="text-xs text-chat-secondary">All formats</div>
                    </button>
                </div>
                <div class="flex justify-end space-x-2 pt-4">
                    <button onclick="window.mcpApp.uiManager.hideModal()" 
                            class="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700">
                        Cancel
                    </button>
                </div>
            </div>
        `;
        
        this.showModal(attachmentHTML);
    }

    /**
     * Select files by type
     */
    selectFiles(type) {
        const acceptTypes = {
            'document': '.pdf,.doc,.docx,.txt,.md,.rtf',
            'image': '.jpg,.jpeg,.png,.gif,.bmp,.webp,.svg',
            'code': '.js,.ts,.py,.html,.css,.json,.xml,.yaml,.yml,.cpp,.c,.java,.php,.rb,.go,.rs',
            'any': '*/*'
        };

        this.elements.fileInput.accept = acceptTypes[type] || '*/*';
        this.elements.fileInput.click();
        this.hideModal();
    }

    /**
     * Handle file upload
     */
    handleFileUpload(event) {
        const files = Array.from(event.target.files);
        if (files.length > 0) {
            this.processUploadedFiles(files);
            this.eventBus.emit('file:upload', files);
        }
    }

    /**
     * Process uploaded files
     */
    processUploadedFiles(files) {
        files.forEach(file => {
            const fileInfo = {
                name: file.name,
                size: this.formatFileSize(file.size),
                type: file.type || 'unknown',
                lastModified: new Date(file.lastModified)
            };

            this.showNotification({
                message: `File "${file.name}" uploaded successfully (${fileInfo.size})`,
                type: 'success',
                duration: 3000
            });

            // Add file to chat as a message
            this.displayFileMessage(fileInfo);
        });
    }

    /**
     * Display file as a message
     */
    displayFileMessage(fileInfo) {
        const fileMessage = {
            id: 'file_' + Date.now(),
            role: 'system',
            type: 'file',
            content: `📎 **File attached:** ${fileInfo.name} (${fileInfo.size})`,
            timestamp: new Date().toISOString(),
            fileInfo: fileInfo
        };

        this.displayMessage(fileMessage);
    }

    /**
     * Format file size
     */
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    /**
     * Toggle voice input
     */
    toggleVoiceInput() {
        if (!this.isListening) {
            this.startVoiceRecognition();
        } else {
            this.stopVoiceRecognition();
        }
    }

    /**
     * Start voice recognition
     */
    startVoiceRecognition() {
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            this.showNotification({
                message: 'Speech recognition is not supported in this browser',
                type: 'error',
                duration: 4000
            });
            return;
        }

        try {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            this.recognition = new SpeechRecognition();
            
            this.recognition.continuous = true;
            this.recognition.interimResults = true;
            
            // Use the manually selected speech input language
            const langConfig = this.languageSettings.supportedLanguages.get(this.languageSettings.speechInputLanguage);
            this.recognition.lang = langConfig ? langConfig.speechLang : 'en-US';
            
            this.recognition.maxAlternatives = 1;

            // Initialize retry counter
            this.recognitionRetries = 0;
            this.maxRetries = 5;

            this.setupRecognitionHandlers();
        } catch (error) {
            console.error('Failed to start voice recognition:', error);
            this.showNotification({
                message: 'Failed to start voice recognition',
                type: 'error',
                duration: 3000
            });
        }
    }

    /**
     * Stop voice recognition
     */
    stopVoiceRecognition() {
        if (this.recognition) {
            this.recognition.stop();
            this.recognition = null;
        }
        
        this.isListening = false;
        if (!this.conversationMode) {
            this.elements.voiceBtn.innerHTML = '<i class="fas fa-microphone"></i>';
            this.elements.voiceBtn.title = 'Start voice input';
        }
    }

    /**
     * Toggle conversation mode - hands-free voice interaction
     */
    toggleConversationMode() {
        if (!this.conversationMode) {
            this.startConversationMode();
        } else {
            this.stopConversationMode();
        }
    }

    /**
     * Start conversation mode
     */
    startConversationMode() {
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            this.showNotification({
                message: 'Speech recognition is not supported in this browser',
                type: 'error',
                duration: 4000
            });
            return;
        }

        if (!window.speechSynthesis) {
            this.showNotification({
                message: 'Speech synthesis is not supported in this browser',
                type: 'error',
                duration: 4000
            });
            return;
        }

        this.conversationMode = true;
        this.conversationActive = true;
        
        // Update UI
        this.elements.conversationBtn.innerHTML = '<i class="fas fa-stop text-red-400"></i>';
        this.elements.conversationBtn.title = 'Stop conversation mode';
        this.elements.conversationBtn.classList.add('bg-red-600');
        
        // Initialize voice settings
        this.initializeVoiceSettings();
        
        // Start listening
        this.startConversationListening();
        
        this.showNotification({
            message: 'Conversation mode started. Speak naturally to chat with AI.',
            type: 'success',
            duration: 3000
        });

        // Add conversation mode indicator
        this.showConversationModeIndicator();
    }

    /**
     * Stop conversation mode
     */
    stopConversationMode() {
        this.conversationMode = false;
        this.conversationActive = false;
        
        // Stop all voice activities
        this.stopVoiceRecognition();
        this.stopSpeaking();
        
        // Clean up speech recognition
        if (this.recognition) {
            try {
                this.recognition.stop();
                this.recognition.abort();
            } catch (error) {
                // Ignore errors when stopping
            }
            this.recognition = null;
        }
        
        // Reset states
        this.isListening = false;
        this.isSpeaking = false;
        this.recognitionRetries = 0;
        
        if (this.silenceTimer) {
            clearTimeout(this.silenceTimer);
            this.silenceTimer = null;
        }
        
        // Update UI
        this.elements.conversationBtn.innerHTML = '<i class="fas fa-comments"></i>';
        this.elements.conversationBtn.title = 'Start conversation mode';
        this.elements.conversationBtn.classList.remove('bg-red-600');
        
        this.showNotification({
            message: 'Conversation mode stopped',
            type: 'info',
            duration: 2000
        });

        // Remove conversation mode indicator
        this.hideConversationModeIndicator();
    }

    /**
     * Initialize voice settings for conversation mode
     */
    initializeVoiceSettings() {
        const initVoices = () => {
            const voices = this.speechSynthesis.getVoices();
            console.log('🎤 Available voices:', voices.length, voices.map(v => v.name));
            
            // Try to find a good English voice
            const preferredVoices = [
                'Google UK English Female',
                'Google US English',
                'Microsoft Zira - English (United States)',
                'Alex',
                'Samantha'
            ];
            
            for (const preferred of preferredVoices) {
                const voice = voices.find(v => v.name.includes(preferred));
                if (voice) {
                    this.voiceSettings.voice = voice;
                    console.log('🎯 Selected preferred voice:', voice.name);
                    break;
                }
            }
            
            // Fallback to first English voice
            if (!this.voiceSettings.voice) {
                this.voiceSettings.voice = voices.find(v => v.lang.startsWith('en')) || voices[0];
                console.log('🔄 Using fallback voice:', this.voiceSettings.voice?.name);
            }
        };

        // Voices might not be loaded immediately
        if (this.speechSynthesis.getVoices().length === 0) {
            this.speechSynthesis.addEventListener('voiceschanged', () => {
                initVoices();
                this.initializeMultilingualVoices();
            }, { once: true });
        } else {
            initVoices();
            this.initializeMultilingualVoices();
        }
    }

    /**
     * Initialize multilingual voice mapping
     */
    initializeMultilingualVoices() {
        const voices = this.speechSynthesis.getVoices();
        console.log('🌍 Initializing multilingual voice mapping...');

        // Clear existing mappings
        this.languageSettings.voicesByLanguage.clear();

        // Group voices by language
        for (const voice of voices) {
            const langCode = voice.lang.substring(0, 2).toLowerCase();
            
            if (!this.languageSettings.voicesByLanguage.has(langCode)) {
                this.languageSettings.voicesByLanguage.set(langCode, []);
            }
            
            this.languageSettings.voicesByLanguage.get(langCode).push({
                voice: voice,
                name: voice.name,
                lang: voice.lang,
                quality: this.assessVoiceQuality(voice)
            });
        }

        // Sort voices by quality within each language
        for (const [langCode, voiceList] of this.languageSettings.voicesByLanguage) {
            voiceList.sort((a, b) => b.quality - a.quality);
            console.log(`🗣️ ${langCode.toUpperCase()}: Found ${voiceList.length} voices, best: ${voiceList[0]?.name}`);
        }

        console.log(`🌍 Multilingual support initialized for ${this.languageSettings.voicesByLanguage.size} languages`);
    }

    /**
     * Assess voice quality for ranking
     */
    assessVoiceQuality(voice) {
        let quality = 0;
        const name = voice.name.toLowerCase();
        
        // Prefer Google voices (usually highest quality)
        if (name.includes('google')) quality += 10;
        
        // Prefer Microsoft voices
        if (name.includes('microsoft')) quality += 8;
        
        // Prefer female voices (often more pleasant)
        if (name.includes('female') || name.includes('woman') || 
            name.includes('zira') || name.includes('cortana') || 
            name.includes('samantha') || name.includes('alexa')) quality += 3;
        
        // Prefer neural/premium voices
        if (name.includes('neural') || name.includes('premium') || name.includes('hd')) quality += 5;
        
        // Prefer specific high-quality voice names
        const highQualityNames = ['google', 'microsoft', 'alex', 'samantha', 'karen', 'daniel', 'zira'];
        for (const hqName of highQualityNames) {
            if (name.includes(hqName)) quality += 2;
        }
        
        return quality;
    }

    /**
     * Detect language of text using multiple methods
     */
    // Language detection removed - using manual selection only





    /**
     * Get the best voice for a given language
     */
    getBestVoiceForLanguage(langCode) {
        // If user has selected a preferred voice, use it
        if (this.languageSettings.preferredVoice) {
            const allVoices = window.speechSynthesis.getVoices();
            const preferredVoice = allVoices.find(voice => voice.name === this.languageSettings.preferredVoice);
            if (preferredVoice) {
                console.log(`🎤 Using preferred voice: ${preferredVoice.name}`);
                return preferredVoice;
            }
        }

        // Otherwise, use auto-selection logic
        const voices = this.languageSettings.voicesByLanguage.get(langCode);
        if (voices && voices.length > 0) {
            console.log(`🎤 Auto-selected voice for ${langCode}: ${voices[0].name}`);
            return voices[0].voice;
        }

        // Try fallback languages
        const langConfig = this.languageSettings.supportedLanguages.get(langCode);
        if (langConfig && langConfig.fallbacks) {
            for (const fallback of langConfig.fallbacks) {
                const fallbackLangCode = fallback.substring(0, 2);
                const fallbackVoices = this.languageSettings.voicesByLanguage.get(fallbackLangCode);
                if (fallbackVoices && fallbackVoices.length > 0) {
                    console.log(`🔄 Using fallback voice for ${langCode}: ${fallbackVoices[0].name}`);
                    return fallbackVoices[0].voice;
                }
            }
        }

        // Final fallback to current voice
        console.log(`⚠️ No voice found for ${langCode}, using current voice`);
        return this.voiceSettings.voice;
    }

    /**
     * Update speech recognition language (manual selection only)
     */
    updateSpeechRecognitionLanguage(langCode) {
        console.log(`🎤 Manually updating speech input language to: ${langCode}`);
        this.languageSettings.speechInputLanguage = langCode;
        
        if (!this.recognition) return;

        const langConfig = this.languageSettings.supportedLanguages.get(langCode);
        if (langConfig) {
            const newLang = langConfig.speechLang;
            if (this.recognition.lang !== newLang) {
                console.log(`🎤 Updating speech recognition language: ${this.recognition.lang} → ${newLang}`);
                this.recognition.lang = newLang;
                
                // Restart recognition with new language if currently active
                if (this.isListening && this.conversationActive) {
                    this.recognition.stop();
                    setTimeout(() => {
                        if (this.conversationActive && !this.isSpeaking) {
                            this.startConversationListening();
                        }
                    }, 500);
                }
                
                // Show language change notification
                this.showNotification({
                    message: `Speech input language: ${langConfig.name}`,
                    type: 'info',
                    duration: 2000
                });
            }
        }
    }

    /**
     * Start continuous listening for conversation mode
     */
    startConversationListening() {
        if (!this.conversationActive || this.isListening || this.isSpeaking) return;

        try {
            // Initialize speech recognition if not already done
            if (!this.recognition) {
                const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
                this.recognition = new SpeechRecognition();
                
                this.recognition.continuous = true;
                this.recognition.interimResults = true;
                
                // Use the manually selected speech input language
                const langConfig = this.languageSettings.supportedLanguages.get(this.languageSettings.speechInputLanguage);
                this.recognition.lang = langConfig ? langConfig.speechLang : 'en-US';
                
                this.recognition.maxAlternatives = 1;

                // Initialize retry counter
                this.recognitionRetries = 0;
                this.maxRetries = 5;

                this.setupRecognitionHandlers();
            }

            this.recognition.start();
        } catch (error) {
            console.error('Failed to start conversation listening:', error);
            this.showNotification({
                message: 'Failed to start voice recognition',
                type: 'error',
                duration: 3000
            });
        }
    }

    /**
     * Setup speech recognition event handlers
     */
    setupRecognitionHandlers() {
        let finalTranscript = '';
        let interimTranscript = '';

        this.recognition.onstart = () => {
            this.isListening = true;
            this.updateConversationStatus('Listening...');
        };

        this.recognition.onresult = (event) => {
            if (!this.conversationActive) return;

            interimTranscript = '';
            finalTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    finalTranscript += transcript;
                } else {
                    interimTranscript += transcript;
                }
            }

            // Update input field with current transcript
            this.elements.messageInput.value = finalTranscript + interimTranscript;
            this.autoResizeTextarea(this.elements.messageInput);

            // Reset silence timer
            if (this.silenceTimer) {
                clearTimeout(this.silenceTimer);
            }

            // If we have final transcript, process it after silence threshold
            if (finalTranscript.trim()) {
                this.silenceTimer = setTimeout(() => {
                    this.processConversationInput(finalTranscript.trim());
                }, this.silenceThreshold);
            }
        };

        this.recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            this.isListening = false;
            
            // Don't restart on aborted errors (happens when we manually stop)
            if (event.error === 'aborted' || event.error === 'not-allowed') {
                return;
            }
            
            // Check retry limit
            if (this.recognitionRetries >= this.maxRetries) {
                this.showNotification({
                    message: 'Voice recognition failed multiple times. Please check your microphone permissions and try again.',
                    type: 'error',
                    duration: 5000
                });
                this.stopConversationMode();
                return;
            }
            
            if (event.error === 'no-speech' || event.error === 'audio-capture') {
                // These are common and expected, restart listening after a delay
                this.recognitionRetries++;
                setTimeout(() => {
                    if (this.conversationActive && !this.isSpeaking) {
                        this.startConversationListening();
                    }
                }, 1000);
            } else {
                this.showNotification({
                    message: `Voice recognition error: ${event.error}`,
                    type: 'warning',
                    duration: 3000
                });
                
                // Try to restart after other errors with longer delay
                this.recognitionRetries++;
                setTimeout(() => {
                    if (this.conversationActive && !this.isSpeaking) {
                        this.startConversationListening();
                    }
                }, 2000);
            }
        };

        this.recognition.onend = () => {
            this.isListening = false;
            
            // Only restart if conversation mode is still active and we're not speaking
            // Reset retry counter on successful end
            if (this.conversationActive && !this.isSpeaking) {
                this.recognitionRetries = 0; // Reset retry counter on successful session
                setTimeout(() => {
                    if (this.conversationActive && !this.isSpeaking) {
                        this.startConversationListening();
                    }
                }, 500);
            }
        };
    }

    /**
     * Process conversation input and send to AI
     */
    async processConversationInput(transcript) {
        if (!transcript || !this.conversationActive) return;

        console.log('🎤 Processing conversation input:', transcript);

        // Detect the language of the user input to provide context to AI
        const userLanguage = this.languageSettings.speechInputLanguage;
        const languageName = this.languageSettings.supportedLanguages.get(userLanguage)?.name || userLanguage;
        
        console.log(`🌍 User speaking in: ${languageName} (${userLanguage})`);

        // Clear the silence timer
        if (this.silenceTimer) {
            clearTimeout(this.silenceTimer);
            this.silenceTimer = null;
        }

        // Update status
        this.updateConversationStatus('Processing...');

        // Clear input field
        this.elements.messageInput.value = '';

        // Create language-aware prompt for the AI
        let messageContent = transcript;
        
        // Add language instruction if not English
        if (userLanguage !== 'en') {
            messageContent = `[User is speaking in ${languageName}. Please respond in ${languageName} as well.]\n\n${transcript}`;
            console.log(`🤖 Adding language context for AI: Respond in ${languageName}`);
        }

        // Send message with language context
        this.eventBus.emit('chat:message:send', {
            content: messageContent,
            role: 'user',
            timestamp: new Date().toISOString(),
            // Add metadata for internal tracking
            metadata: {
                originalTranscript: transcript,
                inputLanguage: userLanguage,
                languageName: languageName,
                isConversationMode: true
            }
        });

        // Stop listening while AI responds
        this.stopVoiceRecognition();
    }

    /**
     * Speak AI response in conversation mode
     */
    speakResponse(message) {
        console.log('🔊 Attempting to speak response:', {
            conversationActive: this.conversationActive,
            message: message,
            isSpeaking: this.isSpeaking,
            messageRole: message?.role
        });

        if (!this.conversationActive || !message || this.isSpeaking) return;

        // Extract text content from message (remove markdown and HTML)
        let textToSpeak = message.content;
        
        // Remove markdown formatting
        textToSpeak = textToSpeak
            .replace(/\*\*(.*?)\*\*/g, '$1') // Bold
            .replace(/\*(.*?)\*/g, '$1')     // Italic
            .replace(/`(.*?)`/g, '$1')       // Inline code
            .replace(/```[\s\S]*?```/g, '[code block]') // Code blocks
            .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Links
            .replace(/#{1,6}\s*(.*)/g, '$1') // Headers
            .replace(/^\s*[-*+]\s+/gm, '')   // List items
            .replace(/^\s*\d+\.\s+/gm, '')   // Numbered lists
            .trim();

        // Remove emojis to prevent speech synthesis from reading emoji descriptions
        // This preserves accents and special characters from all languages
        if (this.voiceSettings.removeEmojis) {
            textToSpeak = this.removeEmojisForSpeech(textToSpeak);
        }

        if (!textToSpeak) {
            console.log('❌ No text to speak after processing');
            return;
        }

        // Use manually selected speech output language
        const responseLanguage = this.languageSettings.speechOutputLanguage;

        // Get the best voice for the detected/current language
        const selectedVoice = this.getBestVoiceForLanguage(responseLanguage);

        console.log('🗣️ Starting multilingual speech synthesis:', {
            text: textToSpeak.substring(0, 100) + '...',
            language: responseLanguage,
            voice: selectedVoice?.name
        });

        this.isSpeaking = true;
        this.updateConversationStatus(`Speaking (${this.languageSettings.supportedLanguages.get(responseLanguage)?.name || responseLanguage})...`);

        const utterance = new SpeechSynthesisUtterance(textToSpeak);
        utterance.voice = selectedVoice || this.voiceSettings.voice;
        utterance.rate = this.voiceSettings.rate;
        utterance.pitch = this.voiceSettings.pitch;
        utterance.volume = this.voiceSettings.volume;
        
        // Set language for the utterance
        const langConfig = this.languageSettings.supportedLanguages.get(responseLanguage);
        if (langConfig) {
            utterance.lang = langConfig.speechLang;
        }

        utterance.onstart = () => {
            this.currentUtterance = utterance;
            // CRITICAL FIX: Stop speech recognition while AI is speaking to prevent feedback loop
            if (this.recognition && this.conversationActive) {
                console.log('🔇 Pausing speech recognition during AI speech');
                this.recognition.stop();
            }
        };

        utterance.onend = () => {
            this.isSpeaking = false;
            this.currentUtterance = null;
            
            // Resume listening after speaking
            if (this.conversationActive) {
                console.log('🎤 Resuming speech recognition after AI speech');
                setTimeout(() => {
                    this.startConversationListening();
                }, 500);
            }
        };

        utterance.onerror = (event) => {
            console.error('Speech synthesis error:', event.error);
            this.isSpeaking = false;
            this.currentUtterance = null;
            
            // Resume listening even after error
            if (this.conversationActive) {
                console.log('🎤 Resuming speech recognition after AI speech error');
                setTimeout(() => {
                    this.startConversationListening();
                }, 1000);
            }
        };

        this.speechSynthesis.speak(utterance);
    }

    /**
     * Stop current speech synthesis
     */
    stopSpeaking() {
        if (this.speechSynthesis.speaking) {
            this.speechSynthesis.cancel();
        }
        this.isSpeaking = false;
        this.currentUtterance = null;
    }

    /**
     * Update conversation mode status indicator
     */
    updateConversationStatus(status) {
        const indicator = document.getElementById('conversation-indicator');
        if (indicator) {
            let displayStatus = status;
            
            // Show current speech input language when listening
            if (status === 'Listening...') {
                const langName = this.languageSettings.supportedLanguages.get(this.languageSettings.speechInputLanguage)?.name || this.languageSettings.speechInputLanguage;
                displayStatus = `Listening (${langName})...`;
            }
            
            indicator.querySelector('.status-text').textContent = displayStatus;
            
            // Update icon based on status
            const icon = indicator.querySelector('.status-icon');
            if (status === 'Listening...') {
                icon.innerHTML = '<i class="fas fa-microphone text-green-400 animate-pulse"></i>';
            } else if (status === 'Processing...') {
                icon.innerHTML = '<i class="fas fa-brain text-blue-400 animate-spin"></i>';
            } else if (status.startsWith('Speaking')) {
                icon.innerHTML = '<i class="fas fa-volume-up text-purple-400 animate-bounce"></i>';
            }
        }
    }

    /**
     * Show conversation mode indicator
     */
    showConversationModeIndicator() {
        const indicator = document.createElement('div');
        indicator.id = 'conversation-indicator';
        indicator.className = 'fixed top-4 right-4 bg-chat-light border border-chat-border rounded-lg p-3 shadow-lg z-50';
        indicator.innerHTML = `
            <div class="flex items-center space-x-2">
                <div class="status-icon">
                    <i class="fas fa-microphone text-green-400"></i>
                </div>
                <div>
                    <div class="text-sm font-semibold text-chat-text">Conversation Mode</div>
                    <div class="status-text text-xs text-chat-secondary">Starting...</div>
                </div>
                <button onclick="window.mcpApp.uiManager.stopConversationMode()" 
                        class="ml-2 p-1 hover:bg-chat-hover rounded">
                    <i class="fas fa-times text-chat-secondary"></i>
                </button>
            </div>
        `;
        document.body.appendChild(indicator);
    }

    /**
     * Hide conversation mode indicator
     */
    hideConversationModeIndicator() {
        const indicator = document.getElementById('conversation-indicator');
        if (indicator) {
            indicator.remove();
        }
    }

    /**
     * Update agent status display
     */
    updateAgentStatus(status) {
        if (!this.elements.agentStatus) return;

        const statusColors = {
            'active': 'bg-green-500',
            'busy': 'bg-yellow-500',
            'error': 'bg-red-500',
            'disconnected': 'bg-gray-500'
        };

        const statusText = {
            'active': 'Ready',
            'busy': 'Processing...',
            'error': 'Error',
            'disconnected': 'Disconnected'
        };

        const color = statusColors[status.status] || 'bg-gray-500';
        const text = statusText[status.status] || status.status;

        this.elements.agentStatus.innerHTML = `
            <span class="w-2 h-2 ${color} rounded-full mr-2"></span>
            ${status.name || 'Agent'} ${text}
        `;
    }

    /**
     * Show more options menu
     */
    showMoreOptions() {
        const optionsHTML = `
            <div class="space-y-4">
                <h3 class="text-lg font-semibold">More Options</h3>
                
                <div class="grid grid-cols-2 gap-3">
                    <button onclick="window.mcpApp.uiManager.exportCurrentChat()" 
                            class="p-4 bg-chat-input hover:bg-chat-hover border border-chat-border rounded-lg transition-colors text-left">
                        <i class="fas fa-download text-2xl mb-2 text-blue-400"></i>
                        <div class="text-sm font-medium">Export Chat</div>
                        <div class="text-xs text-chat-secondary">Save as JSON</div>
                    </button>
                    
                    <button onclick="window.mcpApp.uiManager.clearCurrentChat()" 
                            class="p-4 bg-chat-input hover:bg-chat-hover border border-chat-border rounded-lg transition-colors text-left">
                        <i class="fas fa-trash text-2xl mb-2 text-red-400"></i>
                        <div class="text-sm font-medium">Clear Chat</div>
                        <div class="text-xs text-chat-secondary">Remove messages</div>
                    </button>
                    
                    <button onclick="window.mcpApp.uiManager.showKeyboardShortcuts()" 
                            class="p-4 bg-chat-input hover:bg-chat-hover border border-chat-border rounded-lg transition-colors text-left">
                        <i class="fas fa-keyboard text-2xl mb-2 text-purple-400"></i>
                        <div class="text-sm font-medium">Shortcuts</div>
                        <div class="text-xs text-chat-secondary">Keyboard help</div>
                    </button>
                    
                    <button onclick="window.mcpApp.uiManager.toggleFullscreen()" 
                            class="p-4 bg-chat-input hover:bg-chat-hover border border-chat-border rounded-lg transition-colors text-left">
                        <i class="fas fa-expand text-2xl mb-2 text-green-400"></i>
                        <div class="text-sm font-medium">Fullscreen</div>
                        <div class="text-xs text-chat-secondary">Toggle view</div>
                    </button>
                </div>
                
                <div class="border-t border-chat-border pt-4">
                    <div class="flex justify-between items-center">
                        <span class="text-sm">Auto-scroll</span>
                        <button onclick="window.mcpApp.uiManager.toggleAutoScroll()" 
                                class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${this.autoScroll ? 'bg-chat-primary' : 'bg-chat-input'}"
                                id="auto-scroll-toggle">
                            <span class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${this.autoScroll ? 'translate-x-6' : 'translate-x-1'}"></span>
                        </button>
                    </div>
                </div>
                
                <div class="flex justify-end space-x-2 pt-4">
                    <button onclick="window.mcpApp.uiManager.hideModal()" 
                            class="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700">
                        Close
            </div>
        `;
        
        this.showModal(moreOptionsHTML);
    }

    /**
     * Export current chat
     */
    exportCurrentChat() {
        this.eventBus.emit('chat:export');
        this.hideModal();
        
        this.showNotification({
            message: 'Chat export started...',
            type: 'info',
            duration: 2000
        });
    }

    /**
     * Clear current chat
     */
    clearCurrentChat() {
        if (!this.currentChatId) {
            this.showNotification({ message: 'No active chat to clear', type: 'warning' });
            return;
        }

        const modalContent = `
            <div class="space-y-4">
                <div class="flex items-center space-x-3">
                    <div class="w-10 h-10 bg-chat-warning rounded-lg flex items-center justify-center">
                        <i class="fas fa-exclamation-triangle text-white"></i>
                    </div>
                    <div>
                        <h3 class="text-lg font-semibold">Clear Chat</h3>
                        <p class="text-sm text-chat-secondary">This will remove all messages from the current chat. This action cannot be undone.</p>
                    </div>
                </div>
                <div class="flex justify-end space-x-2">
                    <button onclick="window.mcpApp.uiManager.hideModal()" 
                            class="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700">
                        Cancel
                    </button>
                    <button onclick="window.mcpApp.uiManager.confirmClearChat()" 
                            class="px-4 py-2 bg-chat-warning text-white rounded hover:bg-yellow-600">
                        Clear Chat
                    </button>
                </div>
            </div>
        `;
        
        this.showModal(modalContent);
    }

    /**
     * Confirm clear chat
     */
    confirmClearChat() {
        this.eventBus.emit('chat:clear');
        this.hideModal();
        this.showNotification({ message: 'Chat cleared successfully', type: 'success' });
    }

    /**
     * Toggle fullscreen mode
     */
    toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => {
                this.showNotification({
                    message: 'Failed to enter fullscreen mode',
                    type: 'error',
                    duration: 3000
                });
            });
        } else {
            document.exitFullscreen().catch(err => {
                this.showNotification({
                    message: 'Failed to exit fullscreen mode',
                    type: 'error',
                    duration: 3000
                });
            });
        }
        this.hideModal();
    }

    /**
     * Show keyboard shortcuts help
     */
    showKeyboardShortcuts() {
        const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
        const cmdKey = isMac ? '⌘' : 'Ctrl';
        
        const shortcutsHTML = `
            <div class="space-y-6">
                <h3 class="text-lg font-semibold">Keyboard Shortcuts</h3>
                
                <div class="grid grid-cols-1 gap-4">
                    <div class="space-y-3">
                        <h4 class="text-sm font-medium text-chat-secondary uppercase tracking-wide">Conversation Management</h4>
                        <div class="space-y-2">
                            <div class="flex justify-between items-center">
                                <span class="text-sm">New Chat</span>
                                <kbd class="px-2 py-1 bg-chat-input border border-chat-border rounded text-xs">${cmdKey} + N</kbd>
                            </div>
                            <div class="flex justify-between items-center">
                                <span class="text-sm">Search Conversations</span>
                                <kbd class="px-2 py-1 bg-chat-input border border-chat-border rounded text-xs">${cmdKey} + K</kbd>
                            </div>
                            <div class="flex justify-between items-center">
                                <span class="text-sm">Toggle Sidebar</span>
                                <kbd class="px-2 py-1 bg-chat-input border border-chat-border rounded text-xs">${cmdKey} + B</kbd>
                            </div>
                            <div class="flex justify-between items-center">
                                <span class="text-sm">Clear Current Chat</span>
                                <kbd class="px-2 py-1 bg-chat-input border border-chat-border rounded text-xs">${cmdKey} + Shift + K</kbd>
                            </div>
                            <div class="flex justify-between items-center">
                                <span class="text-sm">Export Current Chat</span>
                                <kbd class="px-2 py-1 bg-chat-input border border-chat-border rounded text-xs">${cmdKey} + E</kbd>
                            </div>
                        </div>
                    </div>
                    
                    <div class="space-y-3">
                        <h4 class="text-sm font-medium text-chat-secondary uppercase tracking-wide">Navigation</h4>
                        <div class="space-y-2">
                            <div class="flex justify-between items-center">
                                <span class="text-sm">Focus Message Input</span>
                                <kbd class="px-2 py-1 bg-chat-input border border-chat-border rounded text-xs">${cmdKey} + L</kbd>
                            </div>
                            <div class="flex justify-between items-center">
                                <span class="text-sm">Close Modal / Clear Search</span>
                                <kbd class="px-2 py-1 bg-chat-input border border-chat-border rounded text-xs">Esc</kbd>
                            </div>
                        </div>
                    </div>
                    
                    <div class="space-y-3">
                        <h4 class="text-sm font-medium text-chat-secondary uppercase tracking-wide">Voice & Conversation</h4>
                        <div class="space-y-2">
                            <div class="flex justify-between items-center">
                                <span class="text-sm">Toggle Voice Input</span>
                                <kbd class="px-2 py-1 bg-chat-input border border-chat-border rounded text-xs">Space</kbd>
                            </div>
                            <div class="flex justify-between items-center">
                                <span class="text-sm">Toggle Conversation Mode</span>
                                <kbd class="px-2 py-1 bg-chat-input border border-chat-border rounded text-xs">${cmdKey} + M</kbd>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="flex justify-end pt-4">
                    <button onclick="window.mcpApp.uiManager.hideModal()" 
                            class="px-4 py-2 bg-chat-primary text-white rounded hover:bg-green-600">
                        Close
                    </button>
                </div>
            </div>
        `;
        
        this.showModal(shortcutsHTML);
    }

    /**
     * Handle quick actions
     */
    handleQuickAction(event) {
        const action = event.target.textContent.trim();
        this.eventBus.emit('chat:quick-action', action);
    }

    /**
     * Handle agent selection change
     */


    /**
     * Handle model selector change
     */
    handleModelChange(modelKey) {
        if (!modelKey) return;
        
        console.log('🎯 Model selected:', modelKey);
        this.eventBus.emit('model:select', modelKey);
    }

    /**
     * Update unified model selector dropdown
     */
    updateModelSelector(models) {
        if (!this.elements.modelSelector) return;

        console.log('🔄 Updating unified model selector with', models.length, 'models');
        
        this.elements.modelSelector.innerHTML = '';
        
        if (models.length === 0) {
            const option = document.createElement('option');
            option.value = '';
            option.textContent = 'No models available - Configure API keys in settings';
            option.disabled = true;
            this.elements.modelSelector.appendChild(option);
            return;
        }
        
        // Group models by provider
        const modelsByProvider = {};
        models.forEach(model => {
            const provider = model.providerName || model.providerId || 'Unknown';
            if (!modelsByProvider[provider]) {
                modelsByProvider[provider] = [];
            }
            modelsByProvider[provider].push(model);
        });
        
        // Sort providers (OpenAI first, then DeepSeek, then LM Studio, then others)
        const providerOrder = ['OpenAI', 'DeepSeek', 'Anthropic', 'Google Gemini', 'LM Studio'];
        const sortedProviders = Object.keys(modelsByProvider).sort((a, b) => {
            const indexA = providerOrder.indexOf(a);
            const indexB = providerOrder.indexOf(b);
            
            if (indexA !== -1 && indexB !== -1) {
                return indexA - indexB;
            } else if (indexA !== -1) {
                return -1;
            } else if (indexB !== -1) {
                return 1;
            } else {
                return a.localeCompare(b);
            }
        });
        
        // Create options grouped by provider
        sortedProviders.forEach(provider => {
            // Create optgroup for each provider
            const optgroup = document.createElement('optgroup');
            optgroup.label = `${provider} (${modelsByProvider[provider].length} models)`;
            
            // Sort models within provider (prefer newer/better models first)
            const sortedModels = modelsByProvider[provider].sort((a, b) => {
                // OpenAI model priority
                if (a.providerId === 'openai') {
                    const priority = { 'gpt-4o': 1, 'gpt-4o-mini': 2, 'gpt-4-turbo': 3, 'gpt-4': 4, 'gpt-3.5-turbo': 5 };
                    return (priority[a.id] || 99) - (priority[b.id] || 99);
                }
                // DeepSeek model priority
                if (a.providerId === 'deepseek') {
                    const priority = { 'deepseek-chat': 1, 'deepseek-reasoner': 2 };
                    return (priority[a.id] || 99) - (priority[b.id] || 99);
                }
                // Gemini model priority
                if (a.providerId === 'gemini') {
                    const priority = { 'gemini-1.5-flash': 1, 'gemini-1.5-flash-exp': 2, 'gemini-1.5-pro': 3, 'gemini-1.5-pro-exp': 4 };
                    return (priority[a.id] || 99) - (priority[b.id] || 99);
                }
                // Default alphabetical
                return a.id.localeCompare(b.id);
            });
            
            sortedModels.forEach(model => {
                const option = document.createElement('option');
                option.value = `${model.providerId}:${model.id}`;
                
                // Show model name with capabilities info
                let displayName = model.id;
                if (model.capabilities) {
                    const caps = [];
                    if (model.capabilities.streaming) caps.push('Stream');
                    if (model.capabilities.functionCalling) caps.push('Functions');
                    if (model.capabilities.vision) caps.push('Vision');
                    if (model.capabilities.reasoning) caps.push('Reasoning');
                    
                    if (caps.length > 0) {
                        displayName += ` (${caps.join(', ')})`;
                    }
                }
                
                option.textContent = displayName;
                option.setAttribute('data-provider', model.providerId);
                option.setAttribute('data-model', model.id);
                option.setAttribute('data-provider-name', model.providerName);
                
                optgroup.appendChild(option);
            });
            
            this.elements.modelSelector.appendChild(optgroup);
        });

        // Select the first model by default if none is selected
        if (models.length > 0 && !this.elements.modelSelector.value) {
            const firstModel = models[0];
            this.elements.modelSelector.value = `${firstModel.providerId}:${firstModel.id}`;
            // Trigger the selection
            this.handleModelChange(`${firstModel.providerId}:${firstModel.id}`);
        }
    }

    /**
     * Update current model information display
     */
    updateCurrentModelInfo(data) {
        if (!data || !data.model) {
            console.warn('Cannot update model info - invalid data:', data);
            return;
        }
        
        const { model, providerName } = data;
        
        if (this.elements.currentModel) {
            this.elements.currentModel.textContent = `${model.id} (${providerName})`;
        }
        
        // Update temperature display if available
        if (this.elements.modelTemp && model.defaultTemperature !== undefined) {
            this.elements.modelTemp.textContent = `Temp: ${model.defaultTemperature}`;
        }
        
        // Update model selector if not already selected
        const modelKey = `${model.providerId}:${model.id}`;
        if (this.elements.modelSelector && this.elements.modelSelector.value !== modelKey) {
            this.elements.modelSelector.value = modelKey;
        }
    }

    /**
     * Update agent status based on selected model
     */
    updateAgentStatus(data) {
        if (!data || !data.model || !this.elements.agentStatus) {
            return;
        }
        
        const { model, providerName } = data;
        
        // Determine status indicator color based on provider
        let statusColor = 'bg-green-500'; // Default green
        if (model.providerId === 'openai') {
            statusColor = 'bg-blue-500';
        } else if (model.providerId === 'deepseek') {
            statusColor = 'bg-purple-500';
        } else if (model.providerId === 'lmstudio') {
            statusColor = 'bg-green-500';
        } else if (model.providerId === 'gemini') {
            statusColor = 'bg-blue-600';
        } else if (model.providerId === 'anthropic') {
            statusColor = 'bg-orange-500';
        }
        
        this.elements.agentStatus.innerHTML = `
            <span class="w-2 h-2 ${statusColor} rounded-full mr-2"></span>
            ${providerName} Ready
        `;
    }

    /**
     * Handle message deletion
     */
    handleMessageDelete(data) {
        // Message deletion is handled in the deleteMessage method
        // This is for any additional cleanup if needed
    }

    /**
     * Handle message regeneration
     */
    handleMessageRegenerate(data) {
        // Find the original user message and resend it
        this.eventBus.emit('agent:message:process', data);
    }

    /**
     * Update connection status indicator
     */
    updateConnectionStatus(connected, models = [], error = null) {
        const statusElement = this.elements.agentStatus;
        if (!statusElement) return;

        if (connected) {
            statusElement.innerHTML = `
                <span class="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                LM Studio Connected (${models.length} models)
            `;
            statusElement.className = 'flex items-center text-green-400';
        } else {
            statusElement.innerHTML = `
                <span class="w-2 h-2 bg-red-500 rounded-full mr-2"></span>
                LM Studio Disconnected
            `;
            statusElement.className = 'flex items-center text-red-400';
        }
    }

    /**
     * Show settings modal
     * Refactored: Anthropic model dropdown is now populated dynamically from provider.
     */
    async showSettings() {
        const currentSettings = this.loadSettings();
        // Fetch Anthropic models dynamically
        let anthropicModels = [];
        try {
            const manager = window.mcpApp?.mcpAgentManager;
            if (manager) {
                const instance = manager.registry.getProviderInstance('anthropic');
                if (instance && typeof instance.getModels === 'function') {
                    anthropicModels = await instance.getModels();
                }
            }
        } catch (err) {
            console.warn('Failed to fetch Anthropic models:', err.message);
        }
        if (!Array.isArray(anthropicModels) || anthropicModels.length === 0) {
            anthropicModels = [{ id: 'claude-3-5-sonnet-20241022', display_name: 'Claude 3.5 Sonnet (Fallback)' }];
        }
        // Build Anthropic model options
        const anthropicModelOptions = anthropicModels.map(model => {
            const id = model.id || model;
            const name = model.display_name || id;
            const selected = (currentSettings.anthropic?.defaultModel || 'claude-3-5-sonnet-20241022') === id ? 'selected' : '';
            return `<option value="${id}" ${selected}>${name}</option>`;
        }).join('');
        const settingsHTML = `
            <div class="max-w-4xl max-h-[80vh] overflow-y-auto">
                <div class="space-y-4">
                    <div class="flex items-center justify-between">
                        <h3 class="text-lg font-semibold">Settings</h3>
                        <div class="flex space-x-2">
                            <button onclick="window.mcpApp.uiManager.showAgentManager()" 
                                    class="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">
                                <i class="fas fa-robot mr-1"></i> Manage Agents
                            </button>
                        </div>
                    </div>
                    
                    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <!-- LM Studio Settings -->
                        <div class="border border-chat-border rounded-lg p-4">
                            <h4 class="text-md font-medium mb-3 flex items-center">
                                <i class="fas fa-server mr-2"></i> LM Studio Connection
                            </h4>
                            <div class="space-y-3">
                                <label class="block">
                                    <span class="text-sm text-chat-secondary">Server URL</span>
                                    <input type="text" id="lm-studio-url" value="${currentSettings.lmStudio.url}" 
                                           class="w-full p-2 bg-chat-input rounded-lg border border-chat-border text-sm">
                                </label>
                                <label class="block">
                                    <span class="text-sm text-chat-secondary">Default Model</span>
                                    <input type="text" id="lm-studio-model" value="${currentSettings.lmStudio.model}" 
                                           class="w-full p-2 bg-chat-input rounded-lg border border-chat-border text-sm">
                                </label>
                                <label class="flex items-center space-x-2">
                                    <input type="checkbox" id="streaming-enabled" ${currentSettings.lmStudio.streaming ? 'checked' : ''} 
                                           class="rounded border-chat-border">
                                    <span class="text-sm">Enable Streaming Responses</span>
                                </label>
                                <button onclick="window.mcpApp.uiManager.testLMStudioConnection()" 
                                        class="w-full px-3 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">
                                    <i class="fas fa-plug mr-1"></i> Test Connection
                                </button>
                            </div>
                        </div>

                        <!-- DeepSeek Settings -->
                        <div class="border border-chat-border rounded-lg p-4">
                            <h4 class="text-md font-medium mb-3 flex items-center">
                                <i class="fas fa-brain mr-2"></i> DeepSeek Configuration
                            </h4>
                            <div class="space-y-3">
                                <label class="block">
                                    <span class="text-sm text-chat-secondary">API Key</span>
                                    <input type="password" id="deepseek-api-key" value="${currentSettings.deepseek?.apiKey || ''}"
                                           placeholder="sk-abcd1234efgh5678... (starts with sk-)"
                                           class="w-full p-2 bg-chat-input rounded-lg border border-chat-border text-sm">
                                    <div class="text-xs text-chat-secondary mt-1">
                                        Get your API key from <a href="https://platform.deepseek.com/api_keys" target="_blank" class="text-blue-400 hover:underline">DeepSeek Platform</a>
                                    </div>
                                </label>
                                <label class="block">
                                    <span class="text-sm text-chat-secondary">Default Model</span>
                                    <select id="deepseek-default-model" class="w-full p-2 bg-chat-input rounded-lg border border-chat-border text-sm">
                                        <option value="deepseek-chat" ${(currentSettings.deepseek?.defaultModel || 'deepseek-chat') === 'deepseek-chat' ? 'selected' : ''}>DeepSeek Chat (Recommended)</option>
                                        <option value="deepseek-reasoner" ${currentSettings.deepseek?.defaultModel === 'deepseek-reasoner' ? 'selected' : ''}>DeepSeek Reasoner</option>
                                    </select>
                                </label>
                                <button onclick="window.mcpApp.uiManager.testDeepSeekConnection()" 
                                        class="w-full px-3 py-2 bg-purple-600 text-white rounded text-sm hover:bg-purple-700">
                                    <i class="fas fa-plug mr-1"></i> Test Connection
                                </button>
                            </div>
                        </div>

                        <!-- OpenAI Settings -->
                        <div class="border border-chat-border rounded-lg p-4">
                            <h4 class="text-md font-medium mb-3 flex items-center">
                                <i class="fab fa-openai mr-2"></i> OpenAI Configuration
                            </h4>
                            <div class="space-y-3">
                                <label class="block">
                                    <span class="text-sm text-chat-secondary">API Key</span>
                                    <input type="password" id="openai-api-key" value="${currentSettings.openai?.apiKey || ''}" 
                                           placeholder="sk-..."
                                           class="w-full p-2 bg-chat-input rounded-lg border border-chat-border text-sm">
                                    <div class="text-xs text-chat-secondary mt-1">
                                        Get your API key from <a href="https://platform.openai.com/api-keys" target="_blank" class="text-blue-400 hover:underline">OpenAI Platform</a>
                                    </div>
                                </label>
                                <label class="block">
                                    <span class="text-sm text-chat-secondary">Default Model</span>
                                    <select id="openai-default-model" class="w-full p-2 bg-chat-input rounded-lg border border-chat-border text-sm">
                                        <option value="gpt-4o-mini" ${(currentSettings.openai?.defaultModel || 'gpt-4o-mini') === 'gpt-4o-mini' ? 'selected' : ''}>GPT-4o Mini (Recommended)</option>
                                        <option value="gpt-4o" ${currentSettings.openai?.defaultModel === 'gpt-4o' ? 'selected' : ''}>GPT-4o</option>
                                        <option value="gpt-4-turbo" ${currentSettings.openai?.defaultModel === 'gpt-4-turbo' ? 'selected' : ''}>GPT-4 Turbo</option>
                                        <option value="gpt-4" ${currentSettings.openai?.defaultModel === 'gpt-4' ? 'selected' : ''}>GPT-4</option>
                                        <option value="gpt-3.5-turbo" ${currentSettings.openai?.defaultModel === 'gpt-3.5-turbo' ? 'selected' : ''}>GPT-3.5 Turbo</option>
                                    </select>
                                </label>
                                <label class="block">
                                    <span class="text-sm text-chat-secondary">Organization ID (Optional)</span>
                                    <input type="text" id="openai-organization" value="${currentSettings.openai?.organization || ''}" 
                                           placeholder="org-..."
                                           class="w-full p-2 bg-chat-input rounded-lg border border-chat-border text-sm">
                                </label>
                                <button onclick="window.mcpApp.uiManager.testOpenAIConnection()" 
                                        class="w-full px-3 py-2 bg-green-600 text-white rounded text-sm hover:bg-green-700">
                                    <i class="fas fa-plug mr-1"></i> Test Connection
                                </button>
                            </div>
                        </div>
                        
                        <!-- Anthropic Claude Settings -->
                        <div class="border border-chat-border rounded-lg p-4">
                            <h4 class="text-md font-medium mb-3 flex items-center">
                                <i class="fas fa-robot mr-2"></i> Anthropic Claude Configuration
                            </h4>
                            <div class="space-y-3">
                                <label class="block">
                                    <span class="text-sm text-chat-secondary">API Key</span>
                                    <input type="password" id="anthropic-api-key" value="${currentSettings.anthropic?.apiKey || ''}" 
                                           placeholder="sk-ant-..."
                                           class="w-full p-2 bg-chat-input rounded-lg border border-chat-border text-sm">
                                    <div class="text-xs text-chat-secondary mt-1">
                                        Get your API key from <a href="https://console.anthropic.com/account/keys" target="_blank" class="text-blue-400 hover:underline">Anthropic Console</a>
                                    </div>
                                </label>
                                <label class="block">
                                    <span class="text-sm text-chat-secondary">Default Model</span>
                                    <select id="anthropic-default-model" class="w-full p-2 bg-chat-input rounded-lg border border-chat-border text-sm">
                                        ${anthropicModelOptions}
                                    </select>
                                </label>
                                <label class="block">
                                    <span class="text-sm text-chat-secondary">Anthropic Version (Optional)</span>
                                    <input type="text" id="anthropic-version" value="${currentSettings.anthropic?.anthropicVersion || '2023-06-01'}" 
                                           placeholder="2023-06-01"
                                           class="w-full p-2 bg-chat-input rounded-lg border border-chat-border text-sm">
                                    <div class="text-xs text-chat-secondary mt-1">
                                        API version for compatibility (default: 2023-06-01)
                                    </div>
                                </label>
                                <button onclick="window.mcpApp.uiManager.testAnthropicConnection()" 
                                        class="w-full px-3 py-2 bg-orange-600 text-white rounded text-sm hover:bg-orange-700">
                                    <i class="fas fa-plug mr-1"></i> Test Connection
                                </button>
                            </div>
                        </div>
                        
                        <!-- Google Gemini Settings -->
                        <div class="border border-chat-border rounded-lg p-4">
                            <h4 class="text-md font-medium mb-3 flex items-center">
                                <i class="fab fa-google mr-2"></i> Google Gemini Configuration
                            </h4>
                            <div class="space-y-3">
                                <label class="block">
                                    <span class="text-sm text-chat-secondary">API Key</span>
                                    <input type="password" id="gemini-api-key" value="${currentSettings.gemini?.apiKey || ''}" 
                                           placeholder="AIza..."
                                           class="w-full p-2 bg-chat-input rounded-lg border border-chat-border text-sm">
                                    <div class="text-xs text-chat-secondary mt-1">
                                        Get your API key from <a href="https://aistudio.google.com/app/apikey" target="_blank" class="text-blue-400 hover:underline">Google AI Studio</a>
                                    </div>
                                </label>
                                <label class="block">
                                    <span class="text-sm text-chat-secondary">Default Model</span>
                                    <select id="gemini-default-model" class="w-full p-2 bg-chat-input rounded-lg border border-chat-border text-sm">
                                        <option value="gemini-1.5-flash" ${(currentSettings.gemini?.defaultModel || 'gemini-1.5-flash') === 'gemini-1.5-flash' ? 'selected' : ''}>Gemini 1.5 Flash (Recommended)</option>
                                        <option value="gemini-1.5-pro" ${(currentSettings.gemini?.defaultModel === 'gemini-1.5-pro') ? 'selected' : ''}>Gemini 1.5 Pro</option>
                                        <option value="gemini-1.5-flash-exp" ${(currentSettings.gemini?.defaultModel === 'gemini-1.5-flash-exp') ? 'selected' : ''}>Gemini 1.5 Flash Experimental</option>
                                        <option value="gemini-1.5-pro-exp" ${(currentSettings.gemini?.defaultModel === 'gemini-1.5-pro-exp') ? 'selected' : ''}>Gemini 1.5 Pro Experimental</option>
                                        <option value="gemini-1.0-pro" ${(currentSettings.gemini?.defaultModel === 'gemini-1.0-pro') ? 'selected' : ''}>Gemini 1.0 Pro</option>
                                        <option value="gemini-1.0-pro-vision" ${(currentSettings.gemini?.defaultModel === 'gemini-1.0-pro-vision') ? 'selected' : ''}>Gemini 1.0 Pro Vision</option>
                                    </select>
                                </label>
                                <button onclick="window.mcpApp.uiManager.testGeminiConnection()" 
                                        class="w-full px-3 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">
                                    <i class="fas fa-plug mr-1"></i> Test Connection
                                </button>
                            </div>
                        </div>
                        
                        <!-- App Settings -->
                        <div class="border border-chat-border rounded-lg p-4">
                            <h4 class="text-md font-medium mb-3 flex items-center">
                                <i class="fas fa-cog mr-2"></i> Application Settings
                            </h4>
                            <div class="space-y-3">
                                <label class="block">
                                    <span class="text-sm text-chat-secondary">Theme</span>
                                    <select id="app-theme" class="w-full p-2 bg-chat-input rounded-lg border border-chat-border text-sm">
                                        <option value="dark" ${currentSettings.app.theme === 'dark' ? 'selected' : ''}>Dark</option>
                                        <option value="light" ${currentSettings.app.theme === 'light' ? 'selected' : ''}>Light</option>
                                    </select>
                                </label>
                                <label class="block">
                                    <span class="text-sm text-chat-secondary">Font Size</span>
                                    <select id="font-size" class="w-full p-2 bg-chat-input rounded-lg border border-chat-border text-sm">
                                        <option value="small" ${currentSettings.app.fontSize === 'small' ? 'selected' : ''}>Small</option>
                                        <option value="medium" ${currentSettings.app.fontSize === 'medium' ? 'selected' : ''}>Medium</option>
                                        <option value="large" ${currentSettings.app.fontSize === 'large' ? 'selected' : ''}>Large</option>
                                    </select>
                                </label>
                                <label class="flex items-center space-x-2">
                                    <input type="checkbox" id="auto-scroll" ${currentSettings.app.autoScroll ? 'checked' : ''} 
                                           class="rounded border-chat-border">
                                    <span class="text-sm">Auto-scroll to new messages</span>
                                </label>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Voice Settings -->
                    <div class="border border-chat-border rounded-lg p-4">
                        <h4 class="text-md font-medium mb-3 flex items-center">
                            <i class="fas fa-volume-up mr-2"></i> Voice Settings
                        </h4>
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label for="voice-rate" class="block text-sm font-medium mb-2">Speech Rate</label>
                                <input type="range" id="voice-rate" min="0.1" max="2" step="0.1" value="${this.voiceSettings.rate}"
                                       class="w-full h-2 bg-chat-input rounded-lg appearance-none cursor-pointer">
                                <div class="flex justify-between text-xs text-chat-secondary mt-1">
                                    <span>Slow</span>
                                    <span id="voice-rate-value">${this.voiceSettings.rate}</span>
                                    <span>Fast</span>
                                </div>
                            </div>
                            <div>
                                <label for="voice-pitch" class="block text-sm font-medium mb-2">Speech Pitch</label>
                                <input type="range" id="voice-pitch" min="0" max="2" step="0.1" value="${this.voiceSettings.pitch}"
                                       class="w-full h-2 bg-chat-input rounded-lg appearance-none cursor-pointer">
                                <div class="flex justify-between text-xs text-chat-secondary mt-1">
                                    <span>Low</span>
                                    <span id="voice-pitch-value">${this.voiceSettings.pitch}</span>
                                    <span>High</span>
                                </div>
                            </div>
                            <div>
                                <label for="voice-volume" class="block text-sm font-medium mb-2">Speech Volume</label>
                                <input type="range" id="voice-volume" min="0" max="1" step="0.1" value="${this.voiceSettings.volume}"
                                       class="w-full h-2 bg-chat-input rounded-lg appearance-none cursor-pointer">
                                <div class="flex justify-between text-xs text-chat-secondary mt-1">
                                    <span>Quiet</span>
                                    <span id="voice-volume-value">${this.voiceSettings.volume}</span>
                                    <span>Loud</span>
                                </div>
                            </div>
                            <div>
                                <label for="silence-threshold" class="block text-sm font-medium mb-2">Silence Threshold (ms)</label>
                                <input type="number" id="silence-threshold" value="${this.silenceThreshold}" min="500" max="5000" step="100"
                                       class="w-full p-2 bg-chat-input border border-chat-border rounded-lg text-chat-text">
                            </div>
                        </div>
                        <div class="mt-4">
                            <label class="flex items-center space-x-2">
                                <input type="checkbox" id="remove-emojis" ${this.voiceSettings.removeEmojis ? 'checked' : ''} 
                                       class="rounded border-chat-border">
                                <span class="text-sm">Remove emojis from speech</span>
                            </label>
                            <p class="text-xs text-chat-secondary mt-1">
                                Prevents speech synthesis from reading emoji descriptions (e.g., "smiling face with smiling eyes")
                            </p>
                        </div>
                    </div>
                    
                    <!-- Multilingual Settings -->
                    <div class="border border-chat-border rounded-lg p-4">
                        <h4 class="text-md font-medium mb-3 flex items-center">
                            <i class="fas fa-globe mr-2"></i> Language Settings
                        </h4>
                        <div class="space-y-4">
                            <div>
                                <label for="speech-input-language" class="block text-sm font-medium mb-2">
                                    Speech Input Language (What you speak)
                                </label>
                                <select id="speech-input-language" class="w-full p-2 bg-chat-input border border-chat-border rounded-lg text-chat-text">
                                    ${Array.from(this.languageSettings.supportedLanguages.entries()).map(([code, config]) => 
                                        `<option value="${code}" ${this.languageSettings.speechInputLanguage === code ? 'selected' : ''}>${config.name}</option>`
                                    ).join('')}
                                </select>
                                <p class="text-xs text-chat-secondary mt-1">
                                    Language for speech recognition - must be set manually
                                </p>
                            </div>
                            
                            <div>
                                <label for="speech-output-language" class="block text-sm font-medium mb-2">
                                    Speech Output Language (AI responses)
                                </label>
                                <select id="speech-output-language" class="w-full p-2 bg-chat-input border border-chat-border rounded-lg text-chat-text">
                                    ${Array.from(this.languageSettings.supportedLanguages.entries()).map(([code, config]) => 
                                        `<option value="${code}" ${this.languageSettings.speechOutputLanguage === code ? 'selected' : ''}>${config.name}</option>`
                                    ).join('')}
                                </select>
                                <p class="text-xs text-chat-secondary mt-1">
                                    Language for AI response speech - manual selection only
                                </p>
                            </div>
                            
                            <div>
                                <label for="speech-output-language" class="block text-sm font-medium mb-2">
                                    Speech Output Language (AI responses)
                                </label>
                                <select id="speech-output-language" class="w-full p-2 bg-chat-input border border-chat-border rounded-lg text-chat-text">
                                    ${Array.from(this.languageSettings.supportedLanguages.entries()).map(([code, config]) => 
                                        `<option value="${code}" ${this.languageSettings.speechOutputLanguage === code ? 'selected' : ''}>${config.name}</option>`
                                    ).join('')}
                                </select>
                                <p class="text-xs text-chat-secondary mt-1">
                                    Language for AI response speech - manual selection only
                                </p>
                            </div>
                            
                            <div class="text-xs text-chat-secondary bg-chat-hover p-3 rounded">
                                <p><strong>Quick Settings Tips:</strong></p>
                                <ul class="list-disc list-inside mt-1 space-y-1">
                                    <li><strong>For faster Portuguese:</strong> Increase Speech Rate to 1.3-1.5</li>
                                    <li><strong>Voice selection:</strong> Choose your preferred Portuguese voice above</li>
                                    <li><strong>Available:</strong> ${this.languageSettings.voicesByLanguage.size} languages with ${Array.from(this.languageSettings.voicesByLanguage.values()).reduce((sum, voices) => sum + voices.length, 0)} voices</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Model Performance -->
                    <div class="border border-chat-border rounded-lg p-4">
                        <h4 class="text-md font-medium mb-3 flex items-center">
                            <i class="fas fa-chart-line mr-2"></i> Model Performance
                        </h4>
                        <div id="model-performance" class="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                            <div class="bg-chat-input p-3 rounded">
                                <div class="text-chat-secondary">Avg Response Time</div>
                                <div class="text-lg font-semibold">--</div>
                            </div>
                            <div class="bg-chat-input p-3 rounded">
                                <div class="text-chat-secondary">Total Requests</div>
                                <div class="text-lg font-semibold">--</div>
                            </div>
                            <div class="bg-chat-input p-3 rounded">
                                <div class="text-chat-secondary">Success Rate</div>
                                <div class="text-lg font-semibold">--</div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="flex space-x-2 pt-4">
                        <button onclick="window.mcpApp.uiManager.saveSettings()" 
                                class="px-4 py-2 bg-chat-primary text-white rounded hover:bg-green-600">
                            <i class="fas fa-save mr-1"></i> Save Settings
                        </button>
                        <button onclick="window.mcpApp.uiManager.hideModal()" 
                                class="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700">
                            Cancel
                        </button>
                    </div>
                </div>
            </div>
        `;
        this.showModal(settingsHTML);
        
        // Add event listeners for voice settings sliders
        this.setupVoiceSettingsListeners();
    }

    /**
     * Setup voice settings sliders event listeners
     */
    setupVoiceSettingsListeners() {
        const rateSlider = document.getElementById('voice-rate');
        const pitchSlider = document.getElementById('voice-pitch');
        const volumeSlider = document.getElementById('voice-volume');
        const speechInputLanguageSelect = document.getElementById('speech-input-language');
        const speechOutputLanguageSelect = document.getElementById('speech-output-language');
        const removeEmojisCheckbox = document.getElementById('remove-emojis');
        const preferredVoiceSelect = document.getElementById('preferred-voice-select');
        
        if (rateSlider) {
            rateSlider.addEventListener('input', (e) => {
                const value = parseFloat(e.target.value);
                this.voiceSettings.rate = value;
                document.getElementById('voice-rate-value').textContent = value;
            });
        }
        
        if (pitchSlider) {
            pitchSlider.addEventListener('input', (e) => {
                const value = parseFloat(e.target.value);
                this.voiceSettings.pitch = value;
                document.getElementById('voice-pitch-value').textContent = value;
            });
        }
        
        if (volumeSlider) {
            volumeSlider.addEventListener('input', (e) => {
                const value = parseFloat(e.target.value);
                this.voiceSettings.volume = value;
                document.getElementById('voice-volume-value').textContent = value;
            });
        }
        
        if (speechOutputLanguageSelect) {
            speechOutputLanguageSelect.addEventListener('change', (e) => {
                const newLanguage = e.target.value;
                this.languageSettings.speechOutputLanguage = newLanguage;
                console.log(`🌍 Speech output language manually changed to: ${newLanguage}`);
                
                // Show notification about language change
                const langName = this.languageSettings.supportedLanguages.get(newLanguage)?.name || newLanguage;
                this.showNotification({
                    message: `AI response language: ${langName}`,
                    type: 'info',
                    duration: 2000
                });
            });
        }
        
        if (speechInputLanguageSelect) {
            speechInputLanguageSelect.addEventListener('change', (e) => {
                const newLanguage = e.target.value;
                console.log(`🌍 Speech input language manually changed to: ${newLanguage}`);
                this.updateSpeechRecognitionLanguage(newLanguage);
            });
        }
        
        if (removeEmojisCheckbox) {
            removeEmojisCheckbox.addEventListener('change', (e) => {
                this.voiceSettings.removeEmojis = e.target.checked;
                console.log('🚫 Emojis removed from speech:', this.voiceSettings.removeEmojis);
            });
        }
        
        if (preferredVoiceSelect) {
            // Populate voice selector when voices are loaded
            this.populateVoiceSelector();
            
            // Also repopulate when voices change (some browsers load voices asynchronously)
            window.speechSynthesis.addEventListener('voiceschanged', () => {
                this.populateVoiceSelector();
            });
            
            preferredVoiceSelect.addEventListener('change', (e) => {
                this.languageSettings.preferredVoice = e.target.value || null;
                console.log('🎤 Preferred voice changed to:', this.languageSettings.preferredVoice || 'Auto-select');
                
                // Show notification about voice change
                if (this.languageSettings.preferredVoice) {
                    this.showNotification({
                        message: `Voice set to: ${this.languageSettings.preferredVoice}`,
                        type: 'info',
                        duration: 2000
                    });
                } else {
                    this.showNotification({
                        message: 'Voice set to: Auto-select best voice',
                        type: 'info',
                        duration: 2000
                    });
                }
            });
        }
    }

    /**
     * Show agent manager modal
     */
    showAgentManager() {
        const agentManagerHTML = `
            <div class="max-w-6xl max-h-[85vh] overflow-y-auto">
                <div class="space-y-4">
                    <div class="flex items-center justify-between">
                        <h3 class="text-lg font-semibold flex items-center">
                            <i class="fas fa-robot mr-2"></i> Agent Manager
                        </h3>
                        <div class="flex space-x-2">
                            <button onclick="window.mcpApp.uiManager.createNewAgent()" 
                                    class="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700">
                                <i class="fas fa-plus mr-1"></i> New Agent
                            </button>
                            <button onclick="window.mcpApp.uiManager.importAgents()" 
                                    class="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">
                                <i class="fas fa-file-import mr-1"></i> Import
                            </button>
                            <button onclick="window.mcpApp.uiManager.exportAgents()" 
                                    class="px-3 py-1 bg-purple-600 text-white rounded text-sm hover:bg-purple-700">
                                <i class="fas fa-file-export mr-1"></i> Export
                            </button>
                        </div>
                    </div>
                    
                    <!-- Agent Templates -->
                    <div class="border border-chat-border rounded-lg p-4">
                        <h4 class="text-md font-medium mb-3 flex items-center">
                            <i class="fas fa-layer-group mr-2"></i> Agent Templates
                        </h4>
                        <div id="agent-templates" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            <!-- Templates will be populated here -->
                        </div>
                    </div>
                    
                    <!-- Current Agents -->
                    <div class="border border-chat-border rounded-lg p-4">
                        <h4 class="text-md font-medium mb-3 flex items-center">
                            <i class="fas fa-users mr-2"></i> Your Agents
                        </h4>
                        <div id="agent-list" class="space-y-3">
                            <!-- Agents will be populated here -->
                        </div>
                    </div>
                    
                    <div class="flex justify-end space-x-2 pt-4">
                        <button onclick="window.mcpApp.uiManager.hideModal()" 
                                class="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700">
                            Close
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        this.showModal(agentManagerHTML);
        this.loadAgentManager();
    }

    /**
     * Load agent manager data
     */
    loadAgentManager() {
        this.loadAgentTemplates();
        this.loadCurrentAgents();
    }

    /**
     * Load agent templates
     */
    loadAgentTemplates() {
        const templates = [
            {
                id: 'general',
                name: 'General Assistant',
                description: 'Helpful AI assistant for general tasks',
                icon: 'fas fa-user-tie',
                systemPrompt: 'You are a helpful AI assistant. Provide clear, accurate, and helpful responses.',
                temperature: 0.7,
                maxTokens: -1
            },
            {
                id: 'coder',
                name: 'Code Expert',
                description: 'Programming and software development specialist',
                icon: 'fas fa-code',
                systemPrompt: 'You are an expert programming assistant. Help with coding tasks, debugging, code review, and technical documentation. Provide clear explanations and well-commented code examples.',
                temperature: 0.3,
                maxTokens: -1
            },
            {
                id: 'researcher',
                name: 'Research Analyst',
                description: 'Research and analysis specialist',
                icon: 'fas fa-search',
                systemPrompt: 'You are a research assistant specialized in analysis, summarization, and information synthesis. Provide well-structured, evidence-based responses with clear reasoning.',
                temperature: 0.4,
                maxTokens: -1
            },
            {
                id: 'creative',
                name: 'Creative Writer',
                description: 'Creative writing and content generation',
                icon: 'fas fa-feather-alt',
                systemPrompt: 'You are a creative writing assistant. Help with storytelling, creative content generation, brainstorming ideas, and artistic expression. Be imaginative and inspiring.',
                temperature: 0.8,
                maxTokens: -1
            },
            {
                id: 'teacher',
                name: 'Educator',
                description: 'Educational content and tutoring specialist',
                icon: 'fas fa-chalkboard-teacher',
                systemPrompt: 'You are an educational assistant. Explain concepts clearly, provide examples, and adapt your teaching style to help users learn effectively.',
                temperature: 0.6,
                maxTokens: -1
            },
            {
                id: 'analyst',
                name: 'Data Analyst',
                description: 'Data analysis and visualization expert',
                icon: 'fas fa-chart-bar',
                systemPrompt: 'You are a data analysis expert. Help with data interpretation, statistical analysis, and creating insights from data.',
                temperature: 0.3,
                maxTokens: -1
            }
        ];

        const templatesContainer = document.getElementById('agent-templates');
        if (!templatesContainer) return;

        templatesContainer.innerHTML = templates.map(template => `
            <div class="bg-chat-input p-3 rounded-lg border border-chat-border hover:bg-chat-hover transition-colors cursor-pointer"
                 onclick="window.mcpApp.uiManager.createAgentFromTemplate('${template.id}')">
                <div class="flex items-center mb-2">
                    <i class="${template.icon} text-blue-400 mr-2"></i>
                    <span class="font-medium text-sm">${template.name}</span>
                </div>
                <p class="text-xs text-chat-secondary">${template.description}</p>
                <div class="mt-2 flex items-center text-xs text-chat-secondary">
                    <span>Temp: ${template.temperature}</span>
                </div>
            </div>
        `).join('');
    }

    /**
     * Load current agents
     */
    loadCurrentAgents() {
        this.eventBus.emit('agents:request:list');
    }

    /**
     * Create agent from template
     */
    createAgentFromTemplate(templateId) {
        // This will trigger the agent creation modal with pre-filled template data
        this.eventBus.emit('agent:create:from-template', templateId);
    }

    /**
     * Create new custom agent
     */
    createNewAgent() {
        this.showAgentEditor();
    }

    /**
     * Show agent editor modal
     */
    showAgentEditor(agent = null) {
        const isEdit = agent !== null && agent.id;
        const isTemplate = agent !== null && !agent.id;
        const title = isEdit ? 'Edit Agent' : isTemplate ? 'Create Agent from Template' : 'Create New Agent';
        
        const editorHTML = `
            <div class="max-w-3xl max-h-[85vh] overflow-y-auto">
                <div class="space-y-4">
                    <h3 class="text-lg font-semibold">${title}</h3>
                    
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <!-- Basic Info -->
                        <div class="space-y-3">
                            <label class="block">
                                <span class="text-sm text-chat-secondary">Agent Name</span>
                                <input type="text" id="agent-name" value="${agent?.name || ''}" placeholder="My Custom Agent"
                                       class="w-full p-2 bg-chat-input rounded-lg border border-chat-border text-sm">
                            </label>
                            
                            <label class="block">
                                <span class="text-sm text-chat-secondary">Description</span>
                                <input type="text" id="agent-description" value="${agent?.description || ''}" placeholder="Brief description"
                                       class="w-full p-2 bg-chat-input rounded-lg border border-chat-border text-sm">
                            </label>
                            
                            <label class="block">
                                <span class="text-sm text-chat-secondary">Model</span>
                                <select id="agent-model" class="w-full p-2 bg-chat-input rounded-lg border border-chat-border text-sm">
                                    <option value="">Loading models...</option>
                                </select>
                            </label>
                        </div>
                        
                        <!-- Configuration -->
                        <div class="space-y-3">
                            <label class="block">
                                <span class="text-sm text-chat-secondary">Temperature (<span id="temp-value">${agent?.config?.temperature || 0.7}</span>)</span>
                                <input type="range" id="agent-temperature" min="0" max="1" step="0.1" 
                                       value="${agent?.config?.temperature || 0.7}"
                                       class="w-full" 
                                       oninput="document.getElementById('temp-value').textContent = this.value">
                                <div class="flex justify-between text-xs text-chat-secondary">
                                    <span>Focused</span>
                                    <span>Creative</span>
                                </div>
                            </label>
                            
                            <label class="block">
                                <span class="text-sm text-chat-secondary">Max Tokens</span>
                                <input type="number" id="agent-max-tokens" value="${agent?.config?.maxTokens || -1}" 
                                       placeholder="-1 for unlimited"
                                       class="w-full p-2 bg-chat-input rounded-lg border border-chat-border text-sm">
                            </label>
                            
                            <label class="block">
                                <span class="text-sm text-chat-secondary">Icon Class</span>
                                <input type="text" id="agent-icon" value="${agent?.icon || 'fas fa-robot'}" 
                                       placeholder="fas fa-robot"
                                       class="w-full p-2 bg-chat-input rounded-lg border border-chat-border text-sm">
                            </label>
                        </div>
                    </div>
                    
                    <!-- System Prompt -->
                    <label class="block">
                        <span class="text-sm text-chat-secondary">System Prompt</span>
                        <textarea id="agent-system-prompt" rows="6" placeholder="You are a helpful AI assistant..."
                                  class="w-full p-3 bg-chat-input rounded-lg border border-chat-border text-sm resize-vertical">${agent?.config?.systemPrompt || ''}</textarea>
                    </label>
                    
                    <div class="flex justify-end space-x-2 pt-4">
                        <button onclick="window.mcpApp.uiManager.hideModal()" 
                                class="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700">
                            Cancel
                        </button>
                        <button onclick="window.mcpApp.uiManager.saveAgent(${isEdit ? `'${agent?.id}'` : 'null'})" 
                                class="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">
                            <i class="fas fa-save mr-1"></i> ${isEdit ? 'Update' : 'Create'} Agent
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        this.showModal(editorHTML);
        this.loadModelsForEditor();
    }

    /**
     * Load models for the agent editor
     */
    loadModelsForEditor() {
        this.eventBus.emit('models:request:list', (models) => {
            const select = document.getElementById('agent-model');
            if (select && models) {
                select.innerHTML = models.map(model => 
                    `<option value="${model.id}">${model.id}</option>`
                ).join('');
            }
        });
    }

    /**
     * Save agent (create or update)
     */
    saveAgent(agentId = null) {
        const agentData = {
            name: document.getElementById('agent-name')?.value,
            description: document.getElementById('agent-description')?.value,
            config: {
                model: document.getElementById('agent-model')?.value,
                temperature: parseFloat(document.getElementById('agent-temperature')?.value),
                maxTokens: parseInt(document.getElementById('agent-max-tokens')?.value),
                systemPrompt: document.getElementById('agent-system-prompt')?.value
            },
            icon: document.getElementById('agent-icon')?.value || 'fas fa-robot'
        };

        if (!agentData.name || !agentData.config.model) {
            this.showNotification({
                message: 'Please fill in agent name and select a model',
                type: 'error',
                duration: 3000
            });
            return;
        }

        if (agentId) {
            // Update existing agent
            this.eventBus.emit('agent:update', { id: agentId, ...agentData });
        } else {
            // Create new agent
            this.eventBus.emit('agent:create', agentData);
        }

        this.hideModal();
        this.showNotification({
            message: agentId ? 'Agent updated successfully' : 'Agent created successfully',
            type: 'success',
            duration: 3000
        });
    }

    /**
     * Edit existing agent
     */
    editAgent(agentId) {
        this.eventBus.emit('agent:request:get', agentId, (agent) => {
            this.showAgentEditor(agent);
        });
    }

    /**
     * Delete agent
     */
    deleteAgent(agentId, agentName) {
        if (confirm(`Are you sure you want to delete "${agentName}"?`)) {
            this.eventBus.emit('agent:delete', agentId);
            this.showNotification({
                message: 'Agent deleted successfully',
                type: 'info',
                duration: 3000
            });
        }
    }

    /**
     * Import agents from file
     */
    importAgents() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    try {
                        const agents = JSON.parse(e.target.result);
                        this.eventBus.emit('agents:import', agents);
                        this.showNotification({
                            message: `Imported ${agents.length} agents successfully`,
                            type: 'success',
                            duration: 3000
                        });
                    } catch (error) {
                        this.showNotification({
                            message: 'Failed to import agents: Invalid file format',
                            type: 'error',
                            duration: 3000
                        });
                    }
                };
                reader.readAsText(file);
            }
        };
        input.click();
    }

    /**
     * Export agents to file
     */
    exportAgents() {
        this.eventBus.emit('agents:export', (agents) => {
            const blob = new Blob([JSON.stringify(agents, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `mcp-agents-${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            URL.revokeObjectURL(url);
            
            this.showNotification({
                message: 'Agents exported successfully',
                type: 'success',
                duration: 3000
            });
        });
    }

    /**
     * Update agent list display
     */
    updateAgentList(agents) {
        const agentList = document.getElementById('agent-list');
        if (!agentList) return;

        agentList.innerHTML = agents.map(agent => `
            <div class="bg-chat-input p-4 rounded-lg border border-chat-border">
                <div class="flex items-center justify-between">
                    <div class="flex items-center space-x-3">
                        <i class="${agent.icon || 'fas fa-robot'} text-blue-400"></i>
                        <div>
                            <h5 class="font-medium">${agent.name}</h5>
                            <p class="text-sm text-chat-secondary">${agent.description || 'No description'}</p>
                        </div>
                    </div>
                    <div class="flex space-x-2">
                        <button onclick="window.mcpApp.uiManager.editAgent('${agent.id}')"
                                class="p-1 text-blue-400 hover:bg-chat-hover rounded text-sm">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button onclick="window.mcpApp.uiManager.deleteAgent('${agent.id}', '${agent.name}')"
                                class="p-1 text-red-400 hover:bg-chat-hover rounded text-sm">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
                <div class="mt-3 grid grid-cols-3 gap-4 text-sm">
                    <div>
                        <span class="text-chat-secondary">Model:</span>
                        <div class="font-mono text-xs">${agent.config?.model || 'N/A'}</div>
                    </div>
                    <div>
                        <span class="text-chat-secondary">Temperature:</span>
                        <div>${agent.config?.temperature || 'N/A'}</div>
                    </div>
                    <div>
                        <span class="text-chat-secondary">Max Tokens:</span>
                        <div>${agent.config?.maxTokens === -1 ? 'Unlimited' : agent.config?.maxTokens || 'N/A'}</div>
                    </div>
                </div>
                         </div>
         `).join('');
     }

     /**
      * Update model performance metrics
      */
     updateModelPerformanceMetrics(performanceData) {
         const performanceContainer = document.getElementById('model-performance');
         if (!performanceContainer) return;

         const metrics = performanceData || {
             avgResponseTime: '--',
             totalRequests: '--',
             successRate: '--'
         };

         const children = performanceContainer.querySelectorAll('.text-lg.font-semibold');
         if (children[0]) children[0].textContent = metrics.avgResponseTime || '--';
         if (children[1]) children[1].textContent = metrics.totalRequests || '--';
         if (children[2]) children[2].textContent = metrics.successRate || '--';
     }

     /**
      * Test LM Studio connection
      */
    async testLMStudioConnection() {
        this.eventBus.emit('agent:reconnect');
        this.showNotification({
            message: 'Testing LM Studio connection...',
            type: 'info',
            duration: 2000
        });
    }

    /**
     * Test OpenAI connection
     */
    async testOpenAIConnection() {
        const apiKey = document.getElementById('openai-api-key')?.value;
        
        if (!apiKey) {
            this.showNotification({
                message: '❌ Please enter an OpenAI API key first',
                type: 'error',
                duration: 3000
            });
            return;
        }

        if (!apiKey.startsWith('sk-')) {
            this.showNotification({
                message: '❌ Invalid API key format. OpenAI keys start with "sk-"',
                type: 'error',
                duration: 3000
            });
            return;
        }
        
        this.showNotification({
            message: 'Testing OpenAI connection...',
            type: 'info',
            duration: 2000
        });

        try {
            const response = await fetch('https://api.openai.com/v1/models', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                signal: AbortSignal.timeout(10000)
            });

            if (response.ok) {
                const data = await response.json();
                const modelCount = data.data?.length || 0;
                this.showNotification({
                    message: `✅ OpenAI connection successful! Found ${modelCount} models.`,
                    type: 'success',
                    duration: 3000
                });
            } else if (response.status === 401) {
                this.showNotification({
                    message: '❌ Invalid API key. Please check your OpenAI API key.',
                    type: 'error',
                    duration: 5000
                });
            } else if (response.status === 429) {
                this.showNotification({
                    message: '❌ Rate limit exceeded. Please try again later.',
                    type: 'error',
                    duration: 5000
                });
            } else {
                throw new Error(`HTTP ${response.status}`);
            }
        } catch (error) {
            if (error.name === 'AbortError') {
                this.showNotification({
                    message: '❌ Connection timeout. Please check your internet connection.',
                    type: 'error',
                    duration: 5000
                });
            } else {
                this.showNotification({
                    message: `❌ OpenAI connection failed: ${error.message}`,
                    type: 'error',
                    duration: 5000
                });
            }
        }
    }

    /**
     * Test DeepSeek connection
     */
    async testDeepSeekConnection() {
        const apiKey = document.getElementById('deepseek-api-key')?.value;
        
        if (!apiKey) {
            this.showNotification({
                message: '❌ Please enter a DeepSeek API key first',
                type: 'error',
                duration: 3000
            });
            return;
        }

        // Validate DeepSeek API key format
        const deepseekKeyPattern = /^sk-[a-f0-9]{32,}$/i;
        if (!deepseekKeyPattern.test(apiKey)) {
            this.showNotification({
                message: '❌ Invalid DeepSeek API key format. Key must start with "sk-" followed by a hexadecimal string (e.g., sk-abcd1234...). Get your key at https://platform.deepseek.com/api_keys',
                type: 'error',
                duration: 8000
            });
            return;
        }
        
        this.showNotification({
            message: 'Testing DeepSeek connection...',
            type: 'info',
            duration: 2000
        });

        try {
            const response = await fetch('https://api.deepseek.com/models', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                signal: AbortSignal.timeout(10000)
            });

            if (response.ok) {
                const data = await response.json();
                const modelCount = data.data?.length || 0;
                this.showNotification({
                    message: `✅ DeepSeek connection successful! Found ${modelCount} models.`,
                    type: 'success',
                    duration: 3000
                });
            } else if (response.status === 401) {
                this.showNotification({
                    message: '❌ Authentication failed. API key is invalid or expired. Please get a new key from https://platform.deepseek.com/api_keys',
                    type: 'error',
                    duration: 8000
                });
            } else if (response.status === 429) {
                this.showNotification({
                    message: '❌ Rate limit exceeded. Please try again later.',
                    type: 'error',
                    duration: 5000
                });
            } else {
                throw new Error(`HTTP ${response.status}`);
            }
        } catch (error) {
            if (error.name === 'AbortError') {
                this.showNotification({
                    message: '❌ Connection timeout. Please check your internet connection.',
                    type: 'error',
                    duration: 5000
                });
            } else {
                this.showNotification({
                    message: `❌ DeepSeek connection failed: ${error.message}`,
                    type: 'error',
                    duration: 5000
                });
            }
        }
    }

    async testAnthropicConnection() {
        const apiKey = document.getElementById('anthropic-api-key')?.value?.trim();
        
        if (!apiKey) {
            this.showNotification({
                type: 'error',
                message: 'Please enter your Anthropic API key first'
            });
            return;
        }

        try {
            // Show loading state
            const testButton = document.querySelector('button[onclick*="testAnthropicConnection"]');
            if (testButton) {
                testButton.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i> Testing...';
                testButton.disabled = true;
            }

            // Test configuration first
            const result = await window.mcpApp.mcpAgentManager.configureAnthropic({
                apiKey,
                defaultModel: document.getElementById('anthropic-default-model')?.value || 'claude-3-5-sonnet-20241022',
                anthropicVersion: document.getElementById('anthropic-version')?.value || '2023-06-01'
            });

            if (result.success) {
                // Test connection
                const anthropicInstance = window.mcpApp.mcpAgentManager.registry.getProviderInstance('anthropic');
                if (anthropicInstance) {
                    const connectionTest = await anthropicInstance.testConnection();
                    
                    if (connectionTest.success) {
                        this.showNotification({
                            type: 'success',
                            title: 'Anthropic Connection Successful',
                            message: `Connected to ${connectionTest.model || 'Claude'}. Response: "${connectionTest.response}"`
                        });
                        
                        // Update models list
                        await window.mcpApp.mcpAgentManager.triggerModelRefresh();
                    } else {
                        throw new Error(connectionTest.error || 'Connection test failed');
                    }
                } else {
                    throw new Error('Failed to initialize Anthropic client');
                }
            } else {
                throw new Error(result.error || 'Configuration failed');
            }
        } catch (error) {
            console.error('Anthropic connection test failed:', error);
            
            let errorMessage = 'Failed to connect to Anthropic API';
            if (error.message.includes('401') || error.message.includes('authentication')) {
                errorMessage = 'Invalid API key. Please check your Anthropic API key.';
            } else if (error.message.includes('403')) {
                errorMessage = 'API key does not have permission. Please check your Anthropic account.';
            } else if (error.message.includes('429')) {
                errorMessage = 'Rate limit exceeded. Please try again later.';
            } else if (error.message.includes('network') || error.message.includes('fetch')) {
                errorMessage = 'Network error. Please check your internet connection.';
            } else if (error.message) {
                errorMessage = error.message;
            }
            
            this.showNotification({
                type: 'error',
                title: 'Anthropic Connection Failed',
                message: errorMessage
            });
        } finally {
            // Reset button state
            const testButton = document.querySelector('button[onclick*="testAnthropicConnection"]');
            if (testButton) {
                testButton.innerHTML = '<i class="fas fa-plug mr-1"></i> Test Connection';
                testButton.disabled = false;
            }
        }
    }

    async testGeminiConnection() {
        const apiKey = document.getElementById('gemini-api-key')?.value?.trim();
        
        if (!apiKey) {
            this.showNotification({
                type: 'error',
                message: 'Please enter your Gemini API key first'
            });
            return;
        }

        try {
            // Show loading state
            const testButton = document.querySelector('button[onclick*="testGeminiConnection"]');
            if (testButton) {
                testButton.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i> Testing...';
                testButton.disabled = true;
            }

            // Test configuration first
            const result = await window.mcpApp.mcpAgentManager.configureGemini({
                apiKey,
                defaultModel: document.getElementById('gemini-default-model')?.value || 'gemini-1.5-flash'
            });

            if (result.success) {
                // Test connection
                const geminiInstance = window.mcpApp.mcpAgentManager.registry.getProviderInstance('gemini');
                if (geminiInstance) {
                    const connectionTest = await geminiInstance.testConnection();
                    
                    if (connectionTest.success) {
                        this.showNotification({
                            type: 'success',
                            title: 'Gemini Connection Successful',
                            message: `Connected to Gemini API. Found ${connectionTest.models?.length || 0} models.`
                        });
                        
                        // Update models list
                        await window.mcpApp.mcpAgentManager.refreshAvailableModels();
                    } else {
                        throw new Error(connectionTest.error || 'Connection test failed');
                    }
                } else {
                    throw new Error('Failed to initialize Gemini client');
                }
            } else {
                throw new Error(result.error || 'Configuration failed');
            }
        } catch (error) {
            console.error('Gemini connection test failed:', error);
            
            let errorMessage = 'Failed to connect to Gemini API';
            if (error.message.includes('401') || error.message.includes('authentication')) {
                errorMessage = 'Invalid API key. Please check your Gemini API key.';
            } else if (error.message.includes('403')) {
                errorMessage = 'API key does not have permission. Please check your Google AI Studio account.';
            } else if (error.message.includes('429')) {
                errorMessage = 'Rate limit exceeded. Please try again later.';
            } else if (error.message.includes('network') || error.message.includes('fetch')) {
                errorMessage = 'Network error. Please check your internet connection.';
            } else if (error.message) {
                errorMessage = error.message;
            }
            
            this.showNotification({
                type: 'error',
                title: 'Gemini Connection Failed',
                message: errorMessage
            });
        } finally {
            // Reset button state
            const testButton = document.querySelector('button[onclick*="testGeminiConnection"]');
            if (testButton) {
                testButton.innerHTML = '<i class="fas fa-plug mr-1"></i> Test Connection';
                testButton.disabled = false;
            }
        }
    }

    /**
     * Save settings
     */
    saveSettings() {
        const settings = {
            lmStudio: {
                url: document.getElementById('lm-studio-url')?.value,
                model: document.getElementById('lm-studio-model')?.value,
                streaming: document.getElementById('streaming-enabled')?.checked
            },
            deepseek: {
                apiKey: document.getElementById('deepseek-api-key')?.value,
                defaultModel: document.getElementById('deepseek-default-model')?.value
            },
            openai: {
                apiKey: document.getElementById('openai-api-key')?.value,
                defaultModel: document.getElementById('openai-default-model')?.value,
                organization: document.getElementById('openai-organization')?.value
            },
            anthropic: {
                apiKey: document.getElementById('anthropic-api-key')?.value,
                defaultModel: document.getElementById('anthropic-default-model')?.value,
                anthropicVersion: document.getElementById('anthropic-version')?.value
            },
            gemini: {
                apiKey: document.getElementById('gemini-api-key')?.value,
                defaultModel: document.getElementById('gemini-default-model')?.value
            },
            app: {
                theme: document.getElementById('app-theme')?.value,
                fontSize: document.getElementById('font-size')?.value,
                autoScroll: document.getElementById('auto-scroll')?.checked
            },
            voice: {
                rate: this.voiceSettings.rate,
                pitch: this.voiceSettings.pitch,
                volume: this.voiceSettings.volume,
                silenceThreshold: parseInt(document.getElementById('silence-threshold')?.value) || this.silenceThreshold,
                removeEmojis: document.getElementById('remove-emojis')?.checked
            },
            language: {
                speechInputLanguage: this.languageSettings.speechInputLanguage,
                speechOutputLanguage: this.languageSettings.speechOutputLanguage,
                preferredVoice: this.languageSettings.preferredVoice
            }
        };

        // Save to localStorage
        try {
            localStorage.setItem('mcp-tabajara-settings', JSON.stringify(settings));
        } catch (error) {
            console.error('Failed to save settings:', error);
        }

        // Apply LM Studio settings
        if (settings.lmStudio.url && settings.lmStudio.model) {
            this.eventBus.emit('agent:configure:lmstudio', {
                baseUrl: settings.lmStudio.url,
                defaultModel: settings.lmStudio.model
            });
            
            this.eventBus.emit('agent:toggle-streaming', settings.lmStudio.streaming);
        }

        // Apply DeepSeek settings
        if (settings.deepseek.apiKey) {
            this.eventBus.emit('agent:configure:deepseek', {
                apiKey: settings.deepseek.apiKey,
                defaultModel: settings.deepseek.defaultModel
            });
        }

        // Apply OpenAI settings
        if (settings.openai.apiKey) {
            this.eventBus.emit('agent:configure:openai', {
                apiKey: settings.openai.apiKey,
                defaultModel: settings.openai.defaultModel,
                organization: settings.openai.organization
            });
        }

        // Apply Anthropic settings
        if (settings.anthropic.apiKey) {
            this.eventBus.emit('agent:configure:anthropic', {
                apiKey: settings.anthropic.apiKey,
                defaultModel: settings.anthropic.defaultModel,
                anthropicVersion: settings.anthropic.anthropicVersion
            });
        }

        // Apply Gemini settings
        if (settings.gemini.apiKey) {
            this.eventBus.emit('agent:configure:gemini', {
                apiKey: settings.gemini.apiKey,
                defaultModel: settings.gemini.defaultModel
            });
        }

        // Apply app settings
        this.applyAppSettings(settings.app);
        this.applyVoiceSettings(settings.voice);
        this.applyLanguageSettings(settings.language);
        
        // Trigger model refresh after settings are saved
        console.log('🔄 Triggering model refresh after settings save...');
        this.eventBus.emit('agent:refresh:models');
        
        this.showNotification({
            message: 'Settings saved successfully',
            type: 'success',
            duration: 3000
        });
        
        this.hideModal();
    }

    /**
     * Load settings from storage
     */
    loadSettings() {
        try {
            const stored = localStorage.getItem('mcp-tabajara-settings');
            if (stored) {
                const settings = JSON.parse(stored);
                return settings;
            }
        } catch (error) {
            console.error('Failed to load settings:', error);
        }
        
        // Return default settings
        return {
            lmStudio: {
                url: 'http://localhost:1234',
                model: 'google/gemma-3-4b',
                streaming: true
            },
            deepseek: {
                apiKey: '',
                defaultModel: 'deepseek-chat'
            },
            openai: {
                apiKey: '',
                defaultModel: 'gpt-4o-mini',
                organization: ''
            },
            anthropic: {
                apiKey: '',
                defaultModel: 'claude-3-5-sonnet-20241022',
                anthropicVersion: '2023-06-01'
            },
            gemini: {
                apiKey: '',
                defaultModel: 'gemini-1.5-flash'
            },
            app: {
                theme: 'dark',
                fontSize: 'medium',
                autoScroll: true
            },
            voice: {
                rate: 1.0,
                pitch: 1.0,
                volume: 0.8,
                silenceThreshold: 2000,
                removeEmojis: true
            },
            language: {
                speechInputLanguage: 'en',
                speechOutputLanguage: 'en',
                preferredVoice: null
            }
        };
    }

    /**
     * Apply app settings
     */
    applyAppSettings(appSettings) {
        // Apply theme (future implementation)
        if (appSettings.theme === 'light') {
            // Future: Switch to light theme
        }

        // Apply font size
        const fontSizeClasses = {
            'small': 'text-sm',
            'medium': 'text-base',
            'large': 'text-lg'
        };
        
        const fontClass = fontSizeClasses[appSettings.fontSize] || 'text-base';
        document.body.className = document.body.className.replace(/text-(sm|base|lg)/, fontClass);

        // Store auto-scroll preference
        this.autoScroll = appSettings.autoScroll;
    }

    /**
     * Apply voice settings
     */
    applyVoiceSettings(voiceSettings) {
        if (!voiceSettings) return;
        
        this.voiceSettings.rate = voiceSettings.rate || 1.0;
        this.voiceSettings.pitch = voiceSettings.pitch || 1.0;
        this.voiceSettings.volume = voiceSettings.volume || 0.8;
        this.silenceThreshold = voiceSettings.silenceThreshold || 2000;
        this.voiceSettings.removeEmojis = voiceSettings.removeEmojis || true;
    }

    /**
     * Apply language settings
     */
    applyLanguageSettings(languageSettings) {
        if (!languageSettings) return;
        
        // Handle both old and new settings format for backward compatibility
        if (languageSettings.speechInputLanguage !== undefined) {
            // New format
            this.languageSettings.speechInputLanguage = languageSettings.speechInputLanguage || 'en';
            this.languageSettings.speechOutputLanguage = languageSettings.speechOutputLanguage || 'en';
            this.languageSettings.preferredVoice = languageSettings.preferredVoice || null;
        } else {
            // Old format - migrate to new format
            this.languageSettings.speechInputLanguage = languageSettings.currentLanguage || 'en';
            this.languageSettings.speechOutputLanguage = languageSettings.currentLanguage || 'en';
            this.languageSettings.preferredVoice = null;
        }
        
        console.log('🌍 Applied language settings:', {
            speechInputLanguage: this.languageSettings.speechInputLanguage,
            speechOutputLanguage: this.languageSettings.speechOutputLanguage,
            preferredVoice: this.languageSettings.preferredVoice
        });
    }

    /**
     * Apply provider configurations from saved settings
     */
    applyProviderConfigurations(settings) {
        if (!settings) return;
        
        console.log('🔧 Applying provider configurations from saved settings');
        
        // Apply LM Studio settings
        if (settings.lmStudio?.url && settings.lmStudio?.model) {
            console.log('🔧 Configuring LM Studio from saved settings');
            this.eventBus.emit('agent:configure:lmstudio', {
                baseUrl: settings.lmStudio.url,
                defaultModel: settings.lmStudio.model
            });
        }

        // Apply DeepSeek settings
        if (settings.deepseek?.apiKey) {
            console.log('🔧 Configuring DeepSeek from saved settings');
            this.eventBus.emit('agent:configure:deepseek', {
                apiKey: settings.deepseek.apiKey,
                defaultModel: settings.deepseek.defaultModel
            });
        }

        // Apply OpenAI settings
        if (settings.openai?.apiKey) {
            console.log('🔧 Configuring OpenAI from saved settings');
            this.eventBus.emit('agent:configure:openai', {
                apiKey: settings.openai.apiKey,
                defaultModel: settings.openai.defaultModel,
                organization: settings.openai.organization
            });
        }

        // Apply Anthropic settings
        if (settings.anthropic?.apiKey) {
            console.log('🔧 Configuring Anthropic from saved settings');
            this.eventBus.emit('agent:configure:anthropic', {
                apiKey: settings.anthropic.apiKey,
                defaultModel: settings.anthropic.defaultModel,
                anthropicVersion: settings.anthropic.anthropicVersion
            });
        }

        // Apply Gemini settings
        if (settings.gemini?.apiKey) {
            console.log('🔧 Configuring Gemini from saved settings');
            this.eventBus.emit('agent:configure:gemini', {
                apiKey: settings.gemini.apiKey,
                defaultModel: settings.gemini.defaultModel
            });
        }
    }

    // Animation helpers
    animateMessageIn(element) {
        element.style.opacity = '0';
        element.style.transform = 'translateY(10px)';
        
        setTimeout(() => {
            element.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
            element.style.opacity = '1';
            element.style.transform = 'translateY(0)';
        }, 50);
    }

    // Utility methods
    setupAutoResize() {
        const resizeObserver = new ResizeObserver(entries => {
            this.handleResize();
        });
        
        if (this.elements.chatContainer) {
            resizeObserver.observe(this.elements.chatContainer);
        }
    }

    setupScrollBehavior() {
        // Implement custom scroll behavior if needed
    }

    setupTooltips() {
        // Initialize tooltips for buttons
        const buttons = document.querySelectorAll('[title]');
        buttons.forEach(button => {
            // Add tooltip behavior
        });
    }

    handleResize() {
        const isMobile = window.innerWidth < 768;
        
        // Prevent horizontal overflow
        document.body.style.maxWidth = '100vw';
        document.body.style.overflowX = 'hidden';
        
        // Ensure app container doesn't expand beyond viewport
        const app = document.getElementById('app');
        if (app) {
            app.style.maxWidth = '100vw';
            app.style.overflowX = 'hidden';
        }
        
        // Ensure chat container doesn't expand beyond viewport
        const chatContainer = document.getElementById('chat-container');
        if (chatContainer) {
            chatContainer.style.maxWidth = '100%';
            chatContainer.style.overflowX = 'hidden';
        }
        
        // Ensure chat messages don't expand beyond container
        const chatMessages = document.getElementById('chat-messages');
        if (chatMessages) {
            chatMessages.style.maxWidth = '100%';
            chatMessages.style.overflowX = 'hidden';
        }
        
        if (isMobile && !this.sidebarCollapsed) {
            this.toggleSidebar();
        }
        
        // Force word wrapping on all message content
        const messageElements = document.querySelectorAll('.message .prose');
        messageElements.forEach(element => {
            element.style.wordWrap = 'break-word';
            element.style.wordBreak = 'break-word';
            element.style.overflowWrap = 'break-word';
            element.style.maxWidth = '100%';
            element.style.overflowX = 'hidden';
        });
    }

    cleanup() {
        // Clean up event listeners and resources
        this.eventBus.removeAllListeners('ui:*');
    }

    /**
     * Show quick language selector modal
     */
    showQuickLanguageSelector() {
        const languages = Array.from(this.languageSettings.supportedLanguages.entries());
        const currentLang = this.languageSettings.speechInputLanguage;
        
        const languageOptions = languages.map(([code, config]) => {
            const selected = code === currentLang ? 'bg-chat-primary text-white' : 'hover:bg-chat-hover';
            return `
                <button class="w-full text-left p-3 rounded-lg ${selected} transition-colors" 
                        onclick="window.mcpApp.uiManager.selectSpeechLanguage('${code}')">
                    <div class="font-medium">${config.name}</div>
                    <div class="text-sm opacity-75">${config.speechLang}</div>
                </button>
            `;
        }).join('');

        const modalContent = `
            <div class="bg-chat-light rounded-lg p-6 max-w-md w-full max-h-96 overflow-y-auto">
                <h3 class="text-lg font-semibold mb-4 text-chat-text">
                    <i class="fas fa-globe mr-2"></i>Select Speech Input Language
                </h3>
                <p class="text-sm text-chat-secondary mb-4">
                    Choose the language you'll be speaking in conversation mode.
                </p>
                <div class="space-y-2">
                    ${languageOptions}
                </div>
                <div class="mt-6 flex justify-end">
                    <button onclick="window.mcpApp.uiManager.hideModal()" 
                            class="px-4 py-2 bg-chat-hover text-chat-text rounded-lg hover:bg-chat-border transition-colors">
                        Cancel
                    </button>
                </div>
            </div>
        `;

        this.showModal(modalContent);
    }

    /**
     * Select speech language and update UI
     */
    selectSpeechLanguage(langCode) {
        console.log(`🌍 Quick language selection: ${langCode}`);
        
        // Update both input and output language settings
        this.languageSettings.speechInputLanguage = langCode;
        this.languageSettings.speechOutputLanguage = langCode; // Also update output language for voice selection
        
        // Update the language setting
        this.updateSpeechRecognitionLanguage(langCode);
        
        // Update the language button display
        const languageBtn = document.getElementById('language-selector-btn');
        if (languageBtn) {
            const langName = this.languageSettings.supportedLanguages.get(langCode)?.name || langCode;
            languageBtn.innerHTML = `<i class="fas fa-globe mr-1"></i>${langName}`;
        }
        
        // Close modal
        this.hideModal();
        
        // Show confirmation
        this.showNotification({
            message: `Speech language set to ${this.languageSettings.supportedLanguages.get(langCode)?.name || langCode}`,
            type: 'success',
            duration: 2000
        });
        
        // Save only language settings to avoid overwriting API keys
        this.saveLanguageSettingsOnly();
        
        // Log the change for debugging
        console.log('🎤 Language settings updated:', {
            inputLanguage: this.languageSettings.speechInputLanguage,
            outputLanguage: this.languageSettings.speechOutputLanguage
        });
    }

    /**
     * Save only language settings without affecting other settings
     */
    saveLanguageSettingsOnly() {
        try {
            // Load existing settings first
            const existingSettings = JSON.parse(localStorage.getItem('mcp-tabajara-settings') || '{}');
            
            // Update only the language section
            existingSettings.language = {
                speechInputLanguage: this.languageSettings.speechInputLanguage,
                speechOutputLanguage: this.languageSettings.speechOutputLanguage,
                preferredVoice: this.languageSettings.preferredVoice
            };
            
            // Save back to localStorage
            localStorage.setItem('mcp-tabajara-settings', JSON.stringify(existingSettings));
            
            console.log('✅ Language settings saved without affecting other settings');
        } catch (error) {
            console.error('Failed to save language settings:', error);
        }
    }

    /**
     * Remove emojis from text while preserving accents and special characters
     * This prevents speech synthesis from reading emoji descriptions
     */
    removeEmojisForSpeech(text) {
        // Comprehensive emoji regex that covers:
        // - Basic emoji range (U+1F600-U+1F64F) - Emoticons
        // - Miscellaneous symbols (U+1F300-U+1F5FF) - Misc symbols and pictographs
        // - Transport symbols (U+1F680-U+1F6FF) - Transport and map symbols
        // - Regional indicators (U+1F1E0-U+1F1FF) - Flag sequences
        // - Supplemental symbols (U+1F700-U+1F77F)
        // - Geometric shapes (U+1F780-U+1F7FF)
        // - Supplemental arrows (U+1F800-U+1F8FF)
        // - Additional symbols (U+1F900-U+1F9FF) - Supplemental symbols
        // - Chess symbols (U+1FA00-U+1FA6F)
        // - Symbols and pictographs (U+1FA70-U+1FAFF)
        // - Extended pictographs (U+1FB00-U+1FBFF)
        // - Miscellaneous symbols (U+2600-U+26FF) - Weather, zodiac, etc.
        // - Dingbats (U+2700-U+27BF)
        // - Variation selectors (U+FE00-U+FE0F) - Emoji variation selectors
        // - Other common emojis
        const emojiRegex = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{1F700}-\u{1F77F}]|[\u{1F780}-\u{1F7FF}]|[\u{1F800}-\u{1F8FF}]|[\u{1F900}-\u{1F9FF}]|[\u{1FA00}-\u{1FA6F}]|[\u{1FA70}-\u{1FAFF}]|[\u{1FB00}-\u{1FBFF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{FE00}-\u{FE0F}]|[\u{1F004}]|[\u{1F0CF}]|[\u{1F170}-\u{1F251}]|[\u{1F004}]|[\u{1F18E}]|[\u{3030}]|[\u{2B50}]|[\u{2B55}]|[\u{2934}-\u{2935}]|[\u{2B05}-\u{2B07}]|[\u{2B1B}-\u{2B1C}]|[\u{3297}]|[\u{3299}]|[\u{303D}]|[\u{00A9}]|[\u{00AE}]|[\u{2122}]|[\u{23E9}-\u{23EF}]|[\u{25AA}-\u{25AB}]|[\u{25B6}]|[\u{25C0}]|[\u{25FB}-\u{25FE}]|[\u{2600}-\u{2601}]|[\u{260E}]|[\u{2611}]|[\u{2614}-\u{2615}]|[\u{2618}]|[\u{261D}]|[\u{2620}]|[\u{2622}-\u{2623}]|[\u{2626}]|[\u{262A}]|[\u{262E}-\u{262F}]|[\u{2638}-\u{263A}]|[\u{2640}]|[\u{2642}]|[\u{2648}-\u{2653}]|[\u{2660}]|[\u{2663}]|[\u{2665}-\u{2666}]|[\u{2668}]|[\u{267B}]|[\u{267F}]|[\u{2692}-\u{2697}]|[\u{2699}]|[\u{269B}-\u{269C}]|[\u{26A0}-\u{26A1}]|[\u{26AA}-\u{26AB}]|[\u{26B0}-\u{26B1}]|[\u{26BD}-\u{26BE}]|[\u{26C4}-\u{26C5}]|[\u{26C8}]|[\u{26CE}-\u{26CF}]|[\u{26D1}]|[\u{26D3}-\u{26D4}]|[\u{26E9}-\u{26EA}]|[\u{26F0}-\u{26F5}]|[\u{26F7}-\u{26FA}]|[\u{26FD}]/gu;
        
        // Remove emojis but preserve spaces to maintain text flow
        let cleanText = text.replace(emojiRegex, '');
        
        // Also remove zero-width joiners and other invisible characters used in compound emojis
        cleanText = cleanText.replace(/[\u{200D}\u{FE0F}]/gu, '');
        
        // Clean up multiple spaces that might result from emoji removal
        cleanText = cleanText.replace(/\s+/g, ' ').trim();
        
        // Log emoji removal for debugging
        if (text !== cleanText) {
            const removedEmojis = text.match(emojiRegex) || [];
            console.log('🚫 Removed emojis for speech synthesis:', {
                original: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
                cleaned: cleanText.substring(0, 100) + (cleanText.length > 100 ? '...' : ''),
                removedCount: removedEmojis.length,
                removedEmojis: removedEmojis.slice(0, 10) // Show first 10 emojis removed
            });
        }
        
        return cleanText;
    }

    /**
     * Populate voice selector with available voices
     */
    populateVoiceSelector() {
        const voiceSelect = document.getElementById('preferred-voice-select');
        if (!voiceSelect) return;

        // Clear existing options except the first one
        while (voiceSelect.children.length > 1) {
            voiceSelect.removeChild(voiceSelect.lastChild);
        }

        const allVoices = window.speechSynthesis.getVoices();
        
        // Group voices by language for better organization
        const voicesByLang = new Map();
        allVoices.forEach(voice => {
            const langCode = voice.lang.substring(0, 2);
            if (!voicesByLang.has(langCode)) {
                voicesByLang.set(langCode, []);
            }
            voicesByLang.get(langCode).push(voice);
        });

        // Add voices organized by language
        Array.from(voicesByLang.entries())
            .sort(([a], [b]) => {
                // Prioritize current languages
                const currentLangs = [this.languageSettings.speechInputLanguage, this.languageSettings.speechOutputLanguage];
                if (currentLangs.includes(a) && !currentLangs.includes(b)) return -1;
                if (!currentLangs.includes(a) && currentLangs.includes(b)) return 1;
                return a.localeCompare(b);
            })
            .forEach(([langCode, voices]) => {
                const langName = this.languageSettings.supportedLanguages.get(langCode)?.name || langCode.toUpperCase();
                
                // Add language group header
                const optgroup = document.createElement('optgroup');
                optgroup.label = `${langName} (${voices.length} voices)`;
                
                voices.forEach(voice => {
                    const option = document.createElement('option');
                    option.value = voice.name;
                    option.textContent = `${voice.name} ${voice.localService ? '(Local)' : '(Online)'}`;
                    
                    // Mark as selected if it's the current preferred voice
                    if (this.languageSettings.preferredVoice === voice.name) {
                        option.selected = true;
                    }
                    
                    optgroup.appendChild(option);
                });
                
                voiceSelect.appendChild(optgroup);
            });

        console.log(`🎤 Populated voice selector with ${allVoices.length} voices`);
    }

    /**
     * Toggle auto-scroll behavior
     */
    toggleAutoScroll() {
        this.autoScroll = !this.autoScroll;
        
        // Show notification about auto-scroll state
        this.showNotification({
            message: `Auto-scroll ${this.autoScroll ? 'enabled' : 'disabled'}`,
            type: this.autoScroll ? 'success' : 'info',
            duration: 2000
        });
        
        // If auto-scroll is enabled and we're not at the bottom, scroll to bottom
        if (this.autoScroll) {
            this.forceScrollToBottom();
        }
        
        // Close modal if it's open
        this.hideModal();
        
        console.log(`Auto-scroll ${this.autoScroll ? 'enabled' : 'disabled'}`);
    }

    /**
     * Check if user is near the bottom of the chat
     */
    isNearBottom() {
        if (!this.elements.chatContainer) {
            return true;
        }
        
        const container = this.elements.chatContainer;
        const scrollHeight = container.scrollHeight;
        const clientHeight = container.clientHeight;
        const maxScrollTop = scrollHeight - clientHeight;
        const currentScrollTop = container.scrollTop;
        
        // Consider "near bottom" if within 50px of the bottom
        return currentScrollTop >= maxScrollTop - 50;
    }

    /**
     * Show scroll to bottom button when user has scrolled up
     */
    showScrollToBottomButton() {
        if (!this.isNearBottom()) {
            // Create or show scroll to bottom button
            let scrollButton = document.getElementById('scroll-to-bottom-btn');
            if (!scrollButton) {
                scrollButton = document.createElement('button');
                scrollButton.id = 'scroll-to-bottom-btn';
                scrollButton.className = 'fixed bottom-20 right-6 bg-chat-primary text-white p-3 rounded-full shadow-lg hover:bg-green-600 transition-colors z-40';
                scrollButton.innerHTML = '<i class="fas fa-chevron-down"></i>';
                scrollButton.title = 'Scroll to bottom';
                scrollButton.onclick = () => {
                    this.forceScrollToBottom();
                    this.hideScrollToBottomButton();
                };
                document.body.appendChild(scrollButton);
            }
            scrollButton.style.display = 'block';
        }
    }

    /**
     * Hide scroll to bottom button
     */
    hideScrollToBottomButton() {
        const scrollButton = document.getElementById('scroll-to-bottom-btn');
        if (scrollButton) {
            scrollButton.style.display = 'none';
        }
    }

    /**
     * Show chat context menu
     */
    showChatContextMenu(chat, event) {
        // Remove any existing context menus
        const existingMenus = document.querySelectorAll('.chat-context-menu');
        existingMenus.forEach(menu => menu.remove());
        
        const menu = document.createElement('div');
        menu.className = 'chat-context-menu fixed bg-chat-light border border-chat-border rounded-lg shadow-lg z-50 py-1 min-w-48';
        menu.style.left = `${event.clientX}px`;
        menu.style.top = `${event.clientY}px`;
        
        const menuItems = [
            {
                icon: 'fas fa-edit',
                label: 'Rename',
                action: () => this.renameChat(chat)
            },
            {
                icon: 'fas fa-download',
                label: 'Export',
                action: () => this.exportChat(chat.id)
            },
            {
                icon: 'fas fa-archive',
                label: 'Archive',
                action: () => this.archiveChat(chat.id)
            },
            {
                icon: 'fas fa-trash',
                label: 'Delete',
                action: () => this.deleteChat(chat.id),
                danger: true
            }
        ];
        
        menuItems.forEach(item => {
            const menuItem = document.createElement('div');
            menuItem.className = `flex items-center space-x-3 px-4 py-2 hover:bg-chat-hover cursor-pointer transition-colors ${item.danger ? 'text-chat-error hover:text-red-400' : 'text-chat-text'}`;
            
            menuItem.innerHTML = `
                <i class="${item.icon} text-sm w-4"></i>
                <span class="text-sm">${item.label}</span>
            `;
            
            menuItem.addEventListener('click', () => {
                item.action();
                menu.remove();
            });
            
            menu.appendChild(menuItem);
        });
        
        document.body.appendChild(menu);
        
        // Close menu when clicking outside
        const closeMenu = (e) => {
            if (!menu.contains(e.target)) {
                menu.remove();
                document.removeEventListener('click', closeMenu);
            }
        };
        
        // Delay to prevent immediate closure
        setTimeout(() => {
            document.addEventListener('click', closeMenu);
        }, 100);
    }

    /**
     * Rename chat
     */
    renameChat(chat) {
        const modalContent = `
            <div class="space-y-4">
                <h3 class="text-lg font-semibold">Rename Chat</h3>
                <div>
                    <label class="block text-sm font-medium mb-2">Chat Title</label>
                    <input type="text" id="chat-title-input" 
                           value="${chat.title || 'New Chat'}" 
                           class="w-full bg-chat-input border border-chat-border rounded-lg px-3 py-2 text-chat-text focus:outline-none focus:ring-2 focus:ring-chat-primary"
                           placeholder="Enter chat title">
                </div>
                <div class="flex justify-end space-x-2">
                    <button onclick="window.mcpApp.uiManager.hideModal()" 
                            class="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700">
                        Cancel
                    </button>
                    <button onclick="window.mcpApp.uiManager.saveChatTitle('${chat.id}')" 
                            class="px-4 py-2 bg-chat-primary text-white rounded hover:bg-green-600">
                        Save
                    </button>
                </div>
            </div>
        `;
        
        this.showModal(modalContent);
        
        // Focus the input
        setTimeout(() => {
            const input = document.getElementById('chat-title-input');
            if (input) {
                input.focus();
                input.select();
            }
        }, 100);
    }

    /**
     * Save chat title
     */
    saveChatTitle(chatId) {
        const input = document.getElementById('chat-title-input');
        const newTitle = input?.value?.trim();
        
        if (newTitle) {
            this.eventBus.emit('chat:rename', chatId, newTitle);
        }
        
        this.hideModal();
    }

    /**
     * Export chat
     */
    exportChat(chatId) {
        this.eventBus.emit('chat:export', chatId);
    }

    /**
     * Archive chat
     */
    archiveChat(chatId) {
        // This would be implemented in ChatManager
        this.eventBus.emit('chat:archive', chatId);
    }

    /**
     * Delete chat with confirmation
     */
    deleteChat(chatId) {
        const modalContent = `
            <div class="space-y-4">
                <div class="flex items-center space-x-3">
                    <div class="w-10 h-10 bg-chat-error rounded-lg flex items-center justify-center">
                        <i class="fas fa-exclamation-triangle text-white"></i>
                    </div>
                    <div>
                        <h3 class="text-lg font-semibold">Delete Chat</h3>
                        <p class="text-sm text-chat-secondary">This action cannot be undone.</p>
                    </div>
                </div>
                <div class="flex justify-end space-x-2">
                    <button onclick="window.mcpApp.uiManager.hideModal()" 
                            class="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700">
                        Cancel
                    </button>
                    <button onclick="window.mcpApp.uiManager.confirmDeleteChat('${chatId}')" 
                            class="px-4 py-2 bg-chat-error text-white rounded hover:bg-red-600">
                        Delete
                    </button>
                </div>
            </div>
        `;
        
        this.showModal(modalContent);
    }

    /**
     * Confirm delete chat
     */
    confirmDeleteChat(chatId) {
        this.eventBus.emit('chat:delete', chatId);
        this.hideModal();
    }

    /**
     * Handle chat search
     */
    handleChatSearch(query) {
        this.currentSearchQuery = query.toLowerCase().trim();
        this.filterChats();
    }

    /**
     * Set active filter
     */
    setActiveFilter(filter) {
        this.currentFilter = filter;
        
        // Update filter button states
        const filterButtons = [this.elements.filterAll, this.elements.filterRecent, this.elements.filterArchived];
        filterButtons.forEach((btn, index) => {
            if (btn) {
                const filters = ['all', 'recent', 'archived'];
                if (filters[index] === filter) {
                    btn.className = 'filter-btn active px-3 py-1 text-xs rounded-full bg-chat-primary text-white';
                } else {
                    btn.className = 'filter-btn px-3 py-1 text-xs rounded-full bg-chat-input text-chat-secondary hover:bg-chat-hover';
                }
            }
        });
        
        this.filterChats();
    }

    /**
     * Filter chats based on search query and active filter
     */
    filterChats() {
        if (!this.allChats) return;
        
        let filteredChats = [...this.allChats];
        
        // Apply search filter
        if (this.currentSearchQuery) {
            filteredChats = filteredChats.filter(chat => 
                chat.title?.toLowerCase().includes(this.currentSearchQuery) ||
                chat.metadata?.tags?.some(tag => tag.toLowerCase().includes(this.currentSearchQuery))
            );
        }
        
        // Apply category filter
        switch (this.currentFilter) {
            case 'recent':
                const oneWeekAgo = new Date();
                oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
                filteredChats = filteredChats.filter(chat => 
                    new Date(chat.timestamp) > oneWeekAgo
                );
                break;
            case 'archived':
                filteredChats = filteredChats.filter(chat => 
                    chat.metadata?.archived === true
                );
                break;
            case 'all':
            default:
                // Show all non-archived chats
                filteredChats = filteredChats.filter(chat => 
                    !chat.metadata?.archived
                );
                break;
        }
        
        this.updateChatHistory(filteredChats);
        this.updateEmptyState(filteredChats.length === 0);
    }

    /**
     * Update empty state visibility
     */
    updateEmptyState(isEmpty) {
        if (this.elements.emptyChatState) {
            this.elements.emptyChatState.style.display = isEmpty ? 'flex' : 'none';
        }
    }

    // ========== FILE ATTACHMENT UI METHODS ==========

    /**
     * Handle file selection for attachments
     */
    handleFileSelection(event) {
        const files = Array.from(event.target.files);
        if (files.length === 0) return;

        // Store files in pending attachments for processing
        this.pendingAttachments = files;

        // Get current provider for validation
        const currentProvider = this.getCurrentProvider();
        
        // Validate files for the current provider
        this.eventBus.emit('attachment:validate', {
            files: files,
            providerId: currentProvider
        });

        // Show attachment preview
        this.showAttachmentPreview(files);
    }

    /**
     * Show attachment preview
     */
    showAttachmentPreview(files) {
        if (!this.elements.attachmentContainer) return;

        this.elements.attachmentContainer.style.display = 'block';
        
        // Clear existing preview
        if (this.elements.attachmentList) {
            this.elements.attachmentList.innerHTML = '';
        }

        // Add each file to the preview
        files.forEach((file, index) => {
            const fileElement = this.createAttachmentElement(file, index);
            if (this.elements.attachmentList) {
                this.elements.attachmentList.appendChild(fileElement);
            }
        });

        // Update attachment info
        this.updateAttachmentInfo(files);
    }

    /**
     * Create attachment element for preview
     */
    createAttachmentElement(file, index) {
        const element = document.createElement('div');
        element.className = 'attachment-item';
        element.dataset.fileIndex = index;

        const icon = this.getFileIcon(file.type);
        const size = this.formatFileSize(file.size);

        element.innerHTML = `
            <div class="attachment-icon">${icon}</div>
            <div class="attachment-details">
                <div class="attachment-name">${file.name}</div>
                <div class="attachment-size">${size}</div>
            </div>
            <button class="attachment-remove" onclick="this.removeAttachment(${index})">×</button>
        `;

        return element;
    }

    /**
     * Get file icon based on type
     */
    getFileIcon(mimeType) {
        const icons = {
            'text/': '📄',
            'image/': '🖼️',
            'application/pdf': '📕',
            'application/json': '🔧',
            'application/xml': '📰',
            'text/csv': '📊',
            'application/javascript': '⚙️',
            'text/html': '🌐'
        };

        for (const [type, icon] of Object.entries(icons)) {
            if (mimeType.startsWith(type)) {
                return icon;
            }
        }

        return '📎'; // Default attachment icon
    }

    /**
     * Update attachment info display
     */
    updateAttachmentInfo(files) {
        if (!this.elements.attachmentInfo) return;

        const totalSize = files.reduce((sum, file) => sum + file.size, 0);
        const sizeText = this.formatFileSize(totalSize);
        
        this.elements.attachmentInfo.textContent = `${files.length} file(s) - ${sizeText}`;
    }

    /**
     * Remove attachment from preview
     */
    removeAttachment(index) {
        const attachmentItems = this.elements.attachmentList?.querySelectorAll('.attachment-item');
        if (attachmentItems && attachmentItems[index]) {
            attachmentItems[index].remove();
        }

        // Hide container if no attachments left
        const remainingItems = this.elements.attachmentList?.querySelectorAll('.attachment-item');
        if (!remainingItems || remainingItems.length === 0) {
            this.hideAttachmentPreview();
        }
    }

    /**
     * Remove current attachment
     */
    removeCurrentAttachment() {
        this.hideAttachmentPreview();
        if (this.elements.fileInput) {
            this.elements.fileInput.value = '';
        }
    }

    /**
     * Hide attachment preview
     */
    hideAttachmentPreview() {
        if (this.elements.attachmentContainer) {
            this.elements.attachmentContainer.style.display = 'none';
        }
    }

    /**
     * Update message attachments display
     */
    updateMessageAttachments(messageId, attachments) {
        const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
        if (!messageElement) return;

        const attachmentContainer = messageElement.querySelector('.message-attachments');
        if (!attachmentContainer) return;

        // Clear existing attachments
        attachmentContainer.innerHTML = '';

        // Add new attachments
        attachments.forEach(attachment => {
            const attachmentElement = this.createMessageAttachmentElement(attachment);
            attachmentContainer.appendChild(attachmentElement);
        });
    }

    /**
     * Create attachment element for message display
     */
    createMessageAttachmentElement(attachment) {
        const element = document.createElement('div');
        element.className = 'message-attachment';
        element.dataset.attachmentId = attachment.id;

        // If this is an image, show a preview
        if (attachment.type && attachment.type.startsWith('image/')) {
            element.classList.add('image-attachment');
            const img = document.createElement('img');
            img.className = 'attachment-image-preview max-w-xs max-h-60 rounded border border-chat-border cursor-pointer';
            img.alt = attachment.name;
            img.title = attachment.name;
            
            // Prefer processedData.data (base64), fallback to url, then object URL
            let imageSrc = null;
            if (attachment.processedData && attachment.processedData.data) {
                imageSrc = attachment.processedData.data;
            } else if (attachment.url) {
                imageSrc = attachment.url;
            } else if (attachment.file) {
                imageSrc = URL.createObjectURL(attachment.file);
            }
            
            if (imageSrc) {
                img.src = imageSrc;
            }
            
            // Click to enlarge modal (optional, if you have showImageModal)
            if (typeof this.showImageModal === 'function') {
                img.onclick = () => this.showImageModal(img.src, attachment.name);
            }
            // Image info (name and size)
            const info = document.createElement('div');
            info.className = 'attachment-image-info text-xs text-chat-secondary mt-1';
            info.textContent = `${attachment.name} (${this.formatFileSize(attachment.size)})`;
            element.appendChild(img);
            element.appendChild(info);
        } else {
            // Default file display
            const icon = this.getFileIcon(attachment.type);
            const size = this.formatFileSize(attachment.size);
            element.innerHTML = `
                <div class="attachment-icon">${icon}</div>
                <div class="attachment-details">
                    <div class="attachment-name">${attachment.name}</div>
                    <div class="attachment-size">${size}</div>
                </div>
            `;
        }
        return element;
    }

    /**
     * Update attachment capabilities display
     */
    updateAttachmentCapabilities(capabilities) {
        // Update UI to show what file types are supported by current provider
        const currentProvider = this.getCurrentProvider();
        const providerCapabilities = capabilities[currentProvider];
        
        if (providerCapabilities) {
            // Update file input accept attribute
            if (this.elements.fileInput) {
                this.elements.fileInput.accept = providerCapabilities.supportedTypes.join(',');
            }
            
            // Show provider-specific attachment info
            this.showProviderAttachmentInfo(providerCapabilities);
        }
    }

    /**
     * Show provider-specific attachment information
     */
    showProviderAttachmentInfo(capabilities) {
        const maxSizeMB = (capabilities.maxFileSize / 1024 / 1024).toFixed(1);
        const supportedTypes = capabilities.supportedTypes.join(', ');
        
        // Update attachment info or show notification
        this.showNotification({
            message: `${capabilities.name} supports: ${supportedTypes} (max ${maxSizeMB}MB per file, ${capabilities.maxFiles} files max)`,
            type: 'info',
            duration: 3000
        });
    }

    /**
     * Get current provider ID
     */
    getCurrentProvider() {
        // Get the current selected model from the model selector
        const modelSelector = this.elements.modelSelector;
        if (modelSelector && modelSelector.value) {
            const selectedModel = modelSelector.value;
            
            // Extract provider from model ID (format: provider:model)
            if (selectedModel.includes(':')) {
                return selectedModel.split(':')[0];
            }
            
            // If no provider prefix, try to determine from model name
            const modelName = selectedModel.toLowerCase();
            if (modelName.includes('gpt') || modelName.includes('openai')) {
                return 'openai';
            } else if (modelName.includes('claude') || modelName.includes('anthropic')) {
                return 'anthropic';
            } else if (modelName.includes('gemini')) {
                return 'gemini';
            } else if (modelName.includes('deepseek')) {
                return 'deepseek';
            } else if (modelName.includes('gemma') || modelName.includes('llama') || modelName.includes('mistral')) {
                return 'lmstudio';
            }
        }
        
        // Default to OpenAI if no provider can be determined
        return 'openai';
    }

    /**
     * Get current attachments from the UI
     */
    getCurrentAttachments() {
        // First check if we have pending attachments (files being processed)
        if (this.pendingAttachments && this.pendingAttachments.length > 0) {
            return this.pendingAttachments;
        }

        const attachmentItems = this.elements.attachmentList?.querySelectorAll('.attachment-item');
        if (!attachmentItems || attachmentItems.length === 0) {
            return [];
        }

        // Get all files from the file input
        const fileInput = this.elements.fileInput;
        if (!fileInput || !fileInput.files) {
            return [];
        }

        // Convert FileList to Array for easier handling
        const files = Array.from(fileInput.files);
        
        // Return all files (the UI should maintain the correct order)
        return files;
    }

    /**
     * Clear current attachments from the UI
     */
    clearCurrentAttachments() {
        // Clear the file input
        if (this.elements.fileInput) {
            this.elements.fileInput.value = '';
        }
        
        // Clear pending attachments
        this.pendingAttachments = [];
        
        // Hide the attachment container
        this.hideAttachmentPreview();
    }

    /**
     * Debug the file attachment system
     */
    async debugAttachmentSystem() {
        try {
            console.log('🐛 [DEBUG] Starting file attachment system debug...');
            
            // Create a test file
            const testContent = 'This is a test file for debugging the attachment system.';
            const testFile = new File([testContent], 'test-debug.txt', { type: 'text/plain' });
            
            console.log('📁 [DEBUG] Test file created:', {
                name: testFile.name,
                type: testFile.type,
                size: testFile.size
            });
            
            // Test UI attachment handling
            const uiFiles = [testFile];
            console.log('📤 [DEBUG] UI files ready:', uiFiles.length);
            
            // Test getCurrentProvider
            const currentProvider = this.getCurrentProvider();
            console.log('🎯 [DEBUG] Current provider:', currentProvider);
            
            // Test getCurrentAttachments (simulate)
            const currentAttachments = uiFiles;
            console.log('📎 [DEBUG] Current attachments:', currentAttachments.length);
            
            // Simulate sending message with attachments
            const messageData = {
                content: 'Debug test: Please analyze this file',
                type: 'user',
                attachments: currentAttachments,
                providerId: currentProvider
            };
            
            console.log('📤 [DEBUG] Sending message with attachments:', {
                content: messageData.content,
                attachments: messageData.attachments.length,
                providerId: messageData.providerId
            });
            
            // Emit the event to test the flow
            this.eventBus.emit('chat:message:send', messageData);
            
            // Show notification
            this.showNotification({
                message: 'Debug test completed! Check console for details.',
                type: 'info',
                duration: 5000
            });
            
        } catch (error) {
            console.error('❌ [DEBUG] File attachment debug failed:', error);
            this.showNotification({
                message: `Debug failed: ${error.message}`,
                type: 'error',
                duration: 5000
            });
        }
    }
} 