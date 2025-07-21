/**
 * Movie enhancement service
 * Combines data from multiple sources to create enriched movie objects
 */
const traktService = require('./traktService');
const tmdbService = require('./tmdbService');
const cacheService = require('./cacheService');
const logger = require('../utils/logger');

class EnhancementService {
  constructor() {
    logger.info('Enhancement service initialized');
  }

  async enhanceMovieData(movieItem) {
    if (!movieItem?.movie) return movieItem;

    const movie = movieItem.movie;
    const cacheKey = `enhanced:${movie.ids.trakt}`;

    // Check cache first
    const cached = cacheService.getEnhancedCache(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      logger.debug(`Enhancing movie: ${movie.title}`, { traktId: movie.ids.trakt });

      // Get additional data concurrently
      const [stats, ratings, posterData] = await Promise.allSettled([
        traktService.getMovieStats(movie.ids.trakt),
        traktService.getMovieRatings(movie.ids.trakt),
        tmdbService.getMovieWithPoster(movie.title, movie.year)
      ]);

      // Build enhanced movie object
      const enhanced = {
        ...movieItem,
        movie: {
          ...movie,
          stats: stats.status === 'fulfilled' ? stats.value : null,
          ratings: ratings.status === 'fulfilled' ? ratings.value : null,
          poster_url: posterData.status === 'fulfilled' ? posterData.value?.poster_url : null,
          tmdb_data: posterData.status === 'fulfilled' ? posterData.value : null
        }
      };

      // Cache the enhanced data
      cacheService.setEnhancedCache(cacheKey, enhanced);
      logger.debug(`Movie enhanced successfully: ${movie.title}`);

      return enhanced;
    } catch (error) {
      logger.error(`Failed to enhance movie: ${movie.title}`, {
        error: error.message,
        traktId: movie.ids.trakt
      });
      return movieItem; // Return original if enhancement fails
    }
  }

  async enhanceRelatedMovie(movie) {
    if (!movie?.ids?.trakt) return movie;

    const cacheKey = `enhanced:related:${movie.ids.trakt}`;

    // Check cache first
    const cached = cacheService.getEnhancedCache(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      logger.debug(`Enhancing related movie: ${movie.title}`, { traktId: movie.ids.trakt });

      // Get poster data (lighter enhancement for related movies)
      const posterData = await tmdbService.getMovieWithPoster(movie.title, movie.year);

      const enhanced = {
        ...movie,
        poster_url: posterData?.poster_url || null,
        tmdb_data: posterData || null
      };

      // Cache the enhanced data
      cacheService.setEnhancedCache(cacheKey, enhanced);
      logger.debug(`Related movie enhanced: ${movie.title}`);

      return enhanced;
    } catch (error) {
      logger.error(`Failed to enhance related movie: ${movie.title}`, {
        error: error.message,
        traktId: movie.ids.trakt
      });
      return movie; // Return original if enhancement fails
    }
  }

  async enhanceMovieList(movies, options = {}) {
    const { 
      maxConcurrent = 5, 
      includeStats = true, 
      includePosters = true 
    } = options;

    if (!Array.isArray(movies) || movies.length === 0) {
      return [];
    }

    logger.debug(`Enhancing ${movies.length} movies`, { maxConcurrent, includeStats, includePosters });

    // Process movies in batches to avoid overwhelming APIs
    const results = [];
    for (let i = 0; i < movies.length; i += maxConcurrent) {
      const batch = movies.slice(i, i + maxConcurrent);
      
      const batchPromises = batch.map(movie => {
        if (includeStats) {
          return this.enhanceMovieData({ movie });
        } else {
          return this.enhanceRelatedMovie(movie);
        }
      });

      const batchResults = await Promise.allSettled(batchPromises);
      
      // Extract successful results
      const successfulResults = batchResults
        .filter(result => result.status === 'fulfilled')
        .map(result => result.value);

      results.push(...successfulResults);
    }

    logger.debug(`Enhanced ${results.length}/${movies.length} movies successfully`);
    return results;
  }

  // Get enhancement statistics
  getStats() {
    const cacheStatus = cacheService.getStatus();
    return {
      enhancedCacheSize: cacheStatus.enhanced.active,
      totalCacheSize: cacheStatus.enhanced.total
    };
  }
}

module.exports = new EnhancementService();