import { Article } from '../models/article.js';
import { newsRepository } from '../database/repository.js';

export interface DeduplicationResult {
  isUnique: boolean;
  matchedReason?: 'id' | 'canonical_url' | 'url' | 'external_id' | 'title_fingerprint' | 'similarity';
  matchedArticleId?: string;
}

export class DeduplicationPipeline {
  checkAndDeduplicate(art: Article): DeduplicationResult {
    if (!art) return { isUnique: false };

    // 1. Direct ID check
    const byId = newsRepository.getArticleById(art.id);
    if (byId) {
      return { isUnique: false, matchedReason: 'id', matchedArticleId: byId.id };
    }

    // 2. Canonical URL check
    if (art.canonical_url) {
      const byCanonical = newsRepository.findByCanonicalUrl(art.canonical_url);
      if (byCanonical) {
        return { isUnique: false, matchedReason: 'canonical_url', matchedArticleId: byCanonical.id };
      }
    }

    // 3. Normalized URL check
    if (art.url) {
      const byUrl = newsRepository.findByNormalizedUrl(art.url);
      if (byUrl) {
        return { isUnique: false, matchedReason: 'url', matchedArticleId: byUrl.id };
      }
    }

    // 4. External ID check
    if (art.external_id) {
      const byExt = newsRepository.findByExternalId(art.source_id, art.external_id);
      if (byExt) {
        return { isUnique: false, matchedReason: 'external_id', matchedArticleId: byExt.id };
      }
    }

    // 5. Title fingerprint
    if (art.content_hash) {
      const byFp = newsRepository.findByTitleFingerprint(art.content_hash);
      if (byFp) {
        return { isUnique: false, matchedReason: 'title_fingerprint', matchedArticleId: byFp.id };
      }
    }

    // 6. Fuzzy similarity
    if (art.title) {
      const similar = newsRepository.findSimilarArticle(art.title, 0.85);
      if (similar) {
        return { isUnique: false, matchedReason: 'similarity', matchedArticleId: similar.id };
      }
    }

    return { isUnique: true };
  }
}

export const deduplicationPipeline = new DeduplicationPipeline();
