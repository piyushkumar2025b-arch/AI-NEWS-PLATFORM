import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ArticleCard } from './components/ArticleCard.js';
import { ArticleListItem } from './components/ArticleListItem.js';
import { ArticleModal } from './components/ArticleModal.js';
import { TechniquesRadarModal } from './components/TechniquesRadarModal.js';
import { Article, CategoryInfo, SourceInfo } from './types.js';
import {
  Search,
  Bookmark,
  LayoutGrid,
  List,
  Sparkles,
  ArrowRight,
  Tv,
  Check,
  RotateCw,
  Compass,
  Globe,
  Cpu,
  Layers,
  Radio,
  Code,
  Radar,
  X
} from 'lucide-react';

type SectionTab = 'for_you' | 'frontier' | 'research' | 'community' | 'releases' | 'media' | 'saved';

export default function App() {
  // Navigation & View states
  const [activeTab, setActiveTab] = useState<SectionTab>('for_you');
  const [viewMode, setViewMode] = useState<'magazine' | 'compact'>('magazine');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedSource, setSelectedSource] = useState<string | null>(null);
  const [selectedTopicTag, setSelectedTopicTag] = useState<string | null>(null);

  // Discovery Modal states
  const [showDiscoveryModal, setShowDiscoveryModal] = useState<boolean>(false);
  const [discoverQuery, setDiscoverQuery] = useState<string>('');
  const [discoverUrl, setDiscoverUrl] = useState<string>('');
  const [isDiscovering, setIsDiscovering] = useState<boolean>(false);
  const [discoveryStatus, setDiscoveryStatus] = useState<string | null>(null);

  // Data states
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [refreshMessage, setRefreshMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [visibleCount, setVisibleCount] = useState<number>(30);

  // Personalization: saved articles & read history stored in localStorage
  const [savedIds, setSavedIds] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem('piyush_saved_articles');
      return stored ? new Set(JSON.parse(stored)) : new Set<string>();
    } catch {
      return new Set<string>();
    }
  });

  const [readIds, setReadIds] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem('piyush_read_articles');
      return stored ? new Set(JSON.parse(stored)) : new Set<string>();
    } catch {
      return new Set<string>();
    }
  });

  // Persist bookmarks
  const toggleBookmark = useCallback((articleId: string) => {
    setSavedIds(prev => {
      const next = new Set(prev);
      if (next.has(articleId)) {
        next.delete(articleId);
      } else {
        next.add(articleId);
      }
      try {
        localStorage.setItem('piyush_saved_articles', JSON.stringify(Array.from(next)));
      } catch (e) {
        console.error('Error saving bookmark to storage', e);
      }
      return next;
    });
  }, []);

  // Mark article as read when opened
  const handleOpenArticle = useCallback((article: Article) => {
    setSelectedArticle(article);
    setReadIds(prev => {
      if (prev.has(article.id)) return prev;
      const next = new Set(prev);
      next.add(article.id);
      try {
        localStorage.setItem('piyush_read_articles', JSON.stringify(Array.from(next)));
      } catch (e) {
        console.error('Error saving read history', e);
      }
      return next;
    });
  }, []);

  // Fetch articles from backend API
  const fetchArticles = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      let url = '/api/v1/news?limit=250';
      if (selectedSource) {
        url = `/api/v1/news?source_id=${encodeURIComponent(selectedSource)}&limit=250`;
      } else if (activeTab === 'frontier') {
        url += '&category=ai';
      } else if (activeTab === 'research') {
        url += '&source_type=research';
      } else if (activeTab === 'community') {
        url += '&category=community';
      } else if (activeTab === 'releases') {
        url += '&source_type=code';
      } else if (activeTab === 'media') {
        url = '/api/v1/videos?limit=100';
      } else if (activeTab === 'saved') {
        if (savedIds.size > 0) {
          url = `/api/v1/news?ids=${Array.from(savedIds).join(',')}&limit=250`;
        } else {
          setArticles([]);
          setLoading(false);
          return;
        }
      }

      if (selectedTopicTag) {
        url += `&tag=${encodeURIComponent(selectedTopicTag)}`;
      }

      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Failed to load dispatches (HTTP ${res.status})`);
      }

      const json = await res.json();
      const list: Article[] = Array.isArray(json.data) ? json.data : Array.isArray(json) ? json : [];
      setArticles(list);
    } catch (err: any) {
      console.error('Error loading news feed:', err);
      setError(err.message || 'Unable to load articles');
    } finally {
      setLoading(false);
    }
  }, [activeTab, selectedSource, selectedTopicTag, savedIds]);

  // Topic & Web URL Discovery handler
  const handleDiscover = useCallback(async (queryText?: string, targetUrl?: string) => {
    const q = (queryText !== undefined ? queryText : discoverQuery).trim();
    const u = (targetUrl !== undefined ? targetUrl : discoverUrl).trim();
    if (!q && !u) return;

    try {
      setIsDiscovering(true);
      setDiscoveryStatus(q ? `Scanning web wire & research preprints for "${q}"...` : `Discovering feed & extracting article from ${u}...`);
      const res = await fetch('/api/v1/news/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: q || undefined, url: u || undefined })
      });

      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json.data) && json.data.length > 0) {
          setArticles(json.data);
          setDiscoveryStatus(`Success! Ingested ${json.ingestedCount || 0} new items. Displaying ${json.data.length} dispatches.`);
        } else {
          setDiscoveryStatus('Discovery completed. Re-checking feed.');
          await fetchArticles();
        }
      } else {
        setDiscoveryStatus('Discovery note: Unable to fetch external items, refreshed local index.');
        await fetchArticles();
      }
    } catch (e: any) {
      console.error('Discovery error:', e);
      setDiscoveryStatus('Discovery completed with warnings.');
      await fetchArticles();
    } finally {
      setIsDiscovering(false);
      setTimeout(() => {
        setShowDiscoveryModal(false);
        setDiscoveryStatus(null);
      }, 2500);
    }
  }, [discoverQuery, discoverUrl, fetchArticles]);

  // Live on-demand background refresh from external feeds across multiple techniques
  const handleLiveRefresh = useCallback(async () => {
    try {
      setIsRefreshing(true);
      setRefreshMessage('Connecting multi-technique ingestion sweep...');
      const res = await fetch('/api/v1/news/refresh', { method: 'POST' });
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json.data) && json.data.length > 0) {
          setArticles(json.data);
          const newCount = json.newItemsCount || (json.stats?.inserted ?? 0);
          setRefreshMessage(`Refreshed! Loaded ${json.data.length} latest dispatches${newCount > 0 ? ` (${newCount} newly indexed)` : ''}`);
        } else {
          await fetchArticles();
          setRefreshMessage('Refreshed with latest dispatches');
        }
      } else {
        await fetchArticles();
        setRefreshMessage('Refreshed feed');
      }
    } catch (e) {
      console.error('Refresh error:', e);
      await fetchArticles();
      setRefreshMessage('Feed updated');
    } finally {
      setIsRefreshing(false);
      setTimeout(() => setRefreshMessage(null), 4500);
    }
  }, [fetchArticles]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      fetchArticles();
    }
  }, [fetchArticles, searchQuery]);

  // Live full-corpus search across all dispatches
  useEffect(() => {
    const q = searchQuery.trim();
    if (!q) return;

    const timer = setTimeout(async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/v1/search?q=${encodeURIComponent(q)}&limit=60`);
        if (res.ok) {
          const json = await res.json();
          const list: Article[] = Array.isArray(json.data) ? json.data : [];
          setArticles(list);
        }
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        setLoading(false);
      }
    }, 280);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Reset pagination when tab or search changes
  useEffect(() => {
    setVisibleCount(25);
  }, [activeTab, searchQuery]);

  // Filtered & personalized article stream
  const filteredArticles = useMemo(() => {
    let list = articles;

    // Filter by saved tab
    if (activeTab === 'saved') {
      list = list.filter(a => savedIds.has(a.id));
    }

    // Filter by live search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(a =>
        a.title.toLowerCase().includes(q) ||
        (a.description && a.description.toLowerCase().includes(q)) ||
        (a.author && a.author.toLowerCase().includes(q)) ||
        a.source.toLowerCase().includes(q) ||
        (a.tags && a.tags.some(t => t.toLowerCase().includes(q)))
      );
    }

    // Deduplicate in-memory to guarantee pristine editorial uniqueness
    const seenTitles = new Set<string>();
    const seenUrls = new Set<string>();
    const unique: Article[] = [];

    for (const a of list) {
      const normTitle = a.title.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 60);
      const cleanUrl = (a.canonical_url || a.url || '').split('?')[0].replace(/\/$/, '').toLowerCase();

      if (normTitle && seenTitles.has(normTitle)) continue;
      if (cleanUrl && seenUrls.has(cleanUrl)) continue;

      if (normTitle) seenTitles.add(normTitle);
      if (cleanUrl) seenUrls.add(cleanUrl);
      unique.push(a);
    }

    return unique;
  }, [articles, activeTab, savedIds, searchQuery]);

  // Visible sliced articles
  const visibleArticles = useMemo(() => {
    return filteredArticles.slice(0, visibleCount);
  }, [filteredArticles, visibleCount]);

  // Separate hero, secondary, and rest for magazine layout
  const heroArticle = viewMode === 'magazine' && visibleArticles.length > 0 ? visibleArticles[0] : null;
  const secondaryArticles = viewMode === 'magazine' && visibleArticles.length > 2 ? visibleArticles.slice(1, 3) : [];
  const feedArticles = viewMode === 'magazine' ? (visibleArticles.length > 3 ? visibleArticles.slice(3) : visibleArticles.slice(1)) : visibleArticles;

  // Formatted date for personalized editorial masthead
  const todayDateString = useMemo(() => {
    return new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  }, []);

  return (
    <div className="min-h-screen bg-[#faf9f5] text-stone-900 selection:bg-stone-200">
      
      {/* 1. Authentic Editorial Masthead (No top bar, no boxes, pure typography) */}
      <header className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-10 pb-6 border-b border-stone-200/80">
        {/* Top Dateline & User Greeting */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-[11px] uppercase tracking-[0.2em] font-medium text-stone-500 pb-4 border-b border-stone-200/50">
          <div className="flex flex-wrap items-center gap-2">
            <span>{todayDateString}</span>
            <span className="text-stone-300">·</span>
            <span>Live Briefing</span>
            <button
              onClick={handleLiveRefresh}
              disabled={isRefreshing}
              title="Poll and ingest fresh news from active sources"
              className="ml-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-semibold tracking-wider uppercase text-stone-800 bg-stone-200/70 hover:bg-stone-300/80 active:bg-stone-300 border border-stone-300/60 transition-colors cursor-pointer disabled:opacity-50"
            >
              <RotateCw className={`h-3 w-3 ${isRefreshing ? 'animate-spin text-stone-900' : 'text-stone-600'}`} />
              <span>{isRefreshing ? 'Fetching News...' : 'Fetch Latest News'}</span>
            </button>
            <button
              onClick={() => setShowDiscoveryModal(true)}
              title="Explore and trigger 10+ news gathering techniques"
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-semibold tracking-wider uppercase text-stone-800 bg-stone-200/70 hover:bg-stone-300/80 active:bg-stone-300 border border-stone-300/60 transition-colors cursor-pointer"
            >
              <Radar className="h-3 w-3 text-stone-700" />
              <span>News Radar & Techniques</span>
            </button>
            {refreshMessage && (
              <span className="text-[10px] text-stone-700 font-normal lowercase tracking-normal bg-stone-100 px-2 py-0.5 rounded border border-stone-200/60">
                {refreshMessage}
              </span>
            )}
          </div>
          <div className="text-stone-400">
            Curated for <strong className="font-semibold text-stone-700">Piyush</strong>
          </div>
        </div>

        {/* Masthead Title & Search */}
        <div className="pt-6 pb-4 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-1">
            <h1 className="font-editorial text-4xl sm:text-5xl lg:text-6xl font-normal tracking-tight text-stone-900 leading-none">
              Piyush’s Dispatch
            </h1>
            <p className="text-sm sm:text-base text-stone-500 font-light max-w-xl">
              Handpicked intelligence across frontier AI models, research papers, and technical breakthroughs.
            </p>
          </div>

          {/* Minimalist Inline Search (No box, no button, just clean text input) */}
          <div className="relative w-full md:w-72">
            <Search className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search dispatches..."
              className="w-full bg-transparent pl-6 pr-4 py-1.5 text-sm text-stone-900 placeholder:text-stone-400 border-b border-stone-200 focus:border-stone-800 focus:outline-none transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-0 top-1/2 -translate-y-1/2 text-xs text-stone-400 hover:text-stone-700 cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Editorial Topic Navigation (Clean typographic links with underline, NO buttons, NO boxes) */}
        <nav className="flex items-center justify-between gap-6 pt-4 text-sm font-medium border-t border-stone-200/50 overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-6 sm:gap-8">
            <button
              onClick={() => { setActiveTab('for_you'); setSelectedSource(null); }}
              className={`pb-1 cursor-pointer transition-colors relative whitespace-nowrap ${
                activeTab === 'for_you'
                  ? 'text-stone-900 font-semibold after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-stone-900'
                  : 'text-stone-500 hover:text-stone-900'
              }`}
            >
              Today’s Feed
            </button>

            <button
              onClick={() => { setActiveTab('frontier'); setSelectedSource(null); }}
              className={`pb-1 cursor-pointer transition-colors relative whitespace-nowrap ${
                activeTab === 'frontier'
                  ? 'text-stone-900 font-semibold after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-stone-900'
                  : 'text-stone-500 hover:text-stone-900'
              }`}
            >
              Frontier AI
            </button>

            <button
              onClick={() => { setActiveTab('research'); setSelectedSource(null); }}
              className={`pb-1 cursor-pointer transition-colors relative whitespace-nowrap ${
                activeTab === 'research'
                  ? 'text-stone-900 font-semibold after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-stone-900'
                  : 'text-stone-500 hover:text-stone-900'
              }`}
            >
              Research & Papers
            </button>

            <button
              onClick={() => { setActiveTab('media'); setSelectedSource(null); }}
              className={`pb-1 cursor-pointer transition-colors relative whitespace-nowrap ${
                activeTab === 'media'
                  ? 'text-stone-900 font-semibold after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-stone-900'
                  : 'text-stone-500 hover:text-stone-900'
              }`}
            >
              Video & Media
            </button>

            <button
              onClick={() => { setActiveTab('saved'); setSelectedSource(null); }}
              className={`pb-1 cursor-pointer transition-colors relative whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === 'saved'
                  ? 'text-stone-900 font-semibold after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-stone-900'
                  : 'text-stone-500 hover:text-stone-900'
              }`}
            >
              <span>Reading List</span>
              {savedIds.size > 0 && (
                <span className="text-xs text-stone-400 font-normal">({savedIds.size})</span>
              )}
            </button>

            <button
              onClick={() => setShowDiscoveryModal(true)}
              className="pb-1 cursor-pointer transition-colors text-stone-600 hover:text-stone-900 relative whitespace-nowrap flex items-center gap-1 font-medium"
            >
              <Radar className="h-3.5 w-3.5 text-stone-600" />
              <span>Techniques Radar</span>
            </button>
          </div>

          {/* Quiet Layout Switcher */}
          <div className="flex items-center gap-3 text-xs text-stone-400 shrink-0">
            <button
              onClick={() => setViewMode('magazine')}
              className={`cursor-pointer transition-colors ${
                viewMode === 'magazine' ? 'text-stone-900 font-medium' : 'hover:text-stone-600'
              }`}
            >
              Magazine
            </button>
            <span className="text-stone-300">/</span>
            <button
              onClick={() => setViewMode('compact')}
              className={`cursor-pointer transition-colors ${
                viewMode === 'compact' ? 'text-stone-900 font-medium' : 'hover:text-stone-600'
              }`}
            >
              Compact
            </button>
          </div>
        </nav>

        {/* Selected Source or Topic Tag Indicator */}
        {(selectedSource || selectedTopicTag) && (
          <div className="flex items-center justify-between pt-3 text-xs text-stone-600 border-t border-stone-200/40 mt-3">
            <span>
              {selectedSource && (
                <>Filtered by publication: <strong className="font-semibold text-stone-900">{selectedSource}</strong></>
              )}
              {selectedSource && selectedTopicTag && <span className="mx-2 text-stone-300">·</span>}
              {selectedTopicTag && (
                <>Topic search: <strong className="font-semibold text-stone-900">{selectedTopicTag}</strong></>
              )}
            </span>
            <button
              onClick={() => {
                setSelectedSource(null);
                setSelectedTopicTag(null);
              }}
              className="text-stone-400 hover:text-stone-900 underline cursor-pointer text-[11px]"
            >
              Clear filter (Show all)
            </button>
          </div>
        )}
      </header>

      {/* 2. Main Content Canvas (Preference to the VIEW) */}
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {loading ? (
          /* Subtle editorial skeleton */
          <div className="space-y-8 animate-pulse">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 pb-8 border-b border-stone-200/60">
              <div className="lg:col-span-7 space-y-4">
                <div className="h-4 bg-stone-200/60 rounded w-1/4" />
                <div className="h-10 bg-stone-200/60 rounded w-3/4" />
                <div className="h-16 bg-stone-200/60 rounded w-full" />
              </div>
              <div className="lg:col-span-5 h-64 bg-stone-200/60 rounded-xs" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="space-y-3">
                  <div className="h-44 bg-stone-200/60 rounded-xs" />
                  <div className="h-4 bg-stone-200/60 rounded w-1/3" />
                  <div className="h-6 bg-stone-200/60 rounded w-5/6" />
                </div>
              ))}
            </div>
          </div>
        ) : error ? (
          <div className="py-24 text-center space-y-4">
            <p className="text-stone-500 font-light">{error}</p>
            <button
              onClick={fetchArticles}
              className="text-xs uppercase tracking-wider font-semibold text-stone-900 underline hover:text-stone-600 cursor-pointer"
            >
              Reload Dispatches
            </button>
          </div>
        ) : filteredArticles.length === 0 ? (
          <div className="py-24 text-center space-y-3">
            <h3 className="font-editorial text-2xl text-stone-700">
              {activeTab === 'saved'
                ? 'Your reading list is empty'
                : searchQuery
                ? `No dispatches match "${searchQuery}"`
                : 'No articles currently available'}
            </h3>
            <p className="text-sm text-stone-500 font-light max-w-sm mx-auto">
              {activeTab === 'saved'
                ? 'Click the bookmark on any dispatch to save stories for focused reading.'
                : 'Try adjusting your search query or switching to another topic above.'}
            </p>
          </div>
        ) : (
          <div className="space-y-12">
            
            {/* VIEW MODE 1: MAGAZINE EDITORIAL (Preference to the VIEW) */}
            {viewMode === 'magazine' && (
              <div className="space-y-12">
                {/* 1. Hero Lead Article */}
                {heroArticle && (
                  <ArticleCard
                    article={heroArticle}
                    onInspect={handleOpenArticle}
                    onSelectSource={setSelectedSource}
                    isHero={true}
                    isBookmarked={savedIds.has(heroArticle.id)}
                    onToggleBookmark={toggleBookmark}
                    isRead={readIds.has(heroArticle.id)}
                  />
                )}

                {/* 2. Secondary Editorial Pair (if available) */}
                {secondaryArticles.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12 pb-8 border-b border-stone-200/70">
                    {secondaryArticles.map((article) => (
                      <ArticleCard
                        key={article.id}
                        article={article}
                        onInspect={handleOpenArticle}
                        onSelectSource={setSelectedSource}
                        isHero={false}
                        isBookmarked={savedIds.has(article.id)}
                        onToggleBookmark={toggleBookmark}
                        isRead={readIds.has(article.id)}
                      />
                    ))}
                  </div>
                )}

                {/* 3. Broadsheet Grid */}
                {feedArticles.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 lg:gap-10">
                    {feedArticles.map((article) => (
                      <ArticleCard
                        key={article.id}
                        article={article}
                        onInspect={handleOpenArticle}
                        onSelectSource={setSelectedSource}
                        isHero={false}
                        isBookmarked={savedIds.has(article.id)}
                        onToggleBookmark={toggleBookmark}
                        isRead={readIds.has(article.id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* VIEW MODE 2: COMPACT EDITORIAL LIST */}
            {viewMode === 'compact' && (
              <div className="divide-y divide-stone-200/60">
                {visibleArticles.map((article) => (
                  <ArticleListItem
                    key={article.id}
                    article={article}
                    onInspect={handleOpenArticle}
                    onSelectSource={setSelectedSource}
                    isBookmarked={savedIds.has(article.id)}
                    onToggleBookmark={toggleBookmark}
                    isRead={readIds.has(article.id)}
                  />
                ))}
              </div>
            )}

            {/* Load More Dispatches (Clean typographic prompt, not a chunky button) */}
            {visibleCount < filteredArticles.length && (
              <div className="pt-8 text-center">
                <button
                  onClick={() => setVisibleCount((prev) => Math.min(prev + 24, filteredArticles.length))}
                  className="group inline-flex items-center gap-2 text-xs uppercase tracking-widest font-semibold text-stone-800 hover:text-stone-500 transition-colors cursor-pointer py-3"
                >
                  <span>Load More Dispatches ({filteredArticles.length - visibleCount} remaining)</span>
                  <ArrowRight className="h-3.5 w-3.5 transform group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      {/* 3. Pure Distraction-Free Reading Modal */}
      <ArticleModal
        article={selectedArticle}
        onClose={() => setSelectedArticle(null)}
        isBookmarked={selectedArticle ? savedIds.has(selectedArticle.id) : false}
        onToggleBookmark={toggleBookmark}
      />

      {/* 4. Multi-Technique Radar & Discovery Modal */}
      <TechniquesRadarModal
        isOpen={showDiscoveryModal}
        onClose={() => setShowDiscoveryModal(false)}
        onArticlesUpdated={(updatedArticles) => {
          setArticles(updatedArticles);
        }}
        onSelectTopicTag={(tag) => {
          setSelectedTopicTag(tag);
        }}
      />

    </div>
  );
}
