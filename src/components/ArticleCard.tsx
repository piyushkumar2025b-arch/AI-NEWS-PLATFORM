import React from 'react';
import {
  Bookmark,
  ExternalLink,
  Play,
  Volume2
} from 'lucide-react';
import { Article } from '../types.js';
import { MediaRenderer } from './MediaRenderer.js';

interface ArticleCardProps {
  article: Article;
  onInspect: (article: Article) => void;
  onSelectSource?: (sourceId: string) => void;
  isHero?: boolean;
  isBookmarked?: boolean;
  onToggleBookmark?: (articleId: string) => void;
  isRead?: boolean;
}

export const ArticleCard: React.FC<ArticleCardProps> = React.memo(({
  article,
  onInspect,
  onSelectSource,
  isHero = false,
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
  const isVideo = article.source_type === 'video' || article.media?.some(m => m.type === 'video');
  const isAudio = article.source_type === 'podcast' || article.media?.some(m => m.type === 'audio');
  const hasRealMedia = Boolean(
    isVideo ||
    isAudio ||
    (article.image_url && !article.image_url.startsWith('/assets/editorial/')) ||
    (article.media && article.media.some(m => !m.url.startsWith('/assets/editorial/')))
  );

  // Hero Lead Layout (Grand editorial focal point for top story)
  if (isHero) {
    return (
      <article
        id={`article-${article.id}`}
        className="group relative cursor-pointer pb-8 border-b border-stone-200/70"
        onClick={() => onInspect(article)}
      >
        <div className={`grid grid-cols-1 ${hasRealMedia ? 'lg:grid-cols-12' : ''} gap-8 items-center`}>
          {/* Headline & Excerpt */}
          <div className={`${hasRealMedia ? 'lg:col-span-7' : 'max-w-4xl'} flex flex-col justify-center space-y-4`}>
            {/* Editorial Kicker */}
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider font-medium text-stone-500">
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
              <span className="text-stone-300">/</span>
              <span>{timeAgo(displayDate)}</span>
              {article.author && (
                <>
                  <span className="text-stone-300">/</span>
                  <span className="truncate max-w-[200px]">By {article.author}</span>
                </>
              )}
            </div>

            {/* Hero Headline */}
            <h2 className="font-editorial text-3xl sm:text-4xl lg:text-5xl font-normal leading-[1.15] tracking-tight text-stone-900 group-hover:text-stone-600 transition-colors">
              {article.title}
            </h2>

            {/* Description / Excerpt */}
            {article.description && (
              <p className="text-base sm:text-lg text-stone-600 leading-relaxed font-light line-clamp-3">
                {article.description}
              </p>
            )}

            {/* Editorial Byline & Quiet Actions */}
            <div className="flex items-center justify-between pt-2 text-xs text-stone-400">
              <span className="text-stone-500">Read full dispatch →</span>
              
              {onToggleBookmark && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleBookmark(article.id);
                  }}
                  className="p-1 text-stone-400 hover:text-stone-900 transition-colors"
                  title={isBookmarked ? 'Remove from reading list' : 'Save to reading list'}
                >
                  <Bookmark
                    className={`h-4 w-4 ${isBookmarked ? 'fill-stone-900 text-stone-900' : 'text-stone-400'}`}
                  />
                </button>
              )}
            </div>
          </div>

          {/* Right: Large Featured Media (Only rendered when real media exists) */}
          {hasRealMedia && (
            <div className="lg:col-span-5 relative overflow-hidden rounded-xs bg-stone-100">
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
                className="w-full transform group-hover:scale-[1.01] transition-transform duration-300"
              />
              {isVideo && (
                <div className="absolute bottom-3 left-3 bg-stone-900/80 text-white text-[11px] px-2 py-0.5 rounded-xs flex items-center gap-1 backdrop-blur-xs">
                  <Play className="h-3 w-3 fill-white" />
                  <span>Video</span>
                </div>
              )}
            </div>
          )}
        </div>
      </article>
    );
  }

  // Standard Editorial Story (Pure, unboxed, whitespace-paced)
  return (
    <article
      id={`article-${article.id}`}
      className={`group relative flex flex-col justify-between cursor-pointer pb-6 border-b border-stone-200/50 transition-opacity ${
        isRead ? 'opacity-75 hover:opacity-100' : ''
      }`}
      onClick={() => onInspect(article)}
    >
      <div className="space-y-3">
        {/* Real Media (only rendered if verified genuine media exists) */}
        {hasRealMedia && (
          <div className="relative overflow-hidden rounded-xs bg-stone-100">
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
              className="w-full transform group-hover:scale-[1.01] transition-transform duration-300"
            />
            {isVideo && (
              <div className="absolute bottom-2 left-2 bg-stone-900/80 text-white text-[10px] px-1.5 py-0.5 rounded-xs flex items-center gap-1 backdrop-blur-xs">
                <Play className="h-2.5 w-2.5 fill-white" />
                <span>Video</span>
              </div>
            )}
            {isAudio && (
              <div className="absolute bottom-2 left-2 bg-stone-900/80 text-white text-[10px] px-1.5 py-0.5 rounded-xs flex items-center gap-1 backdrop-blur-xs">
                <Volume2 className="h-2.5 w-2.5" />
                <span>Audio</span>
              </div>
            )}
          </div>
        )}

        {/* Quiet Editorial Kicker */}
        <div className="flex items-center justify-between text-xs text-stone-500">
          <div className="flex items-center gap-1.5 truncate">
            <span
              onClick={(e) => {
                if (onSelectSource) {
                  e.stopPropagation();
                  onSelectSource(article.source_id);
                }
              }}
              className="font-medium hover:text-stone-900 transition-colors uppercase tracking-wider text-[11px]"
            >
              {article.source}
            </span>
            <span className="text-stone-300">·</span>
            <span className="text-stone-400">{timeAgo(displayDate)}</span>
          </div>

          {onToggleBookmark && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleBookmark(article.id);
              }}
              className="p-0.5 text-stone-400 hover:text-stone-900 transition-colors"
              title={isBookmarked ? 'Remove bookmark' : 'Save story'}
            >
              <Bookmark
                className={`h-3.5 w-3.5 ${isBookmarked ? 'fill-stone-900 text-stone-900' : 'text-stone-400 hover:text-stone-700'}`}
              />
            </button>
          )}
        </div>

        {/* Headline */}
        <h3 className="font-editorial text-xl sm:text-2xl font-normal leading-snug tracking-tight text-stone-900 group-hover:text-stone-600 transition-colors">
          {article.title}
        </h3>

        {/* Description / Excerpt */}
        {article.description && (
          <p className="text-sm text-stone-600 leading-relaxed font-light line-clamp-3">
            {article.description}
          </p>
        )}
      </div>

      {/* Byline footer */}
      {article.author && (
        <div className="mt-3 pt-2 text-xs text-stone-400 font-light truncate">
          By {article.author}
        </div>
      )}
    </article>
  );
});
