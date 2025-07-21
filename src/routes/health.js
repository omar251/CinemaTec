/**
 * Health check and system status routes
 */
const express = require('express');
const router = express.Router();
const config = require('../config');
const cacheService = require('../services/cacheService');
const aiService = require('../services/aiService');
const logger = require('../utils/logger');

// Main health check endpoint
router.get('/', async (req, res) => {
  try {
    const cacheStatus = cacheService.getStatus();
    
    const healthData = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      trakt_api_configured: !!config.apis.trakt.key,
      tmdb_api_configured: !!config.apis.tmdb.key,
      gemini_api_configured: !!config.apis.gemini.key,
      optimization: 'enabled',
      runtime: 'Node.js',
      storage: config.storage.type + '-based',
      caching: {
        enabled: true,
        api_cache_size: cacheStatus.api.active,
        enhanced_cache_size: cacheStatus.enhanced.active,
        ai_cache_size: cacheStatus.ai.active,
        total_cached_items: cacheStatus.api.active + cacheStatus.enhanced.active + cacheStatus.ai.active
      }
    };

    logger.debug('Health check requested', { 
      cacheItems: healthData.caching.total_cached_items 
    });

    res.json(healthData);
  } catch (error) {
    logger.error(`Health check failed: ${error.message}`);
    res.status(500).json({
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Detailed system status
router.get('/detailed', async (req, res) => {
  try {
    const cacheStatus = cacheService.getStatus();
    const aiHealth = await aiService.healthCheck();
    
    const detailedStatus = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      node_version: process.version,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      
      services: {
        trakt: {
          configured: !!config.apis.trakt.key,
          baseUrl: config.apis.trakt.baseUrl,
          timeout: config.apis.trakt.timeout
        },
        tmdb: {
          configured: !!config.apis.tmdb.key,
          baseUrl: config.apis.tmdb.baseUrl,
          timeout: config.apis.tmdb.timeout
        },
        ai: {
          configured: !!config.apis.gemini.key,
          status: aiHealth.status,
          model: config.apis.gemini.model,
          ...(aiHealth.error && { error: aiHealth.error })
        }
      },
      
      cache: {
        api: {
          ...cacheStatus.api,
          ttl_minutes: config.cache.api.ttl / 60000
        },
        enhanced: {
          ...cacheStatus.enhanced,
          ttl_minutes: config.cache.enhanced.ttl / 60000
        },
        ai: {
          ...cacheStatus.ai,
          ttl_minutes: config.cache.ai.ttl / 60000
        }
      },
      
      storage: {
        type: config.storage.type,
        dataDir: config.storage.dataDir
      }
    };

    res.json(detailedStatus);
  } catch (error) {
    logger.error(`Detailed health check failed: ${error.message}`);
    res.status(500).json({
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Cache status endpoint
router.get('/cache', (req, res) => {
  try {
    const cacheStatus = cacheService.getStatus();
    
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      cache: cacheStatus,
      summary: {
        total_items: cacheStatus.api.active + cacheStatus.enhanced.active + cacheStatus.ai.active,
        total_expired: cacheStatus.api.expired + cacheStatus.enhanced.expired + cacheStatus.ai.expired
      }
    });
  } catch (error) {
    logger.error(`Cache status check failed: ${error.message}`);
    res.status(500).json({
      status: 'error',
      error: error.message
    });
  }
});

// Clear cache endpoint
router.post('/cache/clear', (req, res) => {
  try {
    const beforeStatus = cacheService.getStatus();
    const totalBefore = beforeStatus.api.active + beforeStatus.enhanced.active + beforeStatus.ai.active;
    
    cacheService.clearAll();
    
    logger.info(`Cache cleared - removed ${totalBefore} items`);
    
    res.json({
      success: true,
      message: 'All caches cleared successfully',
      items_cleared: totalBefore,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error(`Cache clear failed: ${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;