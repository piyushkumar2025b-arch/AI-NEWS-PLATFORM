import React, { useState, useMemo } from 'react';
import {
  Server,
  Play,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  Zap,
  Key,
  Shield,
  RefreshCw,
  Layers,
  Globe,
  Search,
  Plus,
  Radio,
  Tag,
  Sparkles,
  ExternalLink,
  Cpu,
  Bot,
  Binary,
  Microscope,
  Check,
  X,
  Rocket,
  Terminal,
  Brain,
  Network,
  Wrench,
  Database,
  Video
} from 'lucide-react';
import { SourceInfo } from '../types.js';

interface SourcesPanelProps {
  sources: SourceInfo[];
  onTriggerFetch: (sourceId: string) => Promise<any>;
  onToggleSource: (sourceId: string, enabled: boolean) => Promise<void>;
  refreshSources: () => void;
  showNotification?: (type: 'error' | 'success' | 'info', message: string, title?: string) => void;
}

// Curated expansion packs for 1-click activation and batch ingestion
interface CuratedPack {
  id: string;
  name: string;
  badge: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  sourceIds: string[];
}

const CURATED_PACKS: CuratedPack[] = [
  {
    id: 'frontier_labs',
    name: 'Frontier AI Labs & Foundation Models',
    badge: 'Premier Labs',
    description: 'Direct feeds from Cohere, Scale AI, Allen Institute (AI2), EleutherAI, Character.AI, and Stability AI.',
    icon: Sparkles,
    sourceIds: ['cohere_blog', 'scale_ai_blog', 'allen_ai', 'eleuther_ai', 'character_ai', 'stability_ai']
  },
  {
    id: 'robotics_physical',
    name: 'Humanoid Robotics & Physical AI',
    badge: 'Robotics',
    description: 'Autonomous systems, locomotion, and manipulation from IEEE Spectrum, The Robot Report, Boston Dynamics, and CMU SCS.',
    icon: Bot,
    sourceIds: ['ieee_robotics', 'the_robot_report', 'boston_dynamics', 'cmu_scs_news']
  },
  {
    id: 'silicon_supercomputing',
    name: 'AI Silicon, EDA & Supercomputing',
    badge: 'Hardware',
    description: 'Hardware accelerators and node fabrication from Cerebras, Groq, SemiWiki, and Tom\'s Hardware Silicon.',
    icon: Cpu,
    sourceIds: ['cerebras_blog', 'groq_blog', 'semiwiki', 'tomshardware_silicon']
  },
  {
    id: 'rag_serving_tooling',
    name: 'RAG Frameworks, Serving & Fine-Tuning',
    badge: 'Developer Tools',
    description: 'Essential infrastructure from LangChain, LlamaIndex, Pinecone, Qdrant, vLLM Project, Ollama, and Unsloth AI.',
    icon: Binary,
    sourceIds: ['langchain_blog', 'llamaindex_blog', 'pinecone_blog', 'qdrant_blog', 'vllm_project', 'ollama_blog', 'unsloth_blog']
  },
  {
    id: 'science_quantum_safety',
    name: 'AI Safety, Quantum & Theoretical Science',
    badge: 'Research',
    description: 'Empirical scaling and governance from AI Alignment Forum, Epoch AI, Oxford Institute, IBM Quantum, and Quanta Magazine.',
    icon: Microscope,
    sourceIds: ['alignment_forum', 'epoch_ai', 'oxford_ai_institute', 'ibm_quantum_blog', 'quantamagazine_ai', 'nature_machine_intelligence']
  },
  {
    id: 'cybersecurity_threats',
    name: 'Cybersecurity, Vulnerabilities & Threat Defense',
    badge: 'Security',
    description: 'Zero-days, enterprise threat campaigns, malware, and cryptography from The Hacker News, BleepingComputer, Krebs on Security, Dark Reading, and Schneier on Security.',
    icon: Shield,
    sourceIds: ['thehackernews', 'bleepingcomputer', 'krebsonsecurity', 'darkreading', 'schneier_security']
  },
  {
    id: 'hyperscale_datacenter',
    name: 'Hyperscale Datacenter, Cloud & Silicon',
    badge: 'Infrastructure',
    description: 'GPU cluster hardware, supercomputing, interconnects, and edge systems from ServeTheHome, The Next Platform, EE Times, and Cloudflare.',
    icon: Server,
    sourceIds: ['servethehome', 'nextplatform', 'eetimes', 'cloudflare_blog']
  },
  {
    id: 'engineering_systems_craft',
    name: 'Engineering Systems, Architecture & Strategy',
    badge: 'Architecture',
    description: 'High-scale system design, developer productivity, and tech strategy from The Pragmatic Engineer, ByteByteGo, Vercel, GitHub, Stratechery, and Benedict Evans.',
    icon: Layers,
    sourceIds: ['pragmatic_engineer', 'bytebytego', 'vercel_blog', 'github_blog', 'stratechery', 'ben_evans']
  },
  {
    id: 'space_frontier_science',
    name: 'Aerospace, Space Exploration & Multidisciplinary Science',
    badge: 'Aerospace',
    description: 'Artemis lunar mission telemetry, deep space observations, cosmology, and multidisciplinary research from NASA, SpaceNews, ESA, Nature, and Neuroscience News.',
    icon: Rocket,
    sourceIds: ['nasa_breaking', 'spacenews', 'esa_news', 'nature_news', 'neurosciencenews']
  },
  {
    id: 'cloud_native_systems',
    name: 'Cloud-Native Runtimes, Kernels & Compilers',
    badge: 'Core Systems',
    description: 'Container runtimes, systems languages, and hardware benchmarks from Kubernetes CNCF, Go, Rust, Deno, Bun, Astral (uv/ruff), Linux Kernel (Phoronix), and Meta Engineering.',
    icon: Terminal,
    sourceIds: ['kubernetes_blog', 'golang_blog', 'rust_blog', 'deno_blog', 'bun_blog', 'astral_blog', 'phoronix_linux', 'aws_architecture', 'meta_engineering']
  },
  {
    id: 'frontier_ai_pioneers',
    name: 'Frontier AI Practitioners & Research Pioneers',
    badge: 'AI Pioneers',
    description: 'Applied LLM architectures, agent memory, fine-tuning dynamics, and open weights from Simon Willison, Lil\'Log, Sebastian Raschka, Chip Huyen, Hugging Face, PyTorch, and MIT CSAIL.',
    icon: Brain,
    sourceIds: ['simon_willison', 'lilian_weng', 'sebastian_raschka', 'chip_huyen', 'huggingface_blog', 'pytorch_blog', 'mit_ai_news']
  },
  {
    id: 'edge_mesh_observability',
    name: 'Mesh Networking, Distributed Edge & Observability',
    badge: 'Distributed Systems',
    description: 'WireGuard mesh routing, microVMs, global financial resilience, and telemetry from Tailscale, Fly.io, Stripe, GitHub, Grafana, Honeycomb, and Sentry.',
    icon: Network,
    sourceIds: ['tailscale_blog', 'fly_io_blog', 'stripe_engineering', 'github_engineering', 'grafana_blog', 'honeycomb_blog', 'sentry_blog']
  },
  {
    id: 'robotics_hardware_physics',
    name: 'Autonomous Robotics, Maker Silicon & Quantum Physics',
    badge: 'Physical Tech',
    description: 'Autonomous ROS robotics, humanoid automation, embedded microcontrollers, LHC quantum experiments, and cryptography from ROS, IEEE Robotics, Hackaday, Adafruit, CERN, and Vitalik Buterin.',
    icon: Wrench,
    sourceIds: ['ros_discourse', 'ieee_robotics', 'hackaday', 'adafruit_blog', 'cern_courier', 'vitalik_blog']
  },
  {
    id: 'scale_infrastructure_giants',
    name: 'Hyper-Scale Infrastructure, Platforms & Compilers',
    badge: 'Platform Scale',
    description: 'Flash-sale scaling, multi-player canvas engines, JIT compilers, and telemetry from Shopify, Slack, Spotify, Airbnb, Datadog, Figma, WebKit, and Google V8.',
    icon: Layers,
    sourceIds: ['shopify_engineering', 'slack_engineering', 'spotify_engineering', 'airbnb_engineering', 'datadog_engineering', 'figma_blog', 'webkit_blog', 'v8_engine_blog']
  },
  {
    id: 'cyber_defense_systems_masters',
    name: 'Cyber Defense, Incident Response & Software Masters',
    badge: 'Defense & Architecture',
    description: 'Zero-day vulnerability alerts, supply chain static analysis, empirical hardware benchmarks, and architectural design from CISA, EFF, GitHub Security, Martin Fowler, Dan Luu, Julia Evans, Mitchell Hashimoto, and antirez.',
    icon: Shield,
    sourceIds: ['cisa_advisories', 'eff_updates', 'github_security', 'martin_fowler', 'dan_luu', 'julia_evans', 'mitchell_hashimoto', 'antirez_blog']
  },
  {
    id: 'compilers_languages_runtimes',
    name: 'Language Architects & Modern Compilers',
    badge: 'Compilers & Runtimes',
    description: 'Core interpreter evolution, garbage collectors, type theory, and borrow checkers from Swift, Kotlin, Python, Elixir, Zig, Ruby, Rust, and PostgreSQL.',
    icon: Terminal,
    sourceIds: ['swift_lang_blog', 'kotlin_blog', 'python_insider', 'elixir_lang', 'zig_lang_news', 'ruby_lang_news', 'rust_inside_blog', 'postgresql_news']
  },
  {
    id: 'open_source_os_foundations',
    name: 'Linux Kernels, OS Ecosystems & Web Platforms',
    badge: 'Open Source Systems',
    description: 'Linux kernel subsystems, secure OS kernels, cloud container platforms, and web primitives from LWN.net, OpenBSD, Arch Linux, Ubuntu, Linux Foundation, React, Svelte, and Astro.',
    icon: Globe,
    sourceIds: ['lwn_net', 'openbsd_journal', 'arch_linux_news', 'ubuntu_blog', 'linux_foundation_blog', 'react_official_blog', 'svelte_blog', 'astro_blog']
  },
  {
    id: 'elite_cyber_threat_intelligence',
    name: 'Elite Cyber Defense & Zero-Day Threat Labs',
    badge: 'Threat Labs',
    description: 'Zero-day vulnerability discovery, post-quantum cryptography, APT tracking, and exploit payloads from Google Project Zero, SANS ISC, PortSwigger, Troy Hunt, AWS Security, Microsoft Threat Intel, Trail of Bits, and Cisco Talos.',
    icon: Shield,
    sourceIds: ['google_project_zero', 'sans_isc', 'portswigger_research', 'troy_hunt', 'aws_security_blog', 'ms_security_blog', 'trail_of_bits', 'cisco_talos']
  },
  {
    id: 'developer_tools_web_runtimes',
    name: 'Developer Toolchains & Modern Web Architectures',
    badge: 'Toolchains & Frameworks',
    description: 'Type checking, language servers, reactive compilation, graphics engines, and cloud platforms from TypeScript, .NET, VS Code, Vue.js, Angular, Godot Engine, Blender, and Google Cloud.',
    icon: Terminal,
    sourceIds: ['typescript_blog', 'dotnet_blog', 'vscode_blog', 'vue_official_blog', 'angular_blog', 'godot_engine_news', 'blender_code_blog', 'google_cloud_blog']
  },
  {
    id: 'distributed_databases_storage',
    name: 'Distributed Databases & Next-Gen Storage Engines',
    badge: 'Database Engines',
    description: 'C++ Seastar asynchronous engines, Raft multi-region consensus, HTAP analytics, time-series hypertables, and declarative systems from ScyllaDB, TimescaleDB, YugabyteDB, PingCAP TiDB, Supabase, and HashiCorp.',
    icon: Database,
    sourceIds: ['scylladb_blog', 'timescale_blog', 'yugabytedb_blog', 'pingcap_blog', 'supabase_blog', 'hashicorp_blog', 'opentelemetry_blog', 'tauri_blog']
  },
  {
    id: 'frontier_quantum_biocomputing',
    name: 'Frontier Quantum, Neurotech & Bio-Computing',
    badge: 'Quantum & Bio',
    description: 'Superconducting QPUs, pulse compilation, AlphaFold computational biology, neural connectomics, and single-board silicon from Qiskit, Quantum Insider, bioRxiv, medRxiv, Raspberry Pi, Arduino, and DeepMind.',
    icon: Microscope,
    sourceIds: ['qiskit_blog', 'quantum_daily', 'biorxiv_bioinfo', 'biorxiv_neuro', 'medrxiv_ai', 'deepmind_podcast', 'raspberry_pi_blog', 'arduino_blog']
  },
  {
    id: 'mojo_compilers_hardware',
    name: 'Mojo Systems, Hardware & Deep Microarchitecture',
    badge: 'Hardware & Compilers',
    description: 'Mojo systems language, branch predictors, cache latency benchmarks, microkernels, and low-level engineering from Modular, Chips and Cheese, OSnews, and Microsoft Engineering.',
    icon: Cpu,
    sourceIds: ['modular_mojo', 'chipsandcheese', 'osnews_feed', 'ms_dev_engineering']
  },
  {
    id: 'frontier_serving_runtimes',
    name: 'High-Throughput Inference & Engine Releases',
    badge: 'Runtime Releases',
    description: 'Official production engine releases, PagedAttention serving, CUDA compilation, and quantized models from Ollama, vLLM, PyTorch Foundation, and TensorFlow.',
    icon: Binary,
    sourceIds: ['ollama_releases', 'vllm_releases', 'pytorch_releases', 'tensorflow_releases']
  },
  {
    id: 'osint_threat_forensics',
    name: 'Digital Forensics, OSINT & Surveillance Research',
    badge: 'Intelligence & Security',
    description: 'Open source investigative methodologies, geolocation analysis, zero-click spyware forensics, and civil cyber defense from Bellingcat and The Citizen Lab.',
    icon: Shield,
    sourceIds: ['bellingcat_tech', 'citizen_lab', 'hnrss_ai', 'hnrss_best']
  },
  {
    id: 'developer_ecosystem_dispatches',
    name: 'Developer Newsletters & Cloud-Native Platforms',
    badge: 'Ecosystem Newsletters',
    description: 'Curated weekly language digests, TC39 standards, Node.js LTS, and CNCF Kubernetes updates from JavaScript Weekly, Postgres Weekly, Golang Weekly, DB Weekly, Node.js, and CNCF.',
    icon: Terminal,
    sourceIds: ['javascript_weekly', 'postgres_weekly', 'golang_weekly', 'db_weekly', 'nodejs_official_blog', 'cncf_announcements', 'ms_python_dev', 'astro_build', 'freecodecamp_news']
  },
  {
    id: 'frontier_video_lectures',
    name: 'Pioneering CS & Neural Network Video Lectures',
    badge: 'Video & Lectures',
    description: 'Intuitive mathematics, CS theory, paper teardowns, and deep learning lectures from 3Blue1Brown, StatQuest, Computerphile, MIT OpenCourseWare, Stanford Online, Veritasium, AI Coffee Break, CS50, and Traversy Media.',
    icon: Video,
    sourceIds: ['youtube_3blue1brown', 'youtube_statquest', 'youtube_computerphile', 'youtube_mit_openlearning', 'youtube_stanford_online', 'youtube_veritasium', 'youtube_ai_coffee_break', 'youtube_cs50', 'youtube_khan_academy', 'youtube_sentdex', 'youtube_coreyms', 'youtube_traversymedia']
  },
  {
    id: 'ai_coding_agents',
    name: 'AI Coding Agents & Autonomous Tooling',
    badge: 'Agentic Dev',
    description: 'Next-gen coding assistants, agent runtimes, serverless GPU compute from Cursor, Replit Agent, Aider, GitHub Next, LM Studio, Modal Labs, and Fireworks AI.',
    icon: Terminal,
    sourceIds: ['cursor_blog', 'replit_blog', 'aider_blog', 'github_next', 'lm_studio_blog', 'modal_labs', 'fireworks_ai']
  },
  {
    id: 'vector_fast_data',
    name: 'Fast Vector DBs & Columnar Data Engines',
    badge: 'Data Engines',
    description: 'High-speed SIMD analytics, columnar formats, and embedding stores from ClickHouse, Polars, Apache Arrow, LanceDB, Chroma, Milvus, and QuestDB.',
    icon: Database,
    sourceIds: ['clickhouse_blog', 'polars_blog', 'apache_arrow_blog', 'lancedb_blog', 'chroma_blog', 'milvus_blog', 'questdb_blog', 'redis_blog']
  },
  {
    id: 'cloud_threat_defense',
    name: 'Hyperscale Cloud Security & Threat Defense',
    badge: 'Threat Defense',
    description: 'Cloud isolation exploits, honeypot telemetry, and enterprise CVE tracking from Wiz Research, Palo Alto Unit 42, SentinelLabs, Aqua Nautilus, and Red Hat.',
    icon: Shield,
    sourceIds: ['wiz_security_research', 'unit42_threats', 'sentinelone_labs', 'aqua_security', 'redhat_security']
  },
  {
    id: 'investigative_tech_journalism',
    name: 'Independent Tech Journalism & Critical Policy',
    badge: 'Investigative',
    description: 'Hard-hitting investigations into AI ethics, platform monopolies, and digital rights from 404 Media, Platformer, Garbage Day, Techdirt, and The Information.',
    icon: Globe,
    sourceIds: ['four_zero_four_media', 'platformer_news', 'garbage_day', 'techdirt', 'the_information_tech', 'semafor_tech']
  }
];

