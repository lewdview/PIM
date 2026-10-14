/**
 * DressUpPage.tsx — Daily Waifu Dress-Up.
 *
 * Recreate each day's waifu from the 365 outfit/prompt matrix (utils/artTypes.ts):
 * dress the doll in the day's material, colour it from the day's palette, set the
 * day's scene and find the signature piece. Defaults to today; any of the 365
 * days can be picked. Best scores and in-progress outfits are kept per day.
 */

import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useRoute } from 'wouter';
import { ChevronLeft, ChevronRight, Calendar, Copy, Check, Eye, RotateCcw, Shuffle, Sparkles, Star } from 'lucide-react';
import WaifuFigure from '../components/dressup/WaifuFigure';
import {
  ALL_SLOTS, GARMENT_SLOTS, HAIR_COLORS, MATERIAL_KEYS, SCENES, WARDROBE,
  defaultOutfit, getDayBrief, scoreOutfit, type GarmentSlot, type Outfit, type Slot,
} from '../game/dressUp';
import { OUTFIT_STYLES, generateArtPromptForDay, getSongMetaForDay } from '../utils/artTypes';
import { getCurrentDay, formatDate } from '../utils/dayCalc';
import { getBombshellDayCovers, getBombshellCoverUrl } from '../utils/bombshellCards';
import cardCatalog from '../data/card_catalog.json';

const SLOT_LABELS: Record<Slot, string> = {
  hair: 'Hair', top: 'Top', bottom: 'Bottom', legwear: 'Legs', shoes: 'Shoes', accessory: 'Extra',
};

const STORE_KEY = 'pim_dressup_v1';

interface SavedState {
  best: Record<number, number>;
  outfits: Record<number, Outfit>;
}

function loadSaved(): SavedState {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return JSON.parse(raw) as SavedState;
  } catch { /* storage unavailable */ }
  return { best: {}, outfits: {} };
}

function persist(state: SavedState) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
  } catch { /* storage unavailable */ }
}

function clampDay(n: number): number {
  return Math.max(1, Math.min(365, Math.round(Number.isFinite(n) ? n : 1)));
}

/** Reference art for the day: first bombshell cover, falling back to the song cover. */
function referenceImages(day: number): string[] {
  const urls: string[] = [];
  const covers = getBombshellDayCovers(day);
  const first = covers.normalFiles[0] ?? covers.lbFiles[0];
  if (first) urls.push(getBombshellCoverUrl(day, first));
  const card = (cardCatalog as { day: number; coverUrl?: string }[]).find((c) => c.day === day);
  if (card?.coverUrl) urls.push(card.coverUrl);
  return urls;
}

function ReferenceArt({ day }: { day: number }) {
  const urls = useMemo(() => referenceImages(day), [day]);
  const [idx, setIdx] = useState(0);
  useEffect(() => setIdx(0), [day]);
  if (idx >= urls.length) {
    return <div className="aspect-square w-full grid place-items-center text-[10px] font-mono text-white/40 uppercase">No reference art</div>;
  }
  return (
    <img
      src={urls[idx]}
      onError={() => setIdx((i) => i + 1)}
      alt={`Day ${day} reference art`}
      className="aspect-square w-full object-cover"
      loading="lazy"
    />
  );
}

