// BombshellsPage — dedicated route for the Bombshell variant-cover collection.
// "/bombshells" — info, real art examples, per-month counts, shard mechanics,
// and the V⚡ spark rewards for completing full months.
import { useMemo, useState } from 'react';
import { useLocation } from 'wouter';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Bomb, Sparkles, Zap, Image as ImageIcon,
  Trophy, ChevronRight, Moon, Sun, Package, Puzzle,
} from 'lucide-react';
import { useVaultStore, AWARD_PLAY_SHARD_THRESHOLD } from '../store/useVaultStore';
import {
  BOMBSHELL_COVERS_MAP,
  getBombshellCoverUrl,
  getBombshellDayCovers,
} from '../utils/bombshellCards';

// ── Month helpers (2026, not a leap year) ────────────────────────────────────

const MONTHS = [
  { name: 'January', start: 1, end: 31 },
  { name: 'February', start: 32, end: 59 },
  { name: 'March', start: 60, end: 90 },
  { name: 'April', start: 91, end: 120 },
  { name: 'May', start: 121, end: 151 },
  { name: 'June', start: 152, end: 181 },
  { name: 'July', start: 182, end: 212 },
  { name: 'August', start: 213, end: 243 },
  { name: 'September', start: 244, end: 273 },
  { name: 'October', start: 274, end: 304 },
  { name: 'November', start: 305, end: 334 },
  { name: 'December', start: 335, end: 365 },
];

// ── Spark reward tiers (collection-completion design) ────────────────────────
// Calibrated against the economy: a bombshell single pull costs 100 V⚡,
// a standard token pack 275 V⚡, daily streaks pay 10–50 V⚡/day.

const REWARD_TIERS = [
  {
    name: 'Month Complete',
    sparks: 1000,
    desc: 'Own at least one bombshell variant for every day of a calendar month.',
    color: '#4ade80',
    equiv: '≈ 10 free bombshell pulls',
  },
  {
    name: 'Month Mastered',
    sparks: 2500,
    desc: 'Own both a light and a dark variant for every day of a calendar month.',
    color: '#3b82f6',
    equiv: '≈ 25 free bombshell pulls',
  },
  {
    name: 'Full Year',
    sparks: 10000,
    desc: 'Complete all 12 months. The grand prize — paid once, on top of the month rewards.',
    color: '#ffd700',
    equiv: '≈ 100 free bombshell pulls',
  },
];

// ── Art example picks (days with strong coverage) ────────────────────────────

const SHOWCASE_DAYS = [3, 12, 1];

