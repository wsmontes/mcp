/**
 * Chat Manager - Handles chat sessions, messages, and chat history
 * Implements the Repository and Command patterns
 */
export class ChatManager {
    constructor(eventBus, storageManager) {
        this.eventBus = eventBus;
        this.storageManager = storageManager;
        this.currentChatId = null;
        this.currentChat = null;
        this.chatHistory = new Map();
        this.messageQueue = [];
        this.isProcessing = false;
    }

    async initialize() {
        this.setupEventListeners();
        await this.loadChatHistory();
        console.log('💬 Chat Manager initialized');
    }

    /**
     * Set up event listeners
     */
    setupEventListeners() {
        this.eventBus.on('chat:new', () => {
            this.createNewChat();
        });

        this.eventBus.on('chat:select', (chatId) => {
            this.selectChat(chatId);
        });

        this.eventBus.on('chat:message:send', async (messageData) => {
            await this.sendMessage(messageData);
        });

        this.eventBus.on('chat:delete', async (chatId) => {
            await this.deleteChat(chatId);
        });

        this.eventBus.on('chat:rename', async (chatId, newTitle) => {
            await this.renameChat(chatId, newTitle);
        });

        this.eventBus.on('chat:clear', async () => {
            await this.clearCurrentChat();
        });

        this.eventBus.on('chat:export', (chatId) => {
            this.exportChat(chatId);
        });

        this.eventBus.on('chat:quick-action', (action) => {
            this.handleQuickAction(action);
        });

        this.eventBus.on('chat:message:store', async (message) => {
            await this.storeStreamingMessage(message);
        });

        this.eventBus.on('message:delete', async (data) => {
            await this.deleteMessage(data.messageId, data.chatId);
        });

        this.eventBus.on('message:edit', async (data) => {
            await this.editMessage(data.messageId, data.newContent, data.chatId);
        });

        this.eventBus.on('message:regenerate', async (data) => {
            await this.regenerateMessage(data.messageId, data.chatId);
        });
    }

    /**
     * Load chat history from storage
     */
    async loadChatHistory() {
        try {
            const chats = await this.storageManager.getAll('chats');
            
            // Sort by timestamp (newest first)
            chats.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            
            // Store in map for quick access
            chats.forEach(chat => {
                this.chatHistory.set(chat.id, chat);
            });

            // Load the most recent chat if exists
            if (chats.length > 0) {
                this.selectChat(chats[0].id);
            } else {
                this.createNewChat();
            }

            this.eventBus.emit('chat:history:loaded', Array.from(this.chatHistory.values()));
        } catch (error) {
            console.error('Failed to load chat history:', error);
            this.createNewChat();
        }
    }

    /**
     * Create a new chat session
     */
    async createNewChat() {
        const chatId = this.generateChatId();
        const newChat = {
            id: chatId,
            title: 'New Chat',
            timestamp: new Date().toISOString(),
            lastMessageTime: new Date().toISOString(),
            messageCount: 0,
            metadata: {
                model: 'default',
                parameters: {},
                tags: []
            }
        };

        try {
            await this.storageManager.create('chats', newChat);
            this.chatHistory.set(chatId, newChat);
            this.selectChat(chatId);
            
            this.eventBus.emit('chat:created', newChat);
            this.eventBus.emit('chat:history:updated', Array.from(this.chatHistory.values()));
        } catch (error) {
            console.error('Failed to create new chat:', error);
            this.eventBus.emit('ui:error', { message: 'Failed to create new chat' });
        }
    }

    /**
     * Select a chat session
     */
    async selectChat(chatId) {
        if (this.currentChatId === chatId) return;

        try {
            const chat = this.chatHistory.get(chatId);
            if (!chat) {
                throw new Error(`Chat ${chatId} not found`);
            }

            this.currentChatId = chatId;
            this.currentChat = chat;

            // Load messages for this chat
            const messages = await this.loadChatMessages(chatId);
            
            this.eventBus.emit('chat:selected', chatId);
            this.eventBus.emit('chat:messages:loaded', messages);
            this.eventBus.emit('ui:chat:title', chat.title);
        } catch (error) {
            console.error('Failed to select chat:', error);
            this.eventBus.emit('ui:error', { message: 'Failed to load chat' });
        }
    }

