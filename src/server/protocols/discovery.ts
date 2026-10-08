import { httpClient } from '../clients/http_client.js';
import { rssClient } from '../clients/rss_client.js';
import { Logger } from '../config/logging.js';

const logger = new Logger('DiscoveryProtocol');

export interface DiscoveredSource {
  title: string;
  feedUrl: string;
  protocol: 'rss' | 'atom' | 'json';
  siteUrl: string;
  description?: string;
}

export interface ExtractedPageArticle {
  title: string;
  url: string;
  description: string;
  imageUrl?: string | null;
  author?: string;
  publishedAt?: string;
  publisherName?: string;
}

export class DiscoveryProtocol {
  /**
   * Auto-discover RSS, Atom, or JSON feed from an arbitrary website or blog URL
   */
  async discoverFeeds(url: string, signal?: AbortSignal): Promise<DiscoveredSource[]> {
    const discovered: DiscoveredSource[] = [];
    const normalizedUrl = url.trim().startsWith('http') ? url.trim() : `https://${url.trim()}`;

    try {
      const res = await httpClient.get(normalizedUrl, {
        timeoutMs: 6500,
        signal,
        sourceId: 'feed_discovery'
      });

      const contentType = String(res.headers?.['content-type'] || '').toLowerCase();
      const body = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);

      // Check if the URL provided is already a feed
      if (
        contentType.includes('xml') ||
        contentType.includes('rss') ||
        contentType.includes('atom') ||
        body.includes('<rss') ||
        body.includes('<feed') ||
        body.includes('<rdf:RDF')
      ) {
        const isAtom = body.includes('<feed');
        return [{
          title: this.extractFeedTitle(body) || 'Discovered Feed',
          feedUrl: normalizedUrl,
          protocol: isAtom ? 'atom' : 'rss',
          siteUrl: normalizedUrl
        }];
      }

      // 1. Inspect HTML <link rel="alternate"> tags
      const linkRegex = /<link[^>]+rel=["']alternate["'][^>]+>/gi;
      let match;
      while ((match = linkRegex.exec(body)) !== null) {
        const tag = match[0];
        const typeMatch = tag.match(/type=["']([^"']+)["']/i);
        const hrefMatch = tag.match(/href=["']([^"']+)["']/i);
        const titleMatch = tag.match(/title=["']([^"']+)["']/i);

        if (typeMatch && hrefMatch) {
          const type = typeMatch[1].toLowerCase();
          let href = hrefMatch[1];
          if (href.startsWith('//')) href = 'https:' + href;
          else if (href.startsWith('/')) href = new URL(href, normalizedUrl).toString();

          if (type.includes('rss') || type.includes('xml')) {
            discovered.push({
              title: titleMatch?.[1] || 'RSS Feed',
              feedUrl: href,
              protocol: 'rss',
              siteUrl: normalizedUrl
            });
          } else if (type.includes('atom')) {
            discovered.push({
              title: titleMatch?.[1] || 'Atom Feed',
              feedUrl: href,
              protocol: 'atom',
              siteUrl: normalizedUrl
            });
          } else if (type.includes('json')) {
            discovered.push({
              title: titleMatch?.[1] || 'JSON Feed',
              feedUrl: href,
              protocol: 'json',
              siteUrl: normalizedUrl
            });
          }
        }
      }

      // 2. If no link tags, probe common feed candidate paths
      if (discovered.length === 0) {
        const commonPaths = ['/feed', '/rss', '/rss.xml', '/atom.xml', '/feed.xml'];
        for (const p of commonPaths) {
          if (signal?.aborted) break;
          try {
            const probeUrl = new URL(p, normalizedUrl).toString();
            const probeRes = await httpClient.get(probeUrl, {
              timeoutMs: 3500,
              signal,
              sourceId: 'feed_discovery_probe'
            });
            const probeText = typeof probeRes.data === 'string' ? probeRes.data : '';
            if (probeText.includes('<rss') || probeText.includes('<feed') || probeText.includes('<rdf:RDF')) {
              discovered.push({
                title: this.extractFeedTitle(probeText) || 'Auto-Discovered Feed',
                feedUrl: probeUrl,
                protocol: probeText.includes('<feed') ? 'atom' : 'rss',
                siteUrl: normalizedUrl
              });
              break;
            }
          } catch {
            // Ignore probe failure
          }
        }
      }
    } catch (err: any) {
      logger.debug(`Feed discovery error for ${url}: ${err.message}`);
    }

    return discovered;
  }

