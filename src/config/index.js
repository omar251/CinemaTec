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
    // Backward-compatible Gemini config
    gemini: {
        key: process.env.GEMINI_API_KEY,
        model: process.env.GEMINI_MODEL
      },
      // Provider-agnostic AI configuration
      ai: {
        provider: process.env.AI_PROVIDER || (process.env.GEMINI_API_KEY ? 'gemini' : (process.env.OPENAI_API_KEY ? 'openai' : (process.env.GROQ_API_KEY ? 'groq' : null))),
        key: process.env.AI_API_KEY || process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY || process.env.GROQ_API_KEY || null,
        model: process.env.AI_MODEL || process.env.GEMINI_MODEL || process.env.OPENAI_MODEL || process.env.GROQ_MODEL || null,
        openai: {
          key: process.env.OPENAI_API_KEY,
          model: process.env.OPENAI_MODEL
        },
        groq: {
          key: process.env.GROQ_API_KEY,
          model: process.env.GROQ_MODEL
        }
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
          scriptSrcAttr: ["'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'", "blob:", "data:"],
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

  // AI config warnings
  if (!config.apis.ai.provider) {
    console.warn('[WARN] No AI provider configured - AI features will be disabled');
  } else {
    console.info(`[INFO] AI provider configured: ${config.apis.ai.provider}`);
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