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

  async fetch(options: any = {}): Promise<{ rawItems: any[]; durationMs: number; sourceId: string; sourceName: string }> {
    const startTime = Date.now();
    const rawItems: any[] = [];

    try {
      const res = await fetch('https://status.openai.com/api/v2/incidents.json', {
        headers: { 'User-Agent': 'AITechPulseNews/1.0' },
        signal: AbortSignal.timeout(8000)
      });

      if (res.ok) {
        const data = await res.json();
        for (const inc of (data.incidents || []).slice(0, 15)) {
          const latestUpdate = inc.incident_updates?.[0];
          const updateBody = latestUpdate ? ` (${latestUpdate.status}): ${latestUpdate.body}` : '';
          rawItems.push({
            title: `OpenAI Status: ${inc.name} [${inc.status}]`,
            url: inc.shortlink || `https://status.openai.com/incidents/${inc.id}`,
            description: `Impact: ${inc.impact}. ${updateBody}`,
            imageUrl: 'https://status.openai.com/favicon.ico',
            media: [],
            sourceId: this.definition.id,
            sourceName: this.definition.name,
            publisherName: 'OpenAI Status',
            author: 'OpenAI Infrastructure Team',
            publishedAt: inc.created_at || new Date().toISOString(),
            category: 'ai',
            tags: ['openai', 'status', 'infrastructure', 'incidents', inc.impact],
            sourceType: 'news',
            externalId: inc.id,
            rawMetadata: {
              impact: inc.impact,
              status: inc.status,
              updatesCount: inc.incident_updates?.length || 0
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

export const openAiStatusConnector = new OpenAiStatusConnector();

