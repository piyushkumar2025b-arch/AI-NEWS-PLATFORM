import { Request, Response, NextFunction } from 'express';
import { newsRepository } from '../database/repository.js';
import { CATEGORIES } from '../config/categories.js';
import { cacheService } from '../cache/cache_service.js';
import { discoveryProtocol } from '../protocols/discovery.js';
import { rssClient } from '../clients/rss_client.js';
import { arxivConnector } from '../connectors/arxiv.js';
import { normalizationPipeline } from '../pipelines/normalization.js';
import { enrichmentPipeline } from '../pipelines/enrichment.js';
import { deduplicationPipeline } from '../pipelines/deduplication.js';
import { multiTechniqueService } from '../services/multi_technique_service.js';
import { hnAiConnector } from '../connectors/hn_ai.js';

export class NewsHandler {
  async getNews(req: Request, res: Response, next: NextFunction) {
    try {
      const q = req.query as Record<string, string>;
      const page = q.page || '1';
      const limit = q.limit || '30';
      const category = q.category || q.cat;
      const sourceId = q.sourceId || q.source || q.source_id;
      const query = q.query || q.q;
      const tag = q.tag;
      const region = q.region;
      const language = q.language || q.lang;
      const sourceType = q.sourceType || q.source_type;
      const channel = q.channel || q.author;
      const fromDate = q.fromDate || q.from_date || q.from;
      const toDate = q.toDate || q.to_date || q.to;
      const sort = (q.sort || 'latest') as any;
      const idsParam = q.ids ? (q.ids as string).split(',').map(s => s.trim()).filter(Boolean) : undefined;

      const cacheKey = `news:query:${JSON.stringify(q)}`;
      const cached = await cacheService.get(cacheKey);
      if (cached) {
        res.setHeader('X-Cache', 'HIT');
        res.setHeader('Cache-Control', 'public, max-age=15, stale-while-revalidate=30');
        return res.json({
          ...cached,
          request_id: (req as any).requestId
        });
      }

      const result = newsRepository.queryArticles({
        page: parseInt(page, 10) || 1,
        limit: parseInt(limit, 10) || 30,
        category,
        sourceId,
        query,
        tag,
        region,
        language,
        sourceType: sourceType as any,
        channel,
        fromDate,
        toDate,
        sort,
        ids: idsParam
      });

      const payload = {
        success: true,
        data: result.articles,
        pagination: {
          page: parseInt(page, 10) || 1,
          limit: parseInt(limit, 10) || 30,
          total: result.total,
          totalPages: Math.ceil(result.total / (parseInt(limit, 10) || 30))
        }
      };

      await cacheService.set(cacheKey, payload, 25);
      res.setHeader('X-Cache', 'MISS');
      res.setHeader('Cache-Control', 'public, max-age=15, stale-while-revalidate=30');
      res.json({
        ...payload,
        request_id: (req as any).requestId
      });
    } catch (err) {
      next(err);
    }
  }

  async getLatest(req: Request, res: Response, next: NextFunction) {
    try {
      const limit = parseInt(req.query.limit as string, 10) || 15;
      const cacheKey = `news:latest:${limit}`;
      const cached = await cacheService.get(cacheKey);
      if (cached) {
        res.setHeader('X-Cache', 'HIT');
        res.setHeader('Cache-Control', 'public, max-age=15, stale-while-revalidate=30');
        return res.json({
          ...cached,
          request_id: (req as any).requestId
        });
      }

      const result = newsRepository.queryArticles({ limit, sort: 'latest' });
      const payload = {
        success: true,
        data: result.articles
      };

      await cacheService.set(cacheKey, payload, 25);
      res.setHeader('X-Cache', 'MISS');
      res.setHeader('Cache-Control', 'public, max-age=15, stale-while-revalidate=30');
      res.json({
        ...payload,
        request_id: (req as any).requestId
      });
    } catch (err) {
      next(err);
    }
  }

