import { Request, Response } from 'express';
import { circuitBreakers } from '../resilience/circuit_breaker.js';
import { newsRepository } from '../database/repository.js';

export class ResilienceHandler {
  getMetrics(_req: Request, res: Response) {
    const stats = newsRepository.getStats();
    res.json({
      success: true,
      data: {
        totalArticles: stats.totalArticles,
        activeSources: stats.activeSources,
        healthySources: stats.healthySources,
        uptimeSeconds: Math.round(process.uptime()),
        memoryUsage: process.memoryUsage()
      }
    });
  }

  getCircuitBreakers(_req: Request, res: Response) {
    const all = circuitBreakers.getAll();
    res.json({
      success: true,
      data: all.map(cb => ({
        name: cb.name,
        state: cb.getState()
      }))
    });
  }

  resetCircuit(req: Request, res: Response) {
    const name = req.params.name;
    const ok = circuitBreakers.reset(name);
    res.json({ success: ok, message: ok ? `Circuit ${name} reset` : `Circuit ${name} not found` });
  }

  livenessProbe(_req: Request, res: Response) {
    res.status(200).json({ status: 'live', timestamp: new Date().toISOString() });
  }

  readinessProbe(_req: Request, res: Response) {
    try {
      const stats = newsRepository.getStats();
      const isReady = stats.totalSources > 0;
      if (!isReady) {
        return res.status(503).json({
          status: 'not_ready',
          reason: 'Source repository not initialized',
          timestamp: new Date().toISOString()
        });
      }
      res.status(200).json({
        status: 'ready',
        totalArticles: stats.totalArticles,
        activeSources: stats.activeSources,
        healthySources: stats.healthySources,
        timestamp: new Date().toISOString()
      });
    } catch (err: any) {
      res.status(503).json({
        status: 'unhealthy',
        error: err.message,
        timestamp: new Date().toISOString()
      });
    }
  }
}

export const resilienceHandler = new ResilienceHandler();
