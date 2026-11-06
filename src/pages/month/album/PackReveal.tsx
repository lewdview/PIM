// Pack reveal (spec section 6): the pack opens and its three cards flip one
// after another, then a summary shows all three with New or Duplicate. The
// cards were saved when the pack was earned; this only shows them, so closing
// the tab mid-reveal brings the same pack back unopened. Skip jumps straight
// to the summary. Reduced motion goes straight there too.
//
// Pacing: about 6 s for the player's first pack ever, about 3.5 s after that.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, ChevronRight, FastForward, Package, X } from 'lucide-react';
import type { GameSong } from '@/game/api';
import { audioManager } from '@/game/audio';
import {
  loadAlbum, openPack, trackRevealFinished, unopenedPacks, ALBUM_EVENT, PACK_SOURCE_LABEL, RARE_PITY, RARITY_NAME,
  type Pack,
} from '@/platform/playgama/album';
import AlbumCard, { entryLabel } from './AlbumCard';
import '@/styles/stageShell.css';
import '@/styles/campaignStory.css';
import '@/styles/monthBoard.css';
import '@/styles/monthAlbum.css';

const reducedMotion = () => {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
};

type Phase = 'sealed' | 'flip' | 'summary';

export default function PackReveal({ songs, regularCount, onClose, primary, onAlbum, from }: {
  songs: GameSong[];
  regularCount: number;
  onClose: () => void;
  /** Keeps the way on prominent in the summary, e.g. Next entry on the results screen. */
  primary?: { label: string; onClick: () => void };
  onAlbum?: () => void;
  /** Where the reveal was opened, for telemetry: results, chapter, album. */
  from: string;
}) {
  const [pack, setPack] = useState<Pack | null>(() => unopenedPacks()[0] ?? null);
  // Re-render when packs change elsewhere; the count itself is read live below.
  const [, setLeft] = useState(() => unopenedPacks().length);
  const [phase, setPhase] = useState<Phase>('sealed');
  const [shown, setShown] = useState(0);
  const startedAt = useRef(performance.now());
  const skipped = useRef(false);
  // The very first pack gets the longer ceremony.
  const first = useMemo(() => !loadAlbum().packs.some((p) => p.opened), []);
  const byId = useMemo(() => new Map(songs.map((s) => [s.id, s])), [songs]);

  const finish = useCallback((how: 'skipped' | 'animated') => {
    if (!pack) return;
    setPhase('summary');
    setShown(3);
    openPack(pack.id);
    trackRevealFinished(pack.id, how, performance.now() - startedAt.current, from !== 'results');
  }, [pack, from]);

  // The timeline: sealed pack, then one card at a time.
  useEffect(() => {
    if (!pack || phase === 'summary') return;
    if (reducedMotion()) { finish('animated'); return; }
    const sealMs = first ? 1300 : 500;
    const cardMs = first ? 1500 : 950;
    const timers: ReturnType<typeof setTimeout>[] = [];
    timers.push(setTimeout(() => { setPhase('flip'); audioManager.playSfx('open_chest', 0.5); }, sealMs));
    for (let i = 0; i < 3; i++) {
      timers.push(setTimeout(() => {
        setShown(i + 1);
        const r = pack.cards[i].r;
        audioManager.playSfx(r === 2 ? 'platinum_get' : r === 1 ? 'perfect' : 'tap_perfect', r === 2 ? 0.6 : 0.4);
      }, sealMs + 250 + i * cardMs));
    }
    timers.push(setTimeout(() => { if (!skipped.current) finish('animated'); }, sealMs + 250 + 3 * cardMs));
    return () => timers.forEach(clearTimeout);
  }, [pack, phase === 'summary', first, finish]); // eslint-disable-line react-hooks/exhaustive-deps

  const skip = () => {
    skipped.current = true;
    finish('skipped');
  };

  const nextPack = () => {
    const rest = unopenedPacks();
    setLeft(rest.length);
    if (!rest.length) { onClose(); return; }
    skipped.current = false;
    startedAt.current = performance.now();
    setShown(0);
    setPhase('sealed');
    setPack(rest[0]);
  };

  useEffect(() => {
    const sync = () => setLeft(unopenedPacks().length);
    window.addEventListener(ALBUM_EVENT, sync);
    return () => window.removeEventListener(ALBUM_EVENT, sync);
  }, []);

  // Keys: Enter/Space skip or continue, Escape closes once the cards are out.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && phase === 'summary') { e.preventDefault(); onClose(); }
      else if ((e.key === 'Enter' || e.key === ' ') && phase !== 'summary') { e.preventDefault(); skip(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!pack) return null;
  const state = loadAlbum();
  // Read live: the open above may have happened before the album listener was attached.
  const waiting = unopenedPacks().length;
  const more = phase === 'summary' ? waiting : waiting - 1;
  const untilRare = RARE_PITY - state.sinceRare;
  return (
    <div className="mb-lb al-reveal" role="dialog" aria-modal="true" aria-label="Pack opening" data-first={first || undefined}
      onClick={(e) => { e.stopPropagation(); if (phase !== 'summary') skip(); }}>
      <div className="al-reveal-card" onClick={(e) => e.stopPropagation()}>
        <div className="al-reveal-head">
          <div>
            <div className="cs-eyebrow">{PACK_SOURCE_LABEL[pack.source]}{pack.songId && byId.get(pack.songId) ? ` · ${byId.get(pack.songId)!.title}` : ''}</div>
            <h2 className="cs-display">{phase === 'summary' ? 'Your cards' : 'Opening pack'}</h2>
          </div>
          {phase === 'summary' ? (
            <button type="button" className="btn-3d" data-size="sm" data-tone="quiet" onClick={onClose} aria-label="Close"><X size={16} /></button>
          ) : (
            <button type="button" className="btn-3d" data-size="sm" data-tone="quiet" onClick={skip}><FastForward size={14} /> Skip</button>
          )}
        </div>

        <div className="al-reveal-stage" data-phase={phase}>
          {phase === 'sealed' ? (
            <span className="al-pack" aria-hidden="true"><Package size={56} /><b>3 cards</b></span>
          ) : (
            <div className="al-reveal-row">
              {pack.cards.map((c, i) => (
                <AlbumCard
                  key={i}
                  song={byId.get(c.songId)}
                  num={entryLabel(songs, regularCount, c.songId)}
                  rarity={c.r}
                  faceDown={i >= shown}
                  isNew={!c.dup}
                  className="al-card--reveal"
                  tag={i < shown ? (c.dup ? `Duplicate · +${c.shards} shard${c.shards === 1 ? '' : 's'}` : `New ${RARITY_NAME[c.r]}`) : undefined}
                />
              ))}
            </div>
          )}
        </div>

        <div className="al-reveal-foot" data-hidden={phase !== 'summary' || undefined}>
          <p className="al-reveal-note">
            {pack.cards.some((c) => c.why === 'pity') ? 'Rare guarantee: 10 packs without a Rare always end in one. ' : ''}
            {pack.cards.some((c) => c.why === 'first_pack') ? 'First pack bonus: a guaranteed Uncommon. ' : ''}
            Next Rare within {untilRare} pack{untilRare === 1 ? "" : "s"} at most · {state.shards} shards
          </p>
          <div className="al-reveal-actions">
            {primary && (
              <button type="button" className="btn-3d" data-size="sm" data-tone="acid" onClick={primary.onClick}>
                <ChevronRight size={16} /> {primary.label}
              </button>
            )}
            {more > 0 && (
              <button type="button" className="btn-3d" data-size="sm" data-tone="gold" onClick={nextPack}>
                <Package size={14} /> Open next pack ({more})
              </button>
            )}
            {onAlbum && (
              <button type="button" className="btn-3d" data-size="sm" data-tone="quiet" onClick={onAlbum}>
                <BookOpen size={14} /> Album
              </button>
            )}
            {!primary && (
              <button type="button" className="btn-3d" data-size="sm" data-tone="quiet" onClick={onClose}>Done</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
