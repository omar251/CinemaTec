/**
 * Movie Data Service
 * Handles persistent JSON-based caching of movie data for performance optimization
 */
const fs = require('fs').promises;
const path = require('path');
const config = require('../config');
const logger = require('../utils/logger');

class MovieDataService {
  constructor() {
    this.cacheDir = path.join(config.storage.dataDir, 'movie_cache');
    this.movieDataFile = path.join(this.cacheDir, 'movies.json');
    this.movieData = new Map();
    this.isDirty = false;
    this.saveInterval = null;
    
    this.initializeStorage();
    logger.info('Movie Data Service initialized');
  }

  async initializeStorage() {
    try {
      // Create cache directory if it doesn't exist
      await fs.mkdir(this.cacheDir, { recursive: true });
      
      // Load existing movie data
      await this.loadMovieData();
      
      // Start auto-save interval (save every 5 minutes if dirty)
      this.startAutoSave();
      
      logger.info(`Movie data cache initialized with ${this.movieData.size} movies`);
    } catch (error) {
      logger.error(`Failed to initialize movie data storage: ${error.message}`);
    }
  }

  async loadMovieData() {
    try {
      const data = await fs.readFile(this.movieDataFile, 'utf8');
      const movieArray = JSON.parse(data);
      
      // Convert array back to Map for efficient lookups
      this.movieData.clear();
      movieArray.forEach(movie => {
        const key = this.generateMovieKey(movie.ids.trakt, movie.title, movie.year);
        this.movieData.set(key, {
          ...movie,
          cachedAt: new Date(movie.cachedAt),
          lastAccessed: new Date()
        });
      });
      
      logger.info(`Loaded ${this.movieData.size} movies from cache`);
    } catch (error) {
      if (error.code === 'ENOENT') {
        logger.info('No existing movie cache found, starting fresh');
      } else {
        logger.error(`Failed to load movie data: ${error.message}`);
      }
    }
  }

  async saveMovieData() {
    if (!this.isDirty) return;
    
    try {
      // Convert Map to array for JSON serialization
      const movieArray = Array.from(this.movieData.values()).map(movie => ({
        ...movie,
        cachedAt: movie.cachedAt.toISOString(),
        lastAccessed: movie.lastAccessed.toISOString()
      }));
      
      const jsonData = JSON.stringify(movieArray, null, 2);
      await fs.writeFile(this.movieDataFile, jsonData, 'utf8');
      
      this.isDirty = false;
      logger.debug(`Saved ${movieArray.length} movies to cache`);
    } catch (error) {
      logger.error(`Failed to save movie data: ${error.message}`);
    }
  }

  startAutoSave() {
    // Save every 5 minutes if there are changes
    this.saveInterval = setInterval(async () => {
      if (this.isDirty) {
        await this.saveMovieData();
      }
    }, 5 * 60 * 1000);
  }

  generateMovieKey(traktId, title, year) {
    return `${traktId}_${title}_${year}`.toLowerCase().replace(/[^a-z0-9_]/g, '_');
  }

  // Store movie data
  storeMovie(movieData) {
    if (!movieData || !movieData.ids || !movieData.ids.trakt) {
      logger.warn('Invalid movie data provided to storeMovie');
      return false;
    }

    const key = this.generateMovieKey(movieData.ids.trakt, movieData.title, movieData.year);
    const now = new Date();
    
    const cacheEntry = {
      ...movieData,
      cachedAt: now,
      lastAccessed: now,
      cacheVersion: '1.0'
    };

    this.movieData.set(key, cacheEntry);
    this.isDirty = true;
    
    logger.debug(`Stored movie: ${movieData.title} (${movieData.year})`);
    return true;
  }

