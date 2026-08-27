import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, X, Volume2, SkipBack, SkipForward, Shuffle, Repeat, Repeat1, Sparkles } from 'lucide-react';
import { useLocation } from 'wouter';
import { useGlobalPlayer } from '../store/useGlobalPlayer';
import { RARITY_CONFIG } from '../utils/rarity';
import { useIsMobile } from '../hooks/use-mobile';

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function GlobalPlayerBar() {
  const [location, setLocation] = useLocation();
  const isMobile = useIsMobile();
  const currentTrack = useGlobalPlayer(s => s.currentTrack);
  const isPlaying = useGlobalPlayer(s => s.isPlaying);
  const progress = useGlobalPlayer(s => s.progress);
  const currentTime = useGlobalPlayer(s => s.currentTime);
  const duration = useGlobalPlayer(s => s.duration);
  const loopMode = useGlobalPlayer(s => s.loopMode);
  const shuffle = useGlobalPlayer(s => s.shuffle);

  const toggle = useGlobalPlayer(s => s.toggle);
  const stop = useGlobalPlayer(s => s.stop);
  const seek = useGlobalPlayer(s => s.seek);
  const nextTrack = useGlobalPlayer(s => s.nextTrack);
  const previousTrack = useGlobalPlayer(s => s.previousTrack);
  const toggleShuffle = useGlobalPlayer(s => s.toggleShuffle);
  const setLoopMode = useGlobalPlayer(s => s.setLoopMode);

  const rc = currentTrack ? (RARITY_CONFIG[currentTrack.rarity as keyof typeof RARITY_CONFIG] || RARITY_CONFIG.common) : RARITY_CONFIG.common;
  const accent = rc?.color || '#ff3800';
  const limit = currentTrack?.maxDuration || 0;
  const effectiveDuration = limit > 0 ? limit : duration;
  const isPreview = limit > 0;

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    seek(pct);
  };

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
          background: 'rgba(8, 6, 4, 0.96)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          borderTop: `1px solid ${accent}30`,
          boxShadow: `0 -4px 20px rgba(0,0,0,0.5), 0 0 20px ${accent}15`,
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
        className="bottom-0"
      >
        {/* Progress bar — clickable */}
        <div
          onClick={handleSeek}
          style={{
            height: '3px',
            background: 'rgba(255,255,255,0.06)',
            cursor: 'pointer',
            position: 'relative',
          }}
        >
          <motion.div
            style={{
              height: '100%',
              width: `${progress * 100}%`,
              background: `linear-gradient(90deg, ${accent}, ${accent}cc)`,
              boxShadow: `0 0 8px ${accent}60`,
              transition: 'width 0.3s linear',
            }}
          />
        </div>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '8px 16px',
        }}>
          {/* Cover art */}
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '4px',
            overflow: 'hidden',
            flexShrink: 0,
            border: `1px solid ${accent}40`,
            background: '#111',
          }}>
            {currentTrack.coverUrl ? (
              <img
                src={currentTrack.coverUrl}
                alt={currentTrack.title}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              <div style={{
                width: '100%', height: '100%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Volume2 size={16} style={{ color: accent, opacity: 0.5 }} />
              </div>
            )}
          </div>

          {/* Track info */}
          <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
            <div style={{
              fontFamily: '"Impact", "Arial Black", sans-serif',
              fontSize: '13px',
              textTransform: 'uppercase',
              letterSpacing: '-0.02em',
              color: '#fff',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}>
              {currentTrack.title}
            </div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              marginTop: '1px',
            }}>
              <span style={{
                fontFamily: '"JetBrains Mono", monospace',
                fontSize: '8px',
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: accent,
              }}>
                DAY {currentTrack.day}
              </span>
              <span style={{
                fontFamily: '"JetBrains Mono", monospace',
                fontSize: '8px',
                color: 'rgba(255,255,255,0.3)',
              }}>
                {formatTime(currentTime)} / {formatTime(effectiveDuration)}
              </span>
              {isPreview && (
                <span style={{
                  fontFamily: '"JetBrains Mono", monospace',
                  fontSize: '7px',
                  padding: '1px 5px',
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  color: 'rgba(255,255,255,0.3)',
                  textTransform: 'uppercase',
                }}>
                  Preview
                </span>
              )}
            </div>
          </div>

          {/* Transport Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
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
                  color: shuffle ? accent : 'rgba(255,255,255,0.4)',
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
                color: '#fff',
                padding: '6px',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <SkipBack size={15} />
            </button>

            {/* Play/Pause */}
            <button
              onClick={toggle}
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: accent,
                border: '2px solid #000',
                color: '#000',
                cursor: 'pointer',
                flexShrink: 0,
                boxShadow: `2px 2px 0 #000, 0 0 ${isPlaying ? '18px' : '10px'} ${accent}${isPlaying ? '70' : '40'}`,
                transition: 'box-shadow 0.3s ease',
              }}
            >
              {isPlaying ? <Pause size={16} /> : <Play size={16} style={{ marginLeft: '2px' }} />}
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
                color: '#fff',
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
                  color: loopMode !== 'off' ? accent : 'rgba(255,255,255,0.4)',
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
              onClick={() => {
                setLocation(`/listen/card-${currentTrack.day}`);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '0 10px',
                height: '32px',
                borderRadius: '4px',
                background: 'rgba(255, 20, 147, 0.1)',
                border: '1px solid rgba(255, 20, 147, 0.4)',
                color: '#ff1493',
                fontFamily: '"JetBrains Mono", monospace',
                fontSize: '10px',
                fontWeight: 700,
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                cursor: 'pointer',
                flexShrink: 0,
              }}
              className="hover:bg-[rgba(255,20,147,0.2)]"
            >
              <Sparkles size={11} />
              <span>Visualizer</span>
            </button>
          )}

          {/* Play PIM */}
          {!isPreview && !isMobile && (
            <button
              onClick={() => {
                stop();
                setLocation(`/play/card-${currentTrack.day}`);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '0 12px',
                height: '32px',
                borderRadius: '4px',
                background: 'rgba(0, 240, 255, 0.1)',
                border: '1px solid var(--color-neon-cyan, #00f0ff)',
                color: 'var(--color-neon-cyan, #00f0ff)',
                fontFamily: '"JetBrains Mono", monospace',
                fontSize: '10px',
                fontWeight: 700,
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                cursor: 'pointer',
                boxShadow: '0 0 8px rgba(0, 240, 255, 0.2)',
                transition: 'all 0.2s ease',
                flexShrink: 0,
              }}
              className="hover:bg-[rgba(0,240,255,0.2)] hover:scale-105"
            >
              <span>Play PIM</span>
            </button>
          )}

          {/* Close */}
          <button
            aria-label="Close player"
            onClick={stop}
            style={{
              width: '24px',
              height: '24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'none',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '4px',
              color: 'rgba(255,255,255,0.3)',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            <X size={12} />
          </button>
        </div>
      </motion.div>
      )}
    </AnimatePresence>
  );
}
