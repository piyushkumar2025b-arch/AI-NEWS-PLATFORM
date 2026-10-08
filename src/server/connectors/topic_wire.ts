import { BaseConnector } from './base.js';
import { rssClient } from '../clients/rss_client.js';

interface TopicQuery {
  topic: string;
  query: string;
  category: string;
  tags: string[];
}

const WIRE_TOPICS: TopicQuery[] = [
  {
    topic: 'Reasoning Models & Frontier AI',
    query: 'artificial intelligence reasoning models OR o3 OR DeepSeek OR Claude OR Gemini',
    category: 'frontier-ai',
    tags: ['frontier-ai', 'reasoning', 'llms', 'foundation-models']
  },
  {
    topic: 'Agentic Workflows & Autonomous AI',
    query: 'AI agents OR agentic workflows OR autonomous software agents',
    category: 'ai-agents',
    tags: ['ai-agents', 'automation', 'developer-tools', 'workflows']
  },
  {
    topic: 'AI Chips & Hardware Infrastructure',
    query: 'AI chips GPU NVIDIA Blackwell OR custom silicon AI datacenter',
    category: 'hardware',
    tags: ['hardware', 'chips', 'nvidia', 'datacenters', 'compute']
  },
  {
    topic: 'Humanoid Robotics & Embodied Intelligence',
    query: 'humanoid robot AI robotics embodied intelligence',
    category: 'robotics',
    tags: ['robotics', 'humanoid', 'embodied-ai', 'automation']
  },
  {
    topic: 'Open Source AI & Weights',
    query: 'open source AI model weights HuggingFace fine-tuning',
    category: 'open-source-ai',
    tags: ['open-source-ai', 'weights', 'huggingface', 'community']
  }
];

export class TopicWireConnector extends BaseConnector {
  public definition = {
    id: 'topic_wire',
    name: 'Real-Time AI Topic Wire',
    baseUrl: 'https://news.google.com',
    protocol: 'rss' as const,
    category: 'ai',
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
    const rawItems: any[] = [];
    const limitPerTopic = Math.min(8, Math.ceil((options.limit || 25) / WIRE_TOPICS.length));

    for (const t of WIRE_TOPICS) {
      if (options.signal?.aborted) break;

      try {
        const feedUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(t.query)}&hl=en-US&gl=US&ceid=US:en`;
        const feed = await rssClient.fetchAndParse(feedUrl, this.definition.id, {
          timeoutMs: 6500,
          signal: options.signal
        });

        if (feed && Array.isArray(feed.items)) {
          for (const item of feed.items.slice(0, limitPerTopic)) {
            if (!item.title) continue;

            // Extract publisher name usually separated by " - PublisherName"
            let title = item.title;
            let publisherName = 'Global Tech Wire';
            const lastDash = title.lastIndexOf(' - ');
            if (lastDash > 15) {
              publisherName = title.slice(lastDash + 3).trim();
              title = title.slice(0, lastDash).trim();
            }

            const cleanDesc = (item.description || item.content || `Live tech dispatch on ${t.topic}`)
              .replace(/<[^>]*>/g, ' ')
              .replace(/\s+/g, ' ')
              .slice(0, 400)
              .trim();

            rawItems.push({
              title,
              url: item.link || item.guid,
              description: cleanDesc,
              imageUrl: item.imageUrl || null,
              media: item.imageUrl ? [{ type: 'image', url: item.imageUrl, source: 'metadata' }] : [],
              sourceId: this.definition.id,
              sourceName: publisherName || this.definition.name,
              publisherName,
              author: publisherName,
              publishedAt: item.pubDate || new Date().toISOString(),
              category: t.category,
              tags: [...t.tags, 'wire', 'breaking', publisherName.toLowerCase().replace(/[^a-z0-9]/g, '')].filter(Boolean),
              sourceType: 'news',
              externalId: `wire_${item.id || item.link}`,
              rawMetadata: {
                topic: t.topic,
                originalPublisher: publisherName
              }
            });
          }
        }
      } catch (err: any) {
        // Continue with next wire query
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

export const topicWireConnector = new TopicWireConnector();
