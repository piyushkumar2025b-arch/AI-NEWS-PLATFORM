export function decodeHtmlEntities(str: string): string {
  if (!str) return '';
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(Number(dec)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

export function stripHtml(html: string): string {
  if (!html) return '';
  return html.replace(/<[^>]*>?/gm, '').trim();
}

export function cleanTitle(
  raw: string,
  options?: { knownPublisher?: string; stripSyndicationSuffix?: boolean }
): string {
  if (!raw) return '';
  let text = stripHtml(raw);
  text = decodeHtmlEntities(text);

  if (options?.knownPublisher) {
    const pubEscaped = options.knownPublisher.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    text = text.replace(new RegExp(`\\s*[-|–—]\\s*${pubEscaped}$`, 'i'), '');
  }

  if (options?.stripSyndicationSuffix) {
    // Remove trailing publisher tags like "- TechCrunch" or "| Wired"
    text = text.replace(/\s*[-|–—]\s*[A-Z0-9][A-Za-z0-9\s.]{2,30}$/, '');
  }

  return text.trim();
}

export function calculateStringSimilarity(s1: string, s2: string): number {
  if (!s1 || !s2) return 0;
  if (s1 === s2) return 1.0;

  const prep1 = s1.toLowerCase().replace(/[^a-z0-9]/g, ' ').trim();
  const prep2 = s2.toLowerCase().replace(/[^a-z0-9]/g, ' ').trim();

  if (prep1 === prep2) return 1.0;

  const getBigrams = (str: string): Set<string> => {
    const bigrams = new Set<string>();
    for (let i = 0; i < str.length - 1; i++) {
      bigrams.add(str.slice(i, i + 2));
    }
    return bigrams;
  };

  const set1 = getBigrams(prep1);
  const set2 = getBigrams(prep2);

  if (set1.size === 0 || set2.size === 0) return 0;

  let intersection = 0;
  set1.forEach(bg => {
    if (set2.has(bg)) intersection++;
  });

  const union = set1.size + set2.size - intersection;
  return union === 0 ? 0 : intersection / union;
}
