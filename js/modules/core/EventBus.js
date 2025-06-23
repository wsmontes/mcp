/**
 * Event-driven communication system
 * Implements the Observer pattern for decoupled module communication
 */
export class EventBus {
    constructor() {
        this.events = new Map();
        this.onceEvents = new Map();
        this.debugMode = false;
    }

    /**
     * Subscribe to an event
     * @param {string} eventName - The name of the event
     * @param {Function} callback - The callback function
     * @param {Object} context - Optional context for the callback
     * @returns {Function} Unsubscribe function
     */
    on(eventName, callback, context = null) {
        if (!this.events.has(eventName)) {
            this.events.set(eventName, []);
        }

        const listener = { callback, context };
        this.events.get(eventName).push(listener);

        if (this.debugMode) {
            console.log(`📡 Event listener added: ${eventName}`);
        }

        // Return unsubscribe function
        return () => this.off(eventName, callback);
    }

    /**
     * Subscribe to an event that will be called only once
     * @param {string} eventName - The name of the event
     * @param {Function} callback - The callback function
     * @param {Object} context - Optional context for the callback
     */
    once(eventName, callback, context = null) {
        if (!this.onceEvents.has(eventName)) {
            this.onceEvents.set(eventName, []);
        }

        const listener = { callback, context };
        this.onceEvents.get(eventName).push(listener);

        if (this.debugMode) {
            console.log(`📡 One-time event listener added: ${eventName}`);
        }
    }

    /**
     * Unsubscribe from an event
     * @param {string} eventName - The name of the event
     * @param {Function} callback - The callback function to remove
     */
    off(eventName, callback) {
        if (this.events.has(eventName)) {
            const listeners = this.events.get(eventName);
            const index = listeners.findIndex(listener => listener.callback === callback);
            
            if (index !== -1) {
                listeners.splice(index, 1);
                
                if (listeners.length === 0) {
                    this.events.delete(eventName);
                }

                if (this.debugMode) {
                    console.log(`📡 Event listener removed: ${eventName}`);
                }
            }
        }
    }

    /**
     * Emit an event
     * @param {string} eventName - The name of the event
     * @param {...any} args - Arguments to pass to the callbacks
     */
    emit(eventName, ...args) {
        if (this.debugMode) {
            console.log(`📡 Event emitted: ${eventName}`, args);
        }

        // Handle regular events
        if (this.events.has(eventName)) {
            const listeners = [...this.events.get(eventName)]; // Create a copy to avoid issues with modifications during iteration
            
            listeners.forEach(listener => {
                try {
                    if (listener.context) {
                        listener.callback.call(listener.context, ...args);
                    } else {
                        listener.callback(...args);
                    }
                } catch (error) {
                    console.error(`Error in event listener for ${eventName}:`, error);
                }
            });
        }

        // Handle once events
        if (this.onceEvents.has(eventName)) {
            const listeners = this.onceEvents.get(eventName);
            
            listeners.forEach(listener => {
                try {
                    if (listener.context) {
                        listener.callback.call(listener.context, ...args);
                    } else {
                        listener.callback(...args);
                    }
                } catch (error) {
                    console.error(`Error in one-time event listener for ${eventName}:`, error);
                }
            });

            // Remove all once listeners after execution
            this.onceEvents.delete(eventName);
        }
    }

    /**
     * Emit an event asynchronously
     * @param {string} eventName - The name of the event
     * @param {...any} args - Arguments to pass to the callbacks
     */
    async emitAsync(eventName, ...args) {
        if (this.debugMode) {
            console.log(`📡 Async event emitted: ${eventName}`, args);
        }

        const promises = [];

        // Handle regular events
        if (this.events.has(eventName)) {
            const listeners = [...this.events.get(eventName)];
            
            listeners.forEach(listener => {
                const promise = new Promise((resolve, reject) => {
                    try {
                        const result = listener.context 
                            ? listener.callback.call(listener.context, ...args)
                            : listener.callback(...args);
                        
                        if (result instanceof Promise) {
                            result.then(resolve).catch(reject);
                        } else {
                            resolve(result);
                        }
                    } catch (error) {
                        reject(error);
                    }
                });
                
                promises.push(promise);
            });
        }

        // Handle once events
        if (this.onceEvents.has(eventName)) {
            const listeners = this.onceEvents.get(eventName);
            
            listeners.forEach(listener => {
                const promise = new Promise((resolve, reject) => {
                    try {
                        const result = listener.context 
                            ? listener.callback.call(listener.context, ...args)
                            : listener.callback(...args);
                        
                        if (result instanceof Promise) {
                            result.then(resolve).catch(reject);
                        } else {
                            resolve(result);
                        }
                    } catch (error) {
                        reject(error);
                    }
                });
                
                promises.push(promise);
            });

            // Remove all once listeners after execution
            this.onceEvents.delete(eventName);
        }

        try {
            return await Promise.all(promises);
        } catch (error) {
            console.error(`Error in async event listeners for ${eventName}:`, error);
            throw error;
        }
    }

    /**
     * Remove all listeners for a specific event
     * @param {string} eventName - The name of the event
     */
    removeAllListeners(eventName) {
        if (this.events.has(eventName)) {
            this.events.delete(eventName);
        }
        
        if (this.onceEvents.has(eventName)) {
            this.onceEvents.delete(eventName);
        }

        if (this.debugMode) {
            console.log(`📡 All listeners removed for: ${eventName}`);
        }
    }

    /**
     * Clear all event listeners
     */
    clear() {
        this.events.clear();
        this.onceEvents.clear();

        if (this.debugMode) {
            console.log('📡 All event listeners cleared');
        }
    }

    /**
     * Get all event names that have listeners
     * @returns {string[]} Array of event names
     */
    getEventNames() {
        return [...new Set([...this.events.keys(), ...this.onceEvents.keys()])];
    }

    /**
     * Get listener count for an event
     * @param {string} eventName - The name of the event
     * @returns {number} Number of listeners
     */
    getListenerCount(eventName) {
        const regularCount = this.events.has(eventName) ? this.events.get(eventName).length : 0;
        const onceCount = this.onceEvents.has(eventName) ? this.onceEvents.get(eventName).length : 0;
        return regularCount + onceCount;
    }

    /**
     * Enable/disable debug mode
     * @param {boolean} enabled - Whether to enable debug mode
     */
    setDebugMode(enabled) {
        this.debugMode = enabled;
        console.log(`📡 EventBus debug mode: ${enabled ? 'enabled' : 'disabled'}`);
    }
} 