/**
 * Cache service with multiple cache instances
 */
const config = require('../config');
const logger = require('../utils/logger');

class MemoryCache {
  constructor(defaultTTL = 300000) {
    this.cache = new Map();
    this.defaultTTL = defaultTTL;
  }

  set(key, value, ttl = this.defaultTTL) {
    const expiry = Date.now() + ttl;
    this.cache.set(key, { value, expiry });
  }

  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;

    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }

    return item.value;
  }

  has(key) {
    return this.get(key) !== null;
  }

  delete(key) {
    return this.cache.delete(key);
  }

  clear() {
    this.cache.clear();
  }

  size() {
    return this.cache.size;
  }

  // Clean expired entries
  cleanup() {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [key, item] of this.cache.entries()) {
      if (now > item.expiry) {
        this.cache.delete(key);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      logger.debug(`Cleaned ${cleaned} expired cache entries`);
    }
  }

  // Get cache statistics
  getStats() {
    const now = Date.now();
    let expired = 0;
    let active = 0;

    for (const [key, item] of this.cache.entries()) {
      if (now > item.expiry) {
        expired++;
      } else {
        active++;
      }
    }

    return {
      total: this.cache.size,
      active,
      expired
    };
  }
}

class CacheService {
  constructor() {
    // Initialize cache instances with different TTLs
    this.apiCache = new MemoryCache(config.cache.api.ttl);
    this.enhancedCache = new MemoryCache(config.cache.enhanced.ttl);
    this.aiCache = new MemoryCache(config.cache.ai.ttl);

    // Start cleanup interval
    this.startCleanupInterval();
    
    logger.info('Cache service initialized');
  }

  startCleanupInterval() {
    setInterval(() => {
      this.apiCache.cleanup();
      this.enhancedCache.cleanup();
      this.aiCache.cleanup();
    }, config.cache.api.cleanupInterval);
  }

  // API cache methods
  getApiCache(key) {
    const result = this.apiCache.get(key);
    if (result) {
      logger.debug(`API cache hit: ${key}`);
    }
    return result;
  }

  setApiCache(key, value, ttl) {
    this.apiCache.set(key, value, ttl);
    logger.debug(`API cache set: ${key}`);
  }

  // Enhanced cache methods
  getEnhancedCache(key) {
    const result = this.enhancedCache.get(key);
    if (result) {
      logger.debug(`Enhanced cache hit: ${key}`);
    }
    return result;
  }

  setEnhancedCache(key, value, ttl) {
    this.enhancedCache.set(key, value, ttl);
    logger.debug(`Enhanced cache set: ${key}`);
  }

  // AI cache methods
  getAiCache(key) {
    const result = this.aiCache.get(key);
    if (result) {
      logger.debug(`AI cache hit: ${key}`);
    }
    return result;
  }

  setAiCache(key, value, ttl) {
    this.aiCache.set(key, value, ttl);
    logger.debug(`AI cache set: ${key}`);
  }

  // Clear all caches
  clearAll() {
    this.apiCache.clear();
    this.enhancedCache.clear();
    this.aiCache.clear();
    logger.info('All caches cleared');
  }

  // Get comprehensive cache status
  getStatus() {
    return {
      api: {
        ...this.apiCache.getStats(),
        ttl: config.cache.api.ttl
      },
      enhanced: {
        ...this.enhancedCache.getStats(),
        ttl: config.cache.enhanced.ttl
      },
      ai: {
        ...this.aiCache.getStats(),
        ttl: config.cache.ai.ttl
      }
    };
  }
}

module.exports = new CacheService();