/**
 * Movie-related routes
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

// Get movie details with full extended data including poster
router.get('/:traktId/full', setCacheHeaders, async (req, res) => {
  const { traktId } = req.params;

  try {
    const fullMovieData = await traktService.getFullMovieData(traktId);
    if (!fullMovieData) {
      return res.status(404).json({ error: 'Movie not found' });
    }

    // Enhance with poster data
    const enhanced = await enhancementService.enhanceMovieData({ movie: fullMovieData });
    
    // Return the enhanced movie data (flatten the structure)
    res.json(enhanced.movie || enhanced);
  } catch (error) {
    logger.error(`Error getting full movie details: ${error.message}`, { traktId });
    res.status(500).json({ error: 'Failed to get full movie details' });
  }
});

// Get related movies with cache-first enhancement
router.get('/:traktId/related', setCacheHeaders, async (req, res) => {
  const startTime = Date.now();
  const { traktId } = req.params;

  try {
    const relatedMovies = await traktService.getRelatedMovies(traktId);
    if (!relatedMovies) {
      return res.json([]);
    }

    // Limit to 8 movies for better performance
    const moviesToProcess = relatedMovies.slice(0, 8);
    
    // Check cache for each movie first
    const cachedMovies = [];
    const uncachedMovies = [];
    
    for (const movie of moviesToProcess) {
      const cachedMovie = movieDataService.getMovie(movie.ids.trakt, movie.title, movie.year);
      if (cachedMovie) {
        // Use cached enhanced version
        cachedMovies.push({ movie: cachedMovie });
        logger.debug(`Using cached movie: ${movie.title} (${movie.year})`);
      } else {
        // Need to enhance this movie
        uncachedMovies.push(movie);
      }
    }

    // Enhance uncached movies if any
    let enhancedUncached = [];
    if (uncachedMovies.length > 0) {
      logger.info(`Enhancing ${uncachedMovies.length} uncached related movies`);
      enhancedUncached = await enhancementService.enhanceMovieList(
        uncachedMovies,
        { maxConcurrent: 4, includeStats: false }
      );
    }

    // Combine cached and newly enhanced movies
    const allEnhancedMovies = [...cachedMovies, ...enhancedUncached];

    const duration = Date.now() - startTime;
    logger.info(`Related movies processed in ${duration}ms for movie: ${traktId} (${cachedMovies.length} from cache, ${enhancedUncached.length} enhanced)`);

    res.json(allEnhancedMovies);
  } catch (error) {
    logger.error(`Error getting related movies: ${error.message}`, { traktId });
    res.status(500).json({ error: 'Failed to get related movies' });
  }
});

// Get related movies with cache-first approach (fast but enhanced when cached)
router.get('/:traktId/related/fast', setCacheHeaders, async (req, res) => {
  const { traktId } = req.params;

  try {
    const relatedMovies = await traktService.getRelatedMovies(traktId);
    if (!relatedMovies) {
      return res.json([]);
    }

    // Limit to 10 movies for fast response
    const moviesToProcess = relatedMovies.slice(0, 10);
    
    // Check cache for enhanced versions
    const result = [];
    
    for (const movie of moviesToProcess) {
      const cachedMovie = movieDataService.getMovie(movie.ids.trakt, movie.title, movie.year);
      if (cachedMovie) {
        // Use cached enhanced version with full details
        result.push(cachedMovie);
        logger.debug(`Fast endpoint using cached movie: ${movie.title} (${movie.year})`);
      } else {
        // Use basic API data for uncached movies
        result.push(movie);
      }
    }

    logger.info(`Fast related movies for ${traktId}: ${result.filter(m => m.rating || m.stats).length}/${result.length} from cache`);
    res.json(result);
  } catch (error) {
    logger.error(`Error getting related movies (fast): ${error.message}`, { traktId });
    res.status(500).json({ error: 'Failed to get related movies' });
  }
});

module.exports = router;