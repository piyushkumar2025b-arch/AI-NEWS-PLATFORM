import { validationPipeline } from './validation.js';
import { normalizationPipeline } from './normalization.js';
import { enrichmentPipeline } from './enrichment.js';
import { deduplicationPipeline } from './deduplication.js';
import { newsRepository } from '../database/repository.js';
import { Logger } from '../config/logging.js';

const logger = new Logger('IngestionOrchestrator');

export interface BatchProcessingResult {
  sourceId: string;
  sourceName: string;
  received: number;
  valid: number;
  inserted: number;
  duplicates: number;
  durationMs: number;
}

export class IngestionOrchestrator {
  async processSourceBatch(
    sourceId: string,
    sourceName: string,
    rawItems: any[],
    maxItems: number = 50
  ): Promise<BatchProcessingResult> {
    const startTime = Date.now();
    const itemsToProcess = rawItems.slice(0, maxItems);

    let insertedCount = 0;
    let duplicateCount = 0;
    let validCount = 0;

    for (const raw of itemsToProcess) {
      const itemWithSource = {
        ...raw,
        sourceId: raw.sourceId || raw.source_id || sourceId,
        sourceName: raw.sourceName || raw.source || sourceName
      };

      const valRes = validationPipeline.validate(itemWithSource);
      if (!valRes.valid) {
        continue;
      }
      validCount++;

      const normalized = normalizationPipeline.normalize(itemWithSource);
      const enriched = enrichmentPipeline.enrich(normalized);
      const dedup = deduplicationPipeline.checkAndDeduplicate(enriched);

      const upsertRes = newsRepository.upsertArticle(enriched);
      if (upsertRes.inserted) {
        insertedCount++;
      } else {
        duplicateCount++;
      }
    }

    const durationMs = Date.now() - startTime;

    newsRepository.recordFetchRun({
      sourceId,
      sourceName,
      status: 'success',
      startedAt: new Date(startTime).toISOString(),
      completedAt: new Date().toISOString(),
      durationMs,
      itemsReceived: itemsToProcess.length,
      itemsInserted: insertedCount,
      itemsDuplicate: duplicateCount,
      error: null
    });

    logger.info(`[${sourceName}] Batch complete: ${insertedCount} inserted, ${duplicateCount} duplicates in ${durationMs}ms`);

    return {
      sourceId,
      sourceName,
      received: itemsToProcess.length,
      valid: validCount,
      inserted: insertedCount,
      duplicates: duplicateCount,
      durationMs
    };
  }
}

export const ingestionOrchestrator = new IngestionOrchestrator();
