import { BaseConnector } from './base.js';

export class HnAiConnector extends BaseConnector {
  public definition = {
    id: 'hn_ai',
    name: 'Hacker News AI & ML Top Stories',
    baseUrl: 'https://hn.algolia.com/api/v1',
    protocol: 'rest' as const,
    category: 'community',
    enabled: true,
    requiresKey: false,
    fetchIntervalMinutes: 15
  };

  async fetch(options: { query?: string; limit?: number } = {}): Promise<{ rawItems: any[]; durationMs: number; sourceId: string; sourceName: string }> {
    const startTime = Date.now();
    const limit = Math.min(30, options.limit || 20);
    const query = options.query || 'AI OR LLM OR GPT OR OpenAI OR Claude OR neural OR machine learning';
    const rawItems: any[] = [];

    try {
      const res = await fetch(`https://hn.algolia.com/api/v1/search_by_date?tags=story&query=${encodeURIComponent(query)}&hitsPerPage=${limit}`, {
        headers: { 'User-Agent': 'AITechPulseNews/1.0' },
        signal: AbortSignal.timeout(8000)
      });

      if (res.ok) {
        const data = await res.json();
        for (const item of (data.hits || [])) {
          if (!item.title) continue;
          const storyUrl = item.url || `https://news.ycombinator.com/item?id=${item.objectID}`;
          const hnDiscussionUrl = `https://news.ycombinator.com/item?id=${item.objectID}`;
          const points = item.points || 0;
          const comments = item.num_comments || 0;

          rawItems.push({
            title: item.title,
            url: storyUrl,
            description: `Hacker News discussion: ${points} points, ${comments} comments. ${item.story_text ? item.story_text.slice(0, 300) : ''}`,
            imageUrl: 'https://news.ycombinator.com/y18.svg',
            media: [{ type: 'image', url: 'https://news.ycombinator.com/y18.svg', source: 'metadata' }],
            sourceId: this.definition.id,
            sourceName: this.definition.name,
            publisherName: 'Hacker News (Y Combinator)',
            author: item.author || 'HN Community',
            publishedAt: item.created_at || new Date().toISOString(),
            category: 'community',
            tags: ['hackernews', 'ycombinator', 'community', 'startups', 'ai'],
            sourceType: 'news',
            externalId: String(item.objectID),
            rawMetadata: {
              hnId: item.objectID,
              points,
              comments,
              hnDiscussionUrl
            },
            metrics: {
              upvotes: points,
              comments
            }
          });
        }
      }
    } catch (err: any) {
      // Graceful fallback
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

export const hnAiConnector = new HnAiConnector();

