# Cache System Optimization Plan

## Current Issues Identified

### 1. **Memory Management**
- **Problem**: No memory limits on cache size
- **Risk**: TTS audio files (base64) can consume significant memory
- **Impact**: Potential server crashes with high TTS usage

### 2. **TTS Cache Persistence**
- **Problem**: TTS audio only cached in memory
- **Risk**: Lost on server restart, expensive to regenerate
- **Impact**: Poor user experience after restarts

### 3. **Cache Key Structure**
- **Problem**: TTS cache keys don't include movie context
- **Risk**: Harder to manage and debug
- **Impact**: Difficult cache maintenance

## Proposed Solutions

### Phase 1: Memory Management (High Priority)

#### A. Add Memory Limits
```javascript
class MemoryCache {
  constructor(defaultTTL = 300000, maxSize = 100) {
    this.cache = new Map();
    this.defaultTTL = defaultTTL;
    this.maxSize = maxSize;
    this.currentSize = 0;
  }

  set(key, value, ttl = this.defaultTTL) {
    // Check size limits before adding
    const valueSize = this.calculateSize(value);
    
    if (this.currentSize + valueSize > this.maxSize) {
      this.evictLRU(); // Remove least recently used
    }
    
    const expiry = Date.now() + ttl;
    this.cache.set(key, { 
      value, 
      expiry, 
      size: valueSize,
      lastAccessed: Date.now()
    });
    this.currentSize += valueSize;
  }
}
```

#### B. Implement LRU Eviction
```javascript
evictLRU() {
  let oldestKey = null;
  let oldestTime = Date.now();
  
  for (const [key, item] of this.cache.entries()) {
    if (item.lastAccessed < oldestTime) {
      oldestTime = item.lastAccessed;
      oldestKey = key;
    }
  }
  
  if (oldestKey) {
    const item = this.cache.get(oldestKey);
    this.currentSize -= item.size;
    this.cache.delete(oldestKey);
  }
}
```

### Phase 2: TTS Cache Persistence (Medium Priority)

#### A. File-Based TTS Cache
```javascript
class TTSFileCache {
  constructor(cacheDir = 'cache/tts') {
    this.cacheDir = cacheDir;
    this.ensureCacheDir();
  }

  async set(key, audioBuffer) {
    const filename = this.getFilename(key);
    const filepath = path.join(this.cacheDir, filename);
    await fs.writeFile(filepath, audioBuffer);
    
    // Store metadata
    const metadata = {
      key,
      created: Date.now(),
      size: audioBuffer.length
    };
    await fs.writeFile(`${filepath}.meta`, JSON.stringify(metadata));
  }

  async get(key) {
    const filename = this.getFilename(key);
    const filepath = path.join(this.cacheDir, filename);
    
    if (await fs.exists(filepath)) {
      return await fs.readFile(filepath);
    }
    return null;
  }
}
```

#### B. Hybrid TTS Caching
```javascript
class HybridTTSCache {
  constructor() {
    this.memoryCache = new MemoryCache(3600000, 50); // 50 items max
    this.fileCache = new TTSFileCache();
  }

  async get(key) {
    // Try memory first (fastest)
    let audio = this.memoryCache.get(key);
    if (audio) return audio;
    
    // Try file cache (slower but persistent)
    audio = await this.fileCache.get(key);
    if (audio) {
      // Promote to memory cache
      this.memoryCache.set(key, audio);
      return audio;
    }
    
    return null;
  }

  async set(key, audioBuffer) {
    // Store in both caches
    this.memoryCache.set(key, audioBuffer);
    await this.fileCache.set(key, audioBuffer);
  }
}
```

### Phase 3: Enhanced Monitoring (Low Priority)

#### A. Cache Metrics
```javascript
class CacheMetrics {
  constructor() {
    this.hits = 0;
    this.misses = 0;
    this.evictions = 0;
    this.memoryUsage = 0;
  }

  recordHit() { this.hits++; }
  recordMiss() { this.misses++; }
  recordEviction() { this.evictions++; }
  
  getHitRate() {
    const total = this.hits + this.misses;
    return total > 0 ? (this.hits / total) * 100 : 0;
  }
}
```

#### B. Health Monitoring
```javascript
// Add to cache service
getHealthStatus() {
  const memoryUsage = process.memoryUsage();
  const cacheStats = this.getStatus();
  
  return {
    memory: {
      used: memoryUsage.heapUsed,
      total: memoryUsage.heapTotal,
      percentage: (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100
    },
    cache: cacheStats,
    alerts: this.checkAlerts()
  };
}

checkAlerts() {
  const alerts = [];
  const memoryUsage = process.memoryUsage();
  const memoryPercentage = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;
  
  if (memoryPercentage > 80) {
    alerts.push('High memory usage detected');
  }
  
  return alerts;
}
```

## Implementation Priority

### 🔴 **Critical (Implement First)**
1. **Memory limits for TTS cache** - Prevent memory exhaustion
2. **LRU eviction** - Manage cache size automatically
3. **Size calculation** - Track actual memory usage

### 🟡 **Important (Implement Second)**
1. **File-based TTS cache** - Persist expensive audio generation
2. **Hybrid caching strategy** - Best of both worlds
3. **Improved cache keys** - Better organization

### 🟢 **Nice to Have (Implement Later)**
1. **Cache metrics and monitoring** - Performance insights
2. **Health alerts** - Proactive monitoring
3. **Cache warming** - Pre-generate common audio

## Configuration Updates

```javascript
// Add to config/index.js
cache: {
  api: {
    ttl: 300000,
    maxSize: 100, // Max items
    cleanupInterval: 300000
  },
  tts: {
    ttl: 3600000, // 1 hour
    maxMemorySize: 50, // Max items in memory
    fileCache: true, // Enable file persistence
    cacheDir: 'cache/tts'
  },
  enhanced: {
    ttl: 600000,
    maxSize: 200
  },
  ai: {
    ttl: 1800000,
    maxSize: 50
  }
}
```

## Expected Benefits

### 🚀 **Performance**
- **Faster TTS**: Memory cache for frequent requests
- **Persistent TTS**: File cache survives restarts
- **Reduced API calls**: Better cache hit rates

### 💾 **Resource Management**
- **Controlled memory usage**: Prevents crashes
- **Efficient storage**: Hybrid approach optimizes speed vs persistence
- **Automatic cleanup**: LRU eviction manages size

### 📊 **Monitoring**
- **Cache insights**: Hit rates, memory usage, performance
- **Proactive alerts**: Early warning for issues
- **Better debugging**: Detailed cache statistics

## Migration Strategy

1. **Phase 1**: Implement memory limits (no breaking changes)
2. **Phase 2**: Add file cache (optional, backward compatible)
3. **Phase 3**: Add monitoring (enhancement only)

Each phase can be implemented independently without affecting existing functionality.