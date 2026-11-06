// The chapter's card album (spec sections 6 and 9): one slot per entry, its
// three rarities, how to earn what's missing, shards and crafting, replay
// stamps, the Rare guarantee and any unopened packs. One screen, no
// scrolling: the slot grid pages when it doesn't fit.

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Hammer, Package, Play, X } from 'lucide-react';
import { cachedCatalog, type GameSong } from '@/game/api';
import { hasClearedSong, songsForMonth } from '@/game/chapterStory';
import { audioManager } from '@/game/audio';
import { PLAYGAMA_MONTH } from '@/platform/playgama/month';
import {
  albumSaveFailed, canCraft, chapterPool, completion, craftCard, dismissNotice, hiddenVariants, loadAlbum,
  retryAlbumSave, seeFresh, trackAlbumOpened, unopenedPacks,
  ALBUM_EVENT, CRAFT_COST, RARE_PITY, RARITY_GLYPH, RARITY_NAME, STAMPS_PER_PACK, type Rarity,
} from '@/platform/playgama/album';
import AlbumCard, { entryLabel } from './AlbumCard';
import PackReveal from './PackReveal';
import '@/styles/monthPanels.css';
import '@/styles/stageShell.css';
import '@/styles/campaignStory.css';
import '@/styles/monthBoard.css';
import '@/styles/monthAlbum.css';

const sfx = (v = 0.3) => audioManager.playSfx('tap_nav', v);

/** Largest card width (px) that fits `n` cards in the box, or the minimum with paging. */
function fitGrid(w: number, h: number, n: number, gap = 8) {
  const ratio = 1.4;
  for (let cw = 140; cw >= 64; cw -= 4) {
    const cols = Math.max(1, Math.floor((w + gap) / (cw + gap)));
    // Card plus its rarity pips underneath.
    const rows = Math.max(1, Math.floor((h + gap) / (cw * ratio + 17 + gap)));
    if (cols * rows >= n || cw === 64) return { cw, cols, rows, per: cols * rows };
  }
  return { cw: 64, cols: 1, rows: 1, per: 1 };
}

