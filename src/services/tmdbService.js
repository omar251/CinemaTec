/**
 * TMDB API service
 */
const axios = require('axios');
const config = require('../config');
const logger = require('../utils/logger');
const cacheService = require('./cacheService');

class TMDBService {
  constructor() {
    if (!config.apis.tmdb.key) {
      logger.warn('TMDB API key not configured - poster images will not be available');
      this.enabled = false;
      return;
    }

    this.enabled = true;
    this.client = axios.create({
      baseURL: config.apis.tmdb.baseUrl,
      timeout: config.apis.tmdb.timeout,
      params: {
        api_key: config.apis.tmdb.key,
      },
    });

    logger.info('TMDB service initialized');
  }

  async makeRequest(endpoint, params = {}) {
    if (!this.enabled) return null;

    const cacheKey = `tmdb:${endpoint}:${JSON.stringify(params)}`;

    // Check cache first
    const cached = cacheService.getApiCache(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      logger.debug(`Making TMDB request: ${endpoint}`, { params });
      const response = await this.client.get(endpoint, { params });
      const data = response.data;

      // Cache the response
      cacheService.setApiCache(cacheKey, data);
      logger.debug(`TMDB request successful: ${endpoint}`);

      return data;
    } catch (error) {
      logger.error(`TMDB API request failed: ${endpoint}`, {
        error: error.message,
        status: error.response?.status,
        params
      });
      return null;
    }
  }

  // Search for movie by title and year
  async searchMovie(title, year = null) {
    const params = { query: title };
    if (year) {
      params.year = year;
    }

    const data = await this.makeRequest('/search/movie', params);
    return data?.results?.[0] || null;
  }

  // Get movie details by TMDB ID
  async getMovieDetails(tmdbId) {
    return this.makeRequest(`/movie/${tmdbId}`);
  }

  // Get poster URL for a movie
  getPosterUrl(posterPath) {
    if (!posterPath) return null;
    return `${config.apis.tmdb.imageBase}${posterPath}`;
  }

  // Find TMDB movie and get poster URL
  async getMoviePoster(title, year = null) {
    const movie = await this.searchMovie(title, year);
    if (!movie?.poster_path) return null;
    
    return this.getPosterUrl(movie.poster_path);
  }

  // Get movie data with poster
  async getMovieWithPoster(title, year = null) {
    const movie = await this.searchMovie(title, year);
    if (!movie) return null;

    return {
      ...movie,
      poster_url: movie.poster_path ? this.getPosterUrl(movie.poster_path) : null
    };
  }
}

module.exports = new TMDBService();