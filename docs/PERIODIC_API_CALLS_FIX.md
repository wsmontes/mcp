# Periodic API Calls and Fallback Logic Fixes

## Issues Fixed

### 1. Periodic API Calls (Money Wasting)
**Problem**: The system was making unnecessary periodic API calls that cost money:
- Health checks every 30 seconds
- Model refresh every 5 minutes
- These calls were made even when no user interaction occurred

**Solution**: 
- Disabled periodic health monitoring by setting `healthCheckInterval: 0`
- Removed periodic model refresh timer
- Health checks and model refreshes now only happen during initialization and configuration changes

### 2. Claude Fallback (Unwanted Model Switching)
**Problem**: The system was automatically switching to Claude when other models failed, which was not desired behavior.

**Solution**:
- Disabled fallback logic by setting `fallbackEnabled: false`
- Modified `selectProviderForRequest()` to return `null` instead of switching providers
- Modified `selectModel()` to show error messages instead of switching to fallback models
- Updated `executeRequest()` to handle cases where no provider is available

## Changes Made

### AgnosticMCPManager.js

1. **Configuration Changes**:
   ```javascript
   this.config = {
       // ... other config
       fallbackEnabled: false, // Disable fallback to prevent unwanted model switching
       healthCheckInterval: 0  // Disable periodic health checks to prevent unnecessary API calls
   };
   ```

2. **Health Monitoring**:
   ```javascript
   startHealthMonitoring() {
       // Clear any existing timers
       if (this.healthCheckTimer) {
           clearInterval(this.healthCheckTimer);
           this.healthCheckTimer = null;
       }

       if (this.modelRefreshTimer) {
           clearInterval(this.modelRefreshTimer);
           this.modelRefreshTimer = null;
       }

       // Only start health monitoring if interval is greater than 0
       if (this.config.healthCheckInterval > 0) {
           this.healthCheckTimer = setInterval(async () => {
               await this.performHealthChecks();
           }, this.config.healthCheckInterval);
       } else {
           console.log('🔄 Health monitoring disabled to prevent unnecessary API calls');
       }

       // Disable periodic model refresh to prevent unnecessary API calls
       console.log('🔄 Periodic model refresh disabled to prevent unnecessary API calls');
   }
   ```

3. **Provider Selection**:
   ```javascript
   selectProviderForRequest(request) {
       // If a specific model is selected, find the provider that has this model
       if (request.options.model && request.options.providerId) {
           const provider = this.registry.getProviderInstance(request.options.providerId);
           if (provider && provider.isInitialized && this.isProviderConfigured(request.options.providerId, provider)) {
               console.log(`🎯 Using provider ${request.options.providerId} for model ${request.options.model}`);
               return request.options.providerId;
           } else {
               console.warn(`Provider ${request.options.providerId} for model ${request.options.model} is not available or properly configured.`);
               
               // Don't use fallback - return null to indicate failure
               if (!this.config.fallbackEnabled) {
                   console.log('❌ Fallback disabled - not switching to another provider');
                   return null;
               }
               
               return null;
           }
       }
       // ... rest of method
   }
   ```

4. **Model Selection**:
   ```javascript
   selectModel(modelData) {
       // ... model validation logic
       
       // Validate that the provider is properly configured
       const provider = this.registry.getProviderInstance(selectedModel.providerId);
       if (!provider || !this.isProviderConfigured(selectedModel.providerId, provider)) {
           console.warn(`⚠️ Provider ${selectedModel.providerId} for model ${selectedModel.id} is not properly configured`);
           
           // Don't use fallback - notify user to configure the provider
           this.eventBus.emit('ui:notification', {
               message: `Model ${selectedModel.id} requires API key configuration for ${selectedModel.providerName}. Please configure your API keys in settings.`,
               type: 'error'
           });
           return;
       }
       
       // ... rest of method
   }
   ```

## Benefits

1. **Cost Savings**: No more unnecessary API calls that waste money
2. **Predictable Behavior**: No unexpected model switching
3. **Better User Experience**: Clear error messages when models are not configured
4. **Performance**: Reduced network traffic and processing overhead

## Testing

Use the `test-fixes.js` script to verify the fixes:

```javascript
// Run in browser console
window.testFixes();
```

The test will verify:
- Health monitoring is disabled
- Timers are cleared
- Fallback logic is disabled
- Proper error handling for invalid requests

## Log Messages

Look for these log messages to confirm fixes are active:
- `🔄 Health monitoring disabled to prevent unnecessary API calls`
- `🔄 Periodic model refresh disabled to prevent unnecessary API calls`
- `❌ Fallback disabled - not switching to another provider`

## API Calls Still Made

The following API calls are still made (and should be):
- During initialization (to load available models)
- When configuring providers (to test connections)
- When user explicitly requests model refresh
- When making actual chat requests

These are necessary for functionality and user-initiated actions. 