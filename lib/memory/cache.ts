/**
 * Simple in-memory LRU cache with TTL.
 * Used for: user profile (5 min), SWOT snapshot (5 min), embedding query results (30 s).
 */

type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

export class LRUCache<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private readonly maxSize: number;
  private readonly defaultTtlMs: number;

  constructor(maxSize = 200, defaultTtlMs = 5 * 60 * 1000) {
    this.maxSize = maxSize;
    this.defaultTtlMs = defaultTtlMs;
  }

  get(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) {
      return null;
    }

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry.value;
  }

  set(key: string, value: T, ttlMs?: number): void {
    // Evict if at capacity
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(key, {
      value,
      expiresAt: Date.now() + (ttlMs ?? this.defaultTtlMs),
    });
  }

  invalidate(key: string): void {
    this.cache.delete(key);
  }

  invalidatePrefix(prefix: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
  }

  clear(): void {
    this.cache.clear();
  }
}

// Shared cache instances
export const profileCache = new LRUCache(100, 5 * 60 * 1000);      // 5 min
export const swotCache = new LRUCache(100, 5 * 60 * 1000);          // 5 min
export const embeddingQueryCache = new LRUCache(50, 30 * 1000);     // 30 s
