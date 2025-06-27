# Settings Loss Issue - Root Cause and Fix

## What Happened

The application lost all saved API keys and LM Studio configuration due to a bug in the voice language selection feature. Here's what occurred:

### Root Cause

1. **Problem in `selectSpeechLanguage` method**: When I added voice language switching functionality, I included a call to `this.saveSettings()` to persist the language preference.

2. **Flawed `saveSettings()` method**: The `saveSettings()` method reads values from DOM elements (input fields) rather than from the current application state. When the settings modal is not open, these DOM elements are either empty or don't exist.

3. **API Key Overwrite**: When `saveSettings()` was called during language selection, it read empty values from the DOM and overwrote the existing API keys with empty strings.

### The Bug

```javascript
// In selectSpeechLanguage method (BEFORE FIX)
selectSpeechLanguage(langCode) {
    // ... update language settings ...
    
    // ❌ This was the problem - it overwrote all settings
    this.saveSettings(); // Reads from DOM, overwrites API keys
}

// In saveSettings method (the problematic part)
saveSettings() {
    const settings = {
        openai: {
            apiKey: document.getElementById('openai-api-key')?.value, // ❌ Empty if modal not open
            // ...
        },
        // ... other providers
    };
    // This overwrote existing settings with empty values
}
```

## The Fix

### 1. Created Targeted Save Method

Instead of using the full `saveSettings()` method, I created a targeted method that only saves language settings:

```javascript
// NEW: saveLanguageSettingsOnly method
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
```

### 2. Updated Language Selection

```javascript
// FIXED: selectSpeechLanguage method
selectSpeechLanguage(langCode) {
    // ... update language settings ...
    
    // ✅ Now uses targeted save method
    this.saveLanguageSettingsOnly(); // Only saves language, preserves API keys
}
```

## Recovery Process

### Immediate Recovery

1. **Run the recovery script**:
   ```bash
   node restore-settings.js
   ```

2. **Manual restoration** (if you have your API keys):
   ```javascript
   // In browser console
   const settings = JSON.parse(localStorage.getItem('mcp-tabajara-settings') || '{}');
   settings.openai = { apiKey: "your-openai-key", defaultModel: "gpt-4o-mini" };
   settings.anthropic = { apiKey: "your-anthropic-key", defaultModel: "claude-3-5-sonnet-20241022" };
   settings.deepseek = { apiKey: "your-deepseek-key", defaultModel: "deepseek-chat" };
   localStorage.setItem('mcp-tabajara-settings', JSON.stringify(settings));
   ```

### Prevention Measures

1. **Settings Backup**: Consider implementing automatic settings backup
2. **Validation**: Add validation before saving settings
3. **Selective Updates**: Use targeted save methods for specific settings
4. **Testing**: Test settings changes in isolated environments

## Files Modified

- `js/modules/ui/UIManager.js`: Fixed `selectSpeechLanguage` method and added `saveLanguageSettingsOnly`
- `restore-settings.js`: Created recovery script
- `SETTINGS_LOSS_FIX.md`: This documentation

## Testing the Fix

1. **Test language switching**: Change voice language and verify API keys remain intact
2. **Test settings persistence**: Verify language preferences are saved correctly
3. **Test API functionality**: Ensure all providers still work after language changes

## Lessons Learned

1. **Always preserve existing data** when updating partial settings
2. **Test settings changes** thoroughly before deployment
3. **Use targeted methods** for specific functionality rather than full system saves
4. **Implement backup strategies** for critical user data
5. **Validate DOM state** before reading from form elements

## Future Improvements

1. **Settings Backup System**: Implement automatic backup of settings
2. **Settings Validation**: Add validation before saving any settings
3. **Settings Migration**: Add versioning and migration for settings format
4. **Error Recovery**: Implement automatic recovery from corrupted settings
5. **User Notifications**: Warn users before making destructive changes 