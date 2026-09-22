import { Article, RawArticleInput } from '../models/article.js';
import { normalizeUrl, extractDomain } from '../utils/urls.js';
import { cleanTitle, stripHtml } from '../utils/text.js';
import { parseDateToISO } from '../utils/dates.js';
import { generateArticleId, generateTitleFingerprint } from '../utils/hashing.js';

export class NormalizationPipeline {
  normalize(raw: RawArticleInput): Article {
    const canonicalUrl = normalizeUrl(raw.url);
    const domain = extractDomain(canonicalUrl);
    const cleanedTitle = cleanTitle(raw.title);
    const cleanedDesc = stripHtml(raw.description || '');
    const publishedAt = parseDateToISO(raw.publishedAt);
    const id = generateArticleId((raw.url || canonicalUrl || cleanedTitle) + '_' + (raw.sourceId || ''));
    const contentHash = generateTitleFingerprint(cleanedTitle);

    const mediaAssets = Array.isArray(raw.media) ? [...raw.media] : [];
    let leadImage = raw.imageUrl || null;

    // If media has an image but imageUrl is missing, populate imageUrl from media
    if (!leadImage) {
      const imgFromMedia = mediaAssets.find(m => m.type === 'image' && m.url);
      if (imgFromMedia) {
        leadImage = imgFromMedia.url;
      }
    }

    // If leadImage exists but media has no image, populate media array with leadImage
    if (leadImage && !mediaAssets.some(m => m.type === 'image')) {
      mediaAssets.unshift({
        type: 'image',
        url: leadImage,
        source: 'feed'
      });
    }

    return {
      id,
      title: cleanedTitle,
      description: cleanedDesc,
      url: raw.url,
      canonical_url: canonicalUrl,
      image_url: leadImage,
      media: mediaAssets,
      source: raw.sourceName || raw.sourceId,
      source_id: raw.sourceId,
      publisher: {
        name: raw.publisherName || raw.sourceName || null,
        domain: domain || null,
        url: domain ? `https://${domain}` : null
      },
      discovery: {
        sourceId: raw.sourceId,
        sourceName: raw.sourceName
      },
      author: raw.author || null,
      published_at: publishedAt,
      published_at_source: 'feed',
      seen_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      category: raw.category || 'technology',
      tags: raw.tags || [],
      language: raw.language || 'en',
      source_type: raw.sourceType || 'news',
      external_id: raw.externalId || null,
      raw_metadata: raw.rawMetadata || {},
      is_seed: !!raw.isSeed,
      record_origin: raw.recordOrigin || 'live',
      linked_sources: [],
      content_hash: contentHash,
      domain,
      metrics: raw.metrics || {}
    };
  }
}

export const normalizationPipeline = new NormalizationPipeline();
