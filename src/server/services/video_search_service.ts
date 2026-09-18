import { youtubeClient } from '../clients/youtube_client.js';
import { newsRepository } from '../database/repository.js';
import { normalizationPipeline } from '../pipelines/normalization.js';
import { enrichmentPipeline } from '../pipelines/enrichment.js';
import { Logger } from '../config/logging.js';

const logger = new Logger('VideoSearchService');

export const FEATURED_AI_CHANNELS = [
  { id: 'UCbfYPyITQ-7l4upoX8nvctg', name: 'Two Minute Papers', topic: 'AI Research Papers' },
  { id: 'UCZHmQk67mSJgfCCTn7xBfew', name: '3Blue1Brown', topic: 'Neural Networks & Math' },
  { id: 'UC7cs8q-gJRlGwj4A8OmCmXg', name: 'Yannic Kilcher', topic: 'Machine Learning Deep Dives' },
  { id: 'UCbRP3c757lWg9M-U7TyEkXA', name: 'AI Explained', topic: 'AGI, Frontier Models' },
  { id: 'UCfzlCWGWYyIQ0aLC5w48gBQ', name: 'Sentdex', topic: 'Python AI & Robotics' },
  { id: 'UCnUYZLuoywbfvJqb8qGF_Lg', name: 'Matt Wolfe', topic: 'AI Tools & Tech' }
];

export class VideoSearchService {
  async searchVideos(query: string, limit: number = 20) {
    if (youtubeClient.isConfigured()) {
      try {
        return await youtubeClient.searchVideos(query || 'artificial intelligence machine learning', limit);
      } catch (err: any) {
        logger.warn(`YouTube search API error: ${err.message}`);
      }
    }
    // Fallback: query repository for existing video articles
    const res = newsRepository.queryArticles({
      sourceType: 'video',
      query: query || undefined,
      limit
    });
    return res.articles.map(a => ({
      id: a.external_id || a.id,
      title: a.title,
      description: a.description,
      channelTitle: a.publisher?.name || a.author || 'AI Channel',
      publishedAt: a.published_at,
      videoUrl: a.canonical_url || a.url,
      embedUrl: a.media?.find(m => m.type === 'video')?.url || '',
      thumbnailUrl: a.image_url,
      tags: a.tags
    }));
  }

  async searchAndIngestVideos(query: string = '') {
    if (!youtubeClient.isConfigured()) {
      return 0;
    }
    try {
      const videos = await youtubeClient.searchVideos(query || 'frontier AI models deep learning 2026', 15);
      let ingested = 0;
      for (const v of videos) {
        const raw = {
          title: v.title,
          url: v.videoUrl,
          description: v.description,
          imageUrl: v.thumbnailUrl,
          sourceId: 'youtube_live',
          sourceName: 'YouTube AI Video Wire',
          publisherName: v.channelTitle,
          author: v.channelTitle,
          publishedAt: v.publishedAt,
          category: 'multimodal',
          tags: ['video', 'youtube', 'ai-video', ...(v.tags || [])],
          sourceType: 'video' as const,
          externalId: v.id,
          media: [
            { type: 'image' as const, url: v.thumbnailUrl, mimeType: 'image/jpeg', source: 'feed' as const },
            { type: 'video' as const, url: v.embedUrl, mimeType: 'video/youtube', source: 'feed' as const }
          ],
          metrics: {
            views: v.views,
            likes: v.likes,
            comments: v.comments
          }
        };

        const normalized = normalizationPipeline.normalize(raw);
        const enriched = enrichmentPipeline.enrich(normalized);
        const res = newsRepository.upsertArticle(enriched);
        if (res.inserted) ingested++;
      }
      return ingested;
    } catch (err: any) {
      logger.warn(`Failed to ingest videos: ${err.message}`);
      return 0;
    }
  }

  getChannels() {
    return FEATURED_AI_CHANNELS;
  }
}

export const videoSearchService = new VideoSearchService();
