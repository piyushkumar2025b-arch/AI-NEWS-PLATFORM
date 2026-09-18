export interface RateLimiterOptions {
  capacity: number;       // Maximum bucket capacity (tokens)
  refillRatePerSec: number; // Tokens added per second
}

export class TokenBucket {
  private capacity: number;
  private refillRate: number;
  private tokens: number;
  private lastRefill: number;

  constructor(options: RateLimiterOptions) {
    this.capacity = Math.max(1, options.capacity);
    this.refillRate = Math.max(0.01, options.refillRatePerSec);
    this.tokens = this.capacity;
    this.lastRefill = Date.now();
  }

  private refill(): void {
    const now = Date.now();
    const elapsedSeconds = (now - this.lastRefill) / 1000;
    if (elapsedSeconds > 0) {
      const addedTokens = elapsedSeconds * this.refillRate;
      this.tokens = Math.min(this.capacity, this.tokens + addedTokens);
      this.lastRefill = now;
    }
  }

  public tryConsume(tokens = 1): boolean {
    this.refill();
    if (this.tokens >= tokens) {
      this.tokens -= tokens;
      return true;
    }
    return false;
  }

  public async acquire(tokens = 1, maxWaitMs = 15000): Promise<boolean> {
    const startTime = Date.now();
    while (Date.now() - startTime < maxWaitMs) {
      if (this.tryConsume(tokens)) {
        return true;
      }
      // Calculate delay until 1 token is available
      const needed = tokens - this.tokens;
      const waitMs = Math.min(1000, Math.max(50, Math.ceil((needed / this.refillRate) * 1000)));
      await new Promise(res => setTimeout(res, waitMs));
    }
    return false;
  }

  public getAvailableTokens(): number {
    this.refill();
    return Math.floor(this.tokens);
  }
}

export class RateLimiterRegistry {
  private buckets: Map<string, TokenBucket> = new Map();

  public getOrCreate(key: string, options: RateLimiterOptions): TokenBucket {
    let bucket = this.buckets.get(key);
    if (!bucket) {
      bucket = new TokenBucket(options);
      this.buckets.set(key, bucket);
    }
    return bucket;
  }

  public async acquire(key: string, options: RateLimiterOptions, tokens = 1): Promise<boolean> {
    const bucket = this.getOrCreate(key, options);
    return bucket.acquire(tokens);
  }
}

export const rateLimiterRegistry = new RateLimiterRegistry();
