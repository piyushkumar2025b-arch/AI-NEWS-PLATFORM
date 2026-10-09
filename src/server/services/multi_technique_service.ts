import { Logger } from '../config/logging.js';
import { newsRepository } from '../database/repository.js';
import { cacheService } from '../cache/cache_service.js';
import { normalizationPipeline } from '../pipelines/normalization.js';
import { enrichmentPipeline } from '../pipelines/enrichment.js';
import { deduplicationPipeline } from '../pipelines/deduplication.js';
import { hnAiConnector } from '../connectors/hn_ai.js';
import { topicWireConnector } from '../connectors/topic_wire.js';
import { githubReleasesConnector } from '../connectors/github_releases.js';
import { arxivConnector } from '../connectors/arxiv.js';
import { arxivNlpConnector, arxivCvConnector } from '../connectors/arxiv_specialized.js';
import { huggingFaceEcosystemConnector } from '../connectors/huggingface_ecosystem.js';
import { substackNewslettersConnector } from '../connectors/substack_newsletters.js';
import { mastodonAiConnector } from '../connectors/mastodon_ai.js';
import { redditAiConnector } from '../connectors/reddit_ai.js';
import { discoveryProtocol } from '../protocols/discovery.js';
import { rssClient } from '../clients/rss_client.js';
import { httpClient } from '../clients/http_client.js';

const logger = new Logger('MultiTechniqueService');

export interface TechniqueInfo {
  id: string;
  name: string;
  description: string;
  category: string;
  type: 'realtime_search' | 'rss_syndication' | 'preprints' | 'changelog_atom' | 'microblog_stream' | 'structured_extraction' | 'scholarly_api';
  speed: 'instant' | 'fast' | 'moderate';
  itemCount: number;
  lastRunAt: string | null;
  status: 'active' | 'ready';
}

export class MultiTechniqueService {
  private lastRunTimestamps: Map<string, string> = new Map();

