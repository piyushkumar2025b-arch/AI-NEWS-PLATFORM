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

export interface RawArticleInput {
  title: string;
  url: string;
  description?: string;
  imageUrl?: string;
  media?: MediaAsset[];
  sourceId: string;
  sourceName: string;
  publisherName?: string;
  author?: string;
  publishedAt?: string | number | Date | null;
  updatedAt?: string | number | Date | null;
  seenAt?: string | number | Date | null;
  category?: string;
  tags?: string[];
  language?: string;
  sourceType?: 'news' | 'research' | 'code' | 'community' | 'discussion' | 'video' | 'podcast';
  externalId?: string;
  rawMetadata?: Record<string, any>;
  isSeed?: boolean;
  recordOrigin?: 'live' | 'seed' | 'imported';
  metrics?: {
    score?: number;
    comments?: number;
    stars?: number;
    forks?: number;
    citations?: number;
    views?: number;
    likes?: number;
  };
}
