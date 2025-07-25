# Edge TTS Integration for CinemaTec Explorer

## Overview

Successfully integrated `@andresaya/edge-tts` package to provide text-to-speech functionality for movie descriptions and overviews in the CinemaTec Explorer.

## Features Added

### 🔊 Text-to-Speech Service
- **Backend Service**: `src/services/ttsService.js`
  - Initializes Edge TTS with 300+ available voices
  - Caches audio output for performance
  - Supports English voice filtering
  - Provides movie-specific overview synthesis

### 📡 API Endpoints
- **GET `/api/tts/status`**: Get TTS service status and available voices
- **POST `/api/tts/synthesize`**: Synthesize any text to speech
- **POST `/api/tts/movie-overview`**: Specialized endpoint for movie overviews

### 🎬 Frontend Integration
- **TTS Manager**: `public/static/js/lib/tts.js`
  - Handles audio playback from base64 data
  - Manages playback state (play/pause/stop)
  - Provides voice selection capabilities

### 🎯 UI Controls
- **Listen Button**: Added to movie detail modals
- **Stop Button**: Allows users to stop audio playback
- **Notifications**: User feedback for TTS actions

## Usage

### In Movie Details
1. Search for and select any movie
2. Click on a movie node to open details modal
3. Click the "🔊 Listen" button to hear the movie overview
4. Use "⏹️ Stop" to halt playback

### API Usage Examples

```javascript
// Get TTS status
const status = await fetch('/api/tts/status').then(r => r.json());

// Synthesize text
const audio = await fetch('/api/tts/synthesize', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    text: "Hello world!",
    voice: "en-US-AriaNeural"
  })
}).then(r => r.json());

// Synthesize movie overview
const movieAudio = await fetch('/api/tts/movie-overview', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    movieTitle: "The Dark Knight",
    overview: "Batman faces the Joker...",
    voice: "en-US-AriaNeural"
  })
}).then(r => r.json());
```

## Technical Implementation

### Backend Architecture
```
src/services/ttsService.js     # Core TTS functionality
src/routes/tts.js             # API endpoints
src/routes/index.js           # Route integration
```

### Frontend Architecture
```
public/static/js/lib/tts.js   # TTS manager class
public/static/js/app.js       # Global TTS functions
public/static/js/lib/ui.js    # UI integration
```

### Key Features
- **Caching**: Audio is cached to improve performance
- **Error Handling**: Graceful fallbacks and user notifications
- **Voice Selection**: Support for multiple English voices
- **Audio Management**: Play/pause/stop controls

## Voice Options

The system supports multiple English voices including:
- `en-US-AriaNeural` (Default - Female)
- `en-US-GuyNeural` (Male)
- `en-GB-SoniaNeural` (British Female)
- `en-AU-NatashaNeural` (Australian Female)
- And many more regional variants

## Performance Considerations

- **Caching**: Audio files are cached to reduce API calls
- **Debouncing**: Prevents multiple simultaneous requests
- **Compression**: Uses efficient audio encoding
- **Memory Management**: Cleans up audio objects after playback

## Error Handling

- Service initialization failures are logged
- Network errors show user-friendly messages
- Invalid text inputs are validated
- Audio playback errors are handled gracefully

## Future Enhancements

1. **Voice Preferences**: Save user's preferred voice
2. **Speed Control**: Adjust playback speed
3. **Batch Processing**: Read multiple movie overviews
4. **Accessibility**: Enhanced screen reader support
5. **Mobile Optimization**: Touch-friendly controls

## Dependencies

- `@andresaya/edge-tts`: Core TTS functionality
- Existing caching service for performance
- Frontend audio API for playback

## Testing

Use the test script to verify functionality:
```bash
node tmp_rovodev_test_tts.js
```

This integration enhances accessibility and provides an immersive way to consume movie information through audio narration.