/**
 * The player's weekly Audius contest cards, shown above the 365 collection.
 * Each one was earned by clearing that week's song (Deluxe card: its Deluxe
 * chart) and can't be earned again once its week is over.
 *
 * They render with the same Card component as every other PIM card; the
 * th3scr1b3 x Audius seal and labels come from Card itself.
 */
import { useState } from 'react';
import { Link } from 'wouter';
import { ExternalLink, Sparkles } from 'lucide-react';
import Card from '@/components/Card';
import type { OwnedCard } from '@/services/vaultService';
import { getAudiusCard, isAudiusCard } from '@/lib/audiusCardRegistry';
import AudiusClaimReveal from './AudiusClaimReveal';

const GOLD = '#E5B800';

export default function WeeklyCardShelf({ collection }: { collection: OwnedCard[] }) {
  const [reveal, setReveal] = useState<string | null>(null);
  const cards = collection
    .filter((c) => c && c.card && isAudiusCard(c))
    .sort((a, b) => new Date(b.claimedAt || 0).getTime() - new Date(a.claimedAt || 0).getTime());
  if (cards.length === 0) return null;

  return (
    <section className="px-2 pt-4" data-testid="weekly-card-shelf">
      <div className="flex items-center justify-between gap-2 mb-1">
        <h2 className="flex items-center gap-2 font-black uppercase text-white tracking-tight">
          <Sparkles size={16} style={{ color: GOLD }} /> th3scr1b3 × Audius cards
          <span className="font-mono text-[11px] text-white/50">{cards.length}</span>
        </h2>
        <Link href="/audius" className="font-mono text-[11px] uppercase tracking-wider no-underline" style={{ color: GOLD }}>
          This week's top 5
        </Link>
      </div>
      <p className="font-mono text-[10px] uppercase tracking-wider text-white/40 mb-3">Earned on the Weekly Top 5. Each card was only earnable in its week.</p>
      <div className="collection-grid grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 py-2">
        {cards.map((c, i) => {
          const info = getAudiusCard(c.cardId);
          return (
            <div key={c.id} className="relative group flex flex-col gap-1.5">
              <div className="relative z-20 transition-transform duration-300 group-hover:-translate-y-2 group-hover:-translate-x-2">
                <Card card={c.card} delay={i} showAudio />
              </div>
              <div className="flex items-center justify-between gap-2 px-0.5 font-mono text-[9px] uppercase tracking-wider text-white/50">
                <span className="truncate" title={info?.artist}>{info?.artist || 'Audius'}</span>
                <span className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setReveal(c.cardId)}
                    className="uppercase text-white/50 hover:text-white cursor-pointer"
                    title="Replay the reveal"
                  >
                    ▶ Reveal
                  </button>
                  {info?.permalink && (
                    <a href={`https://audius.co${info.permalink}`} target="_blank" rel="noopener noreferrer" aria-label="Open on Audius" className="text-white/40 hover:text-white">
                      <ExternalLink size={10} />
                    </a>
                  )}
                </span>
              </div>
            </div>
          );
        })}
      </div>
      {reveal && (
        <AudiusClaimReveal
          cardId={reveal}
          onClose={() => setReveal(null)}
          onViewCollection={() => setReveal(null)}
        />
      )}
    </section>
  );
}
