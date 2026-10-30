/**
 * Artwork tab: the bombshell cover picker (every cover for the day, locked
 * ones shown so players know what's out there) and the gen-0 rarity editions.
 */
import { useState } from 'react';
import { Check, Lock, Maximize2, Sparkles, Layers, Download } from 'lucide-react';
import { useLocation } from 'wouter';
import { RARITY_CONFIG, getSupplyCap, type Rarity } from '../../utils/rarity';
import { getBombshellCoverUrl, downloadBombshellHiResArtwork } from '../../utils/bombshellCards';
import { getArtTypeForDay, OUTFIT_STYLES } from '../../utils/artTypes';
import BombshellLightbox from './BombshellLightbox';
import type { TrackDetailData } from './useTrackDetail';

const RARITY_EDITIONS: { rarity: Rarity; label: string; desc: string; badge: string; perk: string }[] = [
  { rarity: 'common', label: 'Standard Edition', desc: 'Base studio master, daily drop mint.', badge: 'STAGE PASS', perk: 'Base Song Score + 1x Multiplier' },
  { rarity: 'uncommon', label: 'Enhanced Stem', desc: 'Expanded harmonic mix & dynamic EQ tier.', badge: 'SYNTH ACCENT', perk: '1.25x Overdrive Point Boost' },
  { rarity: 'rare', label: 'Prism Holographic', desc: 'Foil iridescent finish with extended stems.', badge: 'PRISM FOIL', perk: '1.5x Multiplier + Shiny Visual FX' },
  { rarity: 'legendary', label: 'Gold Inscription', desc: 'Gold leaf finish and the uncompressed studio master.', badge: 'GOLD FOIL', perk: '2.0x Multiplier + Golden Sparkle Aura' },
  { rarity: 'mythic', label: 'Genesis 1-of-1 Arcane', desc: 'Particle effects and the full multitrack stems.', badge: '1 OF 1 GENESIS', perk: '3.0x Ultra Multiplier + Cosmic Stems Access' },
];

interface Props {
  data: TrackDetailData;
  activeCover: string | null;
  onSelectCover: (fileName: string) => void;
  previewRarity: Rarity | null;
  onPreviewRarity: (r: Rarity | null) => void;
  onPlayCover?: (coverUrl: string) => void;
  onNavigateAway?: () => void;
}

