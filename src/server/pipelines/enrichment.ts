import { CATEGORIES } from '../config/categories.js';
import { mediaResolver } from '../services/media_resolver.js';
import { getEditorialImage } from '../services/editorial_images.js';
import { Article } from '../models/article.js';
import { sanitizeArticleMedia } from '../utils/media_quality.js';

export class EnrichmentPipeline {
  enrich(article: Article): Article {
    const fullText = `${article.title} ${article.description} ${article.tags.join(' ')}`.toLowerCase();
    const detectedTags = new Set(article.tags.map(t => t.toLowerCase()));

    for (const [catId, catConfig] of Object.entries(CATEGORIES)) {
      for (const kw of catConfig.keywords) {
        if (fullText.includes(kw.toLowerCase())) {
          detectedTags.add(catId);
          if (article.category === 'technology' && catId !== 'technology') {
            article.category = catId;
          }
        }
      }
    }

    article.tags = Array.from(detectedTags);

    if (!article.source_type) {
      if (article.source_id?.startsWith('youtube')) {
        article.source_type = 'video';
      } else if (article.source_id === 'practical_ai' || article.source_id === 'twiml_ai' || article.source_id === 'lex_fridman') {
        article.source_type = 'podcast';
      } else if (article.source_id === 'arxiv' || article.source_id === 'semantic_scholar' || article.source_id === 'crossref' || article.source_id === 'nature_ai') {
        article.source_type = 'research';
      } else if (article.source_id === 'github') {
        article.source_type = 'code';
      } else if (article.source_id === 'hackernews' || article.source_id === 'reddit' || article.source_id === 'lobsters') {
        article.source_type = 'community';
      } else {
        article.source_type = 'news';
      }
    }

    return article;
  }

  async enrichBatch(articles: Article[]): Promise<Article[]> {
    const enriched = articles.map(art => this.enrich(art));

    // Try resolving real OpenGraph image metadata for articles without image
    const toResolve = enriched.filter(art => (!art.image_url || art.image_url.includes('unsplash.com')) && art.url && !art.url.startsWith('data:')).slice(0, 16);
    if (toResolve.length > 0) {
      try {
        await Promise.race([
          Promise.all(toResolve.map(async art => {
            try {
              const res = await mediaResolver.resolveMedia(art.url);
              if (res?.imageUrl) {
                art.image_url = res.imageUrl;
                if (!art.media) art.media = [];
                if (!art.media.some(m => m.url === res.imageUrl)) {
                  art.media.unshift({
                    type: 'image',
                    url: res.imageUrl,
                    title: res.ogTitle || `${art.source} Media`,
                    source: 'metadata'
                  });
                }
              }
            } catch {
              // Graceful failure
            }
          })),
          new Promise(resolve => setTimeout(resolve, 3000))
        ]);
      } catch {
        // Continue
      }
    }

    // Ensure media array is clean of low quality icons; upgrade to high-res
    for (const art of enriched) {
      sanitizeArticleMedia(art);
    }

    // Ensure every article is guaranteed to have authentic, high-resolution photography
    for (const art of enriched) {
      if (!art.image_url || !art.media || art.media.length === 0) {
        const photo = getEditorialImage(art.title, art.category, art.source_id, art.domain);
        art.image_url = photo;
        if (!art.media) art.media = [];
        if (!art.media.some(m => m.url === photo)) {
          art.media.unshift({
            type: 'image',
            url: photo,
            title: art.title,
            source: 'editorial'
          });
        }
      }
    }

    return enriched;
  }
}

export const enrichmentPipeline = new EnrichmentPipeline();
