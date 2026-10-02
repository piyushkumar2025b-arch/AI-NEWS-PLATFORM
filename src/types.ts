export type MediaType = 'image' | 'video' | 'audio' | 'document';

export interface MediaAsset {
  type: MediaType;
  url: string;
  mimeType?: string;
  width?: number;
  height?: number;
  title?: string;
  source?: 'publisher' | 'feed' | 'metadata' | 'editorial';
}

export interface LinkedSource {
  sourceId: string;
  sourceName: string;
  url: string;
  externalId?: string;
  publishedAt?: string | null;
}

export interface ArticlePublisher {
  name: string | null;
  domain: string | null;
  url?: string | null;
}

export interface ArticleDiscovery {
  sourceId: string;
  sourceName: string;
}

export interface ExtractedContent {
  text: string;
  markdown?: string;
  paragraphs: string[];
  readingTimeMinutes: number;
  wordCount: number;
  keyTakeaways: string[];
  extractedAt: string;
  extractionMethod: 'semantic_dom' | 'feed_payload' | 'summary_synthesis';
  leadImageUrl?: string | null;
  author?: string | null;
}

export interface Article {
  id: string;
  title: string;
  description: string;
  url: string;
  canonical_url: string;
  image_url: string | null;
  media?: MediaAsset[];
  source: string;
  source_id: string;
  publisher?: ArticlePublisher;
  discovery?: ArticleDiscovery;
  author: string | null;
  published_at: string | null;
  published_at_source?: 'publisher' | 'feed' | 'index' | 'unknown';
  seen_at?: string | null;
  updated_at: string | null;
  category: string;
  tags: string[];
  language: string;
  source_type: 'news' | 'research' | 'code' | 'community' | 'discussion' | 'video' | 'podcast';
  external_id: string | null;
  raw_metadata: Record<string, any>;
  is_seed?: boolean;
  record_origin?: 'live' | 'seed' | 'imported';
  // Deduplication & multi-source relations
  linked_sources?: LinkedSource[];
  content_hash?: string;
  domain?: string;
  metrics?: {
    score?: number;
    comments?: number;
    stars?: number;
    forks?: number;
    citations?: number;
    views?: number;
    likes?: number;
  };
  full_content?: ExtractedContent;
}

export interface CategoryInfo {
  id: string;
  name: string;
  description?: string;
  count: number;
  icon?: string;
}

export interface Category {
  id: string;
  name: string;
  description: string;
  keywords: string[];
}

export interface SourceHealth {
  sourceId: string;
  sourceName?: string;
  status: 'healthy' | 'degraded' | 'failing' | 'unhealthy' | 'disabled' | 'config_required';
  lastAttempt?: string | null;
  lastSuccess?: string | null;
  lastFailure?: string | null;
  lastFetch?: string | null;
  lastError?: string | null;
  consecutiveFailures: number;
  totalFetches: number;
  totalSuccesses: number;
  totalArticlesFetched: number;
  avgLatencyMs: number;
  averageResponseTimeMs?: number;
  lastDurationMs?: number;
  itemsReceivedTotal?: number;
  itemsInsertedTotal?: number;
  itemsDuplicateTotal?: number;
  errorCountTotal?: number;
  enabled?: boolean;
}

export interface SourceInfo {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  protocol: 'rest' | 'rss' | 'atom' | 'websocket' | 'json';
  connector?: string;
  baseUrl?: string;
  authType?: 'none' | 'api_key' | 'bearer' | 'oauth2';
  categories: string[];
  fetchIntervalMinutes: number;
  timeoutMs?: number;
  maxRetries?: number;
  requiresKey?: boolean;
  configured?: boolean;
  attribution?: string;
  region?: string;
  country?: string;
  health?: SourceHealth;
  [key: string]: any;
}

export type SourceDefinition = SourceInfo;

export interface SystemHealth {
  status?: string;
  articlesIndexed?: number;
  sources?: {
    healthy: number;
    total: number;
  };
  scheduler?: {
    isRunning: boolean;
    activeTimersCount: number;
  };
  cache?: {
    activeKeys: number;
  };
  memory?: {
    heapUsedMb: number;
  };
  uptimeSeconds?: number;
  latency?: {
    avgIngestionMs: number;
    cacheReadMs: number;
    queryP95Ms: number;
  };
  stats?: {
    totalArticles: number;
    totalSources: number;
    activeSources: number;
    healthySources: number;
    avgLatencyMs?: number;
    categoryCounts?: Record<string, number>;
    sourceCounts?: Record<string, number>;
  };
}

export interface FetchRunLog {
  id?: string;
  sourceId: string;
  sourceName: string;
  status: 'success' | 'failed' | 'partial';
  startedAt: string;
  completedAt?: string;
  durationMs: number;
  itemsReceived: number;
  itemsInserted: number;
  itemsDuplicate: number;
  error?: string | null;
}

export interface IngestionOperation {
  id: string;
  sourceId: string;
  status: 'running' | 'completed' | 'failed';
  startedAt: string;
}

export interface SystemStats {
  totalArticles: number;
  totalSources: number;
  activeSources: number;
  categories: Record<string, number>;
}

export interface ApiResponseMeta {
  total?: number;
  limit?: number;
  offset?: number;
  cached?: boolean;
  timestamp?: string;
}

export interface ApiErrorDetail {
  code: string;
  message: string;
  details?: Record<string, any>;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  meta?: ApiResponseMeta;
  error?: ApiErrorDetail;
  request_id: string;
}
