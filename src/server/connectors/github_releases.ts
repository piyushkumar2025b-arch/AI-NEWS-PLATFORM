import { BaseConnector } from './base.js';
import { rssClient } from '../clients/rss_client.js';

interface ReleaseRepo {
  repo: string;
  name: string;
  category: string;
  tags: string[];
}

const AI_RELEASE_REPOS: ReleaseRepo[] = [
  { repo: 'huggingface/transformers', name: 'Hugging Face Transformers', category: 'open-source-ai', tags: ['huggingface', 'transformers', 'release', 'models'] },
  { repo: 'vllm-project/vllm', name: 'vLLM High-Throughput Engine', category: 'developer-tools', tags: ['vllm', 'inference', 'serving', 'release'] },
  { repo: 'ollama/ollama', name: 'Ollama Local Models', category: 'open-source-ai', tags: ['ollama', 'local-ai', 'release', 'quantization'] },
  { repo: 'pytorch/pytorch', name: 'PyTorch Deep Learning', category: 'developer-tools', tags: ['pytorch', 'tensors', 'deep-learning', 'release'] },
  { repo: 'langchain-ai/langchain', name: 'LangChain Framework', category: 'developer-tools', tags: ['langchain', 'agents', 'llm-apps', 'release'] },
  { repo: 'run-llama/llama_index', name: 'LlamaIndex RAG', category: 'developer-tools', tags: ['llamaindex', 'rag', 'data-framework', 'release'] },
  { repo: 'BerriAI/litellm', name: 'LiteLLM Proxy & Gateway', category: 'developer-tools', tags: ['litellm', 'gateway', 'proxy', 'release'] },
  { repo: 'deepseek-ai/DeepSeek-V3', name: 'DeepSeek AI Models', category: 'frontier-ai', tags: ['deepseek', 'reasoning', 'open-weights', 'release'] }
];

export class GithubReleasesConnector extends BaseConnector {
  public definition = {
    id: 'github_releases',
    name: 'AI Open Source Releases & Changelogs',
    baseUrl: 'https://github.com',
    protocol: 'atom' as const,
    category: 'developer-tools',
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

    for (const item of AI_RELEASE_REPOS) {
      if (options.signal?.aborted) break;

      try {
        const atomUrl = `https://github.com/${item.repo}/releases.atom`;
        const feed = await rssClient.fetchAndParse(atomUrl, this.definition.id, {
          timeoutMs: 6000,
          signal: options.signal
        });

        if (feed && Array.isArray(feed.items)) {
          for (const entry of feed.items.slice(0, 3)) {
            const cleanTitle = `${item.name} Release: ${entry.title || 'New Release'}`;
            const cleanDesc = (entry.content || entry.description || `Changelog for ${item.name} on GitHub`)
              .replace(/<[^>]*>/g, ' ')
              .replace(/\s+/g, ' ')
              .slice(0, 500)
              .trim();

            rawItems.push({
              title: cleanTitle,
              url: entry.link || `https://github.com/${item.repo}/releases`,
              description: cleanDesc,
              imageUrl: 'https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png',
              media: [{ type: 'image', url: 'https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png', source: 'metadata' }],
              sourceId: this.definition.id,
              sourceName: item.name,
              publisherName: `GitHub (${item.repo})`,
              author: entry.author || item.name,
              publishedAt: entry.pubDate || new Date().toISOString(),
              category: item.category,
              tags: [...item.tags, 'changelog', 'open-source', 'github-release'],
              sourceType: 'code',
              externalId: `release_${item.repo}_${entry.id || entry.title}`,
              rawMetadata: {
                repo: item.repo,
                version: entry.title
              }
            });
          }
        }
      } catch (err: any) {
        // Continue to next repo release feed
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

export const githubReleasesConnector = new GithubReleasesConnector();
