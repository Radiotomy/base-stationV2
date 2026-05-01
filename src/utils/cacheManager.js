/**
 * Dual-layer cache: in-memory (fast) + localStorage (persistent across refreshes).
 * TTL enforced on both layers.
 */
class CacheManager {
  constructor(namespace = 'bs_cache') {
    this.memory = new Map();
    this.ns = namespace;
  }

  _lsKey(key) { return `${this.ns}:${key}`; }

  set(key, value, ttlSeconds = 300) {
    const expiresAt = Date.now() + ttlSeconds * 1000;
    const item = { value, expiresAt };
    // Memory
    this.memory.set(key, item);
    // localStorage (skip large objects > ~100KB)
    try {
      const str = JSON.stringify(item);
      if (str.length < 100_000) localStorage.setItem(this._lsKey(key), str);
    } catch {}
  }

  get(key) {
    const now = Date.now();
    // Memory first
    const mem = this.memory.get(key);
    if (mem) {
      if (now > mem.expiresAt) { this.memory.delete(key); } else { return mem.value; }
    }
    // localStorage fallback
    try {
      const raw = localStorage.getItem(this._lsKey(key));
      if (!raw) return null;
      const item = JSON.parse(raw);
      if (now > item.expiresAt) { localStorage.removeItem(this._lsKey(key)); return null; }
      this.memory.set(key, item); // warm memory cache
      return item.value;
    } catch { return null; }
  }

  remove(key) {
    this.memory.delete(key);
    try { localStorage.removeItem(this._lsKey(key)); } catch {}
  }

  clear() {
    this.memory.clear();
    try {
      Object.keys(localStorage)
        .filter(k => k.startsWith(this.ns + ':'))
        .forEach(k => localStorage.removeItem(k));
    } catch {}
  }

  /** Wrap an async function with caching */
  async getOrFetch(key, fetchFn, ttlSeconds = 300) {
    const cached = this.get(key);
    if (cached !== null) return cached;
    const value = await fetchFn();
    this.set(key, value, ttlSeconds);
    return value;
  }
}

export const cacheManager = new CacheManager('bs_cache');