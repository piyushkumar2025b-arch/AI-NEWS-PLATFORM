export class CircuitBreakerOpenError extends Error {
  constructor(message: string = 'Circuit breaker is open') {
    super(message);
    this.name = 'CircuitBreakerOpenError';
  }
}

export type CircuitBreakerState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerOptions {
  name: string;
  failureThreshold?: number;
  recoveryTimeoutMs?: number;
  halfOpenMaxSuccess?: number;
}

export class CircuitBreaker {
  public readonly name: string;
  private failureThreshold: number;
  private recoveryTimeoutMs: number;
  private halfOpenMaxSuccess: number;

  private state: CircuitBreakerState = 'CLOSED';
  private failureCount: number = 0;
  private successCount: number = 0;
  private lastFailureTime: number = 0;

  constructor(options: CircuitBreakerOptions) {
    this.name = options.name;
    this.failureThreshold = options.failureThreshold || 3;
    this.recoveryTimeoutMs = options.recoveryTimeoutMs || 10000;
    this.halfOpenMaxSuccess = options.halfOpenMaxSuccess || 1;
  }

  getState(): CircuitBreakerState {
    if (this.state === 'OPEN') {
      const elapsed = Date.now() - this.lastFailureTime;
      if (elapsed >= this.recoveryTimeoutMs) {
        this.state = 'HALF_OPEN';
        this.successCount = 0;
      }
    }
    return this.state;
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    const currentState = this.getState();

    if (currentState === 'OPEN') {
      throw new CircuitBreakerOpenError(`Circuit '${this.name}' is OPEN. Fast-failing request.`);
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure();
      throw err;
    }
  }

  private onSuccess() {
    if (this.state === 'HALF_OPEN') {
      this.successCount++;
      if (this.successCount >= this.halfOpenMaxSuccess) {
        this.reset();
      }
    } else {
      this.failureCount = 0;
    }
  }

  private onFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.state === 'HALF_OPEN' || this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN';
    }
  }

  reset() {
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = 0;
  }
}

export class CircuitBreakerRegistry {
  private static instance: CircuitBreakerRegistry;
  private breakers = new Map<string, CircuitBreaker>();

  static getInstance(): CircuitBreakerRegistry {
    if (!this.instance) this.instance = new CircuitBreakerRegistry();
    return this.instance;
  }

  getOrCreate(name: string, options?: Partial<CircuitBreakerOptions>): CircuitBreaker {
    let cb = this.breakers.get(name);
    if (!cb) {
      cb = new CircuitBreaker({ name, ...options });
      this.breakers.set(name, cb);
    }
    return cb;
  }

  getAll(): CircuitBreaker[] {
    return Array.from(this.breakers.values());
  }

  reset(name: string): boolean {
    const cb = this.breakers.get(name);
    if (cb) {
      cb.reset();
      return true;
    }
    return false;
  }
}

export const circuitBreakers = CircuitBreakerRegistry.getInstance();
export const circuitBreakerRegistry = circuitBreakers;
