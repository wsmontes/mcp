# 🎙️ Conversation Mode - Hands-Free AI Chat

MCP Tabajara now features an advanced **Conversation Mode** that enables completely hands-free interaction with AI. Simply speak naturally and the AI will respond with voice, creating a seamless conversational experience.

## 🚀 Features

### Core Functionality
- **Continuous Voice Recognition**: Always listening for your voice input
- **Real-Time Speech Synthesis**: AI responses are spoken back to you
- **Automatic Turn-Taking**: Seamless conversation flow without manual intervention
- **Smart Silence Detection**: Automatically processes speech after natural pauses
- **Markdown-to-Speech**: Converts AI responses to natural speech (removes formatting)

### Language Support
- **35+ Languages Supported**: Full multilingual conversation capabilities
- **Manual Speech Input Language**: Select your speaking language before starting
- **Automatic AI Response Language**: AI responses automatically detect and use appropriate voices
- **Smart Voice Selection**: Intelligent voice mapping based on language and quality

### Speech Quality Enhancements
- **Smart Emoji Removal**: Automatically removes emojis from AI responses to prevent awkward descriptions
  - Preserves all accents and special characters (é, ñ, ü, ç, etc.)
  - Removes visual emojis while maintaining text meaning
  - Configurable in settings (can be disabled if preferred)
  - Comprehensive emoji detection covering all Unicode ranges
- **Markdown-to-Speech**: Converts AI responses to natural speech (removes formatting)
- **Intelligent Text Processing**: Cleans up text for optimal speech synthesis

## 🌍 Language Settings - How It Really Works

### The Reality of Speech Recognition

**Important:** Speech recognition technology has limitations that we address honestly:

#### ✅ What Works (AI Response Speech)
- **Automatic Language Detection**: AI responses are automatically detected and spoken in the correct language
- **Smart Voice Selection**: System automatically chooses the best voice for each language
- **Real-time Switching**: AI can respond in different languages as needed

#### ⚠️ What Requires Manual Setup (Your Speech Input)
- **Manual Language Selection**: You must select your speaking language before starting conversation mode
- **No Auto-Detection for Input**: Speech recognition cannot automatically detect what language you're speaking
- **Single Language Mode**: You can only speak in one language at a time (the one you selected)

### Why This Limitation Exists

The Web Speech Recognition API requires the language to be specified **before** listening begins. If you speak Spanish while the system expects English, it will produce poor transcripts. This is a fundamental limitation of current browser technology, not our implementation.

## 🎯 How to Use

### Setting Up Your Language

1. **Open Settings**: Click the gear icon (⚙️) in the chat interface
2. **Go to Language Settings**: Find the "Language Settings" section
3. **Select Speech Input Language**: Choose the language you'll be speaking
4. **Enable AI Response Auto-Detection**: Keep this checked for automatic AI voice selection
5. **Save Settings**: Your language preference will be remembered

### Starting Conversation Mode

1. **Set Your Language First**: Make sure your speech input language is correctly selected
2. **Click the Conversation Button**: Look for the speech bubble icon (💬) in the chat header
3. **Grant Microphone Permission**: Allow browser access to your microphone when prompted
4. **Start Speaking**: The system will listen in your selected language

### Using Conversation Mode

1. **Speak in Your Selected Language**: Talk naturally in the language you configured
2. **Wait for Processing**: After you finish speaking, wait 2 seconds for automatic processing
3. **Listen to AI Response**: The AI will automatically detect the response language and speak back
4. **Continue Conversation**: The system automatically resumes listening in your selected language

### Changing Languages Mid-Conversation

1. **Open Settings**: Click the gear icon while in conversation mode
2. **Change Speech Input Language**: Select a different language from the dropdown
3. **Continue Speaking**: The system will restart listening in the new language

## 🎛️ Language Settings

Access language settings through **Settings → Language Settings**:

### Speech Input Language (What You Speak)
- **Purpose**: Sets the language for speech recognition
- **Requirement**: Must be selected manually before speaking
- **Available Options**: 35+ languages including English, Spanish, French, German, Portuguese, Chinese, Japanese, Arabic, and more
- **Important**: Cannot be auto-detected - you must choose your language

### Auto-detect AI Response Language
- **Purpose**: Automatically detects the language of AI responses
- **How it Works**: Analyzes AI text and selects appropriate voice
- **Benefit**: AI can respond in different languages automatically
- **Recommendation**: Keep this enabled for best experience

## 🎛️ Voice Settings

Access voice settings through **Settings → Voice Settings**:

