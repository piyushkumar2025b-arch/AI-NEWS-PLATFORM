import { Logger } from '../config/logging.js';
import { SOURCES } from '../config/sources.js';
import { newsRepository } from '../database/repository.js';
import { ingestionWorker, IngestionOperation } from './ingestion_worker.js';

const logger = new Logger('Scheduler');

export class Scheduler {
  private timer: NodeJS.Timeout | null = null;
  private startupTimer: NodeJS.Timeout | null = null;
  private checkIntervalMs = 60 * 1000; // Check due sources every 1 minute
  private cycleCount = 0;
  private lastCycleStartedAt: string | null = null;
  private lastCycleCompletedAt: string | null = null;
  private nextCycleAt: string | null = null;
  private lastFetchTimeBySource: Map<string, number> = new Map();

  start() {
    if (this.timer || this.startupTimer) return;
    logger.info(`Starting automated background ingestion scheduler with per-source intervals...`);

    // BUG-011 fix: Track startup timer so stop() can reliably cancel it
    this.startupTimer = setTimeout(() => {
      this.startupTimer = null;
      logger.info('Triggering initial background ingestion cycle on startup for due sources...');
      this.executeCycle();
    }, 1500);

    // Periodic check to inspect individual source fetchIntervalMinutes
    this.timer = setInterval(() => {
      this.executeCycle();
    }, this.checkIntervalMs);

    this.nextCycleAt = new Date(Date.now() + 1500).toISOString();
    this.timer.unref?.();
  }

  // BUG-003 fix: Check whether an individual source is due based on its configured fetchIntervalMinutes
  isSourceDue(sourceId: string, now: number = Date.now()): boolean {
    const source = (SOURCES as any)[sourceId];
    if (!source || !source.enabled) return false;

    const intervalMinutes = source.fetchIntervalMinutes && source.fetchIntervalMinutes > 0
      ? source.fetchIntervalMinutes
      : 15;
    const intervalMs = intervalMinutes * 60 * 1000;

    let lastFetch = this.lastFetchTimeBySource.get(sourceId);
    if (!lastFetch) {
      const health = newsRepository.getSourceHealth(sourceId)[0];
      if (health?.lastFetch) {
        const parsed = new Date(health.lastFetch).getTime();
        if (!isNaN(parsed)) {
          lastFetch = parsed;
          this.lastFetchTimeBySource.set(sourceId, parsed);
        }
      }
    }

    if (!lastFetch) {
      return true; // Never fetched -> due immediately
    }

    return (now - lastFetch) >= intervalMs;
  }

  getDueSources(now: number = Date.now()): string[] {
    const due: string[] = [];
    for (const source of Object.values(SOURCES)) {
      if (source && source.enabled && this.isSourceDue(source.id, now)) {
        due.push(source.id);
      }
    }
    return due;
  }

  recordSourceFetch(sourceId: string, timestamp: number = Date.now()) {
    this.lastFetchTimeBySource.set(sourceId, timestamp);
  }

  executeCycle(forceAll: boolean = false) {
    const now = Date.now();
    let dueSources = this.getDueSources(now);

    if (forceAll) {
      dueSources = Object.values(SOURCES).filter(s => s.enabled).map(s => s.id);
    }

    if (dueSources.length === 0) {
      logger.debug('Scheduled tick: no sources currently due for refresh based on fetchIntervalMinutes');
      this.nextCycleAt = new Date(Date.now() + this.checkIntervalMs).toISOString();
      return null;
    }

    this.cycleCount++;
    this.lastCycleStartedAt = new Date().toISOString();
    this.nextCycleAt = new Date(Date.now() + this.checkIntervalMs).toISOString();

    for (const sid of dueSources) {
      this.recordSourceFetch(sid, now);
    }

    logger.info(`Triggering ingestion for ${dueSources.length} due sources (cycle #${this.cycleCount})`);
    const op = ingestionWorker.triggerIngestion(dueSources);

    // Track when this cycle finishes
    const checkCompletion = setInterval(() => {
      const current = ingestionWorker.getOperation(op.operationId);
      if (current && (current.status === 'completed' || current.status === 'failed')) {
        clearInterval(checkCompletion);
        this.lastCycleCompletedAt = new Date().toISOString();
        logger.info(`Scheduled cycle #${this.cycleCount} finished (${current.status}) with ${current.itemsInserted} new articles ingested`);
      }
    }, 2000);
    checkCompletion.unref?.();

    return op;
  }

  // BUG-011 fix: Clear both interval timer and initial startup timer
  stop() {
    if (this.startupTimer) {
      clearTimeout(this.startupTimer);
      this.startupTimer = null;
    }
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      this.nextCycleAt = null;
      logger.info('Background ingestion scheduler stopped');
    }
  }

  isRunning(): boolean {
    return this.timer !== null || this.startupTimer !== null;
  }

  getIntervalMinutes(): number {
    return Math.round(this.checkIntervalMs / 60000);
  }

  getStatus(): {
    isRunning: boolean;
    intervalMinutes: number;
    cycleCount: number;
    lastCycleStartedAt: string | null;
    lastCycleCompletedAt: string | null;
    nextCycleAt: string | null;
    activeWorkerOperation: IngestionOperation | null;
  } {
    return {
      isRunning: this.isRunning(),
      intervalMinutes: this.getIntervalMinutes(),
      cycleCount: this.cycleCount,
      lastCycleStartedAt: this.lastCycleStartedAt,
      lastCycleCompletedAt: this.lastCycleCompletedAt,
      nextCycleAt: this.nextCycleAt,
      activeWorkerOperation: ingestionWorker.getLatestOperation()
    };
  }
}

export const scheduler = new Scheduler();
