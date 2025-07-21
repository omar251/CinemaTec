const path = require("path");
const express = require("express");
const cors = require("cors");
const axios = require("axios");
const helmet = require("helmet");
const compression = require("compression");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const NetworkStorage = require("./lib/network_storage");
require("dotenv").config();

// Simple in-memory cache implementation
class MemoryCache {
  constructor(defaultTTL = 300000) {
    // 5 minutes default
    this.cache = new Map();
    this.defaultTTL = defaultTTL;
  }

  set(key, value, ttl = this.defaultTTL) {
    const expiry = Date.now() + ttl;
    this.cache.set(key, { value, expiry });
  }

  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;

    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }

    return item.value;
  }

  has(key) {
    return this.get(key) !== null;
  }

  delete(key) {
    return this.cache.delete(key);
  }

  clear() {
    this.cache.clear();
  }

  size() {
    return this.cache.size;
  }

  // Clean expired entries
  cleanup() {
    const now = Date.now();
    for (const [key, item] of this.cache.entries()) {
      if (now > item.expiry) {
        this.cache.delete(key);
      }
    }
  }
}

// Initialize cache instances
const apiCache = new MemoryCache(300000); // 5 minutes for API responses
const enhancedCache = new MemoryCache(600000); // 10 minutes for enhanced data
const aiCache = new MemoryCache(1800000); // 30 minutes for AI responses

// Initialize network storage
const networkStorage = new NetworkStorage("file", {
  dataDir: "saved_networks",
});

// Cache cleanup interval (every 5 minutes)
setInterval(() => {
  apiCache.cleanup();
  enhancedCache.cleanup();
  aiCache.cleanup();
}, 300000);

// Configure logging
const log = {
  info: (msg) => console.log(`[INFO] ${new Date().toISOString()} - ${msg}`),
  error: (msg) => console.error(`[ERROR] ${new Date().toISOString()} - ${msg}`),
  warn: (msg) => console.warn(`[WARN] ${new Date().toISOString()} - ${msg}`),
};

const app = express();

// Middleware
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "https://d3js.org",
          "https://cdn.jsdelivr.net",
        ],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
  }),
);
app.use(compression());
app.use(cors());
app.use(express.json());

// Serve static files from the project root directory
app.use(express.static(path.join(__dirname, '..', 'public')));

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
    "Content-Type": "application/json",
    "trakt-api-version": "2",
    "trakt-api-key": TRAKT_API_KEY,
  },
});

