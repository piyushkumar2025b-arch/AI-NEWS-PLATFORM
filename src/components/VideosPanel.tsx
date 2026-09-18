import React, { useState, useEffect, useCallback } from 'react';
import {
  Search,
  Video,
  Play,
  Tv,
  RefreshCw,
  Eye,
  ThumbsUp,
  MessageSquare,
  Clock,
  ExternalLink,
  Sparkles,
  SlidersHorizontal,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { Article } from '../types.js';
import { MediaRenderer } from './MediaRenderer.js';

interface VideosPanelProps {
  onSelectArticle: (article: Article) => void;
  showNotification: (type: 'error' | 'success' | 'info', message: string, title?: string) => void;
}

interface ChannelInfo {
  id: string;
  name: string;
  domain: string;
  videoCount: number;
}

const TRENDING_SEARCH_PROMPTS = [
  'DeepSeek R1',
  'Karpathy Neural Nets',
  'Robotics GPT-3',
  '3Blue1Brown Attention',
  'Agent Swarms',
  'OpenAI o3',
  'Gemini 2.0 Flash',
  'Local LLMs Ollama'
];

export const VideosPanel: React.FC<VideosPanelProps> = ({
  onSelectArticle,
  showNotification
}) => {
  const [videos, setVideos] = useState<Article[]>([]);
  const [channels, setChannels] = useState<ChannelInfo[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchingLive, setSearchingLive] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null);
  const [selectedPlatform, setSelectedPlatform] = useState<'all' | 'youtube' | 'dailymotion' | 'vimeo'>('all');
  const [sortBy, setSortBy] = useState<'latest' | 'views'>('latest');

  // Load videos from repository
  const loadVideos = useCallback(async (query: string = '') => {
    try {
      setLoading(true);
      let url = `/api/v1/videos?limit=60&sort=${sortBy === 'views' ? 'engagement' : 'latest'}`;
      if (query) {
        url += `&search=${encodeURIComponent(query)}`;
      }
      if (selectedChannel) {
        url += `&channel=${encodeURIComponent(selectedChannel)}`;
      }

      const res = await fetch(url);
      const json = await res.json();

      if (json.success && Array.isArray(json.data)) {
        setVideos(json.data);
      }
    } catch (err: any) {
      console.error('Failed to load videos:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedChannel, sortBy]);

  // Load channel facets
  const loadChannels = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/videos/channels');
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setChannels(json.data);
      }
    } catch {
      // Non-blocking
    }
  }, []);

  // Perform Live Deep Search across real video search engines
  const handleLiveSearch = async (term: string) => {
    const q = term.trim();
    if (!q) {
      loadVideos('');
      return;
    }

    try {
      setSearchingLive(true);
      showNotification('info', `Searching live video networks for "${q}"...`, 'Live Video Discovery');

      const res = await fetch(`/api/v1/videos/search?q=${encodeURIComponent(q)}&limit=40`);
      const json = await res.json();

      if (json.success && Array.isArray(json.data)) {
        setVideos(json.data);
        showNotification(
          'success',
          `Discovered ${json.data.length} real videos across YouTube & video networks for "${q}".`,
          'Real Videos Ingested'
        );
      } else {
        showNotification('error', 'Live search returned no matching streams.', 'Search Incomplete');
      }
    } catch (err: any) {
      showNotification('error', err.message || 'Live video search failed', 'Network Warning');
    } finally {
      setSearchingLive(false);
      loadChannels();
    }
  };

  useEffect(() => {
    loadVideos(searchQuery);
    loadChannels();
  }, [loadVideos, loadChannels]);

  // Format view counts into readable K / M format
  const formatViews = (views?: number) => {
    if (!views || isNaN(views)) return null;
    if (views >= 1000000) return `${(views / 1000000).toFixed(1)}M views`;
    if (views >= 1000) return `${(views / 1000).toFixed(0)}K views`;
    return `${views} views`;
  };

  // Format relative time
  const formatTime = (isoString?: string) => {
    if (!isoString) return '';
    try {
      const date = new Date(isoString);
      const diffHours = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60));
      if (diffHours < 1) return 'Just now';
      if (diffHours < 24) return `${diffHours}h ago`;
      const diffDays = Math.floor(diffHours / 24);
      if (diffDays === 1) return 'Yesterday';
      if (diffDays < 30) return `${diffDays}d ago`;
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return '';
    }
  };

  // Filter videos by platform in memory
  const filteredVideos = videos.filter(v => {
    if (selectedPlatform === 'all') return true;
    const url = (v.url + ' ' + (v.canonical_url || '')).toLowerCase();
    if (selectedPlatform === 'youtube') return url.includes('youtube') || url.includes('youtu.be');
    if (selectedPlatform === 'dailymotion') return url.includes('dailymotion') || url.includes('dai.ly');
    if (selectedPlatform === 'vimeo') return url.includes('vimeo');
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Top Banner & Search Console */}
      <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-stone-100 pb-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-600 text-white shadow-md shadow-red-600/20">
              <Tv className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-stone-900">
                Frontier AI Videos & Research Lectures
              </h1>
              <p className="text-xs text-stone-500">
                Live video intelligence aggregating academic lectures, paper breakdowns, and tech reports across YouTube, DailyMotion, and research channels.
              </p>
            </div>
          </div>

          <button
            onClick={() => handleLiveSearch(searchQuery || 'artificial intelligence breakthrough')}
            disabled={searchingLive}
            className="inline-flex items-center gap-2 rounded-xl bg-stone-900 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-stone-800 disabled:opacity-50 transition-all cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${searchingLive ? 'animate-spin' : ''}`} />
            <span>{searchingLive ? 'Querying Video APIs...' : 'Discover Real Live Videos'}</span>
          </button>
        </div>

        {/* Live Search Input */}
        <div className="mt-5 space-y-3">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleLiveSearch(searchQuery);
            }}
            className="relative flex items-center"
          >
            <Search className="absolute left-3.5 h-4 w-4 text-stone-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search live AI videos (e.g. DeepSeek R1, Transformers from scratch, Robotics, Vision-Language)..."
              className="w-full rounded-xl border border-stone-200 bg-stone-50/75 py-2.5 pl-10 pr-28 text-xs text-stone-900 placeholder-stone-400 focus:border-stone-900 focus:bg-white focus:outline-hidden"
            />
            <button
              type="submit"
              disabled={searchingLive}
              className="absolute right-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50 transition-colors cursor-pointer"
            >
              {searchingLive ? 'Searching...' : 'Real Search'}
            </button>
          </form>

          {/* Quick Trending Research Topics */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="flex items-center gap-1 text-[11px] font-medium text-stone-400 mr-1">
              <Sparkles className="h-3 w-3 text-amber-500" />
              Live Topics:
            </span>
            {TRENDING_SEARCH_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                onClick={() => {
                  setSearchQuery(prompt);
                  handleLiveSearch(prompt);
                }}
                className="rounded-full border border-stone-200 bg-white px-2.5 py-1 text-[11px] font-medium text-stone-600 hover:border-stone-400 hover:bg-stone-50 hover:text-stone-900 transition-colors cursor-pointer"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Control Bar: Platform & Channel Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-stone-200 bg-white px-4 py-3">
        {/* Platform Selector */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setSelectedPlatform('all')}
            className={`rounded-lg px-3 py-1 text-xs font-medium transition-colors cursor-pointer ${
              selectedPlatform === 'all'
                ? 'bg-stone-900 text-white'
                : 'text-stone-600 hover:bg-stone-100'
            }`}
          >
            All Platforms ({videos.length})
          </button>
          <button
            onClick={() => setSelectedPlatform('youtube')}
            className={`flex items-center gap-1 rounded-lg px-3 py-1 text-xs font-medium transition-colors cursor-pointer ${
              selectedPlatform === 'youtube'
                ? 'bg-red-600 text-white'
                : 'text-stone-600 hover:bg-stone-100'
            }`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
            YouTube
          </button>
          <button
            onClick={() => setSelectedPlatform('dailymotion')}
            className={`flex items-center gap-1 rounded-lg px-3 py-1 text-xs font-medium transition-colors cursor-pointer ${
              selectedPlatform === 'dailymotion'
                ? 'bg-sky-600 text-white'
                : 'text-stone-600 hover:bg-stone-100'
            }`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
            DailyMotion
          </button>
          <button
            onClick={() => setSelectedPlatform('vimeo')}
            className={`flex items-center gap-1 rounded-lg px-3 py-1 text-xs font-medium transition-colors cursor-pointer ${
              selectedPlatform === 'vimeo'
                ? 'bg-teal-600 text-white'
                : 'text-stone-600 hover:bg-stone-100'
            }`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-teal-400" />
            Vimeo
          </button>
        </div>

        {/* Creator / Channel Filter & Sort */}
        <div className="flex items-center gap-3">
          {channels.length > 0 && (
            <select
              value={selectedChannel || ''}
              onChange={(e) => setSelectedChannel(e.target.value || null)}
              className="rounded-lg border border-stone-200 bg-white px-2.5 py-1 text-xs text-stone-700 focus:outline-hidden"
            >
              <option value="">All Channels / Creators ({channels.length})</option>
              {channels.map((ch) => (
                <option key={ch.id} value={ch.name}>
                  {ch.name} ({ch.videoCount})
                </option>
              ))}
            </select>
          )}

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="rounded-lg border border-stone-200 bg-white px-2.5 py-1 text-xs text-stone-700 focus:outline-hidden"
          >
            <option value="latest">Sort: Latest Releases</option>
            <option value="views">Sort: Most Viewed / Engagement</option>
          </select>
        </div>
      </div>

      {/* Videos Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3, 4, 5, 6].map((idx) => (
            <div key={idx} className="animate-pulse rounded-2xl border border-stone-200 bg-white p-4 space-y-3">
              <div className="aspect-video w-full rounded-xl bg-stone-200" />
              <div className="h-4 w-3/4 rounded bg-stone-200" />
              <div className="h-3 w-1/2 rounded bg-stone-200" />
            </div>
          ))}
        </div>
      ) : filteredVideos.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-stone-300 bg-stone-50/50 py-16 px-4 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-stone-100 text-stone-400 mb-3">
            <Video className="h-6 w-6" />
          </div>
          <h3 className="text-sm font-semibold text-stone-800">No videos matching filters</h3>
          <p className="mt-1 text-xs text-stone-500 max-w-sm">
            Try running a live search across video APIs to discover and ingest fresh real videos on this topic.
          </p>
          <button
            onClick={() => handleLiveSearch(searchQuery || 'artificial intelligence')}
            className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-red-700 cursor-pointer"
          >
            <Search className="h-3.5 w-3.5" />
            <span>Search Video Networks for &quot;{searchQuery || 'AI Breakthroughs'}&quot;</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredVideos.map((video) => {
            const author = video.publisher?.name || video.author || video.source;
            const viewsStr = formatViews(video.metrics?.views);
            const timeStr = formatTime(video.published_at);
            const isDailyMotion = video.domain?.includes('dailymotion');
            const isVimeo = video.domain?.includes('vimeo');
            const durationBadge = video.raw_metadata?.durationFormatted;

            return (
              <div
                key={video.id}
                className="group flex flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-xs hover:border-stone-300 hover:shadow-md transition-all"
              >
                {/* Embedded / Preview Player */}
                <div className="relative aspect-video w-full bg-stone-900">
                  <MediaRenderer
                    media={video.media}
                    fallbackImageUrl={video.image_url}
                    title={video.title}
                    category="video"
                    source={video.source}
                    sourceId={video.source_id}
                    domain={video.domain}
                    aspectRatio="video"
                  />

                  {/* Duration Tag if known */}
                  {durationBadge && (
                    <span className="absolute bottom-2.5 right-2.5 rounded bg-black/80 px-1.5 py-0.5 text-[10px] font-mono font-medium text-white backdrop-blur-xs">
                      {durationBadge}
                    </span>
                  )}
                </div>

                {/* Video Info Block */}
                <div className="flex flex-1 flex-col justify-between p-4 space-y-3">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2 text-[11px] text-stone-500">
                      <span className="font-semibold text-stone-900 truncate">
                        {author}
                      </span>
                      <span className="shrink-0 text-stone-400">
                        {timeStr}
                      </span>
                    </div>

                    <h3
                      onClick={() => onSelectArticle(video)}
                      className="text-xs font-semibold leading-snug text-stone-900 line-clamp-2 hover:text-red-600 transition-colors cursor-pointer"
                      title={video.title}
                    >
                      {video.title}
                    </h3>

                    <p className="text-[11px] text-stone-500 line-clamp-2">
                      {video.description}
                    </p>
                  </div>

                  {/* Footer Metrics & Actions */}
                  <div className="flex items-center justify-between border-t border-stone-100 pt-3 text-[11px] text-stone-500">
                    <div className="flex items-center gap-3">
                      {viewsStr && (
                        <span className="flex items-center gap-1 font-mono">
                          <Eye className="h-3 w-3 text-stone-400" />
                          {viewsStr}
                        </span>
                      )}
                      {Boolean(video.metrics?.likes) && (
                        <span className="flex items-center gap-1 font-mono">
                          <ThumbsUp className="h-3 w-3 text-stone-400" />
                          {video.metrics?.likes?.toLocaleString()}
                        </span>
                      )}
                      {Boolean(video.metrics?.comments) && (
                        <span className="flex items-center gap-1 font-mono">
                          <MessageSquare className="h-3 w-3 text-stone-400" />
                          {video.metrics?.comments}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onSelectArticle(video)}
                        className="inline-flex items-center gap-1 rounded-md bg-stone-100 px-2 py-1 text-[11px] font-medium text-stone-700 hover:bg-stone-200 transition-colors cursor-pointer"
                        title="View reader & video notes"
                      >
                        Details
                      </button>

                      <a
                        href={video.canonical_url || video.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-md p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-700 transition-colors"
                        title="Open on platform"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
