/**
 * BombshellLightbox — fullscreen viewer for one day's bombshell covers.
 * Moved out of the Codex so the universal detail view and the Codex share it.
 */
import { useCallback, useEffect, useState } from 'react';
import { X, ChevronLeft, ChevronRight, ExternalLink, Check, CheckCircle, Lock, Sparkles, Download, Loader2, Play } from 'lucide-react';
import {
  getBombshellCoverUrl,
  getBombshellHiResPngUrl,
  downloadBombshellHiResArtwork,
} from '../../utils/bombshellCards';

interface BombshellLightboxProps {
  day: number;
  title: string;
  covers: string[];
  initialIndex: number;
  unlockedCovers: Set<string>;
  activeCoverName?: string;
  onSelectCover?: (fileName: string) => void;
  onClose: () => void;
  onPlayTrack?: (coverUrl: string) => void;
}

export default function BombshellLightbox({
  day,
  title,
  covers,
  initialIndex,
  unlockedCovers,
  activeCoverName,
  onSelectCover,
  onClose,
  onPlayTrack,
}: BombshellLightboxProps) {
  const [index, setIndex] = useState(initialIndex);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  const currentFileName = covers[index] || covers[0];
  const isUnlocked = unlockedCovers.has(currentFileName);
  const isLB = currentFileName.toLowerCase().startsWith('lb');
  const isActiveCover = activeCoverName === currentFileName;

  const previewCoverUrl = getBombshellCoverUrl(day, currentFileName);
  const hiResPngUrl = getBombshellHiResPngUrl(day, currentFileName);
  const hiResPngFileName = currentFileName.replace(/\.jpe?g$/i, '.png');

  const handlePrev = useCallback(() => {
    setIndex((prev) => (prev > 0 ? prev - 1 : covers.length - 1));
  }, [covers.length]);

  const handleNext = useCallback(() => {
    setIndex((prev) => (prev < covers.length - 1 ? prev + 1 : 0));
  }, [covers.length]);

  // Keyboard navigation (Arrows + ESC)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') handlePrev();
      if (e.key === 'ArrowRight') handleNext();
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlePrev, handleNext, onClose]);

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      await downloadBombshellHiResArtwork(day, currentFileName);
      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 2500);
    } catch (e) {
      console.error('Hi-res download failed:', e);
      window.open(hiResPngUrl, '_blank');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[260] flex flex-col items-center justify-between bg-black/95 backdrop-blur-2xl p-4 md:p-6 select-none"
      onClick={onClose}
    >
      {/* Top Header Bar */}
      <div 
        className="w-full max-w-6xl flex items-center justify-between z-20"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <span className="px-2.5 py-1 bg-[#FF1493]/20 border border-[#FF1493]/60 text-[#FF1493] text-[10px] font-mono font-bold uppercase tracking-wider">
            DAY #{String(day).padStart(3, '0')} • FULLSCREEN MASTER
          </span>
          <span className="text-white font-mono font-bold text-xs uppercase hidden sm:inline">
            {title}
          </span>
          <span className="px-2 py-0.5 rounded bg-white/10 text-white/70 font-mono text-[9px] uppercase">
            {index + 1} / {covers.length}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => window.open(hiResPngUrl, '_blank')}
            title="Open direct file in new browser window"
            className="p-2 rounded bg-white/5 hover:bg-white/15 border border-white/10 text-white/80 transition-all flex items-center gap-1 text-[10px] font-mono cursor-pointer"
          >
            <ExternalLink size={14} />
          </button>
          <button
            onClick={onClose}
            title="Close Fullscreen View"
            className="p-2 rounded-full bg-white/10 hover:bg-[#FF1493] hover:text-white border border-white/20 text-white transition-all cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Main Center Image Stage */}
      <div 
        className="relative flex-1 w-full max-w-5xl flex items-center justify-center my-3 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Prev Button */}
        {covers.length > 1 && (
          <button
            onClick={handlePrev}
            className="absolute left-2 md:left-4 z-20 p-3 rounded-full bg-black/60 hover:bg-[#FF1493] hover:scale-110 text-white border border-white/20 transition-all shadow-[0_0_15px_rgba(0,0,0,0.8)] cursor-pointer"
          >
            <ChevronLeft size={24} />
          </button>
        )}

        {/* Master Image Frame */}
        <div className={`relative max-h-[72vh] max-w-[85vw] aspect-[3/4] rounded-lg overflow-hidden border-2 shadow-[0_0_50px_rgba(255,20,147,0.35)] bg-black/90 ${
          isActiveCover ? 'border-emerald-500 ring-2 ring-emerald-400/50' : 'border-[#FF1493]/40'
        }`}>
          <img
            src={previewCoverUrl}
            alt={currentFileName}
            className={`w-full h-full object-contain ${isUnlocked ? '' : 'brightness-90'}`}
          />

          {isActiveCover && (
            <div className="absolute top-4 left-4 flex items-center gap-1.5 px-3 py-1 bg-emerald-500/90 text-black font-mono text-[10px] font-black uppercase tracking-wider rounded shadow-[0_0_15px_rgba(16,185,129,0.8)]">
              <Check size={12} strokeWidth={3} /> ACTIVE CARD COVER
            </div>
          )}

          {!isUnlocked && !isActiveCover && (
            <div className="absolute top-4 left-4 flex items-center gap-1.5 px-3 py-1 bg-black/80 border border-white/20 rounded font-mono text-[10px] text-white/70">
              <Lock size={12} className="text-white/50" /> Locked Cover (Pull from Bombshell Pack)
            </div>
          )}
        </div>

        {/* Next Button */}
        {covers.length > 1 && (
          <button
            onClick={handleNext}
            className="absolute right-2 md:right-4 z-20 p-3 rounded-full bg-black/60 hover:bg-[#FF1493] hover:scale-110 text-white border border-white/20 transition-all shadow-[0_0_15px_rgba(0,0,0,0.8)] cursor-pointer"
          >
            <ChevronRight size={24} />
          </button>
        )}
      </div>

      {/* Bottom Command Bar */}
      <div 
        className="w-full max-w-4xl bg-[#0e0712] border border-[#FF1493]/40 rounded-xl p-4 shadow-[0_0_30px_rgba(255,20,147,0.25)] flex flex-col md:flex-row items-center justify-between gap-4 z-20"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col gap-1 text-center md:text-left">
          <div className="flex items-center justify-center md:justify-start gap-2 flex-wrap">
            <span className="text-[12px] font-mono font-black text-white">
              {hiResPngFileName}
            </span>
            <span 
              className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded uppercase"
              style={{
                background: isLB ? 'rgba(0, 229, 255, 0.2)' : 'rgba(255, 20, 147, 0.2)',
                color: isLB ? '#00E5FF' : '#FF1493',
                border: isLB ? '1px solid rgba(0, 229, 255, 0.4)' : '1px solid rgba(255, 20, 147, 0.4)',
              }}
            >
              {isLB ? '✧ Letterbox (LB)' : '★ Full Frame (Standard)'}
            </span>
            {isActiveCover && (
              <span className="text-[9px] font-mono font-black px-1.5 py-0.5 rounded uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center gap-1">
                <Check size={9} strokeWidth={3} /> ACTIVE
              </span>
            )}
          </div>
          <div className="text-[9px] font-mono text-white/50 uppercase">
            Vault Asset: rare_covers/day {day}/hi res/{hiResPngFileName}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5 w-full md:w-auto justify-center flex-wrap">
          {onSelectCover && (
            isUnlocked || isActiveCover ? (
              <button
                onClick={() => onSelectCover(currentFileName)}
                className={`px-4 py-2.5 rounded font-mono text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer ${
                  isActiveCover
                    ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-500/60 shadow-[0_0_16px_rgba(16,185,129,0.35)]'
                    : 'bg-[#FF1493]/20 hover:bg-[#FF1493]/35 text-white border border-[#FF1493]/50 active:scale-95'
                }`}
              >
                {isActiveCover ? (
                  <>
                    <CheckCircle size={13} className="text-emerald-300" /> ACTIVE CARD COVER
                  </>
                ) : (
                  <>
                    <Sparkles size={13} className="text-[#FF1493]" /> SET AS ACTIVE COVER
                  </>
                )}
              </button>
            ) : (
              <div className="px-3.5 py-2 rounded bg-black/60 border border-white/10 text-white/40 font-mono text-[9px] uppercase flex items-center gap-1.5">
                <Lock size={12} className="text-white/40" /> Locked Cover (Pull to Unlock)
              </div>
            )
          )}

          {onPlayTrack && <button
            onClick={() => onPlayTrack(previewCoverUrl)}
            className="px-3.5 py-2.5 bg-white/10 hover:bg-white/20 border border-white/20 text-white font-mono text-[10px] font-bold uppercase tracking-wider rounded transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Play size={12} /> Play Audio
          </button>}

          <button
            onClick={handleDownload}
            disabled={isDownloading}
            className="px-5 py-2.5 bg-gradient-to-r from-[#FF1493] to-[#ff4081] hover:from-[#ff2b9e] hover:to-[#ff5c97] text-white font-mono text-[10px] font-black uppercase tracking-wider rounded transition-all flex items-center gap-2 shadow-[0_0_20px_rgba(255,20,147,0.5)] active:scale-95 cursor-pointer"
          >
            {isDownloading ? (
              <>
                <Loader2 size={13} className="animate-spin" /> DOWNLOADING...
              </>
            ) : downloadSuccess ? (
              <>
                <CheckCircle size={13} /> DOWNLOAD COMPLETE!
              </>
            ) : (
              <>
                <Download size={13} /> DOWNLOAD HI-RES PNG
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
