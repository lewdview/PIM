// VaultCollectionPage — dedicated route for the Vault Finds monetary collection.
// "/vault/finds" — info, locked odds, the 10 launch cards, art previews, and an
// interactive pull simulator styled like the pack-open / vault-roll experience.
import { useState, useCallback } from 'react';
import { useLocation } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Vault, Sparkles, Zap, Lock, Layers,
  Dices, Trophy, AlertTriangle, ChevronRight, Package,
} from 'lucide-react';
import { RARITY_CONFIG, type Rarity } from '../utils/rarity';

// ── Locked launch data (vault-finds-launch-spec.md) ──────────────────────────

type Band = 'chase' | 'recovered' | 'standard';

interface VaultFindCard {
  n: number;
  title: string;
  artist: string;
  band: Band;
  note: string;
  explicit?: boolean;
}

const LAUNCH_CARDS: VaultFindCard[] = [
  { n: 1, title: 'Endure', artist: 'The Snow Flowers', band: 'chase', note: 'Archive take — the published single\'s unheard version' },
  { n: 2, title: 'Endure (Scribey Remix)', artist: 'The Snow Flowers', band: 'chase', note: 'Your own remix from the original sessions' },
  { n: 3, title: 'christ consciousness', artist: 'th3scr1b3', band: 'chase', note: 'The spiritual-centerpiece card' },
  { n: 4, title: 'Get Inside (Another Day)', artist: 'th3scr1b3', band: 'recovered', note: 'Recovered Against a Wall album material' },
  { n: 5, title: 'Hiding_p (lace)', artist: 'th3scr1b3', band: 'recovered', note: 'Recovered Against a Wall album material' },
  { n: 6, title: 'L Like Mud', artist: 'th3scr1b3', band: 'recovered', note: 'Recovered Against a Wall album material' },
  { n: 7, title: 'Fuck My Mind', artist: 'th3scr1b3', band: 'recovered', note: 'Recovered Against a Wall album material', explicit: true },
  { n: 8, title: 'Make Me Believe', artist: 'th3scr1b3', band: 'recovered', note: 'Recovered Against a Wall album material' },
  { n: 9, title: 'Take You Home', artist: 'th3scr1b3', band: 'recovered', note: 'Recovered Against a Wall album material' },
  { n: 10, title: 'Live Art', artist: 'th3scr1b3', band: 'recovered', note: 'Recovered Against a Wall — live-energy card' },
];

const BAND_META: Record<Band, { label: string; weight: number; color: string; desc: string }> = {
  chase: { label: 'CHASE', weight: 5, color: '#ffd700', desc: 'Endure takes + christ consciousness. Floor starts at Rare.' },
  recovered: { label: 'RECOVERED', weight: 20, color: '#b44dff', desc: '7 Against a Wall tracks. Floor starts at Uncommon.' },
  standard: { label: 'VAULT STANDARD', weight: 75, color: '#3b82f6', desc: 'The deep cuts. Full rarity spread.' },
};

const BAND_TABLES: Record<Band, { rarity: Rarity; odds: number; cap: number | null }[]> = {
  standard: [
    { rarity: 'common', odds: 45, cap: 500 },
    { rarity: 'uncommon', odds: 30, cap: 250 },
    { rarity: 'rare', odds: 17, cap: 100 },
    { rarity: 'legendary', odds: 7, cap: 25 },
    { rarity: 'mythic', odds: 1, cap: 5 },
  ],
  recovered: [
    { rarity: 'uncommon', odds: 45, cap: 150 },
    { rarity: 'rare', odds: 35, cap: 50 },
    { rarity: 'legendary', odds: 17, cap: 10 },
    { rarity: 'mythic', odds: 3, cap: 3 },
  ],
  chase: [
    { rarity: 'rare', odds: 55, cap: 25 },
    { rarity: 'legendary', odds: 35, cap: 5 },
    { rarity: 'mythic', odds: 10, cap: 1 },
  ],
};

// ── Pull simulator (uses the locked odds) ────────────────────────────────────

function rollBand(): Band {
  const r = Math.random() * 100;
  if (r < BAND_META.chase.weight) return 'chase';
  if (r < BAND_META.chase.weight + BAND_META.recovered.weight) return 'recovered';
  return 'standard';
}

