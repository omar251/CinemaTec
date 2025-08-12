/**
 * Provider-agnostic AI service
 */
const config = require('../config');
const logger = require('../utils/logger');
const cacheService = require('./cacheService');
const { createAIProvider } = require('./ai/providerFactory');

class AIService {
  constructor() {
    this.provider = createAIProvider(config, logger);
    this.enabled = !!this.provider;
    this.currentProviderName = this.provider?.getProviderInfo()?.name || null;
    if (!this.enabled) {
      logger.warn('AI provider not configured - AI features will not be available');
    } else {
      const info = this.provider.getProviderInfo();
      logger.info(`🤖 AI service initialized (${info.name}:${info.model})`);
    }
  }

 // Switch provider at runtime (best-effort)
 setProvider(preferred) {
   try {
     const newProvider = createAIProvider(config, logger, preferred);
     if (newProvider && newProvider.isEnabled()) {
       this.provider = newProvider;
       this.enabled = true;
       this.currentProviderName = newProvider.getProviderInfo()?.name;
       logger.info(`AI provider switched to ${this.currentProviderName}`);
       return { success: true, provider: this.currentProviderName };
     }
     return { success: false, error: 'Provider not available or not enabled' };
   } catch (err) {
     logger.error(`Failed to switch AI provider: ${err.message}`);
     return { success: false, error: err.message };
   }
 }

  async generateContent(prompt, cacheKey = null) {
    if (!this.enabled) {
      throw new Error('AI service not available');
    }

    // Check cache if key provided
    if (cacheKey) {
      const cached = cacheService.getAiCache(cacheKey);
      if (cached) {
        return cached;
      }
    }

    try {
      logger.debug('Generating AI content', { promptLength: prompt.length });
      const text = await this.provider.generateText(prompt);

      // Cache the response if key provided
      if (cacheKey) {
        cacheService.setAiCache(cacheKey, text);
      }

      logger.debug('AI content generated successfully');
      return text;
    } catch (error) {
      logger.error('AI content generation failed', {
        error: error.message,
        promptLength: prompt.length
      });
      throw error;
    }
  }

 async generateContentStream(prompt, cacheKey = null, onDelta) {
   if (!this.enabled) {
     throw new Error('AI service not available');
   }

   // If cached and no streaming requested, return cache
   if (cacheKey && !onDelta) {
     const cached = cacheService.getAiCache(cacheKey);
     if (cached) return cached;
   }

   let final = '';
   const handleDelta = (delta) => {
     final += delta;
     if (onDelta) onDelta(delta);
   };

   // Prefer provider streaming if available
   if (typeof this.provider.generateTextStream === 'function') {
     final = await this.provider.generateTextStream(prompt, handleDelta);
   } else {
     final = await this.provider.generateText(prompt);
     if (onDelta) onDelta(final);
   }

   if (cacheKey) {
     cacheService.setAiCache(cacheKey, final);
   }

   return final;
 }

  async generateMovieSynopsis(movieTitle, movieOverview) {
    const crypto = require('crypto');
    const ovHash = crypto.createHash('md5').update(movieOverview || '').digest('hex');
    const cacheKey = `ai:synopsis:${movieTitle}:${ovHash}`;
    
    const prompt = `Create a compelling, concise synopsis for the movie "${movieTitle}".
    
Original overview: ${movieOverview}

Please write a fresh, engaging synopsis that:
- Captures the essence and mood of the film
- Is 2-3 sentences long
- Avoids spoilers
- Uses vivid, cinematic language
- Makes the reader want to watch the movie

Synopsis:`;

    return this.generateContent(prompt, cacheKey);
  }

  async generateMovieInsights(selectedMovie, relatedMovies) {
    const relatedKey = (relatedMovies || [])
      .map(m => m.title || '')
      .filter(Boolean)
      .sort()
      .join('|');
    const cacheKey = `ai:insights:${selectedMovie.title}:${relatedKey}`;
    
    const relatedTitles = relatedMovies.map(m => m.title).join(', ');
    
    const prompt = `You are a movie expert. Explain why someone who enjoyed "${selectedMovie.title}" might like these related movies: ${relatedTitles}

Consider themes, genres, directors, actors, mood, and storytelling style.

Selected Movie: "${selectedMovie.title}"
${selectedMovie.overview ? `Overview: ${selectedMovie.overview}` : ''}

Related Movies: ${relatedTitles}

Provide insights in 2-3 sentences that highlight the connections and appeal. Be specific about what makes these movies similar or complementary.

Insights:`;

    return this.generateContent(prompt, cacheKey);
  }

  async generateNetworkAnalysis(networkData) {
    const titles = (networkData.nodes || [])
      .map(n => n.title || '')
      .filter(Boolean)
      .sort()
      .join('|');
    const linkCount = Array.isArray(networkData.links) ? networkData.links.length : 0;
    const cacheKey = `ai:network:${titles}:${linkCount}`;
    
    const movieTitles = networkData.nodes.map(node => node.title).join(', ');
    
    const prompt = `Analyze this movie network and provide insights about the connections and themes.

Movies in network: ${movieTitles}
Total movies: ${networkData.nodes.length}
Total connections: ${networkData.links.length}

Provide a brief analysis (2-3 sentences) about:
- Common themes or genres
- Notable patterns or clusters
- What this network reveals about movie relationships

Analysis:`;

    return this.generateContent(prompt, cacheKey);
  }

  // Health check for AI service
  async healthCheck() {
    if (!this.enabled) {
      return { status: 'disabled', reason: 'API key not configured' };
    }

    try {
      const testPrompt = 'Say "AI service is working" in exactly those words.';
      const response = await this.generateContent(testPrompt);
      
      return {
        status: 'healthy',
        provider: this.provider?.getProviderInfo()?.name,
        model: this.provider?.getProviderInfo()?.model,
        response: response.trim()
      };
    } catch (error) {
      return {
        status: 'error',
        error: error.message
      };
    }
  }
}

module.exports = new AIService();