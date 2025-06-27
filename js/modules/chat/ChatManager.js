/**
 * Chat Manager - Handles chat sessions, messages, and chat history
 * Implements the Repository and Command patterns
 */
export class ChatManager {
    constructor(eventBus, storageManager, fileAttachmentManager = null) {
        this.eventBus = eventBus;
        this.storageManager = storageManager;
        this.fileAttachmentManager = fileAttachmentManager;
        this.currentChatId = null;
        this.currentChat = null;
        this.chatHistory = new Map();
        this.messageQueue = [];
        this.isProcessing = false;
        this.currentAttachments = new Map(); // Track attachments per message
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

        // Listen for assistant messages from agent managers and store them
        this.eventBus.on('chat:message:received', async (message) => {
            // Only store assistant messages (user messages are already stored in sendMessage)
            if (message.role === 'assistant') {
                try {
                    await this.storageManager.create('messages', message);
                    await this.updateChatLastMessage(message.chatId);
                    console.log('✅ Assistant message stored:', message.id);
                } catch (error) {
                    console.error('Failed to store assistant message:', error);
                }
            }
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

        this.eventBus.on('chat:archive', async (chatId) => {
            await this.archiveChat(chatId);
        });

        this.eventBus.on('message:attachments:add', async (data) => {
            await this.addAttachmentsToMessage(data.messageId, data.files, data.providerId);
        });

        this.eventBus.on('message:attachments:remove', async (data) => {
            await this.removeAttachmentsFromMessage(data.messageId, data.attachmentIds);
        });

        this.eventBus.on('message:attachments:clear', async (messageId) => {
            await this.clearMessageAttachments(messageId);
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

            this.eventBus.emit('chat:history:loaded', this.getSortedChats());
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
            this.eventBus.emit('chat:history:updated', this.getSortedChats());
            
            return newChat;
        } catch (error) {
            console.error('Failed to create new chat:', error);
            this.eventBus.emit('ui:error', { message: 'Failed to create new chat' });
            throw error;
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
            // Process file attachments if present
            let attachments = [];
            if (messageData.attachments && messageData.attachments.length > 0 && this.fileAttachmentManager) {
                try {
                    const providerId = messageData.providerId || 'openai'; // Default to OpenAI
                    const processedAttachments = await this.fileAttachmentManager.processAttachments(
                        messageData.attachments, 
                        providerId
                    );
                    attachments = processedAttachments.attachments;
                    
                    // Store full attachment info (for UI rendering)
                    message.metadata.attachments = attachments;
                    
                    // Store attachments for this message
                    this.currentAttachments.set(message.id, attachments);
                    
                    // Emit attachment processed event
                    this.eventBus.emit('attachment:processed', {
                        messageId: message.id,
                        attachments: attachments,
                        providerId: providerId
                    });
                    
                } catch (error) {
                    console.error('Failed to process attachments:', error);
                    this.eventBus.emit('attachment:error', { 
                        message: `Failed to process attachments: ${error.message}`,
                        messageId: message.id
                    });
                    this.eventBus.emit('ui:notification', {
                        message: `Failed to process attachments: ${error.message}`,
                        type: 'error'
                    });
                }
            }

            // Save user message (store only summary for storage)
            const storageMessage = { ...message };
            if (storageMessage.metadata && storageMessage.metadata.attachments) {
                // Store full attachment data separately for persistence
                if (attachments.length > 0) {
                    await this.storageManager.create('message_attachments', {
                        messageId: message.id,
                        attachments: attachments,
                        timestamp: new Date().toISOString()
                    });
                }
                
                // Keep only summary in main message
                storageMessage.metadata.attachments = storageMessage.metadata.attachments.map(att => ({
                    id: att.id,
                    name: att.name,
                    type: att.type,
                    size: att.size
                }));
            }
            await this.storageManager.create('messages', storageMessage);
            
            // Update chat title if this is the first message
            if (this.currentChat.messageCount === 0) {
                const title = this.generateChatTitle(message.content);
                await this.updateChatTitle(this.currentChatId, title);
            }

            // Update chat metadata
            await this.updateChatLastMessage(this.currentChatId);

            // Emit message received event (with full attachments for UI)
            this.eventBus.emit('chat:message:received', message);

            // Send to MCP agent for processing with attachments
            this.eventBus.emit('agent:message:process', {
                message: message,
                attachments: attachments,
                providerId: messageData.providerId
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
            
            // Restore full attachment data for messages that have attachments
            const restoredMessages = await Promise.all(messages.map(async (message) => {
                if (message.metadata?.attachments && message.metadata.attachments.length > 0) {
                    try {
                        // Try to load full attachment data from separate storage
                        const attachmentData = await this.storageManager.read('message_attachments', message.id);
                        if (attachmentData && attachmentData.attachments) {
                            // Restore full attachment data
                            message.metadata.attachments = attachmentData.attachments;
                            console.log(`🔄 [DEBUG] Restored full attachment data for message ${message.id}:`, 
                                attachmentData.attachments.map(att => ({ name: att.name, hasData: !!att.processedData?.data }))
                            );
                        } else {
                            console.log(`⚠️ [DEBUG] No full attachment data found for message ${message.id}, using summary data`);
                        }
                    } catch (error) {
                        console.log(`⚠️ [DEBUG] Failed to load attachment data for message ${message.id}:`, error.message);
                    }
                }
                return message;
            }));
            
            return restoredMessages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
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
                
                // Delete associated attachment data
                try {
                    await this.storageManager.delete('message_attachments', message.id);
                } catch (error) {
                    // Attachment data might not exist, ignore error
                }
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
            this.eventBus.emit('chat:history:updated', this.getSortedChats());
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
            this.eventBus.emit('chat:history:updated', this.getSortedChats());
        } catch (error) {
            console.error('Failed to rename chat:', error);
            this.eventBus.emit('ui:error', { message: 'Failed to rename chat' });
        }
    }

    /**
     * Clear current chat messages
     */
    async clearCurrentChat() {
        if (!this.currentChatId) return;

        try {
            // Delete all messages for this chat
            const messages = await this.loadChatMessages(this.currentChatId);
            for (const message of messages) {
                await this.storageManager.delete('messages', message.id);
                
                // Delete associated attachment data
                try {
                    await this.storageManager.delete('message_attachments', message.id);
                } catch (error) {
                    // Attachment data might not exist, ignore error
                }
            }

            // Reset chat metadata
            const chat = this.chatHistory.get(this.currentChatId);
            if (chat) {
                chat.messageCount = 0;
                chat.lastMessageTime = new Date().toISOString();
                await this.storageManager.update('chats', this.currentChatId, chat);
                this.chatHistory.set(this.currentChatId, chat);
            }

            this.eventBus.emit('chat:cleared', this.currentChatId);
            this.eventBus.emit('chat:messages:loaded', []);
            this.eventBus.emit('chat:history:updated', this.getSortedChats());
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
            // Delete the message
            await this.storageManager.delete('messages', messageId);
            
            // Delete associated attachment data
            try {
                await this.storageManager.delete('message_attachments', messageId);
            } catch (error) {
                // Attachment data might not exist, ignore error
                console.log(`No attachment data to delete for message ${messageId}`);
            }
            
            // Update chat metadata
            const chat = this.chatHistory.get(chatId);
            if (chat && chat.messageCount > 0) {
                chat.messageCount -= 1;
                await this.storageManager.update('chats', chat);
                this.chatHistory.set(chatId, chat);
                
                // Emit event to notify UI of chat update
                this.eventBus.emit('chat:updated', chat);
                this.eventBus.emit('chat:history:updated', this.getSortedChats());
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
            
            // Emit event to notify UI of chat update
            this.eventBus.emit('chat:updated', chat);
            this.eventBus.emit('chat:history:updated', this.getSortedChats());
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
            
            // Emit event to notify UI of chat update
            this.eventBus.emit('chat:updated', chat);
            this.eventBus.emit('chat:history:updated', this.getSortedChats());
        }
    }

    /**
     * Generate a chat title from the first message
     */
    generateChatTitle(content) {
        if (!content || typeof content !== 'string') {
            return 'New Chat';
        }

        // Clean the content
        let cleanContent = content.trim();
        
        // Remove markdown formatting
        cleanContent = cleanContent.replace(/\*\*(.*?)\*\*/g, '$1'); // Bold
        cleanContent = cleanContent.replace(/\*(.*?)\*/g, '$1'); // Italic
        cleanContent = cleanContent.replace(/`(.*?)`/g, '$1'); // Code
        cleanContent = cleanContent.replace(/\[(.*?)\]\(.*?\)/g, '$1'); // Links
        
        // Remove code blocks
        cleanContent = cleanContent.replace(/```[\s\S]*?```/g, '');
        
        // Get the first sentence or first 100 characters
        let title = cleanContent.split(/[.!?]/)[0].trim();
        
        if (title.length > 100) {
            title = title.substring(0, 100).trim();
            // Try to break at a word boundary
            const lastSpace = title.lastIndexOf(' ');
            if (lastSpace > 80) {
                title = title.substring(0, lastSpace);
            }
        }
        
        // If title is too short, use more content
        if (title.length < 10) {
            title = cleanContent.substring(0, 50).trim();
            const lastSpace = title.lastIndexOf(' ');
            if (lastSpace > 20) {
                title = title.substring(0, lastSpace);
            }
        }
        
        // Capitalize first letter
        title = title.charAt(0).toUpperCase() + title.slice(1);
        
        // Add ellipsis if truncated
        if (title.length >= 100) {
            title += '...';
        }
        
        return title || 'New Chat';
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

    /**
     * Archive a chat
     */
    async archiveChat(chatId) {
        try {
            const chat = this.chatHistory.get(chatId);
            if (!chat) {
                throw new Error(`Chat ${chatId} not found`);
            }

            // Update chat metadata
            chat.metadata = chat.metadata || {};
            chat.metadata.archived = true;
            chat.archivedAt = new Date().toISOString();

            // Update in storage
            await this.storageManager.update('chats', chatId, chat);
            this.chatHistory.set(chatId, chat);

            // If this was the current chat, create a new one
            if (this.currentChatId === chatId) {
                await this.createNewChat();
            }

            this.eventBus.emit('chat:archived', chatId);
            this.eventBus.emit('chat:history:updated', this.getSortedChats());
        } catch (error) {
            console.error('Failed to archive chat:', error);
            this.eventBus.emit('ui:error', { message: 'Failed to archive chat' });
        }
    }

    /**
     * Get sorted chats
     */
    getSortedChats() {
        return Array.from(this.chatHistory.values())
            .sort((a, b) => new Date(b.lastMessageTime) - new Date(a.lastMessageTime));
    }

    // ========== ATTACHMENT MANAGEMENT METHODS ==========

    /**
     * Add attachments to a message
     */
    async addAttachmentsToMessage(messageId, files, providerId) {
        if (!this.fileAttachmentManager) {
            throw new Error('File attachment manager not available');
        }

        try {
            const processedAttachments = await this.fileAttachmentManager.processAttachments(files, providerId);
            
            // Get existing attachments for this message
            const existingAttachments = this.currentAttachments.get(messageId) || [];
            const allAttachments = [...existingAttachments, ...processedAttachments.attachments];
            
            // Store updated attachments
            this.currentAttachments.set(messageId, allAttachments);
            
            // Update message metadata
            const message = await this.storageManager.get('messages', messageId);
            if (message) {
                message.metadata.attachments = allAttachments.map(att => ({
                    id: att.id,
                    name: att.name,
                    type: att.type,
                    size: att.size
                }));
                await this.storageManager.update('messages', messageId, message);
            }
            
            this.eventBus.emit('message:attachments:updated', {
                messageId: messageId,
                attachments: allAttachments
            });
            
            return processedAttachments;
        } catch (error) {
            console.error('Failed to add attachments to message:', error);
            throw error;
        }
    }

    /**
     * Remove attachments from a message
     */
    async removeAttachmentsFromMessage(messageId, attachmentIds) {
        const existingAttachments = this.currentAttachments.get(messageId) || [];
        const remainingAttachments = existingAttachments.filter(att => !attachmentIds.includes(att.id));
        
        this.currentAttachments.set(messageId, remainingAttachments);
        
        // Update message metadata
        const message = await this.storageManager.get('messages', messageId);
        if (message) {
            message.metadata.attachments = remainingAttachments.map(att => ({
                id: att.id,
                name: att.name,
                type: att.type,
                size: att.size
            }));
            await this.storageManager.update('messages', messageId, message);
        }
        
        this.eventBus.emit('message:attachments:updated', {
            messageId: messageId,
            attachments: remainingAttachments
        });
    }

    /**
     * Clear all attachments from a message
     */
    async clearMessageAttachments(messageId) {
        this.currentAttachments.delete(messageId);
        
        // Update message metadata
        const message = await this.storageManager.get('messages', messageId);
        if (message) {
            message.metadata.attachments = [];
            await this.storageManager.update('messages', messageId, message);
        }
        
        this.eventBus.emit('message:attachments:updated', {
            messageId: messageId,
            attachments: []
        });
    }

    /**
     * Get attachments for a message
     */
    getMessageAttachments(messageId) {
        return this.currentAttachments.get(messageId) || [];
    }

    /**
     * Validate attachments for a provider
     */
    async validateAttachments(files, providerId) {
        if (!this.fileAttachmentManager) {
            return { valid: false, error: 'File attachment manager not available' };
        }
        
        return await this.fileAttachmentManager.validateAttachments(files, providerId);
    }

    /**
     * Get provider attachment capabilities
     */
    getProviderAttachmentCapabilities(providerId) {
        if (!this.fileAttachmentManager) {
            return null;
        }
        
        return this.fileAttachmentManager.getProviderCapabilities(providerId);
    }
} 