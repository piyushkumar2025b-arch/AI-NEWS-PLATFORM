/**
 * Client-Side Authentic Tech & AI Editorial Media Resolver.
 * Connects articles to genuine, high-resolution photography representing
 * real technology topics, labs, datacenters, microchips, robotics, and consumer devices.
 */

// Local static photography assets (zero-latency, guaranteed instant load, no CORS)
export const LOCAL_EDITORIAL_ASSETS = {
  ai_research: '/assets/editorial/ai_research.jpg',
  audiotech: '/assets/editorial/audiotech.jpg',
  biotech: '/assets/editorial/biotech.jpg',
  cybersecurity: '/assets/editorial/cybersecurity.jpg',
  datacenter: '/assets/editorial/datacenter.jpg',
  robotics: '/assets/editorial/robotics.jpg',
  silicon_chips: '/assets/editorial/silicon_chips.jpg',
  smart_glasses: '/assets/editorial/smart_glasses.jpg',
  ukraine_app: '/assets/editorial/cybersecurity.jpg',
};

export const TOPIC_PHOTOGRAPHY: Record<string, string[]> = {
  smart_glasses_wearables: [
    'https://images.unsplash.com/photo-1593508512255-86ab42a8e620?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=800&auto=format&fit=crop&q=80',
  ],
  silicon_chips_hardware: [
    'https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=800&auto=format&fit=crop&q=80',
  ],
  datacenter_cloud_energy: [
    'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1544197150-b99a580bb7a8?w=800&auto=format&fit=crop&q=80',
  ],
  robotics_automation: [
    'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1531746790731-6c087fecd65a?w=800&auto=format&fit=crop&q=80',
  ],
  cybersecurity_privacy: [
    'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1563986768609-322da13575f3?w=800&auto=format&fit=crop&q=80',
  ],
  biotech_health: [
    'https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1579154204601-01588f351e67?w=800&auto=format&fit=crop&q=80',
  ],
  audio_gadgets: [
    'https://images.unsplash.com/photo-1545454675-3531b543be5d?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&auto=format&fit=crop&q=80',
  ],
  ai_research_models: [
    'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?w=800&auto=format&fit=crop&q=80',
  ],
  code_devtools: [
    'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=800&auto=format&fit=crop&q=80',
  ],
  finance_enterprise: [
    'https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800&auto=format&fit=crop&q=80',
  ]
};

/**
 * Resolves a list of prioritized genuine photography URLs for an article based on its topic.
 */
