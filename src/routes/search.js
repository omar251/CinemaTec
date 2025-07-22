/**
 * Search routes
 */
const express = require('express');
const router = express.Router();
const traktService = require('../services/traktService');
const enhancementService = require('../services/enhancementService');
const movieDataService = require('../services/movieDataService');
const logger = require('../utils/logger');

// Cache middleware for HTTP responses
function setCacheHeaders(req, res, next) {
  res.set({
    'Cache-Control': 'public, max-age=300', // 5 minutes
    'ETag': `"${Date.now()}"`,
  });
  next();
}

// Search movies with enhancement
router.get('/movies', setCacheHeaders, async (req, res) => {
  const startTime = Date.now();
  const { query } = req.query;

  if (!query) {
    return res.status(400).json({ error: 'Query parameter is required' });
  }

  try {
    logger.info(`Searching movies: ${query}`);
    
    // First check cache for quick results
    const cachedResults = movieDataService.searchMovies(query, 5);
    
    if (cachedResults.length > 0) {
      logger.info(`Found ${cachedResults.length} cached movies for enhanced search: ${query}`);
      
      // Convert cached movies to enhanced format
      const enhancedCachedResults = cachedResults.map(movie => ({
        movie: movie
      }));
      
      // If we have good cached results, return them quickly
      if (cachedResults.length >= 3) {
        const duration = Date.now() - startTime;
        logger.info(`Enhanced search completed from cache in ${duration}ms for query: ${query}`);
        return res.json(enhancedCachedResults);
      }
    }
    
    // Get fresh results from API
    const data = await traktService.searchMovies(query);
    if (!data) {
      // If API fails but we have cached results, return them
      if (cachedResults.length > 0) {
        const enhancedCachedResults = cachedResults.map(movie => ({ movie: movie }));
        return res.json(enhancedCachedResults);
      }
      return res.json([]);
    }

    // Filter and limit results
    const movies = data.filter(item => item.movie).slice(0, 15);

    // Enhance movies concurrently
    const enhancedMovies = await enhancementService.enhanceMovieList(
      movies.map(item => item.movie),
      { maxConcurrent: 5, includeStats: true }
    );

    const duration = Date.now() - startTime;
    logger.info(`Enhanced search completed in ${duration}ms for query: ${query}`);

    res.json(enhancedMovies);
  } catch (error) {
    logger.error(`Error searching movies: ${error.message}`, { query });
    
    // Try to return cached results as fallback
    try {
      const cachedResults = movieDataService.searchMovies(query, 15);
      if (cachedResults.length > 0) {
        logger.info(`Returning ${cachedResults.length} cached results as fallback`);
        const enhancedCachedResults = cachedResults.map(movie => ({ movie: movie }));
        return res.json(enhancedCachedResults);
      }
    } catch (cacheError) {
      logger.error(`Cache fallback also failed: ${cacheError.message}`);
    }
    
    res.status(500).json({ error: 'Failed to search movies' });
  }
});

// Fast search with cache integration
router.get('/movies/fast', setCacheHeaders, async (req, res) => {
  const { query } = req.query;

  if (!query) {
    return res.status(400).json({ error: 'Query parameter is required' });
  }

  try {
    logger.info(`Fast search with cache: ${query}`);
    
    // First, search in the movie cache
    const cachedResults = movieDataService.searchMovies(query, 15);
    
    if (cachedResults.length > 0) {
      logger.info(`Found ${cachedResults.length} cached movies for query: ${query}`);
      
      // Convert cached movies to the expected format
      const formattedCachedResults = cachedResults.map(movie => ({
        movie: movie
      }));
      
      // If we have enough cached results, return them
      if (cachedResults.length >= 5) {
        return res.json(formattedCachedResults);
      }
      
      // If we have some cached results but not enough, get more from API
      const data = await traktService.searchMovies(query);
      if (data) {
        const apiMovies = data.filter(item => item.movie).slice(0, 15);
        
        // Merge cached and API results, avoiding duplicates
        const cachedTraktIds = new Set(cachedResults.map(m => m.ids.trakt));
        const newApiMovies = apiMovies.filter(item => !cachedTraktIds.has(item.movie.ids.trakt));
        
        const combinedResults = [
          ...formattedCachedResults,
          ...newApiMovies.slice(0, 15 - cachedResults.length)
        ];
        
        return res.json(combinedResults);
      }
      
      // If API fails, return cached results
      return res.json(formattedCachedResults);
    }
    
    // No cached results, fall back to API search
    const data = await traktService.searchMovies(query);
    if (!data) {
      return res.json([]);
    }

    // Return basic data immediately without enhancement
    const movies = data.filter(item => item.movie).slice(0, 15);
    res.json(movies);
  } catch (error) {
    logger.error(`Error in fast search: ${error.message}`, { query });
    
    // Try to return cached results as fallback
    try {
      const cachedResults = movieDataService.searchMovies(query, 15);
      if (cachedResults.length > 0) {
        logger.info(`Returning ${cachedResults.length} cached results as fallback for fast search`);
        const formattedCachedResults = cachedResults.map(movie => ({ movie: movie }));
        return res.json(formattedCachedResults);
      }
    } catch (cacheError) {
      logger.error(`Cache fallback also failed: ${cacheError.message}`);
    }
    
    res.status(500).json({ error: 'Failed to search movies' });
  }
});

// Search only in cache (new endpoint)
router.get('/movies/cached', setCacheHeaders, async (req, res) => {
  const { query, limit = 15 } = req.query;

  if (!query) {
    return res.status(400).json({ error: 'Query parameter is required' });
  }

  try {
    logger.info(`Cache-only search: ${query}`);
    
    const cachedResults = movieDataService.searchMovies(query, parseInt(limit));
    
    // Convert to expected format
    const formattedResults = cachedResults.map(movie => ({
      movie: movie
    }));
    
    res.json(formattedResults);
  } catch (error) {
    logger.error(`Error in cache search: ${error.message}`, { query });
    res.status(500).json({ error: 'Failed to search cached movies' });
  }
});

module.exports = router;