    /**
     * Send a message in the current chat
     */
    async sendMessage(messageData) {
        if (!this.currentChatId) {
            await this.createNewChat();
        }

        const message = {
            id: this.generateMessageId(),
            chatId: this.currentChatId,
            role: messageData.role || 'user',
            content: messageData.content,
            timestamp: new Date().toISOString(),
            metadata: messageData.metadata || {}
        };

        try {
            // Save user message
            await this.storageManager.create('messages', message);
            
            // Update chat title if this is the first message
            if (this.currentChat.messageCount === 0) {
                const title = this.generateChatTitle(message.content);
                await this.updateChatTitle(this.currentChatId, title);
            }

            // Update chat metadata
            await this.updateChatLastMessage(this.currentChatId);

            // Emit message received event
            this.eventBus.emit('chat:message:received', message);

            // Send to MCP agent for processing
            this.eventBus.emit('agent:message:process', {
                chatId: this.currentChatId,
                message: message
            });

        } catch (error) {
            console.error('Failed to send message:', error);
            this.eventBus.emit('ui:error', { message: 'Failed to send message' });
        }
    }

    /**
     * Store a streaming message (called when streaming finishes)
     */
    async storeStreamingMessage(message) {
        try {
            await this.storageManager.create('messages', message);
            await this.updateChatLastMessage(message.chatId);
        } catch (error) {
            console.error('Failed to store streaming message:', error);
        }
    }

    /**
     * Add an assistant response message
     */
    async addAssistantMessage(chatId, content, metadata = {}) {
        const message = {
            id: this.generateMessageId(),
            chatId: chatId,
            role: 'assistant',
            content: content,
            timestamp: new Date().toISOString(),
            metadata: metadata
        };

        try {
            await this.storageManager.create('messages', message);
            await this.updateChatLastMessage(chatId);
            
            this.eventBus.emit('chat:message:received', message);
        } catch (error) {
            console.error('Failed to add assistant message:', error);
        }
    }

    /**
     * Load messages for a specific chat
     */
    async loadChatMessages(chatId) {
        try {
            const messages = await this.storageManager.getAll('messages', 'chatId', chatId);
            return messages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        } catch (error) {
            console.error('Failed to load chat messages:', error);
            return [];
        }
    }

    /**
     * Delete a chat and all its messages
     */
    async deleteChat(chatId) {
        try {
            // Delete all messages
            const messages = await this.loadChatMessages(chatId);
            for (const message of messages) {
                await this.storageManager.delete('messages', message.id);
            }

            // Delete chat
            await this.storageManager.delete('chats', chatId);
            this.chatHistory.delete(chatId);

            // If this was the current chat, select another or create new
            if (this.currentChatId === chatId) {
                const remainingChats = Array.from(this.chatHistory.values());
                if (remainingChats.length > 0) {
                    this.selectChat(remainingChats[0].id);
                } else {
                    this.createNewChat();
                }
            }

            this.eventBus.emit('chat:deleted', chatId);
            this.eventBus.emit('chat:history:updated', Array.from(this.chatHistory.values()));
        } catch (error) {
            console.error('Failed to delete chat:', error);
            this.eventBus.emit('ui:error', { message: 'Failed to delete chat' });
        }
    }

    /**
     * Rename a chat
     */
    async renameChat(chatId, newTitle) {
        try {
            const chat = this.chatHistory.get(chatId);
            if (!chat) {
                throw new Error(`Chat ${chatId} not found`);
            }

            chat.title = newTitle;
            chat.timestamp = new Date().toISOString();

            await this.storageManager.update('chats', chat);
            this.chatHistory.set(chatId, chat);

            this.eventBus.emit('chat:renamed', chatId, newTitle);
            this.eventBus.emit('chat:history:updated', Array.from(this.chatHistory.values()));
        } catch (error) {
            console.error('Failed to rename chat:', error);
            this.eventBus.emit('ui:error', { message: 'Failed to rename chat' });
        }
    }

    /**
     * Clear all messages in the current chat
     */
    async clearCurrentChat() {
        if (!this.currentChatId) return;

        try {
            const messages = await this.loadChatMessages(this.currentChatId);
            for (const message of messages) {
                await this.storageManager.delete('messages', message.id);
            }

            // Reset chat metadata
            const chat = this.chatHistory.get(this.currentChatId);
            chat.messageCount = 0;
            chat.lastMessageTime = new Date().toISOString();
            
            await this.storageManager.update('chats', chat);
            this.chatHistory.set(this.currentChatId, chat);

            this.eventBus.emit('chat:cleared', this.currentChatId);
            this.eventBus.emit('chat:messages:loaded', []);
        } catch (error) {
            console.error('Failed to clear chat:', error);
            this.eventBus.emit('ui:error', { message: 'Failed to clear chat' });
        }
    }

