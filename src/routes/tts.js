const express = require('express');
const router = express.Router();
const ttsService = require('../services/ttsService');
const logger = require('../utils/logger');

// Get TTS service status and available voices
router.get('/status', async (req, res) => {
  try {
    const [status, voices] = await Promise.all([
      ttsService.getStatus(),
      ttsService.getEnglishVoices()
    ]);
    res.json({ ...status, voices });
  } catch (error) {
    logger.error(`Error getting TTS status: ${error.message}`);
    res.status(500).json({ error: 'Failed to get TTS status' });
  }
});

// Synthesize text to speech
router.post('/synthesize', async (req, res) => {
  try {
    const { text, voice } = req.body;
    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }
    const audioBase64 = await ttsService.synthesizeText(text, voice);
    res.json({ success: true, audio: audioBase64 });
  } catch (error) {
    logger.error(`Error synthesizing text: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// Synthesize movie overview specifically
router.post('/movie-overview', async (req, res) => {
  try {
    const { movieTitle, overview, voice } = req.body;
    if (!overview) {
      return res.status(400).json({ error: 'Movie overview is required' });
    }
    const audioBase64 = await ttsService.synthesizeMovieOverview(movieTitle, overview, voice);
    res.json({ success: true, audio: audioBase64 });
  } catch (error) {
    logger.error(`Error synthesizing movie overview: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;