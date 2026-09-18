import React, { useState, useEffect } from 'react';
import {
  X,
  Copy,
  Check,
  ExternalLink,
  BookOpen,
  Layers,
  FileJson,
  Hash,
  RotateCw,
  Clock,
  Sparkles,
  Zap,
  CheckCircle2
} from 'lucide-react';
import { Article, ExtractedContent } from '../types.js';
import { MediaRenderer } from './MediaRenderer.js';

interface ArticleModalProps {
  article: Article | null;
  onClose: () => void;
}

export const ArticleModal: React.FC<ArticleModalProps> = ({ article, onClose }) => {
  const [copied, setCopied] = useState(false);
  const [copiedContent, setCopiedContent] = useState(false);
  const [activeTab, setActiveTab] = useState<'full' | 'contract' | 'lineage' | 'raw'>('full');

  const [fullContent, setFullContent] = useState<ExtractedContent | null>(article?.full_content || null);
  const [loadingContent, setLoadingContent] = useState<boolean>(false);
  const [contentError, setContentError] = useState<string | null>(null);

  // Auto-fetch full article extraction whenever modal opens
  useEffect(() => {
    if (!article) return;

    if (article.full_content && article.full_content.paragraphs && article.full_content.paragraphs.length > 0) {
      setFullContent(article.full_content);
      return;
    }

    loadFullContent(false);
  }, [article?.id]);

  const loadFullContent = async (forceRefresh: boolean = false) => {
    if (!article) return;
    try {
      setLoadingContent(true);
      setContentError(null);
      const url = `/api/v1/news/${article.id}/full${forceRefresh ? '?force=true' : ''}`;
      const res = await fetch(url);
      const json = await res.json();

      if (json.success && json.data?.full_content) {
        setFullContent(json.data.full_content);
      } else if (json.data) {
        // Fallback structure
        setFullContent({
          text: article.description || article.title,
          paragraphs: [article.description || 'Full coverage available at publisher source.'],
          readingTimeMinutes: 2,
          wordCount: (article.description || '').split(/\s+/).length,
          keyTakeaways: [article.title],
          extractedAt: new Date().toISOString(),
          extractionMethod: 'summary_synthesis'
        });
      }
    } catch (err: any) {
      setContentError(err.message || 'Could not fetch full extraction');
    } finally {
      setLoadingContent(false);
    }
  };

  if (!article) return null;

  const handleCopyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(article, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyExtractedText = () => {
    if (!fullContent) return;
    const textToCopy = `${article.title}\nBy ${fullContent.author || article.source}\n\n${fullContent.paragraphs.join('\n\n')}\n\nSource: ${article.canonical_url}`;
    navigator.clipboard.writeText(textToCopy);
    setCopiedContent(true);
    setTimeout(() => setCopiedContent(false), 2000);
  };

  const getMethodBadge = (method?: string) => {
    switch (method) {
      case 'semantic_dom':
        return (
          <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 border border-emerald-200">
            <Zap className="h-3 w-3 text-emerald-600" />
            Semantic DOM Extracted
          </span>
        );
      case 'feed_payload':
        return (
          <span className="inline-flex items-center gap-1 rounded bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700 border border-blue-200">
            <Layers className="h-3 w-3 text-blue-600" />
            Embedded Feed Content
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700 border border-amber-200">
            <Sparkles className="h-3 w-3 text-amber-600" />
            Synthesized Reader
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 p-4 backdrop-blur-xs">
      <div className="relative flex max-h-[92vh] w-full max-w-3xl flex-col rounded-2xl border border-stone-200 bg-white shadow-2xl overflow-hidden">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-stone-200 px-6 py-3.5 bg-stone-50">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-stone-900 text-white font-bold text-xs">
              AI
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded bg-stone-200 px-1.5 py-0.5 text-[10px] font-mono font-medium text-stone-700 uppercase">
                  {article.source}
                </span>
                <span className="text-[11px] text-stone-400 font-mono">
                  {article.domain}
                </span>
              </div>
              <h2 className="text-sm font-semibold text-stone-900 truncate max-w-md">
                {article.title}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a
              href={article.canonical_url || article.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-md border border-stone-200 bg-white px-2.5 py-1 text-xs font-medium text-stone-700 hover:bg-stone-100 transition-colors"
              title="Open canonical source article"
            >
              <ExternalLink className="h-3.5 w-3.5 text-stone-500" />
              <span className="hidden sm:inline">Original Web</span>
            </a>

            <button
              onClick={onClose}
              className="rounded-md p-1.5 text-stone-400 hover:bg-stone-200 hover:text-stone-700 transition-colors cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-stone-200 bg-white px-6">
          <button
            onClick={() => setActiveTab('full')}
            className={`flex items-center gap-1.5 border-b-2 py-2.5 px-3 text-xs font-medium transition-colors cursor-pointer ${
              activeTab === 'full'
                ? 'border-stone-900 text-stone-900'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            <BookOpen className="h-3.5 w-3.5" />
            Full News (Reader View)
          </button>

          <button
            onClick={() => setActiveTab('contract')}
            className={`border-b-2 py-2.5 px-3 text-xs font-medium transition-colors cursor-pointer ${
              activeTab === 'contract'
                ? 'border-stone-900 text-stone-900'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            Clean Contract
          </button>

          <button
            onClick={() => setActiveTab('lineage')}
            className={`border-b-2 py-2.5 px-3 text-xs font-medium transition-colors cursor-pointer ${
              activeTab === 'lineage'
                ? 'border-stone-900 text-stone-900'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            Provenance ({article.linked_sources?.length || 1})
          </button>

          <button
            onClick={() => setActiveTab('raw')}
            className={`border-b-2 py-2.5 px-3 text-xs font-medium transition-colors cursor-pointer ${
              activeTab === 'raw'
                ? 'border-stone-900 text-stone-900'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            Raw Metadata
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
          
          {/* TAB 1: FULL NEWS READER VIEW */}
          {activeTab === 'full' && (
            <div className="space-y-5">
              {/* Media Preview */}
              <MediaRenderer
                media={article.media}
                fallbackImageUrl={fullContent?.leadImageUrl || article.image_url}
                articleUrl={article.url}
                title={article.title}
                category={article.category}
                source={article.source}
                sourceId={article.source_id}
                domain={article.domain}
                aspectRatio="video"
              />

              {/* Extraction Meta Banner */}
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-stone-200 bg-stone-50 p-3">
                <div className="flex flex-wrap items-center gap-3">
                  {getMethodBadge(fullContent?.extractionMethod)}
                  
                  {fullContent && (
                    <>
                      <span className="flex items-center gap-1 text-[11px] text-stone-600">
                        <Clock className="h-3.5 w-3.5 text-stone-400" />
                        {fullContent.readingTimeMinutes} min read
                      </span>
                      <span className="text-[11px] text-stone-400">•</span>
                      <span className="text-[11px] text-stone-600 font-mono">
                        {fullContent.wordCount} words
                      </span>
                    </>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopyExtractedText}
                    className="inline-flex items-center gap-1 rounded border border-stone-200 bg-white px-2 py-1 text-[11px] font-medium text-stone-700 hover:bg-stone-50"
                  >
                    {copiedContent ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3 text-stone-400" />}
                    <span>{copiedContent ? 'Copied' : 'Copy Text'}</span>
                  </button>

                  <button
                    onClick={() => loadFullContent(true)}
                    disabled={loadingContent}
                    className="inline-flex items-center gap-1 rounded border border-stone-200 bg-white px-2 py-1 text-[11px] font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-50 cursor-pointer"
                    title="Re-extract with latest techniques"
                  >
                    <RotateCw className={`h-3 w-3 text-stone-500 ${loadingContent ? 'animate-spin' : ''}`} />
                    <span>Re-extract</span>
                  </button>
                </div>
              </div>

              {/* Loading indicator */}
              {loadingContent && (
                <div className="flex items-center justify-center py-8 space-x-2 text-stone-500">
                  <RotateCw className="h-5 w-5 animate-spin text-stone-800" />
                  <span className="text-xs font-medium">Extracting full article with multi-layer processing...</span>
                </div>
              )}

              {/* Error indicator */}
              {contentError && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-800 text-xs">
                  {contentError}
                </div>
              )}

              {/* Key Takeaways Callout Box */}
              {fullContent && fullContent.keyTakeaways && fullContent.keyTakeaways.length > 0 && (
                <div className="rounded-xl border border-amber-200/80 bg-amber-50/50 p-4">
                  <div className="flex items-center gap-1.5 font-semibold text-amber-900 text-xs mb-2.5">
                    <Sparkles className="h-4 w-4 text-amber-600" />
                    <span>Executive Summary & Key Takeaways</span>
                  </div>
                  <ul className="space-y-1.5">
                    {fullContent.keyTakeaways.map((takeaway, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-xs text-amber-950/90 leading-relaxed">
                        <CheckCircle2 className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
                        <span>{takeaway}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Article Headline & Byline */}
              <div>
                <h1 className="text-xl font-bold tracking-tight text-stone-900 leading-snug">
                  {article.title}
                </h1>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-stone-500 font-mono">
                  <span>By {fullContent?.author || article.author || article.source}</span>
                  <span>•</span>
                  <span>{article.published_at ? new Date(article.published_at).toLocaleDateString(undefined, { dateStyle: 'long' }) : 'Recent'}</span>
                  <span>•</span>
                  <span className="capitalize">{article.category}</span>
                </div>
              </div>

              {/* Extracted Structured Paragraphs */}
              {fullContent && (
                <div className="space-y-3.5 text-sm text-stone-800 leading-relaxed pt-2 border-t border-stone-100">
                  {fullContent.paragraphs.map((p, idx) => {
                    if (p.startsWith('###')) {
                      return (
                        <h3 key={idx} className="pt-3 font-bold text-stone-900 text-base">
                          {p.replace(/^###\s*/, '')}
                        </h3>
                      );
                    }
                    if (p.startsWith('>')) {
                      return (
                        <blockquote key={idx} className="border-l-3 border-stone-400 pl-4 py-1 italic text-stone-700 bg-stone-50 rounded-r">
                          {p.replace(/^>\s*/, '')}
                        </blockquote>
                      );
                    }
                    if (p.startsWith('•')) {
                      return (
                        <div key={idx} className="flex items-start gap-2 pl-2">
                          <span className="text-stone-400 font-bold">•</span>
                          <span>{p.replace(/^•\s*/, '')}</span>
                        </div>
                      );
                    }
                    return (
                      <p key={idx} className="text-stone-800">
                        {p}
                      </p>
                    );
                  })}
                </div>
              )}

              {/* Source attribution footer */}
              <div className="mt-6 rounded-xl border border-stone-200 bg-stone-50 p-4 text-center">
                <p className="text-xs text-stone-600">
                  Extracted from <strong className="text-stone-900">{article.source}</strong> ({article.domain})
                </p>
                <a
                  href={article.canonical_url || article.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-stone-900 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-stone-800 transition-colors"
                >
                  <span>Visit Full Dispatch on {article.domain}</span>
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            </div>
          )}

          {/* TAB 2: CLEAN CONTRACT */}
          {activeTab === 'contract' && (
            <div className="space-y-4">
              {/* Media Preview in Modal */}
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
              />

              {/* Title & Excerpt */}
              <div className="rounded-lg border border-stone-200 bg-stone-50 p-4">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-400">Title</span>
                <p className="mt-1 text-sm font-semibold text-stone-900">{article.title}</p>
                
                <span className="mt-3 block text-[11px] font-semibold uppercase tracking-wider text-stone-400">Description / Abstract</span>
                <p className="mt-1 text-xs text-stone-700 leading-relaxed">{article.description || 'No excerpt provided'}</p>
              </div>

              {/* Attributes Table */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <div className="rounded-lg border border-stone-100 bg-white p-2.5">
                  <span className="text-[10px] text-stone-400">Discovery Source</span>
                  <p className="font-mono text-stone-800 font-medium">{article.source} ({article.source_id})</p>
                </div>
                <div className="rounded-lg border border-stone-100 bg-white p-2.5">
                  <span className="text-[10px] text-stone-400">Original Publisher</span>
                  <p className="font-mono text-stone-800 font-medium">{article.publisher?.name || article.source}</p>
                </div>
                <div className="rounded-lg border border-stone-100 bg-white p-2.5">
                  <span className="text-[10px] text-stone-400">Source Type</span>
                  <p className="font-mono text-stone-800 font-medium">{article.source_type}</p>
                </div>
                <div className="rounded-lg border border-stone-100 bg-white p-2.5">
                  <span className="text-[10px] text-stone-400">Category</span>
                  <p className="font-mono text-stone-800 font-medium">{article.category}</p>
                </div>
                <div className="rounded-lg border border-stone-100 bg-white p-2.5">
                  <span className="text-[10px] text-stone-400">Published At</span>
                  <p className="font-mono text-stone-800">{article.published_at || 'Pending / Null'}</p>
                  {article.published_at_source && (
                    <span className="text-[9px] text-stone-400">Source: {article.published_at_source}</span>
                  )}
                </div>
                <div className="rounded-lg border border-stone-100 bg-white p-2.5">
                  <span className="text-[10px] text-stone-400">Domain</span>
                  <p className="font-mono text-stone-800">{article.domain}</p>
                </div>
              </div>

              {/* Canonical URL & SHA-256 Hash */}
              <div className="space-y-2">
                <div className="flex items-center justify-between rounded-lg border border-stone-200 bg-stone-50 p-2.5">
                  <div className="flex items-center gap-2 overflow-hidden">
                    <ExternalLink className="h-4 w-4 shrink-0 text-stone-400" />
                    <span className="truncate font-mono text-stone-700">{article.canonical_url}</span>
                  </div>
                  <a
                    href={article.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-2 shrink-0 rounded bg-stone-900 px-2 py-1 text-[11px] font-medium text-white hover:bg-stone-800"
                  >
                    Open
                  </a>
                </div>

                <div className="flex items-center gap-2 rounded-lg border border-stone-200 bg-stone-50 p-2.5 font-mono text-[11px] text-stone-600">
                  <Hash className="h-4 w-4 shrink-0 text-amber-600" />
                  <span className="text-stone-400">SHA-256 Content Hash:</span>
                  <span className="truncate">{article.content_hash}</span>
                </div>
              </div>

              {/* Full JSON viewer */}
              <div>
                <span className="block text-[11px] font-semibold text-stone-500 mb-1">Contract Payload</span>
                <pre className="max-h-56 overflow-auto rounded-lg bg-stone-900 p-3 font-mono text-[11px] text-emerald-400">
                  {JSON.stringify(article, null, 2)}
                </pre>
              </div>
            </div>
          )}

          {/* TAB 3: PROVENANCE */}
          {activeTab === 'lineage' && (
            <div className="space-y-3">
              <p className="text-stone-600">
                Deduplication pipeline tracked and merged the following ingested source feeds into this single canonical article:
              </p>

              <div className="space-y-2">
                {article.linked_sources && article.linked_sources.length > 0 ? (
                  article.linked_sources.map((src, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between rounded-lg border border-stone-200 bg-stone-50 p-3"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-stone-900">{src.sourceName}</span>
                          <span className="rounded bg-stone-200 px-1.5 py-0.2 text-[10px] font-mono text-stone-700">
                            {src.sourceId}
                          </span>
                        </div>
                        <p className="font-mono text-[11px] text-stone-500 truncate max-w-lg">
                          {src.url}
                        </p>
                        <span className="text-[10px] text-stone-400">
                          Published: {src.publishedAt}
                        </span>
                      </div>

                      <a
                        href={src.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded border border-stone-300 bg-white p-1.5 text-stone-600 hover:bg-stone-100"
                        title="Open direct source feed link"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </div>
                  ))
                ) : (
                  <p className="text-stone-500 italic">No linked provenance available.</p>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: RAW FEED METADATA */}
          {activeTab === 'raw' && (
            <div>
              <pre className="max-h-96 overflow-auto rounded-lg bg-stone-900 p-4 font-mono text-[11px] text-amber-300">
                {JSON.stringify(article.raw_metadata || {}, null, 2)}
              </pre>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-stone-200 bg-stone-50 px-6 py-3">
          <button
            onClick={handleCopyJson}
            className="inline-flex items-center gap-1 rounded-md border border-stone-200 bg-white px-2.5 py-1 text-xs font-medium text-stone-700 hover:bg-stone-100 cursor-pointer"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5 text-stone-400" />}
            <span>{copied ? 'Copied Contract' : 'Copy JSON'}</span>
          </button>

          <button
            onClick={onClose}
            className="rounded-lg bg-stone-900 px-4 py-1.5 text-xs font-medium text-white hover:bg-stone-800 cursor-pointer"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