    /**
     * Export chat as JSON
     */
    exportChat(chatId) {
        const chat = this.chatHistory.get(chatId || this.currentChatId);
        if (!chat) return;

        // This would typically load messages and create export
        this.loadChatMessages(chat.id).then(messages => {
            const exportData = {
                chat: chat,
                messages: messages,
                exportedAt: new Date().toISOString()
            };

            const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = `chat-${chat.title.replace(/[^a-zA-Z0-9]/g, '-')}-${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            
            URL.revokeObjectURL(url);
        });
    }

    /**
     * Delete a message
     */
    async deleteMessage(messageId, chatId) {
        try {
            await this.storageManager.delete('messages', messageId);
            
            // Update chat metadata
            const chat = this.chatHistory.get(chatId);
            if (chat && chat.messageCount > 0) {
                chat.messageCount -= 1;
                await this.storageManager.update('chats', chat);
                this.chatHistory.set(chatId, chat);
            }
            
        } catch (error) {
            console.error('Failed to delete message:', error);
        }
    }
    
    /**
     * Edit a message
     */
    async editMessage(messageId, newContent, chatId) {
        try {
            // Get the existing message
            const existingMessage = await this.storageManager.read('messages', messageId);
            if (existingMessage) {
                existingMessage.content = newContent;
                existingMessage.edited = true;
                existingMessage.editedAt = new Date().toISOString();
                
                await this.storageManager.update('messages', existingMessage);
            }
        } catch (error) {
            console.error('Failed to edit message:', error);
        }
    }
    
    /**
     * Regenerate a message (resend user message to get new AI response)
     */
    async regenerateMessage(messageId, chatId) {
        try {
            const message = await this.storageManager.read('messages', messageId);
            if (message && message.role === 'user') {
                // Send to MCP agent for processing
                this.eventBus.emit('agent:message:process', {
                    chatId: chatId,
                    message: message
                });
            }
        } catch (error) {
            console.error('Failed to regenerate message:', error);
        }
    }

    /**
     * Handle quick actions
     */
    handleQuickAction(action) {
        // Quick actions now require user to provide their own content
        // No predefined mock messages - user must type their own prompt
        this.eventBus.emit('ui:notification', {
            message: `Quick action "${action}" selected. Please type your message in the input area.`,
            type: 'info',
            duration: 3000
        });
    }

    /**
     * Update chat title
     */
    async updateChatTitle(chatId, title) {
        const chat = this.chatHistory.get(chatId);
        if (chat) {
            chat.title = title;
            await this.storageManager.update('chats', chat);
            this.chatHistory.set(chatId, chat);
            
            if (chatId === this.currentChatId) {
                this.eventBus.emit('ui:chat:title', title);
            }
        }
    }

    /**
     * Update chat last message timestamp and count
     */
    async updateChatLastMessage(chatId) {
        const chat = this.chatHistory.get(chatId);
        if (chat) {
            chat.lastMessageTime = new Date().toISOString();
            chat.messageCount += 1;
            await this.storageManager.update('chats', chat);
            this.chatHistory.set(chatId, chat);
        }
    }

    /**
     * Generate chat title from first message
     */
    generateChatTitle(content) {
        const words = content.trim().split(' ').slice(0, 6);
        return words.join(' ') + (content.split(' ').length > 6 ? '...' : '');
    }

    /**
     * Generate unique chat ID
     */
    generateChatId() {
        return 'chat_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    /**
     * Generate unique message ID
     */
    generateMessageId() {
        return 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    /**
     * Get current chat info
     */
    getCurrentChat() {
        return this.currentChat;
    }

    /**
     * Get all chats
     */
    getAllChats() {
        return Array.from(this.chatHistory.values());
    }

    /**
     * Search chats by title or content
     */
    async searchChats(query) {
        const results = [];
        const searchTerm = query.toLowerCase();

        for (const chat of this.chatHistory.values()) {
            if (chat.title.toLowerCase().includes(searchTerm)) {
                results.push(chat);
                continue;
            }

            // Search in messages
            const messages = await this.loadChatMessages(chat.id);
            const hasMatchingMessage = messages.some(msg => 
                msg.content.toLowerCase().includes(searchTerm)
            );

            if (hasMatchingMessage) {
                results.push(chat);
            }
        }

        return results;
    }

    /**
     * Save current state
     */
    async saveState() {
        // State is automatically saved through storage operations
        return Promise.resolve();
    }

    /**
     * Cleanup resources
     */
    cleanup() {
        this.chatHistory.clear();
        this.messageQueue.length = 0;
        this.currentChatId = null;
        this.currentChat = null;
    }
} 