// Main Application Entry Point
import { ChatManager } from './modules/chat/ChatManager.js';
import { UIManager } from './modules/ui/UIManager.js?v=30';
import { StorageManager } from './modules/storage/StorageManager.js';
import { AgnosticMCPManager } from './modules/agents/AgnosticMCPManager.js';
import { FileManager } from './modules/files/FileManager.js';
import { FileAttachmentManager } from './modules/files/FileAttachmentManager.js';
import { EventBus } from './modules/core/EventBus.js';
import { ConfigManager } from './modules/core/ConfigManager.js';

// Cache version for development
const CACHE_VERSION = 27;

class MCPTabajaraApp {
    constructor() {
        this.eventBus = new EventBus();
        this.configManager = new ConfigManager();
        this.storageManager = new StorageManager();
        this.uiManager = new UIManager(this.eventBus);
        this.fileManager = new FileManager(this.eventBus);
        this.fileAttachmentManager = new FileAttachmentManager(this.eventBus, this.fileManager);
        this.chatManager = new ChatManager(this.eventBus, this.storageManager, this.fileAttachmentManager);
        this.mcpAgentManager = new AgnosticMCPManager(this.eventBus);
        
        this.isInitialized = false;
    }

    async initialize() {
        try {
            console.log('🚀 Initializing MCP Tabajara Application...');
            
            // Initialize core services first
            await this.configManager.initialize();
            await this.storageManager.initialize();
            
            // Initialize managers
            await this.uiManager.initialize();
            await this.chatManager.initialize();
            await this.mcpAgentManager.initialize();
            await this.fileManager.initialize();
            await this.fileAttachmentManager.initialize();
            
            // Expose managers globally for debugging
            window.agnosticMCPManager = this.mcpAgentManager;
            window.storageManager = this.storageManager;
            window.eventBus = this.eventBus;
            window.fileAttachmentManager = this.fileAttachmentManager;
            
            // Set up event listeners
            this.setupEventListeners();
            
            // Load initial data
            await this.loadInitialData();
            
            this.isInitialized = true;
            console.log('✅ MCP Tabajara Application initialized successfully');
            
            // Emit application ready event
            this.eventBus.emit('app:ready');
            
        } catch (error) {
            console.error('❌ Failed to initialize application:', error);
            this.handleInitializationError(error);
        }
    }

    setupEventListeners() {
        // Global error handler
        window.addEventListener('error', (event) => {
            console.error('Global error:', event.error);
            this.eventBus.emit('app:error', event.error);
        });

        // Unhandled promise rejection
        window.addEventListener('unhandledrejection', (event) => {
            console.error('Unhandled promise rejection:', event.reason);
            this.eventBus.emit('app:error', event.reason);
        });

        // Application visibility change
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.eventBus.emit('app:hidden');
            } else {
                this.eventBus.emit('app:visible');
            }
        });

        // Before unload - save state
        window.addEventListener('beforeunload', () => {
            this.eventBus.emit('app:beforeunload');
        });

        // Debug event listeners for file attachment flow
        this.eventBus.on('chat:message:send', (data) => {
            console.log('🔍 [DEBUG] chat:message:send event:', {
                content: data.content?.substring(0, 50) + '...',
                attachments: data.attachments?.length || 0,
                providerId: data.providerId
            });
        });

        this.eventBus.on('agent:message:process', (data) => {
            console.log('🔍 [DEBUG] agent:message:process event:', {
                messageId: data.message?.id,
                chatId: data.message?.chatId,
                attachments: data.attachments?.length || 0,
                providerId: data.providerId
            });
        });

        this.eventBus.on('request:queued', (request) => {
            console.log('🔍 [DEBUG] request:queued event:', {
                requestId: request.id,
                chatId: request.chatId,
                attachments: request.attachments?.length || 0,
                options: request.options
            });
        });
    }

    async loadInitialData() {
        try {
            // Load chat history
            await this.chatManager.loadChatHistory();
            
            // Initialize MCP agents (loadAgents method is now handled by initialize)
            // The AgnosticMCPManager handles all provider registration and initialization automatically
            
            // Load user preferences
            const userPreferences = await this.storageManager.get('userPreferences');
            if (userPreferences) {
                this.eventBus.emit('preferences:loaded', userPreferences);
            }
            
        } catch (error) {
            console.error('Error loading initial data:', error);
        }
    }

    handleInitializationError(error) {
        // Show error message to user
        const errorContainer = document.createElement('div');
        errorContainer.className = 'fixed inset-0 bg-red-900 bg-opacity-90 flex items-center justify-center z-50';
        errorContainer.innerHTML = `
            <div class="bg-white rounded-lg p-6 max-w-md mx-4 text-center">
                <div class="text-red-600 text-6xl mb-4">⚠️</div>
                <h2 class="text-xl font-bold text-gray-900 mb-2">Initialization Failed</h2>
                <p class="text-gray-600 mb-4">The application failed to start properly.</p>
                <button onclick="location.reload()" class="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700">
                    Reload Application
                </button>
            </div>
        `;
        document.body.appendChild(errorContainer);
    }

    // Graceful shutdown
    async shutdown() {
        if (!this.isInitialized) return;
        
        console.log('🔄 Shutting down application...');
        
        try {
            // Save current state
            await this.chatManager.saveState();
            await this.storageManager.flush();
            
            // Clean up resources
            this.mcpAgentManager.cleanup();
            this.fileManager.cleanup();
            this.fileAttachmentManager.cleanup();
            this.uiManager.cleanup();
            
            this.isInitialized = false;
            console.log('✅ Application shutdown complete');
            
        } catch (error) {
            console.error('❌ Error during shutdown:', error);
        }
    }
}