const tmdbClient = axios.create({
  baseURL: TMDB_BASE_URL,
  timeout: 5000,
  params: {
    api_key: TMDB_API_KEY,
  },
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
  const cacheKey = `trakt:${endpoint}:${JSON.stringify(params)}`;

  // Check cache first
  const cached = apiCache.get(cacheKey);
  if (cached) {
    log.info(`Cache hit for Trakt: ${endpoint}`);
    return cached;
  }

  try {
    const response = await traktClient.get(endpoint, { params });
    const data = response.data;

    // Cache the response
    apiCache.set(cacheKey, data);
    log.info(`Cached Trakt response: ${endpoint}`);

    return data;
  } catch (error) {
    log.error(`Trakt API request failed: ${error.message}`);
    return null;
  }
}

async function makeTmdbRequest(endpoint, params = {}) {
  if (!TMDB_API_KEY) return null;

  const cacheKey = `tmdb:${endpoint}:${JSON.stringify(params)}`;

  // Check cache first
  const cached = apiCache.get(cacheKey);
  if (cached) {
    log.info(`Cache hit for TMDB: ${endpoint}`);
    return cached;
  }

  try {
    const response = await tmdbClient.get(endpoint, { params });
    const data = response.data;

    // Cache the response
    apiCache.set(cacheKey, data);
    log.info(`Cached TMDB response: ${endpoint}`);

    return data;
  } catch (error) {
    log.error(`TMDB API request failed: ${error.message}`);
    return null;
  }
}

async function enhanceMovieData(movieItem) {
  const movie = movieItem.movie;
  const cacheKey = `enhanced:movie:${movie.ids.trakt}`;

  // Check enhanced cache first
  const cached = enhancedCache.get(cacheKey);
  if (cached) {
    log.info(`Cache hit for enhanced movie: ${movie.title}`);
    return cached;
  }

  const enhancedItem = { ...movieItem };

  try {
    // Make concurrent requests for stats, ratings, and poster
    const [stats, ratings, tmdbData] = await Promise.allSettled([
      makeTraktRequest(`/movies/${movie.ids.trakt}/stats`),
      makeTraktRequest(`/movies/${movie.ids.trakt}/ratings`),
      TMDB_API_KEY
        ? makeTmdbRequest("/search/movie", {
            query: movie.title,
            year: movie.year || "",
          })
        : Promise.resolve(null),
    ]);

    // Add stats if successful
    if (stats.status === "fulfilled" && stats.value) {
      enhancedItem.stats = stats.value;
    }

    // Add ratings if successful
    if (ratings.status === "fulfilled" && ratings.value) {
      enhancedItem.ratings = ratings.value;
    }

    // Add poster if available
    if (
      tmdbData.status === "fulfilled" &&
      tmdbData.value?.results?.length > 0
    ) {
      const posterPath = tmdbData.value.results[0].poster_path;
      if (posterPath) {
        enhancedItem.posterUrl = `${TMDB_IMAGE_BASE}${posterPath}`;
      }
    }

    // Cache the enhanced result
    enhancedCache.set(cacheKey, enhancedItem);
    log.info(`Cached enhanced movie: ${movie.title}`);
  } catch (error) {
    log.warn(`Error enhancing movie ${movie.title}: ${error.message}`);
  }

  return enhancedItem;
}

async function enhanceRelatedMovie(movie) {
  const cacheKey = `enhanced:related:${movie.ids.trakt}`;

  // Check enhanced cache first
  const cached = enhancedCache.get(cacheKey);
  if (cached) {
    log.info(`Cache hit for enhanced related movie: ${movie.title}`);
    return cached;
  }

  const enhancedMovie = { ...movie };

  try {
    // Get rating and poster concurrently
    const [ratings, tmdbData] = await Promise.allSettled([
      makeTraktRequest(`/movies/${movie.ids.trakt}/ratings`),
      TMDB_API_KEY
        ? makeTmdbRequest("/search/movie", {
            query: movie.title,
            year: movie.year || "",
          })
        : Promise.resolve(null),
    ]);

    // Add rating
    if (ratings.status === "fulfilled" && ratings.value) {
      enhancedMovie.rating = ratings.value.rating || 0;
    } else {
      enhancedMovie.rating = 0;
    }

    // Add poster if available
    if (
      tmdbData.status === "fulfilled" &&
      tmdbData.value?.results?.length > 0
    ) {
      const posterPath = tmdbData.value.results[0].poster_path;
      if (posterPath) {
        enhancedMovie.posterUrl = `${TMDB_IMAGE_BASE}${posterPath}`;
      }
    }

    // Cache the enhanced result
    enhancedCache.set(cacheKey, enhancedMovie);
    log.info(`Cached enhanced related movie: ${movie.title}`);
  } catch (error) {
    log.warn(`Error enhancing related movie ${movie.title}: ${error.message}`);
    enhancedMovie.rating = 0;
  }

  return enhancedMovie;
}

// Cache middleware for HTTP responses
function setCacheHeaders(req, res, next) {
  // Set cache headers for API responses
  res.set({
    "Cache-Control": "public, max-age=300", // 5 minutes
    ETag: `"${Date.now()}"`,
    Vary: "Accept-Encoding",
  });
  next();
}

// API Routes

// Search movies with enhancement
app.get("/api/search/movies", setCacheHeaders, async (req, res) => {
  const startTime = Date.now();
  const query = req.query.query?.trim();

  if (!query) {
    return res.status(400).json({ error: "Query parameter is required" });
  }

  try {
    // Search movies on Trakt
    const data = await makeTraktRequest("/search/movie", { query });

    if (!data) {
      return res.json([]);
    }

    // Filter only movie results and limit to first 10 for performance
    const movies = data.filter((item) => item.movie).slice(0, 10);

    // Enhance movies concurrently
    const enhancedMovies = await Promise.allSettled(
      movies.map((movie) => enhanceMovieData(movie)),
    );

    const results = enhancedMovies
      .filter((result) => result.status === "fulfilled")
      .map((result) => result.value);

    const endTime = Date.now();
    log.info(`Search completed in ${(endTime - startTime) / 1000}s`);

    res.json(results);
  } catch (error) {
    log.error(`Error searching movies: ${error.message}`);
    res.status(500).json({ error: "Failed to search movies" });
  }
});

// Fast search without enhancement
app.get("/api/search/movies/fast", setCacheHeaders, async (req, res) => {
  const query = req.query.query?.trim();

  if (!query) {
    return res.status(400).json({ error: "Query parameter is required" });
  }

  try {
    const data = await makeTraktRequest("/search/movie", { query });

    if (!data) {
      return res.json([]);
    }

    // Return basic data immediately without enhancement
    const movies = data.filter((item) => item.movie).slice(0, 15);
    res.json(movies);
  } catch (error) {
    log.error(`Error searching movies: ${error.message}`);
    res.status(500).json({ error: "Failed to search movies" });
  }
});

// Enhance a specific movie
app.get("/api/movies/:traktId/enhance", setCacheHeaders, async (req, res) => {
  const traktId = req.params.traktId;

  try {
    // Get movie data first
    const movieData = await makeTraktRequest(`/movies/${traktId}`);
    if (!movieData) {
      return res.status(404).json({ error: "Movie not found" });
    }

    // Create movie item structure and enhance
    const movieItem = { movie: movieData };
    const enhanced = await enhanceMovieData(movieItem);

    res.json(enhanced);
  } catch (error) {
    log.error(`Error enhancing movie: ${error.message}`);
    res.status(500).json({ error: "Failed to enhance movie" });
  }
});

// Get movie details
app.get("/api/movies/:traktId", setCacheHeaders, async (req, res) => {
  const traktId = req.params.traktId;

  try {
    const movieDetails = await makeTraktRequest(`/movies/${traktId}`, {
      extended: "full",
    });
    if (!movieDetails) {
      return res.status(404).json({ error: "Movie not found" });
    }
    res.json(movieDetails);
  } catch (error) {
    log.error(`Error getting movie details: ${error.message}`);
    res.status(500).json({ error: "Failed to get movie details" });
  }
});

// Get movie details with full extended data (explicit endpoint)
app.get("/api/movies/:traktId/full", setCacheHeaders, async (req, res) => {
  const traktId = req.params.traktId;

  try {
    const movieDetails = await makeTraktRequest(`/movies/${traktId}`, {
      extended: "full",
    });
    if (!movieDetails) {
      return res.status(404).json({ error: "Movie not found" });
    }

    // Also get stats and ratings for complete data
    const [stats, ratings] = await Promise.allSettled([
      makeTraktRequest(`/movies/${traktId}/stats`),
      makeTraktRequest(`/movies/${traktId}/ratings`),
    ]);

    const fullMovieData = {
      ...movieDetails,
      stats: stats.status === "fulfilled" ? stats.value : null,
      ratings: ratings.status === "fulfilled" ? ratings.value : null,
    };

    res.json(fullMovieData);
  } catch (error) {
    log.error(`Error getting full movie details: ${error.message}`);
    res.status(500).json({ error: "Failed to get full movie details" });
  }
});

// Get related movies with enhancement
app.get("/api/movies/:traktId/related", setCacheHeaders, async (req, res) => {
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
      moviesToEnhance.map((movie) => enhanceRelatedMovie(movie)),
    );

    const enhancedRelated = enhancedResults
      .filter((result) => result.status === "fulfilled")
      .map((result) => result.value);

    const endTime = Date.now();
    log.info(`Related movies completed in ${(endTime - startTime) / 1000}s`);

    res.json(enhancedRelated);
  } catch (error) {
    log.error(`Error getting related movies: ${error.message}`);
    res.status(500).json({ error: "Failed to get related movies" });
  }
});

