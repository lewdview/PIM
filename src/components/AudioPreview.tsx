import { useCallback } from 'react';
import { motion } from 'framer-motion';
import { Play, Pause, Volume2, Download, ExternalLink } from 'lucide-react';
import { useGlobalPlayer, type GlobalTrack } from '../store/useGlobalPlayer';

// Duration limits by rarity tier (in seconds, 0 = unlimited/full song)
const DURATION_LIMITS: Record<string, number> = {
  common: 15,
  uncommon: 60,
  rare: 0,
  legendary: 0,
  mythic: 0,
};

interface AudioPreviewProps {
  audioUrl: string;
  title: string;
  compact?: boolean;
  rarity?: string;
  /** Daily claim cards get full song regardless of rarity */
  isDailyClaim?: boolean;
  /** Mythic cards show stems download link */
  stemsUrl?: string;
  /** Cover URL for global player */
  coverUrl?: string;
  /** Day number for global player */
  day?: number;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function AudioPreview({
  audioUrl,
  title,
  compact = false,
  rarity = 'common',
  isDailyClaim = false,
  stemsUrl,
  coverUrl = '',
  day = 0,
}: AudioPreviewProps) {
  // Daily claim = full song. Otherwise use rarity-based limit.
  const maxDuration = isDailyClaim ? 0 : (DURATION_LIMITS[rarity] ?? 15);
  const isFullSong = maxDuration === 0;
  const isMythic = rarity === 'mythic';

  // Global player integration
  const { currentTrack, isPlaying: globalPlaying, progress, currentTime, duration, toggle: globalToggle } = useGlobalPlayer();
  const globalPlay = useGlobalPlayer(s => s.play);

  // Check if THIS track is the one currently playing
  const isThisTrack = currentTrack?.audioUrl === audioUrl && currentTrack?.day === day;
  const isPlaying = isThisTrack && globalPlaying;

  const toggle = useCallback(() => {
    if (isThisTrack) {
      globalToggle();
    } else {
      const track: GlobalTrack = {
        title,
        audioUrl,
        coverUrl,
        day,
        rarity,
        isDailyClaim,
        maxDuration,
      };
      globalPlay(track);
    }
  }, [isThisTrack, globalToggle, globalPlay, title, audioUrl, coverUrl, day, rarity, isDailyClaim, maxDuration]);

  // Display duration label
  const durationLabel = isFullSong
    ? (isThisTrack && duration > 0 ? formatTime(duration) : 'FULL')
    : formatTime(maxDuration);

  const tierLabel = isFullSong ? null : (
    maxDuration === 15 ? '15s preview' : '1m preview'
  );

  if (compact) {
    return (
      <button
        onClick={(e) => { e.stopPropagation(); toggle(); }}
        className="flex items-center gap-1.5 px-2 py-1 rounded text-xs font-mono transition-all hover:scale-105 audio-preview-btn"
        style={{
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.1)',
          color: isPlaying ? 'var(--color-neon-cyan)' : 'var(--color-text-secondary)',
        }}
        title={`${isFullSong ? 'Play' : 'Preview'}: ${title}`}
      >
        {isPlaying ? <Pause size={12} /> : <Play size={12} />}
        <Volume2 size={12} />
      </button>
    );
  }

  const displayProgress = isThisTrack ? progress * 100 : 0;
  const displayTime = isThisTrack ? currentTime : 0;

  return (
    <div className="space-y-1" onClick={(e) => e.stopPropagation()}>
      <div
        className="flex items-center gap-3 px-3 py-2 rounded-lg"
        style={{
          background: 'rgba(0,0,0,0.3)',
          border: `1px solid ${isFullSong ? 'rgba(0,240,255,0.15)' : 'rgba(255,255,255,0.06)'}`,
        }}
      >
        <button
          onClick={toggle}
          className="flex items-center justify-center w-8 h-8 rounded-full transition-all hover:scale-110 flex-shrink-0 audio-preview-btn"
          style={{
            background: isPlaying ? 'var(--color-neon-cyan)' : 'rgba(255,255,255,0.1)',
            color: isPlaying ? 'var(--color-void-black)' : 'var(--color-text-primary)',
          }}
        >
          {isPlaying ? <Pause size={14} /> : <Play size={14} />}
        </button>

        <div className="flex-1 min-w-0">
          <div className="h-1 rounded-full overflow-hidden relative" style={{ background: 'rgba(255,255,255,0.08)' }}>
            {/* Waveform visualizer simulation */}
            {isPlaying && (
              <div className="absolute inset-0 flex items-center justify-around px-1 pointer-events-none opacity-40">
                {[...Array(12)].map((_, i) => (
                  <motion.div
                    key={i}
                    animate={{ height: [2, 6, 3, 8, 4] }}
                    transition={{ repeat: Infinity, duration: 0.5 + Math.random(), ease: 'linear', delay: i * 0.05 }}
                    style={{ width: '2px', background: isFullSong ? 'var(--color-neon-cyan)' : '#fff' }}
                  />
                ))}
              </div>
            )}
            <div
              className="h-full rounded-full transition-all duration-200"
              style={{
                width: `${Math.min(displayProgress, 100)}%`,
                background: isFullSong
                  ? 'linear-gradient(90deg, var(--color-neon-cyan), var(--color-neon-purple))'
                  : 'linear-gradient(90deg, var(--color-text-muted), var(--color-text-secondary))',
              }}
            />
          </div>
          {tierLabel && (
            <div className="text-[8px] font-mono mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
              {tierLabel}
            </div>
          )}
        </div>

        <span className="text-[10px] font-mono flex-shrink-0" style={{
          color: isFullSong ? 'var(--color-neon-cyan)' : 'var(--color-text-muted)',
        }}>
          {isPlaying ? formatTime(displayTime) : durationLabel}
        </span>
      </div>

      {/* Mythic: stems download link */}
      {isMythic && (
        <a
          href={stemsUrl || '#'}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-mono font-bold uppercase tracking-wider transition-all hover:scale-[1.02]"
          style={{
            background: 'linear-gradient(135deg, rgba(255,215,0,0.1), rgba(255,170,0,0.05))',
            border: '1px solid rgba(255,215,0,0.25)',
            color: 'var(--color-neon-gold)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <Download size={10} />
          session stems for remix
          <ExternalLink size={10} className="ml-auto" />
        </a>
      )}
    </div>
  );
}
