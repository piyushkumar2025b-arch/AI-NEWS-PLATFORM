/**
 * Ultra-fast, zero-latency vector OpenGraph card generator.
 * Generates authentic, high-contrast, responsive SVG cards for articles with
 * real titles, verified publisher branding, category styling, and geometric tech accents.
 */

function escapeXml(unsafe: string): string {
  return (unsafe || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

interface CardTheme {
  primary: string;
  secondary: string;
  accent: string;
  bgGradStart: string;
  bgGradEnd: string;
  label: string;
  iconType: string;
}

const CATEGORY_THEMES: Record<string, CardTheme> = {
  'ai': {
    primary: '#6366f1',
    secondary: '#8b5cf6',
    accent: '#a855f7',
    bgGradStart: '#090d16',
    bgGradEnd: '#131b2e',
    label: 'ARTIFICIAL INTELLIGENCE',
    iconType: 'sparkles'
  },
  'llms': {
    primary: '#8b5cf6',
    secondary: '#c084fc',
    accent: '#ec4899',
    bgGradStart: '#0c0a17',
    bgGradEnd: '#1e1635',
    label: 'LLMS & FOUNDATION MODELS',
    iconType: 'cpu'
  },
  'machine-learning': {
    primary: '#0ea5e9',
    secondary: '#38bdf8',
    accent: '#6366f1',
    bgGradStart: '#070f1e',
    bgGradEnd: '#0f243d',
    label: 'MACHINE LEARNING',
    iconType: 'network'
  },
  'ai-agents': {
    primary: '#10b981',
    secondary: '#34d399',
    accent: '#06b6d4',
    bgGradStart: '#061412',
    bgGradEnd: '#0d2821',
    label: 'AUTONOMOUS AI AGENTS',
    iconType: 'bot'
  },
  'open-source-ai': {
    primary: '#22c55e',
    secondary: '#4ade80',
    accent: '#10b981',
    bgGradStart: '#06130b',
    bgGradEnd: '#0c2716',
    label: 'OPEN SOURCE AI',
    iconType: 'git'
  },
  'robotics': {
    primary: '#f97316',
    secondary: '#fb923c',
    accent: '#eab308',
    bgGradStart: '#140c06',
    bgGradEnd: '#29180c',
    label: 'ROBOTICS & EMBODIED AI',
    iconType: 'robot'
  },
  'ai-hardware': {
    primary: '#eab308',
    secondary: '#facc15',
    accent: '#f97316',
    bgGradStart: '#131006',
    bgGradEnd: '#28210c',
    label: 'AI HARDWARE & SILICON',
    iconType: 'chip'
  },
  'programming': {
    primary: '#3b82f6',
    secondary: '#60a5fa',
    accent: '#06b6d4',
    bgGradStart: '#080f1d',
    bgGradEnd: '#101d36',
    label: 'SOFTWARE ENGINEERING',
    iconType: 'code'
  },
  'developer-tools': {
    primary: '#38bdf8',
    secondary: '#818cf8',
    accent: '#c084fc',
    bgGradStart: '#07111c',
    bgGradEnd: '#112236',
    label: 'DEVELOPER PLATFORMS',
    iconType: 'terminal'
  },
  'research': {
    primary: '#a855f7',
    secondary: '#c084fc',
    accent: '#38bdf8',
    bgGradStart: '#0d0a18',
    bgGradEnd: '#1b1430',
    label: 'SCIENTIFIC RESEARCH',
    iconType: 'book'
  },
  'cybersecurity': {
    primary: '#ef4444',
    secondary: '#f87171',
    accent: '#f97316',
    bgGradStart: '#140808',
    bgGradEnd: '#2a1111',
    label: 'AI SECURITY & SAFETY',
    iconType: 'shield'
  },
  'technology': {
    primary: '#64748b',
    secondary: '#94a3b8',
    accent: '#38bdf8',
    bgGradStart: '#090d14',
    bgGradEnd: '#121a27',
    label: 'TECH INTELLIGENCE',
    iconType: 'tech'
  }
};

interface PublisherBadge {
  name: string;
  color: string;
  bg: string;
  code: string;
}

const PUBLISHER_BADGES: Record<string, PublisherBadge> = {
  'openai': { name: 'OpenAI Official', color: '#10a37f', bg: 'rgba(16,163,127,0.15)', code: 'OAI' },
  'anthropic_ai': { name: 'Anthropic / Claude', color: '#d97706', bg: 'rgba(217,119,6,0.15)', code: 'ANT' },
  'deepseek_ai': { name: 'DeepSeek AI', color: '#0284c7', bg: 'rgba(2,132,199,0.15)', code: 'DSK' },
  'mistral_ai': { name: 'Mistral AI', color: '#ea580c', bg: 'rgba(234,88,12,0.15)', code: 'MST' },
  'google_news': { name: 'Google Tech News', color: '#4285f4', bg: 'rgba(66,133,244,0.15)', code: 'GOOG' },
  'github': { name: 'GitHub Open Source', color: '#f0f6fc', bg: 'rgba(255,255,255,0.15)', code: 'GH' },
  'huggingface': { name: 'Hugging Face Hub', color: '#ffd21e', bg: 'rgba(255,210,30,0.18)', code: 'HF' },
  'arxiv': { name: 'arXiv Preprint Server', color: '#b31b1b', bg: 'rgba(179,27,27,0.18)', code: 'arXiv' },
  'hackernews': { name: 'Hacker News', color: '#ff6600', bg: 'rgba(255,102,0,0.18)', code: 'Y/C' },
  'lobsters': { name: 'Lobsters Community', color: '#e04006', bg: 'rgba(224,64,6,0.18)', code: 'LOB' },
  'reddit': { name: 'Reddit Tech', color: '#ff4500', bg: 'rgba(255,69,0,0.18)', code: 'RED' },
  'pypi_updates': { name: 'PyPI Python Ecosystem', color: '#3776ab', bg: 'rgba(55,118,171,0.18)', code: 'PYPI' },
  'nature_ai': { name: 'Nature Machine Intelligence', color: '#0072ce', bg: 'rgba(0,114,206,0.18)', code: 'NAT' },
  'semantic_scholar': { name: 'Semantic Scholar AI', color: '#1857b6', bg: 'rgba(24,87,182,0.18)', code: 'S2' },
  'bloomberg_tech': { name: 'Bloomberg Technology', color: '#ff6900', bg: 'rgba(255,105,0,0.15)', code: 'BBG' },
  'reuters_tech': { name: 'Reuters Tech Wire', color: '#ff8000', bg: 'rgba(255,128,0,0.15)', code: 'RT' },
  'wsj_tech': { name: 'Wall Street Journal Tech', color: '#0080c6', bg: 'rgba(0,128,198,0.15)', code: 'WSJ' },
  'wired': { name: 'WIRED Magazine', color: '#ffffff', bg: 'rgba(255,255,255,0.15)', code: 'WRD' },
  'substack': { name: 'Substack Tech Dispatch', color: '#ff6719', bg: 'rgba(255,103,25,0.18)', code: 'SUB' },
  'venturebeat_ai': { name: 'VentureBeat AI', color: '#22c55e', bg: 'rgba(34,197,94,0.15)', code: 'VB' }
};

function splitTitleIntoLines(title: string, maxCharsPerLine: number = 38): string[] {
  const words = (title || 'AI & Technology Intelligence Report').trim().split(/\s+/);
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    if ((currentLine + ' ' + word).trim().length <= maxCharsPerLine) {
      currentLine = (currentLine + ' ' + word).trim();
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
      if (lines.length >= 3) {
        // Limit to 3 lines max and append ellipsis
        lines[2] = lines[2].length > maxCharsPerLine - 3 
          ? lines[2].slice(0, maxCharsPerLine - 3) + '...' 
          : lines[2] + '...';
        break;
      }
    }
  }

  if (currentLine && lines.length < 3) {
    lines.push(currentLine);
  }

  return lines.length > 0 ? lines : ['Technology Intelligence Briefing'];
}

export function generateCardSvg(
  rawTitle: string,
  rawCategory: string = 'technology',
  sourceId: string = '',
  domain: string = ''
): string {
  const catKey = (rawCategory || 'technology').toLowerCase().trim();
  const theme = CATEGORY_THEMES[catKey] || CATEGORY_THEMES['technology'];
  
  const cleanSourceId = (sourceId || '').toLowerCase().trim();
  let publisher = PUBLISHER_BADGES[cleanSourceId];

  if (!publisher && domain) {
    const cleanDomain = domain.toLowerCase().replace(/^www\./, '');
    for (const [key, badge] of Object.entries(PUBLISHER_BADGES)) {
      if (cleanDomain.includes(key) || key.includes(cleanDomain)) {
        publisher = badge;
        break;
      }
    }
    if (!publisher) {
      publisher = {
        name: cleanDomain.toUpperCase(),
        color: theme.primary,
        bg: 'rgba(255,255,255,0.08)',
        code: cleanDomain.slice(0, 3).toUpperCase()
      };
    }
  } else if (!publisher) {
    publisher = {
      name: (cleanSourceId || 'TECH SOURCE').toUpperCase().replace(/_/g, ' '),
      color: theme.primary,
      bg: 'rgba(255,255,255,0.08)',
      code: (cleanSourceId || 'AI').slice(0, 3).toUpperCase()
    };
  }

  const lines = splitTitleIntoLines(rawTitle);
  const escapedLines = lines.map(line => escapeXml(line));
  const escapedPublisher = escapeXml(publisher.name);
  const escapedCategory = escapeXml(theme.label);
  const escapedDomain = escapeXml(domain || 'live feed');

  // Compute title vertical offsets
  const startY = lines.length === 1 ? 290 : lines.length === 2 ? 265 : 240;
  const lineSpacing = 52;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630">
  <defs>
    <!-- Background Gradient -->
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${theme.bgGradStart}"/>
      <stop offset="60%" stop-color="${theme.bgGradEnd}"/>
      <stop offset="100%" stop-color="#05080e"/>
    </linearGradient>

    <!-- Accent Glow Radial -->
    <radialGradient id="glowGrad" cx="85%" cy="20%" r="55%">
      <stop offset="0%" stop-color="${theme.primary}" stop-opacity="0.25"/>
      <stop offset="50%" stop-color="${theme.secondary}" stop-opacity="0.10"/>
      <stop offset="100%" stop-color="${theme.bgGradStart}" stop-opacity="0"/>
    </radialGradient>

    <!-- Bottom Left Subtle Glow -->
    <radialGradient id="bottomGlow" cx="15%" cy="90%" r="45%">
      <stop offset="0%" stop-color="${theme.accent}" stop-opacity="0.16"/>
      <stop offset="100%" stop-color="${theme.bgGradStart}" stop-opacity="0"/>
    </radialGradient>

    <!-- Tech Grid Pattern -->
    <pattern id="techGrid" width="48" height="48" patternUnits="userSpaceOnUse">
      <path d="M 48 0 L 0 0 0 48" fill="none" stroke="rgba(255, 255, 255, 0.035)" stroke-width="1"/>
      <circle cx="48" cy="48" r="1.5" fill="rgba(255, 255, 255, 0.08)"/>
    </pattern>

    <!-- Border Linear Gradient -->
    <linearGradient id="borderGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${theme.primary}" stop-opacity="0.6"/>
      <stop offset="50%" stop-color="rgba(255, 255, 255, 0.1)"/>
      <stop offset="100%" stop-color="${theme.secondary}" stop-opacity="0.4"/>
    </linearGradient>
  </defs>

  <!-- Background Base -->
  <rect width="1200" height="630" fill="url(#bgGrad)"/>
  <rect width="1200" height="630" fill="url(#glowGrad)"/>
  <rect width="1200" height="630" fill="url(#bottomGlow)"/>

  <!-- High-Tech Geometric Grid -->
  <rect width="1200" height="630" fill="url(#techGrid)"/>

  <!-- Circuit Lines Decorator -->
  <g opacity="0.3">
    <path d="M 850 60 L 1020 60 L 1100 140 L 1100 240" fill="none" stroke="${theme.primary}" stroke-width="2" stroke-dasharray="6,6"/>
    <circle cx="1100" cy="240" r="4" fill="${theme.primary}"/>
    <path d="M 900 120 L 1050 120 L 1120 190" fill="none" stroke="${theme.secondary}" stroke-width="1.5"/>
    <circle cx="1120" cy="190" r="3" fill="${theme.secondary}"/>
  </g>

  <!-- Outer Card Frame -->
  <rect x="24" y="24" width="1152" height="582" rx="20" fill="none" stroke="url(#borderGrad)" stroke-width="1.5"/>

  <!-- Top Metadata Header -->
  <g transform="translate(64, 76)">
    <!-- Category Pill -->
    <rect x="0" y="0" width="260" height="38" rx="8" fill="rgba(255, 255, 255, 0.06)" stroke="${theme.primary}" stroke-width="1.2" stroke-opacity="0.5"/>
    <circle cx="18" cy="19" r="5" fill="${theme.primary}"/>
    <text x="32" y="24" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13" font-weight="700" fill="#f8fafc" letter-spacing="1.2">${escapedCategory}</text>
  </g>

  <!-- Publisher Badge in Top Right -->
  <g transform="translate(860, 76)">
    <rect x="0" y="0" width="276" height="38" rx="8" fill="${publisher.bg}" stroke="${publisher.color}" stroke-width="1" stroke-opacity="0.6"/>
    <rect x="8" y="7" width="34" height="24" rx="5" fill="${publisher.color}"/>
    <text x="25" y="23" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="800" fill="#0b0f19" text-anchor="middle">${escapeXml(publisher.code)}</text>
    <text x="50" y="24" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13" font-weight="600" fill="#f1f5f9">${escapedPublisher}</text>
  </g>

  <!-- Main Article Headline (Large, Crisp, Multi-line) -->
  <g id="headline" transform="translate(64, 0)">
    ${escapedLines
      .map(
        (line, idx) =>
          `<text x="0" y="${startY + idx * lineSpacing}" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif" font-size="44" font-weight="800" fill="#ffffff" letter-spacing="-0.025em">${line}</text>`
      )
      .join('\n    ')}
  </g>

  <!-- Bottom Metadata Footer -->
  <g transform="translate(64, 535)">
    <!-- Decorative Accent Line -->
    <line x1="0" y1="-24" x2="1072" y2="-24" stroke="rgba(255, 255, 255, 0.08)" stroke-width="1"/>

    <!-- Source Origin Indicator -->
    <circle cx="8" cy="8" r="3.5" fill="${theme.primary}"/>
    <text x="22" y="12" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13" font-weight="600" fill="#94a3b8">ORIGINAL REPORTING</text>
    
    <text x="180" y="12" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13" font-weight="400" fill="#475569">|</text>
    
    <text x="198" y="12" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13" font-weight="600" fill="${theme.secondary}">${escapedDomain}</text>

    <!-- Platform Stamp on Right -->
    <text x="1072" y="12" text-anchor="end" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="12" font-weight="600" fill="rgba(255, 255, 255, 0.35)" letter-spacing="1">FRONTIER AI &amp; TECH NEWS</text>
  </g>
</svg>`;
}
