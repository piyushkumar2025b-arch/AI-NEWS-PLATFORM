export function normalizeUrl(rawUrl: string): string {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  try {
    const parsed = new URL(rawUrl.trim());
    parsed.protocol = parsed.protocol.toLowerCase();
    parsed.hostname = parsed.hostname.toLowerCase().replace(/^www\./, '');

    // Strip default ports
    if ((parsed.protocol === 'http:' && parsed.port === '80') ||
        (parsed.protocol === 'https:' && parsed.port === '443')) {
      parsed.port = '';
    }

    // Strip marketing/tracking query parameters
    const trackingPrefixes = ['utm_', 'fbclid', 'gclid', 'ref', 'source', 'mc_cid', 'mc_eid'];
    const keysToDelete: string[] = [];
    parsed.searchParams.forEach((_, key) => {
      const lower = key.toLowerCase();
      if (trackingPrefixes.some(p => lower.startsWith(p) || lower === p)) {
        keysToDelete.push(key);
      }
    });
    for (const k of keysToDelete) {
      parsed.searchParams.delete(k);
    }

    // Remove empty search
    let search = parsed.search;
    if (search === '?') search = '';

    let pathname = parsed.pathname;
    // Remove trailing slash unless root path
    if (pathname.length > 1 && pathname.endsWith('/')) {
      pathname = pathname.slice(0, -1);
    }

    return `${parsed.protocol}//${parsed.hostname}${parsed.port ? ':' + parsed.port : ''}${pathname}${search}`;
  } catch {
    return rawUrl.trim().replace(/\/$/, '');
  }
}

export function extractDomain(url: string): string {
  if (!url || typeof url !== 'string') return '';
  try {
    const parsed = new URL(url.trim());
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

export function isValidHttpUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  try {
    const parsed = new URL(url.trim());
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}
