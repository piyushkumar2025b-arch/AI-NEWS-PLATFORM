import React, { useState, useEffect } from 'react';
import {
  X,
  ExternalLink,
  Bookmark,
  Share2,
  Check,
  Clock,
  Play,
  Volume2
} from 'lucide-react';
import { Article, ExtractedContent } from '../types.js';
import { MediaRenderer } from './MediaRenderer.js';

// Client-side cache to make reopening articles instantaneous (0ms latency)
const fullContentCache = new Map<string, ExtractedContent>();

interface ArticleModalProps {
  article: Article | null;
  onClose: () => void;
  isBookmarked?: boolean;
  onToggleBookmark?: (articleId: string) => void;
}

export const ArticleModal: React.FC<ArticleModalProps> = ({
  article,
  onClose,
  isBookmarked = false,
  onToggleBookmark
}) => {
  const [fullContent, setFullContent] = useState<ExtractedContent | null>(article?.full_content || null);
  const [loadingContent, setLoadingContent] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Prevent background scroll when reading view is open
  useEffect(() => {
    if (article) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [article]);

  // Auto-fetch full article text if not present
  useEffect(() => {
    if (!article) {
      setFullContent(null);
      return;
    }

    if (article.full_content && article.full_content.paragraphs && article.full_content.paragraphs.length > 0) {
      setFullContent(article.full_content);
      fullContentCache.set(article.id, article.full_content);
      return;
    }

    if (fullContentCache.has(article.id)) {
      setFullContent(fullContentCache.get(article.id)!);
      return;
    }

    setFullContent(null);

    const fetchFull = async () => {
      try {
        setLoadingContent(true);
        const res = await fetch(`/api/v1/news/${article.id}/full`);
        const json = await res.json();
        if (json.success && json.data?.full_content) {
          setFullContent(json.data.full_content);
          fullContentCache.set(article.id, json.data.full_content);
        } else {
          // Fallback to synthesized content from description
          const synthesized: ExtractedContent = {
            text: article.description || article.title,
            paragraphs: [
              article.description || 'Full coverage and extended discussion available at the original source.'
            ],
            readingTimeMinutes: Math.max(1, Math.ceil((article.description || '').split(/\s+/).length / 200)),
            wordCount: (article.description || '').split(/\s+/).length,
            keyTakeaways: [article.title],
            extractedAt: new Date().toISOString(),
            extractionMethod: 'summary_synthesis'
          };
          setFullContent(synthesized);
          fullContentCache.set(article.id, synthesized);
        }
      } catch {
        // Fallback
        const fallback: ExtractedContent = {
          text: article.description || article.title,
          paragraphs: [article.description || 'Full coverage available at the original publisher.'],
          readingTimeMinutes: 2,
          wordCount: (article.description || '').split(/\s+/).length,
          keyTakeaways: [article.title],
          extractedAt: new Date().toISOString(),
          extractionMethod: 'summary_synthesis'
        };
        setFullContent(fallback);
        fullContentCache.set(article.id, fallback);
      } finally {
        setLoadingContent(false);
      }
    };

    fetchFull();
  }, [article?.id]);

  if (!article) return null;

  const handleShare = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(article.canonical_url || article.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const displayDate = article.published_at
    ? new Date(article.published_at).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric'
      })
    : 'Recent';

  const readTime = fullContent?.readingTimeMinutes || 3;
  const isVideo = article.source_type === 'video' || article.media?.some(m => m.type === 'video');
  const isAudio = article.source_type === 'podcast' || article.media?.some(m => m.type === 'audio');
  const hasRealMedia = Boolean(
    isVideo ||
    isAudio ||
    (article.image_url && !article.image_url.startsWith('/assets/editorial/')) ||
    (article.media && article.media.some(m => m.url && !m.url.startsWith('/assets/editorial/')))
  );

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/60 backdrop-blur-xs flex justify-center p-0 sm:p-4 md:p-6"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl bg-[#faf9f5] min-h-screen sm:min-h-0 sm:my-auto sm:rounded-xs shadow-2xl overflow-hidden text-stone-900"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Quiet Bar */}
        <div className="sticky top-0 z-20 flex items-center justify-between border-b border-stone-200/60 bg-[#faf9f5]/95 px-6 py-4 backdrop-blur-xs">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-stone-500 font-medium truncate">
            <span>{article.source}</span>
            <span className="text-stone-300">·</span>
            <span>{displayDate}</span>
            <span className="text-stone-300">·</span>
            <span>{readTime} min read</span>
          </div>

          <div className="flex items-center gap-4 text-stone-500">
            {onToggleBookmark && (
              <button
                type="button"
                onClick={() => onToggleBookmark(article.id)}
                className="hover:text-stone-900 transition-colors p-1 cursor-pointer"
                title={isBookmarked ? 'Remove from reading list' : 'Save to reading list'}
              >
                <Bookmark className={`h-4 w-4 ${isBookmarked ? 'fill-stone-900 text-stone-900' : ''}`} />
              </button>
            )}

            <button
              type="button"
              onClick={handleShare}
              className="hover:text-stone-900 transition-colors p-1 cursor-pointer"
              title="Copy dispatch link"
            >
              {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Share2 className="h-4 w-4" />}
            </button>

            <a
              href={article.canonical_url || article.url}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-stone-900 transition-colors p-1"
              title="Open original source"
            >
              <ExternalLink className="h-4 w-4" />
            </a>

            <button
              type="button"
              onClick={onClose}
              className="hover:text-stone-900 transition-colors p-1 cursor-pointer ml-2 text-stone-400 hover:text-stone-900"
              title="Close reader (Esc)"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Article Reading Canvas */}
        <div className="px-6 sm:px-12 py-8 sm:py-12 space-y-8 max-w-2xl mx-auto">
          {/* Headline */}
          <div className="space-y-4">
            <h1 className="font-editorial text-3xl sm:text-4xl lg:text-5xl font-normal leading-[1.18] tracking-tight text-stone-900">
              {article.title}
            </h1>

            {/* Byline */}
            <div className="flex items-center gap-2 text-sm text-stone-500 font-light border-b border-stone-200/60 pb-6">
              {article.author ? (
                <span>Reported by <strong className="font-medium text-stone-800">{article.author}</strong></span>
              ) : (
                <span>Published via <strong className="font-medium text-stone-800">{article.source}</strong></span>
              )}
              {article.domain && (
                <>
                  <span className="text-stone-300">·</span>
                  <span>{article.domain}</span>
                </>
              )}
            </div>
          </div>

          {/* Featured Media / Video Player */}
          {hasRealMedia && (
            <div className="overflow-hidden rounded-xs bg-stone-100">
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
                className="w-full"
              />
            </div>
          )}

          {/* Key Editorial Takeaways (if present) */}
          {fullContent?.keyTakeaways && fullContent.keyTakeaways.length > 0 && (
            <div className="border-l-2 border-stone-800 pl-5 py-1 space-y-1.5 text-stone-800">
              <span className="text-[11px] uppercase tracking-wider font-semibold text-stone-500 block mb-1">
                Core Takeaways
              </span>
              {fullContent.keyTakeaways.map((takeaway, idx) => (
                <p key={idx} className="font-editorial text-lg italic leading-relaxed text-stone-800">
                  "{takeaway}"
                </p>
              ))}
            </div>
          )}

          {/* Full Article Content */}
          <div className="space-y-6 text-stone-800 font-sans text-base sm:text-lg leading-[1.8] font-normal">
            {loadingContent ? (
              <div className="space-y-4 py-8 animate-pulse">
                <div className="h-4 bg-stone-200/70 rounded w-full" />
                <div className="h-4 bg-stone-200/70 rounded w-5/6" />
                <div className="h-4 bg-stone-200/70 rounded w-4/6" />
              </div>
            ) : fullContent && fullContent.paragraphs && fullContent.paragraphs.length > 0 ? (
              fullContent.paragraphs.map((p, idx) => (
                <p key={idx} className="text-stone-700 font-light">
                  {p}
                </p>
              ))
            ) : (
              <p className="text-stone-700 font-light">
                {article.description}
              </p>
            )}
          </div>

          {/* Reading Footer */}
          <div className="pt-8 border-t border-stone-200/60 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-stone-500">
            <div>
              <span>Original dispatch via </span>
              <a
                href={article.canonical_url || article.url}
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-stone-900 transition-colors font-medium text-stone-700"
              >
                {article.domain || article.source}
              </a>
            </div>

            <a
              href={article.canonical_url || article.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 font-medium text-stone-900 hover:text-stone-600 transition-colors"
            >
              <span>Read Full Original Coverage</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
