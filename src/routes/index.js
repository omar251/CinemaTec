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
const cacheRoutes = require('./cache');
const ttsRoutes = require('./tts');
const databaseRoutes = require('./database');
const importRoutes = require('./import');

// Mount routes
router.use('/search', searchRoutes);
router.use('/movies', moviesRoutes);
router.use('/networks', networksRoutes);
router.use('/ai', aiRoutes);
router.use('/cache', cacheRoutes);
router.use('/health', healthRoutes);
router.use('/tts', ttsRoutes);
router.use('/database', databaseRoutes);
router.use('/import', importRoutes);

// Root API endpoint
router.get('/', (req, res) => {
  res.json({
    message: 'Trakt API Explorer - Node.js Backend',
    version: '2.0.0',
    endpoints: {
      health: '/api/health',
      movies: '/api/movies',
      networks: '/api/networks',
      ai: '/api/ai',
      cache: '/api/cache',
      tts: '/api/tts',
      database: '/api/database',
      import: '/api/import'
    },
    documentation: 'See /docs/api/ for detailed API documentation'
  });
});

module.exports = router;