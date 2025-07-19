const express = require('express');
const cors = require('cors');
const axios = require('axios');
const helmet = require('helmet');
const compression = require('compression');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

// Configure logging
const log = {
  info: (msg) => console.log(`[INFO] ${new Date().toISOString()} - ${msg}`),
  error: (msg) => console.error(`[ERROR] ${new Date().toISOString()} - ${msg}`),
  warn: (msg) => console.warn(`[WARN] ${new Date().toISOString()} - ${msg}`)
};

const app = express();

// Middleware
app.use(helmet());
app.use(compression());
app.use(cors());
app.use(express.json());

// API Configuration
const TRAKT_API_KEY = process.env.TRAKT_API_KEY;
const TMDB_API_KEY = process.env.TMDB_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const TRAKT_BASE_URL = "https://api.trakt.tv";
const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w500";

// Validate required environment variables
if (!TRAKT_API_KEY) {
  log.error("TRAKT_API_KEY environment variable is required");
  process.exit(1);
}

if (!TMDB_API_KEY) {
  log.warn("TMDB_API_KEY not provided - poster images will not be available");
}

if (!GEMINI_API_KEY) {
  log.warn("GEMINI_API_KEY not provided - AI features will not be available");
}

// HTTP client configurations
const traktClient = axios.create({
  baseURL: TRAKT_BASE_URL,
  timeout: 5000,
  headers: {
    'Content-Type': 'application/json',
    'trakt-api-version': '2',
    'trakt-api-key': TRAKT_API_KEY
  }
});

const tmdbClient = axios.create({
  baseURL: TMDB_BASE_URL,
  timeout: 5000,
  params: {
    api_key: TMDB_API_KEY
  }
});

// Initialize Gemini AI client
let genAI = null;
let model = null;
if (GEMINI_API_KEY) {
  try {
    genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    log.info("🤖 Gemini AI initialized successfully");
  } catch (error) {
    log.error(`Failed to initialize Gemini AI: ${error.message}`);
    model = null;
  }
}

// Helper functions
async function makeTraktRequest(endpoint, params = {}) {
  try {
    const response = await traktClient.get(endpoint, { params });
    return response.data;
  } catch (error) {
    log.error(`Trakt API request failed: ${error.message}`);
    return null;
  }
}

async function makeTmdbRequest(endpoint, params = {}) {
  if (!TMDB_API_KEY) return null;
  
  try {
    const response = await tmdbClient.get(endpoint, { params });
    return response.data;
  } catch (error) {
    log.error(`TMDB API request failed: ${error.message}`);
    return null;
  }
}

async function enhanceMovieData(movieItem) {
  const movie = movieItem.movie;
  const enhancedItem = { ...movieItem };
  
  try {
    // Make concurrent requests for stats, ratings, and poster
    const [stats, ratings, tmdbData] = await Promise.allSettled([
      makeTraktRequest(`/movies/${movie.ids.trakt}/stats`),
      makeTraktRequest(`/movies/${movie.ids.trakt}/ratings`),
      TMDB_API_KEY ? makeTmdbRequest('/search/movie', {
        query: movie.title,
        year: movie.year || ''
      }) : Promise.resolve(null)
    ]);
    
    // Add stats if successful
    if (stats.status === 'fulfilled' && stats.value) {
      enhancedItem.stats = stats.value;
    }
    
    // Add ratings if successful
    if (ratings.status === 'fulfilled' && ratings.value) {
      enhancedItem.ratings = ratings.value;
    }
    
    // Add poster if available
    if (tmdbData.status === 'fulfilled' && tmdbData.value?.results?.length > 0) {
      const posterPath = tmdbData.value.results[0].poster_path;
      if (posterPath) {
        enhancedItem.posterUrl = `${TMDB_IMAGE_BASE}${posterPath}`;
      }
    }
    
  } catch (error) {
    log.warn(`Error enhancing movie ${movie.title}: ${error.message}`);
  }
  
  return enhancedItem;
}

