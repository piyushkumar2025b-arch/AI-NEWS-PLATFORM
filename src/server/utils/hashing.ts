import crypto from 'crypto';
import { cleanTitle } from './text.js';

export function generateArticleId(input: string): string {
  const hash = crypto.createHash('sha256').update(input || Math.random().toString()).digest('hex');
  return `art_${hash.slice(0, 16)}`;
}

export function generateTitleFingerprint(title: string): string {
  if (!title) return '';
  const cleaned = cleanTitle(title, { stripSyndicationSuffix: true })
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .trim();

  const words = cleaned
    .split(/\s+/)
    .filter(w => w.length > 2)
    .sort();

  return words.join('_');
}
