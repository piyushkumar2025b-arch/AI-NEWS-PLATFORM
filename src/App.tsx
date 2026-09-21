import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Header } from './components/Header.js';
import { MetricsOverview } from './components/MetricsOverview.js';
import { CategoryFilter } from './components/CategoryFilter.js';
import { ArticleCard } from './components/ArticleCard.js';
import { ArticleListItem } from './components/ArticleListItem.js';
import { ArticleModal } from './components/ArticleModal.js';
import { SourcesPanel } from './components/SourcesPanel.js';
import { PipelineFlowView } from './components/PipelineFlowView.js';
import { IngestionLogsPanel } from './components/IngestionLogsPanel.js';
import { VideosPanel } from './components/VideosPanel.js';
import {
  Article,
  CategoryInfo,
  SourceInfo,
  SystemHealth,
  FetchRunLog
} from './types.js';
import {
  Search,
  SlidersHorizontal,
  RefreshCw,
  Inbox,
  ArrowUpDown,
  Sparkles,
  AlertTriangle,
  AlertCircle,
  XCircle,
  CheckCircle2,
  LayoutGrid,
  List,
  Tv,
  Eye,
  Filter,
  Layers,
  ChevronDown
} from 'lucide-react';

interface ApiNotification {
  id: string;
  type: 'error' | 'success' | 'info';
  title?: string;
  message: string;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'feed' | 'videos' | 'sources' | 'pipeline' | 'logs'>('feed');
  const [articles, setArticles] = useState<Article[]>([]);
  const [categories, setCategories] = useState<CategoryInfo[]>([]);
  const [sources, setSources] = useState<SourceInfo[]>([]);
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);
  const [fetchLogs, setFetchLogs] = useState<FetchRunLog[]>([]);

  const [loading, setLoading] = useState<boolean>(true);
  const [feedError, setFeedError] = useState<{ status?: number; message: string } | null>(null);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeSearch, setActiveSearch] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedSourceType, setSelectedSourceType] = useState<string | null>(null);
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [selectedSort, setSelectedSort] = useState<'latest' | 'engagement'>('latest');
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [notification, setNotification] = useState<ApiNotification | null>(null);

  // High-Efficiency Rendering States
  const [viewMode, setViewMode] = useState<'grid' | 'dense' | 'media'>('grid');
  const [quickFilter, setQuickFilter] = useState<string>('');
  const [visibleLimit, setVisibleLimit] = useState<number>(24);

  const notificationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const showNotification = useCallback((type: 'error' | 'success' | 'info', message: string, title?: string) => {
    if (notificationTimeoutRef.current) {
      clearTimeout(notificationTimeoutRef.current);
    }
    setNotification({
      id: String(Date.now()),
      type,
      title,
      message
    });
    notificationTimeoutRef.current = setTimeout(() => {
      setNotification(null);
    }, 6000);
  }, []);

  // Generic resilient JSON fetcher that gracefully handles 404, 500, network aborts
  const safeFetch = async <T = any>(
    url: string,
    options?: RequestInit
  ): Promise<{ ok: boolean; status: number; data?: T; error?: string }> => {
    try {
      const res = await fetch(url, options);
      let json: any = null;
      try {
        json = await res.json();
      } catch {
        json = null;
      }

      if (!res.ok) {
        const errorMsg =
          json?.error?.message ||
          json?.message ||
          (res.status === 404
            ? `Resource not found at ${url} (HTTP 404)`
            : res.status === 500
            ? `Internal server error (HTTP 500) while contacting ${url}`
            : `Request failed with HTTP status ${res.status}`);
        return { ok: false, status: res.status, error: errorMsg, data: json?.data };
      }

      return {
        ok: true,
        status: res.status,
        data: json?.data !== undefined ? json.data : json
      };
    } catch (err: any) {
      return {
        ok: false,
        status: 0,
        error: err.message || 'Network connection failed'
      };
    }
  };

  // 1. Fetch News Feed with full 404/500 error interception
  const fetchNews = useCallback(async (isBackground = false) => {
    try {
      if (!isBackground) {
        setLoading(true);
      }
      setFeedError(null);
      let url = '/api/v1/news?limit=100';

      if (activeSearch) {
        url = `/api/v1/search?q=${encodeURIComponent(activeSearch)}&limit=100`;
      } else {
        if (selectedCategory) {
          url += `&category=${encodeURIComponent(selectedCategory)}`;
        }
        if (selectedSourceType) {
          url += `&source_type=${encodeURIComponent(selectedSourceType)}`;
        }
        if (selectedSourceId) {
          url += `&source=${encodeURIComponent(selectedSourceId)}`;
        }
        if (selectedRegion) {
          url += `&region=${encodeURIComponent(selectedRegion)}`;
        }
        if (selectedSort === 'engagement') {
          url += '&sort=engagement';
        }
      }

      const res = await safeFetch<Article[]>(url);
      if (!res.ok) {
        if (!isBackground) {
          setFeedError({
            status: res.status,
            message: res.error || 'Failed to retrieve articles from the news feed API'
          });
          setArticles([]);
        }
      } else {
        setArticles(Array.isArray(res.data) ? res.data : []);
      }
    } catch (err: any) {
      if (!isBackground) {
        setFeedError({
          status: 0,
          message: err.message || 'An unexpected error occurred while loading news feed'
        });
        setArticles([]);
      }
    } finally {
      if (!isBackground) {
        setLoading(false);
      }
    }
  }, [activeSearch, selectedCategory, selectedSourceType, selectedSourceId, selectedRegion, selectedSort]);

  // 2. Fetch System Health, Categories & Sources with isolated error handling
  const fetchSystemData = useCallback(async () => {
    try {
      const [healthRes, catRes, srcRes, logsRes] = await Promise.all([
        safeFetch<SystemHealth>('/api/v1/health'),
        safeFetch<CategoryInfo[]>('/api/v1/categories'),
        safeFetch<SourceInfo[]>('/api/v1/sources'),
        safeFetch<FetchRunLog[]>('/api/v1/fetch-runs?limit=40')
      ]);

      if (healthRes.ok && healthRes.data) {
        setSystemHealth(healthRes.data);
      } else if (!healthRes.ok) {
        console.warn(`Health telemetry unavailable (${healthRes.status}):`, healthRes.error);
      }

      if (catRes.ok && Array.isArray(catRes.data)) {
        setCategories(catRes.data);
      }

      if (srcRes.ok && Array.isArray(srcRes.data)) {
        setSources(srcRes.data);
      }

      if (logsRes.ok && Array.isArray(logsRes.data)) {
        setFetchLogs(logsRes.data);
      }
    } catch (err: any) {
      console.error('Error loading system telemetry:', err);
    }
  }, []);

  // Initial mount & periodic refresh
  useEffect(() => {
    fetchSystemData();
  }, [fetchSystemData]);

  useEffect(() => {
    fetchNews();
  }, [fetchNews]);

  // Auto-refresh telemetry every 25s and feed every 30s
  useEffect(() => {
    const telemetryTimer = setInterval(() => {
      fetchSystemData();
    }, 25000);

    const newsTimer = setInterval(() => {
      fetchNews(true);
    }, 30000);

    return () => {
      clearInterval(telemetryTimer);
      clearInterval(newsTimer);
    };
  }, [fetchSystemData, fetchNews]);

  // Handle Search Submission
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setActiveSearch(searchQuery.trim());
    setSelectedCategory(null);
    setSelectedSourceId(null);
    setSelectedRegion(null);
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setActiveSearch('');
  };

  // Trigger Sync for All Sources with robust operation polling & error recovery
  const handleTriggerSyncAll = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      const res = await safeFetch<{ operationId?: string; status?: string }>('/api/v1/ingest/all', {
        method: 'POST'
      });

      if (!res.ok) {
        showNotification(
          'error',
          res.error || 'Failed to trigger ingestion pipeline (HTTP 500/404)',
          'Sync Trigger Failed'
        );
        setIsSyncing(false);
        return;
      }

      const operationId = res.data?.operationId;

      if (operationId) {
        // Poll status until completed or timed out
        let pollCount = 0;
        const maxPolls = 120;
        const interval = setInterval(async () => {
          pollCount++;
          const statusRes = await safeFetch<{
            status: string;
            itemsReceived?: number;
            itemsInserted?: number;
            failedSources?: number;
          }>(`/api/v1/ingest/status/${operationId}`);

          if (statusRes.ok && statusRes.data) {
            const st = statusRes.data.status;
            // Periodically refresh news feed so incoming articles appear in real time
            if (pollCount % 4 === 0) {
              fetchNews();
            }

            if (st === 'completed' || st === 'partial' || st === 'failed' || pollCount >= maxPolls) {
              clearInterval(interval);
              setIsSyncing(false);
              await Promise.all([fetchNews(), fetchSystemData()]);

              if (st === 'failed') {
                showNotification('error', 'Ingestion failed across active connectors', 'Sync Error');
              } else {
                showNotification(
                  'success',
                  `Live ingestion complete. Received ${statusRes.data.itemsReceived || 0} items (+${statusRes.data.itemsInserted || 0} new)`,
                  'Ingestion Finished'
                );
              }
            }
          } else if (pollCount >= maxPolls) {
            clearInterval(interval);
            setIsSyncing(false);
            await Promise.all([fetchNews(), fetchSystemData()]);
          }
        }, 1500);
      } else {
        // Fallback wait
        setTimeout(async () => {
          await Promise.all([fetchNews(), fetchSystemData()]);
          setIsSyncing(false);
          showNotification('success', 'Live ingestion batch processed', 'Sync Complete');
        }, 3000);
      }
    } catch (err: any) {
      console.error('Error triggering sync:', err);
      showNotification('error', err.message || 'Network error triggering ingestion batch', 'Sync Error');
      setIsSyncing(false);
    }
  };

  // Trigger Individual Source Fetch
  const handleTriggerSourceFetch = async (sourceId: string) => {
    try {
      const res = await safeFetch<any>(`/api/v1/sources/${encodeURIComponent(sourceId)}/fetch`, {
        method: 'POST'
      });

      if (!res.ok) {
        showNotification(
          'error',
          res.error || `Source fetch failed for '${sourceId}' (HTTP ${res.status})`,
          'Source Ingestion Error'
        );
        return;
      }

      showNotification(
        'success',
        res.data?.message || `Fetched latest items for '${sourceId}'`,
        'Ingestion Complete'
      );
      await Promise.all([fetchNews(), fetchSystemData()]);
      return res.data;
    } catch (err: any) {
      console.error(`Error fetching source ${sourceId}:`, err);
      showNotification('error', err.message || `Failed to fetch '${sourceId}'`, 'Source Error');
    }
  };

  // Toggle Source Enabled
  const handleToggleSource = async (sourceId: string, enabled: boolean) => {
    try {
      const res = await safeFetch(`/api/v1/sources/${encodeURIComponent(sourceId)}/toggle`, {
        method: 'POST'
      });

      if (!res.ok) {
        showNotification(
          'error',
          res.error || `Failed to toggle source '${sourceId}' (HTTP ${res.status})`,
          'Connector Update Failed'
        );
        // Refresh to revert optimistic or stale state
        await fetchSystemData();
        return;
      }

      showNotification('info', `Source '${sourceId}' is now ${enabled ? 'enabled' : 'disabled'}`);
      await fetchSystemData();
    } catch (err: any) {
      console.error(`Error toggling source ${sourceId}:`, err);
      showNotification('error', err.message || `Failed to toggle '${sourceId}'`, 'Toggle Error');
      await fetchSystemData();
    }
  };

  // Reset visible limit whenever filters or search change
  useEffect(() => {
    setVisibleLimit(24);
  }, [activeSearch, selectedCategory, selectedSourceType, selectedSourceId, selectedSort, quickFilter, viewMode]);

  // High-efficiency in-memory filter across all loaded articles
  const filteredArticles = React.useMemo(() => {
    let list = articles;
    if (viewMode === 'media') {
      list = list.filter(a => a.media && a.media.some(m => m.type === 'video' || m.type === 'audio'));
    }
    if (quickFilter.trim()) {
      const q = quickFilter.toLowerCase();
      list = list.filter(a =>
        a.title.toLowerCase().includes(q) ||
        (a.description && a.description.toLowerCase().includes(q)) ||
        (a.author && a.author.toLowerCase().includes(q)) ||
        a.source.toLowerCase().includes(q) ||
        (a.tags && a.tags.some(t => t.toLowerCase().includes(q)))
      );
    }
    // Deduplicate in-memory to guarantee no duplicate news items are displayed
    const seenTitles = new Set<string>();
    const seenUrls = new Set<string>();
    const uniqueList: Article[] = [];

    for (const a of list) {
      // Normalize title (strip punctuation, spaces, and compare prefix)
      const normTitle = a.title.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 60);
      const cleanUrl = (a.canonical_url || a.url || '').split('?')[0].replace(/\/$/, '').toLowerCase();

      if (normTitle && seenTitles.has(normTitle)) continue;
      if (cleanUrl && seenUrls.has(cleanUrl)) continue;

      if (normTitle) seenTitles.add(normTitle);
      if (cleanUrl) seenUrls.add(cleanUrl);
      uniqueList.push(a);
    }

    return uniqueList;
  }, [articles, viewMode, quickFilter]);

  // Progressive batched slice to keep DOM size and rendering silky smooth
  const visibleArticles = React.useMemo(() => {
    return filteredArticles.slice(0, visibleLimit);
  }, [filteredArticles, visibleLimit]);

  return (
    <div className="min-h-screen bg-stone-100 text-stone-900 selection:bg-amber-200 selection:text-stone-900">
      
      {/* 1. Global Header */}
      <Header
        systemHealth={systemHealth}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        onSearchSubmit={handleSearchSubmit}
        onTriggerSyncAll={handleTriggerSyncAll}
        isSyncing={isSyncing}
      />

      {/* Global Notification Banner */}
      {notification && (
        <div className="mx-auto max-w-7xl px-4 pt-4 sm:px-6 lg:px-8">
          <div
            className={`flex items-center justify-between rounded-xl border p-3.5 shadow-sm transition-all ${
              notification.type === 'error'
                ? 'border-rose-200 bg-rose-50 text-rose-800'
                : notification.type === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : 'border-blue-200 bg-blue-50 text-blue-800'
            }`}
          >
            <div className="flex items-center gap-2.5 text-xs">
              {notification.type === 'error' && <XCircle className="h-4 w-4 text-rose-600 shrink-0" />}
              {notification.type === 'success' && <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />}
              {notification.type === 'info' && <AlertCircle className="h-4 w-4 text-blue-600 shrink-0" />}
              <div>
                {notification.title && <span className="font-semibold mr-1.5">{notification.title}:</span>}
                <span>{notification.message}</span>
              </div>
            </div>
            <button
              onClick={() => setNotification(null)}
              className="ml-3 text-xs font-bold opacity-60 hover:opacity-100 p-1"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* 2. Main Content Container */}
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 space-y-6">
        
        {/* Telemetry Metrics Bar */}
        <MetricsOverview
          health={systemHealth}
          totalArticles={systemHealth?.articlesIndexed ?? systemHealth?.stats?.totalArticles ?? articles.length}
        />

        {/* Tab 1: Live Feed View */}
        {activeTab === 'feed' && (
          <div className="space-y-5">
            {/* Filter & Controls Bar */}
            <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-xs space-y-3">
              <CategoryFilter
                categories={categories}
                selectedCategory={selectedCategory}
                onSelectCategory={(cat) => {
                  setSelectedCategory(cat);
                  setActiveSearch('');
                }}
                selectedSourceType={selectedSourceType}
                onSelectSourceType={setSelectedSourceType}
                selectedRegion={selectedRegion}
                onSelectRegion={(reg) => {
                  setSelectedRegion(reg);
                  setActiveSearch('');
                }}
                sources={sources}
                selectedSourceId={selectedSourceId}
                onSelectSourceId={(src) => {
                  setSelectedSourceId(src);
                  setActiveSearch('');
                }}
              />

              {/* Secondary Controls: Fast In-Memory Filter, View Mode Switcher, Sort Selector & Counter */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-stone-100 pt-3 text-xs">
                {/* Left: Quick Filter within results + active search tag */}
                <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[240px]">
                  <div className="relative flex-1 max-w-xs">
                    <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-stone-400" />
                    <input
                      type="text"
                      value={quickFilter}
                      onChange={(e) => setQuickFilter(e.target.value)}
                      placeholder="Fast filter in results (e.g. LLM, paper, video)..."
                      className="w-full rounded-lg border border-stone-200 bg-stone-50 pl-8 pr-7 py-1.5 text-xs placeholder:text-stone-400 focus:border-amber-400 focus:bg-white focus:outline-none transition-colors"
                    />
                    {quickFilter && (
                      <button
                        onClick={() => setQuickFilter('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 text-xs cursor-pointer"
                        title="Clear filter"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  {activeSearch && (
                    <div className="flex items-center gap-1.5 rounded-full bg-amber-50 border border-amber-200 px-3 py-1 text-amber-800 shrink-0">
                      <span>Query: <strong>"{activeSearch}"</strong></span>
                      <button
                        onClick={handleClearSearch}
                        className="ml-1 rounded-full p-0.5 hover:bg-amber-200 text-amber-900"
                        title="Clear query"
                      >
                        ✕
                      </button>
                    </div>
                  )}

                  {selectedRegion && (
                    <div className="flex items-center gap-1.5 rounded-full bg-blue-50 border border-blue-200 px-3 py-1 text-blue-800 shrink-0">
                      <span>Desk: <strong>{selectedRegion}</strong></span>
                      <button
                        onClick={() => setSelectedRegion(null)}
                        className="ml-1 rounded-full p-0.5 hover:bg-blue-200 text-blue-900"
                        title="Clear desk filter"
                      >
                        ✕
                      </button>
                    </div>
                  )}

                  <span className="text-stone-500 whitespace-nowrap">
                    Showing <strong>{visibleArticles.length}</strong> of <strong>{filteredArticles.length}</strong>
                    {articles.length !== filteredArticles.length && ` (${articles.length} in feed)`}
                  </span>
                </div>

                {/* Right: View Mode Switcher & Sort Selector */}
                <div className="flex flex-wrap items-center gap-2.5">
                  {/* View Mode Switcher */}
                  <div className="inline-flex rounded-lg border border-stone-200 bg-stone-50 p-0.5">
                    <button
                      onClick={() => setViewMode('grid')}
                      className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer ${
                        viewMode === 'grid'
                          ? 'bg-white text-stone-900 shadow-xs'
                          : 'text-stone-500 hover:text-stone-900'
                      }`}
                      title="Grid Bento View"
                    >
                      <LayoutGrid className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Grid</span>
                    </button>
                    <button
                      onClick={() => setViewMode('dense')}
                      className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer ${
                        viewMode === 'dense'
                          ? 'bg-white text-stone-900 shadow-xs'
                          : 'text-stone-500 hover:text-stone-900'
                      }`}
                      title="Compact High-Density Rows (Fastest Scanning)"
                    >
                      <List className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Compact List</span>
                    </button>
                    <button
                      onClick={() => setViewMode('media')}
                      className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer ${
                        viewMode === 'media'
                          ? 'bg-white text-stone-900 shadow-xs'
                          : 'text-stone-500 hover:text-stone-900'
                      }`}
                      title="Media Stream (Video & Audio Player Focus)"
                    >
                      <Tv className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Media Stream</span>
                    </button>
                  </div>

                  {/* Sort Selector */}
                  <div className="inline-flex rounded-lg border border-stone-200 bg-stone-50 p-0.5">
                    <button
                      onClick={() => setSelectedSort('latest')}
                      className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer ${
                        selectedSort === 'latest'
                          ? 'bg-white text-stone-900 shadow-xs'
                          : 'text-stone-500 hover:text-stone-900'
                      }`}
                    >
                      Latest
                    </button>
                    <button
                      onClick={() => setSelectedSort('engagement')}
                      className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer ${
                        selectedSort === 'engagement'
                          ? 'bg-white text-stone-900 shadow-xs'
                          : 'text-stone-500 hover:text-stone-900'
                      }`}
                    >
                      Engagement
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Articles Grid / Loading / Error State */}
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="animate-pulse rounded-2xl border border-stone-200/80 bg-white p-4 space-y-3 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <div className="h-5 w-24 rounded-full bg-stone-200" />
                      <div className="h-4 w-16 rounded bg-stone-100" />
                    </div>
                    <div className="h-36 w-full rounded-xl bg-stone-100" />
                    <div className="space-y-2 pt-1">
                      <div className="h-4 w-full rounded bg-stone-200" />
                      <div className="h-4 w-3/4 rounded bg-stone-200" />
                    </div>
                    <div className="h-10 w-full rounded bg-stone-50" />
                    <div className="flex items-center justify-between pt-2 border-t border-stone-100">
                      <div className="h-4 w-20 rounded bg-stone-100" />
                      <div className="h-4 w-16 rounded bg-stone-100" />
                    </div>
                  </div>
                ))}
              </div>
            ) : feedError ? (
              <div className="flex min-h-[300px] flex-col items-center justify-center rounded-2xl border border-rose-200 bg-rose-50/50 p-12 text-center">
                <AlertTriangle className="h-10 w-10 text-rose-500" />
                <h3 className="mt-3 text-sm font-semibold text-rose-900">
                  {feedError.status === 404
                    ? 'Feed endpoint not found (HTTP 404)'
                    : feedError.status === 500
                    ? 'Server Error loading feed (HTTP 500)'
                    : 'Failed to load news feed'}
                </h3>
                <p className="mt-1 text-xs text-rose-700 max-w-md font-mono bg-white/70 border border-rose-200 rounded p-2 mt-2">
                  {feedError.message}
                </p>
                <div className="mt-4 flex items-center gap-3">
                  <button
                    onClick={fetchNews}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-rose-900 px-4 py-2 text-xs font-medium text-white hover:bg-rose-800 shadow-xs"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Retry Feed Request
                  </button>
                  <button
                    onClick={handleTriggerSyncAll}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-4 py-2 text-xs font-medium text-stone-700 hover:bg-stone-50"
                  >
                    Trigger Ingestion Pipeline
                  </button>
                </div>
              </div>
            ) : filteredArticles.length === 0 ? (
              <div className="flex min-h-[300px] flex-col items-center justify-center rounded-2xl border border-stone-200 bg-white p-12 text-center">
                <Inbox className="h-10 w-10 text-stone-300" />
                <h3 className="mt-3 text-sm font-semibold text-stone-800">
                  {quickFilter
                    ? `No articles match the keyword "${quickFilter}"`
                    : 'No articles matched the filter criteria'}
                </h3>
                <p className="mt-1 text-xs text-stone-500 max-w-sm">
                  {quickFilter
                    ? 'Try clearing the fast filter or searching across different topics.'
                    : 'Try selecting a different topic category or triggering an on-demand live sync from the top bar.'}
                </p>
                {quickFilter ? (
                  <button
                    onClick={() => setQuickFilter('')}
                    className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-stone-900 px-4 py-2 text-xs font-medium text-white hover:bg-stone-800"
                  >
                    Clear Filter
                  </button>
                ) : (
                  <button
                    onClick={handleTriggerSyncAll}
                    className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-stone-900 px-4 py-2 text-xs font-medium text-white hover:bg-stone-800"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Run Live Ingestion
                  </button>
                )}
              </div>
            ) : (
              <div>
                {/* Mode 1: Dense Row / Compact List View */}
                {viewMode === 'dense' && (
                  <div className="space-y-2">
                    {visibleArticles.map((article) => (
                      <ArticleListItem
                        key={article.id}
                        article={article}
                        onInspect={(art) => setSelectedArticle(art)}
                        onSelectSource={(src) => {
                          setSelectedSourceId(src);
                          setActiveSearch('');
                        }}
                      />
                    ))}
                  </div>
                )}

                {/* Mode 2: Media Focus (2-column wide layout) */}
                {viewMode === 'media' && (
                  <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                    {visibleArticles.map((article) => (
                      <ArticleCard
                        key={article.id}
                        article={article}
                        onInspect={(art) => setSelectedArticle(art)}
                        onSelectSource={(src) => {
                          setSelectedSourceId(src);
                          setActiveSearch('');
                        }}
                      />
                    ))}
                  </div>
                )}

                {/* Mode 3: Grid Bento View */}
                {viewMode === 'grid' && (
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {visibleArticles.map((article) => (
                      <ArticleCard
                        key={article.id}
                        article={article}
                        onInspect={(art) => setSelectedArticle(art)}
                        onSelectSource={(src) => {
                          setSelectedSourceId(src);
                          setActiveSearch('');
                        }}
                      />
                    ))}
                  </div>
                )}

                {/* Progressive Virtualized Batch Controls */}
                {visibleArticles.length < filteredArticles.length && (
                  <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3 border-t border-stone-200/80 pt-6">
                    <button
                      onClick={() => setVisibleLimit((prev) => Math.min(prev + 24, filteredArticles.length))}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-stone-900 px-5 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-stone-800 transition-colors cursor-pointer"
                    >
                      <ChevronDown className="h-4 w-4" />
                      Render Next 24 Items ({filteredArticles.length - visibleArticles.length} remaining)
                    </button>
                    <button
                      onClick={() => setVisibleLimit(filteredArticles.length)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-4 py-2.5 text-xs font-medium text-stone-700 hover:bg-stone-50 transition-colors cursor-pointer"
                    >
                      Render All ({filteredArticles.length})
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Tab 1b: Frontier AI Videos & Lectures */}
        {activeTab === 'videos' && (
          <VideosPanel
            onSelectArticle={(art) => setSelectedArticle(art)}
            showNotification={showNotification}
          />
        )}

        {/* Tab 2: Connectors & Health Registry */}
        {activeTab === 'sources' && (
          <SourcesPanel
            sources={sources}
            onTriggerFetch={handleTriggerSourceFetch}
            onToggleSource={handleToggleSource}
            refreshSources={fetchSystemData}
            showNotification={showNotification}
          />
        )}

        {/* Tab 3: Pipeline Flow Architecture */}
        {activeTab === 'pipeline' && <PipelineFlowView />}

        {/* Tab 4: Audit Logs & Telemetry */}
        {activeTab === 'logs' && (
          <IngestionLogsPanel
            logs={fetchLogs}
            onRefresh={fetchSystemData}
          />
        )}

      </main>

      {/* Contract & Provenance Inspection Modal */}
      <ArticleModal
        article={selectedArticle}
        onClose={() => setSelectedArticle(null)}
      />

    </div>
  );
}
