// BombshellsPage — dedicated route for the Bombshell variant-cover collection.
// "/bombshells" — info, real art examples, per-month counts, shard mechanics,
// and the V⚡ spark rewards for completing full months, claimed here (utils/bombshellRewards).
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'wouter';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Bomb, Sparkles, Zap, Image as ImageIcon,
  Trophy, ChevronRight, Moon, Sun, Package, Puzzle, Check, Loader2, Lock,
} from 'lucide-react';
import { useVaultStore, AWARD_PLAY_SHARD_THRESHOLD } from '../store/useVaultStore';
import { useAuthStore } from '../store/useAuthStore';
import {
  getBombshellCoverUrl,
  getBombshellDayCovers,
} from '../utils/bombshellCards';
import {
  BOMBSHELL_REWARD_SPARKS,
  claimBombshellReward,
  fetchBombshellClaims,
  getBombshellMonthProgress,
  monthRewardKey,
  type BombshellRewardKey,
} from '../utils/bombshellRewards';

// ── Reward tiers (rules + payout live in utils/bombshellRewards + the server) ──

const REWARD_TIERS = [
  {
    kind: 'complete' as const,
    name: 'Month Complete',
    sparks: BOMBSHELL_REWARD_SPARKS.complete,
    desc: 'Own a bombshell variant of every day in a calendar month.',
    color: '#4ade80',
    equiv: '≈ 10 free bombshell pulls',
  },
  {
    kind: 'mastered' as const,
    name: 'Month Mastered',
    sparks: BOMBSHELL_REWARD_SPARKS.mastered,
    desc: 'Own both cuts, full-frame and letterbox, of every day in a month. Paid on top of Month Complete.',
    color: '#3b82f6',
    equiv: '≈ 25 free bombshell pulls',
  },
  {
    kind: 'year' as const,
    name: 'Full Year',
    sparks: BOMBSHELL_REWARD_SPARKS.year,
    desc: 'Complete all 12 months. The grand prize, paid once, on top of the month rewards.',
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

// ── Claim button ─────────────────────────────────────────────────────────────

function ClaimButton({
  state, color, sparks, lockedLabel, busy, signedIn, onClaim, compact = false,
}: {
  state: 'locked' | 'ready' | 'claimed';
  color: string;
  sparks: number;
  lockedLabel: string;
  busy: boolean;
  signedIn: boolean;
  onClaim: () => void;
  compact?: boolean;
}) {
  const size = compact ? 'px-2.5 py-1.5 text-[10px] min-w-[104px]' : 'w-full px-4 py-2.5 text-xs';
  const amount = sparks.toLocaleString();
  if (state === 'claimed') {
    return (
      <span className={`${size} inline-flex items-center justify-center gap-1.5 rounded-lg font-mono font-bold uppercase border`}
        style={{ color, borderColor: `${color}55`, background: `${color}12` }}>
        <Check size={12} /> Claimed
      </span>
    );
  }
  if (state === 'locked') {
    return (
      <span className={`${size} inline-flex items-center justify-center gap-1.5 rounded-lg font-mono uppercase border border-white/10 text-white/35`}
        title={`${amount} V⚡ when earned`}>
        <Lock size={11} /> {lockedLabel} · {amount}
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={onClaim}
      disabled={busy || !signedIn}
      title={signedIn ? undefined : 'Sign in to claim'}
      className={`${size} inline-flex items-center justify-center gap-1.5 rounded-lg font-mono font-black uppercase text-black transition-all hover:brightness-110 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed`}
      style={{ background: color, boxShadow: `0 0 16px ${color}66` }}
    >
      {busy ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />}
      {signedIn ? `Claim ${amount}` : `Sign in · ${amount}`}
    </button>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function BombshellsPage() {
  const [, setLocation] = useLocation();
  const collection = useVaultStore((st) => st.collection);
  const refreshTokenBalance = useVaultStore((st) => st.refreshTokenBalance);
  const user = useAuthStore((st) => st.user);

  const monthStats = useMemo(() => getBombshellMonthProgress(collection || []), [collection]);
  const grandTotal = useMemo(() => monthStats.reduce((a, m) => a + m.covers, 0), [monthStats]);
  const unlockedTotal = useMemo(() => monthStats.reduce((a, m) => a + m.unlockedCovers, 0), [monthStats]);
  const monthsComplete = monthStats.filter((m) => m.complete).length;
  const yearComplete = monthsComplete === 12;

  // Claimed rewards come from the server. null = signed out or not reachable.
  const [claimed, setClaimed] = useState<Set<string> | null>(null);
  const [claiming, setClaiming] = useState<BombshellRewardKey | null>(null);
  const [notice, setNotice] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    let live = true;
    fetchBombshellClaims().then((c) => { if (live) setClaimed(c); });
    return () => { live = false; };
  }, [user?.id]);

  const claim = useCallback(async (key: BombshellRewardKey, label: string) => {
    if (claiming) return;
    setClaiming(key);
    setNotice(null);
    const res = await claimBombshellReward(key);
    setClaiming(null);
    if ('sparks' in res) {
      setClaimed((c) => new Set([...(c ?? []), key]));
      setNotice({ tone: 'ok', text: `${label}: +${res.sparks.toLocaleString()} V⚡ added to your balance.` });
      refreshTokenBalance();
    } else {
      if (res.message === 'Already claimed.') setClaimed((c) => new Set([...(c ?? []), key]));
      setNotice({ tone: 'err', text: res.message });
    }
  }, [claiming, refreshTokenBalance]);

  const signedIn = !!user;
  const isClaimed = (key: BombshellRewardKey) => !!claimed?.has(key);
  const readyCount = monthStats.reduce((n, m) =>
    n + (m.complete && !isClaimed(monthRewardKey(m.month, 'complete')) ? 1 : 0)
      + (m.isMastered && !isClaimed(monthRewardKey(m.month, 'mastered')) ? 1 : 0), 0)
    + (yearComplete && !isClaimed('year') ? 1 : 0);

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
          id="rewards"
          initial={{ y: 40, opacity: 0 }}
          whileInView={{ y: 0, opacity: 1 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.6 }}
          className="mb-12 scroll-mt-24"
        >
          <SectionTitle icon={Trophy} title="Complete the month, get paid" accent="#4ade80"
            sub={`${monthsComplete} of 12 months complete · ${unlockedTotal.toLocaleString()} of ${grandTotal.toLocaleString()} covers unlocked. Finish every day of a month and claim your sparks here.`} />

          {/* status strip */}
          <div className="mb-5 flex flex-wrap items-center gap-2 text-[11px] font-mono uppercase tracking-wider">
            {!signedIn ? (
              <span className="px-2.5 py-1 rounded-md border border-white/15 bg-white/[0.04] text-white/60 flex items-center gap-1.5">
                <Lock size={12} /> Sign in to claim rewards
              </span>
            ) : readyCount > 0 ? (
              <span className="px-2.5 py-1 rounded-md border border-[#4ade80]/50 bg-[#4ade80]/10 text-[#4ade80] flex items-center gap-1.5">
                <Zap size={12} /> {readyCount} reward{readyCount === 1 ? '' : 's'} ready to claim
              </span>
            ) : (
              <span className="px-2.5 py-1 rounded-md border border-white/15 bg-white/[0.04] text-white/60">
                No rewards ready yet
              </span>
            )}
            {notice && (
              <span
                role="status"
                className="px-2.5 py-1 rounded-md border normal-case tracking-normal"
                style={notice.tone === 'ok'
                  ? { borderColor: '#4ade8066', background: '#4ade8014', color: '#4ade80' }
                  : { borderColor: '#ff6b6b66', background: '#ff6b6b14', color: '#ff9b9b' }}
              >
                {notice.text}
              </span>
            )}
          </div>

          {/* reward tiers */}
          <div className="grid md:grid-cols-3 gap-4 mb-6">
            {REWARD_TIERS.map((tier, i) => {
              const earned = tier.kind === 'year' ? (yearComplete ? 1 : 0)
                : monthStats.filter((m) => (tier.kind === 'complete' ? m.complete : m.isMastered)).length;
              const paid = tier.kind === 'year' ? (isClaimed('year') ? 1 : 0)
                : monthStats.filter((m) => isClaimed(monthRewardKey(m.month, tier.kind as 'complete' | 'mastered'))).length;
              return (
                <motion.div
                  key={tier.name}
                  initial={{ y: 24, opacity: 0, scale: 0.96 }}
                  whileInView={{ y: 0, opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.12, duration: 0.5 }}
                  className="p-5 rounded-xl bg-white/[0.03] border relative overflow-hidden flex flex-col"
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
                  <div className="mt-auto pt-4">
                    {tier.kind === 'year' ? (
                      <ClaimButton
                        color={tier.color}
                        sparks={tier.sparks}
                        state={isClaimed('year') ? 'claimed' : yearComplete ? 'ready' : 'locked'}
                        lockedLabel={`${monthsComplete}/12 months`}
                        busy={claiming === 'year'}
                        signedIn={signedIn}
                        onClaim={() => claim('year', 'Full Year')}
                      />
                    ) : (
                      <div className="text-[11px] font-mono uppercase tracking-wider text-white/50">
                        {earned}/12 months earned · {paid} claimed
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* month progress + per-month claims */}
          <div className="rounded-xl bg-white/[0.02] border border-white/10 overflow-hidden">
            {monthStats.map((m, i) => {
              const pct = Math.round((m.owned / m.days) * 100);
              const kComplete = monthRewardKey(m.month, 'complete');
              const kMastered = monthRewardKey(m.month, 'mastered');
              return (
                <motion.div
                  key={m.name}
                  initial={{ x: -20, opacity: 0 }}
                  whileInView={{ x: 0, opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: Math.min(i * 0.04, 0.4), duration: 0.4 }}
                  className="flex flex-wrap md:flex-nowrap items-center gap-x-3 gap-y-2 px-4 py-3 border-b border-white/5 last:border-0 hover:bg-white/[0.02]"
                >
                  <span className="w-24 flex-shrink-0 text-xs font-mono uppercase text-white/70">{m.name}</span>
                  <div className="flex-1 min-w-[120px]">
                    <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        whileInView={{ width: `${pct}%` }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.7, ease: 'easeOut' }}
                        className="h-full rounded-full"
                        style={{
                          background: m.isMastered ? '#3b82f6' : m.complete ? '#4ade80' : '#ff1493',
                          boxShadow: `0 0 8px ${m.isMastered ? '#3b82f6' : m.complete ? '#4ade80' : '#ff1493'}`,
                        }}
                      />
                    </div>
                    <div className="mt-1 text-[10px] font-mono text-white/45">
                      {m.owned}/{m.days} days · {m.mastered}/{m.days} both cuts · {m.unlockedCovers}/{m.covers} covers
                    </div>
                  </div>
                  <div className="flex gap-2 w-full md:w-auto justify-end">
                    <ClaimButton
                      compact
                      color="#4ade80"
                      sparks={BOMBSHELL_REWARD_SPARKS.complete}
                      state={isClaimed(kComplete) ? 'claimed' : m.complete ? 'ready' : 'locked'}
                      lockedLabel="Complete"
                      busy={claiming === kComplete}
                      signedIn={signedIn}
                      onClaim={() => claim(kComplete, `${m.name} complete`)}
                    />
                    <ClaimButton
                      compact
                      color="#3b82f6"
                      sparks={BOMBSHELL_REWARD_SPARKS.mastered}
                      state={isClaimed(kMastered) ? 'claimed' : m.isMastered ? 'ready' : 'locked'}
                      lockedLabel="Mastered"
                      busy={claiming === kMastered}
                      signedIn={signedIn}
                      onClaim={() => claim(kMastered, `${m.name} mastered`)}
                    />
                  </div>
                </motion.div>
              );
            })}
          </div>
          <p className="mt-3 text-[11px] font-mono text-white/35">
            Progress counts bombshell cards in your vault, the same covers the Artwork tab unlocks. Each reward pays once per account and the vault checks your cards before paying.
            Days that ship only one cut need just that cut for Mastered.
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