// Get related movies fast (no enhancement)
app.get(
  "/api/movies/:traktId/related/fast",
  setCacheHeaders,
  async (req, res) => {
    const traktId = req.params.traktId;

    try {
      const relatedMovies = await makeTraktRequest(
        `/movies/${traktId}/related`,
      );

      if (!relatedMovies) {
        return res.json([]);
      }

      // Return first 12 movies without enhancement
      res.json(relatedMovies.slice(0, 12));
    } catch (error) {
      log.error(`Error getting related movies: ${error.message}`);
      res.status(500).json({ error: "Failed to get related movies" });
    }
  },
);

// AI Endpoints

// Generate movie synopsis using Gemini AI
app.post("/api/ai/synopsis", async (req, res) => {
  if (!model) {
    return res.status(503).json({
      error: "AI service not available - Gemini API key not configured",
    });
  }

  const { movieTitle, movieOverview } = req.body;

  if (!movieTitle) {
    return res.status(400).json({ error: "Movie title is required" });
  }

  // Check AI cache first
  const cacheKey = `ai:synopsis:${movieTitle}:${movieOverview || "no-overview"}`;
  const cached = aiCache.get(cacheKey);
  if (cached) {
    log.info(`Cache hit for AI synopsis: ${movieTitle}`);
    return res.json({ synopsis: cached });
  }

  try {
    const prompt = `Generate a compelling and slightly expanded synopsis for the movie '${movieTitle}' which is about '${movieOverview || "No overview available"}'. Keep it concise but engaging, around 2-3 sentences.`;

    log.info(`Generating synopsis for: ${movieTitle}`);
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // Cache the AI response
    aiCache.set(cacheKey, text);
    log.info(`Generated and cached synopsis for movie: ${movieTitle}`);

    res.json({ synopsis: text });
  } catch (error) {
    log.error(`Error generating synopsis for ${movieTitle}: ${error.message}`);
    if (error.message.includes("API_KEY_INVALID")) {
      res.status(401).json({ error: "Invalid Gemini API key" });
    } else if (error.message.includes("QUOTA_EXCEEDED")) {
      res.status(429).json({ error: "API quota exceeded" });
    } else {
      res
        .status(500)
        .json({ error: `Failed to generate synopsis: ${error.message}` });
    }
  }
});