  // Retrieve movie data
  getMovie(traktId, title = null, year = null) {
    // Try to find by traktId first
    let movie = null;
    
    if (title && year) {
      const key = this.generateMovieKey(traktId, title, year);
      movie = this.movieData.get(key);
    }
    
    // Fallback: search by traktId only
    if (!movie) {
      for (const [key, movieData] of this.movieData.entries()) {
        if (movieData.ids.trakt === traktId) {
          movie = movieData;
          break;
        }
      }
    }

    if (movie) {
      // Update last accessed time
      movie.lastAccessed = new Date();
      this.isDirty = true;
      
      logger.debug(`Retrieved movie from cache: ${movie.title} (${movie.year})`);
      return { ...movie }; // Return a copy to prevent external modifications
    }

    return null;
  }

  // Check if movie exists in cache
  hasMovie(traktId, title = null, year = null) {
    return this.getMovie(traktId, title, year) !== null;
  }

  // Store multiple movies (bulk operation)
  storeMovies(movieArray) {
    if (!Array.isArray(movieArray)) {
      logger.warn('storeMovies expects an array');
      return 0;
    }

    let stored = 0;
    movieArray.forEach(movie => {
      if (this.storeMovie(movie)) {
        stored++;
      }
    });

    logger.info(`Bulk stored ${stored} movies`);
    return stored;
  }

  // Get multiple movies by traktIds
  getMovies(traktIds) {
    if (!Array.isArray(traktIds)) {
      return [];
    }

    const movies = [];
    traktIds.forEach(traktId => {
      const movie = this.getMovie(traktId);
      if (movie) {
        movies.push(movie);
      }
    });

    return movies;
  }

  // Search movies by title (fuzzy search)
  searchMovies(query, limit = 10) {
    const results = [];
    const searchTerm = query.toLowerCase();

    for (const movie of this.movieData.values()) {
      if (movie.title.toLowerCase().includes(searchTerm)) {
        results.push({ ...movie });
        if (results.length >= limit) break;
      }
    }

    return results.sort((a, b) => {
      // Sort by relevance (exact matches first, then by rating)
      const aExact = a.title.toLowerCase() === searchTerm;
      const bExact = b.title.toLowerCase() === searchTerm;
      
      if (aExact && !bExact) return -1;
      if (!aExact && bExact) return 1;
      
      return (b.rating || 0) - (a.rating || 0);
    });
  }

  // Get cache statistics
  getStats() {
    const now = new Date();
    const oneHour = 60 * 60 * 1000;
    const oneDay = 24 * oneHour;
    const oneWeek = 7 * oneDay;

    let recentlyAccessed = 0;
    let oldEntries = 0;
    let totalSize = 0;

    for (const movie of this.movieData.values()) {
      const timeSinceAccess = now - movie.lastAccessed;
      
      if (timeSinceAccess < oneHour) {
        recentlyAccessed++;
      } else if (timeSinceAccess > oneWeek) {
        oldEntries++;
      }
      
      totalSize += JSON.stringify(movie).length;
    }

    return {
      totalMovies: this.movieData.size,
      recentlyAccessed,
      oldEntries,
      estimatedSizeKB: Math.round(totalSize / 1024),
      cacheFile: this.movieDataFile,
      isDirty: this.isDirty
    };
  }

  // Clean up old entries
  async cleanup(maxAge = 30 * 24 * 60 * 60 * 1000) { // 30 days default
    const now = new Date();
    let cleaned = 0;

    for (const [key, movie] of this.movieData.entries()) {
      const age = now - movie.lastAccessed;
      if (age > maxAge) {
        this.movieData.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.isDirty = true;
      await this.saveMovieData();
      logger.info(`Cleaned up ${cleaned} old movie cache entries`);
    }

    return cleaned;
  }

  // Force save
  async forceSave() {
    this.isDirty = true;
    await this.saveMovieData();
  }

  // Clear all cache
  async clearCache() {
    this.movieData.clear();
    this.isDirty = true;
    await this.saveMovieData();
    logger.info('Movie cache cleared');
  }

  // Graceful shutdown
  async shutdown() {
    if (this.saveInterval) {
      clearInterval(this.saveInterval);
    }
    
    if (this.isDirty) {
      await this.saveMovieData();
    }
    
    logger.info('Movie Data Service shutdown complete');
  }
}

module.exports = new MovieDataService();