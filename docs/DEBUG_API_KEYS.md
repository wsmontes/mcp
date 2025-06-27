# Debugging API Key Issues

## Quick Diagnostic Steps

### 1. Check Browser Console
Open your browser's developer tools (F12) and run these commands:

```javascript
// Check what's stored in localStorage
console.log('Settings:', JSON.parse(localStorage.getItem('mcp-tabajara-settings') || '{}'));

// Check if the app is initialized
console.log('App initialized:', !!window.mcpApp);

// Test API key configuration
if (window.mcpApp) {
    window.testAPIKeys();
}
```

### 2. Common Issues and Solutions

#### Issue 1: Settings Not Saved
**Symptoms:** API keys appear to be set but 401 errors persist
**Check:** 
- Open browser dev tools → Application → Local Storage
- Look for `mcp-tabajara-settings` key
- Verify API keys are actually stored

#### Issue 2: Settings Saved But Not Applied
**Symptoms:** Settings are in localStorage but providers still show no API key
**Check:**
- Run `window.testAPIKeys()` in console
- Look for "No config found" or "No instance found" messages

#### Issue 3: Provider Instances Not Recreated
**Symptoms:** Settings are applied but old instances still running
**Solution:** 
- Refresh the page after saving settings
- Or manually reconfigure providers

### 3. Manual Provider Reconfiguration

If settings are saved but not working, try manually reconfiguring:

```javascript
// In browser console
const manager = window.mcpApp.mcpAgentManager;
const settings = JSON.parse(localStorage.getItem('mcp-tabajara-settings') || '{}');

// Reconfigure each provider
if (settings.openai?.apiKey) {
    await manager.configureProvider('openai', settings.openai);
}

if (settings.anthropic?.apiKey) {
    await manager.configureProvider('anthropic', settings.anthropic);
}

if (settings.deepseek?.apiKey) {
    await manager.configureProvider('deepseek', settings.deepseek);
}

// Refresh models
await manager.refreshAvailableModels();
```

### 4. API Key Validation

Check if your API keys are in the correct format:

- **OpenAI:** `sk-...` (starts with sk-)
- **Anthropic:** `sk-ant-...` (starts with sk-ant-)
- **DeepSeek:** `sk-...` (starts with sk- followed by hex characters)

### 5. Testing Individual Providers

Test each provider individually:

```javascript
// Test OpenAI
const openaiInstance = window.mcpApp.mcpAgentManager.registry.getProviderInstance('openai');
if (openaiInstance && openaiInstance.config?.apiKey) {
    try {
        const result = await openaiInstance.testConnection();
        console.log('OpenAI test result:', result);
    } catch (error) {
        console.log('OpenAI test failed:', error.message);
    }
}

// Test Anthropic
const anthropicInstance = window.mcpApp.mcpAgentManager.registry.getProviderInstance('anthropic');
if (anthropicInstance && anthropicInstance.config?.apiKey) {
    try {
        const result = await anthropicInstance.testConnection();
        console.log('Anthropic test result:', result);
    } catch (error) {
        console.log('Anthropic test failed:', error.message);
    }
}
```

### 6. Clear and Reset

If all else fails, clear everything and start fresh:

```javascript
// Clear all settings
localStorage.removeItem('mcp-tabajara-settings');
localStorage.removeItem('mcp_tabajara_config');

// Refresh the page
location.reload();
```

### 7. Check Network Tab

In browser dev tools → Network tab:
- Look for failed requests to API endpoints
- Check if API keys are being sent in headers
- Verify the proxy server is running (localhost:3001)

### 8. Proxy Server Status

Make sure the proxy server is running:
```bash
# Check if proxy is running
curl http://localhost:3001/health

# Should return: {"status":"ok","timestamp":"..."}
```

## Expected Behavior

When API keys are properly configured:

1. **Settings Modal:** API key fields should show your keys (masked)
2. **Console Logs:** Should show "✅ Provider initialized" messages
3. **Model Dropdown:** Should populate with available models
4. **Test Connection:** Should return success messages
5. **Network Requests:** Should not show 401 errors

## Troubleshooting Checklist

- [ ] API keys are in correct format
- [ ] Settings are saved in localStorage
- [ ] Provider instances are recreated after settings save
- [ ] Proxy server is running (for Anthropic)
- [ ] No JavaScript errors in console
- [ ] Network requests include proper headers
- [ ] API keys are valid and not expired

## Still Having Issues?

If you're still experiencing problems:

1. **Check the console logs** for any error messages
2. **Verify API key validity** by testing them directly with the APIs
3. **Try with just one provider** to isolate the issue
4. **Check if the issue is browser-specific** (try different browser)
5. **Clear browser cache and cookies** completely

## Debug Scripts

Use these scripts to help diagnose issues:

- `debug-settings.js` - Check localStorage settings
- `test-api-keys.js` - Test provider configurations
- `test-proxy.js` - Test proxy server functionality 