  getTechniquesList(): TechniqueInfo[] {
    const stats = newsRepository.getStats();
    const sourceCounts = stats.sourceCounts || {};

    return [
      {
        id: 'hn_algolia_stream',
        name: 'Hacker News Algolia Real-Time Stream',
        description: 'Instant keyword search across Hacker News stories submitted within minutes/hours, capturing upvotes, discussions, and developer commentary.',
        category: 'community',
        type: 'realtime_search',
        speed: 'instant',
        itemCount: (sourceCounts['hn_ai'] || 0) + (sourceCounts['hackernews'] || 0),
        lastRunAt: this.lastRunTimestamps.get('hn_algolia_stream') || null,
        status: 'active'
      },
      {
        id: 'topic_wire_swarm',
        name: 'Multi-Topic Live Wire Swarm',
        description: 'Parallel syndication query swarm covering 10+ frontier AI sectors (Reasoning LLMs, Agentic Workflows, Humanoid Robotics, Silicon/Blackwell, Open Weights).',
        category: 'ai',
        type: 'rss_syndication',
        speed: 'fast',
        itemCount: sourceCounts['topic_wire'] || 0,
        lastRunAt: this.lastRunTimestamps.get('topic_wire_swarm') || null,
        status: 'active'
      },
      {
        id: 'arxiv_preprints',
        name: 'Cornell arXiv Multi-Category Preprints',
        description: 'Direct ingestion of newest academic preprints across cs.AI, cs.CL (Computation & Language / LLMs), and cs.CV (Computer Vision).',
        category: 'research',
        type: 'preprints',
        speed: 'moderate',
        itemCount: (sourceCounts['arxiv'] || 0) + (sourceCounts['arxiv_nlp'] || 0) + (sourceCounts['arxiv_cv'] || 0),
        lastRunAt: this.lastRunTimestamps.get('arxiv_preprints') || null,
        status: 'active'
      },
      {
        id: 'github_releases_atom',
        name: 'Open-Source AI Releases & Changelogs',
        description: 'Tracking high-velocity GitHub Releases feeds for key AI engines (vLLM, Ollama, Transformers, PyTorch, LangChain, LiteLLM, DeepSeek).',
        category: 'developer-tools',
        type: 'changelog_atom',
        speed: 'fast',
        itemCount: sourceCounts['github_releases'] || 0,
        lastRunAt: this.lastRunTimestamps.get('github_releases_atom') || null,
        status: 'active'
      },
      {
        id: 'hf_ecosystem',
        name: 'Hugging Face Open Weights & Daily Papers',
        description: 'Real-time REST indexing of trending open-weights foundation models, community fine-tunes, and daily curated peer-voted papers.',
        category: 'open-source-ai',
        type: 'realtime_search',
        speed: 'fast',
        itemCount: (sourceCounts['hf_ecosystem'] || 0) + (sourceCounts['hf_papers'] || 0),
        lastRunAt: this.lastRunTimestamps.get('hf_ecosystem') || null,
        status: 'active'
      },
      {
        id: 'independent_newsletters',
        name: 'Substack & Independent AI Newsletters',
        description: 'Direct RSS extraction from leading independent researchers and analysts (Import AI, Interconnects, Ahead of AI, Latent Space, One Useful Thing).',
        category: 'ai',
        type: 'rss_syndication',
        speed: 'fast',
        itemCount: sourceCounts['substack_newsletters'] || 0,
        lastRunAt: this.lastRunTimestamps.get('independent_newsletters') || null,
        status: 'active'
      },
      {
        id: 'mastodon_firehose',
        name: 'Fediverse & Mastodon AI Research Stream',
        description: 'Public Mastodon timeline streaming capturing breaking community discoveries, research threads, and hashtag feeds.',
        category: 'community',
        type: 'microblog_stream',
        speed: 'fast',
        itemCount: sourceCounts['mastodon_ai'] || 0,
        lastRunAt: this.lastRunTimestamps.get('mastodon_firehose') || null,
        status: 'active'
      },
      {
        id: 'tier1_tech_wire',
        name: 'Tier-1 Tech Journalism Syndication',
        description: 'Low-latency feeds from verified technology newsrooms (TechCrunch, The Verge, Ars Technica, MIT Tech Review, Wired, VentureBeat, Techmeme).',
        category: 'ai',
        type: 'rss_syndication',
        speed: 'fast',
        itemCount: (sourceCounts['techcrunch_ai'] || 0) + (sourceCounts['theverge_ai'] || 0) + (sourceCounts['arstechnica'] || 0),
        lastRunAt: this.lastRunTimestamps.get('tier1_tech_wire') || null,
        status: 'active'
      },
      {
        id: 'structured_web_extractor',
        name: 'Schema.org JSON-LD & OpenGraph Extractor',
        description: 'Extracts full metadata from arbitrary article URLs using Schema.org NewsArticle/BlogPosting and OpenGraph tags.',
        category: 'technology',
        type: 'structured_extraction',
        speed: 'fast',
        itemCount: (sourceCounts['web_extract'] || 0) + (sourceCounts['discovered_feed'] || 0),
        lastRunAt: this.lastRunTimestamps.get('structured_web_extractor') || null,
        status: 'active'
      },
      {
        id: 'developer_ecosystem',
        name: 'Developer Communities & Product Wire',
        description: 'Community tech guides from DEV.to, systems engineering discussions on Lobsters, and AI product launches on Product Hunt.',
        category: 'developer-tools',
        type: 'realtime_search',
        speed: 'fast',
        itemCount: (sourceCounts['devto'] || 0) + (sourceCounts['lobsters'] || 0),
        lastRunAt: this.lastRunTimestamps.get('developer_ecosystem') || null,
        status: 'active'
      },
      {
        id: 'reddit_communities',
        name: 'Reddit AI & ML Communities Stream',
        description: 'Live community dispatches, upvoted breakthroughs, and discussions across r/MachineLearning, r/LocalLLaMA, r/singularity, r/OpenAI, and r/ArtificialIntelligence.',
        category: 'community',
        type: 'realtime_search',
        speed: 'fast',
        itemCount: sourceCounts['reddit_ai'] || 0,
        lastRunAt: this.lastRunTimestamps.get('reddit_communities') || null,
        status: 'active'
      },
      {
        id: 'openalex_research',
        name: 'OpenAlex Global Scholarly Works & Preprints',
        description: 'Direct REST integration with OpenAlex indexing newest peer-reviewed publications and open-access AI research works.',
        category: 'research',
        type: 'scholarly_api',
        speed: 'fast',
        itemCount: sourceCounts['openalex'] || 0,
        lastRunAt: this.lastRunTimestamps.get('openalex_research') || null,
        status: 'active'
      }
    ];
  }

