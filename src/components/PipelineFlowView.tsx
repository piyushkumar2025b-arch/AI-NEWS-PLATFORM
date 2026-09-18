import React from 'react';
import {
  Layers,
  ArrowRight,
  ShieldCheck,
  FileCheck2,
  Filter,
  Share2,
  Tag,
  Database,
  Radio,
  Cpu,
  Server
} from 'lucide-react';

export const PipelineFlowView: React.FC = () => {
  const pipelineStages = [
    {
      id: 'protocols',
      title: '1. Protocol Layer',
      icon: Radio,
      badge: 'REST • RSS 2.0 • Atom 1.0',
      description: 'Unified network client with exponential backoff (2^attempt * 500ms), jitter, 10s timeouts, user-agent rotation, and XML/Atom feed normalization.'
    },
    {
      id: 'connectors',
      title: '2. Connector Registry',
      icon: Cpu,
      badge: '13 Independent Sources',
      description: 'Decoupled connectors for GDELT, Google News, arXiv, GitHub, Hugging Face, Hacker News, Reddit, Dev.to, Lobsters, Semantic Scholar, Crossref, Guardian, NewsAPI.'
    },
    {
      id: 'validation',
      title: '3. Structural Validation',
      icon: ShieldCheck,
      badge: 'Input Sanitation',
      description: 'Enforces presence of title, valid HTTP/HTTPS URLs, non-empty identifiers, and strips null-byte/corrupted payloads.'
    },
    {
      id: 'normalization',
      title: '4. Normalization Engine',
      icon: FileCheck2,
      badge: 'Uniform Contract',
      description: 'Strips tracking parameters (utm_*, fbclid), normalizes domain hostnames, parses multi-format dates to ISO-8601, and computes SHA-256 content hash.'
    },
    {
      id: 'filtering',
      title: '5. Noise & Spam Filter',
      icon: Filter,
      badge: 'Quality Gate',
      description: 'Filters promotional spam, crypto giveaways, invalid publication dates, and zero-length excerpts.'
    },
    {
      id: 'deduplication',
      title: '6. Multi-Source Deduplication',
      icon: Share2,
      badge: 'Provenance Linking',
      description: 'Cross-checks canonical URL, normalized URL, external ID, and title fingerprints. If multiple sources report the same story, links them into a single article provenance.'
    },
    {
      id: 'enrichment',
      title: '7. Taxonomy & Enrichment',
      icon: Tag,
      badge: 'Topic Classification',
      description: 'Maps content against 10 hierarchical tech domains (LLMs, AI Agents, Open Source AI, Robotics, Research, Hardware) and attaches source type classification.'
    },
    {
      id: 'storage',
      title: '8. Storage & API Serving',
      icon: Database,
      badge: 'Persistence & Cache',
      description: 'Stores indexed articles with dual hash indexing, persists to disk JSON store, manages 45s TTL cache, and serves versioned REST API (/api/v1/news).'
    }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-xs">
        <h2 className="text-base font-bold text-stone-900">
          Complete End-to-End Ingestion Pipeline Architecture
        </h2>
        <p className="mt-1 text-xs text-stone-600 leading-relaxed max-w-4xl">
          Every ingested article flows through strictly isolated pipeline phases before reaching storage or the API layer.
          No raw feed ever directly touches storage or client representations.
        </p>
      </div>

      {/* Pipeline Stages Vertical / Grid flow */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {pipelineStages.map((stage, idx) => {
          const Icon = stage.icon;
          return (
            <div
              key={stage.id}
              className="relative flex flex-col justify-between rounded-xl border border-stone-200 bg-white p-5 shadow-xs transition-all hover:border-amber-300 hover:shadow-sm"
            >
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-stone-900 text-amber-400">
                      <Icon className="h-4 w-4" />
                    </div>
                    <h3 className="text-sm font-semibold text-stone-900">{stage.title}</h3>
                  </div>
                  <span className="rounded-md bg-stone-100 px-2 py-0.5 text-[10px] font-mono font-medium text-stone-600">
                    {stage.badge}
                  </span>
                </div>

                <p className="mt-3 text-xs leading-relaxed text-stone-600">
                  {stage.description}
                </p>
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-stone-100 pt-3 text-[11px] text-stone-400 font-mono">
                <span>Phase 0{idx + 1} of 08</span>
                <span className="text-amber-700 font-sans font-medium flex items-center gap-1">
                  Active in runtime <ArrowRight className="h-3 w-3" />
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Code Architecture Highlights */}
      <div className="rounded-xl border border-stone-200 bg-stone-900 p-5 text-white">
        <h3 className="text-sm font-semibold text-amber-400">
          Core Architectural Guarantees
        </h3>
        <ul className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 text-xs text-stone-300 leading-relaxed">
          <li className="flex items-start gap-2">
            <span className="text-emerald-400">✔</span>
            <span><strong>Zero LLM Hallucinations</strong>: Clean ingestion with exact title/description preservation and provenance tracking.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-emerald-400">✔</span>
            <span><strong>Deterministic Deduplication</strong>: Canonical URL normalizer + bigram similarity indexing + SHA-256 fingerprinting.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-emerald-400">✔</span>
            <span><strong>Fault Isolation</strong>: Failures in any single upstream source (e.g. Reddit or ArXiv) never crash other connectors.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-emerald-400">✔</span>
            <span><strong>Centralized Configuration</strong>: Strict environment configuration with no secrets exposed to client browsers.</span>
          </li>
        </ul>
      </div>

    </div>
  );
};
