/**
 * Search routes
 */
const express = require('express');
const router = express.Router();
const traktService = require('../services/traktService');
const enhancementService = require('../services/enhancementService');
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
    
    const data = await traktService.searchMovies(query);
    if (!data) {
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
    res.status(500).json({ error: 'Failed to search movies' });
  }
});

// Fast search without enhancement
router.get('/movies/fast', setCacheHeaders, async (req, res) => {
  const { query } = req.query;

  if (!query) {
    return res.status(400).json({ error: 'Query parameter is required' });
  }

  try {
    logger.info(`Fast search: ${query}`);
    
    const data = await traktService.searchMovies(query);
    if (!data) {
      return res.json([]);
    }

    // Return basic data immediately without enhancement
    const movies = data.filter(item => item.movie).slice(0, 15);
    res.json(movies);
  } catch (error) {
    logger.error(`Error in fast search: ${error.message}`, { query });
    res.status(500).json({ error: 'Failed to search movies' });
  }
});

module.exports = router;