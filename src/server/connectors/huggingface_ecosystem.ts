import { BaseConnector } from './base.js';
import { httpClient } from '../clients/http_client.js';

export class HuggingFaceEcosystemConnector extends BaseConnector {
  public definition = {
    id: 'hf_ecosystem',
    name: 'Hugging Face Open Weights & Daily Papers',
    baseUrl: 'https://huggingface.co/api',
    protocol: 'rest' as const,
    category: 'open-source-ai',
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
    const limit = Math.min(25, options.limit || 15);
    const rawItems: any[] = [];

    // 1. Fetch Trending Models / Open Weights
    try {
      const modelsRes = await httpClient.get(`https://huggingface.co/api/models?sort=trendingScore&direction=-1&limit=12`, {
        sourceId: this.definition.id,
        timeoutMs: 6000,
        signal: options.signal
      });

      if (Array.isArray(modelsRes.data)) {
        for (const m of modelsRes.data) {
          if (!m.id) continue;
          const modelId = m.id;
          const downloads = m.downloads || 0;
          const likes = m.likes || 0;
          const pipelineTag = m.pipeline_tag || 'open-weights';

          rawItems.push({
            title: `Trending Model: ${modelId} (${pipelineTag})`,
            url: `https://huggingface.co/${modelId}`,
            description: `Trending open-weights model on Hugging Face Hub. Tags: ${(m.tags || []).slice(0, 5).join(', ')}. ${downloads.toLocaleString()} monthly downloads, ${likes.toLocaleString()} likes.`,
            imageUrl: 'https://huggingface.co/front/assets/huggingface_logo-noborder.svg',
            media: [],
            sourceId: this.definition.id,
            sourceName: 'Hugging Face Hub',
            publisherName: 'Hugging Face Hub',
            author: modelId.split('/')[0] || 'Open Source Contributor',
            publishedAt: m.createdAt || new Date().toISOString(),
            category: 'open-source-ai',
            tags: ['huggingface', 'open-weights', 'models', pipelineTag, ...(m.tags || []).slice(0, 3)],
            sourceType: 'research',
            externalId: modelId,
            metrics: {
              stars: likes,
              downloads
            }
          });
        }
      }
    } catch {}

    // 2. Fetch Daily Papers
    try {
      const papersRes = await httpClient.get(`https://huggingface.co/api/daily_papers`, {
        sourceId: this.definition.id,
        timeoutMs: 6000,
        signal: options.signal
      });

      if (Array.isArray(papersRes.data)) {
        for (const entry of papersRes.data.slice(0, 10)) {
          const paper = entry.paper || entry;
          const paperId = paper.id || entry.id;
          const title = paper.title || entry.title;
          if (!title) continue;

          rawItems.push({
            title: `HF Daily Paper: ${title}`,
            url: `https://huggingface.co/papers/${paperId}`,
            description: (paper.summary || '').slice(0, 400) || `Research paper ${paperId} featured on Hugging Face Daily Papers`,
            imageUrl: 'https://huggingface.co/front/assets/huggingface_logo-noborder.svg',
            media: [],
            sourceId: this.definition.id,
            sourceName: 'Hugging Face Daily Papers',
            publisherName: 'Hugging Face Daily Papers',
            author: (paper.authors || []).map((a: any) => a.name).slice(0, 3).join(', ') || 'AI Researchers',
            publishedAt: paper.publishedAt || entry.publishedAt || new Date().toISOString(),
            category: 'research',
            tags: ['huggingface', 'papers', 'research', 'ai', 'arxiv'],
            sourceType: 'research',
            externalId: `hf_paper_${paperId}`,
            metrics: {
              upvotes: entry.numComments || 0
            }
          });
        }
      }
    } catch {}

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

export const huggingFaceEcosystemConnector = new HuggingFaceEcosystemConnector();
