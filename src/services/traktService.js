/**
 * Trakt API service
 */
const axios = require('axios');
const config = require('../config');
const logger = require('../utils/logger');
const cacheService = require('./cacheService');

class TraktService {
  constructor() {
    this.client = axios.create({
      baseURL: config.apis.trakt.baseUrl,
      timeout: config.apis.trakt.timeout,
      headers: {
        'Content-Type': 'application/json',
        'trakt-api-version': config.apis.trakt.version,
        'trakt-api-key': config.apis.trakt.key,
      },
    });

    logger.info('Trakt service initialized');
  }

  async makeRequest(endpoint, params = {}) {
    const cacheKey = `trakt:${endpoint}:${JSON.stringify(params)}`;

    // Check cache first
    const cached = cacheService.getApiCache(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      logger.debug(`Making Trakt request: ${endpoint}`, { params });
      const response = await this.client.get(endpoint, { params });
      const data = response.data;

      // Cache the response
      cacheService.setApiCache(cacheKey, data);
      logger.debug(`Trakt request successful: ${endpoint}`);

      return data;
    } catch (error) {
      logger.error(`Trakt API request failed: ${endpoint}`, {
        error: error.message,
        status: error.response?.status,
        params
      });
      return null;
    }
  }

  // Search movies
  async searchMovies(query, extended = false) {
    const params = { query };
    if (extended) {
      params.extended = 'full';
    }
    
    return this.makeRequest('/search/movie', params);
  }

  // Get movie details
  async getMovieDetails(traktId, extended = false) {
    const params = extended ? { extended: 'full' } : {};
    return this.makeRequest(`/movies/${traktId}`, params);
  }

  // Get movie stats
  async getMovieStats(traktId) {
    return this.makeRequest(`/movies/${traktId}/stats`);
  }

  // Get movie ratings
  async getMovieRatings(traktId) {
    return this.makeRequest(`/movies/${traktId}/ratings`);
  }

  // Get related movies
  async getRelatedMovies(traktId) {
    return this.makeRequest(`/movies/${traktId}/related`);
  }

  // Get full movie data (details + stats + ratings)
  async getFullMovieData(traktId) {
    const [details, stats, ratings] = await Promise.allSettled([
      this.getMovieDetails(traktId, true),
      this.getMovieStats(traktId),
      this.getMovieRatings(traktId)
    ]);

    const movieData = {
      ...details.value,
      stats: stats.status === 'fulfilled' ? stats.value : null,
      ratings: ratings.status === 'fulfilled' ? ratings.value : null,
    };

    return movieData;
  }
}

module.exports = new TraktService();