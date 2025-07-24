/**
 * Text-to-Speech service with browser TTS fallback
 * (Edge TTS libraries have compatibility issues, using reliable browser TTS)
 */
const logger = require('../utils/logger');
const cacheService = require('./cacheService');

class TTSService {
  constructor() {
    this.isInitialized = false;
    this.availableVoices = [];
    this.defaultVoice = 'en-US-AriaNeural'; // Default female voice
    this.init();
  }

  async init() {
    try {
      // Use browser TTS as the primary method (most reliable)
      this.availableVoices = [
        { ShortName: 'browser-default', FriendlyName: 'Browser Default Voice', Gender: 'Female', Locale: 'en-US' },
        { ShortName: 'browser-male', FriendlyName: 'Browser Male Voice', Gender: 'Male', Locale: 'en-US' },
        { ShortName: 'browser-female', FriendlyName: 'Browser Female Voice', Gender: 'Female', Locale: 'en-US' }
      ];
      this.isInitialized = true;
      logger.info(`TTS service initialized with browser TTS and ${this.availableVoices.length} voice options`);
    } catch (error) {
      logger.error(`Failed to initialize TTS service: ${error.message}`);
      this.isInitialized = false;
    }
  }

  // Get available voices filtered for English
  getEnglishVoices() {
    if (!this.isInitialized || !this.availableVoices) return [];
    
    return this.availableVoices.filter(voice => 
      voice.Locale && voice.Locale.startsWith('en-')
    ).map(voice => ({
      name: voice.ShortName,
      displayName: voice.FriendlyName || voice.ShortName,
      gender: voice.Gender,
      locale: voice.Locale
    }));
  }

  // Synthesize text to speech
  async synthesizeText(text, voiceName = null, options = {}) {
    if (!text || text.trim().length === 0) {
      throw new Error('Text is required for synthesis');
    }

    // Use provided voice or default
    const voice = voiceName || this.defaultVoice;
    
    try {
      // Create cache key for this synthesis
      const textHash = Buffer.from(text).toString('base64').substring(0, 100);
      const cacheKey = `tts:${voice}:${textHash}`;
      
      logger.info(`TTS synthesis request: "${text.substring(0, 50)}..." (${text.length} chars)`);
      
      // Check cache first
      const cached = cacheService.getApiCache(cacheKey);
      if (cached) {
        logger.debug('Using cached TTS audio');
        return cached;
      }

      // Use browser-based TTS (reliable and works everywhere)
      logger.info('🎵 Using browser-based TTS for synthesis');
      
      const response = {
        useBrowserTTS: true,
        text: text,
        voice: voice,
        movieTitle: text.includes('Here\'s the overview') ? text.split(':')[0].replace('Here\'s the overview for ', '') : 'Movie'
      };
      
      // Return the response as base64 JSON (the frontend will detect this)
      const responseBase64 = Buffer.from(JSON.stringify(response)).toString('base64');
      logger.info(`🎵 Returning browser TTS instructions for: ${response.movieTitle}`);
      return responseBase64;

      // If we get here, all methods failed
      throw new Error('All TTS methods failed - neither Microsoft Speech SDK nor browser TTS available');

    } catch (error) {
      logger.error(`TTS synthesis failed: ${error.message}`, { voice, textLength: text.length });
      throw error;
    }
  }

  // Synthesize movie overview/description
  async synthesizeMovieOverview(movieTitle, overview, voiceName = null) {
    if (!overview || overview.trim().length === 0) {
      throw new Error('Movie overview is required');
    }

    // Prepare text for better speech synthesis (no intro text to avoid caching conflicts)
    const cleanText = this.prepareTextForSpeech(overview);
    
    // TEMPORARILY DISABLE CACHING TO DEBUG
    logger.info(`🎬 Movie overview TTS for: "${movieTitle}"`);
    logger.info(`📝 Overview text: "${cleanText.substring(0, 100)}..."`);
    logger.info(`📏 Overview length: ${cleanText.length} characters`);
    
    // Synthesize without any caching to test if the issue is caching-related
    const audioBase64 = await this.synthesizeText(cleanText, voiceName);
    
    logger.info(`✅ Generated fresh audio for: ${movieTitle}`);
    return audioBase64;
  }

  // Prepare text for better speech synthesis
  prepareTextForSpeech(text) {
    return text
      // Remove excessive whitespace
      .replace(/\s+/g, ' ')
      // Add pauses after sentences
      .replace(/\. /g, '. ')
      // Handle common abbreviations
      .replace(/\bDr\./g, 'Doctor')
      .replace(/\bMr\./g, 'Mister')
      .replace(/\bMrs\./g, 'Missus')
      .replace(/\bMs\./g, 'Miss')
      // Clean up
      .trim();
  }

  // Get service status
  getStatus() {
    return {
      initialized: this.isInitialized,
      voicesAvailable: this.availableVoices.length,
      defaultVoice: this.defaultVoice,
      englishVoices: this.getEnglishVoices().length
    };
  }
}

module.exports = new TTSService();