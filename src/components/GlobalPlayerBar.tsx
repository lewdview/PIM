import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, X, Volume2, SkipBack, SkipForward, Shuffle, Repeat, Repeat1, Sparkles, Lock } from 'lucide-react';
import { useLocation } from 'wouter';
import { useGlobalPlayer } from '../store/useGlobalPlayer';
import { useVaultStore, ownsCardForDay } from '../store/useVaultStore';
import { RARITY_CONFIG } from '../utils/rarity';
import { useIsMobile } from '../hooks/use-mobile';

function TimeDisplay({ effectiveDuration }: { effectiveDuration: number }) {
  const currentTime = useGlobalPlayer(s => s.currentTime);
  return (
    <span style={{
      fontFamily: 'var(--shell-mono, "JetBrains Mono", monospace)',
      fontSize: '10px',
      fontVariantNumeric: 'tabular-nums',
      color: 'rgba(250, 240, 216, 0.48)',
    }}>
      {formatTime(currentTime)} / {formatTime(effectiveDuration)}
    </span>
  );
}

function ProgressBar({ accent }: { accent: string }) {
  const progress = useGlobalPlayer(s => s.progress);
  const seek = useGlobalPlayer(s => s.seek);

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    seek(pct);
  };

  return (
    <div
      onClick={handleSeek}
      style={{
        height: '4px',
        background: 'rgba(0, 0, 0, 0.7)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
        cursor: 'pointer',
        position: 'relative',
      }}
    >
      <motion.div
        style={{
          height: '100%',
          width: `${progress * 100}%`,
          background: `linear-gradient(90deg, ${accent}, #ffffff 140%)`,
          boxShadow: `0 0 12px ${accent}`,
          transition: 'width 0.25s linear',
        }}
      />
    </div>
  );
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function GlobalPlayerBar() {
  const [, setLocation] = useLocation();
  const isMobile = useIsMobile();
  const currentTrack = useGlobalPlayer(s => s.currentTrack);
  const collection = useVaultStore(s => s.collection);
  const trackOwned = currentTrack ? ownsCardForDay(collection, currentTrack.day) : true;
  const isPlaying = useGlobalPlayer(s => s.isPlaying);
  const duration = useGlobalPlayer(s => s.duration);
  const loopMode = useGlobalPlayer(s => s.loopMode);
  const shuffle = useGlobalPlayer(s => s.shuffle);

  const toggle = useGlobalPlayer(s => s.toggle);
  const stop = useGlobalPlayer(s => s.stop);
  const nextTrack = useGlobalPlayer(s => s.nextTrack);
  const previousTrack = useGlobalPlayer(s => s.previousTrack);
  const toggleShuffle = useGlobalPlayer(s => s.toggleShuffle);
  const setLoopMode = useGlobalPlayer(s => s.setLoopMode);

  const rc = currentTrack ? (RARITY_CONFIG[currentTrack.rarity as keyof typeof RARITY_CONFIG] || RARITY_CONFIG.common) : RARITY_CONFIG.common;
  const accent = rc?.color || '#ff3800';
  const limit = currentTrack?.maxDuration || 0;
  const effectiveDuration = limit > 0 ? limit : duration;
  const isPreview = limit > 0;

  const cycleLoopMode = () => {
    if (loopMode === 'all') setLoopMode('one');
    else if (loopMode === 'one') setLoopMode('off');
    else setLoopMode('all');
  };

  return (
    <AnimatePresence>
      {currentTrack && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 35 }}
          style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 45,
            background: 'linear-gradient(180deg, rgba(22, 18, 13, 0.96) 0%, rgba(10, 8, 5, 0.98) 100%)',
            backdropFilter: 'blur(24px) saturate(1.4)',
            WebkitBackdropFilter: 'blur(24px) saturate(1.4)',
            borderTop: `1px solid ${accent}45`,
            boxShadow: `inset 0 1px 0 rgba(255,255,255,0.08), 0 -10px 32px rgba(0,0,0,0.7), 0 0 24px ${accent}18`,
            paddingBottom: 'calc(var(--fc-safe-area-bottom, 0px) + env(safe-area-inset-bottom, 0px) + 0.35rem)',
          }}
          className="bottom-0"
        >
          {/* Progress bar — clickable */}
          <ProgressBar accent={accent} />

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '8px 16px',
              maxWidth: '1280px',
              margin: '0 auto',
            }}
          >
            {/* Cover art inside hardware bezel */}
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '10px',
                overflow: 'hidden',
                flexShrink: 0,
                border: `1px solid ${accent}65`,
                background: '#0b0805',
                boxShadow: `0 2px 8px rgba(0,0,0,0.6), 0 0 12px ${accent}25`,
              }}
            >
              {currentTrack.coverUrl ? (
                <img
                  src={currentTrack.coverUrl}
                  alt={currentTrack.title}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                <div
                  style={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Volume2 size={16} style={{ color: accent, opacity: 0.7 }} />
                </div>
              )}
            </div>

            {/* Track info */}
            <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
              <div
                style={{
                  fontFamily: 'var(--shell-body, "Space Grotesk", sans-serif)',
                  fontSize: '14px',
                  fontWeight: 700,
                  color: '#fff',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {currentTrack.title}
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginTop: '2px',
                }}
              >
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    fontFamily: 'var(--shell-mono, "JetBrains Mono", monospace)',
                    fontSize: '10px',
                    fontWeight: 700,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: accent,
                  }}
                >
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: isPlaying ? '#39ff14' : accent,
                      boxShadow: isPlaying ? '0 0 8px #39ff14' : 'none',
                    }}
                  />
                  DAY {currentTrack.day}
                </span>
                <TimeDisplay effectiveDuration={effectiveDuration} />
                {isPreview && (
                  <span
                    style={{
                      fontFamily: 'var(--shell-mono, "JetBrains Mono", monospace)',
                      fontSize: '9px',
                      padding: '2px 6px',
                      borderRadius: '5px',
                      background: 'rgba(255, 184, 0, 0.1)',
                      border: '1px solid rgba(255, 184, 0, 0.3)',
                      color: '#ffb800',
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                    }}
                  >
                    Preview
                  </span>
                )}
              </div>
            </div>

            {/* Transport Controls */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '3px 6px',
                borderRadius: '12px',
                background: 'rgba(8, 6, 4, 0.65)',
                border: '1px solid rgba(250, 240, 216, 0.08)',
                boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.6)',
              }}
            >
              {/* Shuffle */}
              {!isMobile && (
                <button
                  type="button"
                  onClick={toggleShuffle}
                  title={shuffle ? 'Shuffle ON' : 'Shuffle OFF'}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: shuffle ? accent : 'rgba(250,240,216,0.42)',
                    padding: '6px',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <Shuffle size={14} />
                </button>
              )}

              {/* Prev Track */}
              <button
                type="button"
                onClick={previousTrack}
                title="Previous Track"
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'rgba(250,240,216,0.85)',
                  padding: '6px',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <SkipBack size={15} />
              </button>

              {/* Play/Pause Tactile 3D Button */}
              <button
                onClick={toggle}
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: `linear-gradient(180deg, ${accent} 0%, color-mix(in srgb, ${accent} 78%, #000) 100%)`,
                  border: '1px solid rgba(255,255,255,0.28)',
                  color: '#080604',
                  cursor: 'pointer',
                  flexShrink: 0,
                  boxShadow: `inset 0 1px 0 rgba(255,255,255,0.35), 0 3px 0 rgba(0,0,0,0.7), 0 0 ${isPlaying ? '16px' : '8px'} ${accent}${isPlaying ? '70' : '35'}`,
                  transition: 'box-shadow 0.2s ease, transform 0.08s ease',
                }}
              >
                {isPlaying ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" style={{ marginLeft: '2px' }} />}
              </button>

              {/* Next Track */}
              <button
                type="button"
                onClick={nextTrack}
                title="Next Track"
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'rgba(250,240,216,0.85)',
                  padding: '6px',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <SkipForward size={15} />
              </button>

              {/* Repeat Mode */}
              {!isMobile && (
                <button
                  type="button"
                  onClick={cycleLoopMode}
                  title={`Loop: ${loopMode.toUpperCase()}`}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: loopMode !== 'off' ? accent : 'rgba(250,240,216,0.42)',
                    padding: '6px',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  {loopMode === 'one' ? <Repeat1 size={14} /> : <Repeat size={14} />}
                </button>
              )}
            </div>

            {/* Visualizer Deep Link */}
            {!isMobile && (
              <button
                type="button"
                onClick={() => {
                  setLocation(`/listen/card-${currentTrack.day}`);
                }}
                className="btn-3d"
                data-tone="quiet"
                data-size="sm"
              >
                <Sparkles size={13} style={{ color: '#ff1e8c' }} />
                <span>Visualizer</span>
              </button>
            )}

            {/* Play PIM */}
            {!isPreview && !isMobile && (
              <button
                type="button"
                onClick={() => {
                  stop();
                  setLocation(`/play/card-${currentTrack.day}`);
                }}
                className="btn-3d"
                data-tone="cyan"
                data-size="sm"
                title={trackOwned ? 'Play in PIM' : 'Card required — claim or own this card to play'}
              >
                {!trackOwned && <Lock size={12} />}
                <span>Play PIM</span>
              </button>
            )}

            {/* Close */}
            <button
              aria-label="Close player"
              onClick={stop}
              className="pim-iconbtn"
              style={{ width: '34px', height: '34px', borderRadius: '10px' }}
            >
              <X size={14} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