async function enhanceRelatedMovie(movie) {
  const enhancedMovie = { ...movie };
  
  try {
    // Get rating and poster concurrently
    const [ratings, tmdbData] = await Promise.allSettled([
      makeTraktRequest(`/movies/${movie.ids.trakt}/ratings`),
      TMDB_API_KEY ? makeTmdbRequest('/search/movie', {
        query: movie.title,
        year: movie.year || ''
      }) : Promise.resolve(null)
    ]);
    
    // Add rating
    if (ratings.status === 'fulfilled' && ratings.value) {
      enhancedMovie.rating = ratings.value.rating || 0;
    } else {
      enhancedMovie.rating = 0;
    }
    
    // Add poster if available
    if (tmdbData.status === 'fulfilled' && tmdbData.value?.results?.length > 0) {
      const posterPath = tmdbData.value.results[0].poster_path;
      if (posterPath) {
        enhancedMovie.posterUrl = `${TMDB_IMAGE_BASE}${posterPath}`;
      }
    }
    
  } catch (error) {
    log.warn(`Error enhancing related movie ${movie.title}: ${error.message}`);
    enhancedMovie.rating = 0;
  }
  
  return enhancedMovie;
}

// API Routes

// Search movies with enhancement
app.get('/api/search/movies', async (req, res) => {
  const startTime = Date.now();
  const query = req.query.query?.trim();
  
  if (!query) {
    return res.status(400).json({ error: 'Query parameter is required' });
  }
  
  try {
    // Search movies on Trakt
    const data = await makeTraktRequest('/search/movie', { query });
    
    if (!data) {
      return res.json([]);
    }
    
    // Filter only movie results and limit to first 10 for performance
    const movies = data.filter(item => item.movie).slice(0, 10);
    
    // Enhance movies concurrently
    const enhancedMovies = await Promise.allSettled(
      movies.map(movie => enhanceMovieData(movie))
    );
    
    const results = enhancedMovies
      .filter(result => result.status === 'fulfilled')
      .map(result => result.value);
    
    const endTime = Date.now();
    log.info(`Search completed in ${(endTime - startTime) / 1000}s`);
    
    res.json(results);
    
  } catch (error) {
    log.error(`Error searching movies: ${error.message}`);
    res.status(500).json({ error: 'Failed to search movies' });
  }
});

// Fast search without enhancement
app.get('/api/search/movies/fast', async (req, res) => {
  const query = req.query.query?.trim();
  
  if (!query) {
    return res.status(400).json({ error: 'Query parameter is required' });
  }
  
  try {
    const data = await makeTraktRequest('/search/movie', { query });
    
    if (!data) {
      return res.json([]);
    }
    
    // Return basic data immediately without enhancement
    const movies = data.filter(item => item.movie).slice(0, 15);
    res.json(movies);
    
  } catch (error) {
    log.error(`Error searching movies: ${error.message}`);
    res.status(500).json({ error: 'Failed to search movies' });
  }
});

// Enhance a specific movie
app.get('/api/movies/:traktId/enhance', async (req, res) => {
  const traktId = req.params.traktId;
  
  try {
    // Get movie data first
    const movieData = await makeTraktRequest(`/movies/${traktId}`);
    if (!movieData) {
      return res.status(404).json({ error: 'Movie not found' });
    }
    
    // Create movie item structure and enhance
    const movieItem = { movie: movieData };
    const enhanced = await enhanceMovieData(movieItem);
    
    res.json(enhanced);
    
  } catch (error) {
    log.error(`Error enhancing movie: ${error.message}`);
    res.status(500).json({ error: 'Failed to enhance movie' });
  }
});

// Get movie details
app.get('/api/movies/:traktId', async (req, res) => {
  const traktId = req.params.traktId;
  
  try {
    const movieDetails = await makeTraktRequest(`/movies/${traktId}`);
    if (!movieDetails) {
      return res.status(404).json({ error: 'Movie not found' });
    }
    res.json(movieDetails);
  } catch (error) {
    log.error(`Error getting movie details: ${error.message}`);
    res.status(500).json({ error: 'Failed to get movie details' });
  }
});

// Get related movies with enhancement
app.get('/api/movies/:traktId/related', async (req, res) => {
  const startTime = Date.now();
  const traktId = req.params.traktId;
  
  try {
    const relatedMovies = await makeTraktRequest(`/movies/${traktId}/related`);
    
    if (!relatedMovies) {
      return res.json([]);
    }
    
    // Limit to 8 movies for better performance
    const moviesToEnhance = relatedMovies.slice(0, 8);
    
    // Enhance movies concurrently
    const enhancedResults = await Promise.allSettled(
      moviesToEnhance.map(movie => enhanceRelatedMovie(movie))
    );
    
    const enhancedRelated = enhancedResults
      .filter(result => result.status === 'fulfilled')
      .map(result => result.value);
    
    const endTime = Date.now();
    log.info(`Related movies completed in ${(endTime - startTime) / 1000}s`);
    
    res.json(enhancedRelated);
    
  } catch (error) {
    log.error(`Error getting related movies: ${error.message}`);
    res.status(500).json({ error: 'Failed to get related movies' });
  }
});

