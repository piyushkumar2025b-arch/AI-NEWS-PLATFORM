import { Request, Response, NextFunction } from 'express';
import { searchService } from '../services/search_service.js';
import { projectFeedArticle, generateFeedEtag } from './news_handler.js';

export class SearchHandler {
  async search(req: Request, res: Response, next: NextFunction) {
    try {
      const {
        q = '',
        page = '1',
        limit = '30',
        category,
        sourceId,
        fromDate,
        toDate,
        include_full_content
      } = req.query as Record<string, string>;

      const includeFull = include_full_content === 'true';

      const results = await searchService.search({
        q,
        page: parseInt(page, 10) || 1,
        limit: parseInt(limit, 10) || 30,
        category,
        sourceId,
        fromDate,
        toDate
      });

      const projected = includeFull
        ? results.articles
        : results.articles.map(a => projectFeedArticle(a, false));

      const etag = generateFeedEtag(projected, results.total);
      res.setHeader('ETag', etag);
      res.setHeader('Cache-Control', 'public, max-age=20, stale-while-revalidate=60');

      if (req.headers['if-none-match'] === etag) {
        return res.status(304).end();
      }

      res.json({
        success: true,
        data: projected,
        pagination: {
          page: parseInt(page, 10) || 1,
          limit: parseInt(limit, 10) || 30,
          total: results.total,
          totalPages: Math.ceil(results.total / (parseInt(limit, 10) || 30))
        },
        cached: (results as any).cached || false,
        request_id: (req as any).requestId
      });
    } catch (err) {
      next(err);
    }
  }
}

export const searchHandler = new SearchHandler();
