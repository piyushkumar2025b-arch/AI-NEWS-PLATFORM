/**
 * High-Precision Media Quality Engine.
 * Filters out low-resolution emojis, user avatars, 1x1 tracking pixels, tiny site icons,
 * and upgrades valid media (such as YouTube thumbnails and WordPress uploads) to full master HD resolution.
 */

export function isLowQualityMedia(url: string | null | undefined): boolean {
  if (!url || typeof url !== 'string') return true;
  const trimmed = url.trim();
  if (trimmed.length < 8) return true;

  const lower = trimmed.toLowerCase();

  // 1. Synthetic placeholders & flash artifacts
  if (
    lower.includes('unsplash.com') ||
    lower.startsWith('data:image/svg') ||
    lower.includes('placeholder') ||
    lower.includes('.swf') ||
    lower.includes('/v/')
  ) {
    return true;
  }

  // 2. Emojis (WordPress core emojis, Discourse emojis, Pytorch emojis, Twemoji)
  if (
    lower.includes('s.w.org/images/core/emoji') ||
    lower.includes('emoji.discourse-cdn.com') ||
    lower.includes('discuss.pytorch.org/images/emoji') ||
    lower.includes('/emoji/') ||
    lower.includes('/emojis/') ||
    lower.includes('twemoji') ||
    lower.includes('emoticon')
  ) {
    return true;
  }

  // 3. User Avatars and profile icons
  if (
    lower.includes('user_avatar') ||
    lower.includes('gravatar.com/avatar') ||
    lower.includes('github.com/identicons') ||
    /avatar[_-]?(?:sm|xs|tiny|16|24|32|48|64)\./i.test(lower) ||
    /\/user_avatar\/[^\/]+\/[^\/]+\/\d+\//i.test(lower)
  ) {
    return true;
  }

  // 4. Tiny thumbnails, author headshots, and badges
  if (
    lower.includes('techmeme.com/img/pml.png') ||
    /techmeme\.com\/\d+\/i\d+\.jpg/i.test(lower) ||
    lower.includes('statcounter.com') ||
    lower.includes('feedburner.com') ||
    lower.includes('1x1.') ||
    lower.includes('pixel.wp.com') ||
    lower.includes('sponsors.svg') ||
    lower.includes('sponsor.svg') ||
    lower.includes('arxiv-logo-fb.png') ||
    lower.includes('logo_bigger.jpg') ||
    lower.includes('favicon') ||
    lower.includes('apple-touch-icon') ||
    lower.includes('feed-icon') ||
    /\/btn[_-]|\/button[_-]|subscribe[_-]button/i.test(lower)
  ) {
    return true;
  }

  // 5. Tiny dimension query params that cannot be upgraded (e.g. explicitly tiny thumbnails)
  const widthParamMatch = lower.match(/[?&](?:w|width|size)=(\d+)/i);
  if (widthParamMatch) {
    const widthVal = parseInt(widthParamMatch[1], 10);
    if (widthVal > 0 && widthVal < 100) {
      return true;
    }
  }

  return false;
}

/**
 * Upgrades media URLs to their highest possible resolution master assets.
 */
export function upgradeMediaQuality(url: string | null | undefined): string | null {
  if (!url || typeof url !== 'string') return null;

  // Clean common HTML entities
  let clean = url
    .replace(/&#038;/g, '&')
    .replace(/&amp;/g, '&')
    .replace(/&#38;/g, '&')
    .trim();

  if (isLowQualityMedia(clean)) {
    return null;
  }

  // 1. YouTube Thumbnails Upgrade:
  // Convert 480x360 letterboxed hqdefault.jpg to 1280x720 16:9 full HD maxresdefault.jpg
  const ytMatch = clean.match(/(?:youtube(?:-nocookie)?\.com\/(?:watch\?v=|v\/|embed\/|shorts\/|live\/)|youtu\.be\/|i[0-9]?\.ytimg\.com\/vi\/)([a-zA-Z0-9_-]{11})/i);
  if (ytMatch) {
    return `https://i.ytimg.com/vi/${ytMatch[1]}/maxresdefault.jpg`;
  }

  // 2. WordPress Uploads Master Resolution Upgrade:
  // WordPress automatically saves downscaled files like `-150x150.jpg`, `-300x200.png`, `-768x432.jpg`.
  // Stripping this suffix points directly to the original full-fidelity master photo.
  if (/wp-content\/uploads\/.*-\d{2,4}x\d{2,4}\.(jpe?g|png|webp|avif)$/i.test(clean)) {
    clean = clean.replace(/-\d{2,4}x\d{2,4}(\.[a-zA-Z0-9]+)$/i, '$1');
  }

  // 3. Dynamic CDN query parameters upgrade:
  // For CDNs supporting ?w= or ?width= params, ensure minimum 1200px width for retina screens
  clean = clean.replace(/([?&](?:w|width)=)(\d+)/i, (match, prefix, num) => {
    const n = parseInt(num, 10);
    if (n > 0 && n < 600) {
      return `${prefix}1200`;
    }
    return match;
  });

  return clean;
}

/**
 * Sanitizes and upgrades an article's media assets and image_url.
 */
export function sanitizeArticleMedia<T extends { image_url?: string | null; media?: any[]; source_type?: string; url?: string; title?: string }>(
  article: T
): T {
  // 1. Upgrade primary image_url
  if (article.image_url) {
    const upgraded = upgradeMediaQuality(article.image_url);
    article.image_url = upgraded || null;
  }

  // 2. Sanitize and upgrade media array
  if (Array.isArray(article.media)) {
    const cleanMedia: any[] = [];
    const seenUrls = new Set<string>();

    for (const item of article.media) {
      if (!item || !item.url) continue;

      if (item.type === 'image') {
        const upgradedUrl = upgradeMediaQuality(item.url);
        if (upgradedUrl && !seenUrls.has(upgradedUrl)) {
          seenUrls.add(upgradedUrl);
          cleanMedia.push({
            ...item,
            url: upgradedUrl
          });
        }
      } else {
        // Audio, video, documents
        if (!seenUrls.has(item.url)) {
          seenUrls.add(item.url);
          cleanMedia.push(item);
        }
      }
    }
    article.media = cleanMedia;
  } else {
    article.media = [];
  }

  // 3. Check for YouTube video in article URL or title if no image yet
  if (!article.image_url) {
    const ytMatch = (article.url || '').match(/(?:youtube\.com\/(?:watch\?v=|v\/|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    if (ytMatch) {
      const maxresUrl = `https://i.ytimg.com/vi/${ytMatch[1]}/maxresdefault.jpg`;
      article.image_url = maxresUrl;
      if (!article.media.some((m: any) => m.url === maxresUrl)) {
        article.media.unshift({
          type: 'image',
          url: maxresUrl,
          mimeType: 'image/jpeg',
          source: 'feed'
        });
      }
    }
  }

  // 4. If image_url is still null, look for the first valid high quality image in media
  if (!article.image_url && article.media.length > 0) {
    const validImage = article.media.find((m: any) => m.type === 'image' && !isLowQualityMedia(m.url));
    if (validImage) {
      article.image_url = validImage.url;
    }
  }

  return article;
}
