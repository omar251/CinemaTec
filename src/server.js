/**
 * CinemaTec Movie Network Explorer - Refactored Server
 * Clean, modular architecture with separation of concerns
 */
const express = require('express');
const config = require('./config');
const logger = require('./utils/logger');
const { setupMiddleware, errorHandler, notFoundHandler } = require('./middleware');
const apiRoutes = require('./routes');

// Initialize services (this triggers their setup)
require('./services/cacheService');
require('./services/traktService');
require('./services/tmdbService');
require('./services/aiService');
require('./services/enhancementService');

class Server {
  constructor() {
    this.app = express();
    this.port = config.server.port;
    this.host = config.server.host;
    
    this.setupServer();
  }

  setupServer() {
    logger.info('🚀 Initializing CinemaTec Movie Network Explorer');
    
    // Setup middleware
    setupMiddleware(this.app);
    
    // Setup routes
    this.setupRoutes();
    
    // Setup error handling
    this.setupErrorHandling();
    
    logger.info('✅ Server configuration completed');
  }

  setupRoutes() {
    // API routes
    this.app.use('/api', apiRoutes);
    
    // Root redirect to frontend
    this.app.get('/', (req, res) => {
      res.redirect('/index.html');
    });
    
    logger.info('📍 Routes configured');
  }

  setupErrorHandling() {
    // 404 handler (must be after all routes)
    this.app.use(notFoundHandler);
    
    // Global error handler (must be last)
    this.app.use(errorHandler);
    
    logger.info('🛡️  Error handling configured');
  }

  start() {
    return new Promise((resolve, reject) => {
      try {
        this.server = this.app.listen(this.port, this.host, () => {
          logger.info(`🎬 CinemaTec Movie Network Explorer server running on port ${this.port}`);
          logger.info(`🌐 Frontend: http://localhost:${this.port}`);
          logger.info(`📡 API: http://localhost:${this.port}/api`);
          logger.info(`🏥 Health: http://localhost:${this.port}/api/health`);
          
          // Log configuration status
          this.logConfigurationStatus();
          
          resolve(this.server);
        });

        // Handle server errors
        this.server.on('error', (error) => {
          if (error.code === 'EADDRINUSE') {
            logger.error(`Port ${this.port} is already in use`);
          } else {
            logger.error(`Server error: ${error.message}`);
          }
          reject(error);
        });

      } catch (error) {
        logger.error(`Failed to start server: ${error.message}`);
        reject(error);
      }
    });
  }

  logConfigurationStatus() {
    logger.info('📋 Configuration Status:');
    logger.info(`   • Trakt API: ${config.apis.trakt.key ? '✅ Configured' : '❌ Missing'}`);
    logger.info(`   • TMDB API: ${config.apis.tmdb.key ? '✅ Configured' : '⚠️  Optional'}`);
    logger.info(`   • Gemini AI: ${config.apis.gemini.key ? '✅ Configured' : '⚠️  Optional'}`);
    logger.info(`   • Storage: ${config.storage.type}-based (${config.storage.dataDir})`);
    logger.info(`   • Environment: ${config.server.nodeEnv}`);
  }

  async stop() {
    if (this.server) {
      return new Promise((resolve) => {
        this.server.close(() => {
          logger.info('👋 Server stopped gracefully');
          resolve();
        });
      });
    }
  }
}

// Graceful shutdown handling
function setupGracefulShutdown(server) {
  const shutdown = async (signal) => {
    logger.info(`📡 Received ${signal}, shutting down gracefully...`);
    
    try {
      await server.stop();
      process.exit(0);
    } catch (error) {
      logger.error(`Error during shutdown: ${error.message}`);
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  
  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    logger.error(`Uncaught Exception: ${error.message}`, { stack: error.stack });
    process.exit(1);
  });
  
  process.on('unhandledRejection', (reason, promise) => {
    logger.error(`Unhandled Rejection at: ${promise}, reason: ${reason}`);
    process.exit(1);
  });
}

// Start server if this file is run directly
async function main() {
  try {
    const server = new Server();
    await server.start();
    
    setupGracefulShutdown(server);
    
  } catch (error) {
    logger.error(`Failed to start application: ${error.message}`);
    process.exit(1);
  }
}

// Export for testing
module.exports = { Server };

// Start server if run directly
if (require.main === module) {
  main();
}