/**
 * High-performance client-side batch media resolver with in-flight deduplication,
 * memory caching, and request debouncing.
 * Collapses multiple individual OpenGraph image scrapes into a single batch POST.
 */

const clientResolvedMediaCache = new Map<string, string | null>();
const clientInFlightResolutions = new Map<string, Promise<string | null>>();

interface PendingItem {
  url: string;
  title?: string;
  resolve: (imageUrl: string | null) => void;
}

let pendingBatchQueue: PendingItem[] = [];
let batchTimeout: any = null;

function processBatchQueue() {
  if (pendingBatchQueue.length === 0) return;

  const currentBatch = pendingBatchQueue;
  pendingBatchQueue = [];
  batchTimeout = null;

  const urls = currentBatch.map(item => item.url);

  fetch('/api/v1/media/resolve-batch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ urls })
  })
    .then(res => res.json())
    .then(data => {
      const results: Record<string, string | null> = (data && data.results) || {};

      for (const item of currentBatch) {
        let img = results[item.url] || null;
        if (img && img.startsWith('http://')) {
          img = img.replace('http://', 'https://');
        }
        if (img && img.startsWith('/assets/editorial/')) {
          img = null;
        }
        clientResolvedMediaCache.set(item.url, img);
        clientInFlightResolutions.delete(item.url);
        item.resolve(img);
      }
    })
    .catch(() => {
      // Graceful fallback: resolve remaining items individually
      for (const item of currentBatch) {
        const singleUrl = `/api/v1/media/resolve?url=${encodeURIComponent(item.url)}&title=${encodeURIComponent(item.title || '')}`;
        fetch(singleUrl)
          .then(res => res.json())
          .then(data => {
            let img = (data.success && data.imageUrl && !data.imageUrl.startsWith('/assets/editorial/')) ? data.imageUrl : null;
            if (img && img.startsWith('http://')) img = img.replace('http://', 'https://');
            clientResolvedMediaCache.set(item.url, img);
            clientInFlightResolutions.delete(item.url);
            item.resolve(img);
          })
          .catch(() => {
            clientResolvedMediaCache.set(item.url, null);
            clientInFlightResolutions.delete(item.url);
            item.resolve(null);
          });
      }
    });
}

/**
 * Resolves an OpenGraph image for a publisher URL using batched deduplication.
 */
export function resolvePublisherMediaBatched(url: string, title?: string): Promise<string | null> {
  const cleanUrl = url.trim();
  if (!cleanUrl || !cleanUrl.startsWith('http')) {
    return Promise.resolve(null);
  }

  // 1. Instant memory cache hit (0 latency)
  if (clientResolvedMediaCache.has(cleanUrl)) {
    return Promise.resolve(clientResolvedMediaCache.get(cleanUrl) || null);
  }

  // 2. Already in-flight deduplication
  const inFlight = clientInFlightResolutions.get(cleanUrl);
  if (inFlight) {
    return inFlight;
  }

  // 3. Queue for batched HTTP dispatch
  const promise = new Promise<string | null>((resolve) => {
    pendingBatchQueue.push({ url: cleanUrl, title, resolve });

    if (!batchTimeout) {
      batchTimeout = setTimeout(processBatchQueue, 35);
    }
  });

  clientInFlightResolutions.set(cleanUrl, promise);
  return promise;
}

export function getCachedPublisherMedia(url: string): string | null | undefined {
  if (!url) return undefined;
  return clientResolvedMediaCache.get(url.trim());
}
