// Simple in-memory cache with TTL (time-to-live) for optimized data fetching
class CacheManager {
  constructor() {
    this.cache = new Map();
  }

  set(key, value, ttlSeconds = 300) {
    const expiresAt = Date.now() + ttlSeconds * 1000;
    this.cache.set(key, { value, expiresAt });
  }

  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;
    if (Date.now() > item.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return item.value;
  }

  clear() {
    this.cache.clear();
  }

  remove(key) {
    this.cache.delete(key);
  }
}

export const cacheManager = new CacheManager();