/**
 * AI service for Gemini integration
 */
const { GoogleGenerativeAI } = require('@google/generative-ai');
const config = require('../config');
const logger = require('../utils/logger');
const cacheService = require('./cacheService');

class AIService {
  constructor() {
    if (!config.apis.gemini.key) {
      logger.warn('Gemini API key not configured - AI features will not be available');
      this.enabled = false;
      return;
    }

    try {
      this.genAI = new GoogleGenerativeAI(config.apis.gemini.key);
      this.model = this.genAI.getGenerativeModel({ model: config.apis.gemini.model });
      this.enabled = true;
      logger.info('🤖 Gemini AI service initialized successfully');
    } catch (error) {
      logger.error(`Failed to initialize Gemini AI: ${error.message}`);
      this.enabled = false;
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
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

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

  async generateMovieSynopsis(movieTitle, movieOverview) {
    const cacheKey = `ai:synopsis:${movieTitle}`;
    
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
    const cacheKey = `ai:insights:${selectedMovie.title}:${relatedMovies.length}`;
    
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
    const cacheKey = `ai:network:${networkData.nodes.length}:${Date.now()}`;
    
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
        model: config.apis.gemini.model,
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