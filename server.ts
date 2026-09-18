import express from 'express';
import path from 'path';
import compression from 'compression';
import { createServer as createViteServer } from 'vite';
import { settings } from './src/server/config/settings.js';
import { Logger } from './src/server/config/logging.js';
import { apiRouter } from './src/server/api/router.js';
import {
  requestIdMiddleware,
  requestLoggerMiddleware,
  corsMiddleware,
  rateLimitMiddleware
} from './src/server/api/middleware.js';
import { errorHandler } from './src/server/errors/handlers.js';
import { scheduler } from './src/server/workers/scheduler.js';
import { newsRepository } from './src/server/database/repository.js';
import { ingestionWorker } from './src/server/workers/ingestion_worker.js';
import { videoSearchService } from './src/server/services/video_search_service.js';

const logger = new Logger('Server');

// Ensure live API content is fetched if the store is empty
async function ensureLiveApiData() {
  const stats = newsRepository.getStats();
  if (stats.totalArticles === 0) {
    logger.info('No articles found in store, initiating live API ingestion...');
    try {
      ingestionWorker.triggerIngestion();
    } catch (err: any) {
      logger.warn(`Initial live ingestion run error: ${err.message}`);
    }
  }
}

async function startServer() {
  const app = express();
  const PORT = settings.port || 3000;
  const HOST = settings.host || '0.0.0.0';

  // Middlewares
  app.use(requestIdMiddleware);
  app.use(requestLoggerMiddleware);
  app.use(corsMiddleware);
  app.use(compression({
    threshold: 512,
    level: 6
  }));
  app.use(rateLimitMiddleware(240));
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Mount API router
  app.use('/api/v1', apiRouter);
  app.use('/api', apiRouter); // Alias for convenience

  // Global Error Handler for API
  app.use(errorHandler);

  // Vite middleware for development vs static build in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Ensure live API content exists
  await ensureLiveApiData();

  // Ingest initial real AI videos across YouTube, DailyMotion and academic lectures
  videoSearchService.searchAndIngestVideos('').catch(err => {
    logger.warn(`Initial real video ingestion note: ${err.message}`);
  });

  // Start background ingestion scheduler
  scheduler.start();

  const server = app.listen(PORT, HOST, () => {
    logger.info(`AI & Tech News Ingestion Platform server running on http://${HOST}:${PORT}`);
  });

  // Graceful Shutdown
  const shutdown = () => {
    logger.info('Shutting down gracefully...');
    scheduler.stop();
    newsRepository.flushSave();
    server.close(() => {
      logger.info('Server stopped. Goodbye!');
      process.exit(0);
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

startServer().catch(err => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
