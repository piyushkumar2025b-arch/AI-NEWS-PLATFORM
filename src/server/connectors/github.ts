import { BaseConnector } from './base.js';
import { httpClient } from '../clients/http_client.js';

export class GithubConnector extends BaseConnector {
  public definition = {
    id: 'github',
    name: 'GitHub Trending AI Repositories',
    baseUrl: 'https://api.github.com/search/repositories',
    protocol: 'rest' as const,
    category: 'developer-tools',
    enabled: true,
    requiresKey: false,
    fetchIntervalMinutes: 30
  };

  async fetch(options: { query?: string; limit?: number; signal?: AbortSignal } = {}): Promise<{ rawItems: any[]; durationMs: number; sourceId: string; sourceName: string }> {
    const startTime = Date.now();
    const limit = Math.min(25, options.limit || 15);
    const query = options.query || 'topic:artificial-intelligence+topic:llm+topic:machine-learning';
    const rawItems: any[] = [];

    try {
      const headers: Record<string, string> = {
        'Accept': 'application/vnd.github.v3+json'
      };
      if (process.env.GITHUB_TOKEN) {
        headers['Authorization'] = `token ${process.env.GITHUB_TOKEN}`;
      }

      const res = await httpClient.get(`https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&sort=updated&order=desc&per_page=${limit}`, {
        headers,
        sourceId: this.definition.id,
        timeoutMs: 8000,
        signal: options.signal
      });

      const data = res.data;
      if (data && Array.isArray(data.items)) {
        for (const item of data.items) {
          rawItems.push({
            title: `${item.full_name}: ${item.description || 'Open source artificial intelligence repository'}`,
            url: item.html_url,
            description: item.description || `GitHub repository ${item.full_name} with ${item.stargazers_count} stars and ${item.forks_count} forks.`,
            imageUrl: item.owner?.avatar_url || 'https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png',
            media: item.owner?.avatar_url ? [{ type: 'image', url: item.owner.avatar_url, source: 'metadata' }] : [],
            sourceId: this.definition.id,
            sourceName: this.definition.name,
            publisherName: 'GitHub',
            author: item.owner?.login || 'GitHub Community',
            publishedAt: item.updated_at || item.created_at || new Date().toISOString(),
            category: 'developer-tools',
            tags: ['github', 'open-source', 'developer-tools', 'code', ...(item.topics || []).slice(0, 5)],
            sourceType: 'code',
            externalId: String(item.id),
            rawMetadata: {
              fullName: item.full_name,
              stars: item.stargazers_count,
              forks: item.forks_count,
              language: item.language,
              license: item.license?.name
            },
            metrics: {
              stars: item.stargazers_count,
              forks: item.forks_count
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

export const githubConnector = new GithubConnector();
