/**
 * Database-first search functionality for the frontend
 */

import { searchCachedMovies, getCachedMovie } from './api.js';

export class DatabaseSearchManager {
    constructor() {
        this.searchCache = new Map();
        this.recentSearches = JSON.parse(localStorage.getItem('recentSearches') || '[]');
    }

    /**
     * Enhanced search that prioritizes database cache
     */
    async searchMovies(query, options = {}) {
        const { 
            limit = 10, 
            fallbackToAPI = true, 
            cacheResults = true 
        } = options;

        if (!query.trim()) return [];

        // Check local search cache first
        const cacheKey = `${query.toLowerCase()}_${limit}`;
        if (this.searchCache.has(cacheKey)) {
            console.log(`🚀 Using local search cache for: "${query}"`);
            return this.searchCache.get(cacheKey);
        }

        try {
            console.log(`🔍 Searching database cache for: "${query}"`);
            
            // Search in database cache first
            const cachedResults = await searchCachedMovies(query, limit);
            
            if (cachedResults.length > 0) {
                console.log(`✅ Found ${cachedResults.length} results in database cache`);
                
                // Cache the results locally for faster subsequent searches
                if (cacheResults) {
                    this.searchCache.set(cacheKey, cachedResults);
                }
                
                // Add to recent searches
                this.addToRecentSearches(query);
                
                return cachedResults;
            }

            // If no results in cache and fallback is enabled, could search API
            if (fallbackToAPI) {
                console.log(`🌐 No cache results, would fallback to API search for: "${query}"`);
                // Note: API search integration would go here
                return [];
            }

            return [];
        } catch (error) {
            console.error('Database search error:', error);
            return [];
        }
    }

    /**
     * Get movie by Trakt ID from database cache
     */
    async getMovieById(traktId) {
        try {
            console.log(`🎬 Getting movie ${traktId} from database cache`);
            const movie = await getCachedMovie(traktId);
            
            if (movie) {
                console.log(`✅ Found movie in database cache: ${movie.title} (${movie.year})`);
                
                // Ensure the movie has the expected structure for network compatibility
                if (!movie.ids && movie.traktId) {
                    movie.ids = {
                        trakt: movie.traktId,
                        imdb: movie.fullDetails?.ids?.imdb,
                        tmdb: movie.fullDetails?.ids?.tmdb,
                        slug: movie.fullDetails?.ids?.slug
                    };
                }
                
                return movie;
            }
            
            console.log(`❌ Movie ${traktId} not found in database cache`);
            return null;
        } catch (error) {
            console.error('Error getting movie from database cache:', error);
            return null;
        }
    }

    /**
     * Search suggestions based on partial input
     */
    async getSearchSuggestions(partialQuery, limit = 5) {
        if (partialQuery.length < 2) return [];

        try {
            const suggestions = await searchCachedMovies(partialQuery, limit);
            return suggestions.map(movie => ({
                title: movie.title,
                year: movie.year,
                traktId: movie.trakt_id,
                rating: movie.overall_rating,
                poster: movie.poster_url
            }));
        } catch (error) {
            console.error('Error getting search suggestions:', error);
            return [];
        }
    }

    /**
     * Add search to recent searches
     */
    addToRecentSearches(query) {
        this.recentSearches = this.recentSearches.filter(search => search !== query);
        this.recentSearches.unshift(query);
        this.recentSearches = this.recentSearches.slice(0, 10); // Keep last 10
        localStorage.setItem('recentSearches', JSON.stringify(this.recentSearches));
    }

    /**
     * Get recent searches
     */
    getRecentSearches() {
        return this.recentSearches;
    }

    /**
     * Clear search cache
     */
    clearSearchCache() {
        this.searchCache.clear();
        console.log('🧹 Local search cache cleared');
    }

    /**
     * Get search statistics
     */
    getSearchStats() {
        return {
            cacheSize: this.searchCache.size,
            recentSearches: this.recentSearches.length,
            lastSearch: this.recentSearches[0] || null
        };
    }
}

// Export singleton instance
export const databaseSearch = new DatabaseSearchManager();