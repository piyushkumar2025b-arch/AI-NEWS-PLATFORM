import { Request, Response, NextFunction } from 'express';
import { videoSearchService } from '../services/video_search_service.js';
import { newsRepository } from '../database/repository.js';

export class VideoHandler {
  async getVideos(req: Request, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string, 10) || 1;
      const limit = parseInt(req.query.limit as string, 10) || 20;
      const channel = (req.query.channel as string) || undefined;
      const query = (req.query.search as string) || (req.query.query as string) || (req.query.q as string) || undefined;
      const sort = (req.query.sort as string) || undefined;

      const result = newsRepository.queryArticles({
        sourceType: 'video',
        channel,
        query,
        sort,
        page,
        limit
      });

      res.json({
        success: true,
        data: result.articles,
        pagination: {
          page,
          limit,
          total: result.total,
          totalPages: Math.ceil(result.total / limit)
        },
        request_id: (req as any).requestId
      });
    } catch (err) {
      next(err);
    }
  }

  async searchLiveVideos(req: Request, res: Response, next: NextFunction) {
    try {
      const q = (req.query.q as string) || 'AI breakthroughs';
      const limit = parseInt(req.query.limit as string, 10) || 15;
      const videos = await videoSearchService.searchVideos(q, limit);
      res.json({
        success: true,
        data: videos,
        request_id: (req as any).requestId
      });
    } catch (err) {
      next(err);
    }
  }

  async getChannels(req: Request, res: Response, _next: NextFunction) {
    const channels = videoSearchService.getChannels();
    res.json({
      success: true,
      data: channels,
      request_id: (req as any).requestId
    });
  }
}

export const videoHandler = new VideoHandler();