export default function ArtworkSection({ data, activeCover, onSelectCover, previewRarity, onPreviewRarity, onPlayCover, onNavigateAway }: Props) {
  const [, setLocation] = useLocation();
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const { day, dayCovers, unlockedCovers, ownedCopies } = data;
  const allCovers = [...dayCovers.lbFiles, ...dayCovers.normalFiles];
  const total = dayCovers.totalCovers || allCovers.length;
  const pct = total > 0 ? Math.round((unlockedCovers.size / total) * 100) : 0;
  const ownedRarities = new Set(ownedCopies.map((c) => c.card.rarity));
  const art = getArtTypeForDay(day);
  const outfit = OUTFIT_STYLES[art.outfitStyle];

  const coverTile = (fileName: string, label: string) => {
    const unlocked = unlockedCovers.has(fileName);
    const active = activeCover === fileName;
    const copy = unlocked
      ? ownedCopies.find((c) => (c.coverArtwork || c.card.coverArtwork) === fileName || (c.card.coverUrl || '').includes(encodeURIComponent(fileName)))
      : undefined;
    const copyRc = copy ? RARITY_CONFIG[copy.card.rarity as Rarity] : null;
    return (
      <div
        key={fileName}
        className={`group relative rounded-xl border p-2 flex flex-col gap-2 transition-all ${
          active
            ? 'bg-emerald-500/10 border-emerald-400 ring-2 ring-emerald-400/50'
            : unlocked
              ? 'bg-white/[0.03] border-white/10 hover:border-[#FF1493]/60'
              : 'bg-black/40 border-white/5'
        }`}
      >
        <button
          type="button"
          onClick={() => setLightboxIndex(allCovers.indexOf(fileName))}
          className="relative aspect-[3/4] w-full rounded-lg overflow-hidden border border-white/10 cursor-zoom-in"
          title="Open full screen"
        >
          <img
            src={getBombshellCoverUrl(day, fileName)}
            alt={label}
            loading="lazy"
            className={`w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 ${unlocked ? '' : 'grayscale brightness-[0.35] blur-[1px]'}`}
          />
          {active && (
            <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-emerald-500 text-black font-mono text-[8px] font-black uppercase flex items-center gap-0.5">
              <Check size={8} strokeWidth={3} /> Active
            </span>
          )}
          {!unlocked && (
            <span className="absolute inset-0 flex items-center justify-center">
              <Lock size={18} className="text-white/60" />
            </span>
          )}
          <span className="absolute bottom-1.5 right-1.5 p-1 rounded bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity">
            <Maximize2 size={10} />
          </span>
        </button>
        <div className="flex items-center justify-between gap-1">
          <span className="text-[9px] font-mono text-white/60 truncate">
            {label}{copyRc && <span className="ml-1 font-bold uppercase" style={{ color: copyRc.color }}>{copyRc.label}</span>}
          </span>
          {unlocked ? (
            <button
              type="button"
              onClick={() => onSelectCover(fileName)}
              className={`px-1.5 py-0.5 rounded font-mono text-[8px] font-black uppercase cursor-pointer ${
                active ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50' : 'bg-white/10 text-white/70 hover:bg-[#FF1493]/30 hover:text-white border border-white/10'
              }`}
            >
              {active ? '✓ In use' : 'Use'}
            </button>
          ) : (
            <span className="text-[8px] font-mono uppercase text-white/30">Locked</span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8">
      {/* Bombshell covers */}
      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Sparkles size={14} className="text-[#FF1493]" />
            <h3 className="td-h">Bombshell artwork</h3>
          </div>
          {total > 0 && (
            <div className="flex items-center gap-3">
              <span className="font-mono text-[11px] font-black text-[#FF1493]">{unlockedCovers.size} / {total} unlocked</span>
              <div className="w-24 h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-[#FF1493] to-[#ff85c0]" style={{ width: `${pct}%` }} />
              </div>
            </div>
          )}
        </div>

        {total === 0 ? (
          <p className="td-muted">No bombshell covers for Day {day} yet.</p>
        ) : (
          <>
            <p className="td-muted">
              Pick the cover you want on this card. It's used in your collection and in PIM. Tap any picture to see it full screen.
              {unlockedCovers.size === 0 && ' Pull Bombshell packs to unlock covers.'}
            </p>
            {dayCovers.lbFiles.length > 0 && (
              <div className="space-y-2">
                <div className="td-label text-[#00E5FF]">Letterbox</div>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                  {dayCovers.lbFiles.map((f, i) => coverTile(f, `LB #${i + 1}`))}
                </div>
              </div>
            )}
            {dayCovers.normalFiles.length > 0 && (
              <div className="space-y-2">
                <div className="td-label text-[#FF1493]">Full frame</div>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                  {dayCovers.normalFiles.map((f, i) => coverTile(f, `VAR #${i + 1}`))}
                </div>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              {activeCover && unlockedCovers.has(activeCover) && (
                <button type="button" className="btn-3d" data-size="sm" data-tone="ghost" onClick={() => downloadBombshellHiResArtwork(day, activeCover)}>
                  <Download size={12} /> Hi-res PNG of current cover
                </button>
              )}
              {unlockedCovers.size < total && (
                <button type="button" className="btn-3d" data-size="sm" data-tone="quiet" onClick={() => { onNavigateAway?.(); setLocation('/shop'); }}>
                  Shop Bombshell packs
                </button>
              )}
            </div>
          </>
        )}
      </section>

      {/* Rarity editions */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Layers size={14} className="text-white/50" />
            <h3 className="td-h">Card editions</h3>
          </div>
          {previewRarity && (
            <button type="button" className="font-mono text-[10px] uppercase text-white/50 hover:text-white cursor-pointer" onClick={() => onPreviewRarity(null)}>
              Back to my card
            </button>
          )}
        </div>
        <p className="td-muted">Tap an edition to preview its art on the card.</p>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {RARITY_EDITIONS.map((v) => {
            const rc = RARITY_CONFIG[v.rarity];
            const selected = previewRarity === v.rarity;
            return (
              <button
                key={v.rarity}
                type="button"
                onClick={() => onPreviewRarity(selected ? null : v.rarity)}
                className={`p-3 rounded-xl text-left border transition-all cursor-pointer flex flex-col gap-1.5 ${selected ? 'bg-white/10' : 'bg-white/[0.02] hover:bg-white/5'}`}
                style={{ borderColor: selected ? rc.color : 'rgba(255,255,255,0.08)', boxShadow: selected ? `0 0 15px ${rc.color}25` : 'none' }}
              >
                <span className="text-[9px] font-mono font-black uppercase tracking-wider" style={{ color: rc.color }}>{v.badge}</span>
                <span className="text-xs font-bold text-white leading-tight">{v.label}</span>
                <span className="text-[9px] font-mono text-white/40">
                  {getSupplyCap(v.rarity, day)} max{ownedRarities.has(v.rarity) ? ' · owned' : ''}
                </span>
              </button>
            );
          })}
        </div>
        {previewRarity && (() => {
          const v = RARITY_EDITIONS.find((e) => e.rarity === previewRarity)!;
          const rc = RARITY_CONFIG[previewRarity];
          return (
            <div className="p-3.5 rounded-xl border bg-white/[0.02] text-xs" style={{ borderColor: `${rc.color}40` }}>
              <p className="font-bold text-white">{v.desc}</p>
              <p className="text-[10px] font-mono mt-0.5" style={{ color: rc.color }}>{v.perk}</p>
            </div>
          );
        })()}
        <div className="grid grid-cols-3 gap-2 font-mono text-[10px]">
          <div className="td-cell"><span className="td-label">Art spec</span><span className="text-[#00f0ff] font-bold truncate">{art.artType}</span></div>
          <div className="td-cell">
            <span className="td-label">Outfit</span>
            <span className="font-bold truncate" style={{ color: outfit.tagColor }}>{outfit.label}</span>
          </div>
          <div className="td-cell">
            <span className="td-label">Colours</span>
            <span className="font-bold flex items-center gap-1.5 truncate">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: art.colorCombo.primary, boxShadow: `0 0 6px ${art.colorCombo.primary}` }} />
              {art.colorCombo.name}
            </span>
          </div>
        </div>
      </section>

      {lightboxIndex !== null && allCovers.length > 0 && (
        <BombshellLightbox
          day={day}
          title={data.title}
          covers={allCovers}
          initialIndex={Math.max(0, lightboxIndex)}
          unlockedCovers={unlockedCovers}
          activeCoverName={activeCover || undefined}
          onSelectCover={onSelectCover}
          onClose={() => setLightboxIndex(null)}
          onPlayTrack={onPlayCover}
        />
      )}
    </div>
  );
}
