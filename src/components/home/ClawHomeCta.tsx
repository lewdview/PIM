/**
 * Homepage call to action for the bonus claw. Sits beside the Audius Weekly Top 5
 * banner (same pixel language, warm palette).
 *
 * Signed-in players who already hold claw pulls (from a code, a 99¢ checkout or a
 * Weekly Top 5 finish) go straight to the machine at /bonus-claw. Everyone else goes
 * to the /claw funnel, which handles sign-in and checkout.
 */
import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { useAuthStore } from '@/store/useAuthStore';
import { CLAW_PULL_PRICE, getClawCredits } from '@/services/vaultService';
import { logAnalyticsEvent } from '@/services/telemetryService';
import '@/styles/clawHomeCta.css';

const CENTS = CLAW_PULL_PRICE.replace('$0.', '') + '¢';

// 7x7 pixel claw: cable, hub, two prongs.
const CLAW_PIXELS = [
  '...#...',
  '...#...',
  '.#####.',
  '.#...#.',
  '#.....#',
  '#.....#',
  '.#...#.',
];

function PixelClaw() {
  return (
    <span className="chc-claw" aria-hidden>
      {CLAW_PIXELS.join('').split('').map((c, i) => (
        <i key={i} style={{ opacity: c === '#' ? 1 : 0 }} />
      ))}
    </span>
  );
}

export default function ClawHomeCta() {
  const [, navigate] = useLocation();
  const user = useAuthStore((s) => s.user);
  const [credits, setCredits] = useState(0);

  useEffect(() => {
    if (!user) {
      setCredits(0);
      return;
    }
    let live = true;
    getClawCredits().then((n) => live && setCredits(n));
    return () => {
      live = false;
    };
  }, [user]);

  const hasPulls = credits > 0;

  const go = () => {
    logAnalyticsEvent('claw_funnel_home_cta', { signedIn: !!user, credits });
    navigate(hasPulls ? '/bonus-claw' : '/claw?src=home');
  };

  return (
    <section className="chc" aria-label="Bonus claw" data-testid="claw-home-cta">
      <div className="chc-inner">
        <div className="chc-brand">
          <PixelClaw />
          <span>Bonus claw</span>
        </div>
        <h2 className="chc-title">Claw Pull</h2>
        <p className="chc-text">
          Three drops into a machine stacked with card packs, from 2-card singles to 50-card bundles. Win one and it opens
          straight into your collection.
        </p>
        <div className="chc-row">
          <button type="button" className="btn-3d" data-tone="vermilion" onClick={go} data-testid="claw-home-cta-button">
            {hasPulls ? 'Use my pulls' : `Pull for ${CENTS}`}
          </button>
          <span className="chc-meta">
            {hasPulls ? `${credits} pull${credits === 1 ? '' : 's'} ready` : 'Top 10 in the Weekly Top 5 wins free pulls'}
          </span>
        </div>
      </div>
    </section>
  );
}
