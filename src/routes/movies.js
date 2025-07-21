/**
 * Movie-related routes
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


// Enhance a specific movie
router.get('/:traktId/enhance', setCacheHeaders, async (req, res) => {
  const { traktId } = req.params;

  try {
    // Get movie data first
    const movieData = await traktService.getMovieDetails(traktId);
    if (!movieData) {
      return res.status(404).json({ error: 'Movie not found' });
    }

    // Create movie item structure and enhance
    const movieItem = { movie: movieData };
    const enhanced = await enhancementService.enhanceMovieData(movieItem);

    res.json(enhanced);
  } catch (error) {
    logger.error(`Error enhancing movie: ${error.message}`, { traktId });
    res.status(500).json({ error: 'Failed to enhance movie' });
  }
});

// Get movie details
router.get('/:traktId', setCacheHeaders, async (req, res) => {
  const { traktId } = req.params;

  try {
    const movieDetails = await traktService.getMovieDetails(traktId, true);
    if (!movieDetails) {
      return res.status(404).json({ error: 'Movie not found' });
    }
    res.json(movieDetails);
  } catch (error) {
    logger.error(`Error getting movie details: ${error.message}`, { traktId });
    res.status(500).json({ error: 'Failed to get movie details' });
  }
});

// Get movie details with full extended data
router.get('/:traktId/full', setCacheHeaders, async (req, res) => {
  const { traktId } = req.params;

  try {
    const fullMovieData = await traktService.getFullMovieData(traktId);
    if (!fullMovieData) {
      return res.status(404).json({ error: 'Movie not found' });
    }

    res.json(fullMovieData);
  } catch (error) {
    logger.error(`Error getting full movie details: ${error.message}`, { traktId });
    res.status(500).json({ error: 'Failed to get full movie details' });
  }
});

// Get related movies with enhancement
router.get('/:traktId/related', setCacheHeaders, async (req, res) => {
  const startTime = Date.now();
  const { traktId } = req.params;

  try {
    const relatedMovies = await traktService.getRelatedMovies(traktId);
    if (!relatedMovies) {
      return res.json([]);
    }

    // Limit to 8 movies for better performance
    const moviesToEnhance = relatedMovies.slice(0, 8);

    // Enhance movies concurrently
    const enhancedMovies = await enhancementService.enhanceMovieList(
      moviesToEnhance,
      { maxConcurrent: 4, includeStats: false }
    );

    const duration = Date.now() - startTime;
    logger.info(`Related movies enhanced in ${duration}ms for movie: ${traktId}`);

    res.json(enhancedMovies);
  } catch (error) {
    logger.error(`Error getting related movies: ${error.message}`, { traktId });
    res.status(500).json({ error: 'Failed to get related movies' });
  }
});

// Get related movies without enhancement (fast)
router.get('/:traktId/related/fast', setCacheHeaders, async (req, res) => {
  const { traktId } = req.params;

  try {
    const relatedMovies = await traktService.getRelatedMovies(traktId);
    if (!relatedMovies) {
      return res.json([]);
    }

    // Return first 10 without enhancement
    res.json(relatedMovies.slice(0, 10));
  } catch (error) {
    logger.error(`Error getting related movies (fast): ${error.message}`, { traktId });
    res.status(500).json({ error: 'Failed to get related movies' });
  }
});

module.exports = router;