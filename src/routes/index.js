/**
 * Route aggregator
 */
const express = require('express');
const router = express.Router();

// Import route modules
const moviesRoutes = require('./movies');
const searchRoutes = require('./search');
const networksRoutes = require('./networks');
const aiRoutes = require('./ai');
const healthRoutes = require('./health');

// Mount routes
router.use('/search', searchRoutes);
router.use('/movies', moviesRoutes);
router.use('/networks', networksRoutes);
router.use('/ai', aiRoutes);
router.use('/health', healthRoutes);

// Root API endpoint
router.get('/', (req, res) => {
  res.json({
    message: 'Trakt API Explorer - Node.js Backend',
    version: '2.0.0',
    endpoints: {
      health: '/api/health',
      movies: '/api/movies',
      networks: '/api/networks',
      ai: '/api/ai'
    },
    documentation: 'See /docs/api/ for detailed API documentation'
  });
});

module.exports = router;