  /**
   * Rapid multi-technique refresh: concurrently pulls from all high-speed techniques,
   * inserts fresh articles into repository, saves to disk, and returns the freshest feed.
   */
  async runRapidRefresh(options: { timeoutMs?: number; signal?: AbortSignal } = {}): Promise<{
    received: number;
    inserted: number;
    duplicates: number;
    techniquesExecuted: string[];
    durationMs: number;
  }> {
    const startTime = Date.now();
    logger.info('Executing rapid multi-technique news refresh...');

    const techniquesExecuted: string[] = [];
    const collectedRawItems: any[] = [];

    // Concurrent execution across all fast techniques
    const tasks: Promise<any>[] = [
      // 1. HN Algolia Stream
      (async () => {
        try {
          const res = await hnAiConnector.fetch({ limit: 25, signal: options.signal });
          techniquesExecuted.push('hn_algolia_stream');
          this.lastRunTimestamps.set('hn_algolia_stream', new Date().toISOString());
          return res.rawItems;
        } catch { return []; }
      })(),

      // 2. Multi-Topic Wire Swarm
      (async () => {
        try {
          const res = await topicWireConnector.fetch({ limit: 25, signal: options.signal });
          techniquesExecuted.push('topic_wire_swarm');
          this.lastRunTimestamps.set('topic_wire_swarm', new Date().toISOString());
          return res.rawItems;
        } catch { return []; }
      })(),

      // 3. GitHub Releases Atom
      (async () => {
        try {
          const res = await githubReleasesConnector.fetch({ limit: 20, signal: options.signal });
          techniquesExecuted.push('github_releases_atom');
          this.lastRunTimestamps.set('github_releases_atom', new Date().toISOString());
          return res.rawItems;
        } catch { return []; }
      })(),

      // 4. Hugging Face Ecosystem (Open Weights + Daily Papers)
      (async () => {
        try {
          const res = await huggingFaceEcosystemConnector.fetch({ limit: 25, signal: options.signal });
          techniquesExecuted.push('hf_ecosystem');
          this.lastRunTimestamps.set('hf_ecosystem', new Date().toISOString());
          return res.rawItems;
        } catch { return []; }
      })(),

      // 5. Independent Substack Newsletters
      (async () => {
        try {
          const res = await substackNewslettersConnector.fetch({ limit: 20, signal: options.signal });
          techniquesExecuted.push('independent_newsletters');
          this.lastRunTimestamps.set('independent_newsletters', new Date().toISOString());
          return res.rawItems;
        } catch { return []; }
      })(),

      // 6. Mastodon Fediverse AI Firehose
      (async () => {
        try {
          const res = await mastodonAiConnector.fetch({ limit: 20, signal: options.signal });
          techniquesExecuted.push('mastodon_firehose');
          this.lastRunTimestamps.set('mastodon_firehose', new Date().toISOString());
          return res.rawItems;
        } catch { return []; }
      })(),

      // 7. ArXiv Specialized NLP & LLM preprints
      (async () => {
        try {
          const res = await arxivNlpConnector.fetch({ limit: 12, signal: options.signal });
          techniquesExecuted.push('arxiv_preprints');
          this.lastRunTimestamps.set('arxiv_preprints', new Date().toISOString());
          return res.rawItems;
        } catch { return []; }
      })(),

      // 8. Tier-1 Fast News Feeds (TechCrunch & The Verge AI)
      (async () => {
        try {
          const feedTC = await rssClient.fetchAndParse('https://techcrunch.com/category/artificial-intelligence/feed/', 'techcrunch_ai', { timeoutMs: 4500, signal: options.signal });
          const items = (feedTC?.items || []).slice(0, 10).map(it => ({
            title: it.title,
            url: it.link || it.guid,
            description: it.description?.replace(/<[^>]*>/g, '').slice(0, 350) || '',
            imageUrl: it.imageUrl || null,
            sourceId: 'techcrunch_ai',
            sourceName: 'TechCrunch AI',
            publisherName: 'TechCrunch',
            publishedAt: it.pubDate || new Date().toISOString(),
            category: 'ai',
            tags: ['techcrunch', 'ai', 'startups', 'venture-capital'],
            sourceType: 'news'
          }));
          techniquesExecuted.push('tier1_tech_wire');
          this.lastRunTimestamps.set('tier1_tech_wire', new Date().toISOString());
          return items;
        } catch { return []; }
      })(),

      // 9. Reddit AI & ML Communities
      (async () => {
        try {
          const res = await redditAiConnector.fetch({ limit: 20, signal: options.signal });
          techniquesExecuted.push('reddit_communities');
          this.lastRunTimestamps.set('reddit_communities', new Date().toISOString());
          return res.rawItems;
        } catch { return []; }
      })(),

      // 10. OpenAlex Global Scholarly AI Preprints
      (async () => {
        try {
          const res = await httpClient.get('https://api.openalex.org/works?filter=default.search:artificial%20intelligence&sort=publication_date:desc&per_page=12', {
            sourceId: 'openalex',
            timeoutMs: 5000,
            signal: options.signal
          });
          const works = res.data?.results;
          if (Array.isArray(works)) {
            const items = works.map((w: any) => ({
              title: w.title || 'Scholarly AI Research Publication',
              url: w.primary_location?.landing_page_url || w.doi || w.id,
              description: `Scholarly work published on ${w.publication_date || 'recently'}. Authors: ${(w.authorships || []).slice(0, 3).map((a: any) => a.author?.display_name).filter(Boolean).join(', ') || 'Research Collaborators'}. Cited by ${w.cited_by_count || 0} works.`,
              sourceId: 'openalex',
              sourceName: 'OpenAlex Scholarly',
              publisherName: w.primary_location?.source?.display_name || 'Academic Open Access',
              author: w.authorships?.[0]?.author?.display_name || 'Research Scholar',
              publishedAt: w.publication_date ? new Date(w.publication_date).toISOString() : new Date().toISOString(),
              category: 'research',
              tags: ['scholarly', 'research', 'openalex', 'peer-reviewed'],
              sourceType: 'research',
              externalId: w.id ? String(w.id).replace('https://openalex.org/', '') : undefined
            }));
            techniquesExecuted.push('openalex_research');
            this.lastRunTimestamps.set('openalex_research', new Date().toISOString());
            return items;
          }
          return [];
        } catch { return []; }
      })()
    ];

    const results = await Promise.allSettled(tasks);
    for (const res of results) {
      if (res.status === 'fulfilled' && Array.isArray(res.value)) {
        collectedRawItems.push(...res.value);
      }
    }

    // Process collected items through ingestion pipeline
    let inserted = 0;
    let duplicates = 0;

    for (const raw of collectedRawItems) {
      try {
        if (!raw.title || !raw.url) continue;
        let norm = normalizationPipeline.normalize(raw);
        norm = enrichmentPipeline.enrich(norm);
        const dedup = deduplicationPipeline.checkAndDeduplicate(norm);

        if (dedup.isUnique) {
          const upsert = newsRepository.upsertArticle(norm);
          if (upsert.inserted) inserted++;
          else duplicates++;
        } else {
          duplicates++;
        }
      } catch (err: any) {
        // Individual item skip
      }
    }

    if (inserted > 0) {
      newsRepository.saveToDisk();
      await cacheService.invalidatePrefix('news:').catch(() => {});
      await cacheService.invalidatePrefix('search:').catch(() => {});
    }

    const durationMs = Date.now() - startTime;
    logger.info(`Rapid multi-technique refresh complete: ${collectedRawItems.length} received, ${inserted} newly indexed in ${durationMs}ms`);

    return {
      received: collectedRawItems.length,
      inserted,
      duplicates,
      techniquesExecuted,
      durationMs
    };
  }

