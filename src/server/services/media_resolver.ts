import dns from 'dns';
import { extractDomain } from '../utils/urls.js';
import { isLowQualityMedia, upgradeMediaQuality } from '../utils/media_quality.js';

export class MediaResolver {
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

      const lookup = await dns.promises.lookup(host, { all: true });
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

  async resolveMedia(url: string): Promise<{ imageUrl?: string; ogTitle?: string } | null> {
    if (!url || typeof url !== 'string') return null;
    const isSafe = await this.verifyDnsSafety(url);
    if (!isSafe) return null;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3500);

      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        },
      });
      clearTimeout(timeout);

      if (!res.ok) return null;

      // Stream up to 100KB to parse head meta tags quickly without downloading full heavy page
      const reader = res.body?.getReader();
      if (!reader) return null;

      let receivedBytes = 0;
      const chunks: Uint8Array[] = [];
      while (receivedBytes < 100000) {
        const { done, value } = await reader.read();
        if (done || !value) break;
        chunks.push(value);
        receivedBytes += value.length;
      }
      reader.cancel().catch(() => {});

      const html = Buffer.concat(chunks).toString('utf8');

      // Match og:image, twitter:image, or article lead image
      const ogMatch =
        html.match(/<meta[^>]+(?:property|name)=["'](?:og:image|twitter:image|twitter:image:src)["'][^>]+content=["']([^"']+)["']/i) ||
        html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["'](?:og:image|twitter:image|twitter:image:src)["']/i) ||
        html.match(/<link[^>]+rel=["']image_src["'][^>]+href=["']([^"']+)["']/i);

      if (ogMatch && ogMatch[1]) {
        let rawImg = ogMatch[1].trim();
        if (rawImg.startsWith('//')) {
          rawImg = 'https:' + rawImg;
        } else if (rawImg.startsWith('/')) {
          const parsed = new URL(url);
          rawImg = `${parsed.protocol}//${parsed.host}${rawImg}`;
        }

        if (rawImg.startsWith('http') && !isLowQualityMedia(rawImg)) {
          const upgraded = upgradeMediaQuality(rawImg);
          return { imageUrl: upgraded || rawImg };
        }
      }
    } catch {
      // Graceful on network/timeout errors
    }

    return null;
  }
}

export const mediaResolver = new MediaResolver();
