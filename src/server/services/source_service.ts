import { ValidationError } from '../errors/exceptions.js';
import { mediaResolver } from './media_resolver.js';
import { newsRepository } from '../database/repository.js';
import { SOURCES } from '../config/sources.js';
import { getConnector } from '../connectors/index.js';

export interface CustomSourceInput {
  name: string;
  url: string;
  category?: string;
  enabled?: boolean;
}

export class SourceService {
  addSource(input: CustomSourceInput) {
    if (!input || !input.name || !input.url) {
      throw new ValidationError('Source name and URL are required');
    }

    const trimmedUrl = input.url.trim();
    if (!trimmedUrl.startsWith('http://') && !trimmedUrl.startsWith('https://')) {
      throw new ValidationError('Only http and https protocols are permitted for source URLs');
    }

    let parsed: URL;
    try {
      parsed = new URL(trimmedUrl);
    } catch {
      throw new ValidationError('Invalid source URL format');
    }

    // Check non-standard ports (allowed: 80, 443, or empty)
    if (parsed.port && parsed.port !== '80' && parsed.port !== '443') {
      throw new ValidationError(`Access to port ${parsed.port} is prohibited for security`);
    }

    // Check SSRF private / loopback / metadata host
    if (mediaResolver.isPrivateOrRestrictedHost(parsed.hostname)) {
      throw new ValidationError(`Target host '${parsed.hostname}' is a restricted or private internal address`);
    }

    const id = `custom_${input.name.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 24)}_${Date.now().toString(36)}`;
    const sourceObj = {
      id,
      name: input.name.trim(),
      baseUrl: trimmedUrl,
      protocol: 'rss' as const,
      category: input.category || 'technology',
      tier: 'tertiary' as const,
      enabled: input.enabled !== false,
      requiresKey: false,
      region: 'Global',
      reliabilityScore: 0.9,
      fetchIntervalMinutes: 30
    };

    (SOURCES as any)[id] = sourceObj;
    newsRepository.registerSource(sourceObj);
    newsRepository.saveCustomSource(sourceObj);

    return sourceObj;
  }

  getSources() {
    const healthList = newsRepository.getSourceHealth();
    return Object.values(SOURCES).map(s => {
      const health = healthList.find(h => h.sourceId === s.id);
      return {
        ...s,
        status: health?.status || (s.enabled ? 'healthy' : 'disabled'),
        health
      };
    });
  }

  getSourceById(id: string) {
    const s = (SOURCES as any)[id];
    if (!s) return null;
    const health = newsRepository.getSourceHealth(id);
    return {
      ...s,
      health: health[0] || null
    };
  }

  setSourceEnabled(id: string, enabled: boolean) {
    const s = (SOURCES as any)[id];
    if (!s) return null;
    s.enabled = enabled;
    newsRepository.setSourceEnabled(id, enabled);
    newsRepository.saveSourceOverride(id, enabled);
    const conn = getConnector(id);
    if (conn && conn.definition) {
      conn.definition.enabled = enabled;
    }
    return s;
  }

  toggleSource(id: string) {
    const s = (SOURCES as any)[id];
    if (!s) return null;
    return this.setSourceEnabled(id, !s.enabled);
  }
}

export const sourceService = new SourceService();
