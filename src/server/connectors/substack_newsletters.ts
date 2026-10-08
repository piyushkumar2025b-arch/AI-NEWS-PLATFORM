import { BaseConnector } from './base.js';
import { rssClient } from '../clients/rss_client.js';

interface NewsletterDef {
  name: string;
  author: string;
  feedUrl: string;
  category: string;
  tags: string[];
}

const INDEPENDENT_NEWSLETTERS: NewsletterDef[] = [
  {
    name: 'Import AI',
    author: 'Jack Clark',
    feedUrl: 'https://importai.substack.com/feed',
    category: 'research',
    tags: ['import-ai', 'ai-policy', 'benchmarks', 'frontier-ai']
  },
  {
    name: 'Interconnects',
    author: 'Nathan Lambert',
    feedUrl: 'https://www.interconnects.ai/feed',
    category: 'research',
    tags: ['interconnects', 'rlhf', 'open-weights', 'post-training']
  },
  {
    name: 'Ahead of AI',
    author: 'Sebastian Raschka',
    feedUrl: 'https://magazine.sebastianraschka.com/feed',
    category: 'research',
    tags: ['ahead-of-ai', 'llms', 'fine-tuning', 'deep-learning']
  },
  {
    name: 'The Algorithmic Bridge',
    author: 'Alberto Romero',
    feedUrl: 'https://www.thealgorithmicbridge.com/feed',
    category: 'ai',
    tags: ['algorithmic-bridge', 'frontier-ai', 'philosophy', 'models']
  },
  {
    name: 'AI Supremacy',
    author: 'Michael Spencer',
    feedUrl: 'https://aisupremacy.substack.com/feed',
    category: 'ai',
    tags: ['ai-supremacy', 'industry', 'startups', 'geopolitics']
  },
  {
    name: 'Latent Space',
    author: 'Swyx & Alessio',
    feedUrl: 'https://www.latent.space/feed',
    category: 'developer-tools',
    tags: ['latent-space', 'ai-engineer', 'agents', 'architecture']
  },
  {
    name: 'One Useful Thing',
    author: 'Ethan Mollick',
    feedUrl: 'https://www.oneusefulthing.org/feed',
    category: 'ai',
    tags: ['one-useful-thing', 'enterprise', 'adoption', 'agents']
  },
  {
    name: 'Understanding AI',
    author: 'Timothy B. Lee',
    feedUrl: 'https://www.understandingai.org/feed',
    category: 'ai',
    tags: ['understanding-ai', 'in-depth', 'frontier-models']
  }
];

export class SubstackNewslettersConnector extends BaseConnector {
  public definition = {
    id: 'substack_newsletters',
    name: 'Independent AI Newsletters & Dispatches',
    baseUrl: 'https://substack.com',
    protocol: 'rss' as const,
    category: 'ai',
    enabled: true,
    requiresKey: false,
    fetchIntervalMinutes: 20
  };

  async fetch(options: { limit?: number; signal?: AbortSignal } = {}): Promise<{
    rawItems: any[];
    durationMs: number;
    sourceId: string;
    sourceName: string;
  }> {
    const startTime = Date.now();
    const rawItems: any[] = [];

    // Query newsletters concurrently with signal support
    for (const nl of INDEPENDENT_NEWSLETTERS) {
      if (options.signal?.aborted) break;

      try {
        const feed = await rssClient.fetchAndParse(nl.feedUrl, this.definition.id, {
          timeoutMs: 5000,
          signal: options.signal
        });

        if (feed && Array.isArray(feed.items)) {
          for (const item of feed.items.slice(0, 3)) {
            const cleanTitle = (item.title || '').trim();
            if (!cleanTitle) continue;

            const cleanDesc = (item.description || item.content || `Analysis by ${nl.author} on ${nl.name}`)
              .replace(/<[^>]*>/g, ' ')
              .replace(/\s+/g, ' ')
              .slice(0, 450)
              .trim();

            rawItems.push({
              title: cleanTitle,
              url: item.link || item.guid,
              description: cleanDesc,
              imageUrl: item.imageUrl || null,
              media: item.imageUrl ? [{ type: 'image', url: item.imageUrl, source: 'metadata' }] : [],
              sourceId: this.definition.id,
              sourceName: `${nl.name} (${nl.author})`,
              publisherName: nl.name,
              author: nl.author,
              publishedAt: item.pubDate || new Date().toISOString(),
              category: nl.category,
              tags: ['newsletter', 'independent-analysis', ...nl.tags],
              sourceType: 'news',
              externalId: item.guid || item.link
            });
          }
        }
      } catch (err) {
        // Individual newsletter error gracefully skipped
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

export const substackNewslettersConnector = new SubstackNewslettersConnector();