// Get related movies fast (no enhancement)
app.get('/api/movies/:traktId/related/fast', async (req, res) => {
  const traktId = req.params.traktId;
  
  try {
    const relatedMovies = await makeTraktRequest(`/movies/${traktId}/related`);
    
    if (!relatedMovies) {
      return res.json([]);
    }
    
    // Return first 12 movies without enhancement
    res.json(relatedMovies.slice(0, 12));
    
  } catch (error) {
    log.error(`Error getting related movies: ${error.message}`);
    res.status(500).json({ error: 'Failed to get related movies' });
  }
});

// AI Endpoints

// Generate movie synopsis using Gemini AI
app.post('/api/ai/synopsis', async (req, res) => {
  if (!model) {
    return res.status(503).json({ error: 'AI service not available - Gemini API key not configured' });
  }

  const { movieTitle, movieOverview } = req.body;
  
  if (!movieTitle) {
    return res.status(400).json({ error: 'Movie title is required' });
  }

  try {
    const prompt = `Generate a compelling and slightly expanded synopsis for the movie '${movieTitle}' which is about '${movieOverview || 'No overview available'}'. Keep it concise but engaging, around 2-3 sentences.`;
    
    log.info(`Generating synopsis for: ${movieTitle}`);
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    log.info(`Generated synopsis for movie: ${movieTitle}`);
    res.json({ synopsis: text });
    
  } catch (error) {
    log.error(`Error generating synopsis for ${movieTitle}: ${error.message}`);
    if (error.message.includes('API_KEY_INVALID')) {
      res.status(401).json({ error: 'Invalid Gemini API key' });
    } else if (error.message.includes('QUOTA_EXCEEDED')) {
      res.status(429).json({ error: 'API quota exceeded' });
    } else {
      res.status(500).json({ error: `Failed to generate synopsis: ${error.message}` });
    }
  }
});

// Generate insights about why user might like related movies
app.post('/api/ai/insights', async (req, res) => {
  if (!model) {
    return res.status(503).json({ error: 'AI service not available - Gemini API key not configured' });
  }

  const { selectedMovie, relatedMovies } = req.body;
  
  if (!selectedMovie || !relatedMovies || relatedMovies.length === 0) {
    return res.status(400).json({ error: 'Selected movie and related movies are required' });
  }

  try {
    const selectedTitle = selectedMovie.title;
    const selectedOverview = selectedMovie.overview || 'a movie with interesting themes';
    const relatedTitles = relatedMovies.map(movie => movie.title).join(', ');
    
    const prompt = `The movie '${selectedTitle}' is known for its themes and plot like: '${selectedOverview}'. Here are some related movies: ${relatedTitles}. Explain why someone who liked '${selectedTitle}' might enjoy these related movies, highlighting common themes, genres, or directorial styles. Be insightful and encouraging, around 3-4 sentences.`;
    
    log.info(`Generating insights for: ${selectedTitle}`);
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    log.info(`Successfully generated insights for movie: ${selectedTitle}`);
    res.json({ insights: text });
    
  } catch (error) {
    log.error(`Error generating insights for ${selectedTitle}: ${error.message}`);
    if (error.message.includes('API_KEY_INVALID')) {
      res.status(401).json({ error: 'Invalid Gemini API key' });
    } else if (error.message.includes('QUOTA_EXCEEDED')) {
      res.status(429).json({ error: 'Gemini API quota exceeded' });
    } else {
      res.status(500).json({ error: `Failed to generate insights: ${error.message}` });
    }
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    trakt_api_configured: !!TRAKT_API_KEY,
    tmdb_api_configured: !!TMDB_API_KEY,
    gemini_api_configured: !!GEMINI_API_KEY,
    optimization: 'enabled',
    runtime: 'Node.js'
  });
});

// Error handlers
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

app.use((err, req, res, next) => {
  log.error(`Unhandled error: ${err.message}`);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  log.info(`🚀 Trakt API Explorer server running on port ${PORT}`);
  log.info(`🏥 Health check: http://localhost:${PORT}/api/health`);
  log.info(`🎬 Trakt API: ${TRAKT_API_KEY ? 'Configured' : 'Missing'}`);
  log.info(`🖼️  TMDB API: ${TMDB_API_KEY ? 'Configured' : 'Missing'}`);
});