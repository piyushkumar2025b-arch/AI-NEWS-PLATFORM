import { Router } from "express";
import { newsHandler } from "../handlers/news_handler.js";
import { searchHandler } from "../handlers/search_handler.js";
import { sourceHandler } from "../handlers/source_handler.js";
import { healthHandler } from "../handlers/health_handler.js";
import { adminHandler } from "../handlers/admin_handler.js";
import { mediaHandler } from "../handlers/media_handler.js";
import { feedHandler } from "../handlers/feed_handler.js";
import { resilienceHandler } from "../handlers/resilience_handler.js";
import { videoHandler } from "../handlers/video_handler.js";
import { adminAuthMiddleware } from "./middleware.js";
import { ingestionWorker } from "../workers/ingestion_worker.js";

const apiRouter = Router();

// News and Content APIs
apiRouter.get("/news", (req, res, next) => newsHandler.getNews(req, res, next));
apiRouter.get("/news/latest", (req, res, next) => newsHandler.getLatest(req, res, next));
apiRouter.get("/news/category/:category", (req, res, next) => newsHandler.getByCategory(req, res, next));
apiRouter.get("/news/source/:source_id", (req, res, next) => newsHandler.getBySource(req, res, next));
apiRouter.get("/news/:id/full", (req, res, next) => newsHandler.getFullArticle(req, res, next));
apiRouter.get("/news/:id", (req, res, next) => newsHandler.getArticleById(req, res, next));
apiRouter.get("/articles/:id/full", (req, res, next) => newsHandler.getFullArticle(req, res, next));

// Media APIs
apiRouter.get("/media/resolve", (req, res) => mediaHandler.resolveArticleMedia(req, res));
apiRouter.get("/media/proxy", (req, res, next) => mediaHandler.proxyImage(req, res, next));
apiRouter.get("/media/card", (req, res) => mediaHandler.renderCard(req, res));

// Search, Categories and Videos
apiRouter.get("/search", (req, res, next) => searchHandler.search(req, res, next));
apiRouter.get("/categories", (req, res, next) => newsHandler.getCategories(req, res, next));
apiRouter.get("/videos", (req, res, next) => videoHandler.getVideos(req, res, next));
apiRouter.get("/videos/search", (req, res, next) => videoHandler.searchLiveVideos(req, res, next));
apiRouter.get("/videos/channels", (req, res, next) => videoHandler.getChannels(req, res, next));

// Sources APIs
apiRouter.get("/sources", (req, res, next) => sourceHandler.getSources(req, res, next));
apiRouter.post("/sources", adminAuthMiddleware, (req, res, next) => sourceHandler.createSource(req, res, next));
apiRouter.get("/sources/:source_id", (req, res, next) => sourceHandler.getSourceById(req, res, next));
apiRouter.post("/sources/:source_id/toggle", adminAuthMiddleware, (req, res, next) => sourceHandler.toggleSource(req, res, next));
apiRouter.post("/sources/:source_id/fetch", adminAuthMiddleware, (req, res, next) => adminHandler.triggerSourceFetch(req, res, next));

// Ingestion APIs
apiRouter.post("/ingest/all", adminAuthMiddleware, async (req, res, next) => {
  try {
    const op = ingestionWorker.triggerIngestion();
    res.json({
      success: true,
      message: "Triggered asynchronous ingestion cycle for all active connectors",
      operationId: op.operationId,
      status: op.status,
      request_id: (req as any).requestId
    });
  } catch (err) {
    next(err);
  }
});
apiRouter.post("/ingest/source/:source_id", adminAuthMiddleware, async (req, res, next) => {
  try {
    const sourceId = req.params.source_id;
    ingestionWorker.runSingleSource(sourceId).catch(() => {});
    res.json({
      success: true,
      message: `Triggered ingestion cycle for source '${sourceId}'`,
      sourceId,
      status: "running",
      request_id: (req as any).requestId
    });
  } catch (err) {
    next(err);
  }
});
apiRouter.get("/ingest/status/:operation_id?", (req, res) => {
  const opId = req.params.operation_id;
  const op = opId ? ingestionWorker.getOperation(opId) : ingestionWorker.getLatestOperation();
  if (!op) {
    return res.json({ success: true, data: { status: "idle", completed: true } });
  }
  res.json({ success: true, data: op });
});

// Feeds and Export APIs
apiRouter.get("/feed/rss", (req, res, next) => feedHandler.getRssFeed(req, res, next));
apiRouter.get("/feed/atom", (req, res, next) => feedHandler.getAtomFeed(req, res, next));
apiRouter.get("/feed/json", (req, res, next) => feedHandler.getJsonFeed(req, res, next));
apiRouter.get("/export/csv", (req, res, next) => feedHandler.exportCsv(req, res, next));

// Metrics and Health APIs
apiRouter.get("/metrics", (req, res) => resilienceHandler.getMetrics(req, res));
apiRouter.get("/health", (req, res, next) => healthHandler.getHealth(req, res, next));
apiRouter.get("/health/sources", (req, res, next) => healthHandler.getSourceHealth(req, res, next));
apiRouter.get("/health/resilience", (req, res) => resilienceHandler.getCircuitBreakers(req, res));
apiRouter.get("/health/liveness", (req, res) => resilienceHandler.livenessProbe(req, res));
apiRouter.get("/health/readiness", (req, res) => resilienceHandler.readinessProbe(req, res));
apiRouter.get("/fetch-runs", (req, res, next) => adminHandler.getFetchRuns(req, res, next));

// Admin APIs
apiRouter.post("/admin/circuits/:name/reset", adminAuthMiddleware, (req, res) => resilienceHandler.resetCircuit(req, res));
apiRouter.post("/admin/sources/:source_id/fetch", adminAuthMiddleware, (req, res, next) => adminHandler.triggerSourceFetch(req, res, next));
apiRouter.post("/admin/sources/:source_id/enable", adminAuthMiddleware, (req, res, next) => adminHandler.enableSource(req, res, next));
apiRouter.post("/admin/sources/:source_id/disable", adminAuthMiddleware, (req, res, next) => adminHandler.disableSource(req, res, next));
apiRouter.get("/admin/fetch-runs", adminAuthMiddleware, (req, res, next) => adminHandler.getFetchRuns(req, res, next));
apiRouter.get("/admin/errors", adminAuthMiddleware, (req, res, next) => adminHandler.getErrors(req, res, next));
apiRouter.get("/admin/source-health", adminAuthMiddleware, (req, res, next) => adminHandler.getSourceHealth(req, res, next));

// Catch-all
apiRouter.all("*", (req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: "RESOURCE_NOT_FOUND",
      message: `API route ${req.method} '${req.originalUrl || req.baseUrl + req.url}' was not found.`
    },
    request_id: (req as any).requestId
  });
});

export { apiRouter };
