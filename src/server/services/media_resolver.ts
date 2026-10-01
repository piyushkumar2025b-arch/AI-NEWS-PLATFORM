import dns from 'dns';
import http from 'http';
import https from 'https';
import { extractDomain } from '../utils/urls.js';
import { isLowQualityMedia, upgradeMediaQuality } from '../utils/media_quality.js';

export class MediaResolver {
  private resolvedCache = new Map<string, string | null>();
  private readonly maxCacheSize = 2000;

  private parseIpv4ToNumber(parts: number[]): number {
    return ((parts[0] << 24) >>> 0) + (parts[1] << 16) + (parts[2] << 8) + parts[3];
  }

  isPrivateOrRestrictedHost(rawHost: string): boolean {
    if (!rawHost || typeof rawHost !== 'string') return true;
    let host = rawHost.trim().toLowerCase();

    // Strip square brackets for IPv6
    if (host.startsWith('[') && host.endsWith(']')) {
      host = host.slice(1, -1);
    }

    // Localhost checks
    if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) {
      return true;
    }

    // IPv6 checks
    if (host.includes(':')) {
      if (host === '::1' || host === '::' || host === '0:0:0:0:0:0:0:1') return true;
      if (host.startsWith('fe80:') || host.startsWith('fc00:') || host.startsWith('fd')) return true;
      if (host.startsWith('::ffff:')) {
        const mapped = host.slice(7);
        return this.isPrivateOrRestrictedHost(mapped);
      }
      return false;
    }

    // Handle single hex integer representation: e.g. 0x7f000001
    if (/^0x[0-9a-f]+$/i.test(host)) {
      const num = parseInt(host, 16);
      return this.isPrivateIpNumber(num);
    }

    // Handle single decimal integer: e.g. 2130706433
    if (/^\d+$/.test(host)) {
      const num = parseInt(host, 10);
      return this.isPrivateIpNumber(num);
    }

    // Check for standard or octal dot-notation IPv4
    const dotParts = host.split('.');
    if (dotParts.length === 4) {
      const parsedParts: number[] = [];
      for (const p of dotParts) {
        if (/^0[0-7]+$/.test(p)) {
          parsedParts.push(parseInt(p, 8));
        } else if (/^\d+$/.test(p)) {
          parsedParts.push(parseInt(p, 10));
        } else if (/^0x[0-9a-f]+$/i.test(p)) {
          parsedParts.push(parseInt(p, 16));
        } else {
          return false; // not pure numeric IPv4, treat as domain
        }
      }

      if (parsedParts.some(p => isNaN(p) || p < 0 || p > 255)) {
        return true;
      }

      const ipNum = this.parseIpv4ToNumber(parsedParts);
      return this.isPrivateIpNumber(ipNum);
    }

