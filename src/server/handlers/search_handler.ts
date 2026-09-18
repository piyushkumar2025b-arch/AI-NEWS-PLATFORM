import { Request, Response, NextFunction } from 'express';
import { searchService } from '../services/search_service.js';

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
        toDate
      } = req.query as Record<string, string>;

      const results = await searchService.search({
        q,
        page: parseInt(page, 10) || 1,
        limit: parseInt(limit, 10) || 30,
        category,
        sourceId,
        fromDate,
        toDate
      });

      res.json({
        success: true,
        data: results.articles,
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