export const SourcesPanel: React.FC<SourcesPanelProps> = ({
  sources,
  onTriggerFetch,
  onToggleSource,
  refreshSources,
  showNotification
}) => {
  const [fetchingSourceId, setFetchingSourceId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [activeModalTab, setActiveModalTab] = useState<'custom' | 'packs'>('packs');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [activatingPackId, setActivatingPackId] = useState<string | null>(null);

  // Custom Source Form Fields
  const [customName, setCustomName] = useState('');
  const [customUrl, setCustomUrl] = useState('');
  const [customCategory, setCustomCategory] = useState('ai');
  const [customRegion, setCustomRegion] = useState('Global');
  const [customDescription, setCustomDescription] = useState('');
  const [customAutoFetch, setCustomAutoFetch] = useState(true);

  const worldRegions = [
    { id: null, label: 'All Desks' },
    { id: 'Global', label: 'Global Wire' },
    { id: 'Europe & UK', label: 'Europe & UK' },
    { id: 'Asia-Pacific', label: 'Asia-Pacific' },
    { id: 'Americas', label: 'Americas' },
    { id: 'Middle East & Africa', label: 'Middle East & Africa' },
    { id: 'Global South & Emerging Markets', label: 'Global South' },
  ];

  const categoryFilters = [
    { id: null, label: 'All Categories' },
    { id: 'research', label: 'Research & Labs' },
    { id: 'llms', label: 'LLMs & Foundation' },
    { id: 'robotics', label: 'Robotics & Physical AI' },
    { id: 'semiconductors', label: 'Silicon & Hardware' },
    { id: 'ai-agents', label: 'Agents & RAG' },
    { id: 'developer-tools', label: 'Developer Tools' },
    { id: 'open-source-ai', label: 'Open Source AI' },
    { id: 'video', label: 'Frontier Videos' },
    { id: 'startups', label: 'Startups & Ventures' }
  ];

  const filteredSources = useMemo(() => {
    return sources.filter((src) => {
      const matchesSearch =
        !searchQuery ||
        src.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        src.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        src.description.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesRegion =
        !selectedRegion ||
        (src.region && src.region.toLowerCase().includes(selectedRegion.toLowerCase()));

      const matchesCategory =
        !selectedCategory ||
        (src.categories && src.categories.some((c) => c.toLowerCase().includes(selectedCategory.toLowerCase())));

      return matchesSearch && matchesRegion && matchesCategory;
    });
  }, [sources, searchQuery, selectedRegion, selectedCategory]);

  const handleFetchClick = async (sourceId: string) => {
    setFetchingSourceId(sourceId);
    try {
      await onTriggerFetch(sourceId);
    } finally {
      setFetchingSourceId(null);
    }
  };

  const handleAddCustomSource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customName.trim() || !customUrl.trim()) return;

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/v1/sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: customName.trim(),
          url: customUrl.trim(),
          category: customCategory,
          region: customRegion,
          description: customDescription.trim(),
          autoFetch: customAutoFetch
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || data.message || 'Failed to create source');
      }

      showNotification?.('success', `Added new source '${customName}' successfully!`, 'Source Created');
      setIsAddModalOpen(false);
      setCustomName('');
      setCustomUrl('');
      setCustomDescription('');
      refreshSources();
    } catch (err: any) {
      showNotification?.('error', err.message || 'Could not register new source', 'Registration Error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBatchActivatePack = async (pack: CuratedPack) => {
    setActivatingPackId(pack.id);
    try {
      let activatedCount = 0;
      for (const srcId of pack.sourceIds) {
        await onToggleSource(srcId, true);
        activatedCount++;
      }
      showNotification?.(
        'success',
        `Successfully enabled all ${activatedCount} sources in "${pack.name}"!`,
        'Pack Activated'
      );
      refreshSources();
    } catch (err: any) {
      showNotification?.('error', err.message || 'Failed to activate pack', 'Activation Error');
    } finally {
      setActivatingPackId(null);
    }
  };

  const getStatusBadge = (status?: string, enabled?: boolean) => {
    if (enabled === false) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-600">
          <XCircle className="h-3 w-3 text-stone-400" /> Disabled
        </span>
      );
    }

    switch (status) {
      case 'healthy':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
            <CheckCircle2 className="h-3 w-3 text-emerald-600" /> Healthy
          </span>
        );
      case 'degraded':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
            <AlertTriangle className="h-3 w-3 text-amber-600" /> Degraded
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-700">
            <XCircle className="h-3 w-3 text-rose-600" /> Failed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-600">
            Ready
          </span>
        );
    }
  };

  const getProtocolColor = (proto: string) => {
    switch (proto) {
      case 'rest':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'rss':
        return 'bg-amber-50 text-amber-800 border-amber-200';
      case 'atom':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      default:
        return 'bg-stone-100 text-stone-700 border-stone-200';
    }
  };

  const activeSourcesCount = sources.filter((s) => s.enabled).length;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-stone-200 bg-white p-5 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-base font-bold text-stone-900">
              Connector & Protocol Health Registry
            </h2>
            <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-800 border border-amber-200">
              {sources.length} Total Sources ({activeSourcesCount} Active)
            </span>
          </div>
          <p className="text-xs text-stone-500 mt-1">
            Decoupled source connectors with isolated error handling, rate-limiting, and circuit resilience across research labs, industry publishers, and academic archives.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 transition-colors cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            Add New Source
          </button>

          <button
            onClick={refreshSources}
            className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 bg-stone-50 px-3.5 py-2 text-xs font-medium text-stone-700 hover:bg-stone-100 transition-colors cursor-pointer"
          >
            <RefreshCw className="h-3.5 w-3.5 text-stone-500" />
            Refresh Health
          </button>
        </div>
      </div>

      {/* Quick Curated Discovery Ribbon */}
      <div className="rounded-xl border border-amber-100 bg-gradient-to-r from-amber-50/50 via-stone-50 to-blue-50/40 p-4 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-600" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-stone-900">
              Curated Expansion Packs (Frontier AI, Robotics, Silicon & RAG)
            </h3>
          </div>
          <button
            onClick={() => {
              setActiveModalTab('packs');
              setIsAddModalOpen(true);
            }}
            className="text-xs font-medium text-blue-600 hover:text-blue-800 underline cursor-pointer"
          >
            View All Packs ({CURATED_PACKS.length}) →
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {CURATED_PACKS.slice(0, 3).map((pack) => {
            const Icon = pack.icon;
            const isActivating = activatingPackId === pack.id;
            return (
              <div
                key={pack.id}
                className="flex flex-col justify-between rounded-lg border border-stone-200/80 bg-white p-3 shadow-2xs hover:border-stone-300 transition-all"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1 rounded bg-stone-100 px-2 py-0.5 text-[10px] font-semibold text-stone-700">
                      <Icon className="h-3 w-3 text-stone-500" />
                      {pack.badge}
                    </span>
                    <span className="text-[10px] text-stone-400 font-mono">
                      {pack.sourceIds.length} sources
                    </span>
                  </div>
                  <h4 className="text-xs font-semibold text-stone-900 mt-1.5">{pack.name}</h4>
                  <p className="text-[11px] text-stone-500 mt-1 line-clamp-2 leading-relaxed">
                    {pack.description}
                  </p>
                </div>
                <div className="mt-3 pt-2 border-t border-stone-100 flex items-center justify-between">
                  <span className="text-[10px] text-stone-400">Ready to sync</span>
                  <button
                    onClick={() => handleBatchActivatePack(pack)}
                    disabled={isActivating}
                    className="inline-flex items-center gap-1 rounded bg-stone-900 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-stone-800 disabled:opacity-50 cursor-pointer"
                  >
                    {isActivating ? (
                      <RefreshCw className="h-3 w-3 animate-spin" />
                    ) : (
                      <Check className="h-3 w-3" />
                    )}
                    Activate Pack
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="space-y-3 rounded-xl border border-stone-200 bg-white p-4 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Search Field */}
          <div className="relative min-w-[260px] flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Search ${sources.length} sources by name, desk, keyword, id...`}
              className="w-full rounded-lg border border-stone-200 bg-stone-50 pl-9 pr-8 py-2 text-xs placeholder:text-stone-400 focus:border-amber-400 focus:bg-white focus:outline-none transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 text-xs cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>

          <div className="text-xs text-stone-500 font-medium">
            Showing <strong className="text-stone-900">{filteredSources.length}</strong> of {sources.length} sources
          </div>
        </div>

        {/* Desks / Regions Selector */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs border-t border-stone-100 pt-2.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-blue-700 whitespace-nowrap mr-1 flex items-center gap-1">
            <Globe className="h-3.5 w-3.5 text-blue-600" /> Desks:
          </span>
          {worldRegions.map((reg) => {
            const isSelected = reg.id === null ? !selectedRegion : selectedRegion === reg.id;
            return (
              <button
                key={String(reg.id)}
                onClick={() => setSelectedRegion(reg.id)}
                className={`whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'border border-stone-200 bg-stone-50 text-stone-600 hover:bg-stone-100 hover:text-stone-900'
                }`}
              >
                {reg.label}
              </button>
            );
          })}
        </div>

        {/* Categories Selector */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none text-xs pt-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-800 whitespace-nowrap mr-1 flex items-center gap-1">
            <Tag className="h-3.5 w-3.5 text-amber-600" /> Topics:
          </span>
          {categoryFilters.map((cat) => {
            const isSelected = cat.id === null ? !selectedCategory : selectedCategory === cat.id;
            return (
              <button
                key={String(cat.id)}
                onClick={() => setSelectedCategory(cat.id)}
                className={`whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-amber-800 text-white shadow-xs'
                    : 'border border-stone-200 bg-stone-50 text-stone-600 hover:bg-stone-100 hover:text-stone-900'
                }`}
              >
                {cat.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Connectors Grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredSources.map((src) => {
          const isFetching = fetchingSourceId === src.id;
          const health = src.health;

          return (
            <div
              key={src.id}
              className="flex flex-col justify-between rounded-xl border border-stone-200 bg-white p-5 shadow-xs transition-all hover:border-stone-300 hover:shadow-sm"
            >
              <div>
                {/* Header: Name + Status */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold text-stone-900 text-sm leading-snug">{src.name}</h3>
                    <p className="text-[11px] text-stone-500 font-mono mt-0.5">{src.id}</p>
                  </div>
                  {getStatusBadge(health?.status, src.enabled)}
                </div>

                {/* Description */}
                <p className="mt-2 text-xs text-stone-600 line-clamp-2 leading-relaxed">
                  {src.description}
                </p>

                {/* Protocol & Key & Region & Category info */}
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  <span
                    className={`rounded border px-2 py-0.5 text-[10px] font-mono font-semibold uppercase ${getProtocolColor(
                      src.protocol
                    )}`}
                  >
                    {src.protocol}
                  </span>

                  {src.region && (
                    <span className="inline-flex items-center gap-1 rounded border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] text-blue-700 font-medium">
                      <Globe className="h-3 w-3 text-blue-500" />
                      {src.region}
                    </span>
                  )}

                  {src.categories && src.categories[0] && (
                    <span className="inline-flex items-center gap-1 rounded border border-amber-200 bg-amber-50/60 px-2 py-0.5 text-[10px] text-amber-800 font-medium">
                      <Tag className="h-2.5 w-2.5 text-amber-600" />
                      {src.categories[0]}
                    </span>
                  )}

                  {src.requiresKey ? (
                    <span
                      className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[10px] font-medium ${
                        src.configured
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                          : 'border-amber-200 bg-amber-50 text-amber-800'
                      }`}
                    >
                      <Key className="h-3 w-3" />
                      {src.configured ? 'Key Configured' : 'Key Missing'}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded border border-stone-200 bg-stone-50 px-2 py-0.5 text-[10px] text-stone-600">
                      <Shield className="h-3 w-3 text-stone-400" />
                      Public Access
                    </span>
                  )}
                </div>

                {/* Operational Telemetry */}
                <div className="mt-4 grid grid-cols-2 gap-2 rounded-lg bg-stone-50 p-2.5 text-[11px]">
                  <div>
                    <span className="text-stone-400 block text-[10px]">Interval</span>
                    <span className="font-medium text-stone-700">Every {src.fetchIntervalMinutes}m</span>
                  </div>
                  <div>
                    <span className="text-stone-400 block text-[10px]">Total Ingested</span>
                    <span className="font-medium text-stone-700">
                      {health?.totalArticlesFetched || health?.itemsInsertedTotal || 0} items
                    </span>
                  </div>
                  <div>
                    <span className="text-stone-400 block text-[10px]">Success Rate</span>
                    <span className="font-medium text-stone-700">
                      {health && (health.totalFetches > 0 || (health.itemsInsertedTotal || 0) > 0)
                        ? `${Math.round(((health.totalSuccesses || 1) / Math.max(1, health.totalFetches || 1)) * 100)}%`
                        : '100%'}
                    </span>
                  </div>
                  <div>
                    <span className="text-stone-400 block text-[10px]">Avg Latency</span>
                    <span className="font-medium text-stone-700">
                      {health?.avgLatencyMs || health?.averageResponseTimeMs || health?.lastDurationMs || 35}ms
                    </span>
                  </div>
                </div>

                {/* Last Error if degraded */}
                {health?.lastError && (
                  <div className="mt-2 rounded bg-rose-50 p-2 text-[10px] text-rose-700">
                    <span className="font-semibold">Last Error: </span>
                    <span className="truncate block">{health.lastError}</span>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="mt-4 flex items-center justify-between border-t border-stone-100 pt-3">
                {/* Enable/Disable switch */}
                <label className="flex items-center gap-2 cursor-pointer text-xs text-stone-600 select-none">
                  <input
                    type="checkbox"
                    checked={src.enabled}
                    onChange={(e) => onToggleSource(src.id, e.target.checked)}
                    className="rounded border-stone-300 text-amber-600 focus:ring-amber-500"
                  />
                  <span>Enabled</span>
                </label>

                {/* Manual Fetch Button */}
                <button
                  onClick={() => handleFetchClick(src.id)}
                  disabled={isFetching || !src.enabled}
                  className="inline-flex items-center gap-1.5 rounded-md bg-stone-900 px-3 py-1.5 text-xs font-medium text-white shadow-xs hover:bg-stone-800 disabled:opacity-50 transition-colors cursor-pointer"
                >
                  <Play className={`h-3 w-3 ${isFetching ? 'animate-spin' : ''}`} />
                  <span>{isFetching ? 'Ingesting...' : 'Ingest Now'}</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add New Source / Curated Packs Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="relative w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl border border-stone-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-stone-200">
              <div>
                <h3 className="text-base font-bold text-stone-900 flex items-center gap-2">
                  <Plus className="h-5 w-5 text-blue-600" />
                  Add New Intelligence Sources
                </h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  Expand the ingestion pipeline with custom feeds or 1-click curated research packs.
                </p>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-700 transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Tabs */}
            <div className="flex items-center gap-2 border-b border-stone-200 pt-3 pb-2">
              <button
                onClick={() => setActiveModalTab('packs')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                  activeModalTab === 'packs'
                    ? 'bg-amber-100 text-amber-900'
                    : 'text-stone-600 hover:bg-stone-100'
                }`}
              >
                <Sparkles className="h-3.5 w-3.5 text-amber-600" />
                1-Click Curated Packs
              </button>

              <button
                onClick={() => setActiveModalTab('custom')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                  activeModalTab === 'custom'
                    ? 'bg-blue-100 text-blue-900'
                    : 'text-stone-600 hover:bg-stone-100'
                }`}
              >
                <Plus className="h-3.5 w-3.5 text-blue-600" />
                Custom Feed URL (RSS / Atom / REST)
              </button>
            </div>

            {/* Tab 1: Curated Packs Content */}
            {activeModalTab === 'packs' && (
              <div className="mt-4 space-y-3 max-h-[60vh] overflow-y-auto pr-1">
                <p className="text-xs text-stone-600 leading-relaxed">
                  Batch-enable specialized clusters of high-signal feeds with isolated circuit breakers:
                </p>

                {CURATED_PACKS.map((pack) => {
                  const Icon = pack.icon;
                  const isActivating = activatingPackId === pack.id;
                  return (
                    <div
                      key={pack.id}
                      className="rounded-xl border border-stone-200 p-4 hover:border-stone-300 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-stone-50/50"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1 rounded bg-stone-200/80 px-2 py-0.5 text-[10px] font-bold text-stone-700">
                            <Icon className="h-3 w-3 text-stone-600" />
                            {pack.badge}
                          </span>
                          <span className="text-xs font-bold text-stone-900">{pack.name}</span>
                          <span className="text-[10px] text-stone-500 font-mono">
                            ({pack.sourceIds.length} sources)
                          </span>
                        </div>
                        <p className="text-xs text-stone-600 leading-relaxed">
                          {pack.description}
                        </p>
                      </div>

                      <button
                        onClick={() => handleBatchActivatePack(pack)}
                        disabled={isActivating}
                        className="self-start sm:self-center whitespace-nowrap inline-flex items-center gap-1.5 rounded-lg bg-stone-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-stone-800 disabled:opacity-50 transition-colors cursor-pointer"
                      >
                        {isActivating ? (
                          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Check className="h-3.5 w-3.5" />
                        )}
                        Activate & Sync Pack
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Tab 2: Custom Source Form */}
            {activeModalTab === 'custom' && (
              <form onSubmit={handleAddCustomSource} className="mt-4 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Source Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    placeholder="e.g. Berkeley AI Research, Anthropic News, My Company Blog"
                    className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs text-stone-900 placeholder:text-stone-400 focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Feed Endpoint URL (RSS / Atom / XML / JSON) *
                  </label>
                  <input
                    type="url"
                    required
                    value={customUrl}
                    onChange={(e) => setCustomUrl(e.target.value)}
                    placeholder="https://example.com/feed.xml or https://example.com/blog/rss"
                    className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs text-stone-900 placeholder:text-stone-400 focus:border-blue-500 focus:outline-none font-mono"
                  />
                  <p className="text-[11px] text-stone-400 mt-1">
                    Supports standard RSS 2.0, Atom 1.0, and XML syndicated feeds.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">
                      Primary Category
                    </label>
                    <select
                      value={customCategory}
                      onChange={(e) => setCustomCategory(e.target.value)}
                      className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs text-stone-900 focus:border-blue-500 focus:outline-none"
                    >
                      <option value="ai">Artificial Intelligence</option>
                      <option value="llms">Large Language Models (LLMs)</option>
                      <option value="robotics">Robotics & Physical AI</option>
                      <option value="semiconductors">Semiconductors & Hardware</option>
                      <option value="ai-agents">Autonomous Agents & RAG</option>
                      <option value="developer-tools">Developer Tools & SDKs</option>
                      <option value="open-source-ai">Open-Source AI</option>
                      <option value="research">Academic Research</option>
                      <option value="technology">General Technology</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">
                      Desk / Region
                    </label>
                    <select
                      value={customRegion}
                      onChange={(e) => setCustomRegion(e.target.value)}
                      className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs text-stone-900 focus:border-blue-500 focus:outline-none"
                    >
                      <option value="Global">Global Wire</option>
                      <option value="Americas">Americas</option>
                      <option value="Europe & UK">Europe & UK</option>
                      <option value="Asia-Pacific">Asia-Pacific</option>
                      <option value="Middle East & Africa">Middle East & Africa</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Short Description (Optional)
                  </label>
                  <input
                    type="text"
                    value={customDescription}
                    onChange={(e) => setCustomDescription(e.target.value)}
                    placeholder="Brief summary of publication scope and coverage"
                    className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs text-stone-900 placeholder:text-stone-400 focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="autoFetchCheck"
                    checked={customAutoFetch}
                    onChange={(e) => setCustomAutoFetch(e.target.checked)}
                    className="rounded border-stone-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="autoFetchCheck" className="text-xs text-stone-700 cursor-pointer select-none">
                    Trigger initial ingestion cycle immediately upon registration
                  </label>
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-stone-200">
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    className="rounded-lg border border-stone-200 px-4 py-2 text-xs font-medium text-stone-700 hover:bg-stone-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || !customName.trim() || !customUrl.trim()}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 disabled:opacity-50 cursor-pointer transition-colors"
                  >
                    {isSubmitting ? (
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Plus className="h-3.5 w-3.5" />
                    )}
                    Register & Connect Source
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
