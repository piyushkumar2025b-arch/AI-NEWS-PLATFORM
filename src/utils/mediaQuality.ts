/**
 * Client-Side Media Quality & Resolution Engine.
 * Ensures articles never render blurry low-res avatars, emojis, or tracking pixels,
 * and seamlessly waterfalls YouTube thumbnails from 1080p (maxres) to 480p (sd) to ensure reliable loading.
 */

export function isLowQualityMedia(url: string | null | undefined): boolean {
  if (!url || typeof url !== 'string') return true;
  const trimmed = url.trim();
  if (trimmed.length < 8) return true;

  const lower = trimmed.toLowerCase();

  // 1. Synthetic placeholders, data URIs & flash artifacts
  if (
    lower.startsWith('data:') ||
    lower.includes('dummy') ||
    lower.includes('placeholder') ||
    lower.includes('default_image') ||
    lower.includes('no-image') ||
    lower.includes('no_image') ||
    lower.includes('fallback') ||
    lower.includes('blank.gif') ||
    lower.includes('spacer.gif') ||
    lower.endsWith('.swf')
  ) {
    return true;
  }

  // 2. Generic vector logos & non-article SVGs
  if (
    /\.svg(?:[?#]|$)/i.test(lower) ||
    lower.includes('huggingface_logo') ||
    lower.includes('huggingface.co/front/assets') ||
    lower.includes('sponsors.svg') ||
    lower.includes('sponsor.svg') ||
    lower.includes('github-mark') ||
    lower.includes('favicon') ||
    lower.includes('apple-touch-icon') ||
    lower.includes('feed-icon') ||
    lower.includes('statcounter.com') ||
    lower.includes('feedburner.com') ||
    lower.includes('1x1.') ||
    lower.includes('pixel.wp.com') ||
    lower.includes('arxiv-logo-fb.png') ||
    lower.includes('logo_bigger.jpg') ||
    /\/btn[_-]|\/button[_-]|subscribe[_-]button/i.test(lower)
  ) {
    return true;
  }

  // 3. Emojis (WordPress core emojis, Discourse emojis, Pytorch emojis, Twemoji)
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

  // 4. User Avatars and profile icons
  if (
    lower.includes('avatars.githubusercontent.com') ||
    lower.includes('githubusercontent.com/u/') ||
    lower.includes('githubusercontent.com/in/') ||
    lower.includes('user_avatar') ||
    lower.includes('gravatar.com/avatar') ||
    lower.includes('github.com/identicons') ||
    /avatar[_-]?(?:sm|xs|tiny|16|24|32|48|64)\./i.test(lower) ||
    /\/user_avatar\/[^\/]+\/[^\/]+\/\d+\//i.test(lower)
  ) {
    return true;
  }

  // 5. Explicitly tiny width/size query parameters (e.g. s=60, w=48)
  const sizeParamMatch = lower.match(/[?&](?:w|width|size|s)=(\d+)/i);
  if (sizeParamMatch) {
    const sizeVal = parseInt(sizeParamMatch[1], 10);
    if (sizeVal > 0 && sizeVal < 120) {
      return true;
    }
  }

  return false;
}

/**
 * Extracts YouTube Video ID from any URL or string.
 */
export function extractYouTubeId(url: string | null | undefined): string | null {
  if (!url || typeof url !== 'string') return null;
  const match = url.match(/(?:youtube(?:-nocookie)?\.com\/(?:watch\?v=|v\/|embed\/|shorts\/|live\/)|youtu\.be\/|i[0-9]?\.ytimg\.com\/vi\/)([a-zA-Z0-9_-]{11})/i);
  return match ? match[1] : null;
}

/**
 * Returns prioritized multi-tier thumbnail URLs for YouTube videos:
 * 1. maxresdefault (1280x720, 16:9 full HD, crisp)
 * 2. sddefault (640x480, standard definition, no black bars)
 * 3. hqdefault (480x360, reliable fallback)
 * 4. mqdefault (320x180, emergency fallback)
 */
export function getYouTubeThumbnailHierarchy(videoId: string): string[] {
  return [
    `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`,
    `https://i.ytimg.com/vi/${videoId}/sddefault.jpg`,
    `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`
  ];
}

/**
 * Upgrades media URLs to their highest possible resolution master assets.
 */
export function upgradeMediaQuality(url: string | null | undefined): string | null {
  if (!url || typeof url !== 'string') return null;

  let clean = url
    .replace(/&#038;/g, '&')
    .replace(/&amp;/g, '&')
    .replace(/&#38;/g, '&')
    .trim();

  if (isLowQualityMedia(clean)) {
    return null;
  }

  // YouTube high quality upgrade
  const ytId = extractYouTubeId(clean);
  if (ytId) {
    return `https://i.ytimg.com/vi/${ytId}/maxresdefault.jpg`;
  }

  // WordPress upload master resolution upgrade
  if (/wp-content\/uploads\/.*-\d{2,4}x\d{2,4}\.(jpe?g|png|webp|avif)$/i.test(clean)) {
    clean = clean.replace(/-\d{2,4}x\d{2,4}(\.[a-zA-Z0-9]+)$/i, '$1');
  }

  // High-DPI query parameter scale upgrade
  clean = clean.replace(/([?&](?:w|width)=)(\d+)/i, (match, prefix, num) => {
    const n = parseInt(num, 10);
    if (n > 0 && n < 600) {
      return `${prefix}1200`;
    }
    return match;
  });

  return clean;
}
