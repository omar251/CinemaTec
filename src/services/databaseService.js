/**
 * Database Service for PostgreSQL operations
 * Handles all database connections and movie data persistence
 */
const { Pool } = require('pg');
const logger = require('../utils/logger');

class DatabaseService {
    constructor() {
        this.pool = null;
        this.isConnected = false;
        this.initializeConnection();
    }

    initializeConnection() {
        const config = {
            connectionString: process.env.DATABASE_URL || 'postgresql://cinematec_user:cinematec_password@localhost:5432/cinematec_explorer',
            ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
            max: 20,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 2000,
        };

        this.pool = new Pool(config);

        // Test connection
        this.testConnection();

        // Handle pool errors
        this.pool.on('error', (err) => {
            logger.error('Unexpected error on idle client', err);
            this.isConnected = false;
        });
    }

    async testConnection() {
        try {
            const client = await this.pool.connect();
            const result = await client.query('SELECT NOW()');
            client.release();
            this.isConnected = true;
            logger.info('✅ Database connected successfully');
            logger.info(`📊 Database time: ${result.rows[0].now}`);
        } catch (error) {
            this.isConnected = false;
            logger.error('❌ Database connection failed:', error.message);
        }
    }

    async query(text, params) {
        if (!this.isConnected) {
            await this.testConnection();
        }
        
        try {
            const start = Date.now();
            const result = await this.pool.query(text, params);
            const duration = Date.now() - start;
            logger.debug(`Executed query in ${duration}ms: ${text.substring(0, 100)}...`);
            return result;
        } catch (error) {
            logger.error('Database query error:', error.message);
            logger.error('Query:', text);
            logger.error('Params:', params);
            throw error;
        }
    }

