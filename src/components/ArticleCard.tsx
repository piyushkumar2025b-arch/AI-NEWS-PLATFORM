import React from 'react';
import {
  ExternalLink,
  Clock,
  User,
  Star,
  MessageSquare,
  BookOpen,
  Code,
  Radio,
  FileCode2,
  Share2,
  Calendar,
  Video,
  Mic,
  Eye,
  ThumbsUp
} from 'lucide-react';
import { Article } from '../types.js';
import { MediaRenderer } from './MediaRenderer.js';

interface ArticleCardProps {
  article: Article;
  onInspect: (article: Article) => void;
  onSelectSource?: (sourceId: string) => void;
}

export const ArticleCard: React.FC<ArticleCardProps> = React.memo(({ article, onInspect, onSelectSource }) => {
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

  const formatExactDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return 'Timestamp unavailable';
    try {
      const d = new Date(dateStr);
      return isNaN(d.getTime()) ? dateStr : d.toUTCString();
    } catch {
      return dateStr;
    }
  };

  const getSourceTypeBadge = (type: string) => {
    switch (type) {
      case 'research':
        return {
          label: 'Academic Research',
          icon: BookOpen,
          classes: 'bg-indigo-50 text-indigo-700 border-indigo-200'
        };
      case 'code':
        return {
          label: 'Code & Models',
          icon: Code,
          classes: 'bg-emerald-50 text-emerald-700 border-emerald-200'
        };
      case 'community':
        return {
          label: 'Community Discussion',
          icon: MessageSquare,
          classes: 'bg-amber-50 text-amber-800 border-amber-200'
        };
      case 'video':
        return {
          label: 'Video & Media',
          icon: Video,
          classes: 'bg-rose-50 text-rose-700 border-rose-200'
        };
      case 'podcast':
        return {
          label: 'Podcast & Audio',
          icon: Mic,
          classes: 'bg-purple-50 text-purple-700 border-purple-200'
        };
      default:
        return {
          label: 'News Syndicate',
          icon: Radio,
          classes: 'bg-stone-100 text-stone-700 border-stone-200'
        };
    }
  };

  const badgeInfo = getSourceTypeBadge(article.source_type);
  const BadgeIcon = badgeInfo.icon;
  const linkedCount = article.linked_sources?.length || 1;
  const displayDate = article.published_at || article.seen_at;
  const dateProvenance = article.published_at ? 'Published' : 'Indexed';

  return (
    <article
      id={`article-${article.id}`}
      className="group relative flex flex-col justify-between rounded-xl border border-stone-200 bg-white p-5 shadow-xs transition-all hover:border-stone-300 hover:shadow-md"
    >
      <div>
        {/* Source header row */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {onSelectSource ? (
              <button
                type="button"
                onClick={() => onSelectSource(article.source_id)}
                title={`Filter news by ${article.source}`}
                className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium cursor-pointer transition-transform hover:scale-105 ${badgeInfo.classes}`}
              >
                <BadgeIcon className="h-3 w-3" />
                {article.source}
              </button>
            ) : (
              <span
                className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium ${badgeInfo.classes}`}
              >
                <BadgeIcon className="h-3 w-3" />
                {article.source}
              </span>
            )}

            {/* Publisher provenance if distinct */}
            {article.publisher?.name && article.publisher.name !== article.source && (
              <span className="inline-flex items-center rounded-md border border-stone-200 bg-stone-50 px-2 py-0.5 text-[11px] font-medium text-stone-600">
                Via: {article.publisher.name}
              </span>
            )}

            {/* Deduplicated Multi-source badge */}
            {linkedCount > 1 && (
              <span
                className="inline-flex items-center gap-1 rounded-md border border-purple-200 bg-purple-50 px-2 py-0.5 text-[11px] font-semibold text-purple-700"
                title={`Deduplicated across ${linkedCount} ingested feeds: ${article.linked_sources?.map(s => s.sourceName).join(', ')}`}
              >
                <Share2 className="h-3 w-3" />
                {linkedCount} feeds merged
              </span>
            )}
          </div>

          {/* Time & Domain */}
          <div
            className="flex items-center gap-1.5 text-xs text-stone-400 cursor-help"
            title={`${dateProvenance}: ${formatExactDate(displayDate)}`}
          >
            <Clock className="h-3 w-3" />
            <span>{timeAgo(displayDate)}</span>
            <span>•</span>
            <span className="truncate max-w-[120px]">{article.domain}</span>
          </div>
        </div>

        {/* Media Thumbnail / Embed via Unified MediaRenderer */}
        <MediaRenderer
          media={article.media}
          fallbackImageUrl={article.image_url}
          articleUrl={article.url}
          title={article.title}
          category={article.category}
          source={article.source}
          sourceId={article.source_id}
          domain={article.domain}
          aspectRatio="video"
          className="mt-3"
        />

        {/* Article Title */}
        <h3 className="mt-3 text-base font-semibold leading-snug tracking-tight text-stone-900 group-hover:text-amber-900 transition-colors">
          <button
            onClick={() => onInspect(article)}
            className="text-left hover:underline cursor-pointer focus:outline-none"
          >
            {article.title}
          </button>
        </h3>

        {/* Article Description */}
        {article.description && (
          <p className="mt-2 text-xs leading-relaxed text-stone-600 line-clamp-3">
            {article.description}
          </p>
        )}

        {/* Tags */}
        {article.tags && article.tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1">
            {article.tags.slice(0, 4).map((tag, idx) => (
              <span
                key={idx}
                className="rounded bg-stone-100 px-1.5 py-0.5 text-[10px] font-medium text-stone-600"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Footer Metrics & Actions */}
      <div className="mt-4 flex items-center justify-between border-t border-stone-100 pt-3 text-xs">
        {/* Left: Author / Metrics */}
        <div className="flex items-center gap-3 text-stone-500">
          {article.author && (
            <div className="flex items-center gap-1 truncate max-w-[140px]" title={article.author}>
              <User className="h-3 w-3 shrink-0 text-stone-400" />
              <span className="truncate text-[11px]">{article.author}</span>
            </div>
          )}

          {article.metrics?.stars !== undefined && article.metrics.stars > 0 && (
            <div className="flex items-center gap-1 text-[11px] font-medium text-amber-600">
              <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
              <span>{article.metrics.stars.toLocaleString()}</span>
            </div>
          )}

          {article.metrics?.comments !== undefined && article.metrics.comments > 0 && (
            <div className="flex items-center gap-1 text-[11px] text-stone-600">
              <MessageSquare className="h-3 w-3 text-stone-400" />
              <span>{article.metrics.comments}</span>
            </div>
          )}

          {article.metrics?.citations !== undefined && article.metrics.citations > 0 && (
            <div className="flex items-center gap-1 text-[11px] font-medium text-indigo-600">
              <BookOpen className="h-3 w-3 text-indigo-500" />
              <span>{article.metrics.citations} citations</span>
            </div>
          )}

          {article.metrics?.views !== undefined && article.metrics.views > 0 && (
            <div className="flex items-center gap-1 text-[11px] font-medium text-rose-600" title={`${article.metrics.views.toLocaleString()} views`}>
              <Eye className="h-3 w-3 text-rose-500" />
              <span>{article.metrics.views >= 1000000 ? (article.metrics.views / 1000000).toFixed(1) + 'M' : article.metrics.views >= 1000 ? (article.metrics.views / 1000).toFixed(1) + 'k' : article.metrics.views}</span>
            </div>
          )}

          {article.metrics?.likes !== undefined && article.metrics.likes > 0 && (
            <div className="flex items-center gap-1 text-[11px] font-medium text-emerald-600" title={`${article.metrics.likes.toLocaleString()} likes`}>
              <ThumbsUp className="h-3 w-3 text-emerald-500" />
              <span>{article.metrics.likes >= 1000 ? (article.metrics.likes / 1000).toFixed(1) + 'k' : article.metrics.likes}</span>
            </div>
          )}
        </div>

        {/* Right: Inspect & Open */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onInspect(article)}
            className="inline-flex items-center gap-1 rounded border border-stone-200 bg-stone-50 px-2 py-1 text-[11px] font-medium text-stone-600 hover:bg-stone-100 hover:text-stone-900 transition-colors cursor-pointer"
            title="Inspect Data Contract, Schema & Provenance"
          >
            <FileCode2 className="h-3 w-3" />
            <span className="hidden sm:inline">Data</span>
          </button>

          <button
            onClick={() => onInspect(article)}
            className="inline-flex items-center gap-1 rounded bg-stone-900 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-stone-800 transition-colors cursor-pointer shadow-xs"
            title="Open in-depth reader view with extracted text and summary"
          >
            <BookOpen className="h-3 w-3" />
            <span>Full Story</span>
          </button>

          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded border border-stone-200 bg-white px-2 py-1 text-[11px] font-medium text-stone-600 hover:bg-stone-50 hover:text-stone-900 transition-colors"
            title="Open canonical article in new tab"
          >
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>
    </article>
  );
});

