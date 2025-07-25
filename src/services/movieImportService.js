/**
 * Movie Import Service
 * Handles importing movie data from movies.json into the database
 */
const fs = require('fs').promises;
const path = require('path');
const databaseService = require('./databaseService');
const logger = require('../utils/logger');

class MovieImportService {
    constructor() {
        this.moviesJsonPath = path.join(process.cwd(), 'saved_networks', 'movie_cache', 'movies.json');
    }

    /**
     * Import all movies from movies.json into the database
     */
    async importMoviesFromJson() {
        try {
            logger.info('🚀 Starting movie import from movies.json...');
            
            // Read the movies.json file
            const moviesData = await this.readMoviesJson();
            
            if (!moviesData || !Array.isArray(moviesData)) {
                throw new Error('Invalid movies.json format - expected an array of movies');
            }

            logger.info(`📊 Found ${moviesData.length} movies to import`);

            let successCount = 0;
            let errorCount = 0;
            const errors = [];

            // Process movies in batches to avoid overwhelming the database
            const batchSize = 10;
            for (let i = 0; i < moviesData.length; i += batchSize) {
                const batch = moviesData.slice(i, i + batchSize);
                
                logger.info(`📦 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(moviesData.length / batchSize)} (${batch.length} movies)`);
                
                for (const movieJson of batch) {
                    try {
                        const transformedMovie = this.transformMovieData(movieJson);
                        await databaseService.saveMovie(transformedMovie);
                        successCount++;
                        logger.debug(`✅ Imported: ${movieJson.title} (${movieJson.year})`);
                    } catch (error) {
                        errorCount++;
                        const errorMsg = `Failed to import ${movieJson.title} (${movieJson.year}): ${error.message}`;
                        errors.push(errorMsg);
                        logger.error(errorMsg);
                    }
                }
                
                // Small delay between batches to be gentle on the database
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            // Update app metadata
            await this.updateAppMetadata(moviesData);

            logger.info(`🎉 Import completed!`);
            logger.info(`✅ Successfully imported: ${successCount} movies`);
            logger.info(`❌ Failed to import: ${errorCount} movies`);
            
            if (errors.length > 0) {
                logger.warn('Import errors:', errors);
            }

            return {
                success: true,
                totalMovies: moviesData.length,
                successCount,
                errorCount,
                errors
            };

        } catch (error) {
            logger.error('❌ Movie import failed:', error.message);
            throw error;
        }
    }

    /**
     * Read and parse the movies.json file
     */
    async readMoviesJson() {
        try {
            const fileContent = await fs.readFile(this.moviesJsonPath, 'utf8');
            return JSON.parse(fileContent);
        } catch (error) {
            if (error.code === 'ENOENT') {
                throw new Error(`Movies.json file not found at: ${this.moviesJsonPath}`);
            }
            throw new Error(`Failed to read movies.json: ${error.message}`);
        }
    }

    /**
     * Transform movie data from JSON format to database format
     */
    transformMovieData(movieJson) {
        // Generate a unique movie key
        const movieKey = `${movieJson.title.replace(/[^a-zA-Z0-9]/g, '_')}_${movieJson.year}`;
        
        return {
            id: movieJson.ids?.trakt || null,
            title: movieJson.title,
            year: movieJson.year,
            traktId: movieJson.ids?.trakt,
            movieKey: movieKey,
            depth: 0, // Default depth since this is imported data
            x: Math.random() * 800, // Random position for visualization
            y: Math.random() * 600,
            isNew: false,
            isFavorite: false,
            expanding: false,
            basicDetails: {
                overview: movieJson.overview,
                rating: movieJson.rating || movieJson.ratings?.rating,
                votes: movieJson.votes || movieJson.ratings?.votes,
                genres: movieJson.genres || [],
                runtime: movieJson.runtime,
                certification: movieJson.certification,
                trailer: movieJson.trailer
            },
            fullDetails: {
                ids: {
                    trakt: movieJson.ids?.trakt,
                    imdb: movieJson.ids?.imdb,
                    tmdb: movieJson.ids?.tmdb,
                    slug: movieJson.ids?.slug
                },
                title: movieJson.original_title || movieJson.title,
                year: movieJson.year,
                tagline: movieJson.tagline,
                overview: movieJson.overview,
                released: movieJson.released,
                runtime: movieJson.runtime,
                country: movieJson.country,
                trailer: movieJson.trailer,
                homepage: movieJson.homepage,
                status: movieJson.status,
                rating: movieJson.rating || movieJson.ratings?.rating,
                votes: movieJson.votes || movieJson.ratings?.votes,
                comment_count: movieJson.comment_count,
                updated_at: movieJson.updated_at,
                language: movieJson.language,
                languages: movieJson.languages || [],
                available_translations: movieJson.available_translations || [],
                genres: movieJson.genres || [],
                subgenres: movieJson.subgenres || [],
                certification: movieJson.certification,
                original_title: movieJson.original_title,
                after_credits: movieJson.after_credits,
                during_credits: movieJson.during_credits,
                stats: {
                    watchers: movieJson.stats?.watchers,
                    plays: movieJson.stats?.plays,
                    collected: movieJson.stats?.collectors,
                    comments: movieJson.stats?.comments,
                    lists: movieJson.stats?.lists,
                    favorited: movieJson.stats?.favorited,
                    recommended: movieJson.stats?.recommended
                },
                ratings: movieJson.ratings,
                poster_url: movieJson.poster_url,
                tmdb_data: {
                    adult: movieJson.tmdb_data?.adult,
                    backdrop_path: movieJson.tmdb_data?.backdrop_path,
                    genre_ids: movieJson.tmdb_data?.genre_ids,
                    id: movieJson.tmdb_data?.id,
                    original_language: movieJson.tmdb_data?.original_language,
                    original_title: movieJson.tmdb_data?.original_title,
                    overview: movieJson.tmdb_data?.overview,
                    popularity: movieJson.tmdb_data?.popularity,
                    poster_path: movieJson.tmdb_data?.poster_path,
                    release_date: movieJson.tmdb_data?.release_date,
                    title: movieJson.tmdb_data?.title,
                    video: movieJson.tmdb_data?.video,
                    vote_average: movieJson.tmdb_data?.vote_average,
                    vote_count: movieJson.tmdb_data?.vote_count,
                    poster_url: movieJson.tmdb_data?.poster_url
                },
                cachedAt: movieJson.cachedAt,
                lastAccessed: movieJson.lastAccessed,
                cacheVersion: movieJson.cacheVersion
            }
        };
    }

    /**
     * Update application metadata after import
     */
    async updateAppMetadata(moviesData) {
        try {
            const totalMovies = moviesData.length;
            const totalConnections = 0; // No connections in JSON data
            const maxDepth = 0; // No depth in JSON data
            const averageRating = moviesData.reduce((sum, movie) => {
                const rating = movie.rating || movie.ratings?.rating || 0;
                return sum + rating;
            }, 0) / totalMovies;

            await databaseService.updateAppMetadata({
                totalMovies,
                totalConnections,
                maxDepth,
                averageRating: Math.round(averageRating * 10) / 10
            });

            logger.info(`📊 Updated app metadata: ${totalMovies} movies, avg rating: ${averageRating.toFixed(1)}`);
        } catch (error) {
            logger.error('Failed to update app metadata:', error.message);
        }
    }

    /**
     * Import a single movie by title and year
     */
    async importSingleMovie(title, year) {
        try {
            const moviesData = await this.readMoviesJson();
            const movie = moviesData.find(m => 
                m.title.toLowerCase() === title.toLowerCase() && m.year === year
            );

            if (!movie) {
                throw new Error(`Movie not found: ${title} (${year})`);
            }

            const transformedMovie = this.transformMovieData(movie);
            await databaseService.saveMovie(transformedMovie);
            
            logger.info(`✅ Successfully imported single movie: ${title} (${year})`);
            return { success: true, movie: transformedMovie };
        } catch (error) {
            logger.error(`❌ Failed to import single movie ${title} (${year}):`, error.message);
            throw error;
        }
    }

    /**
     * Get import statistics
     */
    async getImportStats() {
        try {
            const moviesData = await this.readMoviesJson();
            const dbMovies = await databaseService.getAllMovies();
            
            return {
                jsonMovieCount: moviesData.length,
                dbMovieCount: dbMovies.length,
                moviesJsonPath: this.moviesJsonPath,
                lastModified: (await fs.stat(this.moviesJsonPath)).mtime
            };
        } catch (error) {
            logger.error('Failed to get import stats:', error.message);
            throw error;
        }
    }
}

module.exports = new MovieImportService();