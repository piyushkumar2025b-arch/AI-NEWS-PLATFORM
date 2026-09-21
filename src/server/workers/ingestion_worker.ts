import { Logger } from '../config/logging.js';
import { SOURCES } from '../config/sources.js';
import { newsRepository } from '../database/repository.js';
import { getAllConnectors, getConnector } from '../connectors/index.js';
import { ingestionOrchestrator, BatchProcessingResult } from '../pipelines/ingestion.js';

const logger = new Logger('IngestionWorker');

export interface IngestionOperation {
  operationId: string;
  status: 'running' | 'completed' | 'failed' | 'idle';
  startedAt: string;
  completedAt?: string;
  sourcesProcessed: number;
  totalSources: number;
  itemsReceived: number;
  itemsInserted: number;
  itemsDuplicate: number;
  failedSources: number;
}

// Priority sources to ingest first for immediate freshness
const PRIORITY_SOURCE_IDS = new Set([
  'venturebeat_ai',
  'theverge_ai',
  'mit_tech_review',
  'arstechnica',
  'wired',
  'arxiv',
  'arxiv_nlp',
  'arxiv_cv',
  'hf_blog',
  'anthropic_ai',
  'deepseek_ai',
  'techcrunch_ai',
  'techmeme',
  'nvidia_blog',
  'google_research',
  'openai_official',
  'last_week_in_ai',
  'the_gradient',
  'latent_space',
  'simonw_ai',
  'marktechpost',
  'hackernoon_ai',
  'hn_ai'
]);

async function fetchFromConnector(connector: any, options: { limit?: number } = { limit: 15 }): Promise<any[]> {
  try {
    const fetchPromise = (async () => {
      if (typeof connector.fetch === 'function') {
        const res = await connector.fetch(options);
        if (Array.isArray(res)) return res;
        return res?.rawItems || [];
      }
      if (typeof connector.fetchArticles === 'function') {
        const res = await connector.fetchArticles(options);
        if (Array.isArray(res)) return res;
        return res?.rawItems || [];
      }
      return [];
    })();

    // 7-second safeguard timeout per source to prevent hanging sockets with proper cleanup
    let timer: NodeJS.Timeout | undefined;
    const timeoutPromise = new Promise<any[]>((resolve) => {
      timer = setTimeout(() => resolve([]), 7000);
      timer.unref?.();
    });

    try {
      return await Promise.race([fetchPromise, timeoutPromise]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  } catch (err: any) {
    logger.warn(`Fetch error for connector '${connector?.getSourceId?.() || 'unknown'}': ${err.message}`);
  }
  return [];
}

export class IngestionWorker {
  private currentOperation: IngestionOperation | null = null;
  private operations = new Map<string, IngestionOperation>();
  private isRunning = false;

  triggerIngestion(): IngestionOperation {
    if (this.isRunning && this.currentOperation && this.currentOperation.status === 'running') {
      return this.currentOperation;
    }

    const operationId = `op_${Date.now()}`;
    const all = getAllConnectors();
    const activeConnectors = all.filter(c => c.isEnabled());

    // Sort priority sources first
    activeConnectors.sort((a, b) => {
      const aPrio = PRIORITY_SOURCE_IDS.has(a.getSourceId()) ? 0 : 1;
      const bPrio = PRIORITY_SOURCE_IDS.has(b.getSourceId()) ? 0 : 1;
      return aPrio - bPrio;
    });

    const op: IngestionOperation = {
      operationId,
      status: 'running',
      startedAt: new Date().toISOString(),
      sourcesProcessed: 0,
      totalSources: activeConnectors.length,
      itemsReceived: 0,
      itemsInserted: 0,
      itemsDuplicate: 0,
      failedSources: 0
    };

    this.currentOperation = op;
    this.operations.set(operationId, op);
    this.isRunning = true;

    // Asynchronously run ingestion in background with controlled concurrency
    (async () => {
      logger.info(`Starting ingestion run ${operationId} for ${activeConnectors.length} active sources`);
      const CONCURRENCY = 12;
      let currentIndex = 0;

      async function worker() {
        while (currentIndex < activeConnectors.length) {
          const idx = currentIndex++;
          const connector = activeConnectors[idx];
          if (!connector) break;

          const sourceId = connector.getSourceId();
          const sourceName = connector.getSourceName();

          try {
            const rawItems = await fetchFromConnector(connector, { limit: 15 });
            if (rawItems && rawItems.length > 0) {
              const batchRes = await ingestionOrchestrator.processSourceBatch(
                sourceId,
                sourceName,
                rawItems,
                15
              );
              op.itemsReceived += batchRes.received;
              op.itemsInserted += batchRes.inserted;
              op.itemsDuplicate += batchRes.duplicates;
            }
          } catch (err: any) {
            op.failedSources++;
            logger.warn(`Source '${sourceId}' ingestion failure: ${err.message}`);
          } finally {
            op.sourcesProcessed++;
          }
        }
      }

      try {
        const workers = Array.from({ length: CONCURRENCY }, () => worker());
        await Promise.all(workers);
        op.status = 'completed';
        op.completedAt = new Date().toISOString();
        if (op.itemsInserted > 0) {
          newsRepository.saveToDisk();
        }
        if (op.failedSources > 0) {
          logger.warn(
            `Ingestion run ${operationId} completed with warnings. Received: ${op.itemsReceived}, Inserted: ${op.itemsInserted}, Existing: ${op.itemsDuplicate}, Unreachable sources: ${op.failedSources}`
          );
        } else {
          logger.info(
            `Ingestion run ${operationId} completed successfully. Received: ${op.itemsReceived}, Inserted: ${op.itemsInserted}, Existing: ${op.itemsDuplicate}, All sources operational`
          );
        }
      } catch (err: any) {
        op.status = 'failed';
        op.completedAt = new Date().toISOString();
        logger.error(`Ingestion run ${operationId} encountered fatal error: ${err.message}`);
      } finally {
        this.isRunning = false;
      }
    })().catch((fatal: any) => {
      this.isRunning = false;
      op.status = 'failed';
      op.completedAt = new Date().toISOString();
      logger.error(`Unhandled worker crash in ingestion run: ${fatal?.message}`);
    });

    return op;
  }

  async runSingleSource(sourceId: string): Promise<BatchProcessingResult> {
    const connector = getConnector(sourceId);
    if (!connector) {
      throw new Error(`Source connector '${sourceId}' not found in registry`);
    }

    const rawItems = await fetchFromConnector(connector, { limit: 30 });
    const result = await ingestionOrchestrator.processSourceBatch(
      connector.getSourceId(),
      connector.getSourceName(),
      rawItems,
      30
    );
    if (result.inserted > 0) {
      newsRepository.saveToDisk();
    }
    return result;
  }

  getOperation(id: string): IngestionOperation | undefined {
    return this.operations.get(id);
  }

  getLatestOperation(): IngestionOperation | null {
    return this.currentOperation;
  }
}

export const ingestionWorker = new IngestionWorker();