    async transaction(callback) {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');
            const result = await callback(client);
            await client.query('COMMIT');
            return result;
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    // Movie operations
    async saveMovie(movieData) {
        const movieKey = `${movieData.title}_${movieData.year}`;
        
        try {
            await this.transaction(async (client) => {
                // Insert or update movie
                const movieQuery = `
                    INSERT INTO movies (
                        movie_key, internal_id, title, year, trakt_id, imdb_id, tmdb_id,
                        depth, x_coord, y_coord, is_new, is_favorite, expanding,
                        tagline, overview, released_date, runtime_minutes, country,
                        trailer_url, homepage_url, status, overall_rating, total_votes,
                        comment_count, updated_at, primary_language, certification,
                        original_title, has_after_credits, has_during_credits,
                        stats_watchers, stats_plays, stats_collectors, stats_comments,
                        stats_lists, stats_favorited, stats_recommended, poster_url,
                        tmdb_backdrop_path, tmdb_popularity, tmdb_poster_path,
                        tmdb_video, tmdb_vote_average, tmdb_vote_count,
                        cached_at, last_accessed, cache_version
                    ) VALUES (
                        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
                        $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24,
                        $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35,
                        $36, $37, $38, $39, $40, $41, $42, $43, $44, $45, $46, $47
                    ) ON CONFLICT (movie_key) DO UPDATE SET
                        internal_id = EXCLUDED.internal_id,
                        depth = EXCLUDED.depth,
                        x_coord = EXCLUDED.x_coord,
                        y_coord = EXCLUDED.y_coord,
                        is_new = EXCLUDED.is_new,
                        is_favorite = EXCLUDED.is_favorite,
                        expanding = EXCLUDED.expanding,
                        updated_at = EXCLUDED.updated_at,
                        last_accessed = NOW()
                `;

                const movieValues = [
                    movieKey,
                    movieData.id,
                    movieData.title,
                    movieData.year,
                    movieData.traktId,
                    movieData.fullDetails?.ids?.imdb,
                    movieData.fullDetails?.ids?.tmdb,
                    movieData.depth || 0,
                    movieData.x,
                    movieData.y,
                    movieData.isNew || false,
                    movieData.isFavorite || false,
                    movieData.expanding || false,
                    movieData.fullDetails?.tagline,
                    movieData.fullDetails?.overview || movieData.basicDetails?.overview,
                    movieData.fullDetails?.released,
                    movieData.fullDetails?.runtime || movieData.basicDetails?.runtime,
                    movieData.fullDetails?.country,
                    movieData.fullDetails?.trailer || movieData.basicDetails?.trailer,
                    movieData.fullDetails?.homepage,
                    movieData.fullDetails?.status,
                    movieData.fullDetails?.rating || movieData.basicDetails?.rating,
                    movieData.fullDetails?.votes || movieData.basicDetails?.votes,
                    movieData.fullDetails?.comment_count,
                    new Date(),
                    movieData.fullDetails?.language,
                    movieData.fullDetails?.certification || movieData.basicDetails?.certification,
                    movieData.fullDetails?.title,
                    movieData.fullDetails?.after_credits,
                    movieData.fullDetails?.during_credits,
                    movieData.fullDetails?.stats?.watchers,
                    movieData.fullDetails?.stats?.plays,
                    movieData.fullDetails?.stats?.collected,
                    movieData.fullDetails?.stats?.comments,
                    movieData.fullDetails?.stats?.lists,
                    movieData.fullDetails?.stats?.favorited,
                    movieData.fullDetails?.stats?.recommended,
                    movieData.fullDetails?.poster_url,
                    movieData.fullDetails?.tmdb_data?.backdrop_path,
                    movieData.fullDetails?.tmdb_data?.popularity,
                    movieData.fullDetails?.tmdb_data?.poster_path,
                    movieData.fullDetails?.tmdb_data?.video,
                    movieData.fullDetails?.tmdb_data?.vote_average,
                    movieData.fullDetails?.tmdb_data?.vote_count,
                    new Date(),
                    new Date(),
                    '1.0'
                ];

                await client.query(movieQuery, movieValues);

                // Handle genres
                if (movieData.fullDetails?.genres || movieData.basicDetails?.genres) {
                    const genres = movieData.fullDetails?.genres || movieData.basicDetails?.genres || [];
                    
                    // Delete existing genres for this movie
                    await client.query('DELETE FROM movie_genres WHERE movie_key = $1', [movieKey]);
                    
                    // Insert new genres
                    for (const genre of genres) {
                        // Ensure genre exists
                        await client.query(
                            'INSERT INTO genres (genre_name) VALUES ($1) ON CONFLICT (genre_name) DO NOTHING',
                            [genre]
                        );
                        
                        // Link movie to genre
                        await client.query(
                            'INSERT INTO movie_genres (movie_key, genre_name) VALUES ($1, $2)',
                            [movieKey, genre]
                        );
                    }
                }

                // Handle languages
                if (movieData.fullDetails?.languages) {
                    // Delete existing languages for this movie
                    await client.query('DELETE FROM movie_languages WHERE movie_key = $1', [movieKey]);
                    
                    // Insert new languages
                    for (const lang of movieData.fullDetails.languages) {
                        // Ensure language exists
                        await client.query(
                            'INSERT INTO languages (language_code) VALUES ($1) ON CONFLICT (language_code) DO NOTHING',
                            [lang]
                        );
                        
                        // Link movie to language
                        await client.query(
                            'INSERT INTO movie_languages (movie_key, language_code) VALUES ($1, $2)',
                            [movieKey, lang]
                        );
                    }
                }
            });

            logger.info(`💾 Saved movie to database: ${movieData.title} (${movieData.year})`);
            return movieKey;
        } catch (error) {
            logger.error(`Failed to save movie ${movieData.title}:`, error.message);
            throw error;
        }
    }

    async getMovie(movieKey) {
        try {
            const query = `
                SELECT m.*, 
                       array_agg(DISTINCT mg.genre_name) FILTER (WHERE mg.genre_name IS NOT NULL) as genres,
                       array_agg(DISTINCT ml.language_code) FILTER (WHERE ml.language_code IS NOT NULL) as languages
                FROM movies m
                LEFT JOIN movie_genres mg ON m.movie_key = mg.movie_key
                LEFT JOIN movie_languages ml ON m.movie_key = ml.movie_key
                WHERE m.movie_key = $1
                GROUP BY m.movie_key
            `;
            
            const result = await this.query(query, [movieKey]);
            
            if (result.rows.length === 0) {
                return null;
            }

            return this.formatMovieFromDb(result.rows[0]);
        } catch (error) {
            logger.error(`Failed to get movie ${movieKey}:`, error.message);
            throw error;
        }
    }

    async getAllMovies() {
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
            `;
            
            const result = await this.query(query);
            return result.rows.map(row => this.formatMovieFromDb(row));
        } catch (error) {
            logger.error('Failed to get all movies:', error.message);
            throw error;
        }
    }

    async getFavoriteMovies() {
        try {
            const query = `
                SELECT m.*, 
                       array_agg(DISTINCT mg.genre_name) FILTER (WHERE mg.genre_name IS NOT NULL) as genres,
                       array_agg(DISTINCT ml.language_code) FILTER (WHERE ml.language_code IS NOT NULL) as languages
                FROM movies m
                LEFT JOIN movie_genres mg ON m.movie_key = mg.movie_key
                LEFT JOIN movie_languages ml ON m.movie_key = ml.movie_key
                WHERE m.is_favorite = true
                GROUP BY m.movie_key
                ORDER BY m.updated_at DESC
            `;
            
            const result = await this.query(query);
            return result.rows.map(row => this.formatMovieFromDb(row));
        } catch (error) {
            logger.error('Failed to get favorite movies:', error.message);
            throw error;
        }
    }

    async updateMovieFavoriteStatus(movieKey, isFavorite) {
        try {
            const query = 'UPDATE movies SET is_favorite = $1, updated_at = NOW() WHERE movie_key = $2';
            await this.query(query, [isFavorite, movieKey]);
            logger.info(`Updated favorite status for ${movieKey}: ${isFavorite}`);
        } catch (error) {
            logger.error(`Failed to update favorite status for ${movieKey}:`, error.message);
            throw error;
        }
    }

    async saveMovieConnection(sourceMovieKey, targetMovieKey, connectionType = 'related') {
        try {
            const query = `
                INSERT INTO movie_connections (source_movie_key, target_movie_key, connection_type)
                VALUES ($1, $2, $3)
                ON CONFLICT (source_movie_key, target_movie_key) DO NOTHING
            `;
            await this.query(query, [sourceMovieKey, targetMovieKey, connectionType]);
        } catch (error) {
            logger.error(`Failed to save connection ${sourceMovieKey} -> ${targetMovieKey}:`, error.message);
            throw error;
        }
    }

    async getMovieConnections(movieKey) {
        try {
            const query = `
                SELECT target_movie_key as connected_movie_key, connection_type
                FROM movie_connections 
                WHERE source_movie_key = $1
                UNION
                SELECT source_movie_key as connected_movie_key, connection_type
                FROM movie_connections 
                WHERE target_movie_key = $1
            `;
            const result = await this.query(query, [movieKey]);
            return result.rows;
        } catch (error) {
            logger.error(`Failed to get connections for ${movieKey}:`, error.message);
            throw error;
        }
    }

    formatMovieFromDb(row) {
        return {
            id: row.internal_id,
            title: row.title,
            year: row.year,
            traktId: row.trakt_id,
            movieKey: row.movie_key,
            depth: row.depth,
            x: parseFloat(row.x_coord) || 0,
            y: parseFloat(row.y_coord) || 0,
            isNew: row.is_new,
            isFavorite: row.is_favorite,
            expanding: row.expanding,
            basicDetails: {
                overview: row.overview,
                rating: parseFloat(row.overall_rating),
                votes: row.total_votes,
                genres: row.genres || [],
                runtime: row.runtime_minutes,
                certification: row.certification,
                trailer: row.trailer_url
            },
            fullDetails: row.cached_at ? {
                ids: {
                    trakt: row.trakt_id,
                    imdb: row.imdb_id,
                    tmdb: row.tmdb_id
                },
                title: row.original_title || row.title,
                year: row.year,
                tagline: row.tagline,
                overview: row.overview,
                released: row.released_date,
                runtime: row.runtime_minutes,
                country: row.country,
                trailer: row.trailer_url,
                homepage: row.homepage_url,
                status: row.status,
                rating: parseFloat(row.overall_rating),
                votes: row.total_votes,
                comment_count: row.comment_count,
                language: row.primary_language,
                languages: row.languages || [],
                genres: row.genres || [],
                certification: row.certification,
                stats: {
                    watchers: row.stats_watchers,
                    plays: row.stats_plays,
                    collected: row.stats_collectors,
                    comments: row.stats_comments,
                    lists: row.stats_lists,
                    favorited: row.stats_favorited,
                    recommended: row.stats_recommended
                },
                poster_url: row.poster_url,
                tmdb_data: {
                    backdrop_path: row.tmdb_backdrop_path,
                    popularity: parseFloat(row.tmdb_popularity),
                    poster_path: row.tmdb_poster_path,
                    video: row.tmdb_video,
                    vote_average: parseFloat(row.tmdb_vote_average),
                    vote_count: row.tmdb_vote_count
                }
            } : null
        };
    }

    async updateAppMetadata(metadata) {
        try {
            const query = `
                UPDATE app_metadata SET 
                    total_movies = $1,
                    total_connections = $2,
                    max_depth = $3,
                    average_rating = $4,
                    updated_at = NOW()
                WHERE id = 'default'
            `;
            await this.query(query, [
                metadata.totalMovies,
                metadata.totalConnections,
                metadata.maxDepth,
                metadata.averageRating
            ]);
        } catch (error) {
            logger.error('Failed to update app metadata:', error.message);
            throw error;
        }
    }

    async getAppMetadata() {
        try {
            const result = await this.query('SELECT * FROM app_metadata WHERE id = $1', ['default']);
            return result.rows[0] || null;
        } catch (error) {
            logger.error('Failed to get app metadata:', error.message);
            throw error;
        }
    }

    async close() {
        if (this.pool) {
            await this.pool.end();
            logger.info('Database connection closed');
        }
    }
}

module.exports = new DatabaseService();