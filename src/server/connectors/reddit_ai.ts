import { BaseConnector } from './base.js';
import { httpClient } from '../clients/http_client.js';

interface SubredditConfig {
  subreddit: string;
  category: string;
  tags: string[];
}

const TARGET_SUBREDDITS: SubredditConfig[] = [
  { subreddit: 'MachineLearning', category: 'research', tags: ['machine-learning', 'reddit', 'research', 'papers'] },
  { subreddit: 'LocalLLaMA', category: 'open-source-ai', tags: ['localllama', 'open-source', 'llms', 'quantization'] },
  { subreddit: 'ArtificialIntelligence', category: 'ai', tags: ['ai', 'community', 'industry'] },
  { subreddit: 'singularity', category: 'frontier-ai', tags: ['singularity', 'agi', 'frontier-ai'] },
  { subreddit: 'OpenAI', category: 'ai', tags: ['openai', 'chatgpt', 'gpt-4', 'reasoning'] }
];

export class RedditAiConnector extends BaseConnector {
  public definition = {
    id: 'reddit_ai',
    name: 'Reddit AI & ML Communities',
    baseUrl: 'https://www.reddit.com',
    protocol: 'rest' as const,
    category: 'community',
    enabled: true,
    requiresKey: false,
    fetchIntervalMinutes: 15
  };

  async fetch(options: { limit?: number; signal?: AbortSignal } = {}): Promise<{
    rawItems: any[];
    durationMs: number;
    sourceId: string;
    sourceName: string;
  }> {
    const startTime = Date.now();
    const limitPerSub = Math.min(10, Math.ceil((options.limit || 20) / TARGET_SUBREDDITS.length));
    const rawItems: any[] = [];

    for (const sub of TARGET_SUBREDDITS) {
      if (options.signal?.aborted) break;

      try {
        const url = `https://www.reddit.com/r/${sub.subreddit}/hot.json?limit=${limitPerSub}`;
        const res = await httpClient.get(url, {
          sourceId: this.definition.id,
          timeoutMs: 6500,
          signal: options.signal,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 TechNewsAggregator/1.0',
            'Accept': 'application/json'
          }
        });

        const data = res.data?.data;
        if (data && Array.isArray(data.children)) {
          for (const child of data.children) {
            const post = child.data;
            if (!post || post.stickied || post.over_18 || !post.title) continue;

            const isSelfPost = post.is_self;
            const postUrl = isSelfPost || !post.url ? `https://www.reddit.com${post.permalink}` : post.url;
            const thumbnail = post.thumbnail && post.thumbnail.startsWith('http') ? post.thumbnail : null;
            const previewImage = post.preview?.images?.[0]?.source?.url?.replace(/&amp;/g, '&') || null;
            const imageUrl = previewImage || thumbnail;

            const description = post.selftext
              ? post.selftext.slice(0, 450).trim()
              : `Discussions on r/${sub.subreddit} (${post.score} upvotes, ${post.num_comments} comments). Domain: ${post.domain || 'reddit.com'}`;

            rawItems.push({
              title: post.title,
              url: postUrl,
              description,
              imageUrl,
              media: imageUrl ? [{ type: 'image', url: imageUrl, source: 'metadata' }] : [],
              sourceId: this.definition.id,
              sourceName: `r/${sub.subreddit}`,
              publisherName: `Reddit r/${sub.subreddit}`,
              author: post.author ? `u/${post.author}` : `r/${sub.subreddit}`,
              publishedAt: post.created_utc ? new Date(post.created_utc * 1000).toISOString() : new Date().toISOString(),
              category: sub.category,
              tags: [...sub.tags, 'discussion', post.link_flair_text ? String(post.link_flair_text).toLowerCase() : 'community'].filter(Boolean),
              sourceType: 'discussion',
              externalId: `reddit_${post.id}`,
              rawMetadata: {
                subreddit: sub.subreddit,
                score: post.score,
                num_comments: post.num_comments,
                upvote_ratio: post.upvote_ratio,
                permalink: `https://www.reddit.com${post.permalink}`
              },
              metrics: {
                score: post.score,
                comments: post.num_comments,
                likes: post.score
              }
            });
          }
        }
      } catch (err: any) {
        // Individual subreddit failover - proceed to next
      }
    }

    return {
      rawItems,
      durationMs: Date.now() - startTime,
      sourceId: this.definition.id,
      sourceName: this.definition.name
    };
  }

  async fetchArticles(options: any = {}): Promise<any[]> {
    const res = await this.fetch(options);
    return res.rawItems;
  }
}

export const redditAiConnector = new RedditAiConnector();
