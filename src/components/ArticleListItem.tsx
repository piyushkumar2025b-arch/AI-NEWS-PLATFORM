import React from 'react';
import { Bookmark, ExternalLink } from 'lucide-react';
import { Article } from '../types.js';
import { MediaRenderer } from './MediaRenderer.js';

interface ArticleListItemProps {
  article: Article;
  onInspect: (article: Article) => void;
  onSelectSource?: (sourceId: string) => void;
  isBookmarked?: boolean;
  onToggleBookmark?: (articleId: string) => void;
  isRead?: boolean;
}

export const ArticleListItem: React.FC<ArticleListItemProps> = React.memo(({
  article,
  onInspect,
  onSelectSource,
  isBookmarked = false,
  onToggleBookmark,
  isRead = false
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

  const displayDate = article.published_at || article.seen_at;

  return (
    <article
      id={`article-row-${article.id}`}
      className={`group flex items-start justify-between gap-6 py-4 border-b border-stone-200/50 cursor-pointer transition-opacity ${
        isRead ? 'opacity-70 hover:opacity-100' : ''
      }`}
      onClick={() => onInspect(article)}
    >
      <div className="flex-1 min-w-0 space-y-1.5">
        {/* Kicker */}
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-stone-500 font-medium">
          <span
            onClick={(e) => {
              if (onSelectSource) {
                e.stopPropagation();
                onSelectSource(article.source_id);
              }
            }}
            className="hover:text-stone-900 transition-colors"
          >
            {article.source}
          </span>
          <span className="text-stone-300">·</span>
          <span className="text-stone-400 font-normal">{timeAgo(displayDate)}</span>
          {article.author && (
            <>
              <span className="text-stone-300">·</span>
              <span className="truncate max-w-[180px] font-normal text-stone-400">By {article.author}</span>
            </>
          )}
        </div>

        {/* Title */}
        <h3 className="font-editorial text-lg sm:text-xl font-normal leading-snug tracking-tight text-stone-900 group-hover:text-stone-600 transition-colors">
          {article.title}
        </h3>

        {/* Excerpt */}
        {article.description && (
          <p className="text-xs sm:text-sm text-stone-600 font-light leading-relaxed line-clamp-2 max-w-3xl">
            {article.description}
          </p>
        )}
      </div>

      {/* Right side: Thumbnail + bookmark */}
      <div className="flex items-center gap-4 shrink-0">
        <div className="hidden sm:block w-28 h-20 overflow-hidden rounded-xs bg-stone-100">
          <MediaRenderer
            media={article.media}
            fallbackImageUrl={article.image_url}
            articleUrl={article.url}
            title={article.title}
            category={article.category}
            source={article.source}
            sourceId={article.source_id}
            domain={article.domain}
            aspectRatio="square"
            className="w-full h-full object-cover"
          />
        </div>

        {onToggleBookmark && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleBookmark(article.id);
            }}
            className="p-1 text-stone-400 hover:text-stone-900 transition-colors"
            title={isBookmarked ? 'Remove bookmark' : 'Save story'}
          >
            <Bookmark
              className={`h-4 w-4 ${isBookmarked ? 'fill-stone-900 text-stone-900' : 'text-stone-300 hover:text-stone-600'}`}
            />
          </button>
        )}
      </div>
    </article>
  );
});