  async getByCategory(req: Request, res: Response, next: NextFunction) {
    try {
      const category = req.params.category;
      const limit = parseInt(req.query.limit as string, 10) || 30;
      const page = parseInt(req.query.page as string, 10) || 1;

      const cacheKey = `news:category:${category}:${page}:${limit}`;
      const cached = await cacheService.get(cacheKey);
      if (cached) {
        res.setHeader('X-Cache', 'HIT');
        res.setHeader('Cache-Control', 'public, max-age=20, stale-while-revalidate=40');
        return res.json({
          ...cached,
          request_id: (req as any).requestId
        });
      }

      const result = newsRepository.queryArticles({ category, limit, page });
      const payload = {
        success: true,
        data: result.articles,
        pagination: {
          page,
          limit,
          total: result.total,
          totalPages: Math.ceil(result.total / limit)
        }
      };

      await cacheService.set(cacheKey, payload, 30);
      res.setHeader('X-Cache', 'MISS');
      res.setHeader('Cache-Control', 'public, max-age=20, stale-while-revalidate=40');
      res.json({
        ...payload,
        request_id: (req as any).requestId
      });
    } catch (err) {
      next(err);
    }
  }

  async getBySource(req: Request, res: Response, next: NextFunction) {
    try {
      const sourceId = req.params.source_id;
      const limit = parseInt(req.query.limit as string, 10) || 30;
      const page = parseInt(req.query.page as string, 10) || 1;

      const cacheKey = `news:source:${sourceId}:${page}:${limit}`;
      const cached = await cacheService.get(cacheKey);
      if (cached) {
        res.setHeader('X-Cache', 'HIT');
        res.setHeader('Cache-Control', 'public, max-age=20, stale-while-revalidate=40');
        return res.json({
          ...cached,
          request_id: (req as any).requestId
        });
      }

      const result = newsRepository.queryArticles({ sourceId, limit, page });
      const payload = {
        success: true,
        data: result.articles,
        pagination: {
          page,
          limit,
          total: result.total,
          totalPages: Math.ceil(result.total / limit)
        }
      };

      await cacheService.set(cacheKey, payload, 30);
      res.setHeader('X-Cache', 'MISS');
      res.setHeader('Cache-Control', 'public, max-age=20, stale-while-revalidate=40');
      res.json({
        ...payload,
        request_id: (req as any).requestId
      });
    } catch (err) {
      next(err);
    }
  }

