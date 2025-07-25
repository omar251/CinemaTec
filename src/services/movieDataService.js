/**
 * Database-First Movie Data Service
 * Uses PostgreSQL database as the primary local caching system instead of JSON files
 */
const databaseService = require('./databaseService');
const logger = require('../utils/logger');

class MovieDataService {
    constructor() {
        this.memoryCache = new Map(); // Small in-memory cache for frequently accessed movies
        this.maxMemoryCacheSize = 100; // Limit memory cache size
        this.cacheHitStats = {
            memory: 0,
            database: 0,
            miss: 0
        };
        
        logger.info('🎬 Database-first Movie Data Service initialized');
    }

    /**
     * Store a movie in the database (primary cache)
     */
    async storeMovie(movieData) {
        try {
            // Transform the movie data to match database format if needed
            const transformedMovie = this.transformMovieForDatabase(movieData);
            
            // Save to database
            const movieKey = await databaseService.saveMovie(transformedMovie);
            
            // Also cache in memory for quick access
            this.addToMemoryCache(movieKey, transformedMovie);
            
            logger.debug(`📦 Stored movie in database: ${movieData.title} (${movieData.year})`);
            return movieKey;
        } catch (error) {
            logger.error(`Failed to store movie ${movieData.title}:`, error.message);
            throw error;
        }
    }

    /**
     * Get a movie by various identifiers (database-first approach)
     */
    async getMovie(traktId, title, year) {
        try {
            // Try memory cache first for speed
            const memoryKey = this.generateMemoryKey(traktId, title, year);
            if (this.memoryCache.has(memoryKey)) {
                this.cacheHitStats.memory++;
                logger.debug(`🚀 Memory cache hit: ${title || traktId}`);
                return this.memoryCache.get(memoryKey);
            }

            // Try database cache
            let movie = null;
            
            if (traktId) {
                movie = await this.getMovieByTraktId(traktId);
            } else if (title && year) {
                movie = await this.getMovieByTitleYear(title, year);
            }

            if (movie) {
                this.cacheHitStats.database++;
                this.addToMemoryCache(memoryKey, movie);
                logger.debug(`💾 Database cache hit: ${title || traktId}`);
                return movie;
            }

            this.cacheHitStats.miss++;
            logger.debug(`❌ Cache miss: ${title || traktId}`);
            return null;
        } catch (error) {
            logger.error(`Error getting movie ${title || traktId}:`, error.message);
            return null;
        }
    }

    /**
     * Get movie by Trakt ID
     */
    async getMovieByTraktId(traktId) {
        try {
            const query = `
                SELECT m.*, 
                       array_agg(DISTINCT mg.genre_name) FILTER (WHERE mg.genre_name IS NOT NULL) as genres,
                       array_agg(DISTINCT ml.language_code) FILTER (WHERE ml.language_code IS NOT NULL) as languages
                FROM movies m
                LEFT JOIN movie_genres mg ON m.movie_key = mg.movie_key
                LEFT JOIN movie_languages ml ON m.movie_key = ml.movie_key
                WHERE m.trakt_id = $1
                GROUP BY m.movie_key
                LIMIT 1
            `;
            
            const result = await databaseService.query(query, [traktId]);
            
            if (result.rows.length === 0) {
                return null;
            }

            return this.formatMovieFromDb(result.rows[0]);
        } catch (error) {
            logger.error(`Failed to get movie by Trakt ID ${traktId}:`, error.message);
            return null;
        }
    }

    /**
     * Get movie by title and year
     */
    async getMovieByTitleYear(title, year) {
        try {
            const query = `
                SELECT m.*, 
                       array_agg(DISTINCT mg.genre_name) FILTER (WHERE mg.genre_name IS NOT NULL) as genres,
                       array_agg(DISTINCT ml.language_code) FILTER (WHERE ml.language_code IS NOT NULL) as languages
                FROM movies m
                LEFT JOIN movie_genres mg ON m.movie_key = mg.movie_key
                LEFT JOIN movie_languages ml ON m.movie_key = ml.movie_key
                WHERE LOWER(m.title) = LOWER($1) AND m.year = $2
                GROUP BY m.movie_key
                LIMIT 1
            `;
            
            const result = await databaseService.query(query, [title, year]);
            
            if (result.rows.length === 0) {
                return null;
            }

            return this.formatMovieFromDb(result.rows[0]);
        } catch (error) {
            logger.error(`Failed to get movie by title/year ${title} (${year}):`, error.message);
            return null;
        }
    }