// Initialize application when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
    window.mcpApp = new MCPTabajaraApp();
    await window.mcpApp.initialize();
});

// Handle page unload
window.addEventListener('beforeunload', async () => {
    if (window.mcpApp) {
        await window.mcpApp.shutdown();
    }
});

// Export for debugging
export { MCPTabajaraApp };

// Add mobile sidebar functionality
document.addEventListener('DOMContentLoaded', function() {
    // Detect iOS
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
                  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

    // Detect Chrome on iOS
    const isIOSChrome = isIOS && /CriOS/.test(navigator.userAgent);

    // Handle iOS viewport height issues
    function setIOSViewportHeight() {
        if (isIOS) {
            const vh = window.innerHeight * 0.01;
            document.documentElement.style.setProperty('--vh', `${vh}px`);
            
            // Ensure the app container uses the correct height
            const appContainer = document.getElementById('app');
            appContainer.style.height = `calc(var(--vh, 1vh) * 100)`;
            
            // Update header positioning
            const header = document.querySelector('.chat-header');
            if (header) {
                const safeAreaTop = getComputedStyle(document.documentElement)
                    .getPropertyValue('--safe-area-inset-top')
                    .replace('px', '');
                
                // Ensure header is visible and properly positioned
                header.style.top = `${safeAreaTop}px`;
            }
        }
    }

    // Call on initial load
    setIOSViewportHeight();

    // Handle orientation changes and resize events
    let resizeTimeout;
    window.addEventListener('resize', function() {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(setIOSViewportHeight, 100);
    });

    window.addEventListener('orientationchange', function() {
        // Wait for the orientation change to complete
        setTimeout(setIOSViewportHeight, 100);
    });

    // Handle iOS keyboard issues
    const messageInput = document.getElementById('message-input');
    const chatContainer = document.getElementById('chat-container');
    const inputArea = document.querySelector('.input-area');
    const header = document.querySelector('.chat-header');

    if (isIOS) {
        // Special handling for Chrome on iOS
        if (isIOSChrome) {
            // Ensure input is focusable
            messageInput.addEventListener('touchstart', function(e) {
                e.preventDefault();
                this.focus();
            });

            // Improve button click handling
            document.querySelectorAll('button, .quick-action-btn').forEach(button => {
                button.addEventListener('touchstart', function(e) {
                    e.preventDefault();
                    this.click();
                });
            });

            // Improve scroll handling
            chatContainer.addEventListener('touchmove', function(e) {
                e.stopPropagation();
            }, { passive: true });
        }

        // Prevent elastic scrolling
        document.body.style.overflow = 'hidden';
        chatContainer.style.overscrollBehavior = 'none';

        // Handle keyboard appearance
        messageInput.addEventListener('focus', function() {
            setTimeout(() => {
                // Ensure header stays visible
                header.style.position = 'sticky';
                header.style.top = '0';
                
                // Scroll to bottom
                chatContainer.scrollTop = chatContainer.scrollHeight;
                
                // Adjust for keyboard
                document.body.classList.add('keyboard-open');
                inputArea.style.position = 'relative';

                // Ensure input is in view
                this.scrollIntoView(false);
            }, 100);
        });

        messageInput.addEventListener('blur', function() {
            document.body.classList.remove('keyboard-open');
            inputArea.style.position = 'sticky';
            
            // Reset header position
            setIOSViewportHeight();
        });

        // Ensure header visibility on scroll
        chatContainer.addEventListener('scroll', function() {
            requestAnimationFrame(function() {
                if (chatContainer.scrollTop > 0) {
                    header.style.borderBottom = '1px solid var(--chat-border)';
                } else {
                    header.style.borderBottom = 'none';
                }
            });
        });

        // Improve touch handling for quick actions
        const quickActions = document.getElementById('quick-actions');
        if (quickActions) {
            let isScrolling = false;
            let startX;
            let scrollLeft;
            
            quickActions.addEventListener('touchstart', (e) => {
                isScrolling = true;
                startX = e.touches[0].pageX - quickActions.offsetLeft;
                scrollLeft = quickActions.scrollLeft;
            }, { passive: true });
            
            quickActions.addEventListener('touchmove', (e) => {
                if (!isScrolling) return;
                const x = e.touches[0].pageX - quickActions.offsetLeft;
                const walk = (x - startX) * 2;
                quickActions.scrollLeft = scrollLeft - walk;
            }, { passive: true });
            
            quickActions.addEventListener('touchend', () => {
                isScrolling = false;
            }, { passive: true });

            // Improve quick action button clicks
            quickActions.querySelectorAll('.quick-action-btn').forEach(btn => {
                btn.addEventListener('touchend', function(e) {
                    if (!isScrolling) {
                        e.preventDefault();
                        this.click();
                    }
                });
            });
        }
    }

    // Auto-expand textarea
    messageInput.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = (this.scrollHeight) + 'px';
    });

    // Handle iOS safe areas
    function updateSafeAreas() {
        const safeAreaTop = getComputedStyle(document.documentElement).getPropertyValue('--safe-area-inset-top');
        const safeAreaBottom = getComputedStyle(document.documentElement).getPropertyValue('--safe-area-inset-bottom');
        
        if (safeAreaTop && safeAreaBottom) {
            document.body.style.paddingTop = safeAreaTop;
            inputArea.style.paddingBottom = safeAreaBottom;
        }
    }

    // Update safe areas on orientation change
    window.addEventListener('orientationchange', function() {
        setTimeout(updateSafeAreas, 100);
    });

    // Initialize safe areas
    updateSafeAreas();

    // Existing sidebar functionality
    const sidebar = document.getElementById('sidebar');
    const toggleSidebarBtn = document.getElementById('toggle-sidebar');
    const closeSidebarBtn = document.getElementById('close-sidebar');
    
    function toggleSidebar() {
        sidebar.classList.toggle('active');
    }
    
    toggleSidebarBtn.addEventListener('click', toggleSidebar);
    closeSidebarBtn.addEventListener('click', toggleSidebar);
    
    document.addEventListener('click', function(event) {
        const isClickInside = sidebar.contains(event.target) || toggleSidebarBtn.contains(event.target);
        if (!isClickInside && sidebar.classList.contains('active')) {
            toggleSidebar();
        }
    });

    // Quick actions horizontal scroll optimization
    const quickActions = document.getElementById('quick-actions');
    if (quickActions) {
        let isScrolling = false;
        let startX;
        let scrollLeft;
        
        quickActions.addEventListener('touchstart', (e) => {
            isScrolling = true;
            startX = e.touches[0].pageX - quickActions.offsetLeft;
            scrollLeft = quickActions.scrollLeft;
        }, { passive: true });
        
        quickActions.addEventListener('touchmove', (e) => {
            if (!isScrolling) return;
            const x = e.touches[0].pageX - quickActions.offsetLeft;
            const walk = (x - startX) * 2;
            quickActions.scrollLeft = scrollLeft - walk;
        }, { passive: true });
        
        quickActions.addEventListener('touchend', () => {
            isScrolling = false;
        }, { passive: true });
    }
}); 