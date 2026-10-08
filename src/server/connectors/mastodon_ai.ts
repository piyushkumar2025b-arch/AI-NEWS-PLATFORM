import { BaseConnector } from './base.js';
import { httpClient } from '../clients/http_client.js';

export class MastodonAiConnector extends BaseConnector {
  public definition = {
    id: 'mastodon_ai',
    name: 'Fediverse & Mastodon AI Research Stream',
    baseUrl: 'https://mastodon.social/api/v1',
    protocol: 'rest' as const,
    category: 'community',
    enabled: true,
    requiresKey: false,
    fetchIntervalMinutes: 15
  };

  private tags = ['artificialintelligence', 'machinelearning', 'llm', 'generativeai', 'robotics'];

  async fetch(options: { limit?: number; signal?: AbortSignal } = {}): Promise<{
    rawItems: any[];
    durationMs: number;
    sourceId: string;
    sourceName: string;
  }> {
    const startTime = Date.now();
    const limit = Math.min(25, options.limit || 15);
    const rawItems: any[] = [];

    // Query 2 high-signal tags per cycle
    const selectedTags = this.tags.slice(0, 2);

    for (const tag of selectedTags) {
      if (options.signal?.aborted) break;
      try {
        const url = `https://mastodon.social/api/v1/timelines/tag/${tag}?limit=${limit}`;
        const res = await httpClient.get(url, {
          sourceId: this.definition.id,
          timeoutMs: 6000,
          signal: options.signal
        });

        const data = res.data;
        if (Array.isArray(data)) {
          for (const post of data) {
            if (!post.content || typeof post.content !== 'string') continue;

            // Strip HTML to get clean plain text
            const plainText = post.content
              .replace(/<br\s*[\/]?>/gi, '\n')
              .replace(/<[^>]+>/g, ' ')
              .replace(/&amp;/g, '&')
              .replace(/&lt;/g, '<')
              .replace(/&gt;/g, '>')
              .replace(/&quot;/g, '"')
              .replace(/&#39;/g, "'")
              .replace(/\s+/g, ' ')
              .trim();

            if (plainText.length < 30) continue;

            // Extract primary link or fallback to post URL
            const urlMatch = post.content.match(/href=["'](https?:\/\/[^"']+)["']/i);
            const externalUrl = urlMatch ? urlMatch[1] : post.url;

            // Generate title from first sentence or first 100 characters
            const firstSentence = plainText.split(/[.!?\n]/)[0] || plainText;
            const title = firstSentence.length > 120
              ? firstSentence.slice(0, 117).trim() + '...'
              : firstSentence.trim();

            if (title.length < 10) continue;

            const mediaAttachment = Array.isArray(post.media_attachments) && post.media_attachments.length > 0
              ? post.media_attachments[0]?.url || post.media_attachments[0]?.preview_url
              : null;

            rawItems.push({
              title,
              url: externalUrl || post.url,
              description: plainText.slice(0, 380),
              imageUrl: mediaAttachment || null,
              media: mediaAttachment ? [{ type: 'image', url: mediaAttachment, source: 'metadata' }] : [],
              sourceId: this.definition.id,
              sourceName: this.definition.name,
              publisherName: `Mastodon (@${post.account?.username || 'researcher'})`,
              author: post.account?.display_name || post.account?.username || 'Fediverse AI',
              publishedAt: post.created_at || new Date().toISOString(),
              category: 'community',
              tags: ['mastodon', 'fediverse', 'community', tag, 'ai-discussion'],
              sourceType: 'news',
              externalId: String(post.id),
              metrics: {
                upvotes: post.favourites_count || 0,
                comments: post.replies_count || 0
              }
            });
          }
        }
      } catch (err) {
        // Fallback gracefully
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

export const mastodonAiConnector = new MastodonAiConnector();