export function getEditorialImageCandidates(
  title: string = '',
  category: string = 'technology',
  sourceId: string = '',
  domain: string = ''
): string[] {
  const t = (title || '').toLowerCase();
  const c = (category || '').toLowerCase();
  const s = (sourceId || '').toLowerCase();
  const d = (domain || '').toLowerCase();

  // 1. Ukraine Diia App / Government Tech
  if (t.includes('diia') || (t.includes('ukraine') && (t.includes('app') || t.includes('cyber')))) {
    return [LOCAL_EDITORIAL_ASSETS.ukraine_app, LOCAL_EDITORIAL_ASSETS.cybersecurity];
  }

  // 2. Smart Glasses, AR, Meta Connect, Ray-Ban, Muse, Wearables
  if (
    t.includes('smart glass') ||
    t.includes('glasses') ||
    t.includes('meta connect') ||
    t.includes('ray-ban') ||
    t.includes('quest') ||
    t.includes('headset') ||
    t.includes('muse') ||
    t.includes('wearable') ||
    t.includes('avatar')
  ) {
    return TOPIC_PHOTOGRAPHY.smart_glasses_wearables;
  }

  // 3. Silicon, Chips, GPUs, Nvidia, TSMC, Semiconductor, Hardware
  if (
    t.includes('nvidia') ||
    t.includes('gpu') ||
    t.includes('blackwell') ||
    t.includes('semiconductor') ||
    t.includes('silicon') ||
    t.includes('wafer') ||
    t.includes('tsmc') ||
    t.includes('microchip') ||
    t.includes('hardware') ||
    t.includes('cuda') ||
    c === 'ai-hardware'
  ) {
    return TOPIC_PHOTOGRAPHY.silicon_chips_hardware;
  }

  // 4. Data Centers, Power, Turbines, Cloud, Akamai, Neocloud, AWS, Infrastructure
  if (
    t.includes('data center') ||
    t.includes('datacenter') ||
    t.includes('turbine') ||
    t.includes('power') ||
    t.includes('energy') ||
    t.includes('akamai') ||
    t.includes('neocloud') ||
    t.includes('cloud') ||
    t.includes('server') ||
    t.includes('nscale') ||
    t.includes('crusoe')
  ) {
    return TOPIC_PHOTOGRAPHY.datacenter_cloud_energy;
  }

  // 5. Robotics, Humanoid, Embodied AI, Mechanical, Automation
  if (
    t.includes('robot') ||
    t.includes('humanoid') ||
    t.includes('embodied') ||
    t.includes('boston dynamics') ||
    t.includes('actuator') ||
    t.includes('drone') ||
    c === 'robotics'
  ) {
    return TOPIC_PHOTOGRAPHY.robotics_automation;
  }

  // 6. Cybersecurity, Security, Breach, Hack, Exposing, Privacy, Unsecured
  if (
    t.includes('security') ||
    t.includes('breach') ||
    t.includes('scam') ||
    t.includes('unsecured') ||
    t.includes('expos') ||
    t.includes('privacy') ||
    t.includes('hacker') ||
    t.includes('credit card') ||
    c === 'cybersecurity'
  ) {
    return TOPIC_PHOTOGRAPHY.cybersecurity_privacy;
  }

  // 7. Biotechnology, Healthcare, Pancreatic, DNA, Medical, Disease, Cell
  if (
    t.includes('health') ||
    t.includes('pancreatic') ||
    t.includes('cell') ||
    t.includes('dna') ||
    t.includes('biology') ||
    t.includes('medical') ||
    t.includes('pet dna') ||
    t.includes('cancer') ||
    t.includes('drug')
  ) {
    return TOPIC_PHOTOGRAPHY.biotech_health;
  }

  // 8. Audio, Speaker, Music, Sound, Podcast
  if (
    t.includes('speaker') ||
    t.includes('audio') ||
    t.includes('sound') ||
    t.includes('podcast') ||
    t.includes('jbl') ||
    t.includes('sony') ||
    t.includes('headphones')
  ) {
    return TOPIC_PHOTOGRAPHY.audio_gadgets;
  }

  // 9. Developer Tools, Code, Open Source, Supabase, GitHub, Database
  if (
    t.includes('supabase') ||
    t.includes('github') ||
    t.includes('developer') ||
    t.includes('open source') ||
    t.includes('database') ||
    t.includes('coding') ||
    s === 'github' ||
    c === 'developer-tools' ||
    c === 'programming'
  ) {
    return TOPIC_PHOTOGRAPHY.code_devtools;
  }

  // 10. Finance, IPO, Funding, Acquisition, Venture Capital, Wall Street
  if (
    t.includes('ipo') ||
    t.includes('billion') ||
    t.includes('funding') ||
    t.includes('invest') ||
    t.includes('venture') ||
    t.includes('valuation') ||
    t.includes('convertible') ||
    t.includes('wall street') ||
    t.includes('shares')
  ) {
    return TOPIC_PHOTOGRAPHY.finance_enterprise;
  }

  // 11. AI Frontier, Research, LLMs, Anthropic, Dario Amodei, OpenAI, Gemini, Meta
  if (
    t.includes('anthropic') ||
    t.includes('amodei') ||
    t.includes('openai') ||
    t.includes('gemini') ||
    t.includes('deepmind') ||
    t.includes('chatgpt') ||
    t.includes('claude') ||
    t.includes('math') ||
    t.includes('algorithm') ||
    t.includes('agent') ||
    t.includes('arxiv') ||
    c === 'ai' ||
    c === 'llms' ||
    c === 'machine-learning' ||
    s === 'arxiv'
  ) {
    return TOPIC_PHOTOGRAPHY.ai_research_models;
  }

  // Default tech editorial candidates
  return [
    LOCAL_EDITORIAL_ASSETS.ai_research,
    LOCAL_EDITORIAL_ASSETS.datacenter,
    LOCAL_EDITORIAL_ASSETS.silicon_chips,
    ...TOPIC_PHOTOGRAPHY.ai_research_models
  ];
}

/**
 * Returns a primary high-resolution photography image URL for an article.
 * Guaranteed to return a non-null, real photography URL.
 */
export function getEditorialImage(
  title: string = '',
  category: string = 'technology',
  sourceId: string = '',
  domain: string = ''
): string | null {
  const candidates = getEditorialImageCandidates(title, category, sourceId, domain);
  return candidates[0] || null;
}

export const CATEGORY_EDITORIAL_PHOTOS: Record<string, string[]> = TOPIC_PHOTOGRAPHY;
export const SOURCE_EDITORIAL_PHOTOS: Record<string, string | null> = {};

