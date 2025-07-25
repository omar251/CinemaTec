/**
 * Cache management routes
 */
const express = require('express');
const router = express.Router();
const movieDataService = require('../services/movieDataService');
const cacheService = require('../services/cacheService');
const logger = require('../utils/logger');

// Get cache statistics (updated for frontend compatibility)
router.get('/stats', async (req, res) => {
  try {
    const movieCacheStats = await movieDataService.getStats();
    const memoryCacheStats = cacheService.getStatus();
    
    const stats = {
      success: true,
      data: {
        movieData: movieCacheStats,
        memoryCache: memoryCacheStats,
        timestamp: new Date().toISOString()
      }
    };
    
    res.json(stats);
  } catch (error) {
    logger.error(`Error getting cache stats: ${error.message}`);
    res.status(500).json({ 
      success: false,
      error: 'Failed to get cache statistics' 
    });
  }
});

// Get all cached movies with pagination (new endpoint for frontend)
router.get('/movies', async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;
    
    const movies = await movieDataService.getAllMovies(parseInt(limit), parseInt(offset));
    const stats = await movieDataService.getStats();
    
    res.json({
      success: true,
      data: {
        movies,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          total: stats.database?.totalMovies || 0
        }
      }
    });
  } catch (error) {
    logger.error(`Error getting cached movies: ${error.message}`);
    res.status(500).json({ 
      success: false,
      error: 'Failed to get cached movies' 
    });
  }
});

// Search movies in cache (new endpoint for frontend)
router.get('/search', async (req, res) => {
  try {
    const { q: query, limit = 10 } = req.query;
    
    if (!query) {
      return res.status(400).json({ 
        success: false,
        error: 'Query parameter "q" is required' 
      });
    }
    
    const results = await movieDataService.searchMovies(query, parseInt(limit));
    
    res.json({
      success: true,
      data: {
        query,
        results,
        count: results.length
      }
    });
  } catch (error) {
    logger.error(`Error searching movie cache: ${error.message}`);
    res.status(500).json({ 
      success: false,
      error: 'Failed to search movie cache' 
    });
  }
});

// Search movies in cache (legacy endpoint)
router.get('/movies/search', async (req, res) => {
  try {
    const { q: query, limit = 10 } = req.query;
    
    if (!query) {
      return res.status(400).json({ error: 'Query parameter "q" is required' });
    }
    
    const results = await movieDataService.searchMovies(query, parseInt(limit));
    
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
router.get('/movie/:traktId', async (req, res) => {
  try {
    const { traktId } = req.params;
    const movie = await movieDataService.getMovie(parseInt(traktId));
    
    if (!movie) {
      return res.status(404).json({ 
        success: false,
        error: 'Movie not found in cache' 
      });
    }
    
    res.json({
      success: true,
      data: movie
    });
  } catch (error) {
    logger.error(`Error getting movie from cache: ${error.message}`);
    res.status(500).json({ 
      success: false,
      error: 'Failed to get movie from cache' 
    });
  }
});

// Get specific movie from cache (legacy endpoint)
router.get('/movies/:traktId', async (req, res) => {
  try {
    const { traktId } = req.params;
    const movie = await movieDataService.getMovie(parseInt(traktId));
    
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
    
    const movies = await movieDataService.getMovies(traktIds);
    
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
    const stats = await movieDataService.getStats();
    
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
    const stats = await movieDataService.getStats();
    
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

// Clear cache (new unified endpoint for frontend)
router.post('/clear', async (req, res) => {
  try {
    const { type } = req.body;
    
    if (type === 'movie-data' || !type) {
      // Clear movie data cache (database)
      await movieDataService.clearCache();
      logger.info('Movie data cache cleared');
    }
    
    if (type === 'memory' || !type) {
      // Clear memory cache (API responses)
      cacheService.clearAll();
      logger.info('Memory cache cleared');
    }
    
    res.json({
      success: true,
      message: `Cache cleared successfully${type ? ` (${type})` : ''}`
    });
  } catch (error) {
    logger.error(`Failed to clear cache: ${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Clear all memory caches (legacy endpoint)
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