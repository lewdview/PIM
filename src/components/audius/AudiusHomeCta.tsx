/**
 * Homepage call to action for th3scr1b3 × Audius: this week's top 5, the cards
 * you earn by clearing them, and how long the week has left. Sends players to
 * the Weekly Top 5 on /audius.
 *
 * The week's songs are read from the contest table when they're there; the
 * banner works without them (no art strip, same copy and button).
 */
import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { fetchContest, weekEnd, weekStart, type ContestTrack } from '@/lib/audiusContest';
import { AUDIUS_COLLAB } from '@/lib/audiusBrand';
import '@/styles/audiusHomeCta.css';

function timeLeft(end: Date, now: number): string {
  const ms = end.getTime() - now;
  if (ms <= 0) return 'New week loading';
  const h = Math.floor(ms / 3_600_000);
  const d = Math.floor(h / 24);
  if (d >= 1) return `${d}d ${h % 24}h left`;
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return `${h}h ${m}m left`;
}

function PixelX() {
  const on = [0, 4, 6, 8, 12, 16, 18, 20, 24];
  return (
    <span className="ahc-x" aria-hidden>
      {Array.from({ length: 25 }, (_, i) => (
        <i key={i} style={{ opacity: on.includes(i) ? 1 : 0 }} />
      ))}
    </span>
  );
}

export default function AudiusHomeCta() {
  const [, navigate] = useLocation();
  const [tracks, setTracks] = useState<ContestTrack[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const week = weekStart();

  useEffect(() => {
    let live = true;
    fetchContest(week)
      .then((c) => live && setTracks(c?.tracks?.slice(0, 5) ?? []))
      .catch(() => undefined);
    const id = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => {
      live = false;
      window.clearInterval(id);
    };
  }, [week]);

  const go = () => navigate('/audius');

  return (
    <section className="ahc" aria-label={`${AUDIUS_COLLAB} Weekly Top 5`} data-testid="audius-home-cta">
      <div className="ahc-inner">
        <div className="ahc-copy">
          <div className="ahc-brand">
            <span>th3scr1b3</span>
            <PixelX />
            <span>Audius</span>
          </div>
          <h2 className="ahc-title">Weekly Top 5</h2>
          <p className="ahc-text">
            Play this week's five trending Audius songs. Clear one to earn its card, clear Deluxe for the Deluxe card, and
            finish in the top 10 for claw pulls.
          </p>
          <div className="ahc-row">
            <button type="button" className="btn-3d" data-tone="gold" onClick={go} data-testid="audius-home-cta-button">
              Play the top 5
            </button>
            <span className="ahc-time">{timeLeft(weekEnd(week), now)}</span>
          </div>
        </div>
        {tracks.length > 0 && (
          <button type="button" className="ahc-art" onClick={go} aria-label="Open this week's top 5">
            {tracks.map((t, i) => (
              <span key={t.id} className="ahc-tile" style={{ ['--i' as any]: i }}>
                {t.artwork ? <img src={t.artwork} alt="" loading="lazy" /> : null}
                <b>{i + 1}</b>
              </span>
            ))}
          </button>
        )}
      </div>
    </section>
  );
}
