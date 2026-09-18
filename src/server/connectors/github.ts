import { BaseConnector } from './base.js';

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

  async fetch(options: { query?: string; limit?: number } = {}): Promise<{ rawItems: any[] }> {
    return { rawItems: [] };
  }
}

export const githubConnector = new GithubConnector();