  /**
   * Scrapes & extracts rich OpenGraph and Schema.org metadata from an article webpage
   */
  async extractArticlePage(url: string, signal?: AbortSignal): Promise<ExtractedPageArticle | null> {
    try {
      const res = await httpClient.get(url, {
        timeoutMs: 7000,
        signal,
        sourceId: 'article_extractor'
      });

      const html = typeof res.data === 'string' ? res.data : '';
      if (!html) return null;

      // Schema.org JSON-LD extraction
      const jsonLdMatch = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i);
      let jsonLd: any = null;
      if (jsonLdMatch && jsonLdMatch[1]) {
        try {
          jsonLd = JSON.parse(jsonLdMatch[1]);
          if (Array.isArray(jsonLd)) jsonLd = jsonLd[0];
          if (jsonLd?.['@graph']) {
            jsonLd = jsonLd['@graph'].find((item: any) =>
              ['NewsArticle', 'Article', 'BlogPosting', 'TechArticle'].includes(item['@type'])
            ) || jsonLd['@graph'][0];
          }
        } catch {}
      }

      // OpenGraph & Meta tag extraction
      const getMeta = (prop: string): string | null => {
        const regex = new RegExp(`<meta[^>]+(?:property|name)=["'](?:${prop})["'][^>]+content=["']([^"']+)["']`, 'i');
        const match = html.match(regex);
        if (match && match[1]) return match[1].trim();

        const altRegex = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["'](?:${prop})["']`, 'i');
        const altMatch = html.match(altRegex);
        return altMatch ? altMatch[1].trim() : null;
      };

      const title =
        jsonLd?.headline ||
        getMeta('og:title') ||
        getMeta('twitter:title') ||
        html.match(/<title[^>]*>(.*?)<\/title>/i)?.[1]?.trim() ||
        'Extracted Dispatch';

      const description =
        jsonLd?.description ||
        getMeta('og:description') ||
        getMeta('description') ||
        getMeta('twitter:description') ||
        '';

      const imageUrl =
        (typeof jsonLd?.image === 'string' ? jsonLd.image : jsonLd?.image?.url) ||
        getMeta('og:image') ||
        getMeta('twitter:image') ||
        null;

      const author =
        (typeof jsonLd?.author === 'string' ? jsonLd.author : jsonLd?.author?.name) ||
        getMeta('author') ||
        getMeta('article:author') ||
        getMeta('twitter:creator') ||
        undefined;

      const publishedAt =
        jsonLd?.datePublished ||
        getMeta('article:published_time') ||
        getMeta('og:published_time') ||
        undefined;

      const publisherName =
        jsonLd?.publisher?.name ||
        getMeta('og:site_name') ||
        new URL(url).hostname.replace(/^www\./, '');

      return {
        title: title.replace(/&amp;/g, '&').replace(/&#8217;/g, "'").replace(/&quot;/g, '"'),
        url,
        description: description.replace(/&amp;/g, '&').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim(),
        imageUrl,
        author,
        publishedAt,
        publisherName
      };
    } catch (err: any) {
      logger.warn(`Failed extracting article from ${url}: ${err.message}`);
      return null;
    }
  }

  private extractFeedTitle(xml: string): string | null {
    const titleMatch = xml.match(/<title[^>]*>(.*?)<\/title>/i);
    if (titleMatch && titleMatch[1]) {
      return titleMatch[1].replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1').trim();
    }
    return null;
  }
}

export const discoveryProtocol = new DiscoveryProtocol();
