import React, { useState, useEffect } from 'react';
import {
  X,
  Radar,
  Sparkles,
  Zap,
  Globe,
  Radio,
  BookOpen,
  Code2,
  FileCode,
  MessageSquare,
  Search,
  ExternalLink,
  RotateCw,
  CheckCircle2,
  AlertCircle,
  Cpu,
  Layers,
  ArrowRight
} from 'lucide-react';
import { TechniqueInfo, Article } from '../types.js';

interface TechniquesRadarModalProps {
  isOpen: boolean;
  onClose: () => void;
  onArticlesUpdated: (articles: Article[]) => void;
  onSelectTopicTag?: (tag: string) => void;
}

export function TechniquesRadarModal({
  isOpen,
  onClose,
  onArticlesUpdated,
  onSelectTopicTag
}: TechniquesRadarModalProps) {
  const [activeTab, setActiveTab] = useState<'techniques' | 'topic_search' | 'url_extractor'>('techniques');
  const [techniques, setTechniques] = useState<TechniqueInfo[]>([]);
  const [loadingTechniques, setLoadingTechniques] = useState<boolean>(true);
  const [runningTechniqueId, setRunningTechniqueId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isSweepingAll, setIsSweepingAll] = useState<boolean>(false);

  // Topic search state
  const [topicQuery, setTopicQuery] = useState<string>('');
  const [isSearchingTopic, setIsSearchingTopic] = useState<boolean>(false);

  // URL extractor state
  const [extractUrl, setExtractUrl] = useState<string>('');
  const [isExtractingUrl, setIsExtractingUrl] = useState<boolean>(false);

  // Load techniques from API
  const fetchTechniques = async () => {
    try {
      setLoadingTechniques(true);
      const res = await fetch('/api/v1/news/techniques');
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json.data)) {
          setTechniques(json.data);
        }
      }
    } catch (e) {
      console.error('Failed to load techniques:', e);
    } finally {
      setLoadingTechniques(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchTechniques();
    }
  }, [isOpen]);

  // Run a specific technique
  const handleRunTechnique = async (techId: string) => {
    try {
      setRunningTechniqueId(techId);
      setStatusMessage(`Running ${techId}...`);
      const res = await fetch(`/api/v1/news/techniques/${encodeURIComponent(techId)}/run`, {
        method: 'POST'
      });
      if (res.ok) {
        const json = await res.json();
        setStatusMessage(json.message || `Successfully executed technique.`);
        if (Array.isArray(json.data) && json.data.length > 0) {
          onArticlesUpdated(json.data);
        }
        await fetchTechniques();
      } else {
        setStatusMessage('Technique execution failed. Please retry.');
      }
    } catch (err: any) {
      setStatusMessage(`Error: ${err.message || 'Execution error'}`);
    } finally {
      setRunningTechniqueId(null);
      setTimeout(() => setStatusMessage(null), 4000);
    }
  };

  // Run full multi-technique rapid sweep
  const handleSweepAll = async () => {
    try {
      setIsSweepingAll(true);
      setStatusMessage('Executing concurrent sweep across all fast news-gathering techniques...');
      const res = await fetch('/api/v1/news/refresh', { method: 'POST' });
      if (res.ok) {
        const json = await res.json();
        setStatusMessage(json.message || 'All techniques refreshed successfully!');
        if (Array.isArray(json.data) && json.data.length > 0) {
          onArticlesUpdated(json.data);
        }
        await fetchTechniques();
      } else {
        setStatusMessage('Refresh completed with warnings.');
      }
    } catch (err: any) {
      setStatusMessage(`Refresh error: ${err.message}`);
    } finally {
      setIsSweepingAll(false);
      setTimeout(() => setStatusMessage(null), 4500);
    }
  };

  // Run custom topic swarm search
  const handleSearchTopic = async (customTopic?: string) => {
    const q = (customTopic !== undefined ? customTopic : topicQuery).trim();
    if (!q) return;

    try {
      setIsSearchingTopic(true);
      setStatusMessage(`Swarming news wires & preprints for "${q}"...`);
      const res = await fetch('/api/v1/news/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: q })
      });
      if (res.ok) {
        const json = await res.json();
        setStatusMessage(`Ingested ${json.ingestedCount || 0} new dispatches for "${q}".`);
        if (Array.isArray(json.data) && json.data.length > 0) {
          onArticlesUpdated(json.data);
        }
        if (onSelectTopicTag) {
          onSelectTopicTag(q);
        }
        setTimeout(() => onClose(), 1200);
      } else {
        setStatusMessage('Topic search completed.');
      }
    } catch (e: any) {
      setStatusMessage(`Topic search error: ${e.message}`);
    } finally {
      setIsSearchingTopic(false);
    }
  };

  // Run URL extraction
  const handleExtractUrl = async () => {
    const u = extractUrl.trim();
    if (!u) return;

    try {
      setIsExtractingUrl(true);
      setStatusMessage(`Extracting Schema.org JSON-LD & OpenGraph from ${u}...`);
      const res = await fetch('/api/v1/news/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: u })
      });
      if (res.ok) {
        const json = await res.json();
        setStatusMessage(`Extracted and indexed article (${json.ingestedCount || 0} new).`);
        if (Array.isArray(json.data) && json.data.length > 0) {
          onArticlesUpdated(json.data);
        }
        setTimeout(() => onClose(), 1200);
      } else {
        setStatusMessage('URL extraction completed.');
      }
    } catch (e: any) {
      setStatusMessage(`Extraction error: ${e.message}`);
    } finally {
      setIsExtractingUrl(false);
    }
  };

  if (!isOpen) return null;

  const popularTopics = [
    'DeepSeek R1',
    'Claude 3.7 Sonnet',
    'Humanoid Robotics',
    'NVIDIA Blackwell',
    'AlphaFold 3',
    'vLLM Inference',
    'Quantum AI',
    'Agentic Workflows'
  ];

  const getTechniqueIcon = (type: string) => {
    switch (type) {
      case 'realtime_search':
        return <Search className="h-4 w-4 text-amber-600" />;
      case 'rss_syndication':
        return <Radio className="h-4 w-4 text-emerald-600" />;
      case 'preprints':
        return <BookOpen className="h-4 w-4 text-blue-600" />;
      case 'changelog_atom':
        return <Code2 className="h-4 w-4 text-purple-600" />;
      case 'microblog_stream':
        return <MessageSquare className="h-4 w-4 text-indigo-600" />;
      case 'structured_extraction':
        return <FileCode className="h-4 w-4 text-rose-600" />;
      default:
        return <Zap className="h-4 w-4 text-stone-600" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-stone-900/60 backdrop-blur-xs">
      <div
        className="w-full max-w-4xl max-h-[90vh] bg-[#fbfaf6] rounded-lg shadow-2xl border border-stone-300 flex flex-col overflow-hidden text-stone-900"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-6 pb-4 border-b border-stone-200/80 bg-stone-100/60 flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Radar className="h-5 w-5 text-stone-800" />
              <h2 className="font-editorial text-2xl sm:text-3xl font-medium tracking-tight text-stone-900">
                News Gathering Radar & Techniques
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-stone-600 font-light">
              Explore and trigger multi-stream news ingestion techniques: Algolia search, topic query swarms, preprints, open-weights releases, and structured data extraction.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-stone-800 rounded-full hover:bg-stone-200/80 transition-colors cursor-pointer"
            title="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Status Alert Bar */}
        {statusMessage && (
          <div className="px-6 py-2.5 bg-stone-900 text-stone-100 text-xs flex items-center justify-between gap-2 border-b border-stone-800 animate-fadeIn">
            <div className="flex items-center gap-2">
              <RotateCw className="h-3.5 w-3.5 animate-spin text-stone-300" />
              <span>{statusMessage}</span>
            </div>
            <button
              onClick={() => setStatusMessage(null)}
              className="text-stone-400 hover:text-white cursor-pointer text-xs"
            >
              ✕
            </button>
          </div>
        )}

        {/* Modal Navigation Tabs */}
        <div className="flex items-center justify-between px-6 pt-3 border-b border-stone-200/70 bg-stone-50/50">
          <div className="flex items-center gap-6 text-xs uppercase tracking-wider font-semibold">
            <button
              onClick={() => setActiveTab('techniques')}
              className={`pb-2.5 cursor-pointer transition-colors relative ${
                activeTab === 'techniques'
                  ? 'text-stone-900 border-b-2 border-stone-900'
                  : 'text-stone-500 hover:text-stone-900'
              }`}
            >
              Active Techniques ({techniques.length})
            </button>
            <button
              onClick={() => setActiveTab('topic_search')}
              className={`pb-2.5 cursor-pointer transition-colors relative ${
                activeTab === 'topic_search'
                  ? 'text-stone-900 border-b-2 border-stone-900'
                  : 'text-stone-500 hover:text-stone-900'
              }`}
            >
              Live Topic Query Swarm
            </button>
            <button
              onClick={() => setActiveTab('url_extractor')}
              className={`pb-2.5 cursor-pointer transition-colors relative ${
                activeTab === 'url_extractor'
                  ? 'text-stone-900 border-b-2 border-stone-900'
                  : 'text-stone-500 hover:text-stone-900'
              }`}
            >
              Webpage Schema Extractor
            </button>
          </div>

          {activeTab === 'techniques' && (
            <button
              onClick={handleSweepAll}
              disabled={isSweepingAll}
              className="mb-1.5 inline-flex items-center gap-1.5 px-3 py-1 rounded text-[11px] font-semibold uppercase tracking-wider text-white bg-stone-900 hover:bg-stone-800 active:bg-black transition-colors cursor-pointer disabled:opacity-50"
            >
              <RotateCw className={`h-3 w-3 ${isSweepingAll ? 'animate-spin' : ''}`} />
              <span>{isSweepingAll ? 'Sweeping...' : 'Run All Techniques Sweep'}</span>
            </button>
          )}
        </div>

        {/* Tab 1: Techniques List */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {activeTab === 'techniques' && (
            <div>
              {loadingTechniques ? (
                <div className="py-12 text-center text-sm text-stone-500 animate-pulse">
                  Loading gathering techniques...
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {techniques.map((tech) => {
                    const isRunning = runningTechniqueId === tech.id;
                    return (
                      <div
                        key={tech.id}
                        className="p-4 rounded border border-stone-200/90 bg-white hover:border-stone-400/80 transition-all shadow-xs flex flex-col justify-between gap-3"
                      >
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              {getTechniqueIcon(tech.type)}
                              <h3 className="text-sm font-semibold text-stone-900">
                                {tech.name}
                              </h3>
                            </div>
                            <span className="text-[10px] font-medium uppercase tracking-wider px-1.5 py-0.5 rounded bg-stone-100 text-stone-600 border border-stone-200/60">
                              {tech.speed}
                            </span>
                          </div>
                          <p className="text-xs text-stone-600 leading-relaxed font-light">
                            {tech.description}
                          </p>
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-stone-100 text-[11px] text-stone-500">
                          <div>
                            <span>Indexed: </span>
                            <strong className="text-stone-800 font-semibold">{tech.itemCount} dispatches</strong>
                          </div>

                          <button
                            onClick={() => handleRunTechnique(tech.id)}
                            disabled={isRunning || isSweepingAll}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-medium tracking-wide uppercase bg-stone-100 hover:bg-stone-200 text-stone-800 border border-stone-300/80 transition-colors cursor-pointer disabled:opacity-50"
                          >
                            <RotateCw className={`h-3 w-3 ${isRunning ? 'animate-spin text-stone-900' : 'text-stone-500'}`} />
                            <span>{isRunning ? 'Pulling...' : 'Run Technique'}</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Tab 2: Live Topic Search Swarm */}
          {activeTab === 'topic_search' && (
            <div className="space-y-6 max-w-2xl mx-auto py-2">
              <div className="space-y-2 text-center">
                <h3 className="font-editorial text-2xl text-stone-900 font-medium">
                  Multi-Engine Topic Search Swarm
                </h3>
                <p className="text-xs sm:text-sm text-stone-600 font-light">
                  Query real-time news across Google News Wire, Cornell arXiv preprints, and Hacker News Algolia in a single concurrent sweep.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                  <input
                    type="text"
                    value={topicQuery}
                    onChange={(e) => setTopicQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearchTopic()}
                    placeholder="Enter any topic (e.g. DeepSeek, Reasoning Models, Humanoid Robotics)..."
                    className="w-full bg-white pl-9 pr-4 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 border border-stone-300 rounded focus:border-stone-800 focus:outline-none transition-colors"
                  />
                </div>
                <button
                  onClick={() => handleSearchTopic()}
                  disabled={isSearchingTopic || !topicQuery.trim()}
                  className="px-4 py-2.5 rounded text-xs uppercase tracking-wider font-semibold text-white bg-stone-900 hover:bg-stone-800 transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  <RotateCw className={`h-3.5 w-3.5 ${isSearchingTopic ? 'animate-spin' : ''}`} />
                  <span>{isSearchingTopic ? 'Swarming...' : 'Swarm Search'}</span>
                </button>
              </div>

              {/* Popular quick chips */}
              <div className="space-y-2">
                <div className="text-[11px] uppercase tracking-wider font-semibold text-stone-500">
                  Popular Discovery Queries:
                </div>
                <div className="flex flex-wrap gap-2">
                  {popularTopics.map((topic) => (
                    <button
                      key={topic}
                      onClick={() => {
                        setTopicQuery(topic);
                        handleSearchTopic(topic);
                      }}
                      className="text-xs px-2.5 py-1 rounded bg-stone-100 hover:bg-stone-200 border border-stone-300 text-stone-700 transition-colors cursor-pointer flex items-center gap-1"
                    >
                      <Sparkles className="h-3 w-3 text-stone-500" />
                      <span>{topic}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Tab 3: URL Extractor */}
          {activeTab === 'url_extractor' && (
            <div className="space-y-6 max-w-2xl mx-auto py-2">
              <div className="space-y-2 text-center">
                <h3 className="font-editorial text-2xl text-stone-900 font-medium">
                  Structured Data Web Extractor
                </h3>
                <p className="text-xs sm:text-sm text-stone-600 font-light">
                  Extract articles directly from any tech blog or publication URL using Schema.org JSON-LD (<code className="text-stone-800 font-mono">NewsArticle</code>, <code className="text-stone-800 font-mono">BlogPosting</code>) and OpenGraph meta tags.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                  <input
                    type="url"
                    value={extractUrl}
                    onChange={(e) => setExtractUrl(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleExtractUrl()}
                    placeholder="https://example.com/blog/frontier-ai-announcement..."
                    className="w-full bg-white pl-9 pr-4 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 border border-stone-300 rounded focus:border-stone-800 focus:outline-none transition-colors"
                  />
                </div>
                <button
                  onClick={handleExtractUrl}
                  disabled={isExtractingUrl || !extractUrl.trim()}
                  className="px-4 py-2.5 rounded text-xs uppercase tracking-wider font-semibold text-white bg-stone-900 hover:bg-stone-800 transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  <RotateCw className={`h-3.5 w-3.5 ${isExtractingUrl ? 'animate-spin' : ''}`} />
                  <span>{isExtractingUrl ? 'Extracting...' : 'Extract & Ingest'}</span>
                </button>
              </div>

              <div className="p-4 rounded bg-stone-100/70 border border-stone-200/80 text-xs text-stone-600 space-y-2">
                <div className="font-semibold text-stone-800 flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <span>Auto-Discovery & Fallback Hierarchy</span>
                </div>
                <p>
                  1. Probes for syndicated feeds (<code className="font-mono">/feed</code>, <code className="font-mono">/rss.xml</code>, <code className="font-mono">/atom.xml</code>).
                  <br />
                  2. Parses <code className="font-mono">&lt;script type="application/ld+json"&gt;</code> Schema.org microdata for headline, author, and timestamp.
                  <br />
                  3. Falls back to OpenGraph <code className="font-mono">og:title</code>, <code className="font-mono">og:description</code>, and <code className="font-mono">og:image</code>.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-stone-200/70 bg-stone-100/40 flex items-center justify-between text-xs text-stone-500">
          <div>
            10+ active gathering techniques running in concert
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded text-xs font-medium text-stone-800 hover:bg-stone-200 border border-stone-300 transition-colors cursor-pointer"
          >
            Close Radar
          </button>
        </div>
      </div>
    </div>
  );
}
