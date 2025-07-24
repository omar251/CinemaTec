# Microsoft Edge TTS Integration

## Overview

The CinemaTec Movie Network Explorer now includes high-quality text-to-speech functionality using Microsoft Edge TTS. Users can listen to movie overviews with natural-sounding neural voices.

## Features

### 🎵 **Text-to-Speech Capabilities**
- **High-Quality Voices**: Microsoft's neural TTS voices (Aria, Guy, Sonia, Natasha)
- **Movie Overview Reading**: Click "🔊 Listen" to hear movie descriptions
- **Multiple Voice Options**: Support for different English neural voices
- **Audio Controls**: Play and stop functionality

### 🎯 **User Interface**
- **Listen Button**: "🔊 Listen" button in movie detail modals
- **Stop Button**: "⏹️ Stop" button to halt audio playback
- **Visual Feedback**: Notifications for TTS actions
- **Seamless Integration**: Works with existing movie network interface

## Technical Implementation

### **Architecture**
```
Frontend (Browser)
├── TTS Manager (tts.js)
├── UI Integration (ui.js)
└── Audio Playback

Backend (Node.js)
├── TTS Service (ttsService.js)
├── Edge TTS Service (edgeTTSService.js)
├── TTS Routes (tts.js)
└── Runner Script (runEdgeTTS.mjs)
```

### **Key Components**

#### **Frontend Components**
- `public/static/js/lib/tts.js` - TTS manager and audio playback
- `public/static/js/lib/ui.js` - UI integration and controls
- `public/static/js/app.js` - Global TTS functions

#### **Backend Components**
- `src/services/ttsService.js` - Main TTS service
- `src/services/edgeTTSService.js` - Edge TTS implementation
- `src/routes/tts.js` - API endpoints
- `scripts/tts/runEdgeTTS.mjs` - Edge TTS runner script

### **API Endpoints**

#### **GET /api/tts/status**
Returns TTS service status and available voices.

**Response:**
```json
{
  "initialized": true,
  "voicesAvailable": 4,
  "defaultVoice": "en-US-AriaNeural",
  "englishVoices": 4,
  "edgeTTSAvailable": true
}
```

#### **POST /api/tts/movie-overview**
Synthesizes movie overview to speech.

**Request:**
```json
{
  "movieTitle": "The Dark Knight",
  "overview": "Batman faces the Joker...",
  "voice": "en-US-AriaNeural"
}
```

**Response:**
```json
{
  "success": true,
  "audio": "base64-encoded-audio-data",
  "movieTitle": "The Dark Knight",
  "voice": "en-US-AriaNeural"
}
```

## Available Voices

| Voice | Language | Gender | Description |
|-------|----------|--------|-------------|
| en-US-AriaNeural | English (US) | Female | Natural, conversational |
| en-US-GuyNeural | English (US) | Male | Clear, professional |
| en-GB-SoniaNeural | English (UK) | Female | British accent |
| en-AU-NatashaNeural | English (AU) | Female | Australian accent |

## Usage

### **For Users**
1. Search for and select any movie
2. Click on a movie node to open details modal
3. Click the "🔊 Listen" button to hear the overview
4. Use "⏹️ Stop" to halt playback anytime

### **For Developers**
```javascript
// Get TTS status
const status = await fetch('/api/tts/status').then(r => r.json());

// Synthesize movie overview
const audio = await fetch('/api/tts/movie-overview', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    movieTitle: "Movie Title",
    overview: "Movie description...",
    voice: "en-US-AriaNeural"
  })
}).then(r => r.json());
```

## Performance Features

- **Caching**: Audio files are cached to improve performance
- **Efficient Processing**: Child process isolation prevents blocking
- **Error Handling**: Graceful fallbacks and user notifications
- **Memory Management**: Automatic cleanup of temporary files

## Dependencies

- `@andresaya/edge-tts`: Microsoft Edge TTS library
- Node.js child process for isolation
- Frontend Audio API for playback

## Configuration

The TTS service is automatically initialized on server startup. No additional configuration is required.

## Troubleshooting

### **Common Issues**

1. **TTS Not Available**
   - Check server logs for initialization errors
   - Ensure `@andresaya/edge-tts` is installed
   - Verify Node.js version compatibility

2. **Audio Not Playing**
   - Check browser console for errors
   - Verify CSP allows blob URLs
   - Ensure browser supports Audio API

3. **Voice Quality Issues**
   - Try different voice options
   - Check network connectivity
   - Verify audio output settings

### **Debug Information**

Check browser console for:
- TTS initialization status
- Voice selection information
- Audio playback status
- Error messages

Check server logs for:
- Edge TTS process output
- Audio generation status
- File creation/cleanup
- Error details

## Future Enhancements

- Voice preference saving
- Playback speed control
- Additional language support
- Batch processing capabilities
- Enhanced accessibility features