    /**
     * Get multiple movies by Trakt IDs
     */
    async getMovies(traktIds) {
        try {
            if (!Array.isArray(traktIds) || traktIds.length === 0) {
                return [];
            }

            const placeholders = traktIds.map((_, index) => `$${index + 1}`).join(',');
            const query = `
                SELECT m.*, 
                       array_agg(DISTINCT mg.genre_name) FILTER (WHERE mg.genre_name IS NOT NULL) as genres,
                       array_agg(DISTINCT ml.language_code) FILTER (WHERE ml.language_code IS NOT NULL) as languages
                FROM movies m
                LEFT JOIN movie_genres mg ON m.movie_key = mg.movie_key
                LEFT JOIN movie_languages ml ON m.movie_key = ml.movie_key
                WHERE m.trakt_id IN (${placeholders})
                GROUP BY m.movie_key
                ORDER BY m.last_accessed DESC
            `;
            
            const result = await databaseService.query(query, traktIds);
            return result.rows.map(row => this.formatMovieFromDb(row));
        } catch (error) {
            logger.error(`Failed to get movies by IDs:`, error.message);
            return [];
        }
    }

    /**
     * Search movies in database
     */
    async searchMovies(query, limit = 10) {
        try {
            const searchQuery = `
                SELECT m.*, 
                       array_agg(DISTINCT mg.genre_name) FILTER (WHERE mg.genre_name IS NOT NULL) as genres,
                       array_agg(DISTINCT ml.language_code) FILTER (WHERE ml.language_code IS NOT NULL) as languages,
                       ts_rank(to_tsvector('english', m.title || ' ' || COALESCE(m.overview, '')), plainto_tsquery('english', $1)) as rank
                FROM movies m
                LEFT JOIN movie_genres mg ON m.movie_key = mg.movie_key
                LEFT JOIN movie_languages ml ON m.movie_key = ml.movie_key
                WHERE to_tsvector('english', m.title || ' ' || COALESCE(m.overview, '')) @@ plainto_tsquery('english', $1)
                   OR LOWER(m.title) LIKE LOWER($2)
                   OR LOWER(m.original_title) LIKE LOWER($2)
                GROUP BY m.movie_key
                ORDER BY rank DESC, m.overall_rating DESC NULLS LAST
                LIMIT $3
            `;
            
            const likePattern = `%${query}%`;
            const result = await databaseService.query(searchQuery, [query, likePattern, limit]);
            
            return result.rows.map(row => this.formatMovieFromDb(row));
        } catch (error) {
            logger.error(`Failed to search movies for "${query}":`, error.message);
            return [];
        }
    }

    /**
     * Get all movies from database
     */
    async getAllMovies(limit = 1000, offset = 0) {
        try {
            const query = `
                SELECT m.*, 
                       array_agg(DISTINCT mg.genre_name) FILTER (WHERE mg.genre_name IS NOT NULL) as genres,
                       array_agg(DISTINCT ml.language_code) FILTER (WHERE ml.language_code IS NOT NULL) as languages
                FROM movies m
                LEFT JOIN movie_genres mg ON m.movie_key = mg.movie_key
                LEFT JOIN movie_languages ml ON m.movie_key = ml.movie_key
                GROUP BY m.movie_key
                ORDER BY m.last_accessed DESC
                LIMIT $1 OFFSET $2
            `;
            
            const result = await databaseService.query(query, [limit, offset]);
            return result.rows.map(row => this.formatMovieFromDb(row));
        } catch (error) {
            logger.error('Failed to get all movies:', error.message);
            return [];
        }
    }

    /**
     * Get cache statistics
     */
    async getStats() {
        try {
            const dbStats = await databaseService.query(`
                SELECT 
                    COUNT(*) as total_movies,
                    COUNT(*) FILTER (WHERE cached_at IS NOT NULL) as cached_movies,
                    AVG(overall_rating) as average_rating,
                    MAX(last_accessed) as last_access,
                    COUNT(DISTINCT primary_language) as languages_count,
                    COUNT(DISTINCT movie_key) FILTER (WHERE is_favorite = true) as favorites_count
                FROM movies
            `);

            const genreStats = await databaseService.query(`
                SELECT COUNT(DISTINCT genre_name) as total_genres
                FROM genres
            `);

            const memoryStats = {
                size: this.memoryCache.size,
                maxSize: this.maxMemoryCacheSize,
                hitRate: this.calculateHitRate()
            };

            return {
                database: {
                    totalMovies: parseInt(dbStats.rows[0].total_movies) || 0,
                    cachedMovies: parseInt(dbStats.rows[0].cached_movies) || 0,
                    averageRating: parseFloat(dbStats.rows[0].average_rating) || 0,
                    lastAccess: dbStats.rows[0].last_access,
                    languagesCount: parseInt(dbStats.rows[0].languages_count) || 0,
                    favoritesCount: parseInt(dbStats.rows[0].favorites_count) || 0,
                    totalGenres: parseInt(genreStats.rows[0].total_genres) || 0
                },
                memory: memoryStats,
                cacheHits: this.cacheHitStats,
                type: 'database-first'
            };
        } catch (error) {
            logger.error('Failed to get cache stats:', error.message);
            return {
                database: { totalMovies: 0, error: error.message },
                memory: { size: this.memoryCache.size },
                cacheHits: this.cacheHitStats,
                type: 'database-first'
            };
        }
    }

