import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
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
  extractYouTubeId
} from '../utils/mediaQuality.js';
import { getEditorialImage } from '../utils/editorialMedia.js';
import { useInView } from '../utils/useInView.js';
import { resolvePublisherMediaBatched, getCachedPublisherMedia } from '../utils/mediaBatchResolver.js';

export interface MediaRendererProps {
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
  priority?: boolean;
}

// Global session set of successfully loaded images for 0ms re-render transitions
const loadedImagesCache = new Set<string>();

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
  showEditorialFallback = true,
  priority = false
}) => {
  // Viewport intersection observer (bypassed if priority=true for hero LCP)
  const { ref: containerRef, isInView: observerInView } = useInView({
    rootMargin: '350px 0px',
    triggerOnce: true
  });
  const isInView = priority || observerInView;

  // Find media assets by type
  const videoAsset = media?.find(m => m.type === 'video');
  const audioAsset = media?.find(m => m.type === 'audio');
  const imageAsset = media?.find(m =>
    m.type === 'image' &&
    !isLowQualityMedia(m.url) &&
    m.mimeType !== 'application/x-shockwave-flash'
  );
  const documentAsset = media?.find(m => m.type === 'document');

  // Detect YouTube video ID
  const allMediaUrls = [articleUrl, videoAsset?.url, fallbackImageUrl, ...(media || []).map(m => m.url)].filter(Boolean).join(' ');
  const ytVideoId = extractYouTubeId(allMediaUrls);

  // Compute prioritized direct genuine candidates list
  const directCandidates = useMemo<string[]>(() => {
    const candidates: string[] = [];

    // 1. YouTube video thumbnails
    if (ytVideoId) {
      candidates.push(`https://i.ytimg.com/vi/${ytVideoId}/hqdefault.jpg`);
      candidates.push(`https://i.ytimg.com/vi/${ytVideoId}/maxresdefault.jpg`);
    }

    // 2. GitHub repo OpenGraph card
    const ghMatch = (articleUrl || '').match(/^https?:\/\/github\.com\/([a-zA-Z0-9._-]+)\/([a-zA-Z0-9._-]+)(?:\/|$)/i);
    if (ghMatch && !['features', 'topics', 'trending', 'collections', 'events', 'pricing', 'about', 'login', 'signup'].includes(ghMatch[1].toLowerCase())) {
      candidates.push(`https://opengraph.githubassets.com/1/${ghMatch[1]}/${ghMatch[2]}`);
    }

    // 3. Genuine image asset or fallback URL
    let rawImage = imageAsset?.url || fallbackImageUrl;
    if (rawImage && !isLowQualityMedia(rawImage) && !rawImage.startsWith('/assets/editorial/')) {
      if (rawImage.startsWith('http://')) rawImage = rawImage.replace('http://', 'https://');
      const upgraded = upgradeMediaQuality(rawImage);
      if (upgraded && !candidates.includes(upgraded)) candidates.push(upgraded);
      if (rawImage && upgraded !== rawImage && !candidates.includes(rawImage)) candidates.push(rawImage);
    }

    // 4. Other images in media array
    if (media) {
      for (const m of media) {
        if (m.type === 'image' && m.url && !isLowQualityMedia(m.url) && !m.url.startsWith('/assets/editorial/')) {
          let u = m.url;
          if (u.startsWith('http://')) u = u.replace('http://', 'https://');
          const up = upgradeMediaQuality(u) || u;
          if (up && !candidates.includes(up)) candidates.push(up);
        }
      }
    }

    return candidates;
  }, [ytVideoId, imageAsset?.url, fallbackImageUrl, media, articleUrl]);

  // Editorial fallback candidate
  const editorialFallback = useMemo(() => {
    return showEditorialFallback ? getEditorialImage(title, category, sourceId, domain) : null;
  }, [showEditorialFallback, title, category, sourceId, domain]);

  const [resolvedImageUrl, setResolvedImageUrl] = useState<string | null>(() => {
    return articleUrl ? getCachedPublisherMedia(articleUrl) || null : null;
  });
  const [candidateIndex, setCandidateIndex] = useState<number>(0);
  const [imageLoaded, setImageLoaded] = useState<boolean>(false);
  const [isPlayingVideo, setIsPlayingVideo] = useState<boolean>(false);
  const imgRef = useRef<HTMLImageElement>(null);

  // Lazy Batched OpenGraph Resolution: only triggers when card is in/near viewport
  useEffect(() => {
    if (!isInView || directCandidates.length > 0 || !articleUrl || !articleUrl.startsWith('http')) return;

    let active = true;
    resolvePublisherMediaBatched(articleUrl, title)
      .then(url => {
        if (active && url) {
          setResolvedImageUrl(url);
        }
      })
      .catch(() => {});

    return () => { active = false; };
  }, [isInView, directCandidates.length, articleUrl, title]);

  // Reset indices on candidate list changes
  useEffect(() => {
    setCandidateIndex(0);
    setIsPlayingVideo(false);
  }, [directCandidates[0]]);

  const aspectClass =
    aspectRatio === 'video' ? 'aspect-video' : aspectRatio === 'square' ? 'aspect-square' : 'h-full w-full';

  // Compute all available candidates in order: direct -> resolved -> editorial fallback
  const fullCandidatesList = useMemo(() => {
    const list = [...directCandidates];
    if (resolvedImageUrl && !list.includes(resolvedImageUrl)) {
      list.push(resolvedImageUrl);
    }
    if (editorialFallback && !list.includes(editorialFallback)) {
      list.push(editorialFallback);
    }
    return list;
  }, [directCandidates, resolvedImageUrl, editorialFallback]);

  const activeSrc = fullCandidatesList[candidateIndex] || null;

  // Immediate cache hit detection
  useEffect(() => {
    if (activeSrc && loadedImagesCache.has(activeSrc)) {
      setImageLoaded(true);
    }
    if (imgRef.current && imgRef.current.complete && imgRef.current.naturalWidth > 0) {
      setImageLoaded(true);
    }
  }, [activeSrc]);

  const handleImageLoad = () => {
    setImageLoaded(true);
    if (activeSrc) loadedImagesCache.add(activeSrc);
  };

  const handleImageError = () => {
    if (candidateIndex + 1 < fullCandidatesList.length) {
      setCandidateIndex(prev => prev + 1);
    }
  };

  // 0. VIEWPORT LAZY GATE: If element is outside viewport, render zero-cost skeleton placeholder
  if (!isInView) {
    return (
      <div
        ref={containerRef}
        className={`relative w-full overflow-hidden rounded-xs bg-stone-200/40 select-none ${aspectClass} ${className}`}
        aria-hidden="true"
      >
        <div className="absolute inset-0 bg-stone-200/30 animate-pulse pointer-events-none" />
      </div>
    );
  }

  // 1. VIDEO ASSET RENDERING
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
        <div
          ref={containerRef}
          className={`relative group/player w-full overflow-hidden rounded-xl bg-black ${aspectClass} ${className}`}
        >
          <iframe
            src={embedUrl}
            title={title}
            className="h-full w-full border-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsPlayingVideo(false);
            }}
            className="absolute top-2.5 right-2.5 z-30 flex h-7 w-7 items-center justify-center rounded-full bg-black/80 text-white hover:bg-black transition-colors border border-white/20 backdrop-blur-xs cursor-pointer shadow-md"
            title="Close video"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      );
    }

    const videoThumbnail = activeSrc;

    return (
      <div
        ref={containerRef}
        onClick={() => setIsPlayingVideo(true)}
        className={`group relative w-full overflow-hidden rounded-xl bg-stone-900 ${aspectClass} ${className} cursor-pointer select-none border border-stone-800/60 shadow-xs`}
      >
        {videoThumbnail ? (
          <img
            ref={imgRef}
            src={videoThumbnail}
            alt={title}
            referrerPolicy="no-referrer"
            loading={priority ? 'eager' : 'lazy'}
            decoding="async"
            fetchPriority={priority ? 'high' : 'low'}
            className={`h-full w-full object-cover transition-all duration-300 group-hover:scale-[1.02] ${
              imageLoaded ? 'opacity-100' : 'opacity-85'
            }`}
            onLoad={handleImageLoad}
            onError={handleImageError}
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-stone-900 via-stone-850 to-stone-950 flex flex-col justify-end p-6">
            <span className="text-white/80 font-editorial text-lg line-clamp-2">{title}</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent transition-colors group-hover:via-black/10" />

        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-600 text-white shadow-xl ring-4 ring-black/30 transition-transform duration-200 group-hover:scale-110 group-active:scale-95">
            <Play className="h-5 w-5 fill-white ml-0.5" />
          </div>
        </div>

        <span className="absolute top-2.5 left-2.5 inline-flex items-center gap-1.5 rounded-md bg-black/85 px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur-xs border border-white/10 shadow-xs">
          <Video className="h-3 w-3 text-red-400" />
          <span>Video</span>
        </span>

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
      </div>
    );
  }

  // 2. AUDIO ASSET RENDERING
  if (audioAsset) {
    return (
      <div
        ref={containerRef}
        className={`flex flex-col rounded-xl overflow-hidden border border-stone-200 bg-stone-900 shadow-xs ${className}`}
      >
        {activeSrc && (
          <div className="relative aspect-[21/9] w-full overflow-hidden bg-stone-950">
            <img
              src={activeSrc}
              alt={title}
              referrerPolicy="no-referrer"
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover opacity-85"
              onError={handleImageError}
              onLoad={handleImageLoad}
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

  // 3. DOCUMENT / RESEARCH PDF ASSET RENDERING
  if (documentAsset) {
    return (
      <div
        ref={containerRef}
        className={`flex items-center justify-between rounded-xl border border-blue-100 bg-blue-50/60 p-4 ${className}`}
      >
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

  // 4. PRIMARY IMAGE RENDERING
  if (!activeSrc) return null;

  return (
    <div
      ref={containerRef}
      className={`group/media relative w-full overflow-hidden rounded-xs bg-stone-100 border-0 ${aspectClass} ${className}`}
    >
      <img
        ref={imgRef}
        src={activeSrc}
        alt={title || 'Article visual'}
        referrerPolicy="no-referrer"
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        fetchPriority={priority ? 'high' : 'low'}
        width="640"
        height="360"
        onLoad={handleImageLoad}
        onError={handleImageError}
        className={`h-full w-full object-cover transform-gpu transition-opacity duration-300 group-hover/media:scale-[1.015] ${
          imageLoaded ? 'opacity-100' : 'opacity-0'
        }`}
      />
      {!imageLoaded && (
        <div className="absolute inset-0 bg-stone-200/40 animate-pulse pointer-events-none" />
      )}
    </div>
  );
};