// Generate insights about why user might like related movies
app.post("/api/ai/insights", async (req, res) => {
  if (!model) {
    return res.status(503).json({
      error: "AI service not available - Gemini API key not configured",
    });
  }

  const { selectedMovie, relatedMovies } = req.body;

  if (!selectedMovie || !relatedMovies || relatedMovies.length === 0) {
    return res
      .status(400)
      .json({ error: "Selected movie and related movies are required" });
  }

  const selectedTitle = selectedMovie.title;
  const selectedOverview =
    selectedMovie.overview || "a movie with interesting themes";
  const relatedTitles = relatedMovies.map((movie) => movie.title).join(", ");

  // Check AI cache first
  const cacheKey = `ai:insights:${selectedTitle}:${relatedTitles}`;
  const cached = aiCache.get(cacheKey);
  if (cached) {
    log.info(`Cache hit for AI insights: ${selectedTitle}`);
    return res.json({ insights: cached });
  }

  try {
    const prompt = `The movie '${selectedTitle}' is known for its themes and plot like: '${selectedOverview}'. Here are some related movies: ${relatedTitles}. Explain why someone who liked '${selectedTitle}' might enjoy these related movies, highlighting common themes, genres, or directorial styles. Be insightful and encouraging, around 3-4 sentences.`;

    log.info(`Generating insights for: ${selectedTitle}`);
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // Cache the AI response
    aiCache.set(cacheKey, text);
    log.info(`Generated and cached insights for movie: ${selectedTitle}`);

    res.json({ insights: text });
  } catch (error) {
    log.error(
      `Error generating insights for ${selectedTitle}: ${error.message}`,
    );
    if (error.message.includes("API_KEY_INVALID")) {
      res.status(401).json({ error: "Invalid Gemini API key" });
    } else if (error.message.includes("QUOTA_EXCEEDED")) {
      res.status(429).json({ error: "Gemini API quota exceeded" });
    } else {
      res
        .status(500)
        .json({ error: `Failed to generate insights: ${error.message}` });
    }
  }
});

// Cache status endpoint
app.get("/api/cache/status", (req, res) => {
  res.json({
    api_cache: {
      size: apiCache.size(),
      ttl: "5 minutes",
    },
    enhanced_cache: {
      size: enhancedCache.size(),
      ttl: "10 minutes",
    },
    ai_cache: {
      size: aiCache.size(),
      ttl: "30 minutes",
    },
    total_cached_items: apiCache.size() + enhancedCache.size() + aiCache.size(),
  });
});

// Clear cache endpoint (for development/testing)
app.post("/api/cache/clear", (req, res) => {
  const { type } = req.body;

  if (type === "all" || !type) {
    apiCache.clear();
    enhancedCache.clear();
    aiCache.clear();
    log.info("All caches cleared");
    res.json({ message: "All caches cleared successfully" });
  } else if (type === "api") {
    apiCache.clear();
    log.info("API cache cleared");
    res.json({ message: "API cache cleared successfully" });
  } else if (type === "enhanced") {
    enhancedCache.clear();
    log.info("Enhanced cache cleared");
    res.json({ message: "Enhanced cache cleared successfully" });
  } else if (type === "ai") {
    aiCache.clear();
    log.info("AI cache cleared");
    res.json({ message: "AI cache cleared successfully" });
  } else {
    res
      .status(400)
      .json({ error: "Invalid cache type. Use: all, api, enhanced, or ai" });
  }
});

// Network Storage Endpoints

