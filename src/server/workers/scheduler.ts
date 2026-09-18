import { Logger } from '../config/logging.js';
import { ingestionWorker } from './ingestion_worker.js';

const logger = new Logger('Scheduler');

export class Scheduler {
  private timer: NodeJS.Timeout | null = null;
  private intervalMs = 15 * 60 * 1000; // 15 minutes

  start() {
    if (this.timer) return;
    logger.info('Starting automated background ingestion scheduler (every 15m)...');

    // Run first pass after short initial delay to populate fresh real articles immediately
    setTimeout(() => {
      logger.info('Triggering initial background ingestion cycle on startup...');
      ingestionWorker.triggerIngestion();
    }, 1500);

    this.timer = setInterval(() => {
      logger.info('Scheduled ingestion cycle triggered');
      ingestionWorker.triggerIngestion();
    }, this.intervalMs);

    this.timer.unref?.();
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      logger.info('Background ingestion scheduler stopped');
    }
  }
}

export const scheduler = new Scheduler();
