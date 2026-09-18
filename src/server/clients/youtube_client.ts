import { settings } from '../config/settings.js';
import { Logger } from '../config/logging.js';

const logger = new Logger('YouTubeClient');

export interface YouTubeVideoItem {
  id: string;
  title: string;
  description: string;
  channelTitle: string;
  channelId: string;
  publishedAt: string;
  videoUrl: string;
  embedUrl: string;
  thumbnailUrl: string;
  views?: number;
  likes?: number;
  comments?: number;
  duration?: string;
  tags?: string[];
}

export class YouTubeClient {
  private static instance: YouTubeClient;

  public static getInstance(): YouTubeClient {
    if (!YouTubeClient.instance) {
      YouTubeClient.instance = new YouTubeClient();
    }
    return YouTubeClient.instance;
  }

  get apiKey(): string | undefined {
    return settings.youtubeApiKey;
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0);
  }

  getUploadsPlaylistId(channelId: string): string {
    if (channelId.startsWith('UC') && channelId.length >= 24) {
      return 'UU' + channelId.slice(2);
    }
    return channelId;
  }

  async fetchWithRetry(url: string, retries: number = 2, timeoutMs: number = 12000): Promise<Response> {
    let lastError: any;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        const res = await fetch(url, {
          signal: controller.signal,
          headers: {
            Accept: 'application/json',
            'User-Agent': 'AI-Pulse-Intelligence/1.0 (NewsAggregator; +https://ai-pulse.internal)'
          }
        });
        clearTimeout(timer);

        if (res.ok || (res.status >= 400 && res.status < 500 && res.status !== 429)) {
          return res;
        }

        if (attempt < retries) {
          await new Promise(r => setTimeout(r, 600 * (attempt + 1)));
          continue;
        }
        return res;
      } catch (err: any) {
        lastError = err;
        if (attempt < retries) {
          await new Promise(r => setTimeout(r, 600 * (attempt + 1)));
        }
      }
    }
    throw lastError || new Error(`Failed to fetch ${url} after ${retries} retries`);
  }

  async fetchChannelVideos(channelId: string, limit: number = 25): Promise<YouTubeVideoItem[]> {
    if (!this.isConfigured()) {
      throw new Error('YouTube API key is not configured');
    }
    const key = this.apiKey!;
    const playlistId = this.getUploadsPlaylistId(channelId);
    const maxResults = Math.min(50, Math.max(1, limit));

    try {
      const playlistUrl = new URL('https://www.googleapis.com/youtube/v3/playlistItems');
      playlistUrl.searchParams.set('part', 'snippet');
      playlistUrl.searchParams.set('playlistId', playlistId);
      playlistUrl.searchParams.set('maxResults', String(maxResults));
      playlistUrl.searchParams.set('key', key);

      const playlistRes = await this.fetchWithRetry(playlistUrl.toString(), 2, 12000);
      if (playlistRes.ok) {
        const playlistData = await playlistRes.json();
        const items = playlistData.items || [];
        if (items.length > 0) {
          const videoIds: string[] = [];
          const videoSnippetMap = new Map<string, any>();
          for (const it of items) {
            const vid = it.snippet?.resourceId?.videoId;
            if (vid) {
              videoIds.push(vid);
              videoSnippetMap.set(vid, it.snippet);
            }
          }
          if (videoIds.length > 0) {
            return await this.fetchVideosDetails(videoIds, videoSnippetMap);
          }
        }
      } else {
        const errText = await playlistRes.text();
        logger.warn(`YouTube playlistItems error for channel ${channelId} (HTTP ${playlistRes.status}): ${errText.slice(0, 200)}`);
      }
    } catch (err: any) {
      logger.warn(`YouTube playlistItems fetch error for channel ${channelId}: ${err.message || err}`);
    }

    try {
      const searchUrl = new URL('https://www.googleapis.com/youtube/v3/search');
      searchUrl.searchParams.set('part', 'snippet');
      searchUrl.searchParams.set('channelId', channelId);
      searchUrl.searchParams.set('order', 'date');
      searchUrl.searchParams.set('type', 'video');
      searchUrl.searchParams.set('maxResults', String(maxResults));
      searchUrl.searchParams.set('key', key);

      const searchRes = await this.fetchWithRetry(searchUrl.toString(), 2, 12000);
      if (searchRes.ok) {
        const searchData = await searchRes.json();
        const items = searchData.items || [];
        const videoIds = items.map((it: any) => it.id?.videoId).filter(Boolean);
        if (videoIds.length > 0) {
          return await this.fetchVideosDetails(videoIds);
        }
      }
    } catch (searchErr: any) {
      logger.warn(`YouTube channel search fallback error for channel ${channelId}: ${searchErr.message || searchErr}`);
    }

    return [];
  }

  async fetchVideosDetails(videoIds: string[], fallbackSnippetMap?: Map<string, any>): Promise<YouTubeVideoItem[]> {
    if (!this.isConfigured() || videoIds.length === 0) {
      return [];
    }
    const key = this.apiKey!;
    const videosUrl = new URL('https://www.googleapis.com/youtube/v3/videos');
    videosUrl.searchParams.set('part', 'snippet,statistics,contentDetails');
    videosUrl.searchParams.set('id', videoIds.join(','));
    videosUrl.searchParams.set('key', key);

    const res = await this.fetchWithRetry(videosUrl.toString(), 2, 12000);
    if (!res.ok) {
      const errText = await res.text();
      logger.warn(`YouTube videos details API error (HTTP ${res.status}): ${errText.slice(0, 300)}`);
      throw new Error(`YouTube API videos call returned HTTP ${res.status}`);
    }

    const data = await res.json();
    const items = data.items || [];
    const results: YouTubeVideoItem[] = [];

    for (const v of items) {
      const vid = v.id;
      const snip = v.snippet || fallbackSnippetMap?.get(vid) || {};
      const stats = v.statistics || {};
      const content = v.contentDetails || {};
      const thumbs = snip.thumbnails || {};

      // Prioritize crisp 1280x720 maxres, then 640x480 standard, then 480x360 high
      const primaryThumb =
        thumbs.maxres?.url ||
        thumbs.standard?.url ||
        thumbs.high?.url ||
        `https://i.ytimg.com/vi/${vid}/maxresdefault.jpg`;

      const views = stats.viewCount ? parseInt(stats.viewCount, 10) : undefined;
      const likes = stats.likeCount ? parseInt(stats.likeCount, 10) : undefined;
      const comments = stats.commentCount ? parseInt(stats.commentCount, 10) : undefined;

      results.push({
        id: vid,
        title: snip.title || 'Untitled YouTube Video',
        description: snip.description || '',
        channelTitle: snip.channelTitle || '',
        channelId: snip.channelId || '',
        publishedAt: snip.publishedAt || new Date().toISOString(),
        videoUrl: `https://www.youtube.com/watch?v=${vid}`,
        embedUrl: `https://www.youtube-nocookie.com/embed/${vid}`,
        thumbnailUrl: primaryThumb,
        views: isNaN(views as number) ? undefined : views,
        likes: isNaN(likes as number) ? undefined : likes,
        comments: isNaN(comments as number) ? undefined : comments,
        duration: content.duration,
        tags: snip.tags || []
      });
    }

    return results;
  }

  async searchVideos(query: string, limit: number = 20): Promise<YouTubeVideoItem[]> {
    if (!this.isConfigured()) return [];
    const key = this.apiKey!;
    const searchUrl = new URL('https://www.googleapis.com/youtube/v3/search');
    searchUrl.searchParams.set('part', 'snippet');
    searchUrl.searchParams.set('q', query);
    searchUrl.searchParams.set('type', 'video');
    searchUrl.searchParams.set('order', 'date');
    searchUrl.searchParams.set('maxResults', String(Math.min(50, limit)));
    searchUrl.searchParams.set('key', key);

    const res = await fetch(searchUrl.toString(), {
      headers: { Accept: 'application/json' }
    });
    if (!res.ok) {
      throw new Error(`YouTube search returned HTTP ${res.status}`);
    }
    const data = await res.json();
    const items = data.items || [];
    const videoIds = items.map((it: any) => it.id?.videoId).filter(Boolean);
    return this.fetchVideosDetails(videoIds);
  }
}

export const youtubeClient = YouTubeClient.getInstance();
