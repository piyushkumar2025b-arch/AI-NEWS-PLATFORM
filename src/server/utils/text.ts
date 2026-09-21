const NAMED_HTML_ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
  '&nbsp;': ' ',
  '&mdash;': '—',
  '&ndash;': '–',
  '&hellip;': '…',
  '&ldquo;': '“',
  '&rdquo;': '”',
  '&lsquo;': '‘',
  '&rsquo;': '’',
  '&laquo;': '«',
  '&raquo;': '»',
  '&copy;': '©',
  '&trade;': '™',
  '&reg;': '®',
  '&bull;': '•',
  '&middot;': '·',
  '&euro;': '€',
  '&pound;': '£',
  '&yen;': '¥',
  '&cent;': '¢',
  '&sect;': '§',
  '&para;': '¶',
  '&dagger;': '†',
  '&Dagger;': '‡',
  '&prime;': '′',
  '&Prime;': '″',
  '&shy;': '',
};

export function decodeHtmlEntities(str: string): string {
  if (!str) return '';
  let res = str;
  for (const [entity, char] of Object.entries(NAMED_HTML_ENTITIES)) {
    if (res.includes(entity)) {
      res = res.replaceAll(entity, char);
    }
  }
  return res
    .replace(/&#(\d+);/g, (_, dec) => {
      const code = Number(dec);
      return code > 0 && code < 65536 ? String.fromCharCode(code) : '';
    })
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => {
      const code = parseInt(hex, 16);
      return code > 0 && code < 65536 ? String.fromCharCode(code) : '';
    });
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
