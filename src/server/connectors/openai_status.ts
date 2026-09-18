import { BaseConnector } from './base.js';

export class OpenAiStatusConnector extends BaseConnector {
  public definition = {
    id: 'openai_status',
    name: 'OpenAI Status & Incidents',
    baseUrl: 'https://status.openai.com/api/v2',
    protocol: 'rest' as const,
    category: 'ai',
    enabled: true,
    requiresKey: false,
    fetchIntervalMinutes: 10
  };

  async fetchArticles(): Promise<any[]> {
    return [];
  }
}

export const openAiStatusConnector = new OpenAiStatusConnector();
