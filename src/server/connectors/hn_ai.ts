import { BaseConnector } from './base.js';

export class HnAiConnector extends BaseConnector {
  public definition = {
    id: 'hn_ai',
    name: 'Hacker News AI & ML Top Stories',
    baseUrl: 'https://hacker-news.firebaseio.com/v0',
    protocol: 'rest' as const,
    category: 'community',
    enabled: true,
    requiresKey: false,
    fetchIntervalMinutes: 15
  };

  async fetchArticles(): Promise<any[]> {
    return [];
  }
}

export const hnAiConnector = new HnAiConnector();
