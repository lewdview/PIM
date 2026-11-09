/**
 * The player's weekly Audius contest cards, shown above the 365 collection.
 * Each one was earned by clearing that week's song (Deluxe card: its Deluxe
 * chart) and can't be earned again once its week is over.
 */
import { Link } from 'wouter';
import { ExternalLink, Sparkles } from 'lucide-react';
import type { OwnedCard } from '@/services/vaultService';
import { getAudiusCard, isAudiusCard } from '@/lib/audiusCardRegistry';

const GOLD = '#E5B800';

export default function WeeklyCardShelf({ collection }: { collection: OwnedCard[] }) {
  const cards = collection
    .filter((c) => c && c.card && isAudiusCard(c))
    .sort((a, b) => new Date(b.claimedAt || 0).getTime() - new Date(a.claimedAt || 0).getTime());
  if (cards.length === 0) return null;

  return (
    <section className="px-2 pt-4" data-testid="weekly-card-shelf">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h2 className="flex items-center gap-2 font-black uppercase text-white tracking-tight">
          <Sparkles size={16} style={{ color: GOLD }} /> Weekly Audius cards
          <span className="font-mono text-[11px] text-white/50">{cards.length}</span>
        </h2>
        <Link href="/audius" className="font-mono text-[11px] uppercase tracking-wider no-underline" style={{ color: GOLD }}>
          This week's top 5
        </Link>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {cards.map((c) => {
          const info = getAudiusCard(c.cardId);
          const deluxe = c.card.cardSet === 'bombshell' || c.cardId.startsWith('bombshell-');
          return (
            <div
              key={c.id}
              className="shrink-0 w-36 rounded-lg overflow-hidden bg-black/60"
              style={{ border: `1px solid ${deluxe ? GOLD : 'rgba(255,255,255,0.12)'}` }}
            >
              <div className="relative aspect-square">
                <img src={c.card.coverUrl} alt="" loading="lazy" className="w-full h-full object-cover" />
                {deluxe && (
                  <span className="absolute top-1.5 left-1.5 rounded px-1.5 py-0.5 font-mono text-[9px] font-black uppercase text-black" style={{ background: GOLD }}>
                    Deluxe
                  </span>
                )}
              </div>
              <div className="px-2 py-1.5">
                <div className="text-xs text-white truncate" title={c.card.title}>{c.card.title}</div>
                <div className="flex items-center justify-between gap-1 font-mono text-[9px] uppercase tracking-wider text-white/50">
                  <span className="truncate">{info?.artist || 'Audius'}</span>
                  {info?.permalink && (
                    <a href={`https://audius.co${info.permalink}`} target="_blank" rel="noopener noreferrer" aria-label="Open on Audius" className="text-white/40 hover:text-white">
                      <ExternalLink size={10} />
                    </a>
                  )}
                </div>
                {info?.weekStart && <div className="font-mono text-[9px] text-white/30 uppercase">Week of {info.weekStart}</div>}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
