/**
 * Storage Manager - Handles data persistence using IndexedDB with localStorage fallback
 * Implements Repository pattern for data access
 */
export class StorageManager {
    constructor() {
        this.dbName = 'MCPTabajaraDB';
        this.dbVersion = 1;
        this.db = null;
        this.isIndexedDBSupported = this.checkIndexedDBSupport();
        this.stores = {
            chats: 'chats',
            messages: 'messages',
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
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                this.createStores(db);
            };
        });
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

        if (this.isIndexedDBSupported && this.db) {
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
        const key = `${this.localStoragePrefix}${storeName}_${data.id}`;
        localStorage.setItem(key, JSON.stringify(data));
        return data;
    }

    async readLocalStorage(storeName, id) {
        const key = `${this.localStoragePrefix}${storeName}_${id}`;
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : null;
    }

    async updateLocalStorage(storeName, data) {
        const key = `${this.localStoragePrefix}${storeName}_${data.id}`;
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
} 