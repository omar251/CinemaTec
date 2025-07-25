/**
 * Import Routes
 * Handles movie data import operations
 */
const express = require('express');
const router = express.Router();
const movieImportService = require('../services/movieImportService');
const logger = require('../utils/logger');

/**
 * POST /api/import/movies
 * Import all movies from movies.json into the database
 */
router.post('/movies', async (req, res) => {
    try {
        logger.info('🚀 Starting movie import via API...');
        const result = await movieImportService.importMoviesFromJson();
        
        res.json({
            success: true,
            message: 'Movies imported successfully',
            data: result
        });
    } catch (error) {
        logger.error('Movie import API error:', error.message);
        res.status(500).json({
            success: false,
            message: 'Failed to import movies',
            error: error.message
        });
    }
});

/**
 * POST /api/import/movie
 * Import a single movie by title and year
 */
router.post('/movie', async (req, res) => {
    try {
        const { title, year } = req.body;
        
        if (!title || !year) {
            return res.status(400).json({
                success: false,
                message: 'Title and year are required'
            });
        }

        const result = await movieImportService.importSingleMovie(title, parseInt(year));
        
        res.json({
            success: true,
            message: 'Movie imported successfully',
            data: result
        });
    } catch (error) {
        logger.error('Single movie import API error:', error.message);
        res.status(500).json({
            success: false,
            message: 'Failed to import movie',
            error: error.message
        });
    }
});

/**
 * GET /api/import/stats
 * Get import statistics
 */
router.get('/stats', async (req, res) => {
    try {
        const stats = await movieImportService.getImportStats();
        
        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        logger.error('Import stats API error:', error.message);
        res.status(500).json({
            success: false,
            message: 'Failed to get import stats',
            error: error.message
        });
    }
});

module.exports = router;