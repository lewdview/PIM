// "Who is th3scr1b3?" for a monthly Playgama build: the artist, the 365 Days of
// Light and Dark project, how this chapter fits, and ways to help. Playgama does
// not allow links out of the game, so there the help section only offers the
// portal's own actions (rate, favorite, share) and the bonus bundle; the site
// and support links show only where the portal allows outside links.

import { useEffect, useState } from 'react';
import { ExternalLink, Gift, Heart, Share2, Star, Users, X } from 'lucide-react';
import { CHAPTERS } from '@/game/campaign';
import { PLAYGAMA_MONTH, canBuyBundle, ownsBonusBundle } from '@/platform/playgama/month';
import { externalLinksAllowed, runSocialAction, socialActions, type SocialAction } from '@/platform/playgama/bridge';
import '@/styles/monthPanels.css';

const SITE_URL = 'https://th3scr1b3.art';

const SOCIAL: Record<SocialAction, { label: string; icon: typeof Star }> = {
  rate: { label: 'Rate the game', icon: Star },
  favorite: { label: 'Add to favorites', icon: Heart },
  share: { label: 'Share with a friend', icon: Share2 },
  community: { label: 'Join the community', icon: Users },
};

export default function MonthAbout({ onClose, onBuyBundle }: { onClose: () => void; onBuyBundle?: () => void }) {
  const meta = CHAPTERS.find((c) => c.month === PLAYGAMA_MONTH) ?? CHAPTERS[0];
  const [actions, setActions] = useState<SocialAction[]>([]);
  useEffect(() => setActions(socialActions()), []);
  const links = externalLinksAllowed();
  const bundle = canBuyBundle() && !ownsBonusBundle() && onBuyBundle;

  return (
    <div className="mb-lb" role="dialog" aria-modal="true" aria-label="Who is th3scr1b3?" onClick={onClose}>
      <div className="mb-lb-card ma-card" onClick={(e) => e.stopPropagation()}>
        <div className="mb-lb-head">
          <div>
            <div className="cs-eyebrow">365 Days of Light and Dark</div>
            <h2 className="cs-display">Who is th3scr1b3?</h2>
          </div>
          <button type="button" className="btn-3d" data-size="sm" data-tone="quiet" onClick={onClose} aria-label="Close"><X size={16} /></button>
        </div>
        <div className="ma-body">
          <section>
            <h3>The artist</h3>
            <p>
              th3scr1b3 is an independent musician. A hard drive failure once wiped out hundreds of finished songs and sessions.
              Instead of giving up, th3scr1b3 made a vow: write, mix and release one new song every day for a year.
              That year became <b>365 Days of Light and Dark</b>.
            </p>
          </section>
          <section>
            <h3>The game</h3>
            <p>
              PIM (Poetry in Motion) turns those songs into a rhythm game. Your timing shapes the mix: hit cleanly and the
              song stays pristine, miss and it starts to break up. This is <b>{meta.name}</b>, chapter {PLAYGAMA_MONTH} of twelve,
              one for each month of the year.
            </p>
          </section>
          <section className="ma-help">
            <h3>How you can help</h3>
            <p>
              There's no label behind this, just one person and the people who play.
              {actions.length || bundle ? ' If you enjoy it, any of these helps:' : ' Playing and telling a friend helps more than you think.'}
            </p>
            <div className="ma-actions">
              {bundle && (
                <button type="button" className="btn-3d" data-size="sm" data-tone="gold" onClick={onBuyBundle}>
                  <Gift size={14} /> Unlock the bonus songs
                </button>
              )}
              {actions.map((a) => {
                const { label, icon: Icon } = SOCIAL[a];
                return (
                  <button key={a} type="button" className="btn-3d" data-size="sm" data-tone="quiet" onClick={() => void runSocialAction(a)}>
                    <Icon size={14} /> {label}
                  </button>
                );
              })}
              {links && (
                <a className="btn-3d" data-size="sm" data-tone="quiet" href={SITE_URL} target="_blank" rel="noopener">
                  <ExternalLink size={14} /> Hear all 365 songs and support th3scr1b3
                </a>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