function BombshellArt({ day }: { day: number }) {
  const covers = getBombshellDayCovers(day);
  const files = [...covers.normalFiles, ...covers.lbFiles];
  const [idx, setIdx] = useState(0);
  const [failed, setFailed] = useState<Record<number, boolean>>({});
  const src = files.length > 0 ? getBombshellCoverUrl(day, files[idx % files.length]) : '';

  return (
    <div className="relative group">
      <motion.div
        whileHover={{ rotateY: -8, rotateX: 4, scale: 1.03 }}
        transition={{ type: 'spring', stiffness: 260, damping: 20 }}
        className="relative rounded-xl overflow-hidden border border-[#ff1493]/40 bg-[#111118] aspect-[3/4]"
        style={{ boxShadow: '0 0 30px rgba(255,20,147,0.25)', transformStyle: 'preserve-3d' }}
      >
        {src && !failed[idx % files.length] ? (
          <img
            key={src}
            src={src}
            alt={`Bombshell variant — day ${day}`}
            className="w-full h-full object-cover"
            loading="lazy"
            onError={() => {
              // step to the next sibling cover on failure
              if (idx + 1 < files.length) setIdx(idx + 1);
              else setFailed({ ...failed, [idx % files.length]: true });
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ImageIcon size={32} className="text-white/20" />
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/85 to-transparent">
          <div className="text-xs font-mono font-bold text-[#ff1493]">DAY {day}</div>
          <div className="text-[11px] text-white/60 font-mono">
            {covers.totalCovers} variants · light + dark
          </div>
        </div>
        {files.length > 1 && (
          <button
            onClick={(e) => { e.stopPropagation(); setIdx((i) => i + 1); }}
            className="absolute top-2 right-2 text-[10px] font-mono px-2 py-1 rounded bg-black/60 border border-white/20 text-white/80 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            NEXT VARIANT →
          </button>
        )}
      </motion.div>
    </div>
  );
}

function SectionTitle({ icon: Icon, title, sub, accent = '#ff1493' }: { icon: any; title: string; sub?: string; accent?: string }) {
  return (
    <div className="mb-5">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg border" style={{ background: `${accent}14`, borderColor: `${accent}44` }}>
          <Icon size={20} style={{ color: accent }} />
        </div>
        <h2 className="text-xl md:text-2xl font-black uppercase tracking-wider text-white" style={{ fontFamily: '"Arial Black", sans-serif' }}>
          {title}
        </h2>
      </div>
      {sub && <p className="mt-2 text-sm text-white/60 max-w-2xl">{sub}</p>}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function BombshellsPage() {
  const [, setLocation] = useLocation();
  const { fragments } = useVaultStore();

  const monthStats = useMemo(() => {
    let grandCovers = 0;
    return MONTHS.map((m) => {
      let covers = 0;
      let tracked = 0;
      const daysInMonth = m.end - m.start + 1;
      for (let d = m.start; d <= m.end; d++) {
        const entry = BOMBSHELL_COVERS_MAP[String(d)];
        if (entry) covers += entry.totalCovers || 0;
        if ((fragments?.[`bombshell-${d}`] ?? 0) >= 1) tracked += 1;
      }
      grandCovers += covers;
      return { ...m, daysInMonth, covers, tracked, complete: tracked >= daysInMonth };
    });
  }, [fragments]);

  const grandTotal = useMemo(
    () => monthStats.reduce((a, m) => a + m.covers, 0),
    [monthStats]
  );
  const monthsComplete = monthStats.filter((m) => m.complete).length;

  return (
    <div className="min-h-screen bg-[#0c0710] text-white relative overflow-hidden">
      {/* ambient bombshell glow */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-[-20%] left-1/2 -translate-x-1/2 w-[900px] h-[500px] rounded-full opacity-25 blur-[120px]"
          style={{ background: 'radial-gradient(circle, #ff1493 0%, #b44dff 45%, transparent 70%)' }} />
        <div className="absolute bottom-[-30%] right-[-10%] w-[600px] h-[400px] rounded-full opacity-15 blur-[100px] bg-[#ff1493]" />
      </div>

      <div className="relative max-w-5xl mx-auto px-4 pt-6 pb-24">
        <button
          onClick={() => setLocation('/vault')}
          className="flex items-center gap-2 text-white/60 hover:text-white text-sm font-mono uppercase mb-6 transition-colors"
        >
          <ArrowLeft size={16} /> Vault HQ
        </button>

        {/* ── HERO ── */}
        <div className="text-center mb-12">
          <motion.div
            initial={{ scale: 0.6, opacity: 0, rotate: -12 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
            className="inline-flex items-center justify-center w-20 h-20 rounded-2xl mb-6 border border-[#ff1493]/40 bg-[#ff1493]/5"
            style={{ boxShadow: '0 0 40px rgba(255,20,147,0.35), inset 0 0 20px rgba(255,20,147,0.1)' }}
          >
            <Bomb size={40} className="text-[#ff1493]" />
          </motion.div>
          <motion.h1
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.25, duration: 0.7 }}
            className="text-4xl md:text-6xl font-black uppercase tracking-tight"
            style={{
              fontFamily: '"Arial Black", sans-serif',
              background: 'linear-gradient(180deg, #fff 20%, #ff1493 60%, #b44dff 100%)',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              color: 'transparent',
              filter: 'drop-shadow(0 0 24px rgba(255,20,147,0.4))',
            }}
          >
            Bombshells
          </motion.h1>
          <motion.p
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.45, duration: 0.6 }}
            className="mt-3 text-white/70 font-mono uppercase tracking-widest text-xs md:text-sm"
          >
            {grandTotal.toLocaleString()}+ variant covers · all 365 days · light + dark
          </motion.p>
        </div>

        {/* ── WHAT THEY ARE ── */}
        <motion.section
          initial={{ y: 40, opacity: 0 }}
          whileInView={{ y: 0, opacity: 1 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.6 }}
          className="mb-12"
        >
          <SectionTitle icon={Sparkles} title="What they are"
            sub="AI variant covers — alternate artwork for every day of the 365, in fullscreen and letterbox cuts, light and dark." />
          <div className="grid md:grid-cols-3 gap-4">
            {[
              { icon: ImageIcon, t: 'Variant artwork', d: 'Every 365 day has its own set of bombshell variants — alternate takes on the day\'s cover, generated in batch and sorted by day.' },
              { icon: Sun, t: 'Light + dark', d: 'Variants ship in light and dark treatments, plus letterbox cuts — mix and match the vibe of your binder.' },
              { icon: Package, t: 'Per-denomination packs', d: 'Bombshell packs come in 1x–50x sizes with their own rerendered artwork. 100 V⚡ per card.' },
            ].map((f, i) => (
              <motion.div
                key={f.t}
                initial={{ y: 24, opacity: 0 }}
                whileInView={{ y: 0, opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.12, duration: 0.5 }}
                className="p-5 rounded-xl bg-white/[0.03] border border-white/10 hover:border-[#ff1493]/40 transition-colors"
              >
                <f.icon size={22} className="text-[#ff1493] mb-3" />
                <h3 className="font-bold uppercase tracking-wide text-sm mb-2">{f.t}</h3>
                <p className="text-sm text-white/60 leading-relaxed">{f.d}</p>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* ── ART EXAMPLES ── */}
        <motion.section
          initial={{ y: 40, opacity: 0 }}
          whileInView={{ y: 0, opacity: 1 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.6 }}
          className="mb-12"
        >
          <SectionTitle icon={ImageIcon} title="Fresh off the press"
            sub="Real variants from the collection. Hover a card, or tap through its variants." />
          <div className="grid grid-cols-3 gap-3 md:gap-5 max-w-3xl mx-auto">
            {SHOWCASE_DAYS.map((day, i) => (
              <motion.div
                key={day}
                initial={{ y: 40, opacity: 0, rotate: i === 1 ? 0 : i === 0 ? -4 : 4 }}
                whileInView={{ y: 0, opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15, duration: 0.6 }}
              >
                <BombshellArt day={day} />
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* ── SHARDS ── */}
        <motion.section
          initial={{ y: 40, opacity: 0 }}
          whileInView={{ y: 0, opacity: 1 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.6 }}
          className="mb-12"
        >
          <SectionTitle icon={Puzzle} title="Shards & award play" accent="#ffd700"
            sub="Bombshell packs drop shards. Shards unlock the stakes." />
          <div className="p-5 md:p-6 rounded-xl bg-white/[0.03] border border-[#ffd700]/25">
            <div className="flex flex-col md:flex-row md:items-center gap-4">
              <div className="flex-1">
                <div className="text-sm text-white/70 leading-relaxed">
                  Every bombshell pull grants shards for that day
                  <span className="font-mono text-white/40"> (bombshell-{'{day}'})</span> —
                  common 2, uncommon 3, rare 5, legendary &amp; mythic 10.
                </div>
                <div className="mt-2 text-sm text-white/70 leading-relaxed">
                  Collect <span className="font-bold text-[#ffd700]">{AWARD_PLAY_SHARD_THRESHOLD} shards</span> for a
                  day and its <span className="font-bold">Award Play</span> unlocks — play the owned card for score prizes.
                </div>
              </div>
              <div className="flex-shrink-0 flex items-center gap-2 px-4 py-3 rounded-lg bg-[#ffd700]/10 border border-[#ffd700]/40">
                <Trophy size={20} className="text-[#ffd700]" />
                <span className="font-mono text-sm font-bold text-[#ffd700]">10 = UNLOCKED</span>
              </div>
            </div>
          </div>
        </motion.section>

        {/* ── MONTH TABLE + REWARDS ── */}
        <motion.section
          initial={{ y: 40, opacity: 0 }}
          whileInView={{ y: 0, opacity: 1 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.6 }}
          className="mb-12"
        >
          <SectionTitle icon={Trophy} title="Complete the month, get paid" accent="#4ade80"
            sub={`${monthsComplete} of 12 months complete. Finish every day of a month — sparks rain.`} />
          {/* reward tiers */}
          <div className="grid md:grid-cols-3 gap-4 mb-6">
            {REWARD_TIERS.map((tier, i) => (
              <motion.div
                key={tier.name}
                initial={{ y: 24, opacity: 0, scale: 0.96 }}
                whileInView={{ y: 0, opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.12, duration: 0.5 }}
                whileHover={{ scale: 1.03 }}
                className="p-5 rounded-xl bg-white/[0.03] border relative overflow-hidden"
                style={{ borderColor: `${tier.color}44`, boxShadow: `0 0 24px ${tier.color}18` }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Zap size={18} style={{ color: tier.color }} />
                  <span className="font-black uppercase tracking-wide text-sm">{tier.name}</span>
                </div>
                <div className="text-3xl font-black font-mono mb-2" style={{ color: tier.color }}>
                  {tier.sparks.toLocaleString()} <span className="text-sm">V⚡</span>
                </div>
                <p className="text-xs text-white/60 leading-relaxed">{tier.desc}</p>
                <p className="mt-2 text-[11px] font-mono text-white/40">{tier.equiv}</p>
              </motion.div>
            ))}
          </div>
          {/* month progress */}
          <div className="rounded-xl bg-white/[0.02] border border-white/10 overflow-hidden">
            {monthStats.map((m, i) => {
              const pct = Math.round((m.tracked / m.daysInMonth) * 100);
              return (
                <motion.div
                  key={m.name}
                  initial={{ x: -20, opacity: 0 }}
                  whileInView={{ x: 0, opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: Math.min(i * 0.04, 0.4), duration: 0.4 }}
                  className="flex items-center gap-3 px-4 py-2.5 border-b border-white/5 last:border-0 hover:bg-white/[0.02]"
                >
                  <span className="w-24 flex-shrink-0 text-xs font-mono uppercase text-white/70">{m.name}</span>
                  <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      whileInView={{ width: `${pct}%` }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.7, ease: 'easeOut' }}
                      className="h-full rounded-full"
                      style={{
                        background: m.complete ? '#4ade80' : '#ff1493',
                        boxShadow: `0 0 8px ${m.complete ? '#4ade80' : '#ff1493'}`,
                      }}
                    />
                  </div>
                  <span className="w-28 flex-shrink-0 text-right text-[11px] font-mono text-white/50">
                    {m.tracked}/{m.daysInMonth} days · {m.covers} covers
                  </span>
                  {m.complete && (
                    <span className="flex-shrink-0 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-[#4ade80]/15 border border-[#4ade80]/40 text-[#4ade80]">
                      1,000 V⚡
                    </span>
                  )}
                </motion.div>
              );
            })}
          </div>
          <p className="mt-3 text-[11px] font-mono text-white/35">
            Progress tracks days with at least one bombshell shard. Rewards are granted per completed month; mastering light + dark doubles down to 2,500 V⚡.
          </p>
        </motion.section>

        {/* ── CTA ── */}
        <motion.section
          initial={{ y: 40, opacity: 0 }}
          whileInView={{ y: 0, opacity: 1 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.6 }}
          className="text-center"
        >
          <div className="flex items-center justify-center gap-2 text-white/40 font-mono text-xs uppercase tracking-widest mb-4">
            <Moon size={14} /> light <span className="text-white/20">·</span> dark <Sun size={14} />
          </div>
          <button
            onClick={() => setLocation('/vault/reveal')}
            className="inline-flex items-center gap-2 px-8 py-3 rounded-xl font-black uppercase tracking-widest text-sm bg-gradient-to-b from-[#ff1493] to-[#a01060] text-white hover:brightness-110 active:scale-95 transition-all"
            style={{ boxShadow: '0 0 24px rgba(255,20,147,0.45)' }}
          >
            Rip bombshell packs <ChevronRight size={16} />
          </button>
        </motion.section>
      </div>
    </div>
  );
}