// Save network
app.post("/api/networks/save", async (req, res) => {
  try {
    const { name, description, nodes, links, settings, seedMovie } = req.body;

    if (!nodes || !Array.isArray(nodes)) {
      return res.status(400).json({ error: "Nodes array is required" });
    }

    const networkData = {
      name: name || "Untitled Network",
      description: description || "",
      nodes,
      links: links || [],
      settings: settings || {},
      seedMovie: seedMovie || null,
    };

    const result = await networkStorage.saveNetworkToFile(networkData);

    if (result.success) {
      res.json({
        success: true,
        networkId: result.id,
        message: "Network saved successfully",
        metadata: result.metadata,
      });
    } else {
      res.status(500).json({ error: result.error });
    }
  } catch (error) {
    log.error(`Error saving network: ${error.message}`);
    res.status(500).json({ error: "Failed to save network" });
  }
});

// Load network
app.get("/api/networks/:networkId", async (req, res) => {
  try {
    const { networkId } = req.params;
    const result = await networkStorage.loadNetworkFromFile(networkId);

    if (result.success) {
      res.json(result.data);
    } else {
      res.status(404).json({ error: result.error });
    }
  } catch (error) {
    log.error(`Error loading network: ${error.message}`);
    res.status(500).json({ error: "Failed to load network" });
  }
});

// List all networks
app.get("/api/networks", async (req, res) => {
  try {
    const result = await networkStorage.listNetworks();

    if (result.success) {
      res.json(result.networks);
    } else {
      res.status(500).json({ error: result.error });
    }
  } catch (error) {
    log.error(`Error listing networks: ${error.message}`);
    res.status(500).json({ error: "Failed to list networks" });
  }
});

// Update network
app.put("/api/networks/:networkId", async (req, res) => {
  try {
    const { networkId } = req.params;
    const updateData = req.body;

    const result = await networkStorage.updateNetwork(networkId, updateData);

    if (result.success) {
      res.json({
        success: true,
        message: "Network updated successfully",
        metadata: result.metadata,
      });
    } else {
      res.status(500).json({ error: result.error });
    }
  } catch (error) {
    log.error(`Error updating network: ${error.message}`);
    res.status(500).json({ error: "Failed to update network" });
  }
});

// Delete network
app.delete("/api/networks/:networkId", async (req, res) => {
  try {
    const { networkId } = req.params;
    const result = await networkStorage.deleteNetwork(networkId);

    if (result.success) {
      res.json({ success: true, message: "Network deleted successfully" });
    } else {
      res.status(500).json({ error: result.error });
    }
  } catch (error) {
    log.error(`Error deleting network: ${error.message}`);
    res.status(500).json({ error: "Failed to delete network" });
  }
});

// Export network
app.get("/api/networks/:networkId/export/:format", async (req, res) => {
  try {
    const { networkId, format } = req.params;
    const result = await networkStorage.exportNetwork(networkId, format);

    if (result.success) {
      res.setHeader("Content-Type", result.contentType);
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${result.filename}"`,
      );
      res.send(result.data);
    } else {
      res.status(500).json({ error: result.error });
    }
  } catch (error) {
    log.error(`Error exporting network: ${error.message}`);
    res.status(500).json({ error: "Failed to export network" });
  }
});

// Get storage statistics
app.get("/api/networks/stats/storage", async (req, res) => {
  try {
    const result = await networkStorage.getStorageStats();

    if (result.success) {
      res.json(result.stats);
    } else {
      res.status(500).json({ error: result.error });
    }
  } catch (error) {
    log.error(`Error getting storage stats: ${error.message}`);
    res.status(500).json({ error: "Failed to get storage statistics" });
  }
});

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({
    status: "healthy",
    trakt_api_configured: !!TRAKT_API_KEY,
    tmdb_api_configured: !!TMDB_API_KEY,
    gemini_api_configured: !!GEMINI_API_KEY,
    optimization: "enabled",
    runtime: "Node.js",
    storage: "file-based",
    caching: {
      enabled: true,
      api_cache_size: apiCache.size(),
      enhanced_cache_size: enhancedCache.size(),
      ai_cache_size: aiCache.size(),
      total_cached_items:
        apiCache.size() + enhancedCache.size() + aiCache.size(),
    },
  });
});

// Error handlers
app.use((req, res) => {
  res.status(404).json({ error: "Endpoint not found" });
});

app.use((err, req, res, next) => {
  log.error(`Unhandled error: ${err.message}`);
  res.status(500).json({ error: "Internal server error" });
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, "0.0.0.0", () => {
  log.info(`🚀 Movie Network Explorer server running on port ${PORT}`);
  log.info(`🌐 Movie Network Explorer: http://localhost:${PORT}`);
  log.info(`🏥 Health check: http://localhost:${PORT}/api/health`);
  log.info(`🎬 Trakt API: ${TRAKT_API_KEY ? "Configured" : "Missing"}`);
  log.info(`🖼️  TMDB API: ${TMDB_API_KEY ? "Configured" : "Missing"}`);
});
