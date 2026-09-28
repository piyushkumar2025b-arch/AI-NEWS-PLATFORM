import React, { useState, useEffect, useMemo } from 'react';
import {
  Image as ImageIcon,
  Video,
  Play,
  Headphones,
  FileText,
  ExternalLink,
  X
} from 'lucide-react';
import { MediaAsset } from '../types.js';
import {
  isLowQualityMedia,
  upgradeMediaQuality,
  extractYouTubeId,
  getYouTubeThumbnailHierarchy
} from '../utils/mediaQuality.js';
import {
  getEditorialImageCandidates,
  getEditorialImage
} from '../utils/editorialMedia.js';

interface MediaRendererProps {
  media?: MediaAsset[];
  fallbackImageUrl?: string | null;
  articleUrl?: string | null;
  title: string;
  category?: string;
  source?: string;
  sourceId?: string;
  domain?: string;
  className?: string;
  aspectRatio?: 'video' | 'square' | 'auto';
  showEditorialFallback?: boolean;
}

// Fast session cache for verified successful images (0-latency re-renders)
const loadedImagesCache = new Set<string>();

// Determine if URL requires immediate server-side tunneling
function requiresImmediateTunneling(url: string): boolean {
  if (!url || url.startsWith('/') || url.startsWith('data:')) return false;
  try {
    const parsed = new URL(url);
    // Mixed content (http image on https page) must be proxied to prevent browser block
    if (typeof window !== 'undefined' && window.location.protocol === 'https:' && parsed.protocol === 'http:') {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export const MediaRenderer: React.FC<MediaRendererProps> = ({
  media,
  fallbackImageUrl,
  articleUrl,
  title,
  category = 'technology',
  source = 'Tech Feed',
  sourceId,
  domain,
  className = '',
  aspectRatio = 'video',
  showEditorialFallback = true
}) => {
  // Find media assets by type
  const videoAsset = media?.find(m => m.type === 'video');
  const audioAsset = media?.find(m => m.type === 'audio');
  const imageAsset = media?.find(m =>
    m.type === 'image' &&
    !isLowQualityMedia(m.url) &&
    m.mimeType !== 'application/x-shockwave-flash'
  );
  const documentAsset = media?.find(m => m.type === 'document');

  // Detect YouTube video ID from articleUrl, video asset, domain, or fallback URL
  const allMediaUrls = [articleUrl, videoAsset?.url, fallbackImageUrl, ...(media || []).map(m => m.url)].filter(Boolean).join(' ');
  const ytVideoId = extractYouTubeId(allMediaUrls);

  // Compute prioritized image candidates list
  const imageCandidates = useMemo<string[]>(() => {
    const candidates: string[] = [];

    // 1. If YouTube video, prioritize maxresdefault (1080p/720p HD) then sddefault (480p)
    if (ytVideoId) {
      return getYouTubeThumbnailHierarchy(ytVideoId);
    }

    // 2. Try genuine image asset or fallback URL with quality upgrades
    const rawImage = imageAsset?.url || fallbackImageUrl;
    if (rawImage && !isLowQualityMedia(rawImage)) {
      const upgraded = upgradeMediaQuality(rawImage);
      if (upgraded) {
        candidates.push(upgraded);
      }
      // If upgraded is different from raw (e.g. WordPress -300x200 stripped), add raw as secondary fallback
      if (rawImage && upgraded !== rawImage && !isLowQualityMedia(rawImage)) {
        candidates.push(rawImage);
      }
    }

    // 3. Check any other images in media array
    if (media) {
      for (const m of media) {
        if (m.type === 'image' && m.url && !isLowQualityMedia(m.url)) {
          const up = upgradeMediaQuality(m.url);
          if (up && !candidates.includes(up)) {
            candidates.push(up);
          }
        }
      }
    }

    // 4. Topic-matched genuine tech photography candidates (guarantees real photos)
    const editorialPhotos = getEditorialImageCandidates(title, category, sourceId, domain);
    for (const ep of editorialPhotos) {
      if (ep && !candidates.includes(ep)) {
        candidates.push(ep);
      }
    }

    return candidates;
  }, [ytVideoId, imageAsset?.url, fallbackImageUrl, media, title, category, sourceId, domain]);

  const [candidateIndex, setCandidateIndex] = useState<number>(0);
  const [useProxy, setUseProxy] = useState<boolean>(false);
  const [imageLoaded, setImageLoaded] = useState<boolean>(false);
  const [isPlayingVideo, setIsPlayingVideo] = useState<boolean>(false);

  // Reset state when input media changes
  useEffect(() => {
    setCandidateIndex(0);
    const firstCandidate = imageCandidates[0] || null;
    setUseProxy(firstCandidate ? requiresImmediateTunneling(firstCandidate) : false);
    setImageLoaded(firstCandidate ? loadedImagesCache.has(firstCandidate) : false);
    setIsPlayingVideo(false);
  }, [imageCandidates]);

  const currentRawUrl = imageCandidates[candidateIndex] || null;

  const aspectClass =
    aspectRatio === 'video' ? 'aspect-video' : aspectRatio === 'square' ? 'aspect-square' : 'min-h-[170px]';

  // Compute final image src (direct CDN or high-speed tunnel proxy)
  const isDirectCdn = currentRawUrl
    ? (currentRawUrl.includes('ytimg.com') || currentRawUrl.includes('youtube.com'))
    : false;

  const finalSrc = useMemo(() => {
    if (!currentRawUrl) return null;
    if (useProxy && !isDirectCdn && /^https?:\/\//i.test(currentRawUrl)) {
      const p = new URLSearchParams({
        url: currentRawUrl,
        title: title || '',
        category: category || 'technology',
        ...(sourceId ? { sourceId } : {}),
        ...(domain ? { domain } : {})
      });
      return `/api/v1/media/proxy?${p.toString()}`;
    }
    return currentRawUrl;
  }, [currentRawUrl, useProxy, isDirectCdn, title, category, sourceId, domain]);

  const handleImageLoad = () => {
    setImageLoaded(true);
    if (currentRawUrl) loadedImagesCache.add(currentRawUrl);
  };

  const handleImageError = () => {
    // 1. If currently accessing direct and direct failed, try proxy for this URL once
    if (!useProxy && !isDirectCdn && currentRawUrl && /^https?:\/\//i.test(currentRawUrl)) {
      setUseProxy(true);
      return;
    }

    // 2. If proxy also failed (or direct CDN like YouTube), advance to next candidate in waterfall
    if (candidateIndex + 1 < imageCandidates.length) {
      setUseProxy(false);
      setImageLoaded(false);
      setCandidateIndex(prev => prev + 1);
      return;
    }

    // 3. All candidates exhausted: clean failure (no blurry placeholder rendered)
    setCandidateIndex(imageCandidates.length);
  };

  // Determine media badge label & style
  let badgeLabel = 'News';
  let badgeColor = 'bg-stone-900/80 text-stone-100 border border-white/10';
  if (sourceId?.startsWith('youtube')) {
    badgeLabel = 'YouTube HD';
    badgeColor = 'bg-red-950/80 text-red-200 border border-red-500/30';
  } else if (sourceId === 'github') {
    badgeLabel = 'GitHub Repo';
    badgeColor = 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/30';
  } else if (sourceId === 'huggingface') {
    badgeLabel = 'AI Model';
    badgeColor = 'bg-amber-950/80 text-amber-300 border border-amber-500/30';
  } else if (sourceId === 'hf_papers') {
    badgeLabel = 'Daily Paper';
    badgeColor = 'bg-amber-950/80 text-amber-300 border border-amber-500/30';
  } else if (sourceId === 'deepmind') {
    badgeLabel = 'Google DeepMind';
    badgeColor = 'bg-blue-950/80 text-blue-300 border border-blue-500/30';
  } else if (sourceId === 'openai') {
    badgeLabel = 'OpenAI';
    badgeColor = 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/30';
  } else if (sourceId === 'techcrunch_ai') {
    badgeLabel = 'TechCrunch AI';
    badgeColor = 'bg-green-950/80 text-green-300 border border-green-500/30';
  } else if (sourceId === 'venturebeat_ai') {
    badgeLabel = 'VentureBeat AI';
    badgeColor = 'bg-indigo-950/80 text-indigo-300 border border-indigo-500/30';
  } else if (sourceId === 'theverge_ai') {
    badgeLabel = 'The Verge AI';
    badgeColor = 'bg-pink-950/80 text-pink-300 border border-pink-500/30';
  } else if (sourceId === 'mit_tech_review') {
    badgeLabel = 'MIT Review';
    badgeColor = 'bg-rose-950/80 text-rose-300 border border-rose-500/30';
  } else if (sourceId === 'arstechnica') {
    badgeLabel = 'Ars Technica';
    badgeColor = 'bg-orange-950/80 text-orange-300 border border-orange-500/30';
  } else if (sourceId === 'hf_blog') {
    badgeLabel = 'HF Blog';
    badgeColor = 'bg-amber-950/80 text-amber-300 border border-amber-500/30';
  } else if (sourceId === 'last_week_in_ai') {
    badgeLabel = 'Last Week in AI';
    badgeColor = 'bg-purple-950/80 text-purple-300 border border-purple-500/30';
  } else if (sourceId === 'arxiv') {
    badgeLabel = 'Research Paper';
    badgeColor = 'bg-blue-950/80 text-blue-300 border border-blue-500/30';
  } else if (sourceId === 'hackernews' || sourceId === 'lobsters' || sourceId === 'reddit') {
    badgeLabel = 'Community';
    badgeColor = 'bg-orange-950/80 text-orange-300 border border-orange-500/30';
  } else if (sourceId === 'devto') {
    badgeLabel = 'Article';
    badgeColor = 'bg-sky-950/80 text-sky-300 border border-sky-500/30';
  } else if (sourceId === 'bair_blog') {
    badgeLabel = 'UC Berkeley BAIR';
    badgeColor = 'bg-teal-950/80 text-teal-300 border border-teal-500/30';
  } else if (sourceId === 'ai_news') {
    badgeLabel = 'AI News';
    badgeColor = 'bg-cyan-950/80 text-cyan-300 border border-cyan-500/30';
  } else if (sourceId === 'ml_mastery') {
    badgeLabel = 'ML Mastery';
    badgeColor = 'bg-indigo-950/80 text-indigo-300 border border-indigo-500/30';
  } else if (sourceId === 'towards_ai') {
    badgeLabel = 'Towards AI';
    badgeColor = 'bg-violet-950/80 text-violet-300 border border-violet-500/30';
  } else if (sourceId === 'understanding_ai') {
    badgeLabel = 'Understanding AI';
    badgeColor = 'bg-amber-950/80 text-amber-300 border border-amber-500/30';
  } else if (sourceId === 'analytics_vidhya') {
    badgeLabel = 'Analytics Vidhya';
    badgeColor = 'bg-blue-950/80 text-blue-300 border border-blue-500/30';
  } else if (sourceId === 'turing_institute') {
    badgeLabel = 'Turing Institute';
    badgeColor = 'bg-purple-950/80 text-purple-300 border border-purple-500/30';
  } else if (sourceId === 'fastcompany_ai') {
    badgeLabel = 'Fast Company';
    badgeColor = 'bg-rose-950/80 text-rose-300 border border-rose-500/30';
  }

  // 1. Video Asset Rendering (Interactive YouTube / DailyMotion / HTML5 player)
  if (videoAsset || ytVideoId) {
    const rawVideoUrl = videoAsset?.url || (ytVideoId ? `https://www.youtube.com/embed/${ytVideoId}` : '');
    const isYouTube = Boolean(ytVideoId) || rawVideoUrl.includes('youtube') || rawVideoUrl.includes('youtu.be');
    const isDailyMotion = rawVideoUrl.includes('dailymotion.com') || rawVideoUrl.includes('dai.ly');
    const isVimeo = rawVideoUrl.includes('vimeo.com');
    const isIframeEmbed = isYouTube || isDailyMotion || isVimeo || rawVideoUrl.includes('/embed');

    const watchUrl = ytVideoId
      ? `https://www.youtube.com/watch?v=${ytVideoId}`
      : (rawVideoUrl.startsWith('http') && !rawVideoUrl.includes('/embed'))
      ? rawVideoUrl
      : undefined;

    if (isPlayingVideo) {
      if (isIframeEmbed) {
        let embedUrl = rawVideoUrl;
        if (isYouTube && ytVideoId) {
          const currentOrigin = typeof window !== 'undefined' && window.location.origin ? window.location.origin : '';
          const originParam = currentOrigin ? `&origin=${encodeURIComponent(currentOrigin)}` : '';
          embedUrl = `https://www.youtube.com/embed/${ytVideoId}?autoplay=1&playsinline=1&rel=0${originParam}`;
        } else {
          const separator = embedUrl.includes('?') ? '&' : '?';
          embedUrl = `${embedUrl}${separator}autoplay=1`;
        }

        return (
          <div className={`relative group/player w-full overflow-hidden rounded-xl bg-black ${aspectClass} ${className}`}>
            <iframe
              src={embedUrl}
              title={title}
              className="h-full w-full border-0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
            />
            <div className="absolute top-2 right-2 flex items-center gap-1.5 opacity-90 sm:opacity-0 sm:group-hover/player:opacity-100 transition-opacity bg-black/75 backdrop-blur-xs px-2 py-1 rounded-lg border border-white/10 z-10">
              {watchUrl && (
                <a
                  href={watchUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-[11px] font-medium text-stone-200 hover:text-red-400 transition-colors"
                  title="Open video on external website"
                >
                  <ExternalLink className="h-3 w-3" />
                  <span>{isYouTube ? 'YouTube' : 'Watch'}</span>
                </a>
              )}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsPlayingVideo(false);
                }}
                className="p-1 text-stone-400 hover:text-white rounded transition-colors"
                title="Close player"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        );
      }

      return (
        <div className={`relative w-full overflow-hidden rounded-xl bg-black ${aspectClass} ${className}`}>
          <video
            src={videoAsset?.url || rawVideoUrl}
            controls
            autoPlay
            preload="auto"
            className="h-full w-full object-contain"
          >
            Your browser does not support HTML5 video.
          </video>
        </div>
      );
    }

    // Video preview with high-res 16:9 thumbnail and Play overlay
    return (
      <div
        onClick={() => setIsPlayingVideo(true)}
        className={`group relative w-full overflow-hidden rounded-xl bg-stone-950 ${aspectClass} ${className} cursor-pointer select-none border border-stone-800/60 shadow-xs`}
      >
        {finalSrc ? (
          <>
            <img
              src={finalSrc}
              alt={title}
              referrerPolicy="no-referrer"
              loading="lazy"
              decoding="async"
              className={`h-full w-full object-cover transition-all duration-300 group-hover:scale-[1.02] ${
                imageLoaded ? 'opacity-100' : 'opacity-80 animate-pulse'
              }`}
              onLoad={handleImageLoad}
              onError={handleImageError}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent transition-colors group-hover:via-black/10" />
          </>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-stone-900 text-stone-600">
            <Video className="h-8 w-8 opacity-40" />
          </div>
        )}

        {/* Center Play Button */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-600 text-white shadow-xl ring-4 ring-black/30 transition-transform duration-200 group-hover:scale-110 group-active:scale-95">
            <Play className="h-5 w-5 fill-white ml-0.5" />
          </div>
        </div>

        {/* Video Badge */}
        <span className="absolute top-2.5 left-2.5 inline-flex items-center gap-1.5 rounded-md bg-black/85 px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur-xs border border-white/10 shadow-xs">
          <Video className="h-3 w-3 text-red-400" />
          <span>Video</span>
        </span>

        {/* Open on external platform button */}
        {watchUrl && (
          <a
            href={watchUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="absolute top-2.5 right-2.5 z-20 flex items-center gap-1 rounded-md bg-black/80 px-2 py-0.5 text-[10px] font-medium text-stone-300 hover:text-white hover:bg-black transition-colors border border-white/10 backdrop-blur-xs"
            title="Open video in new tab"
          >
            <ExternalLink className="h-2.5 w-2.5" />
            <span>Open</span>
          </a>
        )}

        {/* Click to play hint on hover */}
        <span className="absolute bottom-2.5 left-2.5 opacity-0 group-hover:opacity-100 transition-opacity text-[10px] text-stone-300 font-medium bg-black/80 px-2 py-0.5 rounded backdrop-blur-xs">
          Click to play
        </span>
      </div>
    );
  }

  // 2. Audio Asset (Podcasts, Interviews)
  if (audioAsset) {
    return (
      <div className={`flex flex-col rounded-xl overflow-hidden border border-stone-200 bg-stone-900 shadow-xs ${className}`}>
        {finalSrc && (
          <div className="relative aspect-[21/9] w-full overflow-hidden bg-stone-950">
            <img
              src={finalSrc}
              alt={title}
              referrerPolicy="no-referrer"
              loading="lazy"
              className="h-full w-full object-cover opacity-85"
              onError={() => setCandidateIndex(prev => prev + 1)}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-stone-900 via-transparent to-transparent" />
            <span className="absolute top-2.5 left-2.5 inline-flex items-center gap-1 rounded-md bg-purple-950/90 text-purple-200 border border-purple-500/30 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider backdrop-blur-xs">
              <Headphones className="h-3 w-3 text-purple-400" />
              Podcast Episode
            </span>
          </div>
        )}
        <div className="p-3 bg-stone-900 border-t border-stone-800/80">
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <div className="flex items-center gap-1.5 min-w-0">
              <Headphones className="h-3.5 w-3.5 text-purple-400 shrink-0" />
              <span className="text-xs font-medium text-stone-200 truncate">{title}</span>
            </div>
            <span className="text-[10px] text-stone-400 font-mono shrink-0">Audio</span>
          </div>
          <audio
            src={audioAsset.url}
            controls
            className="w-full h-8 accent-purple-500"
            preload="none"
          >
            Your browser does not support audio playback.
          </audio>
        </div>
      </div>
    );
  }

  // 3. Document / PDF Asset
  if (documentAsset) {
    return (
      <div className={`flex items-center justify-between rounded-xl border border-blue-100 bg-blue-50/60 p-4 ${className}`}>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <span className="text-xs font-semibold text-blue-950 block">Research Publication (PDF)</span>
            <span className="text-[11px] text-blue-700 truncate max-w-[220px] block">{title}</span>
          </div>
        </div>
        <a
          href={documentAsset.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 rounded-md bg-white border border-blue-200 px-3 py-1.5 text-xs font-medium text-blue-800 hover:bg-blue-50 shadow-2xs transition-colors"
        >
          View PDF <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    );
  }

  // 4. Primary Image Rendering
  // If no high-quality image exists or image failed quality filter
  if (!finalSrc || candidateIndex >= imageCandidates.length) {
    if (showEditorialFallback) {
      const fallbackPhoto = getEditorialImage(title, category, sourceId, domain);

      return (
        <div className={`group/media relative w-full overflow-hidden rounded-xs bg-stone-900 border-0 ${aspectClass} ${className}`}>
          <img
            src={fallbackPhoto}
            alt={title || 'Editorial photography'}
            referrerPolicy="no-referrer"
            loading="lazy"
            decoding="async"
            width="640"
            height="360"
            className="relative z-10 h-full w-full object-cover transform-gpu transition-all duration-300 group-hover/media:scale-[1.015]"
          />
        </div>
      );
    }
    return null;
  }

  return (
    <div className={`group/media relative w-full overflow-hidden rounded-xs bg-stone-900 border-0 ${aspectClass} ${className}`}>
      {/* Crisp background shimmer while image loads */}
      <div
        className={`absolute inset-0 z-0 flex items-center justify-center bg-gradient-to-br from-stone-950 via-stone-900 to-stone-950 text-stone-600 transition-opacity duration-300 ${
          imageLoaded ? 'opacity-0 pointer-events-none' : 'opacity-100 animate-pulse'
        }`}
      >
        <ImageIcon className="h-6 w-6 opacity-30" />
      </div>

      <img
        src={finalSrc}
        alt={title || 'Article visual'}
        referrerPolicy="no-referrer"
        loading="lazy"
        decoding="async"
        width="640"
        height="360"
        onLoad={handleImageLoad}
        onError={handleImageError}
        className={`relative z-10 h-full w-full object-cover transform-gpu transition-all duration-300 group-hover/media:scale-[1.015] ${
          imageLoaded ? 'opacity-100' : 'opacity-85'
        }`}
      />
    </div>
  );
};