    return false;
  }

  private isPrivateIpNumber(num: number): boolean {
    const a = (num >>> 24) & 255;
    const b = (num >>> 16) & 255;
    const c = (num >>> 8) & 255;
    const d = num & 255;

    // 0.0.0.0/8
    if (a === 0) return true;
    // 10.0.0.0/8
    if (a === 10) return true;
    // 127.0.0.0/8
    if (a === 127) return true;
    // 100.64.0.0/10 (100.64.0.0 to 100.127.255.255 - CGNAT)
    if (a === 100 && b >= 64 && b <= 127) return true;
    // 169.254.0.0/16 (Link Local / Cloud Metadata)
    if (a === 169 && b === 254) return true;
    // 172.16.0.0/12 (172.16.0.0 to 172.31.255.255)
    if (a === 172 && b >= 16 && b <= 31) return true;
    // 192.168.0.0/16
    if (a === 192 && b === 168) return true;

    return false;
  }

  async verifyDnsSafety(hostOrUrl: string): Promise<boolean> {
    try {
      let host = hostOrUrl;
      if (hostOrUrl.includes('://')) {
        host = extractDomain(hostOrUrl);
      } else {
        host = host.split(':')[0];
      }

      if (this.isPrivateOrRestrictedHost(host)) {
        return false;
      }

      const lookup = await dns.promises.lookup(host, { family: 4, all: true });
      for (const entry of lookup) {
        if (this.isPrivateOrRestrictedHost(entry.address)) {
          return false;
        }
      }
      return true;
    } catch {
      return false;
    }
  }

  async resolveMedia(targetUrl: string, maxRedirects: number = 3): Promise<{ imageUrl?: string; ogTitle?: string } | null> {
    if (!targetUrl || typeof targetUrl !== 'string') return null;
    const cleanUrl = targetUrl.trim();

    if (this.resolvedCache.has(cleanUrl)) {
      const cached = this.resolvedCache.get(cleanUrl);
      return cached ? { imageUrl: cached } : null;
    }

    // Immediate YouTube video thumbnail extraction
    const ytMatch = cleanUrl.match(/(?:youtube\.com\/(?:watch\?v=|v\/|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i);
    if (ytMatch) {
      const ytImg = `https://i.ytimg.com/vi/${ytMatch[1]}/hqdefault.jpg`;
      this.cacheResult(cleanUrl, ytImg);
      return { imageUrl: ytImg };
    }

    const isSafe = await this.verifyDnsSafety(cleanUrl);
    if (!isSafe) {
      this.cacheResult(cleanUrl, null);
      return null;
    }

    return new Promise(resolve => {
      try {
        const parsed = new URL(cleanUrl);
        const client = parsed.protocol === 'https:' ? https : http;

        const req = client.get(
          parsed,
          {
            family: 4, // Explicitly enforce IPv4 to eliminate container IPv6 black-hole stalling
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
              'Accept-Language': 'en-US,en;q=0.9',
            },
            timeout: 3000,
          },
          res => {
            // Handle redirects
            if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && maxRedirects > 0) {
              req.destroy();
              try {
                const nextUrl = new URL(res.headers.location, cleanUrl).toString();
                return resolve(this.resolveMedia(nextUrl, maxRedirects - 1));
              } catch {
                this.cacheResult(cleanUrl, null);
                return resolve(null);
              }
            }

            if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 400) {
              req.destroy();
              this.cacheResult(cleanUrl, null);
              return resolve(null);
            }

            let html = '';
            let resolved = false;

            res.on('data', chunk => {
              if (resolved) return;
              html += chunk.toString('utf8');

              // 1. Meta tag inspection
              const ogMatch =
                html.match(/<meta[^>]+(?:property|name)=["'](?:og:image|og:image:secure_url|twitter:image|twitter:image:src)["'][^>]+content=["']([^"']+)["']/i) ||
                html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["'](?:og:image|og:image:secure_url|twitter:image|twitter:image:src)["']/i) ||
                html.match(/<link[^>]+rel=["']image_src["'][^>]+href=["']([^"']+)["']/i);

              if (ogMatch && ogMatch[1]) {
                resolved = true;
                req.destroy();
                const cleanImg = this.sanitizeExtractedUrl(ogMatch[1].trim(), cleanUrl);
                if (cleanImg) {
                  this.cacheResult(cleanUrl, cleanImg);
                  return resolve({ imageUrl: cleanImg });
                }
              }

              // 2. Schema.org JSON-LD image inspection
              const jsonLdMatch = html.match(/"image"\s*:\s*(?:\[\s*)?["'](https?:\/\/[^"']+)["']/i);
              if (jsonLdMatch && jsonLdMatch[1]) {
                resolved = true;
                req.destroy();
                const cleanImg = this.sanitizeExtractedUrl(jsonLdMatch[1].trim(), cleanUrl);
                if (cleanImg) {
                  this.cacheResult(cleanUrl, cleanImg);
                  return resolve({ imageUrl: cleanImg });
                }
              }

              // Cut off stream after </head> or 120KB to prevent downloading entire page
              if (html.includes('</head>') || html.length > 120000) {
                resolved = true;
                req.destroy();
                this.cacheResult(cleanUrl, null);
                return resolve(null);
              }
            });

            res.on('end', () => {
              if (!resolved) {
                this.cacheResult(cleanUrl, null);
                resolve(null);
              }
            });

            res.on('error', () => {
              if (!resolved) {
                this.cacheResult(cleanUrl, null);
                resolve(null);
              }
            });
          }
        );

        req.on('timeout', () => {
          req.destroy();
          this.cacheResult(cleanUrl, null);
          resolve(null);
        });

        req.on('error', () => {
          this.cacheResult(cleanUrl, null);
          resolve(null);
        });
      } catch {
        this.cacheResult(cleanUrl, null);
        resolve(null);
      }
    });
  }

  private sanitizeExtractedUrl(rawImg: string, baseUrl: string): string | null {
    if (!rawImg) return null;
    let url = rawImg;
    if (url.startsWith('//')) {
      url = 'https:' + url;
    } else if (url.startsWith('/')) {
      try {
        const parsed = new URL(baseUrl);
        url = `${parsed.protocol}//${parsed.host}${url}`;
      } catch {
        return null;
      }
    }

    if (!url.startsWith('http') || isLowQualityMedia(url)) {
      return null;
    }

    const upgraded = upgradeMediaQuality(url);
    return upgraded || url;
  }

  private cacheResult(url: string, result: string | null) {
    if (this.resolvedCache.size >= this.maxCacheSize) {
      const first = this.resolvedCache.keys().next().value;
      if (first) this.resolvedCache.delete(first);
    }
    this.resolvedCache.set(url, result);
  }
}

export const mediaResolver = new MediaResolver();
