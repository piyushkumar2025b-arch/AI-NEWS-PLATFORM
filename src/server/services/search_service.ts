import { newsRepository } from '../database/repository.js';
import { cacheService } from '../cache/cache_service.js';
import { githubConnector } from '../connectors/github.js';
import { arxivConnector } from '../connectors/arxiv.js';
import { normalizationPipeline } from '../pipelines/normalization.js';
import { enrichmentPipeline } from '../pipelines/enrichment.js';
import { deduplicationPipeline } from '../pipelines/deduplication.js';
import { Logger } from '../config/logging.js';

const logger = new Logger('SearchService');

class SearchService {
  async search(options: {
    q: string;
    page?: number;
    limit?: number;
    category?: string;
    sourceId?: string;
    fromDate?: string;
    toDate?: string;
  }) {
    const cacheKey = `search:${JSON.stringify(options)}`;
    const cached = await cacheService.get(cacheKey);
    if (cached) {
      return { ...cached, cached: true };
    }

    const res = newsRepository.queryArticles({ ...options, query: options.q });

    // Non-blocking background enrichment if query has few matching items
    if (res.articles.length < 5 && options.q.trim().length >= 2) {
      (async () => {
        try {
          const liveFetches = await Promise.allSettled([
            githubConnector.fetch({ query: options.q.trim(), limit: 10 }),
            arxivConnector.fetch({ query: options.q.trim(), limit: 10 })
          ]);
          let addedCount = 0;
          for (const r of liveFetches) {
            if (r.status === 'fulfilled' && r.value.rawItems.length > 0) {
              for (const raw of r.value.rawItems) {
                try {
                  let normalized = normalizationPipeline.normalize(raw);
                  normalized = enrichmentPipeline.enrich(normalized);
                  const dedup = deduplicationPipeline.checkAndDeduplicate(normalized);
                  newsRepository.upsertArticle(dedup.targetArticle);
                  addedCount++;
                } catch {}
              }
            }
          }
          if (addedCount > 0) {
            logger.info(`Background ingest for "${options.q}" added ${addedCount} items.`);
          }
        } catch (err: any) {
          logger.warn(`Background search ingest error: ${err.message}`);
        }
      })().catch(() => {});
    }

    await cacheService.set(cacheKey, res, 45);
    return { ...res, cached: false };
  }
}

export const searchService = new SearchService();
export { SearchService };
