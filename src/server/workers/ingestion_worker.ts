import { Logger } from '../config/logging.js';
import { SOURCES } from '../config/sources.js';
import { newsRepository } from '../database/repository.js';
import { getAllConnectors, getConnector } from '../connectors/index.js';
import { ingestionOrchestrator, BatchProcessingResult } from '../pipelines/ingestion.js';
import { cacheService } from '../cache/cache_service.js';

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

async function fetchFromConnector(connector: any, options: { limit?: number; signal?: AbortSignal } = { limit: 15 }): Promise<any[]> {
  const abortController = new AbortController();
  const onCallerAbort = () => abortController.abort(options.signal?.reason);
  if (options.signal) {
    if (options.signal.aborted) {
      abortController.abort(options.signal.reason);
    } else {
      options.signal.addEventListener('abort', onCallerAbort, { once: true });
    }
  }

  const connectorOptions = { ...options, signal: abortController.signal };

  // 7-second safeguard timeout per source to prevent hanging sockets with proper cleanup
  let timer: NodeJS.Timeout | undefined;
  const timeoutPromise = new Promise<any[]>((_, reject) => {
    timer = setTimeout(() => {
      abortController.abort(new Error('Connector fetch timed out after 7s'));
      reject(new Error('Connector fetch timed out after 7s'));
    }, 7000);
    timer.unref?.();
  });

  const fetchPromise = (async () => {
    if (typeof connector.fetch === 'function') {
      const res = await connector.fetch(connectorOptions);
      if (Array.isArray(res)) return res;
      return res?.rawItems || [];
    }
    if (typeof connector.fetchArticles === 'function') {
      const res = await connector.fetchArticles(connectorOptions);
      if (Array.isArray(res)) return res;
      return res?.rawItems || [];
    }
    return [];
  })();

  try {
    return await Promise.race([fetchPromise, timeoutPromise]);
  } finally {
    if (timer) clearTimeout(timer);
    if (options.signal) {
      options.signal.removeEventListener('abort', onCallerAbort);
    }
  }
}

export class IngestionWorker {
  private currentOperation: IngestionOperation | null = null;
  private operations = new Map<string, IngestionOperation>();
  private isRunning = false;

  triggerIngestion(targetSourceIds?: string[]): IngestionOperation {
    if (this.isRunning && this.currentOperation && this.currentOperation.status === 'running') {
      return this.currentOperation;
    }

    const operationId = `op_${Date.now()}`;
    const all = getAllConnectors();
    let activeConnectors = all.filter(c => c.isEnabled());
    if (targetSourceIds && targetSourceIds.length > 0) {
      const targetSet = new Set(targetSourceIds);
      activeConnectors = activeConnectors.filter(c => targetSet.has(c.getSourceId()));
    }

    if (activeConnectors.length === 0) {
      const emptyOp: IngestionOperation = {
        operationId,
        status: 'completed',
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        sourcesProcessed: 0,
        totalSources: 0,
        itemsReceived: 0,
        itemsInserted: 0,
        itemsDuplicate: 0,
        failedSources: 0
      };
      this.currentOperation = emptyOp;
      return emptyOp;
    }

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
    if (this.operations.size >= 50) {
      const oldestKey = this.operations.keys().next().value;
      if (oldestKey) this.operations.delete(oldestKey);
    }
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
            } else {
              newsRepository.recordFetchRun({
                id: `run_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
                sourceId,
                sourceName,
                status: 'success',
                startedAt: new Date().toISOString(),
                completedAt: new Date().toISOString(),
                durationMs: 0,
                itemsReceived: 0,
                itemsInserted: 0,
                itemsDuplicate: 0,
                error: null
              });
            }
          } catch (err: any) {
            op.failedSources++;
            newsRepository.recordFetchRun({
              id: `run_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
              sourceId,
              sourceName,
              status: 'failed',
              startedAt: new Date().toISOString(),
              completedAt: new Date().toISOString(),
              durationMs: 0,
              itemsReceived: 0,
              itemsInserted: 0,
              itemsDuplicate: 0,
              error: err.message || 'Fetch failed'
            });
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
          cacheService.invalidatePrefix('news:').catch(() => {});
          cacheService.invalidatePrefix('search:').catch(() => {});
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

    try {
      const rawItems = await fetchFromConnector(connector, { limit: 30 });
      const result = await ingestionOrchestrator.processSourceBatch(
        connector.getSourceId(),
        connector.getSourceName(),
        rawItems || [],
        30
      );
      if (result.inserted > 0) {
        newsRepository.saveToDisk();
        cacheService.invalidatePrefix('news:').catch(() => {});
        cacheService.invalidatePrefix('search:').catch(() => {});
      }
      return result;
    } catch (err: any) {
      newsRepository.recordFetchRun({
        id: `run_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        sourceId,
        sourceName: connector.getSourceName(),
        status: 'failed',
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        durationMs: 0,
        itemsReceived: 0,
        itemsInserted: 0,
        itemsDuplicate: 0,
        error: err.message || 'Fetch failed'
      });
      throw err;
    }
  }

  getOperation(id: string): IngestionOperation | undefined {
    return this.operations.get(id);
  }

  getLatestOperation(): IngestionOperation | null {
    return this.currentOperation;
  }
}

export const ingestionWorker = new IngestionWorker();

