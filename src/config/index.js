/**
 * Configuration management
 */
require('dotenv').config();

const config = {
  // Server configuration
  server: {
    port: process.env.PORT || 5000,
    nodeEnv: process.env.NODE_ENV || 'development',
    host: '0.0.0.0'
  },

  // API Keys
  apis: {
    trakt: {
      key: process.env.TRAKT_API_KEY,
      baseUrl: 'https://api.trakt.tv',
      timeout: 5000,
      version: '2'
    },
    tmdb: {
      key: process.env.TMDB_API_KEY,
      baseUrl: 'https://api.themoviedb.org/3',
      imageBase: 'https://image.tmdb.org/t/p/w500',
      timeout: 5000
    },
    gemini: {
      key: process.env.GEMINI_API_KEY,
      model: 'gemini-1.5-flash'
    }
  },

  // Cache configuration
  cache: {
    api: {
      ttl: 300000, // 5 minutes
      cleanupInterval: 300000
    },
    enhanced: {
      ttl: 600000, // 10 minutes
    },
    ai: {
      ttl: 1800000, // 30 minutes
    }
  },

  // Storage configuration
  storage: {
    type: 'file',
    dataDir: 'saved_networks',
    movieCache: {
      enabled: true,
      autoSaveInterval: 300000, // 5 minutes
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      cleanupInterval: 24 * 60 * 60 * 1000 // 24 hours
    }
  },

  // Security configuration
  security: {
    helmet: {
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "https://d3js.org", "https://cdn.jsdelivr.net"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"],
        },
      },
    }
  }
};

// Validation
function validateConfig() {
  const errors = [];

  if (!config.apis.trakt.key) {
    errors.push('TRAKT_API_KEY environment variable is required');
  }

  if (!config.apis.tmdb.key) {
    console.warn('[WARN] TMDB_API_KEY not provided - poster images will not be available');
  }

  if (!config.apis.gemini.key) {
    console.warn('[WARN] GEMINI_API_KEY not provided - AI features will not be available');
  }

  if (errors.length > 0) {
    console.error('[ERROR] Configuration validation failed:');
    errors.forEach(error => console.error(`  - ${error}`));
    process.exit(1);
  }
}

// Validate on load
validateConfig();

module.exports = config;