  /**
   * Run a specific technique by ID
   */
  async runSpecificTechnique(
    techniqueId: string,
    optionsOrSignal?: { signal?: AbortSignal; targetUrl?: string; query?: string } | AbortSignal
  ): Promise<{
    success: boolean;
    techniqueId: string;
    received: number;
    inserted: number;
    durationMs: number;
    error?: string;
  }> {
    const startTime = Date.now();
    const signal = optionsOrSignal instanceof AbortSignal ? optionsOrSignal : optionsOrSignal?.signal;
    const targetUrl = !(optionsOrSignal instanceof AbortSignal) ? optionsOrSignal?.targetUrl : undefined;
    const customQuery = !(optionsOrSignal instanceof AbortSignal) ? optionsOrSignal?.query : undefined;
    let rawItems: any[] = [];

    try {
      switch (techniqueId) {
        case 'hn_algolia_stream': {
          const res = await hnAiConnector.fetch({ limit: 30, signal });
          rawItems = res.rawItems;
          break;
        }
        case 'topic_wire_swarm': {
          const res = await topicWireConnector.fetch({ limit: 30, signal });
          rawItems = res.rawItems;
          break;
        }
        case 'arxiv_preprints': {
          const [nlp, cv] = await Promise.allSettled([
            arxivNlpConnector.fetch({ limit: 15, signal }),
            arxivCvConnector.fetch({ limit: 15, signal })
          ]);
          if (nlp.status === 'fulfilled') rawItems.push(...nlp.value.rawItems);
          if (cv.status === 'fulfilled') rawItems.push(...cv.value.rawItems);
          break;
        }
        case 'github_releases_atom': {
          const res = await githubReleasesConnector.fetch({ limit: 25, signal });
          rawItems = res.rawItems;
          break;
        }
        case 'hf_ecosystem': {
          const res = await huggingFaceEcosystemConnector.fetch({ limit: 25, signal });
          rawItems = res.rawItems;
          break;
        }
        case 'independent_newsletters': {
          const res = await substackNewslettersConnector.fetch({ limit: 25, signal });
          rawItems = res.rawItems;
          break;
        }
        case 'mastodon_firehose': {
          const res = await mastodonAiConnector.fetch({ limit: 25, signal });
          rawItems = res.rawItems;
          break;
        }
        case 'tier1_tech_wire': {
          const feedTC = await rssClient.fetchAndParse('https://techcrunch.com/category/artificial-intelligence/feed/', 'techcrunch_ai', { timeoutMs: 5000, signal });
          if (feedTC?.items) {
            rawItems = feedTC.items.slice(0, 15).map(it => ({
              title: it.title,
              url: it.link || it.guid,
              description: it.description?.replace(/<[^>]*>/g, '').slice(0, 350) || '',
              imageUrl: it.imageUrl || null,
              sourceId: 'techcrunch_ai',
              sourceName: 'TechCrunch AI',
              publisherName: 'TechCrunch',
              publishedAt: it.pubDate || new Date().toISOString(),
              category: 'ai',
              tags: ['techcrunch', 'ai', 'startups'],
              sourceType: 'news'
            }));
          }
          break;
        }
        case 'developer_ecosystem': {
          const devtoRes = await httpClient.get('https://dev.to/api/articles?tag=ai&per_page=20', {
            sourceId: 'devto',
            timeoutMs: 6000,
            signal
          });
          if (Array.isArray(devtoRes.data)) {
            rawItems = devtoRes.data.map(item => ({
              title: item.title,
              url: item.url,
              description: item.description || '',
              imageUrl: item.cover_image || null,
              sourceId: 'devto',
              sourceName: 'DEV Community',
              publisherName: 'DEV Community',
              author: item.user?.name || 'DEV Community',
              publishedAt: item.published_at || new Date().toISOString(),
              category: 'developer-tools',
              tags: ['devto', 'ai', ...(item.tag_list || [])],
              sourceType: 'news',
              externalId: String(item.id)
            }));
          }
          break;
        }
        case 'reddit_communities': {
          const res = await redditAiConnector.fetch({ limit: 25, signal });
          rawItems = res.rawItems;
          break;
        }
        case 'openalex_research': {
          const searchParam = customQuery ? encodeURIComponent(customQuery) : 'artificial%20intelligence';
          const res = await httpClient.get(`https://api.openalex.org/works?filter=default.search:${searchParam}&sort=publication_date:desc&per_page=15`, {
            sourceId: 'openalex',
            timeoutMs: 6000,
            signal
          });
          const works = res.data?.results;
          if (Array.isArray(works)) {
            rawItems = works.map((w: any) => ({
              title: w.title || 'Scholarly AI Research Publication',
              url: w.primary_location?.landing_page_url || w.doi || w.id,
              description: `Scholarly work published on ${w.publication_date || 'recently'}. Authors: ${(w.authorships || []).slice(0, 3).map((a: any) => a.author?.display_name).filter(Boolean).join(', ') || 'Research Collaborators'}. Cited by ${w.cited_by_count || 0} works.`,
              sourceId: 'openalex',
              sourceName: 'OpenAlex Scholarly',
              publisherName: w.primary_location?.source?.display_name || 'Academic Open Access',
              author: w.authorships?.[0]?.author?.display_name || 'Research Scholar',
              publishedAt: w.publication_date ? new Date(w.publication_date).toISOString() : new Date().toISOString(),
              category: 'research',
              tags: ['scholarly', 'research', 'openalex', 'peer-reviewed'],
              sourceType: 'research',
              externalId: w.id ? String(w.id).replace('https://openalex.org/', '') : undefined
            }));
          }
          break;
        }
        case 'structured_web_extractor': {
          const urlsToExtract = targetUrl
            ? [targetUrl]
            : [
                'https://openai.com/news/',
                'https://blog.google/technology/ai/',
                'https://www.anthropic.com/news',
                'https://huggingface.co/blog'
              ];

          for (const u of urlsToExtract) {
            if (signal?.aborted) break;
            try {
              const page = await discoveryProtocol.extractArticlePage(u, signal);
              if (page && page.title && page.url) {
                rawItems.push({
                  title: page.title,
                  url: page.url,
                  description: page.description || `Extracted structured dispatch from ${u}`,
                  imageUrl: page.imageUrl || null,
                  sourceId: 'structured_web_extractor',
                  sourceName: 'Structured Web Extractor',
                  publisherName: page.publisherName || new URL(u).hostname,
                  author: page.author || 'AI Editorial Staff',
                  publishedAt: page.publishedAt || new Date().toISOString(),
                  category: 'ai',
                  tags: ['structured-data', 'schema-org', 'json-ld', 'research'],
                  sourceType: 'news'
                });
              }
            } catch {}
          }
          break;
        }
        default:
          return {
            success: false,
            techniqueId,
            received: 0,
            inserted: 0,
            durationMs: 0,
            error: `Unknown technique: ${techniqueId}`
          };
      }

      this.lastRunTimestamps.set(techniqueId, new Date().toISOString());

      let inserted = 0;
      for (const raw of rawItems) {
        try {
          if (!raw.title || !raw.url) continue;
          let norm = normalizationPipeline.normalize(raw);
          norm = enrichmentPipeline.enrich(norm);
          const dedup = deduplicationPipeline.checkAndDeduplicate(norm);
          if (dedup.isUnique) {
            const upsert = newsRepository.upsertArticle(norm);
            if (upsert.inserted) inserted++;
          }
        } catch {}
      }

      if (inserted > 0) {
        newsRepository.saveToDisk();
        await cacheService.invalidatePrefix('news:').catch(() => {});
      }

      return {
        success: true,
        techniqueId,
        received: rawItems.length,
        inserted,
        durationMs: Date.now() - startTime
      };
    } catch (err: any) {
      return {
        success: false,
        techniqueId,
        received: 0,
        inserted: 0,
        durationMs: Date.now() - startTime,
        error: err.message
      };
    }
  }
}

export const multiTechniqueService = new MultiTechniqueService();
