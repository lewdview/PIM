/**
 * "Listen elsewhere": the day's Audius track and, when there is one, its
 * YouTube video in a pop-up player (with a direct link as a fallback).
 * Renders nothing for a day with neither.
 */
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ExternalLink, Youtube, X } from 'lucide-react';
import { getAudiusUrl, getYouTubeId } from '@/lib/externalLinks';

function AudiusMark({ size = 14 }: { size?: number }) {
  // Simple triangle mark; stands in for the Audius logo without bundling it.
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden fill="currentColor">
      <path d="M12 3 2 20h6.2l3.8-6.6 3.8 6.6H22L12 3Z" />
    </svg>
  );
}

function YouTubeModal({ videoId, title, onClose }: { videoId: string; title: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/85 backdrop-blur-sm p-4" role="dialog" aria-modal="true" aria-label={`${title} on YouTube`} onClick={onClose}>
      <div className="relative w-full max-w-4xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-2 gap-3">
          <span className="font-mono text-xs uppercase tracking-widest text-white/70 truncate">{title}</span>
          <div className="flex items-center gap-2 shrink-0">
            <a href={`https://www.youtube.com/watch?v=${videoId}`} target="_blank" rel="noopener noreferrer" className="btn-3d" data-size="sm" data-tone="ghost">
              <ExternalLink size={12} /> Open on YouTube
            </a>
            <button type="button" aria-label="Close video" onClick={onClose}
              className="w-9 h-9 rounded-full flex items-center justify-center bg-white/10 hover:bg-white/20 text-white cursor-pointer">
              <X size={16} />
            </button>
          </div>
        </div>
        <div className="relative w-full aspect-video rounded-xl overflow-hidden border border-white/15 bg-black">
          <iframe
            className="absolute inset-0 w-full h-full"
            src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0`}
            title={title}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
          />
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default function ListenElsewhere({ day, title, onBeforeOpen }: { day: number; title: string; onBeforeOpen?: () => void }) {
  const audiusUrl = getAudiusUrl(day);
  const youtubeId = getYouTubeId(day);
  const [videoOpen, setVideoOpen] = useState(false);

  if (!audiusUrl && !youtubeId) return null;

  return (
    <div className="hw-well px-4 py-3">
      <span className="td-label">Listen elsewhere</span>
      <div className={`grid gap-2 mt-2 ${audiusUrl && youtubeId ? 'grid-cols-2' : 'grid-cols-1'}`}>
        {audiusUrl && (
          <a href={audiusUrl} target="_blank" rel="noopener noreferrer" className="btn-3d justify-center" data-tone="ghost" title="Open this song on Audius">
            <AudiusMark /> Audius
          </a>
        )}
        {youtubeId && (
          <button type="button" className="btn-3d justify-center" data-tone="ghost" title="Watch the video"
            onClick={() => { onBeforeOpen?.(); setVideoOpen(true); }}>
            <Youtube size={14} /> Video
          </button>
        )}
      </div>
      {videoOpen && youtubeId && <YouTubeModal videoId={youtubeId} title={title} onClose={() => setVideoOpen(false)} />}
    </div>
  );
}
