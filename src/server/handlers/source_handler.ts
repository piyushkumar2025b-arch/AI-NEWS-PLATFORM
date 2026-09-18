import { Request, Response, NextFunction } from 'express';
import { sourceService } from '../services/source_service.js';

export class SourceHandler {
  async getSources(req: Request, res: Response, next: NextFunction) {
    try {
      const sources = sourceService.getSources();
      res.json({
        success: true,
        data: sources,
        request_id: (req as any).requestId
      });
    } catch (err) {
      next(err);
    }
  }

  async getSourceById(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.source_id;
      const source = sourceService.getSourceById(id);
      if (!source) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: `Source '${id}' not found` },
          request_id: (req as any).requestId
        });
      }
      res.json({
        success: true,
        data: source,
        request_id: (req as any).requestId
      });
    } catch (err) {
      next(err);
    }
  }

  async createSource(req: Request, res: Response, next: NextFunction) {
    try {
      const { name, url, category, enabled } = req.body;
      const created = sourceService.addSource({ name, url, category, enabled });
      res.status(201).json({
        success: true,
        data: created,
        message: 'Custom feed source registered successfully',
        request_id: (req as any).requestId
      });
    } catch (err) {
      next(err);
    }
  }

  async toggleSource(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.source_id;
      const toggled = sourceService.toggleSource(id);
      if (!toggled) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: `Source '${id}' not found` },
          request_id: (req as any).requestId
        });
      }
      res.json({
        success: true,
        data: toggled,
        message: `Source '${id}' is now ${toggled.enabled ? 'enabled' : 'disabled'}`,
        request_id: (req as any).requestId
      });
    } catch (err) {
      next(err);
    }
  }
}

export const sourceHandler = new SourceHandler();
