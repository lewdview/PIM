import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { useGlobalPlayer } from '@/store/useGlobalPlayer';
import { loadOpts } from '@/lib/options';
import { CHAPTERS } from '@/game/campaign';

function getMonthNumFromDay(day: number): number {
  if (day >= 335) return 12;
  if (day >= 305) return 11;
  if (day >= 274) return 10;
  if (day >= 244) return 9;
  if (day >= 213) return 8;
  if (day >= 182) return 7;
  if (day >= 152) return 6;
  if (day >= 121) return 5;
  if (day >= 91)  return 4;
  if (day >= 60)  return 3;
  if (day >= 32)  return 2;
  return 1;
}

function getLocalCurrentDay(): number {
  const EPOCH = new Date('2026-01-01T00:00:00');
  const now = new Date();
  const diff = now.getTime() - EPOCH.getTime();
  const day = Math.floor(diff / (1000 * 60 * 60 * 24)) + 1;
  return Math.max(1, Math.min(365, day));
}

export function GlobalMenuBackground() {
  const [bg, setBg] = useState('cover_blur');
  const [isLegacy, setIsLegacy] = useState(false);
  const [location] = useLocation();
  const [dailyCover, setDailyCover] = useState<string | null>(null);
  const currentTrack = useGlobalPlayer((s) => s.currentTrack);

  useEffect(() => {
    try {
      const opts = loadOpts();
      setBg(opts.gameBackground || 'cover_blur');
      setIsLegacy(opts.legacyGraphics || false);
    } catch {
      // ignore options parse errors
    }
  }, [location]);

  // Load fallback daily card cover art in background with smart fallback
  useEffect(() => {
    let cancelled = false;
    import('@/utils/dayCalc')
      .then(({ getCurrentDay }) =>
        import('@/services/vaultService').then(({ getCardByDay }) =>
          getCardByDay(getCurrentDay())
        )
      )
      .then((card) => {
        if (cancelled || !card) return;
        const cover = card.coverUrl || (card as any).coverArt;
        if (!cover) return;

        import('@/utils/rarityArtwork').then(({ getSmartCoverCandidates }) => {
          const candidates = getSmartCoverCandidates(cover, card.rarity);
          if (candidates.length > 0) {
            let idx = 0;
            const tryNext = () => {
              if (idx >= candidates.length) {
                setDailyCover(cover);
                return;
              }
              const img = new Image();
              img.onload = () => {
                if (!cancelled) setDailyCover(candidates[idx]);
              };
              img.onerror = () => {
                idx++;
                tryNext();
              };
              img.src = candidates[idx];
            };
            tryNext();
          } else {
            setDailyCover(cover);
          }
        });
      })
      .catch((err) => {
        console.warn('[GlobalMenuBackground] Failed to load daily cover art:', err);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const hideBg =
    location.startsWith('/play/') ||
    location === '/tutorial' ||
    location.startsWith('/results/');

  if (hideBg || isLegacy) return null;

  const sessionCover =
    typeof sessionStorage !== 'undefined'
      ? sessionStorage.getItem('active_game_cover')
      : null;
  const activeCoverUrl =
    currentTrack?.coverUrl || sessionCover || dailyCover || '/data/covers/default.jpg';
  const songDay = currentTrack?.day || getLocalCurrentDay();
  const monthNum = getMonthNumFromDay(songDay);
  const activeChapter = CHAPTERS.find((c) => c.month === monthNum);
  const activeGlowColor = activeChapter?.dc || '#ff3800';

  return (
    <>
      {bg === 'cover_blur' && (
        <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden select-none bg-[#050402]">
          {/* Blurred Background Artwork */}
          <div
            className="absolute inset-0 transition-all duration-1000 ease-in-out filter blur-[10px] brightness-[0.25] scale-[1.35] opacity-80"
            style={{
              backgroundImage: `url(${activeCoverUrl})`,
              backgroundPosition: 'center',
              backgroundSize: 'cover',
            }}
          />
          {/* Slow pulsing radial glow of the active mood color */}
          <div
            className="absolute inset-0 opacity-55 mix-blend-screen animate-pulse duration-[8000ms]"
            style={{
              background: `radial-gradient(circle at 50% 50%, ${activeGlowColor}1a 0%, transparent 85%)`,
            }}
          />
          {/* Ambient overlay grid lines */}
          <div
            className="absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage:
                'linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)',
              backgroundSize: '48px 48px',
            }}
          />
        </div>
      )}

      {bg !== 'cover_blur' && (
        <div
          className="fixed inset-0 pointer-events-none z-0 overflow-hidden opacity-[0.18] select-none"
          style={{ mixBlendMode: 'screen' }}
        >
          {bg === 'neon_grid' && (
            <div className="absolute inset-0 overflow-hidden bg-neon-grid-container">
              <div className="bg-neon-grid-sun" style={{ opacity: 0.12 }} />
              <div className="bg-neon-grid-grid" />
              <div className="bg-neon-grid-horizon" />
            </div>
          )}
          {bg === 'cyber_streets' && (
            <div className="absolute inset-0 overflow-hidden bg-cyber-streets-container">
              <div className="cyber-streets-grille" style={{ opacity: 0.05 }} />
              {Array.from({ length: 12 }).map((_, i) => {
                const delay = `${(i * 0.4) % 5}s`;
                const duration = `${4 + (i % 4) * 2}s`;
                const opacity = 0.08 + ((i * 3) % 6) * 0.04;
                const left = `${i * 8.5 + 2}%`;
                const chars = ['P', 'I', 'M', '0', '1', 'X', 'Y'];
                const content = Array.from({ length: 20 }).map((_, charIdx) => {
                  const ch = chars[(i + charIdx * 7) % chars.length];
                  return (
                    <span key={charIdx} className="matrix-char" style={{ color: '#39FF14' }}>
                      {ch}
                    </span>
                  );
                });
                return (
                  <div
                    key={i}
                    className="matrix-rain"
                    style={{
                      left,
                      animationDelay: delay,
                      animationDuration: duration,
                      opacity,
                      fontSize: '10px',
                    }}
                  >
                    {content}
                  </div>
                );
              })}
            </div>
          )}
          {bg === 'space_nebula' && (
            <div
              className="absolute inset-0 overflow-hidden bg-space-nebula-container"
              style={{ filter: 'brightness(0.6)' }}
            >
              <div className="space-stars space-stars-back" />
              <div className="space-stars space-stars-mid" style={{ opacity: 0.4 }} />
              <div className="space-nebula-cloud1" style={{ opacity: 0.5 }} />
              <div className="space-nebula-cloud2" style={{ opacity: 0.5 }} />
            </div>
          )}
          {bg === 'sunset_skyline' && (
            <div
              className="absolute inset-0 overflow-hidden bg-sunset-skyline-container"
              style={{ filter: 'brightness(0.5)' }}
            >
              <div className="sunset-sun" style={{ opacity: 0.1 }} />
              <div className="sunset-city-grid" style={{ opacity: 0.6 }} />
              <div className="sunset-mountains" style={{ opacity: 0.5 }} />
            </div>
          )}
          {bg === 'glitch_matrix' && (
            <div className="absolute inset-0 overflow-hidden bg-glitch-matrix-container" style={{ opacity: 0.6 }}>
              <div className="glitch-grid" style={{ opacity: 0.2 }} />
              <div className="glitch-static" style={{ opacity: 0.04 }} />
              <div className="glitch-bar1" style={{ opacity: 0.3 }} />
            </div>
          )}
          {bg === 'cyber_cityscape' && (
            <div
              className="absolute inset-0 overflow-hidden bg-cyber-cityscape-container"
              style={{ filter: 'brightness(0.5)' }}
            >
              <div className="cityscape-stars" />
              <div className="cityscape-buildings" style={{ opacity: 0.5 }} />
            </div>
          )}
          {bg === 'toxic_hazard' && (
            <div className="absolute inset-0 overflow-hidden bg-toxic-hazard-container" style={{ opacity: 0.5 }}>
              <div className="toxic-grid-mesh" style={{ opacity: 0.3 }} />
              <div className="toxic-hazard-stripes" style={{ opacity: 0.1 }} />
            </div>
          )}
          {bg === 'prismatic_aurora' && (
            <div
              className="absolute inset-0 overflow-hidden bg-prismatic-aurora-container"
              style={{ filter: 'brightness(0.6)' }}
            >
              <div className="aurora-wave wave-1" style={{ opacity: 0.5 }} />
              <div className="aurora-wave wave-2" style={{ opacity: 0.5 }} />
              <div className="aurora-stars" style={{ opacity: 0.4 }} />
            </div>
          )}
          {bg === 'hyperdrive_warp' && (
            <div className="absolute inset-0 overflow-hidden bg-hyperdrive-warp-container" style={{ opacity: 0.3 }}>
              <div className="warp-core" style={{ opacity: 0.2 }} />
            </div>
          )}
          {bg === 'living_vault' && (
            <div className="absolute inset-0 overflow-hidden bg-living-vault-container" style={{ opacity: 0.4 }}>
              <div className="vault-corridor-grid" />
              <div className="vault-corridor-glow" style={{ opacity: 0.3 }} />
            </div>
          )}
          {bg === 'gold_record' && (
            <div className="absolute inset-0 overflow-hidden bg-gold-record-container" style={{ opacity: 0.3 }}>
              <div className="gold-record-vinyl" style={{ transform: 'scale(0.8)', opacity: 0.3 }} />
              <div className="gold-record-waves" />
            </div>
          )}
        </div>
      )}
    </>
  );
}

export default GlobalMenuBackground;
