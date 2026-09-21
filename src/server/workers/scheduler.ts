import { Logger } from '../config/logging.js';
import { ingestionWorker, IngestionOperation } from './ingestion_worker.js';

const logger = new Logger('Scheduler');

export class Scheduler {
  private timer: NodeJS.Timeout | null = null;
  private intervalMs = 10 * 60 * 1000; // 10 minutes continuous cycle
  private cycleCount = 0;
  private lastCycleStartedAt: string | null = null;
  private lastCycleCompletedAt: string | null = null;
  private nextCycleAt: string | null = null;

  start() {
    if (this.timer) return;
    logger.info(`Starting automated background ingestion scheduler (every ${this.intervalMs / 60000}m)...`);

    // Run first pass after short initial delay to populate fresh real articles immediately
    setTimeout(() => {
      logger.info('Triggering initial background ingestion cycle on startup...');
      this.executeCycle();
    }, 1500);

    this.timer = setInterval(() => {
      logger.info('Scheduled periodic ingestion cycle triggered across all active sources');
      this.executeCycle();
    }, this.intervalMs);

    this.nextCycleAt = new Date(Date.now() + 1500).toISOString();
    this.timer.unref?.();
  }

  private executeCycle() {
    this.cycleCount++;
    this.lastCycleStartedAt = new Date().toISOString();
    this.nextCycleAt = new Date(Date.now() + this.intervalMs).toISOString();

    const op = ingestionWorker.triggerIngestion();
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
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      this.nextCycleAt = null;
      logger.info('Background ingestion scheduler stopped');
    }
  }

  isRunning(): boolean {
    return this.timer !== null;
  }

  getIntervalMinutes(): number {
    return Math.round(this.intervalMs / 60000);
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