export default function MonthAlbum({ songs: given, onClose, onPlay, from }: {
  songs?: GameSong[];
  onClose: () => void;
  /** Chapter screen: select an entry from its slot. Left out during gameplay. */
  onPlay?: (songId: string) => void;
  from: string;
}) {
  const songs = useMemo(() => given ?? (cachedCatalog() ? songsForMonth(cachedCatalog()!, PLAYGAMA_MONTH) : []), [given]);
  const pool = useMemo(() => chapterPool(songs), [songs]);
  const [rev, setRev] = useState(0);
  const [section, setSection] = useState<'regular' | 'bonus'>('regular');
  const [page, setPage] = useState(0);
  const [sel, setSel] = useState<string | null>(null);
  const [revealing, setRevealing] = useState(false);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const gridRef = useRef<HTMLDivElement | null>(null);
  // "New" marks shown when the album opened; cleared from the save right away, kept on screen this visit.
  const [freshAtOpen] = useState(() => new Set(loadAlbum().fresh));

  useEffect(() => {
    if (pool) trackAlbumOpened(pool, from);
    const bump = () => setRev((r) => r + 1);
    window.addEventListener(ALBUM_EVENT, bump);
    return () => window.removeEventListener(ALBUM_EVENT, bump);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useLayoutEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setBox({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (revealing) return;
      if (e.key === 'Escape') { e.preventDefault(); onClose(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, revealing]);

  const state = useMemo(() => loadAlbum(), [rev]); // eslint-disable-line react-hooks/exhaustive-deps
  const hidden = useMemo(() => hiddenVariants(state), [state]);
  useEffect(() => {
    // Seen now; unopened-pack cards keep their mark until revealed.
    const visible = state.fresh.filter((k) => !hidden.has(k));
    if (visible.length) seeFresh(visible);
  }, [state, hidden]);

  if (!pool || !songs.length) return null;
  const regularCount = pool.regular.length;
  const byId = new Map(songs.map((s) => [s.id, s]));
  const has = (id: string, r: number) => (state.got[id]?.[r] ?? 0) > 0 && !hidden.has(`${id}:${r}`);
  const comp = completion(state, pool, hidden);
  const listened = pool.regular.every((id) => hasClearedSong(byId.get(id)));
  const ids = section === 'regular' ? pool.regular : pool.bonus;
  const fit = fitGrid(box.w, box.h, ids.length);
  const pages = Math.max(1, Math.ceil(ids.length / fit.per));
  const pg = Math.min(page, pages - 1);
  const shownIds = ids.slice(pg * fit.per, pg * fit.per + fit.per);
  const selId = sel && ids.includes(sel) ? sel : null;
  const unopened = unopenedPacks(state).length;
  const untilRare = RARE_PITY - state.sinceRare;

  const best = (id: string): Rarity => (has(id, 2) ? 2 : has(id, 1) ? 1 : 0);
  const ownsAnyVisible = (id: string) => [0, 1, 2].some((r) => has(id, r));

  const detail = (() => {
    if (!selId) return null;
    const song = byId.get(selId);
    const bonusLocked = pool.bonus.includes(selId) && !pool.bonusOpen.includes(selId);
    const finishedPack = state.receipts[`ff:${selId}`] !== undefined;
    const platPack = state.receipts[`pl:${selId}`] !== undefined;
    const route = bonusLocked
      ? 'Unlock this bonus entry to add its cards to packs.'
      : !finishedPack
        ? `Finish ${song?.title ?? 'this entry'} for a pack with its Common card.`
        : `Its other cards come from any pack${platPack ? '' : ', including the pack for its first Standard platinum'}, or craft them with shards.`;
    return (
      <aside className="al-detail" aria-label={`${song?.title} card`}>
        <div className="al-detail-top">
          <AlbumCard song={song} num={entryLabel(songs, regularCount, selId)} rarity={best(selId)} missing={!ownsAnyVisible(selId)} className="al-card--detail" />
          <div className="al-detail-text">
            <b>{song?.title}</b>
            <small>Entry {entryLabel(songs, regularCount, selId)}{song ? ` · Day ${song.day}` : ''}</small>
            <ul className="al-variants">
              {([0, 1, 2] as Rarity[]).map((r) => {
                const n = state.got[selId]?.[r] ?? 0;
                const owned = has(selId, r);
                const check = canCraft(state, selId, r, pool);
                return (
                  <li key={r} data-owned={owned || undefined}>
                    <span className="al-v-name" data-r={r}>{RARITY_GLYPH[r]} {RARITY_NAME[r]}</span>
                    {owned ? (
                      <span className="al-v-state">Owned{n > 1 ? ` · ${n - 1} extra became shards` : ''}</span>
                    ) : hidden.has(`${selId}:${r}`) ? (
                      <span className="al-v-state">In an unopened pack</span>
                    ) : (
                      <button type="button" className="btn-3d" data-size="sm" data-tone={check === 'ok' ? 'gold' : 'quiet'} disabled={check !== 'ok'}
                        onClick={() => { sfx(0.4); craftCard(selId, r, pool); }}
                        title={check === 'locked' ? 'Unlock the entry first' : check === 'shards' ? `Needs ${CRAFT_COST[r]} shards` : undefined}>
                        <Hammer size={13} /> Craft · {CRAFT_COST[r]}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
        <p className="al-route">{route}</p>
        {onPlay && !bonusLocked && (
          <button type="button" className="btn-3d" data-size="sm" data-tone="acid" onClick={() => { sfx(); onPlay(selId); }}>
            <Play size={14} fill="currentColor" /> Go to entry
          </button>
        )}
      </aside>
    );
  })();

  return (
    <div className="mb-lb al-wrap" role="dialog" aria-modal="true" aria-label="Chapter album" onClick={onClose}>
      <div className="mb-lb-card al-panel" onClick={(e) => e.stopPropagation()}>
        <div className="mb-lb-head al-head">
          <div>
            <div className="cs-eyebrow">Chapter album</div>
            <h2 className="cs-display">Cards</h2>
          </div>
          <div className="al-stats" aria-label="Album progress">
            <span><b>{comp.regularOwned}/{regularCount}</b> entries</span>
            <span><b>{comp.regularVariants}/{regularCount * 3}</b> variants</span>
            {pool.bonus.length > 0 && <span><b>{comp.bonusOwned}/{pool.bonus.length}</b> bonus</span>}
            <span className="al-titles">
              {listened && <em title="Finished every regular entry">Chapter Listener</em>}
              {comp.collector && <em title="Own a card of every regular entry">Chapter Collector</em>}
              {comp.complete && <em title="Own all three rarities of every regular entry">Complete Collection</em>}
            </span>
          </div>
          <button type="button" className="btn-3d" data-size="sm" data-tone="quiet" onClick={onClose} aria-label="Close"><X size={16} /></button>
        </div>

        {!state.noticeSeen && (
          <div className="al-notice" role="note">
            <span>Packs start now. Finish any entry, even one you finished before, to earn its first pack.</span>
            <button type="button" className="btn-3d" data-size="sm" data-tone="quiet" onClick={() => dismissNotice()}>Got it</button>
          </div>
        )}
        {albumSaveFailed() && (
          <div className="al-notice" role="alert" data-tone="warn">
            <span>Progress could not be saved.</span>
            <button type="button" className="btn-3d" data-size="sm" data-tone="quiet" onClick={() => { retryAlbumSave(); setRev((r) => r + 1); }}>Retry</button>
          </div>
        )}

        <div className="al-body" data-detail={selId ? '' : undefined}>
          <div className="al-slots">
            <div className="al-tabs-row">
              {pool.bonus.length > 0 && (
                <div className="mo-tabs al-tabs" role="tablist">
                  <button type="button" role="tab" aria-selected={section === 'regular'} onClick={() => { sfx(0.15); setSection('regular'); setPage(0); }}>Tracks</button>
                  <button type="button" role="tab" aria-selected={section === 'bonus'} onClick={() => { sfx(0.15); setSection('bonus'); setPage(0); }}>Bonus</button>
                </div>
              )}
              {pages > 1 && (
                <div className="al-pager">
                  <button type="button" className="mb-week-arrow" aria-label="Previous page" disabled={pg === 0} onClick={() => setPage(pg - 1)}><ChevronLeft size={18} /></button>
                  <span>{pg + 1}/{pages}</span>
                  <button type="button" className="mb-week-arrow" aria-label="Next page" disabled={pg >= pages - 1} onClick={() => setPage(pg + 1)}><ChevronRight size={18} /></button>
                </div>
              )}
            </div>
            <div className="al-grid" ref={gridRef}>
              <div className="al-grid-in" style={{ gridTemplateColumns: `repeat(${fit.cols}, ${fit.cw}px)`, ['--cw' as string]: `${fit.cw}px` }}>
                {box.w > 0 && shownIds.map((id) => {
                  const owned = ownsAnyVisible(id);
                  const locked = pool.bonus.includes(id) && !pool.bonusOpen.includes(id);
                  return (
                    <button key={id} type="button" className="al-slot" aria-pressed={selId === id} data-locked={locked || undefined}
                      onClick={() => { sfx(0.15); setSel(selId === id ? null : id); }}>
                      <AlbumCard song={byId.get(id)} num={entryLabel(songs, regularCount, id)} rarity={best(id)} missing={!owned}
                        isNew={[0, 1, 2].some((r) => freshAtOpen.has(`${id}:${r}`) && has(id, r))} />
                      <span className="al-pips" aria-label={`${[0, 1, 2].filter((r) => has(id, r)).length} of 3 rarities`}>
                        {([0, 1, 2] as Rarity[]).map((r) => <i key={r} data-r={r} data-on={has(id, r) || undefined}>{RARITY_GLYPH[r]}</i>)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          {detail}
        </div>

        <footer className="al-foot">
          <span className="al-counter" title="Duplicates turn into shards: Common 1, Uncommon 3, Rare 9. Craft a missing card: Common 6, Uncommon 12, Rare 30.">
            <b>{state.shards}</b> shards
          </span>
          <span className="al-counter" title="Each replay of a finished entry earns a stamp; three stamps make a pack.">
            <b>{state.stamps}/{STAMPS_PER_PACK}</b> replay stamps
          </span>
          <span className="al-counter" title="No more than 10 packs in a row without a Rare.">
            Rare within <b>{untilRare}</b> pack{untilRare === 1 ? '' : 's'}
          </span>
          <span className="al-save cs-muted">Saved in this browser. Clearing site data can remove it. Chapter cards don't sync to the main PIM vault.</span>
          {unopened > 0 && (
            <button type="button" className="btn-3d" data-size="sm" data-tone="gold" onClick={() => { sfx(); setRevealing(true); }}>
              <Package size={14} /> Open pack{unopened > 1 ? `s (${unopened})` : ''}
            </button>
          )}
        </footer>
      </div>
      {revealing && <PackReveal songs={songs} regularCount={regularCount} from="album" onClose={() => { setRevealing(false); setRev((r) => r + 1); }} />}
    </div>
  );
}
