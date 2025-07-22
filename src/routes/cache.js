/**
 * Cache management routes
 */
const express = require('express');
const router = express.Router();
const movieDataService = require('../services/movieDataService');
const cacheService = require('../services/cacheService');
const logger = require('../utils/logger');

// Get cache statistics
router.get('/stats', async (req, res) => {
  try {
    const movieCacheStats = movieDataService.getStats();
    const memoryCacheStats = cacheService.getStatus();
    
    const stats = {
      movieCache: movieCacheStats,
      memoryCache: memoryCacheStats,
      timestamp: new Date().toISOString()
    };
    
    res.json(stats);
  } catch (error) {
    logger.error(`Error getting cache stats: ${error.message}`);
    res.status(500).json({ error: 'Failed to get cache statistics' });
  }
});

// Search movies in cache
router.get('/movies/search', async (req, res) => {
  try {
    const { q: query, limit = 10 } = req.query;
    
    if (!query) {
      return res.status(400).json({ error: 'Query parameter "q" is required' });
    }
    
    const results = movieDataService.searchMovies(query, parseInt(limit));
    
    res.json({
      query,
      results: results.length,
      movies: results
    });
  } catch (error) {
    logger.error(`Error searching movie cache: ${error.message}`);
    res.status(500).json({ error: 'Failed to search movie cache' });
  }
});

// Get specific movie from cache
router.get('/movies/:traktId', async (req, res) => {
  try {
    const { traktId } = req.params;
    const movie = movieDataService.getMovie(parseInt(traktId));
    
    if (!movie) {
      return res.status(404).json({ error: 'Movie not found in cache' });
    }
    
    res.json(movie);
  } catch (error) {
    logger.error(`Error getting movie from cache: ${error.message}`);
    res.status(500).json({ error: 'Failed to get movie from cache' });
  }
});

// Get multiple movies from cache
router.post('/movies/batch', async (req, res) => {
  try {
    const { traktIds } = req.body;
    
    if (!Array.isArray(traktIds)) {
      return res.status(400).json({ error: 'traktIds must be an array' });
    }
    
    const movies = movieDataService.getMovies(traktIds);
    
    res.json({
      requested: traktIds.length,
      found: movies.length,
      movies
    });
  } catch (error) {
    logger.error(`Error getting movies from cache: ${error.message}`);
    res.status(500).json({ error: 'Failed to get movies from cache' });
  }
});

// Force save movie cache
router.post('/movies/save', async (req, res) => {
  try {
    await movieDataService.forceSave();
    const stats = movieDataService.getStats();
    
    res.json({
      message: 'Movie cache saved successfully',
      stats
    });
  } catch (error) {
    logger.error(`Error saving movie cache: ${error.message}`);
    res.status(500).json({ error: 'Failed to save movie cache' });
  }
});

// Clean up old cache entries
router.post('/movies/cleanup', async (req, res) => {
  try {
    const { maxAge } = req.body;
    const cleaned = await movieDataService.cleanup(maxAge);
    const stats = movieDataService.getStats();
    
    res.json({
      message: `Cleaned up ${cleaned} old entries`,
      cleaned,
      stats
    });
  } catch (error) {
    logger.error(`Error cleaning movie cache: ${error.message}`);
    res.status(500).json({ error: 'Failed to clean movie cache' });
  }
});

// Clear all memory caches
router.post('/memory/clear', async (req, res) => {
  try {
    cacheService.clearAll();
    
    res.json({
      message: 'Memory caches cleared successfully'
    });
  } catch (error) {
    logger.error(`Error clearing memory cache: ${error.message}`);
    res.status(500).json({ error: 'Failed to clear memory cache' });
  }
});

// Clear movie data cache (WARNING: This removes all cached movie data)
router.post('/movies/clear', async (req, res) => {
  try {
    const { confirm } = req.body;
    
    if (confirm !== 'yes') {
      return res.status(400).json({ 
        error: 'This action requires confirmation. Send { "confirm": "yes" } to proceed.' 
      });
    }
    
    await movieDataService.clearCache();
    
    res.json({
      message: 'Movie data cache cleared successfully'
    });
  } catch (error) {
    logger.error(`Error clearing movie cache: ${error.message}`);
    res.status(500).json({ error: 'Failed to clear movie cache' });
  }
});

module.exports = router;