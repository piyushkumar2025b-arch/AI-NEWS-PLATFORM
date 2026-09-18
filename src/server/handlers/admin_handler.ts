import { Request, Response, NextFunction } from 'express';
import { newsRepository } from '../database/repository.js';
import { sourceService } from '../services/source_service.js';
import { ingestionWorker } from '../workers/ingestion_worker.js';

export class AdminHandler {
  async triggerSourceFetch(req: Request, res: Response, _next: NextFunction) {
    const sourceId = req.params.source_id;
    try {
      const result = await ingestionWorker.runSingleSource(sourceId);
      res.json({
        success: true,
        message: `Fetched ${result.received} items (+${result.inserted} new) for source '${sourceId}'`,
        sourceId,
        status: 'completed',
        data: result,
        request_id: (req as any).requestId
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: { message: err.message || `Failed to fetch source '${sourceId}'` },
        request_id: (req as any).requestId
      });
    }
  }


  async enableSource(req: Request, res: Response, _next: NextFunction) {
    const sourceId = req.params.source_id;
    const s = sourceService.getSourceById(sourceId);
    if (!s) {
      return res.status(404).json({ success: false, error: { message: 'Source not found' } });
    }
    newsRepository.setSourceEnabled(sourceId, true);
    res.json({ success: true, message: `Source ${sourceId} enabled`, request_id: (req as any).requestId });
  }

  async disableSource(req: Request, res: Response, _next: NextFunction) {
    const sourceId = req.params.source_id;
    const s = sourceService.getSourceById(sourceId);
    if (!s) {
      return res.status(404).json({ success: false, error: { message: 'Source not found' } });
    }
    newsRepository.setSourceEnabled(sourceId, false);
    res.json({ success: true, message: `Source ${sourceId} disabled`, request_id: (req as any).requestId });
  }

  async getFetchRuns(req: Request, res: Response, _next: NextFunction) {
    const limit = parseInt(req.query.limit as string, 10) || 50;
    const runs = newsRepository.getFetchRuns(limit);
    res.json({ success: true, data: runs, request_id: (req as any).requestId });
  }

  async getErrors(req: Request, res: Response, _next: NextFunction) {
    const runs = newsRepository.getFetchRuns(100);
    const errors = runs.filter(r => r.error !== null || r.status === 'failed');
    res.json({ success: true, data: errors, request_id: (req as any).requestId });
  }

  async getSourceHealth(req: Request, res: Response, _next: NextFunction) {
    const health = newsRepository.getSourceHealth();
    res.json({ success: true, data: health, request_id: (req as any).requestId });
  }
}

export const adminHandler = new AdminHandler();