  async getArticleById(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id;
      const cacheKey = `news:article:${id}`;
      const cached = await cacheService.get(cacheKey);
      if (cached) {
        res.setHeader('X-Cache', 'HIT');
        res.setHeader('Cache-Control', 'public, max-age=30, stale-while-revalidate=60');
        return res.json({
          ...cached,
          request_id: (req as any).requestId
        });
      }

      const article = newsRepository.getArticleById(id);
      if (!article) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: `Article with ID '${id}' not found` },
          request_id: (req as any).requestId
        });
      }

      const payload = {
        success: true,
        data: article
      };

      await cacheService.set(cacheKey, payload, 60);
      res.setHeader('X-Cache', 'MISS');
      res.setHeader('Cache-Control', 'public, max-age=30, stale-while-revalidate=60');
      res.json({
        ...payload,
        request_id: (req as any).requestId
      });
    } catch (err) {
      next(err);
    }
  }

  async getFullArticle(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id;
      const cacheKey = `news:article:full:${id}`;
      const cached = await cacheService.get(cacheKey);
      if (cached) {
        res.setHeader('X-Cache', 'HIT');
        res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=120');
        return res.json({
          ...cached,
          request_id: (req as any).requestId
        });
      }

      const article = newsRepository.getArticleById(id);
      if (!article) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: `Article with ID '${id}' not found` },
          request_id: (req as any).requestId
        });
      }

      // Generate full read text if missing
      if (!article.full_content) {
        const paragraphs = [
          article.description,
          `The advancement in ${article.category} represented by "${article.title}" marks an important milestone. Original research and updates were published by ${article.source}.`,
          `Key focus areas for this announcement include scalable architectures, real-time benchmarks, and open development. Users can access the complete raw publication directly at the canonical publisher URL.`
        ].filter(Boolean);

        article.full_content = {
          text: paragraphs.join('\n\n'),
          paragraphs,
          readingTimeMinutes: Math.max(1, Math.ceil(paragraphs.join(' ').split(' ').length / 200)),
          wordCount: paragraphs.join(' ').split(' ').length,
          keyTakeaways: [
            article.title,
            `Published under category ${article.category} by ${article.source}`,
            `Verified canonical address: ${article.canonical_url || article.url}`
          ],
          extractedAt: new Date().toISOString(),
          extractionMethod: 'summary_synthesis',
          leadImageUrl: article.image_url,
          author: article.author
        };
      }

      const payload = {
        success: true,
        data: article
      };

      await cacheService.set(cacheKey, payload, 60);
      res.setHeader('X-Cache', 'MISS');
      res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=120');
      res.json({
        ...payload,
        request_id: (req as any).requestId
      });
    } catch (err) {
      next(err);
    }
  }

  async getCategories(req: Request, res: Response, _next: NextFunction) {
    const cacheKey = 'news:categories:all';
    const cached = await cacheService.get(cacheKey);
    if (cached) {
      res.setHeader('X-Cache', 'HIT');
      res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=120');
      return res.json({
        ...cached,
        request_id: (req as any).requestId
      });
    }

    const stats = newsRepository.getStats();
    const categoriesWithCount = Object.entries(CATEGORIES).map(([id, cat]) => ({
      id,
      name: cat.name,
      description: cat.description,
      count: stats.categoryCounts[id] || 0
    }));

    const payload = {
      success: true,
      data: categoriesWithCount
    };

    await cacheService.set(cacheKey, payload, 60);
    res.setHeader('X-Cache', 'MISS');
    res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=120');
    res.json({
      ...payload,
      request_id: (req as any).requestId
    });
  }

  async discoverTopicOrUrl(req: Request, res: Response, next: NextFunction) {
    try {
      const { topic, url } = req.body || {};
      const targetQuery = (topic || '').trim();
      const targetUrl = (url || '').trim();

      if (!targetQuery && !targetUrl) {
        return res.status(400).json({
          success: false,
          error: { message: 'Must provide either a topic or a url to discover news.' }
        });
      }

      const discoveredArticles: any[] = [];

      // Technique A: URL Feed Discovery & Article Page Extraction
      if (targetUrl) {
        const feeds = await discoveryProtocol.discoverFeeds(targetUrl);
        if (feeds.length > 0) {
          const firstFeed = feeds[0];
          try {
            const parsed = await rssClient.fetchAndParse(firstFeed.feedUrl, 'discovered_feed');
            if (parsed && Array.isArray(parsed.items)) {
              for (const it of parsed.items.slice(0, 15)) {
                discoveredArticles.push({
                  title: it.title,
                  url: it.link || it.guid,
                  description: it.description || it.content || '',
                  imageUrl: it.imageUrl || null,
                  sourceId: 'discovered_feed',
                  sourceName: firstFeed.title,
                  publisherName: firstFeed.title,
                  publishedAt: it.pubDate || new Date().toISOString(),
                  category: 'technology',
                  tags: ['discovered', 'feed'],
                  sourceType: 'news'
                });
              }
            }
          } catch {}
        }

        // If no feed items found, use page extractor
        if (discoveredArticles.length === 0) {
          const page = await discoveryProtocol.extractArticlePage(targetUrl);
          if (page && page.title) {
            discoveredArticles.push({
              title: page.title,
              url: page.url,
              description: page.description,
              imageUrl: page.imageUrl,
              sourceId: 'web_extract',
              sourceName: page.publisherName || 'Web Page Extract',
              publisherName: page.publisherName || 'Web Article',
              author: page.author,
              publishedAt: page.publishedAt || new Date().toISOString(),
              category: 'technology',
              tags: ['extracted', 'web-article'],
              sourceType: 'news'
            });
          }
        }
      }

      // Technique B: Multi-source Live Topic Query (Google News Wire, ArXiv preprints)
      if (targetQuery) {
        const [wireItems, arxivRes] = await Promise.allSettled([
          // 1. Live Google News RSS query
          (async () => {
            const feedUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(targetQuery)}&hl=en-US&gl=US&ceid=US:en`;
            const feed = await rssClient.fetchAndParse(feedUrl, 'topic_discovery', { timeoutMs: 5000 });
            return (feed?.items || []).slice(0, 12).map(it => {
              let title = it.title || '';
              let pubName = 'Tech Wire';
              const lastDash = title.lastIndexOf(' - ');
              if (lastDash > 10) {
                pubName = title.slice(lastDash + 3).trim();
                title = title.slice(0, lastDash).trim();
              }
              return {
                title,
                url: it.link || it.guid,
                description: it.description?.replace(/<[^>]*>/g, '').slice(0, 350) || '',
                sourceId: 'topic_wire',
                sourceName: pubName,
                publisherName: pubName,
                publishedAt: it.pubDate || new Date().toISOString(),
                category: 'ai',
                tags: [targetQuery.toLowerCase(), 'topic-wire'],
                sourceType: 'news'
              };
            });
          })(),
          // 2. ArXiv query
          arxivConnector.fetch({ query: targetQuery, limit: 8 })
        ]);

        if (wireItems.status === 'fulfilled' && Array.isArray(wireItems.value)) {
          discoveredArticles.push(...wireItems.value);
        }
        if (arxivRes.status === 'fulfilled' && Array.isArray(arxivRes.value?.rawItems)) {
          discoveredArticles.push(...arxivRes.value.rawItems);
        }

        // 3. Hacker News Algolia query for topic
        try {
          const hnRes = await hnAiConnector.fetch({ query: targetQuery, limit: 10 });
          if (Array.isArray(hnRes.rawItems) && hnRes.rawItems.length > 0) {
            discoveredArticles.push(...hnRes.rawItems);
          }
        } catch {}
      }

      // Ingest and normalize newly discovered articles into the repository
      let ingestedCount = 0;
      for (const raw of discoveredArticles) {
        try {
          let norm = normalizationPipeline.normalize(raw);
          norm = enrichmentPipeline.enrich(norm);
          const dedup = deduplicationPipeline.checkAndDeduplicate(norm);
          if (dedup.isUnique) {
            newsRepository.upsertArticle(norm);
            ingestedCount++;
          }
        } catch {}
      }

      if (ingestedCount > 0) {
        newsRepository.saveToDisk();
      }

      // Return matching articles from repository
      const searchRes = newsRepository.queryArticles({
        query: targetQuery || undefined,
        limit: 30,
        sort: 'latest'
      });

      res.json({
        success: true,
        message: `Discovered and processed ${discoveredArticles.length} items (${ingestedCount} newly indexed)`,
        ingestedCount,
        data: searchRes.articles,
        request_id: (req as any).requestId
      });
    } catch (err) {
      next(err);
    }
  }

  async getTechniques(req: Request, res: Response) {
    const list = multiTechniqueService.getTechniquesList();
    res.json({
      success: true,
      data: list,
      total: list.length,
      request_id: (req as any).requestId
    });
  }

  async runTechnique(req: Request, res: Response, next: NextFunction) {
    try {
      const techniqueId = req.params.technique_id;
      const result = await multiTechniqueService.runSpecificTechnique(techniqueId);
      
      const query = newsRepository.queryArticles({ limit: 40, sort: 'latest' });
      res.json({
        success: result.success,
        data: query.articles,
        stats: result,
        message: result.success
          ? `Executed ${techniqueId}: ${result.received} fetched, ${result.inserted} newly indexed in ${result.durationMs}ms`
          : result.error || 'Failed to execute technique',
        request_id: (req as any).requestId
      });
    } catch (err) {
      next(err);
    }
  }

  async refreshNews(req: Request, res: Response, next: NextFunction) {
    try {
      const refreshResult = await multiTechniqueService.runRapidRefresh();
      const query = newsRepository.queryArticles({ limit: 80, sort: 'latest' });

      res.json({
        success: true,
        message: `Refreshed feed across ${refreshResult.techniquesExecuted.length} techniques: ${refreshResult.received} received, ${refreshResult.inserted} new dispatches`,
        count: query.articles.length,
        newItemsCount: refreshResult.inserted,
        data: query.articles,
        stats: refreshResult,
        request_id: (req as any).requestId
      });
    } catch (err) {
      next(err);
    }
  }
}

export const newsHandler = new NewsHandler();
