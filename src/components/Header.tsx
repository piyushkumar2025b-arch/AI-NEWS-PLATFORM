import React from 'react';
import {
  Activity,
  RefreshCw,
  Search,
  Layers,
  Server,
  Terminal,
  Cpu,
  Radio,
  Tv
} from 'lucide-react';
import { SystemHealth } from '../types.js';

interface HeaderProps {
  systemHealth: SystemHealth | null;
  activeTab: 'feed' | 'videos' | 'sources' | 'pipeline' | 'logs';
  setActiveTab: (tab: 'feed' | 'videos' | 'sources' | 'pipeline' | 'logs') => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  onSearchSubmit: (e: React.FormEvent) => void;
  onTriggerSyncAll: () => void;
  isSyncing: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  systemHealth,
  activeTab,
  setActiveTab,
  searchQuery,
  setSearchQuery,
  onSearchSubmit,
  onTriggerSyncAll,
  isSyncing
}) => {
  const isHealthy = systemHealth?.status === 'healthy' || systemHealth?.status === 'ok';

  return (
    <header className="sticky top-0 z-30 border-b border-stone-200 bg-white/95 backdrop-blur-md">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-4">
          
          {/* Logo & Platform Info */}
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-stone-900 text-amber-400 shadow-sm">
              <Cpu className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-semibold tracking-tight text-stone-900">
                  NexusIngest
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-600">
                  <Radio className="h-3 w-3 text-emerald-600" /> Live Ingestion
                </span>
              </div>
              <p className="hidden text-xs text-stone-500 sm:block">
                Production-grade multi-protocol news & research ingestion engine
              </p>
            </div>
          </div>

          {/* Search bar */}
          <form onSubmit={onSearchSubmit} className="hidden flex-1 max-w-md md:block">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
              <input
                id="header-search-input"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search AI, robotics, LLMs, research DOIs, arXiv..."
                className="w-full rounded-lg border border-stone-200 bg-stone-50 py-1.5 pl-9 pr-4 text-sm text-stone-900 placeholder-stone-400 transition-colors focus:border-stone-400 focus:bg-white focus:outline-none"
              />
            </div>
          </form>

          {/* Action buttons & Nav Tabs */}
          <div className="flex items-center gap-2">
            {/* System Health status badge */}
            <div className="hidden items-center gap-2 rounded-lg border border-stone-200 bg-stone-50 px-3 py-1.5 text-xs lg:flex">
              <span
                className={`h-2 w-2 rounded-full ${
                  isHealthy ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                }`}
              />
              <span className="font-medium text-stone-700">
                {systemHealth?.sources?.healthy !== undefined
                  ? `${systemHealth.sources.healthy}/${systemHealth.sources.total || 0} Connectors Active`
                  : systemHealth?.stats?.healthySources !== undefined
                  ? `${systemHealth.stats.healthySources}/${systemHealth.stats.totalSources || 0} Connectors Active`
                  : 'Connecting...'}
              </span>
            </div>

            {/* Sync All Button */}
            <button
              id="sync-all-sources-btn"
              onClick={onTriggerSyncAll}
              disabled={isSyncing}
              className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 shadow-sm transition-all hover:bg-stone-50 active:scale-95 disabled:opacity-60"
              title="Trigger background ingestion for all active connectors"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin text-amber-600' : 'text-stone-500'}`} />
              <span className="hidden sm:inline">{isSyncing ? 'Ingesting...' : 'Ingest Live'}</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs Bar */}
        <div className="flex items-center space-x-1 border-t border-stone-100 py-1.5 overflow-x-auto scrollbar-none">
          <button
            id="nav-tab-feed"
            onClick={() => setActiveTab('feed')}
            className={`inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              activeTab === 'feed'
                ? 'bg-stone-900 text-white'
                : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
            }`}
          >
            <Activity className="h-3.5 w-3.5" />
            Live News Feed
            {systemHealth && (systemHealth.articlesIndexed !== undefined || systemHealth.stats?.totalArticles !== undefined) && (
              <span className={`ml-1 rounded px-1.5 py-0.2 text-[10px] ${activeTab === 'feed' ? 'bg-stone-700 text-stone-200' : 'bg-stone-200 text-stone-700'}`}>
                {systemHealth.articlesIndexed ?? systemHealth.stats?.totalArticles}
              </span>
            )}
          </button>

          <button
            id="nav-tab-videos"
            onClick={() => setActiveTab('videos')}
            className={`inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              activeTab === 'videos'
                ? 'bg-red-600 text-white'
                : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
            }`}
          >
            <Tv className="h-3.5 w-3.5 text-red-400" />
            AI Videos & Lectures
            <span className={`ml-1 rounded px-1.5 py-0.2 text-[10px] font-semibold ${activeTab === 'videos' ? 'bg-red-800 text-white' : 'bg-red-100 text-red-700'}`}>
              LIVE
            </span>
          </button>

          <button
            id="nav-tab-sources"
            onClick={() => setActiveTab('sources')}
            className={`inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              activeTab === 'sources'
                ? 'bg-stone-900 text-white'
                : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
            }`}
          >
            <Server className="h-3.5 w-3.5" />
            Connectors & Health
            <span className={`ml-1 rounded px-1.5 py-0.2 text-[10px] ${activeTab === 'sources' ? 'bg-stone-700 text-stone-200' : 'bg-stone-200 text-stone-700'}`}>
              13 Sources
            </span>
          </button>

          <button
            id="nav-tab-pipeline"
            onClick={() => setActiveTab('pipeline')}
            className={`inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              activeTab === 'pipeline'
                ? 'bg-stone-900 text-white'
                : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
            }`}
          >
            <Layers className="h-3.5 w-3.5" />
            Pipeline Architecture
          </button>

          <button
            id="nav-tab-logs"
            onClick={() => setActiveTab('logs')}
            className={`inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              activeTab === 'logs'
                ? 'bg-stone-900 text-white'
                : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
            }`}
          >
            <Terminal className="h-3.5 w-3.5" />
            Ingestion Telemetry
          </button>
        </div>

      </div>
    </header>
  );
};