function rollRarity(band: Band): { rarity: Rarity; cap: number | null } {
  const table = BAND_TABLES[band];
  const r = Math.random() * 100;
  let acc = 0;
  for (const row of table) {
    acc += row.odds;
    if (r < acc) return { rarity: row.rarity, cap: row.cap };
  }
  const last = table[table.length - 1];
  return { rarity: last.rarity, cap: last.cap };
}

interface SimResult {
  id: number;
  band: Band;
  rarity: Rarity;
  cap: number | null;
  card: VaultFindCard;
}

function pickCardForBand(band: Band): VaultFindCard {
  const pool = LAUNCH_CARDS.filter((c) => c.band === band);
  const list = pool.length > 0 ? pool : LAUNCH_CARDS;
  return list[Math.floor(Math.random() * list.length)];
}

// ── Small components ─────────────────────────────────────────────────────────

function SectionTitle({ icon: Icon, title, sub }: { icon: any; title: string; sub?: string }) {
  return (
    <div className="mb-5">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-[#ffd700]/10 border border-[#ffd700]/30">
          <Icon size={20} className="text-[#ffd700]" />
        </div>
        <h2 className="text-xl md:text-2xl font-black uppercase tracking-wider text-white" style={{ fontFamily: '"Arial Black", sans-serif' }}>
          {title}
        </h2>
      </div>
      {sub && <p className="mt-2 text-sm text-white/60 max-w-2xl">{sub}</p>}
    </div>
  );
}

function OddsBar({ label, pct, color }: { label: string; pct: number; color: string }) {
  return (
    <div className="mb-2">
      <div className="flex justify-between text-xs mb-1">
        <span className="font-mono uppercase text-white/70">{label}</span>
        <span className="font-mono font-bold" style={{ color }}>{pct}%</span>
      </div>
      <div className="h-2 rounded-full bg-white/10 overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          whileInView={{ width: `${pct}%` }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="h-full rounded-full"
          style={{ background: color, boxShadow: `0 0 12px ${color}` }}
        />
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function VaultCollectionPage() {
  const [, setLocation] = useLocation();
  const [simPhase, setSimPhase] = useState<'idle' | 'rolling' | 'reveal'>('idle');
  const [simResult, setSimResult] = useState<SimResult | null>(null);
  const [rollCount, setRollCount] = useState(0);

  const simulateRoll = useCallback(() => {
    if (simPhase === 'rolling') return;
    setSimPhase('rolling');
    setSimResult(null);
    // Dramatic pause, pack-rip style
    setTimeout(() => {
      const band = rollBand();
      const { rarity, cap } = rollRarity(band);
      const card = pickCardForBand(band);
      setSimResult({ id: Date.now(), band, rarity, cap, card });
      setRollCount((c) => c + 1);
      setSimPhase('reveal');
    }, 1400);
  }, [simPhase]);

  const simRarityColor = simResult ? RARITY_CONFIG[simResult.rarity].color : '#fff';

  return (
    <div className="min-h-screen bg-[#0a0a12] text-white relative overflow-hidden">
      {/* ambient vault glow */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-[-20%] left-1/2 -translate-x-1/2 w-[900px] h-[500px] rounded-full opacity-25 blur-[120px]"
          style={{ background: 'radial-gradient(circle, #ffd700 0%, #b44dff 45%, transparent 70%)' }} />
        <div className="absolute bottom-[-30%] left-[-10%] w-[600px] h-[400px] rounded-full opacity-15 blur-[100px] bg-[#3b82f6]" />
      </div>

      <div className="relative max-w-5xl mx-auto px-4 pt-6 pb-24">
        {/* back */}
        <button
          onClick={() => setLocation('/vault')}
          className="flex items-center gap-2 text-white/60 hover:text-white text-sm font-mono uppercase mb-6 transition-colors"
        >
          <ArrowLeft size={16} /> Vault HQ
        </button>

        {/* ── HERO ── */}
        <div className="text-center mb-12">
          <motion.div
            initial={{ scale: 0.6, opacity: 0, rotateY: 90 }}
            animate={{ scale: 1, opacity: 1, rotateY: 0 }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
            className="inline-flex items-center justify-center w-20 h-20 rounded-2xl mb-6 border border-[#ffd700]/40 bg-[#ffd700]/5"
            style={{ boxShadow: '0 0 40px rgba(255,215,0,0.35), inset 0 0 20px rgba(255,215,0,0.1)' }}
          >
            <Vault size={40} className="text-[#ffd700]" />
          </motion.div>
          <motion.h1
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.25, duration: 0.7 }}
            className="text-4xl md:text-6xl font-black uppercase tracking-tight"
            style={{
              fontFamily: '"Arial Black", sans-serif',
              background: 'linear-gradient(180deg, #fff 20%, #ffd700 60%, #b44dff 100%)',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              color: 'transparent',
              filter: 'drop-shadow(0 0 24px rgba(255,215,0,0.4))',
            }}
          >
            Vault Finds
          </motion.h1>
          <motion.p
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.45, duration: 0.6 }}
            className="mt-3 text-white/70 font-mono uppercase tracking-widest text-xs md:text-sm"
          >
            Hidden chase cards · Pulled, not claimed · 10 at launch
          </motion.p>
        </div>

        {/* ── WHAT IT IS ── */}
        <motion.section
          initial={{ y: 40, opacity: 0 }}
          whileInView={{ y: 0, opacity: 1 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.6 }}
          className="mb-12"
        >
          <SectionTitle icon={Sparkles} title="What it is"
            sub="Finished songs that live outside the 365. No day numbers, no calendar slots — they're pulled, not claimed." />
          <div className="grid md:grid-cols-3 gap-4">
            {[
              { icon: Lock, t: 'Hidden pool', d: 'Vault Finds never touch the daily drop. The 365 claim keeps its own flow, limits, and pity counter.' },
              { icon: Dices, t: 'Pulled, not claimed', d: 'Every pack you open fires one bonus vault roll after the pack resolves. No spark cost, no separate button.' },
              { icon: Layers, t: 'Offchain collectibles', d: 'Cards live in the game database — not minted tokens, not onchain. When a print cap fills, it\'s gone. No reprints.' },
            ].map((f, i) => (
              <motion.div
                key={f.t}
                initial={{ y: 24, opacity: 0 }}
                whileInView={{ y: 0, opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.12, duration: 0.5 }}
                className="p-5 rounded-xl bg-white/[0.03] border border-white/10 hover:border-[#ffd700]/40 transition-colors"
              >
                <f.icon size={22} className="text-[#ffd700] mb-3" />
                <h3 className="font-bold uppercase tracking-wide text-sm mb-2">{f.t}</h3>
                <p className="text-sm text-white/60 leading-relaxed">{f.d}</p>
              </motion.div>
            ))}
          </div>
          <p className="mt-4 text-xs text-white/40 font-mono">
            Higher pack tiers tilt band weights and rarity odds upward — better packs, better vault odds.
          </p>
        </motion.section>

        {/* ── THE 10 LAUNCH CARDS ── */}
        <motion.section
          initial={{ y: 40, opacity: 0 }}
          whileInView={{ y: 0, opacity: 1 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.6 }}
          className="mb-12"
        >
          <SectionTitle icon={Package} title="The 10 launch cards"
            sub="Ranked by story weight — recovered album material and confirmed standouts first." />
          <div className="grid sm:grid-cols-2 gap-3">
            {LAUNCH_CARDS.map((card, i) => {
              const band = BAND_META[card.band];
              return (
                <motion.div
                  key={card.n}
                  initial={{ x: i % 2 === 0 ? -30 : 30, opacity: 0 }}
                  whileInView={{ x: 0, opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: (i % 4) * 0.08, duration: 0.5 }}
                  whileHover={{ scale: 1.02 }}
                  className="flex items-center gap-4 p-4 rounded-xl bg-white/[0.03] border border-white/10 hover:border-white/25 transition-all"
                  style={{ boxShadow: `inset 3px 0 0 ${band.color}` }}
                >
                  <div
                    className="flex-shrink-0 w-11 h-11 rounded-lg flex items-center justify-center font-black text-lg"
                    style={{ background: `${band.color}18`, border: `1px solid ${band.color}55`, color: band.color }}
                  >
                    {String(card.n).padStart(2, '0')}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm truncate">{card.title}</span>
                      {card.explicit && (
                        <span className="flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded bg-red-500/15 border border-red-500/40 text-red-400">
                          <AlertTriangle size={10} /> EXPLICIT
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-white/50 truncate">{card.artist} — {card.note}</div>
                  </div>
                  <span
                    className="flex-shrink-0 text-[10px] font-mono font-bold px-2 py-1 rounded"
                    style={{ background: `${band.color}15`, border: `1px solid ${band.color}44`, color: band.color }}
                  >
                    {band.label}
                  </span>
                </motion.div>
              );
            })}
          </div>
        </motion.section>

        {/* ── ODDS & SUPPLY ── */}
        <motion.section
          initial={{ y: 40, opacity: 0 }}
          whileInView={{ y: 0, opacity: 1 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.6 }}
          className="mb-12"
        >
          <SectionTitle icon={Trophy} title="Odds & hard supply"
            sub="Every vault roll picks a band first, then a rarity inside that band. Caps are hard — no reprints." />
          <div className="mb-6 p-5 rounded-xl bg-white/[0.03] border border-white/10">
            <div className="text-xs font-mono uppercase text-white/50 mb-3">Band weights per roll</div>
            {(Object.keys(BAND_META) as Band[]).map((b) => (
              <OddsBar key={b} label={BAND_META[b].label} pct={BAND_META[b].weight} color={BAND_META[b].color} />
            ))}
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            {(Object.keys(BAND_TABLES) as Band[]).map((band, bi) => (
              <motion.div
                key={band}
                initial={{ y: 24, opacity: 0 }}
                whileInView={{ y: 0, opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: bi * 0.12, duration: 0.5 }}
                className="p-5 rounded-xl bg-white/[0.03] border border-white/10"
                style={{ borderTop: `3px solid ${BAND_META[band].color}` }}
              >
                <div className="font-black uppercase tracking-wider text-sm mb-1" style={{ color: BAND_META[band].color }}>
                  {BAND_META[band].label}
                </div>
                <div className="text-xs text-white/50 mb-4">{BAND_META[band].desc}</div>
                {BAND_TABLES[band].map((row) => {
                  const rc = RARITY_CONFIG[row.rarity];
                  return (
                    <div key={row.rarity} className="flex items-center justify-between py-1.5 border-b border-white/5 last:border-0">
                      <span className="text-xs font-mono font-bold uppercase" style={{ color: rc.color }}>
                        {rc.label}
                      </span>
                      <span className="text-xs text-white/60 font-mono">
                        {row.odds}% <span className="text-white/35">· cap {row.cap === 1 ? '1-of-1' : row.cap}</span>
                      </span>
                    </div>
                  );
                })}
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* ── ART PREVIEWS ── */}
        <motion.section
          initial={{ y: 40, opacity: 0 }}
          whileInView={{ y: 0, opacity: 1 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.6 }}
          className="mb-12"
        >
          <SectionTitle icon={Layers} title="From the vault files"
            sub="Card artwork is in progress — these dossiers are pulled straight from the launch queue." />
          <div className="grid sm:grid-cols-2 gap-4">
            {[
              { file: 'FILE 01', title: 'The Snow Flowers — "Endure"', sub: 'Archive take · the crown jewel', color: '#ffd700' },
              { file: 'FILE 03', title: '"christ consciousness"', sub: 'The spiritual-centerpiece card', color: '#b44dff' },
            ].map((d, i) => (
              <motion.div
                key={d.file}
                initial={{ rotateY: 25, opacity: 0 }}
                whileInView={{ rotateY: 0, opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15, duration: 0.7 }}
                whileHover={{ rotateY: -6, scale: 1.02 }}
                className="relative p-6 rounded-xl bg-[#111118] border overflow-hidden"
                style={{ borderColor: `${d.color}44`, boxShadow: `0 0 30px ${d.color}22` }}
              >
                <div className="absolute top-3 right-3 text-[10px] font-mono px-2 py-1 rounded bg-red-500/15 border border-red-500/50 text-red-400 font-bold tracking-widest -rotate-6">
                  VAULT SEALED
                </div>
                <div className="text-[10px] font-mono text-white/40 tracking-widest mb-2">{d.file} // DECLASSIFIED</div>
                <div className="text-lg font-black uppercase" style={{ color: d.color }}>{d.title}</div>
                <div className="text-sm text-white/55 mt-1">{d.sub}</div>
                <div className="mt-4 h-24 rounded-lg bg-white/[0.02] border border-white/10 flex items-center justify-center">
                  <span className="text-xs font-mono text-white/30 uppercase tracking-widest">Card artwork rendering…</span>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* ── SIMULATOR ── */}
        <motion.section
          initial={{ y: 40, opacity: 0 }}
          whileInView={{ y: 0, opacity: 1 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.6 }}
          className="mb-8"
        >
          <SectionTitle icon={Dices} title="Feel the pull"
            sub="A simulator running the real locked odds. No packs harmed." />
          <div className="p-6 md:p-8 rounded-2xl bg-[#111118] border border-[#ffd700]/25 text-center relative overflow-hidden">
            <div className="pointer-events-none absolute inset-0 opacity-30"
              style={{ background: 'radial-gradient(circle at 50% 30%, rgba(255,215,0,0.15), transparent 60%)' }} />
            <div className="relative min-h-[220px] flex flex-col items-center justify-center">
              <AnimatePresence mode="wait">
                {simPhase === 'idle' && !simResult && (
                  <motion.div key="idle" exit={{ opacity: 0, scale: 0.9 }} className="text-white/40 font-mono text-sm">
                    Hit the button. The vault decides.
                  </motion.div>
                )}
                {simPhase === 'rolling' && (
                  <motion.div
                    key="rolling"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex flex-col items-center"
                  >
                    <motion.div
                      animate={{ rotate: 360, scale: [1, 1.15, 1] }}
                      transition={{ rotate: { repeat: Infinity, duration: 0.9, ease: 'linear' }, scale: { repeat: Infinity, duration: 0.45 } }}
                    >
                      <Vault size={56} className="text-[#ffd700]" />
                    </motion.div>
                    <div className="mt-4 font-mono text-xs uppercase tracking-widest text-[#ffd700] animate-pulse">
                      Rolling the vault…
                    </div>
                  </motion.div>
                )}
                {simPhase === 'reveal' && simResult && (
                  <motion.div
                    key={simResult.id}
                    initial={{ scale: 0.5, opacity: 0, rotateY: 90 }}
                    animate={{ scale: 1, opacity: 1, rotateY: 0 }}
                    transition={{ type: 'spring', stiffness: 200, damping: 16 }}
                    className="w-full max-w-sm"
                  >
                    <div
                      className="p-6 rounded-xl border-2 bg-[#0d0d15]"
                      style={{ borderColor: simRarityColor, boxShadow: `0 0 50px ${simRarityColor}66, inset 0 0 30px ${simRarityColor}11` }}
                    >
                      <div className="text-[10px] font-mono tracking-widest mb-2" style={{ color: BAND_META[simResult.band].color }}>
                        {BAND_META[simResult.band].label} BAND
                      </div>
                      <div className="text-xl font-black uppercase">{simResult.card.title}</div>
                      <div className="text-sm text-white/55">{simResult.card.artist}</div>
                      <div className="mt-3 inline-block text-xs font-mono font-bold px-3 py-1 rounded"
                        style={{ background: `${simRarityColor}18`, border: `1px solid ${simRarityColor}66`, color: simRarityColor }}>
                        {RARITY_CONFIG[simResult.rarity].label} · {simResult.cap === 1 ? '1-of-1' : `cap ${simResult.cap}`}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <button
              onClick={simulateRoll}
              disabled={simPhase === 'rolling'}
              className="relative mt-6 inline-flex items-center gap-2 px-8 py-3 rounded-xl font-black uppercase tracking-widest text-sm bg-gradient-to-b from-[#ffd700] to-[#b8860b] text-black hover:brightness-110 active:scale-95 transition-all disabled:opacity-50"
              style={{ boxShadow: '0 0 24px rgba(255,215,0,0.45)' }}
            >
              <Zap size={16} /> Simulate vault roll
            </button>
            {rollCount > 0 && (
              <div className="relative mt-3 text-xs font-mono text-white/40">
                {rollCount} simulated roll{rollCount === 1 ? '' : 's'} — mythics not included, obviously
              </div>
            )}
          </div>
          <div className="mt-6 flex justify-center">
            <button
              onClick={() => setLocation('/vault/reveal')}
              className="flex items-center gap-2 text-sm font-mono uppercase text-[#ffd700] hover:text-white transition-colors"
            >
              Open real packs <ChevronRight size={16} />
            </button>
          </div>
        </motion.section>
      </div>
    </div>
  );
}