    /**
     * Clear memory cache
     */
    clearMemoryCache() {
        this.memoryCache.clear();
        this.cacheHitStats = { memory: 0, database: 0, miss: 0 };
        logger.info('🧹 Memory cache cleared');
    }

    /**
     * Cleanup old entries (database-based)
     */
    async cleanup(maxAgeHours = 24 * 30) { // 30 days default
        try {
            const cutoffDate = new Date(Date.now() - (maxAgeHours * 60 * 60 * 1000));
            
            const result = await databaseService.query(`
                DELETE FROM movies 
                WHERE last_accessed < $1 
                AND is_favorite = false
                RETURNING movie_key
            `, [cutoffDate]);

            const cleaned = result.rows.length;
            logger.info(`🧹 Cleaned up ${cleaned} old movie entries from database`);
            
            // Also clear memory cache
            this.clearMemoryCache();
            
            return cleaned;
        } catch (error) {
            logger.error('Failed to cleanup old entries:', error.message);
            return 0;
        }
    }

    /**
     * Force save operation (no-op for database-first approach)
     */
    async forceSave() {
        // In database-first approach, data is already persisted
        logger.info('💾 Force save requested - data already persisted in database');
        return true;
    }

    /**
     * Clear all cache (WARNING: This removes all movie data from database)
     */
    async clearCache() {
        try {
            await databaseService.query('DELETE FROM movies');
            this.clearMemoryCache();
            logger.warn('🗑️ All movie data cleared from database');
            return true;
        } catch (error) {
            logger.error('Failed to clear cache:', error.message);
            throw error;
        }
    }

    /**
     * Update movie access time
     */
    async updateLastAccessed(movieKey) {
        try {
            await databaseService.query(
                'UPDATE movies SET last_accessed = NOW() WHERE movie_key = $1',
                [movieKey]
            );
        } catch (error) {
            logger.debug(`Failed to update last accessed for ${movieKey}:`, error.message);
        }
    }

    // Private helper methods

    generateMemoryKey(traktId, title, year) {
        if (traktId) return `trakt_${traktId}`;
        if (title && year) return `title_${title.toLowerCase()}_${year}`;
        return `unknown_${Date.now()}`;
    }

    addToMemoryCache(key, movie) {
        // Implement LRU-like behavior
        if (this.memoryCache.size >= this.maxMemoryCacheSize) {
            const firstKey = this.memoryCache.keys().next().value;
            this.memoryCache.delete(firstKey);
        }
        this.memoryCache.set(key, movie);
    }

    calculateHitRate() {
        const total = this.cacheHitStats.memory + this.cacheHitStats.database + this.cacheHitStats.miss;
        if (total === 0) return 0;
        return ((this.cacheHitStats.memory + this.cacheHitStats.database) / total * 100).toFixed(2);
    }

    transformMovieForDatabase(movieData) {
        // If the movie data is already in the correct format, return as-is
        if (movieData.movieKey || movieData.fullDetails) {
            return movieData;
        }

        // Transform from API format to database format
        const movieKey = `${movieData.title.replace(/[^a-zA-Z0-9]/g, '_')}_${movieData.year}`;
        
        return {
            id: movieData.ids?.trakt || null,
            title: movieData.title,
            year: movieData.year,
            traktId: movieData.ids?.trakt,
            movieKey: movieKey,
            depth: 0,
            x: Math.random() * 800,
            y: Math.random() * 600,
            isNew: false,
            isFavorite: false,
            expanding: false,
            basicDetails: {
                overview: movieData.overview,
                rating: movieData.rating,
                votes: movieData.votes,
                genres: movieData.genres || [],
                runtime: movieData.runtime,
                certification: movieData.certification,
                trailer: movieData.trailer
            },
            fullDetails: movieData
        };
    }

    formatMovieFromDb(row) {
        return databaseService.formatMovieFromDb(row);
    }

    /**
     * Shutdown method for graceful cleanup
     */
    async shutdown() {
        this.clearMemoryCache();
        logger.info('🔄 Movie Data Service shutdown complete');
    }
}

module.exports = new MovieDataService();