export default function DressUpPage() {
  const [, params] = useRoute<{ day: string }>('/dress-up/:day');
  const [, setLocation] = useLocation();
  const today = getCurrentDay();
  const day = clampDay(params?.day ? parseInt(params.day.replace('day-', ''), 10) : today);

  const brief = useMemo(() => getDayBrief(day), [day]);
  const song = useMemo(() => getSongMetaForDay(day), [day]);
  const prompt = useMemo(() => generateArtPromptForDay(day), [day]);

  const [saved, setSaved] = useState<SavedState>(loadSaved);
  const [outfit, setOutfit] = useState<Outfit>(() => saved.outfits[day] ?? defaultOutfit());
  const [slot, setSlot] = useState<Slot>('top');
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);

  // Load the saved outfit for the newly picked day.
  useEffect(() => {
    setOutfit(loadSaved().outfits[day] ?? defaultOutfit());
    setRevealed(false);
  }, [day]);

  const score = useMemo(() => scoreOutfit(outfit, brief), [outfit, brief]);
  const best = saved.best[day] ?? 0;

  const update = (next: Outfit) => {
    setOutfit(next);
    const s = scoreOutfit(next, brief);
    setSaved((prev) => {
      const state: SavedState = {
        outfits: { ...prev.outfits, [day]: next },
        // Revealing the answer doesn't count toward a best score.
        best: revealed ? prev.best : { ...prev.best, [day]: Math.max(prev.best[day] ?? 0, s.total) },
      };
      persist(state);
      return state;
    });
  };

  const goTo = (d: number) => setLocation(`/dress-up/${clampDay(d)}`);

  const isGarment = (s: Slot): s is GarmentSlot => (GARMENT_SLOTS as Slot[]).includes(s);
  const currentItem = slot === 'hair' ? outfit.hair.item : slot === 'accessory' ? outfit.accessory.item : outfit[slot].item;

  const chooseItem = (id: string) => {
    if (slot === 'hair') update({ ...outfit, hair: { ...outfit.hair, item: id } });
    else if (slot === 'accessory') update({ ...outfit, accessory: { item: id } });
    else update({ ...outfit, [slot]: { ...outfit[slot], item: id } });
  };

  const chooseColor = (color: string) => {
    if (slot === 'hair') update({ ...outfit, hair: { ...outfit.hair, color } });
    else if (isGarment(slot)) update({ ...outfit, [slot]: { ...outfit[slot], color } });
  };

  const chooseMaterial = (material: (typeof MATERIAL_KEYS)[number]) => {
    if (isGarment(slot)) update({ ...outfit, [slot]: { ...outfit[slot], material } });
  };

  const reveal = () => {
    setRevealed(true);
    setOutfit(brief.target);
  };

  const randomize = () => {
    const r = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
    const garment = (s: GarmentSlot) => ({ item: r(WARDROBE[s]).id, material: r(MATERIAL_KEYS), color: r(brief.swatches) });
    update({
      hair: { item: r(WARDROBE.hair).id, color: r(HAIR_COLORS) },
      top: garment('top'), bottom: garment('bottom'), legwear: garment('legwear'), shoes: garment('shoes'),
      accessory: { item: r(WARDROBE.accessory).id },
      scene: r(SCENES).category,
    });
  };

  const copyPrompt = () => {
    navigator.clipboard?.writeText(prompt).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const material = OUTFIT_STYLES[brief.material];
  const sceneLabel = SCENES.find((s) => s.category === brief.scene)?.label ?? brief.scene;
  const activeColor = slot === 'hair' ? outfit.hair.color : isGarment(slot) ? outfit[slot].color : null;
  const colorChoices = slot === 'hair' ? HAIR_COLORS : brief.swatches;

  return (
    <div className="flex-1 w-full min-h-screen bg-[#07040c] text-white pb-24!">
      {/* Header + day picker */}
      <section className="border-b border-white/10 bg-[#0d0716] px-4! sm:px-6! pt-6! pb-5!">
        <div className="max-w-6xl mx-auto! flex flex-col lg:flex-row lg:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1!">
              <span className="w-2 h-2 rounded-full bg-[#ff7eb6] animate-pulse" />
              <span className="font-mono text-[10px] text-[#ff7eb6] uppercase font-bold tracking-[0.3em]">
                Daily Waifu Dress-Up
              </span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-black uppercase tracking-tight" style={{ fontFamily: '"Impact", "Arial Black", sans-serif' }}>
              Day {day} · {song.title}
            </h1>
            <p className="font-mono text-xs text-white/60 uppercase tracking-widest mt-1!">
              {formatDate(day)} · {brief.art.artType}
            </p>
          </div>

          <div className="flex flex-col gap-2 w-full lg:w-[380px]">
            <div className="flex items-center gap-2">
              <button onClick={() => goTo(day - 1)} disabled={day <= 1} aria-label="Previous day"
                className="p-2! border border-white/20 hover:border-[#ff7eb6] disabled:opacity-30">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <input
                type="number" min={1} max={365} value={day}
                onChange={(e) => goTo(parseInt(e.target.value, 10))}
                className="w-20 bg-black/40 border border-white/20 px-2! py-1.5! font-mono text-sm text-center"
                aria-label="Day number"
              />
              <button onClick={() => goTo(day + 1)} disabled={day >= 365} aria-label="Next day"
                className="p-2! border border-white/20 hover:border-[#ff7eb6] disabled:opacity-30">
                <ChevronRight className="w-4 h-4" />
              </button>
              <button onClick={() => goTo(today)} disabled={day === today}
                className="ml-auto! flex items-center gap-1.5 px-3! py-1.5! border border-[#ff7eb6] text-[#ff7eb6] font-mono text-[11px] uppercase font-bold disabled:opacity-40">
                <Calendar className="w-3.5 h-3.5" /> Today
              </button>
            </div>
            <input
              type="range" min={1} max={365} value={day}
              onChange={(e) => goTo(parseInt(e.target.value, 10))}
              className="w-full accent-[#ff7eb6]"
              aria-label="Pick a day"
            />
          </div>
        </div>
      </section>

      <div className="max-w-6xl mx-auto! px-4! sm:px-6! pt-6! grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)_340px]">
        {/* Brief */}
        <aside className="flex flex-col gap-4 order-2 lg:order-1">
          <div className="border border-white/10 bg-white/[0.03]">
            <ReferenceArt day={day} />
            <div className="p-3! font-mono text-[10px] text-white/50 uppercase tracking-widest">Day {day} reference</div>
          </div>

          <div className="border border-white/10 bg-white/[0.03] p-4! flex flex-col gap-3">
            <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-white/50">Today's look</div>
            <div>
              <div className="text-xs text-white/50">Material</div>
              <div className="font-bold" style={{ color: material.tagColor }}>{material.label}</div>
              <div className="text-[11px] text-white/50 leading-snug">{material.description}</div>
            </div>
            <div>
              <div className="text-xs text-white/50 mb-1!">Palette · {brief.art.colorCombo.name}</div>
              <div className="flex gap-2">
                {brief.palette.map((c) => <span key={c} className="w-8 h-8 border border-white/30" style={{ background: c }} title={c} />)}
              </div>
            </div>
            <div>
              <div className="text-xs text-white/50">Scene</div>
              <div className="font-bold">{sceneLabel}</div>
            </div>
            <div>
              <div className="text-xs text-white/50">Signature piece</div>
              <div className="font-bold">{brief.signature.item.label} <span className="text-white/40 font-normal">({SLOT_LABELS[brief.signature.slot]})</span></div>
            </div>
            <button onClick={() => setShowPrompt((v) => !v)} className="text-left font-mono text-[11px] uppercase text-[#7dd3fc] hover:underline">
              {showPrompt ? 'Hide' : 'Show'} day prompt
            </button>
            {showPrompt && (
              <div className="flex flex-col gap-2">
                <pre className="whitespace-pre-wrap text-[11px] leading-snug text-white/70 bg-black/40 p-2! max-h-64 overflow-auto">{prompt}</pre>
                <button onClick={copyPrompt} className="self-start flex items-center gap-1.5 px-2! py-1! border border-white/20 font-mono text-[10px] uppercase">
                  {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />} {copied ? 'Copied' : 'Copy prompt'}
                </button>
              </div>
            )}
          </div>
        </aside>

        {/* Stage */}
        <section className="order-1 lg:order-2 flex flex-col items-center gap-3">
          <div className="w-full max-w-[240px] sm:max-w-[340px] border-2 border-white/15 shadow-[0_0_40px_rgba(255,126,182,0.15)]">
            <WaifuFigure outfit={outfit} className="block w-full h-auto" />
          </div>
          <div className="w-full max-w-[340px] border border-white/10 bg-white/[0.03] p-3!">
            <div className="flex items-center justify-between">
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-black" style={{ color: score.grade === 'S' ? '#fde68a' : '#ff7eb6' }}>{score.grade}</span>
                <span className="font-mono text-sm">{score.total}/100</span>
              </div>
              <div className="flex items-center gap-1 font-mono text-[11px] text-white/60">
                <Star className="w-3.5 h-3.5 text-[#fde68a]" /> Best {best}
              </div>
            </div>
            <div className="grid grid-cols-4 gap-1 mt-2! font-mono text-[10px] text-white/60 uppercase text-center">
              <div>Material<br /><span className="text-white">{score.material}/40</span></div>
              <div>Palette<br /><span className="text-white">{score.palette}/30</span></div>
              <div>Scene<br /><span className="text-white">{score.scene}/15</span></div>
              <div>Signature<br /><span className="text-white">{score.signature}/15</span></div>
            </div>
            {revealed ? (
              <p className="mt-2! text-[11px] text-[#7dd3fc]">Showing the full look. Change anything to keep playing; revealed looks don't count toward your best.</p>
            ) : score.notes.length > 0 && (
              <ul className="mt-2! text-[11px] text-white/60 list-disc pl-4!">
                {score.notes.slice(0, 3).map((n) => <li key={n}>{n}</li>)}
              </ul>
            )}
            {score.grade === 'S' && !revealed && (
              <p className="mt-2! text-[12px] font-bold text-[#fde68a] flex items-center gap-1"><Sparkles className="w-4 h-4" /> Day {day} waifu recreated!</p>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={reveal} className="flex items-center gap-1.5 px-3! py-1.5! border border-white/20 font-mono text-[11px] uppercase hover:border-[#7dd3fc]">
              <Eye className="w-3.5 h-3.5" /> Reveal look
            </button>
            <button onClick={randomize} className="flex items-center gap-1.5 px-3! py-1.5! border border-white/20 font-mono text-[11px] uppercase hover:border-[#ff7eb6]">
              <Shuffle className="w-3.5 h-3.5" /> Random
            </button>
            <button onClick={() => update(defaultOutfit())} className="flex items-center gap-1.5 px-3! py-1.5! border border-white/20 font-mono text-[11px] uppercase hover:border-white">
              <RotateCcw className="w-3.5 h-3.5" /> Reset
            </button>
          </div>
        </section>

        {/* Wardrobe */}
        <aside className="order-3 flex flex-col gap-4">
          <div className="grid grid-cols-6 border border-white/10">
            {ALL_SLOTS.map((s) => (
              <button key={s} onClick={() => setSlot(s)}
                className={`py-2! font-mono text-[10px] uppercase font-bold ${slot === s ? 'bg-[#ff7eb6] text-black' : 'text-white/70 hover:bg-white/5'}`}>
                {SLOT_LABELS[s]}
              </button>
            ))}
          </div>

          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-white/50 mb-2!">Piece</div>
            <div className="grid grid-cols-2 gap-2">
              {WARDROBE[slot].map((item) => (
                <button key={item.id} onClick={() => chooseItem(item.id)}
                  className={`px-2! py-2! text-left text-xs border ${currentItem === item.id ? 'border-[#ff7eb6] bg-[#ff7eb6]/10' : 'border-white/15 hover:border-white/40'}`}>
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {activeColor && (
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-white/50 mb-2!">Colour</div>
              <div className="flex flex-wrap gap-2">
                {colorChoices.map((c) => (
                  <button key={c} onClick={() => chooseColor(c)} aria-label={`Colour ${c}`}
                    className={`w-8 h-8 border-2 ${activeColor.toLowerCase() === c.toLowerCase() ? 'border-white scale-110' : 'border-white/20'}`}
                    style={{ background: c }} />
                ))}
              </div>
            </div>
          )}

          {isGarment(slot) && (
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-white/50 mb-2!">Material</div>
              <div className="grid grid-cols-2 gap-1.5">
                {MATERIAL_KEYS.map((m) => (
                  <button key={m} onClick={() => chooseMaterial(m)}
                    className={`px-2! py-1.5! text-left text-[11px] border flex items-center gap-1.5 ${outfit[slot].material === m ? 'border-white bg-white/10' : 'border-white/15 hover:border-white/40'}`}>
                    <span className="w-2 h-2 shrink-0" style={{ background: OUTFIT_STYLES[m].tagColor }} />
                    {OUTFIT_STYLES[m].label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-white/50 mb-2!">Scene</div>
            <div className="grid grid-cols-2 gap-1.5">
              {SCENES.map((s) => (
                <button key={s.category} onClick={() => update({ ...outfit, scene: s.category })}
                  className={`px-2! py-1.5! text-left text-[11px] border flex items-center gap-1.5 ${outfit.scene === s.category ? 'border-white bg-white/10' : 'border-white/15 hover:border-white/40'}`}>
                  <span className="w-3 h-3 shrink-0 border border-white/20" style={{ background: `linear-gradient(${s.colors[0]}, ${s.colors[2]})` }} />
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <Link href="/365" className="font-mono text-[10px] uppercase text-white/40 hover:text-white">Browse the 365 archive →</Link>
        </aside>
      </div>
    </div>
  );
}
