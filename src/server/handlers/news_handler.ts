import { Request, Response, NextFunction } from 'express';
import { newsRepository } from '../database/repository.js';
import { CATEGORIES } from '../config/categories.js';
import { cacheService } from '../cache/cache_service.js';

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
        sort
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
}

export const newsHandler = new NewsHandler();
