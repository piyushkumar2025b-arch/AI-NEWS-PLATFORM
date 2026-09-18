import { Request, Response, NextFunction } from 'express';
import { feedService } from '../services/feed_service.js';

export class FeedHandler {
  async getRssFeed(req: Request, res: Response, _next: NextFunction) {
    const limit = parseInt(req.query.limit as string, 10) || 50;
    const rss = feedService.generateRss({ limit });
    res.setHeader('Content-Type', 'application/rss+xml; charset=utf-8');
    res.send(rss);
  }

  async getAtomFeed(req: Request, res: Response, _next: NextFunction) {
    const limit = parseInt(req.query.limit as string, 10) || 50;
    const atom = feedService.generateAtom({ limit });
    res.setHeader('Content-Type', 'application/atom+xml; charset=utf-8');
    res.send(atom);
  }

  async getJsonFeed(req: Request, res: Response, _next: NextFunction) {
    const limit = parseInt(req.query.limit as string, 10) || 50;
    const jsonFeed = feedService.generateJsonFeed({ limit });
    res.setHeader('Content-Type', 'application/feed+json; charset=utf-8');
    res.json(jsonFeed);
  }

  async exportCsv(req: Request, res: Response, _next: NextFunction) {
    const limit = parseInt(req.query.limit as string, 10) || 50;
    const search = (req.query.search || req.query.query || '') as string;
    const csv = feedService.generateCsv({ limit, search });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="ai-news-export.csv"');
    res.send(csv);
  }
}

export const feedHandler = new FeedHandler();
