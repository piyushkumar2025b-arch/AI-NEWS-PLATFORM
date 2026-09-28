import { Logger } from '../config/logging.js';

const logger = new Logger('CacheService');

interface CacheEntry<T = any> {
  value: T;
  expiresAt: number;
  lastAccessed: number;
}

export class CacheService {
  private static instance: CacheService;
  private store: Map<string, CacheEntry> = new Map();
  private maxEntries: number = 2000;
  private hits: number = 0;
  private misses: number = 0;
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor() {
    // Periodic background sweep every 60 seconds to prune expired keys
    this.cleanupTimer = setInterval(() => {
      this.pruneExpired();
    }, 60000);
    this.cleanupTimer.unref?.();
  }

  public static getInstance(): CacheService {
    if (!CacheService.instance) {
      CacheService.instance = new CacheService();
    }
    return CacheService.instance;
  }

  public async get<T = any>(key: string): Promise<T | null> {
    const entry = this.store.get(key);
    if (!entry) {
      this.misses++;
      return null;
    }

    const now = Date.now();
    if (now > entry.expiresAt) {
      this.store.delete(key);
      this.misses++;
      return null;
    }

    entry.lastAccessed = now;
    this.hits++;
    return entry.value as T;
  }

  public async set<T = any>(key: string, value: T, ttlSeconds: number = 60): Promise<void> {
    // If cache is at maximum capacity, evict least recently accessed entries
    if (this.store.size >= this.maxEntries && !this.store.has(key)) {
      this.evictLru(Math.ceil(this.maxEntries * 0.15)); // Evict oldest 15%
    }

    const now = Date.now();
    this.store.set(key, {
      value,
      expiresAt: now + ttlSeconds * 1000,
      lastAccessed: now
    });
  }

  public async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  public async invalidatePrefix(prefix: string): Promise<number> {
    let deletedCount = 0;
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
        deletedCount++;
      }
    }
    return deletedCount;
  }

  public async clear(): Promise<void> {
    this.store.clear();
  }

  private pruneExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.expiresAt) {
        this.store.delete(key);
      }
    }
  }

  private evictLru(count: number): void {
    const entries = Array.from(this.store.entries());
    entries.sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);
    const toRemove = entries.slice(0, count);
    for (const [k] of toRemove) {
      this.store.delete(k);
    }
  }

  public getStats() {
    const now = Date.now();
    let activeKeys = 0;
    for (const entry of this.store.values()) {
      if (now <= entry.expiresAt) {
        activeKeys++;
      }
    }
    const totalRequests = this.hits + this.misses;
    const hitRate = totalRequests > 0 ? (this.hits / totalRequests) * 100 : 0;

    return {
      totalKeys: this.store.size,
      activeKeys,
      maxEntries: this.maxEntries,
      hits: this.hits,
      misses: this.misses,
      hitRatePercent: Math.round(hitRate * 10) / 10
    };
  }
}

export const cacheService = CacheService.getInstance();
