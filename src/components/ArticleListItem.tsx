import React, { useState, useEffect, useMemo } from 'react';
import {
  ExternalLink,
  Clock,
  User,
  Star,
  MessageSquare,
  BookOpen,
  Code,
  Radio,
  Share2,
  Video,
  Mic,
  FileCode2,
  FileText,
  Eye,
  ThumbsUp
} from 'lucide-react';
import { Article } from '../types.js';
import {
  isLowQualityMedia,
  upgradeMediaQuality,
  extractYouTubeId
} from '../utils/mediaQuality.js';

interface ArticleListItemProps {
  article: Article;
  onInspect: (article: Article) => void;
  onSelectSource?: (sourceId: string) => void;
}

export const ArticleListItem: React.FC<ArticleListItemProps> = React.memo(({
  article,
  onInspect,
  onSelectSource
}) => {
  const timeAgo = (dateStr: string | null | undefined) => {
    if (!dateStr) return 'Recent';
    try {
      const parsed = new Date(dateStr);
      if (isNaN(parsed.getTime())) return 'Recent';
      const ms = Date.now() - parsed.getTime();
      if (ms < 0) return 'Just now';
      const mins = Math.floor(ms / 60000);
      if (mins < 60) return `${mins}m ago`;
      const hrs = Math.floor(mins / 60);
      if (hrs < 24) return `${hrs}h ago`;
      const days = Math.floor(hrs / 24);
      return `${days}d ago`;
    } catch {
      return 'Recent';
    }
  };

  const getBadgeStyle = (type: string) => {
    switch (type) {
      case 'research':
        return { icon: BookOpen, classes: 'bg-indigo-50 text-indigo-700 border-indigo-200' };
      case 'code':
        return { icon: Code, classes: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
      case 'video':
        return { icon: Video, classes: 'bg-rose-50 text-rose-700 border-rose-200' };
      case 'podcast':
        return { icon: Mic, classes: 'bg-purple-50 text-purple-700 border-purple-200' };
      case 'community':
        return { icon: MessageSquare, classes: 'bg-amber-50 text-amber-800 border-amber-200' };
      default:
        return { icon: Radio, classes: 'bg-stone-100 text-stone-700 border-stone-200' };
    }
  };

  const { icon: TypeIcon, classes: badgeClasses } = getBadgeStyle(article.source_type);
  const displayDate = article.published_at || article.seen_at;
  const linkedCount = article.linked_sources?.length || 1;
  const hasAudio = article.media?.some(m => m.type === 'audio');
  const hasVideo = article.source_type === 'video' || article.media?.some(m => m.type === 'video');

  const ytVideoId = extractYouTubeId((article.url || '') + ' ' + (article.image_url || ''));
  const initialThumbnail = useMemo(() => {
    if (ytVideoId) {
      return `https://i.ytimg.com/vi/${ytVideoId}/maxresdefault.jpg`;
    }
    const rawImg = article.image_url || article.media?.find(m => m.type === 'image')?.url;
    if (rawImg && !isLowQualityMedia(rawImg)) {
      return upgradeMediaQuality(rawImg) || rawImg;
    }
    return null;
  }, [ytVideoId, article.image_url, article.media]);

  const [thumbSrc, setThumbSrc] = useState<string | null>(initialThumbnail);

  useEffect(() => {
    setThumbSrc(initialThumbnail);
  }, [initialThumbnail]);

  const handleThumbError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    if (ytVideoId && thumbSrc && thumbSrc.includes('maxresdefault.jpg')) {
      setThumbSrc(`https://i.ytimg.com/vi/${ytVideoId}/sddefault.jpg`);
      return;
    }
    if (ytVideoId && thumbSrc && thumbSrc.includes('sddefault.jpg')) {
      setThumbSrc(`https://i.ytimg.com/vi/${ytVideoId}/hqdefault.jpg`);
      return;
    }
    // If not proxied yet and is remote HTTP, try proxy tunnel
    if (thumbSrc && /^https?:\/\//i.test(thumbSrc) && !thumbSrc.includes('/api/v1/media/')) {
      const p = new URLSearchParams({
        url: thumbSrc,
        title: article.title || '',
        category: article.category || 'technology',
        sourceId: article.source_id || '',
        domain: article.domain || ''
      });
      setThumbSrc(`/api/v1/media/proxy?${p.toString()}`);
      return;
    }
    setThumbSrc(null);
  };

  return (
    <div
      id={`article-row-${article.id}`}
      className="group flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border border-stone-200 bg-white p-3 shadow-2xs transition-all hover:border-amber-300 hover:shadow-xs"
    >
      {/* Left: Source, Type, Thumbnail, Title & Metadata */}
      <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
        {/* Upfront Thumbnail Preview */}
        {thumbSrc && (
          <div
            onClick={() => onInspect(article)}
            className="relative h-10 w-16 shrink-0 overflow-hidden rounded-md bg-stone-900 cursor-pointer shadow-2xs border border-stone-200 group-hover:border-amber-400 transition-all"
            title={hasVideo ? 'Watch video demo' : 'Inspect article & media'}
          >
            <img
              src={thumbSrc}
              alt=""
              referrerPolicy="no-referrer"
              className="h-full w-full object-cover"
              onError={handleThumbError}
            />
            {hasVideo && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/25 group-hover:bg-black/10 transition-colors">
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-red-600/90 text-white shadow-xs">
                  <Video className="h-2.5 w-2.5 ml-0.5" />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Source Badge */}
        {onSelectSource ? (
          <button
            type="button"
            onClick={() => onSelectSource(article.source_id)}
            title={`Filter by ${article.source}`}
            className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-medium shrink-0 border cursor-pointer hover:opacity-85 ${badgeClasses}`}
          >
            <TypeIcon className="h-3 w-3" />
            <span className="truncate max-w-[110px]">{article.source}</span>
          </button>
        ) : (
          <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-medium shrink-0 border ${badgeClasses}`}>
            <TypeIcon className="h-3 w-3" />
            <span className="truncate max-w-[110px]">{article.source}</span>
          </span>
        )}

        {/* Media indicator pill */}
        {hasVideo && (
          <span className="inline-flex items-center gap-0.5 rounded bg-rose-50 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700 border border-rose-200 shrink-0">
            <Video className="h-2.5 w-2.5" /> Video
          </span>
        )}
        {hasAudio && (
          <span className="inline-flex items-center gap-0.5 rounded bg-purple-50 px-1.5 py-0.5 text-[10px] font-semibold text-purple-700 border border-purple-200 shrink-0">
            <Mic className="h-2.5 w-2.5" /> Audio
          </span>
        )}
        {linkedCount > 1 && (
          <span className="inline-flex items-center gap-0.5 rounded bg-purple-50 px-1.5 py-0.5 text-[10px] font-semibold text-purple-700 border border-purple-200 shrink-0">
            <Share2 className="h-2.5 w-2.5" /> {linkedCount} Feeds
          </span>
        )}

        {/* Title */}
        <div className="min-w-0 flex-1">
          <button
            onClick={() => onInspect(article)}
            className="text-left font-semibold text-xs sm:text-sm text-stone-900 group-hover:text-amber-900 line-clamp-1 cursor-pointer hover:underline focus:outline-none"
            title={article.title}
          >
            {article.title}
          </button>
        </div>
      </div>

      {/* Right: Metrics, Time & Action Buttons */}
      <div className="flex items-center justify-between sm:justify-end gap-3 text-xs shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-stone-100">
        {/* Metrics */}
        <div className="flex items-center gap-2.5 text-stone-400 text-[11px]">
          {article.metrics?.stars !== undefined && article.metrics.stars > 0 && (
            <span className="flex items-center gap-0.5 font-medium text-amber-600">
              <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
              {article.metrics.stars.toLocaleString()}
            </span>
          )}
          {article.metrics?.citations !== undefined && article.metrics.citations > 0 && (
            <span className="flex items-center gap-0.5 font-medium text-indigo-600">
              <BookOpen className="h-3 w-3 text-indigo-500" />
              {article.metrics.citations}
            </span>
          )}
          {article.metrics?.views !== undefined && article.metrics.views > 0 && (
            <span className="flex items-center gap-0.5 font-medium text-rose-600" title={`${article.metrics.views.toLocaleString()} views`}>
              <Eye className="h-3 w-3 text-rose-500" />
              {article.metrics.views >= 1000000 ? (article.metrics.views / 1000000).toFixed(1) + 'M' : article.metrics.views >= 1000 ? (article.metrics.views / 1000).toFixed(1) + 'k' : article.metrics.views}
            </span>
          )}
          {article.metrics?.likes !== undefined && article.metrics.likes > 0 && (
            <span className="flex items-center gap-0.5 font-medium text-emerald-600" title={`${article.metrics.likes.toLocaleString()} likes`}>
              <ThumbsUp className="h-3 w-3 text-emerald-500" />
              {article.metrics.likes >= 1000 ? (article.metrics.likes / 1000).toFixed(1) + 'k' : article.metrics.likes}
            </span>
          )}
          {article.metrics?.comments !== undefined && article.metrics.comments > 0 && (
            <span className="flex items-center gap-0.5 text-stone-600">
              <MessageSquare className="h-3 w-3" />
              {article.metrics.comments}
            </span>
          )}
          <span className="flex items-center gap-1" title={displayDate ? new Date(displayDate).toUTCString() : ''}>
            <Clock className="h-3 w-3" />
            {timeAgo(displayDate)}
          </span>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onInspect(article)}
            className="inline-flex items-center gap-1 rounded bg-stone-900 px-2 py-1 text-[11px] font-medium text-white hover:bg-stone-800 transition-colors cursor-pointer"
            title="Open full reader view & data contract"
          >
            <BookOpen className="h-3 w-3" />
            <span className="hidden sm:inline">Inspect</span>
          </button>

          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded border border-stone-200 bg-white px-2 py-1 text-[11px] font-medium text-stone-600 hover:bg-stone-50 hover:text-stone-900 transition-colors"
            title="Open canonical source link"
          >
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>
    </div>
  );
});
