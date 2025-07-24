/**
 * Text-to-Speech service using Microsoft Edge TTS
 * Provides high-quality neural voice synthesis for movie overviews
 */
const logger = require('../utils/logger');
const cacheService = require('./cacheService');
const edgeTTSService = require('./edgeTTSService');

class TTSService {
  constructor() {
    this.isInitialized = false;
    this.availableVoices = [];
    this.defaultVoice = 'en-US-AriaNeural';
    this.init();
  }

  async init() {
    try {
      // Use the Edge TTS service
      this.isInitialized = true;
      
      // Define available voices (hardcoded for now)
      this.availableVoices = [
        { ShortName: 'en-US-AriaNeural', FriendlyName: 'Microsoft Aria (Neural)', Gender: 'Female', Locale: 'en-US' },
        { ShortName: 'en-US-GuyNeural', FriendlyName: 'Microsoft Guy (Neural)', Gender: 'Male', Locale: 'en-US' },
        { ShortName: 'en-GB-SoniaNeural', FriendlyName: 'Microsoft Sonia (Neural)', Gender: 'Female', Locale: 'en-GB' },
        { ShortName: 'en-AU-NatashaNeural', FriendlyName: 'Microsoft Natasha (Neural)', Gender: 'Female', Locale: 'en-AU' }
      ];
      
      logger.info(`✅ TTS service initialized with Edge TTS and ${this.availableVoices.length} voices`);
    } catch (error) {
      logger.error(`Failed to initialize TTS service: ${error.message}`);
      this.isInitialized = false;
    }
  }

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

  async synthesizeText(text, voiceName = null, options = {}) {
    if (!text || text.trim().length === 0) {
      throw new Error('Text is required for synthesis');
    }

    const voice = voiceName || this.defaultVoice;
    
    try {
      // Create cache key
      const crypto = require('crypto');
      const textHash = crypto.createHash('md5').update(text).digest('hex');
      const cacheKey = `tts:${voice}:${textHash}`;
      
      // Check cache first
      const cached = cacheService.getApiCache(cacheKey);
      if (cached) {
        logger.debug('Using cached TTS audio');
        return cached;
      }

      // Use Edge TTS
      try {
        logger.info(`🎵 Using Edge TTS for synthesis with voice: ${voice}`);
        logger.info(`📝 Text to synthesize: "${text.substring(0, 100)}..."`);
        
        // Use the Edge TTS service to generate audio
        const audioBuffer = await edgeTTSService.synthesizeText(text, voice);
        
        // Check if we got valid audio data
        if (!audioBuffer || audioBuffer.length === 0) {
          throw new Error('No audio data generated');
        }
        
        // Convert to base64
        const audioBase64 = audioBuffer.toString('base64');
        
        // Cache the result
        cacheService.setApiCache(cacheKey, audioBase64, 3600);
        
        logger.info(`✅ Edge TTS synthesis successful, audio length: ${audioBuffer.length}`);
        return audioBase64;
        
      } catch (edgeError) {
        logger.warn(`❌ Edge TTS failed: ${edgeError.message}`);
        throw edgeError;
      }

      // If we get here, Edge TTS failed
      throw new Error('Edge TTS synthesis failed');

    } catch (error) {
      logger.error(`TTS synthesis failed: ${error.message}`);
      throw error;
    }
  }

  async synthesizeMovieOverview(movieTitle, overview, voiceName = null) {
    if (!overview || overview.trim().length === 0) {
      throw new Error('Movie overview is required');
    }

    // Clean text for better speech synthesis
    const cleanText = overview.replace(/\s+/g, ' ').trim();
    
    logger.info(`🎬 Movie overview TTS for: "${movieTitle}" (${cleanText.length} chars)`);
    
    return this.synthesizeText(cleanText, voiceName);
  }

  getStatus() {
    return {
      initialized: this.isInitialized,
      voicesAvailable: this.availableVoices.length,
      defaultVoice: this.defaultVoice,
      englishVoices: this.getEnglishVoices().length,
      edgeTTSAvailable: edgeTTSInstance !== null
    };
  }
}

module.exports = new TTSService();