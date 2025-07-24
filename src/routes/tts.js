/**
 * Text-to-Speech routes
 */
const express = require('express');
const router = express.Router();
const ttsService = require('../services/ttsService');
const logger = require('../utils/logger');

// Get TTS service status and available voices
router.get('/status', (req, res) => {
  try {
    const status = ttsService.getStatus();
    const englishVoices = ttsService.getEnglishVoices();
    
    res.json({
      ...status,
      voices: englishVoices
    });
  } catch (error) {
    logger.error(`Error getting TTS status: ${error.message}`);
    res.status(500).json({ error: 'Failed to get TTS status' });
  }
});

// Synthesize text to speech
router.post('/synthesize', async (req, res) => {
  try {
    const { text, voice, options = {} } = req.body;

    if (!text || text.trim().length === 0) {
      return res.status(400).json({ error: 'Text is required' });
    }

    if (text.length > 5000) {
      return res.status(400).json({ error: 'Text too long (max 5000 characters)' });
    }

    const audioBase64 = await ttsService.synthesizeText(text, voice, options);
    
    res.json({
      success: true,
      audio: audioBase64,
      voice: voice || ttsService.defaultVoice,
      textLength: text.length
    });

  } catch (error) {
    logger.error(`Error synthesizing text: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// Synthesize movie overview specifically
router.post('/movie-overview', async (req, res) => {
  try {
    const { movieTitle, overview, voice } = req.body;

    if (!movieTitle) {
      return res.status(400).json({ error: 'Movie title is required' });
    }

    if (!overview || overview.trim().length === 0) {
      return res.status(400).json({ error: 'Movie overview is required' });
    }

    const audioBase64 = await ttsService.synthesizeMovieOverview(movieTitle, overview, voice);
    
    res.json({
      success: true,
      audio: audioBase64,
      movieTitle,
      voice: voice || ttsService.defaultVoice,
      overviewLength: overview.length
    });

  } catch (error) {
    logger.error(`Error synthesizing movie overview: ${error.message}`, { movieTitle: req.body.movieTitle });
    res.status(500).json({ error: error.message });
  }
});

// Test endpoint to debug audio format
router.post('/test-audio', async (req, res) => {
  try {
    const { text = "Test audio" } = req.body;
    
    // Synthesize audio
    await ttsService.tts.synthesize(text, 'en-US-AriaNeural');
    
    // Get raw audio data
    const rawAudio = await ttsService.tts.toRaw();
    logger.info(`Raw audio length: ${rawAudio ? rawAudio.length : 'null'}`);
    
    // Save to file for inspection
    await ttsService.tts.toFile('test_audio');
    
    // Get base64
    const base64Audio = ttsService.tts.toBase64();
    
    res.json({
      success: true,
      rawLength: rawAudio ? rawAudio.length : 0,
      base64Length: base64Audio ? base64Audio.length : 0,
      base64Sample: base64Audio ? base64Audio.substring(0, 100) : null
    });
    
  } catch (error) {
    logger.error(`Test audio failed: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;