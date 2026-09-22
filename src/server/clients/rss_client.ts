import { XMLParser } from 'fast-xml-parser';
import { httpClient } from './http_client.js';
import { ParserError } from '../errors/exceptions.js';
import { isLowQualityMedia, upgradeMediaQuality } from '../utils/media_quality.js';

export interface ExtractedMedia {
  type: 'image' | 'video' | 'audio' | 'document';
  url: string;
  mimeType?: string;
  title?: string;
  source: 'feed';
}

export class RssClient {
  private parser: XMLParser;

  constructor() {
    this.parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      textNodeName: '#text',
      cdataPropName: '__cdata',
      parseTagValue: true,
      trimValues: true,
      isArray: (name: string) => {
        return ['item', 'entry', 'category', 'author', 'enclosure', 'media:content', 'media:thumbnail'].includes(name);
      }
    });
  }

  private extractText(node: any): string {
    if (!node) return '';
    if (typeof node === 'string') return node;
    if (typeof node === 'number') return String(node);
    if (Array.isArray(node)) return node.map(n => this.extractText(n)).filter(Boolean).join(', ');
    if (node.__cdata) return String(node.__cdata);
    if (node['#text']) return String(node['#text']);
    if (node._) return String(node._);
    return '';
  }

  private isValidHttpUrl(urlStr: any): boolean {
    if (!urlStr || typeof urlStr !== 'string') return false;
    const trimmed = urlStr.trim();
    return /^https?:\/\/[^\s/$.?#].[^\s]*$/i.test(trimmed);
  }

  private extractMediaAssets(it: any): { imageUrl?: string; media: ExtractedMedia[] } {
    const media: ExtractedMedia[] = [];
    const seenUrls = new Set<string>();

    const addAsset = (urlRaw: any, type: ExtractedMedia['type'], mimeType?: string, title?: string) => {
      if (!this.isValidHttpUrl(urlRaw)) return;
      let url = String(urlRaw).trim();

      // Check quality for image assets
      if (type === 'image') {
        if (isLowQualityMedia(url)) return;
        const upgraded = upgradeMediaQuality(url);
        if (upgraded) url = upgraded;
      }

      if (seenUrls.has(url)) return;
      seenUrls.add(url);
      media.push({
        type,
        url,
        mimeType: mimeType || undefined,
        title: title || undefined,
        source: 'feed'
      });
    };

    // 1. media:content tags
    const mediaContents = it['media:content'] || it['content'] || [];
    const mediaContentList = Array.isArray(mediaContents) ? mediaContents : [mediaContents];
    for (const mc of mediaContentList) {
      if (!mc) continue;
      const url = mc['@_url'] || mc.url || (typeof mc === 'string' ? mc : undefined);
      const medium = mc['@_medium'] || mc.medium || '';
      const typeAttr = mc['@_type'] || mc.type || '';

      let type: ExtractedMedia['type'] = 'image';
      if (medium === 'video' || typeAttr.startsWith('video/') || typeAttr.includes('flash') || (url && (url.includes('/v/') || url.includes('/embed/')))) {
        type = 'video';
      } else if (medium === 'audio' || typeAttr.startsWith('audio/')) {
        type = 'audio';
      } else if (medium === 'document' || typeAttr.includes('pdf')) {
        type = 'document';
      }

      const ytMatch = url?.match(/(?:youtube\.com\/(?:watch\?v=|v\/|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
      if (ytMatch) {
        const ytId = ytMatch[1];
        addAsset(`https://i.ytimg.com/vi/${ytId}/maxresdefault.jpg`, 'image', 'image/jpeg');
        addAsset(`https://www.youtube-nocookie.com/embed/${ytId}`, 'video', 'video/youtube');
        continue;
      }

      addAsset(url, type, typeAttr);
    }

    // 2. media:thumbnail
    const mediaThumbs = it['media:thumbnail'] || it['thumbnail'] || [];
    const thumbList = Array.isArray(mediaThumbs) ? mediaThumbs : [mediaThumbs];
    for (const mt of thumbList) {
      if (!mt) continue;
      const url = mt['@_url'] || mt.url || (typeof mt === 'string' ? mt : undefined);
      addAsset(url, 'image');
    }

    // 3. media:group
    if (it['media:group']) {
      const mg = it['media:group'];
      if (mg['media:content']) {
        const mgc = Array.isArray(mg['media:content']) ? mg['media:content'] : [mg['media:content']];
        for (const item of mgc) {
          const url = item['@_url'] || item.url;
          const typeAttr = item['@_type'] || item.type || '';
          let type: ExtractedMedia['type'] = 'image';
          if (typeAttr.startsWith('video/') || typeAttr.includes('flash') || (url && (url.includes('/v/') || url.includes('/embed/')))) {
            type = 'video';
          } else if (typeAttr.startsWith('audio/')) {
            type = 'audio';
          }
          const ytMatch = url?.match(/(?:youtube\.com\/(?:watch\?v=|v\/|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
          if (ytMatch) {
            const ytId = ytMatch[1];
            addAsset(`https://i.ytimg.com/vi/${ytId}/maxresdefault.jpg`, 'image', 'image/jpeg');
            addAsset(`https://www.youtube-nocookie.com/embed/${ytId}`, 'video', 'video/youtube');
            continue;
          }
          addAsset(url, type, typeAttr);
        }
      }
      if (mg['media:thumbnail']) {
        const mgt = Array.isArray(mg['media:thumbnail']) ? mg['media:thumbnail'] : [mg['media:thumbnail']];
        for (const item of mgt) {
          addAsset(item['@_url'] || item.url, 'image');
        }
      }
    }

    // 4. enclosure
    if (it.enclosure) {
      const encList = Array.isArray(it.enclosure) ? it.enclosure : [it.enclosure];
      for (const enc of encList) {
        if (!enc) continue;
        const url = enc['@_url'] || enc.url;
        const typeAttr = enc['@_type'] || enc.type || '';
        let type: ExtractedMedia['type'] = 'image';
        if (typeAttr.startsWith('video/') || /\.(mp4|webm|mov|mkv)$/i.test(url || '')) type = 'video';
        else if (typeAttr.startsWith('audio/') || /\.(mp3|ogg|wav|m4a)$/i.test(url || '')) type = 'audio';
        else if (typeAttr.includes('pdf') || /\.pdf$/i.test(url || '')) type = 'document';

        addAsset(url, type, typeAttr);
      }
    }

    // 5. YouTube video ID directly on item
    const ytVideoId = it['yt:videoId'] || (typeof it.id === 'string' && it.id.startsWith('yt:video:') ? it.id.replace('yt:video:', '') : undefined);
    if (ytVideoId) {
      addAsset(`https://www.youtube-nocookie.com/embed/${ytVideoId}`, 'video', 'video/youtube');
      addAsset(`https://i.ytimg.com/vi/${ytVideoId}/maxresdefault.jpg`, 'image', 'image/jpeg');
    }

    // 6. itunes:image
    if (it['itunes:image']?.['@_href']) {
      addAsset(it['itunes:image']['@_href'], 'image');
    }

    // 7. News:Image
    if (it['News:Image']) {
      addAsset(this.extractText(it['News:Image']), 'image');
    }

    // 8. HTML bodies img tags
    const htmlBodies = [
      this.extractText(it.description),
      this.extractText(it['content:encoded']),
      this.extractText(it.content),
      this.extractText(it.summary)
    ];

    for (const body of htmlBodies) {
      if (!body) continue;
      const imgMatch = body.match(/<img[^>]+src=["']([^"']+)["']/i);
      if (imgMatch && imgMatch[1]) {
        const src = imgMatch[1].trim();
        addAsset(src, 'image');
      }
    }

    const primaryImage = media.find(m => m.type === 'image' && !isLowQualityMedia(m.url))?.url;
    return { imageUrl: primaryImage, media };
  }

  public parseXml(xmlString: string) {
    const raw = typeof xmlString === 'string' ? xmlString.trim() : '';
    if (
      raw.startsWith('<!DOCTYPE html') ||
      raw.startsWith('<html') ||
      raw.includes('<title>Client Challenge</title>') ||
      raw.includes('cf-browser-verification') ||
      raw.includes('<title>Just a moment...</title>') ||
      raw.includes('Cloudflare Ray ID')
    ) {
      throw new ParserError('Upstream feed provider returned an HTML challenge or verification page instead of an XML feed.');
    }

    try {
      const parsed = this.parser.parse(raw);
      const rdfObj = parsed['rdf:RDF'] || parsed.RDF || parsed.rdf || parsed['r:RDF'] || parsed['rdf'];

      if (parsed.rss?.channel || rdfObj || parsed.channel) {
        const channelObj = parsed.rss?.channel || rdfObj?.channel || parsed.channel || rdfObj || {};
        const rawItems = channelObj.item || rdfObj?.item || parsed.rss?.item || parsed.item || [];
        const itemsList = Array.isArray(rawItems) ? rawItems : rawItems ? [rawItems] : [];

        const items = itemsList.map(it => {
          const title = this.extractText(it.title) || this.extractText(it['dc:title']);
          const link = typeof it.link === 'string' ? it.link : this.extractText(it.link) || it['@_href'] || it['@_rdf:about'] || it['prism:url'] || '';
          const description = this.extractText(it.description) || this.extractText(it['content:encoded']) || this.extractText(it.content);
          const pubDate = this.extractText(it.pubDate) || this.extractText(it['dc:date']) || this.extractText(it.date) || this.extractText(it['prism:publicationDate']);

          let author = '';
          const rawAuthor = it.author || it['dc:creator'] || it['News:Source'];
          if (Array.isArray(rawAuthor)) {
            author = rawAuthor.map(a => this.extractText(a?.name || a)).filter(Boolean).join(', ');
          } else if (rawAuthor) {
            author = this.extractText(rawAuthor.name || rawAuthor);
          }

          const guid = this.extractText(it.guid) || it['@_rdf:about'] || link;
          const { imageUrl, media } = this.extractMediaAssets(it);

          const categories: string[] = [];
          if (it.category) {
            const rawCats = Array.isArray(it.category) ? it.category : [it.category];
            for (const c of rawCats) {
              const text = this.extractText(c);
              if (text) categories.push(text);
            }
          }

          return {
            title,
            link,
            description,
            pubDate,
            author,
            guid,
            categories,
            imageUrl,
            media,
            raw: it
          };
        });

        const feedTitle = this.extractText(channelObj.title) || this.extractText(rdfObj?.title) || 'RSS Feed';
        const feedDescription = this.extractText(channelObj.description) || this.extractText(rdfObj?.description);
        const feedLink = typeof channelObj.link === 'string' ? channelObj.link : this.extractText(channelObj.link) || '';

        return {
          title: feedTitle,
          description: feedDescription,
          link: feedLink,
          items
        };
      }

      if (parsed.feed) {
        const feed = parsed.feed;
        const rawEntries = feed.entry || [];
        const entriesList = Array.isArray(rawEntries) ? rawEntries : [rawEntries];

        const items = entriesList.map(entry => {
          const title = this.extractText(entry.title);
          let link = '';
          if (Array.isArray(entry.link)) {
            const altLink = entry.link.find(l => l['@_rel'] === 'alternate') || entry.link[0];
            link = altLink?.['@_href'] || (typeof altLink === 'string' ? altLink : this.extractText(altLink)) || '';
          } else if (entry.link?.['@_href']) {
            link = entry.link['@_href'];
          } else if (typeof entry.link === 'string') {
            link = entry.link;
          } else if (entry.link) {
            link = this.extractText(entry.link);
          }

          const description = this.extractText(entry.summary) || this.extractText(entry.content);
          const pubDate = this.extractText(entry.published) || this.extractText(entry.updated);
          const guid = this.extractText(entry.id) || link;

          let author = '';
          if (entry.author) {
            const authorList = Array.isArray(entry.author) ? entry.author : [entry.author];
            author = authorList.map(a => this.extractText(a.name) || this.extractText(a)).filter(Boolean).join(', ');
          }

          const { imageUrl, media } = this.extractMediaAssets(entry);

          if (Array.isArray(entry.link)) {
            const pdfLink = entry.link.find(l => l['@_type'] === 'application/pdf' || l['@_title'] === 'pdf');
            if (pdfLink?.['@_href'] && !media.some(m => m.url === pdfLink['@_href'])) {
              media.push({
                type: 'document',
                url: pdfLink['@_href'],
                mimeType: 'application/pdf',
                title: 'PDF Document',
                source: 'feed'
              });
            }
          }

          const categories: string[] = [];
          if (entry.category) {
            const rawCats = Array.isArray(entry.category) ? entry.category : [entry.category];
            for (const c of rawCats) {
              const term = c['@_term'] || this.extractText(c);
              if (term) categories.push(term);
            }
          }

          return {
            title,
            link,
            description,
            pubDate,
            author,
            guid,
            categories,
            imageUrl,
            media,
            raw: entry
          };
        });

        let feedLink = '';
        if (Array.isArray(feed.link)) {
          const altLink = feed.link.find((l: any) => l['@_rel'] === 'alternate') || feed.link[0];
          feedLink = altLink?.['@_href'] || (typeof altLink === 'string' ? altLink : this.extractText(altLink)) || '';
        } else if (feed.link?.['@_href']) {
          feedLink = feed.link['@_href'];
        } else if (typeof feed.link === 'string') {
          feedLink = feed.link;
        } else if (feed.link) {
          feedLink = this.extractText(feed.link);
        }

        return {
          title: this.extractText(feed.title) || 'Atom Feed',
          description: this.extractText(feed.subtitle),
          link: feedLink,
          items
        };
      }

      if (parsed.html) {
        throw new ParserError('Upstream feed provider returned HTML web page instead of an XML feed.');
      }

      throw new ParserError('Unsupported feed format. Missing <rss>, <rdf:RDF>, or <feed> root tags.');
    } catch (err: any) {
      if (err instanceof ParserError) throw err;
      throw new ParserError(`XML parsing failed: ${err.message}`);
    }
  }

  async fetchAndParse(url: string, sourceId: string, options: { timeoutMs?: number; maxRetries?: number; headers?: Record<string, string> } = {}) {
    const res = await httpClient.get(url, {
      sourceId,
      timeoutMs: options.timeoutMs,
      maxRetries: options.maxRetries,
      headers: options.headers
    });
    const xml = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
    return this.parseXml(xml);
  }
}

export const rssClient = new RssClient();
