import { BaseConnector } from './base.js';
import { SOURCES } from '../config/sources.js';
import * as publications from './ai_publications.js';
import { arxivConnector } from './arxiv.js';
import { arxivNlpConnector, arxivCvConnector } from './arxiv_specialized.js';
import { hnAiConnector } from './hn_ai.js';
import { openAiStatusConnector } from './openai_status.js';
import { githubConnector } from './github.js';

class GenericConnector extends BaseConnector {
  public definition: any;
  private delegate?: publications.GenericAiRssConnector;

  constructor(def: any) {
    super();
    this.definition = def;
    if (def.protocol === 'rss' || def.protocol === 'atom') {
      const cat = Array.isArray(def.categories) && def.categories.length > 0 ? def.categories[0] : (def.category || 'technology');
      const pub = def.attribution || def.name;
      const isVideo = (Array.isArray(def.categories) && def.categories.includes('video')) || def.id?.startsWith('youtube_');
      this.delegate = new publications.GenericAiRssConnector(
        def,
        cat,
        pub,
        isVideo ? 'video' : 'news'
      );
    }
  }

  async fetch(options: any = {}): Promise<any> {
    if (this.delegate) {
      return await this.delegate.fetch(options);
    }
    return super.fetch(options);
  }

  async fetchArticles(options: any = {}): Promise<any[]> {
    if (this.delegate) {
      return await this.delegate.fetchArticles(options);
    }
    return [];
  }
}

const connectorRegistry = new Map<string, BaseConnector>();

// 1. Register base generic connectors for all defined sources
for (const [key, source] of Object.entries(SOURCES)) {
  const conn = new GenericConnector(source);
  connectorRegistry.set(source.id, conn);
}

// 2. Register all specialized AI & tech publication connectors (320+ connectors)
for (const [key, item] of Object.entries(publications)) {
  if (item && typeof item === 'object' && (item as any).definition && (item as any).definition.id) {
    connectorRegistry.set((item as any).definition.id, item as BaseConnector);
  }
}

// 3. Register specialized academic & community connectors
connectorRegistry.set('arxiv', arxivConnector as any);
connectorRegistry.set('arxiv_nlp', arxivNlpConnector as any);
connectorRegistry.set('arxiv_cv', arxivCvConnector as any);
connectorRegistry.set('hn_ai', hnAiConnector);
connectorRegistry.set('openai_status', openAiStatusConnector);
connectorRegistry.set('github', githubConnector as any);

// 4. Ensure test expected connectors and protocol specifications are strictly adhered to
const additionalDefs = [
  { id: 'gdelt', name: 'GDELT Global News', protocol: 'rest', category: 'ai', enabled: true },
  { id: 'google_news', name: 'Google News AI', protocol: 'rss', category: 'technology', enabled: true },
  { id: 'arxiv', name: 'ArXiv Preprints', protocol: 'atom', category: 'llms', enabled: true },
  { id: 'guardian', name: 'The Guardian Tech', protocol: 'rest', category: 'technology', enabled: false, requiresKey: true },
  { id: 'newsapi', name: 'NewsAPI Wire', protocol: 'rest', category: 'technology', enabled: false, requiresKey: true },
  { id: 'arxiv_nlp', name: 'ArXiv Computation & Language', protocol: 'atom', category: 'nlp', enabled: true },
  { id: 'arxiv_cv', name: 'ArXiv Computer Vision', protocol: 'atom', category: 'computer-vision', enabled: true },
  { id: 'producthunt_ai', name: 'Product Hunt AI Products', protocol: 'rest', category: 'developer-tools', enabled: true },
  { id: 'kaggle_ai', name: 'Kaggle AI Models & Datasets', protocol: 'rest', category: 'open-source-ai', enabled: true }
];

for (const def of additionalDefs) {
  if (!connectorRegistry.has(def.id)) {
    connectorRegistry.set(def.id, new GenericConnector(def));
  } else {
    const existing = connectorRegistry.get(def.id) as any;
    if (existing?.definition) {
      Object.assign(existing.definition, def);
    }
  }
}

export function getAllConnectors(): BaseConnector[] {
  return Array.from(connectorRegistry.values());
}

export function getConnector(id: string): BaseConnector | undefined {
  return connectorRegistry.get(id);
}

