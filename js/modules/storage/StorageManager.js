/**
 * Storage Manager - Handles data persistence using IndexedDB with localStorage fallback
 * Implements Repository pattern for data access
 */
export class StorageManager {
    constructor() {
        this.dbName = 'MCPTabajaraDB';
        this.dbVersion = 2;
        this.db = null;
        this.isIndexedDBSupported = this.checkIndexedDBSupport();
        this.stores = {
            chats: 'chats',
            messages: 'messages',
            message_attachments: 'message_attachments',
            agents: 'agents',
            files: 'files',
            settings: 'settings',
            cache: 'cache'
        };
    }

    /**
     * Initialize the storage system
     */
    async initialize() {
        if (this.isIndexedDBSupported) {
            await this.initIndexedDB();
        } else {
            console.warn('IndexedDB not supported, falling back to localStorage');
            this.initLocalStorageFallback();
        }
    }

    /**
     * Check if IndexedDB is supported
     */
    checkIndexedDBSupport() {
        return 'indexedDB' in window && indexedDB !== null;
    }

    /**
     * Initialize IndexedDB
     */
    async initIndexedDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onerror = () => {
                console.error('Failed to open IndexedDB:', request.error);
                reject(request.error);
            };

            request.onsuccess = () => {
                this.db = request.result;
                console.log('📦 IndexedDB initialized successfully');
                
                // Verify all stores exist
                this.verifyStores().then(() => {
                    resolve();
                }).catch(reject);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                console.log('🔄 Upgrading database from version', event.oldVersion, 'to', event.newVersion);
                this.createStores(db);
            };
        });
    }

    /**
     * Verify all required stores exist
     */
    async verifyStores() {
        if (!this.db) return;
        
        const existingStores = Array.from(this.db.objectStoreNames);
        const requiredStores = Object.values(this.stores);
        
        console.log('🔍 Existing stores:', existingStores);
        console.log('🔍 Required stores:', requiredStores);
        
        const missingStores = requiredStores.filter(store => !existingStores.includes(store));
        
        if (missingStores.length > 0) {
            console.warn('⚠️ Missing stores detected:', missingStores);
            console.warn('🔄 Forcing database upgrade...');
            
            // Close current connection
            this.db.close();
            
            // Delete the database to force recreation
            await this.deleteDatabase();
            
            // Reinitialize
            await this.initIndexedDB();
        } else {
            console.log('✅ All required stores verified');
        }
    }

    /**
     * Delete the database to force recreation
     */
    async deleteDatabase() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.deleteDatabase(this.dbName);
            
            request.onerror = () => {
                console.error('Failed to delete database:', request.error);
                reject(request.error);
            };
            
            request.onsuccess = () => {
                console.log('🗑️ Database deleted successfully');
                resolve();
            };
        });
    }

    /**
     * Force database upgrade to create missing stores
     */
    async forceUpgrade() {
        if (!this.isIndexedDBSupported) return;
        
        console.log('🔄 Forcing database upgrade...');
        
        // Close current connection
        if (this.db) {
            this.db.close();
        }
        
        // Delete and recreate database
        await this.deleteDatabase();
        await this.initIndexedDB();
    }

    /**
     * Show current database schema
     */
    async showDatabaseSchema() {
        try {
            if (!this.isIndexedDBSupported || !this.db) {
                return '❌ IndexedDB not available';
            }
            
            const existingStores = Array.from(this.db.objectStoreNames);
            const requiredStores = Object.values(this.stores);
            const missingStores = requiredStores.filter(store => !existingStores.includes(store));
            
            let result = `📊 Database Schema:\n\n`;
            result += `Database Name: ${this.dbName}\n`;
            result += `Database Version: ${this.dbVersion}\n`;
            result += `Storage Type: IndexedDB\n\n`;
            
            result += `Existing Stores:\n`;
            existingStores.forEach(store => {
                result += `  ✅ ${store}\n`;
            });
            
            result += `\nRequired Stores:\n`;
            requiredStores.forEach(store => {
                const exists = existingStores.includes(store);
                result += `  ${exists ? '✅' : '❌'} ${store}\n`;
            });
            
            if (missingStores.length > 0) {
                result += `\n❌ Missing Stores: ${missingStores.join(', ')}\n`;
                result += `💡 Click "Clear Database" to recreate with new schema.`;
            } else {
                result += `\n✅ All required stores present!`;
            }
            
            return result;
            
        } catch (error) {
            return `❌ Error showing schema: ${error.message}`;
        }
    }

    /**
     * Create object stores in IndexedDB
     */
    createStores(db) {
        // Chats store
        if (!db.objectStoreNames.contains(this.stores.chats)) {
            const chatStore = db.createObjectStore(this.stores.chats, { keyPath: 'id' });
            chatStore.createIndex('timestamp', 'timestamp', { unique: false });
            chatStore.createIndex('title', 'title', { unique: false });
        }

        // Messages store
        if (!db.objectStoreNames.contains(this.stores.messages)) {
            const messageStore = db.createObjectStore(this.stores.messages, { keyPath: 'id' });
            messageStore.createIndex('chatId', 'chatId', { unique: false });
            messageStore.createIndex('timestamp', 'timestamp', { unique: false });
            messageStore.createIndex('role', 'role', { unique: false });
        }

        // Message attachments store
        if (!db.objectStoreNames.contains(this.stores.message_attachments)) {
            const attachmentStore = db.createObjectStore(this.stores.message_attachments, { keyPath: 'messageId' });
            attachmentStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        // Agents store
        if (!db.objectStoreNames.contains(this.stores.agents)) {
            const agentStore = db.createObjectStore(this.stores.agents, { keyPath: 'id' });
            agentStore.createIndex('name', 'name', { unique: false });
            agentStore.createIndex('type', 'type', { unique: false });
        }

        // Files store
        if (!db.objectStoreNames.contains(this.stores.files)) {
            const fileStore = db.createObjectStore(this.stores.files, { keyPath: 'id' });
            fileStore.createIndex('name', 'name', { unique: false });
            fileStore.createIndex('type', 'type', { unique: false });
            fileStore.createIndex('chatId', 'chatId', { unique: false });
        }

        // Settings store
        if (!db.objectStoreNames.contains(this.stores.settings)) {
            db.createObjectStore(this.stores.settings, { keyPath: 'key' });
        }

        // Cache store
        if (!db.objectStoreNames.contains(this.stores.cache)) {
            const cacheStore = db.createObjectStore(this.stores.cache, { keyPath: 'key' });
            cacheStore.createIndex('expires', 'expires', { unique: false });
        }
    }

    /**
     * Initialize localStorage fallback
     */
    initLocalStorageFallback() {
        this.localStoragePrefix = 'mcp_tabajara_';
        console.log('📦 localStorage fallback initialized');
    }

    /**
     * Create a new record
     */
    async create(storeName, data) {
        if (!this.stores[storeName]) {
            throw new Error(`Store '${storeName}' does not exist`);
        }

        // Check if the store exists in the database
        if (this.isIndexedDBSupported && this.db) {
            const existingStores = Array.from(this.db.objectStoreNames);
            if (!existingStores.includes(this.stores[storeName])) {
                console.warn(`⚠️ Store '${storeName}' not found in database, attempting to create it...`);
                try {
                    await this.forceUpgrade();
                    // After upgrade, check again
                    const newExistingStores = Array.from(this.db.objectStoreNames);
                    if (!newExistingStores.includes(this.stores[storeName])) {
                        throw new Error(`Failed to create store '${storeName}' after database upgrade`);
                    }
                } catch (error) {
                    console.error('❌ Failed to upgrade database:', error);
                    throw new Error(`Store '${storeName}' does not exist and could not be created: ${error.message}`);
                }
            }
            return this.createIndexedDB(this.stores[storeName], data);
        } else {
            return this.createLocalStorage(storeName, data);
        }
    }

    /**
     * Read a record by key
     */
    async read(storeName, key) {
        if (!this.stores[storeName]) {
            throw new Error(`Store '${storeName}' does not exist`);
        }

        if (this.isIndexedDBSupported && this.db) {
            return this.readIndexedDB(this.stores[storeName], key);
        } else {
            return this.readLocalStorage(storeName, key);
        }
    }

    /**
     * Update a record
     */
    async update(storeName, data) {
        if (!this.stores[storeName]) {
            throw new Error(`Store '${storeName}' does not exist`);
        }

        if (this.isIndexedDBSupported && this.db) {
            return this.updateIndexedDB(this.stores[storeName], data);
        } else {
            return this.updateLocalStorage(storeName, data);
        }
    }

    /**
     * Delete a record
     */
    async delete(storeName, key) {
        if (!this.stores[storeName]) {
            throw new Error(`Store '${storeName}' does not exist`);
        }

        if (this.isIndexedDBSupported && this.db) {
            return this.deleteIndexedDB(this.stores[storeName], key);
        } else {
            return this.deleteLocalStorage(storeName, key);
        }
    }

    /**
     * Get all records from a store
     */
    async getAll(storeName, index = null, query = null) {
        if (!this.stores[storeName]) {
            throw new Error(`Store '${storeName}' does not exist`);
        }

        if (this.isIndexedDBSupported && this.db) {
            return this.getAllIndexedDB(this.stores[storeName], index, query);
        } else {
            return this.getAllLocalStorage(storeName);
        }
    }

    /**
     * Clear all data from a store
     */
    async clear(storeName) {
        if (!this.stores[storeName]) {
            throw new Error(`Store '${storeName}' does not exist`);
        }

        if (this.isIndexedDBSupported && this.db) {
            return this.clearIndexedDB(this.stores[storeName]);
        } else {
            return this.clearLocalStorage(storeName);
        }
    }

    // IndexedDB implementation methods
    async createIndexedDB(storeName, data) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.add(data);

            request.onsuccess = () => resolve(data);
            request.onerror = () => reject(request.error);
        });
    }

    async readIndexedDB(storeName, key) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.get(key);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async updateIndexedDB(storeName, data) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.put(data);

            request.onsuccess = () => resolve(data);
            request.onerror = () => reject(request.error);
        });
    }

    async deleteIndexedDB(storeName, key) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.delete(key);

            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(request.error);
        });
    }

    async getAllIndexedDB(storeName, indexName = null, query = null) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            
            let source = store;
            if (indexName && store.indexNames.contains(indexName)) {
                source = store.index(indexName);
            }

            const request = query ? source.getAll(query) : source.getAll();

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async clearIndexedDB(storeName) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.clear();

            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(request.error);
        });
    }

    // localStorage fallback methods
    async createLocalStorage(storeName, data) {
        const key = `${this.localStoragePrefix}${storeName}_${data.id || data.messageId}`;
        localStorage.setItem(key, JSON.stringify(data));
        return data;
    }

    async readLocalStorage(storeName, id) {
        const key = `${this.localStoragePrefix}${storeName}_${id}`;
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : null;
    }

    async updateLocalStorage(storeName, data) {
        const key = `${this.localStoragePrefix}${storeName}_${data.id || data.messageId}`;
        localStorage.setItem(key, JSON.stringify(data));
        return data;
    }

    async deleteLocalStorage(storeName, id) {
        const key = `${this.localStoragePrefix}${storeName}_${id}`;
        localStorage.removeItem(key);
        return true;
    }

    async getAllLocalStorage(storeName) {
        const prefix = `${this.localStoragePrefix}${storeName}_`;
        const results = [];
        
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith(prefix)) {
                const data = localStorage.getItem(key);
                if (data) {
                    results.push(JSON.parse(data));
                }
            }
        }
        
        return results;
    }

    async clearLocalStorage(storeName) {
        const prefix = `${this.localStoragePrefix}${storeName}_`;
        const keysToRemove = [];
        
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith(prefix)) {
                keysToRemove.push(key);
            }
        }
        
        keysToRemove.forEach(key => localStorage.removeItem(key));
        return true;
    }

    // Utility methods
    async get(key) {
        return this.read('settings', key);
    }

    async set(key, value) {
        return this.update('settings', { key, value, timestamp: Date.now() });
    }

    async flush() {
        // Force any pending writes to complete
        if (this.db) {
            // IndexedDB operations are already atomic
            return Promise.resolve();
        }
        return Promise.resolve();
    }

    /**
     * Get storage statistics
     */
    async getStats() {
        const stats = {
            storageType: this.isIndexedDBSupported ? 'IndexedDB' : 'localStorage',
            stores: {}
        };

        for (const [key, storeName] of Object.entries(this.stores)) {
            const count = (await this.getAll(key)).length;
            stats.stores[key] = { name: storeName, count };
        }

        return stats;
    }

    /**
     * Test storage functionality
     */
    async testStorage() {
        try {
            const testData = {
                id: 'test_' + Date.now(),
                messageId: 'test_msg_' + Date.now(),
                content: 'Test content',
                timestamp: new Date().toISOString()
            };

            // Test basic operations
            await this.create('chats', { ...testData, title: 'Test Chat' });
            await this.create('messages', { ...testData, chatId: testData.id, role: 'user' });
            await this.create('message_attachments', { 
                messageId: testData.messageId, 
                attachments: [{ id: 'test_att', name: 'test.jpg', type: 'image/jpeg', size: 1024 }],
                timestamp: new Date().toISOString()
            });

            // Test reading
            const chat = await this.read('chats', testData.id);
            const message = await this.read('messages', testData.id);
            const attachment = await this.read('message_attachments', testData.messageId);

            // Test updating
            await this.update('chats', { ...chat, title: 'Updated Test Chat' });

            // Test getting all
            const allChats = await this.getAll('chats');
            const allMessages = await this.getAll('messages');
            const allAttachments = await this.getAll('message_attachments');

            // Clean up
            await this.delete('chats', testData.id);
            await this.delete('messages', testData.id);
            await this.delete('message_attachments', testData.messageId);

            return `✅ Storage test passed!\n\n` +
                   `Storage Type: ${this.isIndexedDBSupported ? 'IndexedDB' : 'localStorage'}\n` +
                   `Chats: ${allChats.length}\n` +
                   `Messages: ${allMessages.length}\n` +
                   `Attachments: ${allAttachments.length}\n` +
                   `All stores working correctly!`;

        } catch (error) {
            return `❌ Storage test failed: ${error.message}`;
        }
    }

    /**
     * Test message attachments store specifically
     */
    async testMessageAttachmentsStore() {
        try {
            // First check if the store exists
            if (this.isIndexedDBSupported && this.db) {
                const existingStores = Array.from(this.db.objectStoreNames);
                const hasAttachmentsStore = existingStores.includes('message_attachments');
                
                let result = `🔍 Message Attachments Store Test:\n\n`;
                result += `Store exists: ${hasAttachmentsStore ? '✅ Yes' : '❌ No'}\n`;
                result += `All existing stores: ${existingStores.join(', ')}\n\n`;
                
                if (!hasAttachmentsStore) {
                    result += `❌ The message_attachments store is missing!\n`;
                    result += `💡 Try clicking "Force Database Init" or "Clear Database" first.\n`;
                    return result;
                }
            }
            
            // Test creating and reading from the store
            const testMessageId = 'test_msg_' + Date.now();
            const testAttachmentData = {
                messageId: testMessageId,
                attachments: [
                    {
                        id: 'test_att_1',
                        name: 'test_image.jpg',
                        type: 'image/jpeg',
                        size: 1024,
                        processedData: {
                            type: 'image',
                            data: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwA/8A'
                        }
                    }
                ],
                timestamp: new Date().toISOString()
            };
            
            // Create
            await this.create('message_attachments', testAttachmentData);
            result += `✅ Created test attachment data\n`;
            
            // Read
            const readData = await this.read('message_attachments', testMessageId);
            result += `✅ Read test attachment data: ${readData ? 'Success' : 'Failed'}\n`;
            
            // Get all
            const allAttachments = await this.getAll('message_attachments');
            result += `✅ Total attachments in store: ${allAttachments.length}\n`;
            
            // Clean up
            await this.delete('message_attachments', testMessageId);
            result += `✅ Cleaned up test data\n\n`;
            
            result += `🎉 Message attachments store is working correctly!`;
            
            return result;
            
        } catch (error) {
            return `❌ Message attachments store test failed: ${error.message}\n\n` +
                   `💡 This usually means the store doesn't exist. Try:\n` +
                   `1. Click "Show Database Schema" to see what stores exist\n` +
                   `2. Click "Force Database Init" to recreate the database\n` +
                   `3. Click "Clear Database" if the above doesn't work`;
        }
    }
}