### Speech Rate
- **Range**: 0.1 (very slow) to 2.0 (very fast)
- **Default**: 1.0 (normal speed)
- **Use Case**: Adjust based on your listening preference

### Speech Pitch
- **Range**: 0.0 (very low) to 2.0 (very high)
- **Default**: 1.0 (normal pitch)
- **Use Case**: Customize voice character

### Speech Volume
- **Range**: 0.0 (mute) to 1.0 (maximum)
- **Default**: 0.8 (80% volume)
- **Use Case**: Balance with your system volume

### Silence Threshold
- **Range**: 500ms to 5000ms
- **Default**: 2000ms (2 seconds)
- **Use Case**: Control how long to wait before processing speech

## 🔧 Technical Details

### Supported Languages (35+)

**European Languages:**
- English, Spanish, French, German, Italian, Portuguese, Dutch
- Swedish, Norwegian, Danish, Finnish, Polish, Czech, Hungarian
- Russian, Ukrainian, Greek, Bulgarian, Romanian, Croatian
- Slovak, Slovenian, Estonian, Latvian, Lithuanian
- Catalan, Basque, Galician, Hebrew

**Asian Languages:**
- Chinese (Mandarin), Japanese, Korean, Hindi, Thai, Vietnamese

**Middle Eastern:**
- Arabic, Turkish, Hebrew

### Voice Recognition Technology
- **Technology**: Web Speech API (SpeechRecognition)
- **Language Setting**: Must be specified before listening
- **Mode**: Continuous recognition with interim results
- **Processing**: Final transcripts processed after silence threshold

### Speech Synthesis Technology
- **Technology**: Web Speech Synthesis API
- **Voice Selection**: Automatically selects best available voice for detected language
- **Quality Assessment**: Prefers Google and Microsoft voices when available
- **Fallback System**: Uses system default if language-specific voice unavailable

### State Management
- **Listening State**: Microphone active, transcribing in selected language
- **Processing State**: Sending message to AI, waiting for response
- **Speaking State**: AI response being synthesized in detected language
- **Auto-Resume**: Returns to listening in your selected language

## 🌐 Browser Compatibility

### Fully Supported
- **Chrome/Chromium**: ✅ Full support for all features and languages
- **Edge**: ✅ Full support with Microsoft voices
- **Safari**: ✅ Supported with Apple voices (limited language selection)

### Limited Support
- **Firefox**: ⚠️ Speech synthesis only (no speech recognition)
- **Mobile Browsers**: ⚠️ Limited speech recognition support

### Requirements
- **Microphone Access**: Required for speech input
- **Internet Connection**: Required for LM Studio API communication
- **Modern Browser**: Chrome 25+, Firefox 44+, Safari 14.1+, Edge 79+

## 📝 Usage Examples

### Example 1: English Conversation
1. Set "Speech Input Language" to "English"
2. Start conversation mode
3. Say: "Hello, how are you today?"
4. AI responds in English with English voice

### Example 2: Spanish Conversation
1. Set "Speech Input Language" to "Spanish"
2. Start conversation mode
3. Say: "Hola, ¿cómo estás hoy?"
4. AI responds in Spanish with Spanish voice

### Example 3: Mixed Language AI Response
1. Set "Speech Input Language" to "English"
2. Start conversation mode
3. Say: "Can you teach me some French phrases?"
4. AI responds: "Certainly! Here are some French phrases: Bonjour (Hello), Merci (Thank you)..."
5. System automatically uses French pronunciation for French words

## 🔮 Future Enhancements

### Planned Features
- **Language Switching Commands**: Voice commands to change input language
- **Multi-language Detection**: Experimental support for detecting language switches
- **Custom Voice Training**: Personalized voice synthesis options
- **Offline Language Packs**: Reduced dependency on internet connection

### Current Limitations We're Working On
- **Single Input Language**: Currently can only listen for one language at a time
- **Manual Language Selection**: Cannot automatically detect what language you're about to speak
- **Browser Dependencies**: Limited by browser speech recognition capabilities

---

## 🎯 Quick Start Guide

1. **Configure Language**: Go to Settings → Language Settings → Select your speech input language
2. **Enable Conversation Mode**: Click the 💬 button in chat header
3. **Grant Permissions**: Allow microphone access when prompted
4. **Start Talking**: Speak naturally in your selected language
5. **Listen & Respond**: AI will automatically detect response language and speak back
6. **Change Languages**: Go back to settings to switch your input language

**Remember**: You must manually select your speaking language, but AI responses are automatically detected and spoken in the appropriate language! 🎉 