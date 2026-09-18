import { newsRepository } from '../database/repository.js';
import { Article } from '../models/article.js';

export class FeedService {
  private sanitizeCsvCell(value: any): string {
    if (value === null || value === undefined) return '""';
    let str = String(value).trim();

    // Prevent CSV formula injection (CWE-1236)
    if (/^[=+\-@\t\r]/.test(str)) {
      str = `'${str}`;
    }

    // Escape quotes
    return `"${str.replace(/"/g, '""')}"`;
  }

  generateCsv(options: any = {}): string {
    const queryOpts = {
      limit: options.limit || 50,
      query: options.search || options.query
    };
    const result = newsRepository.queryArticles(queryOpts);

    const headers = ['ID', 'Title', 'URL', 'Category', 'Source', 'Author', 'PublishedAt', 'Description'];
    const rows = [headers.join(',')];

    for (const art of result.articles) {
      const row = [
        this.sanitizeCsvCell(art.id),
        this.sanitizeCsvCell(art.title),
        this.sanitizeCsvCell(art.canonical_url || art.url),
        this.sanitizeCsvCell(art.category),
        this.sanitizeCsvCell(art.source),
        this.sanitizeCsvCell(art.author || ''),
        this.sanitizeCsvCell(art.published_at || ''),
        this.sanitizeCsvCell(art.description || '')
      ];
      rows.push(row.join(','));
    }

    return rows.join('\n');
  }

  generateRss(options: any = {}): string {
    const result = newsRepository.queryArticles({ limit: options.limit || 30 });
    const itemsXml = result.articles.map(art => `
    <item>
      <title><![CDATA[${art.title}]]></title>
      <link>${art.canonical_url || art.url}</link>
      <guid isPermaLink="false">${art.id}</guid>
      <pubDate>${art.published_at ? new Date(art.published_at).toUTCString() : new Date().toUTCString()}</pubDate>
      <description><![CDATA[${art.description || ''}]]></description>
      <category>${art.category || 'technology'}</category>
      ${art.author ? `<author>${art.author}</author>` : ''}
    </item>`).join('');

    return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>AI &amp; Tech Global Wire</title>
    <link>https://ai-news-platform.internal</link>
    <description>Real-time authoritative AI &amp; deep tech intelligence wire</description>
    <language>en-us</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    ${itemsXml}
  </channel>
</rss>`;
  }

  generateAtom(options: any = {}): string {
    const result = newsRepository.queryArticles({ limit: options.limit || 30 });
    const entriesXml = result.articles.map(art => `
    <entry>
      <id>${art.id}</id>
      <title><![CDATA[${art.title}]]></title>
      <link href="${art.canonical_url || art.url}" />
      <updated>${art.published_at || new Date().toISOString()}</updated>
      <summary><![CDATA[${art.description || ''}]]></summary>
      ${art.author ? `<author><name>${art.author}</name></author>` : ''}
    </entry>`).join('');

    return `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>AI &amp; Tech Intelligence Feed</title>
  <id>urn:feed:ai-news</id>
  <updated>${new Date().toISOString()}</updated>
  ${entriesXml}
</feed>`;
  }

  generateJsonFeed(options: any = {}): any {
    const result = newsRepository.queryArticles({ limit: options.limit || 30 });
    return {
      version: 'https://jsonfeed.org/version/1.1',
      title: 'AI & Tech Intelligence Wire',
      home_page_url: 'https://ai-news-platform.internal',
      feed_url: 'https://ai-news-platform.internal/api/feed/json',
      items: result.articles.map(art => ({
        id: art.id,
        url: art.canonical_url || art.url,
        title: art.title,
        content_text: art.description,
        date_published: art.published_at,
        authors: art.author ? [{ name: art.author }] : undefined,
        tags: art.tags
      }))
    };
  }
}

export const feedService = new FeedService();
