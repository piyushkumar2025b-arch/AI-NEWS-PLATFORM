import { Article } from '../models/article.js';

export class FilterPipeline {
  passesFilter(article: Article): boolean {
    if (!article || !article.title || article.title.length < 3) {
      return false;
    }
    // Block common spam / non-informative titles
    const lower = article.title.toLowerCase();
    if (lower.includes('sponsored content') || lower.includes('buy now')) {
      return false;
    }
    return true;
  }
}

export const filterPipeline = new FilterPipeline();
