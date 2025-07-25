/**
 * Database-related routes
 */
const express = require('express');
const router = express.Router();
const databaseService = require('../services/databaseService');
const logger = require('../utils/logger');

// Get database status
router.get('/status', async (req, res) => {
    try {
        const metadata = await databaseService.getAppMetadata();
        const isConnected = databaseService.isConnected;
        
        res.json({
            connected: isConnected,
            metadata: metadata,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        logger.error('Database status check failed:', error.message);
        res.status(500).json({ 
            connected: false, 
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Get all movies from database
router.get('/movies', async (req, res) => {
    try {
        const movies = await databaseService.getAllMovies();
        res.json({
            movies: movies,
            count: movies.length,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        logger.error('Failed to get movies from database:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Get favorite movies
router.get('/movies/favorites', async (req, res) => {
    try {
        const favorites = await databaseService.getFavoriteMovies();
        res.json({
            favorites: favorites,
            count: favorites.length,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        logger.error('Failed to get favorite movies:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Get specific movie
router.get('/movies/:movieKey', async (req, res) => {
    try {
        const { movieKey } = req.params;
        const movie = await databaseService.getMovie(movieKey);
        
        if (!movie) {
            return res.status(404).json({ error: 'Movie not found' });
        }
        
        res.json(movie);
    } catch (error) {
        logger.error(`Failed to get movie ${req.params.movieKey}:`, error.message);
        res.status(500).json({ error: error.message });
    }
});

// Save movie to database
router.post('/movies', async (req, res) => {
    try {
        const movieData = req.body;
        const movieKey = await databaseService.saveMovie(movieData);
        
        res.json({
            success: true,
            movieKey: movieKey,
            message: 'Movie saved successfully'
        });
    } catch (error) {
        logger.error('Failed to save movie:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Update movie favorite status
router.patch('/movies/:movieKey/favorite', async (req, res) => {
    try {
        const { movieKey } = req.params;
        const { isFavorite } = req.body;
        
        await databaseService.updateMovieFavoriteStatus(movieKey, isFavorite);
        
        res.json({
            success: true,
            movieKey: movieKey,
            isFavorite: isFavorite,
            message: 'Favorite status updated'
        });
    } catch (error) {
        logger.error(`Failed to update favorite status for ${req.params.movieKey}:`, error.message);
        res.status(500).json({ error: error.message });
    }
});

// Save movie connection
router.post('/connections', async (req, res) => {
    try {
        const { sourceMovieKey, targetMovieKey, connectionType } = req.body;
        
        await databaseService.saveMovieConnection(sourceMovieKey, targetMovieKey, connectionType);
        
        res.json({
            success: true,
            message: 'Connection saved successfully'
        });
    } catch (error) {
        logger.error('Failed to save connection:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Get movie connections
router.get('/movies/:movieKey/connections', async (req, res) => {
    try {
        const { movieKey } = req.params;
        const connections = await databaseService.getMovieConnections(movieKey);
        
        res.json({
            movieKey: movieKey,
            connections: connections,
            count: connections.length
        });
    } catch (error) {
        logger.error(`Failed to get connections for ${req.params.movieKey}:`, error.message);
        res.status(500).json({ error: error.message });
    }
});

// Sync current network to database
router.post('/sync', async (req, res) => {
    try {
        const { nodes, links } = req.body;
        
        if (!nodes || !Array.isArray(nodes)) {
            return res.status(400).json({ error: 'Invalid nodes data' });
        }
        
        let savedMovies = 0;
        let savedConnections = 0;
        
        // Save all movies
        for (const node of nodes) {
            try {
                await databaseService.saveMovie(node);
                savedMovies++;
            } catch (error) {
                logger.warn(`Failed to save movie ${node.title}:`, error.message);
            }
        }
        
        // Save all connections
        if (links && Array.isArray(links)) {
            for (const link of links) {
                try {
                    const sourceKey = `${link.source.title}_${link.source.year}`;
                    const targetKey = `${link.target.title}_${link.target.year}`;
                    await databaseService.saveMovieConnection(sourceKey, targetKey);
                    savedConnections++;
                } catch (error) {
                    logger.warn(`Failed to save connection:`, error.message);
                }
            }
        }
        
        // Update app metadata
        const totalRating = nodes.reduce((sum, node) => {
            const rating = node.fullDetails?.rating || node.basicDetails?.rating || 0;
            return sum + rating;
        }, 0);
        
        const averageRating = nodes.length > 0 ? totalRating / nodes.length : 0;
        const maxDepth = Math.max(...nodes.map(n => n.depth || 0));
        
        await databaseService.updateAppMetadata({
            totalMovies: savedMovies,
            totalConnections: savedConnections,
            maxDepth: maxDepth,
            averageRating: averageRating
        });
        
        res.json({
            success: true,
            savedMovies: savedMovies,
            savedConnections: savedConnections,
            averageRating: averageRating.toFixed(1),
            maxDepth: maxDepth,
            message: 'Network synced to database successfully'
        });
        
    } catch (error) {
        logger.error('Failed to sync network to database:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Load network from database
router.get('/load', async (req, res) => {
    try {
        const movies = await databaseService.getAllMovies();
        
        // Convert database format back to network format
        const nodes = movies.map(movie => ({
            ...movie,
            movieKey: `${movie.title}_${movie.year}`
        }));
        
        // Get all connections
        const allConnections = [];
        for (const movie of movies) {
            const connections = await databaseService.getMovieConnections(movie.movieKey);
            connections.forEach(conn => {
                allConnections.push({
                    source: movie.movieKey,
                    target: conn.connected_movie_key,
                    type: conn.connection_type
                });
            });
        }
        
        // Remove duplicate connections
        const uniqueConnections = allConnections.filter((conn, index, self) => 
            index === self.findIndex(c => 
                (c.source === conn.source && c.target === conn.target) ||
                (c.source === conn.target && c.target === conn.source)
            )
        );
        
        res.json({
            nodes: nodes,
            links: uniqueConnections,
            metadata: await databaseService.getAppMetadata(),
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        logger.error('Failed to load network from database:', error.message);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;