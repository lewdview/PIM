import { useParams, useLocation } from "wouter";
import { useEffect, useState, useRef } from "react";
import { getSongById, loadCatalog, isSongTimeLocked } from "@/game/api";
import type { GameSong } from "@/game/api";
import { getHighScore, getChapterPlatinums } from "@/game/progress";
import { getActiveTheme, loadOpts } from "@/lib/options";
import { audioManager } from "@/game/audio";
import { useAuthStore } from "@/store/useAuthStore";
import { DELUXE_UNLOCK_ACCURACY, deluxeSongId, hasEarnedDeluxe, isDeluxeSongId, isDeluxeUnlocked, markDeluxeEarned } from "@/lib/deluxe";
import { useVaultStore, ownsCardForDay, isAwardPlayUnlocked, getShardsForDay } from "@/store/useVaultStore";
import CampaignResults from "./campaign/CampaignResults";
import { supabase } from "@/services/supabaseClient";
import { purchasePack, requestRunToken, submitGameplayRecord, type OwnedCard } from "@/services/vaultService";
import { PACK_CONFIGS } from "@/utils/rarity";
import { logAnalyticsEvent } from "@/services/telemetryService";
import OnboardingFlowModal from "@/components/OnboardingFlowModal";
import OnDemandResults from "./results/OnDemandResults";
import { farcasterService } from "@/services/farcasterService";
import { runShareUrl, shareRun, type ShareableRun } from '@/lib/shareLink';

interface LaneTelemetry {
  hits: number; perfectPlus: number; perfects: number; goods: number; misses: number;
}

interface ResultData {
  score: number; maxCombo: number; perfectPlus: number;
  perfects: number; goods: number; misses: number; medal: string; total: number;
  failed?: boolean; continuesUsed?: number;
  laneTelemetry?: Record<number, LaneTelemetry>;
  coverUrl?: string;
  coverVariant?: string;
  /** 'campaign' when launched from a chapter; on-demand plays get the regular screen. */
  mode?: 'campaign' | 'on_demand';
  campaign?: { month: number; idx: number; level: number; firstClear: boolean };
}

const MEDALS: Record<string, { color: string; message: string }> = {
  PLATINUM: { color: '#39FF14', message: 'PERFECT SIGNAL' },
  GOLD:     { color: '#E5B800', message: 'STRONG SIGNAL' },
  SILVER:   { color: '#A0AABB', message: 'SIGNAL STABLE · SOME STATIC' },
  BRONZE:   { color: '#C97A3A', message: 'WEAK SIGNAL · HEAVY NOISE' },
  NONE:     { color: '#555',    message: 'SIGNAL LOST · TRY AGAIN' },
};

const CHAPTER_PLAT_NEEDED: Record<number, number> = {
  1:2, 2:2, 3:3, 4:3, 5:3, 6:4, 7:4, 8:5, 9:5, 10:5, 11:6, 12:7,
};

// ── custom vector SVG icons for after gameplay hub choices ─────────
function HubSvgIcon({ type, color }: { type: string; color: string }) {
  const size = 22;
  switch (type) {
    case 'collection':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className="group-hover:scale-110 transition-transform drop-shadow-[0_0_6px_rgba(255,56,0,0.4)]">
          <rect x="2" y="7" width="11" height="14" rx="2" stroke={color} strokeWidth="1.5" strokeOpacity="0.4" fill={`${color}10`} />
          <rect x="6.5" y="5" width="11" height="14" rx="2" stroke={color} strokeWidth="1.5" strokeOpacity="0.75" fill={`${color}20`} />
          <rect x="11" y="3" width="11" height="14" rx="2" stroke={color} strokeWidth="1.8" fill={`${color}40`} />
          <path d="M16.5 7.5L18.5 9.5L16.5 11.5L14.5 9.5L16.5 7.5Z" fill="#FFF" />
        </svg>
      );
    case 'vault':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className="group-hover:scale-110 transition-transform drop-shadow-[0_0_6px_rgba(255,184,0,0.4)]">
          <circle cx="12" cy="12" r="9" stroke={color} strokeWidth="1.8" fill={`${color}18`} />
          <circle cx="12" cy="12" r="5" stroke={color} strokeWidth="1.5" strokeDasharray="3 3" />
          <circle cx="12" cy="12" r="2" fill="#FFF" />
          <path d="M12 3V6M12 18V21M3 12H6M18 12H21" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case 'shop':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className="group-hover:scale-110 transition-transform drop-shadow-[0_0_6px_rgba(57,255,20,0.4)]">
          <path d="M13 2L4 14H11L10 22L20 10H13L14 2Z" fill={color} stroke="#FFF" strokeWidth="1" />
        </svg>
      );
    case 'arcade':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className="group-hover:scale-110 transition-transform drop-shadow-[0_0_6px_rgba(0,229,255,0.4)]">
          <path d="M2 19L8 9H16L22 19H2Z" stroke={color} strokeWidth="1.6" fill={`${color}20`} />
          <path d="M12 9V19M6 14H18" stroke={color} strokeWidth="1.2" strokeDasharray="2 2" />
          <circle cx="12" cy="5.5" r="2.5" stroke={color} strokeWidth="1.5" fill={`${color}40`} />
        </svg>
      );
    case 'songs':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className="group-hover:scale-110 transition-transform drop-shadow-[0_0_6px_rgba(255,0,127,0.4)]">
          <circle cx="12" cy="12" r="9" stroke={color} strokeWidth="1.8" fill={`${color}18`} />
          <circle cx="12" cy="12" r="3.5" stroke={color} strokeWidth="1.5" />
          <circle cx="12" cy="12" r="1.2" fill="#FFF" />
          <path d="M12 3C15.5 3 18.5 6 18.5 9.5" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
          <path d="M12 21C8.5 21 5.5 18 5.5 14.5" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      );
    case 'campaign':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className="group-hover:scale-110 transition-transform drop-shadow-[0_0_6px_rgba(157,141,241,0.4)]">
          <path d="M6 3H18V9.5C18 12.8 15.3 15.5 12 15.5C8.7 15.5 6 12.8 6 9.5V3Z" stroke={color} strokeWidth="1.8" fill={`${color}22`} />
          <path d="M12 15.5V19.5M8 20.5H16" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
          <path d="M12 5.5L13.1 7.7L15.5 8.1L13.8 9.8L14.2 12.2L12 11.1L9.8 12.2L10.2 9.8L8.5 8.1L10.9 7.7L12 5.5Z" fill="#FFF" />
        </svg>
      );
    default:
      return null;
  }
}

// ── persistent return navigation grid component ─────────────────────
function QuickReturnGrid({ onNavigate }: { onNavigate: (path: string) => void }) {
  const options = [
    { label: 'Collection', path: '/vault/collection', iconType: 'collection', color: '#ff3800' },
    { label: 'Vault', path: '/vault', iconType: 'vault', color: '#ffb800' },
    { label: 'Shop', path: '/vault/earn', iconType: 'shop', color: '#39FF14' },
    { label: 'Arcade', path: '/arcade', iconType: 'arcade', color: '#00E5FF' },
    { label: 'Award Play', path: '/songs', iconType: 'songs', color: '#FF007F' },
    { label: 'Campaign', path: '/campaign', iconType: 'campaign', color: '#9D8DF1' },
  ];

  return (
    <div className="w-full my-3 p-3 bg-black/85 border border-white/20 flex flex-col gap-2 shadow-[0_4px_24px_rgba(0,0,0,0.8)] select-none backdrop-blur-md"
      style={{ clipPath: 'polygon(10px 0%, 100% 0%, calc(100% - 10px) 100%, 0% 100%)' }}
    >
      <div className="font-mono text-[9px] uppercase tracking-[0.25em] text-[#00E5FF] font-black text-center">
        // TACTICAL HUBS //
      </div>
      <div className="grid grid-cols-3 gap-2">
        {options.map((opt) => (
          <button
            key={opt.path}
            onClick={() => {
              audioManager.playSfx('tap_nav', 0.15);
              onNavigate(opt.path);
            }}
            className="flex flex-col items-center justify-center py-2.5 px-1 bg-zinc-950/90 border border-white/15 hover:border-white/50 hover:bg-zinc-900 transition-all active:scale-95 group cursor-pointer shadow-sm hover:shadow-[0_0_12px_rgba(255,255,255,0.12)]"
            style={{
              clipPath: 'polygon(6px 0%, 100% 0%, calc(100% - 6px) 100%, 0% 100%)',
              minHeight: 48,
            }}
          >
            <HubSvgIcon type={opt.iconType} color={opt.color} />
            <span
              className="font-mono text-[9px] font-black uppercase tracking-tight mt-1"
              style={{ color: opt.color }}
            >
              {opt.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── main component ───────────────────────────────────────────
export default function Results() {
  const { songId } = useParams<{ songId: string }>();
  const [, setLocation] = useLocation();
  const [song, setSong] = useState<GameSong | null>(null);
  const [result, setResult] = useState<ResultData | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [ready, setReady] = useState(false);
  const [nextSong, setNextSong] = useState<GameSong | null>(null);
  const [chapterMonth, setChapterMonth] = useState<number>(1);
  const [gameOrigin, setGameOrigin] = useState<string>('');

  // Theme support
  const isAvant = getActiveTheme() === 'avant-garde';

  // Run token minted when the run started (GameplayCore). Presented to
  // submit_score as anti-replay proof. May be null for guests (no submit)
  // or if minting failed (GameResults mints a fallback before submit).
  const runTokenRef = useRef<string | null>(null);

  // The run's own cover, written by GameplayCore when the run ended. No global
  // "last cover" fallback: that key belongs to whatever song was launched last.
  const sessionCover = typeof sessionStorage !== 'undefined'
    ? sessionStorage.getItem(`active_cover_url_${songId}`)
    : null;
  const activeCoverUrl = result?.coverUrl || sessionCover || song?.coverArt || '/data/covers/default.jpg';

  useEffect(() => {
    const originFallback = (() => {
      const o = songId ? (sessionStorage.getItem(`game_origin_${songId}`) ?? '') : '';
      return o === 'songs' ? '/songs' : o ? `/${o}` : '/campaign';
    })();
    if (!songId) { setLocation(originFallback); return; }
    const raw = sessionStorage.getItem(`result_${songId}`);
    if (!raw) { setLocation(originFallback); return; }
    const data = JSON.parse(raw) as ResultData;
    if (!data.medal) data.medal = 'NONE';
    if (data.perfectPlus === undefined) data.perfectPlus = 0;
    setResult(data);
    setGameOrigin(sessionStorage.getItem(`game_origin_${songId}`) ?? '');
    runTokenRef.current = sessionStorage.getItem(`run_token_${songId}`);
    const prev = getHighScore(songId);
    if (data.score >= prev) setIsNew(true);

    // Log game end telemetry event
    logAnalyticsEvent('game_end', {
      songId: songId,
      score: data.score,
      accuracy: data.total > 0 ? Number((((data.perfectPlus * 1.0 + data.perfects * 0.9 + data.goods * 0.5) / data.total) * 100).toFixed(2)) : 0,
      maxCombo: data.maxCombo,
      medal: data.medal,
      perfectPlus: data.perfectPlus,
      perfects: data.perfects,
      goods: data.goods,
      misses: data.misses,
      totalNotes: data.total,
      continuesUsed: data.continuesUsed || 0,
      completed: !data.failed
    });

    Promise.all([getSongById(songId), loadCatalog()])
      .then(([fetched, catalog]) => {
        // Copy before overriding coverArt: getSongById can hand back the cached catalog entry.
        const effectiveCover = data.coverUrl || sessionCover;
        const s = fetched && effectiveCover ? { ...fetched, coverArt: effectiveCover } : fetched;
        setSong(s);
        if (s && s.date) {
          const month = parseInt(s.date.split('-')[1], 10);
          setChapterMonth(month);
          const sorted = [...catalog].sort((a, b) => a.day - b.day);
          const idx = sorted.findIndex(c => c.id === s.id);
          const nextReleased = sorted.slice(idx + 1).find(c => !isSongTimeLocked(c));
          if (nextReleased && nextReleased.date) {
            const cMonth = parseInt(nextReleased.date.split('-')[1], 10);
            const monthSongs = sorted.filter(c => c.date && parseInt(c.date.split('-')[1], 10) === cMonth);
            const bonusStart = monthSongs.length - 5;
            const cidx = monthSongs.findIndex(c => c.id === nextReleased.id);
            if (monthSongs.length > 5 && cidx >= bonusStart) {
              const regularIds = monthSongs.slice(0, bonusStart).map(c => c.id);
              if (getChapterPlatinums(regularIds) >= (CHAPTER_PLAT_NEEDED[cMonth] ?? 5))
                setNextSong(nextReleased);
            } else {
              setNextSong(nextReleased);
            }
          }
        }
      })
      .catch(() => {})
      .finally(() => setReady(true));

    // Preload SFX
    audioManager.loadSfx('gold_get');
    audioManager.loadSfx('silver_get');
    audioManager.loadSfx('bronze_get');
    audioManager.loadSfx('platinum_get');
    audioManager.loadSfx('reveal');
    audioManager.loadSfx('open_chest');
    audioManager.loadSfx('bing_before_platinum');
    audioManager.loadSfx('queue_before_mythic');

    // Random results ambient music
    const ambientTracks = ['results', 'results2'];
    const pick = ambientTracks[Math.floor(Math.random() * ambientTracks.length)];
    const ambientAudio = new Audio(`/audio/sfx/${encodeURIComponent(pick)}.wav`);
    ambientAudio.loop = true;
    ambientAudio.volume = 0;

    let mounted = true;
    const playPromise = ambientAudio.play();
    if (playPromise !== undefined) {
      playPromise.then(() => {
        if (!mounted) {
          ambientAudio.pause();
          ambientAudio.src = '';
          ambientAudio.removeAttribute('src');
          try { ambientAudio.load(); } catch {}
        }
      }).catch(() => {});
    }

    // Fade in gently
    const fadeIn = setInterval(() => {
      if (!mounted) {
        clearInterval(fadeIn);
        return;
      }
      if (ambientAudio.volume < 0.14) ambientAudio.volume += 0.02;
      else { ambientAudio.volume = 0.15; clearInterval(fadeIn); }
    }, 60);

    return () => {
      mounted = false;
      clearInterval(fadeIn);
      ambientAudio.pause();
      ambientAudio.src = '';
      ambientAudio.removeAttribute('src');
      try { ambientAudio.load(); } catch {}
    };
  }, [songId, setLocation]);

  // Weighted accuracy
  const total = result?.total || 1;
  const accuracy = result
    ? ((result.perfectPlus * 1.0 + result.perfects * 0.9 + result.goods * 0.5) / total) * 100
    : 0;

  // A top-tier clear of the standard chart unlocks the song's Deluxe chart
  const deluxeDay = song?.day && song.day >= 1 && song.day <= 365 ? song.day : null;
  const deluxeHadUnlock = useRef<boolean | null>(null);
  if (deluxeHadUnlock.current === null && deluxeDay) deluxeHadUnlock.current = hasEarnedDeluxe(deluxeDay);
  const earnsDeluxe = !!result && !result.failed && !!deluxeDay && !isDeluxeSongId(songId) &&
    accuracy >= DELUXE_UNLOCK_ACCURACY &&
    (!loadOpts().noteGenerationSource || loadOpts().noteGenerationSource === 'auto');
  useEffect(() => {
    if (earnsDeluxe && deluxeDay) markDeluxeEarned(deluxeDay);
  }, [earnsDeluxe, deluxeDay]);

  const user = useAuthStore(s => s.user);
  const setShowAuthModal = useAuthStore(s => s.setShowAuthModal);
  const setShowIdentityModal = useAuthStore(s => s.setShowIdentityModal);
  const collection = useVaultStore(s => s.collection);
  const fragments = useVaultStore(s => s.fragments);
  const loadVaultData = useVaultStore(s => s.loadVaultData);
  const username = useVaultStore(s => s.username);
  const syncHighScore = useVaultStore(s => s.syncHighScore);
  const [claimStatus, setClaimStatus] = useState<'idle' | 'checking' | 'ready' | 'claiming' | 'claimed' | 'failed'>('idle');
  const [alreadyClaimedTiers, setAlreadyClaimedTiers] = useState<Set<string>>(new Set());
  const [isOnboardingModalOpen, setIsOnboardingModalOpen] = useState(false);

  const shareable = (): ShareableRun => ({
    songId: songId!,
    title: song?.title || `Day ${song?.day || songId}`,
    score: result!.score,
    medal: result!.medal,
    accuracy,
    maxCombo: result!.maxCombo,
    fullCombo: !result!.failed && result!.goods === 0 && result!.misses === 0,
  });
  const handleShareRun = () => {
    audioManager.playSfx('tap_nav', 0.15);
    return shareRun(shareable());
  };

  const handleCastScore = async () => {
    audioManager.playSfx('tap_nav', 0.15);
    if (!result) return;
    const acc = result.total > 0 ? Math.round(((result.perfectPlus + result.perfects + result.goods * 0.5) / result.total) * 100) : 0;
    const songTitle = song?.title || `Day ${song?.day || songId}`;
    const shareText = `⚡ Locked in ${result.medal} medal on "${songTitle}" in PIM : th3v4ult!\n\nScore: ${result.score.toLocaleString()} | Acc: ${acc}% | Max Combo: ${result.maxCombo}x\n\nCan you beat my signal? 🎛️`;
    // The share link opens the song and gives the cast a card of this run.
    const embedUrl = runShareUrl(shareable());
    await farcasterService.composeCast({
      text: shareText,
      embeds: [embedUrl],
      channelKey: 'base',
    });
  };

  useEffect(() => {
    if (user) {
      loadVaultData().catch(err => console.warn("Failed to load vault data inside GameResults", err));
    }
  }, [user, loadVaultData]);

  // Sync high score to leaderboard when user is authenticated with a picked username
  // Ensures a run token exists first (mints a fallback if the countdown-time
  // mint failed); submit_score requires one as anti-replay proof. Tokens are
  // single-use: each submission path must use its own, so the pack-claim
  // path below passes forceFresh.
  const ensureRunToken = async (forceFresh = false): Promise<string | null> => {
    if (!forceFresh && runTokenRef.current) return runTokenRef.current;
    if (!songId) return null;
    try {
      const { token } = await requestRunToken(songId);
      if (token) {
        runTokenRef.current = token;
        try { sessionStorage.setItem(`run_token_${songId}`, token); } catch { /* ignore */ }
      }
    } catch { /* guests/offline: no token, no submit */ }
    return runTokenRef.current;
  };

  useEffect(() => {
    if (result && songId && user && !user.is_anonymous && username) {
      (async () => {
        const runToken = await ensureRunToken();
        syncHighScore(
          songId,
          result.score,
          parseFloat(accuracy.toFixed(2)),
          result.maxCombo,
          result.medal,
          undefined,
          runToken ?? undefined
        );
      })().catch(err => console.warn('Failed to sync high score:', err));
    }
  }, [user, username, result, songId, accuracy, syncHighScore]);

  // Accuracy → Pack tier mapping (per Growth Funnel spec)
  type ClaimableTier = 'free' | 'taste' | 'special_picks' | 'alpha' | 'prophecy';
  const TIER_ORDER: Record<string, number> = {
    none: 0, free: 1, common: 1,
    taste: 2, rare: 2,
    special_picks: 3,
    alpha: 4,
    prophecy: 5,
  };

  function getTierForAccuracy(acc: number): ClaimableTier {
    if (acc >= 97) return 'prophecy';      // SS / Perfect
    if (acc >= 93) return 'alpha';         // S rank
    if (acc >= 80) return 'special_picks'; // A rank
    if (acc >= 60) return 'taste';         // B rank
    return 'free';                          // D-C rank
  }

  const currentTier = getTierForAccuracy(accuracy);
  const currentTierValue = TIER_ORDER[currentTier] ?? 0;

  // Check if reward has already been claimed at this tier or higher
  useEffect(() => {
    if (!result || result.medal === 'NONE' || !user || !songId) return;

    async function checkClaim() {
      setClaimStatus('checking');
      // Baselining maxClaimedTierValue from localStorage first
      const localTier = localStorage.getItem(`reward_tier_${songId}`);
      let maxClaimedTierValue = localTier ? (TIER_ORDER[localTier] ?? 0) : -1;

      const claimedSet = new Set<string>();
      if (localTier) {
        const localVal = TIER_ORDER[localTier] ?? 0;
        for (const [key, val] of Object.entries(TIER_ORDER)) {
          if (val > 0 && val <= localVal) {
            claimedSet.add(key);
          }
        }
      }

      try {
        const { data, error } = await supabase
          .from('gameplay_records')
          .select('reward_tier')
          .eq('user_id', user!.id)
          .eq('song_id', songId!)
          .eq('pack_rewarded', true);
        
        if (error) throw error;
        
        if (data && data.length > 0) {
          for (const row of data) {
            if (row.reward_tier) claimedSet.add(row.reward_tier);
          }
          // Find the highest tier already claimed
          maxClaimedTierValue = data.reduce((max: number, row: any) => {
            const tv = TIER_ORDER[row.reward_tier ?? 'none'] ?? 0;
            return Math.max(max, tv);
          }, maxClaimedTierValue);
        }
      } catch (e) {
        console.warn('Failed to query gameplay_records from Supabase (using localStorage baseline):', e);
      }

      setAlreadyClaimedTiers(claimedSet);

      const isPlatinum = result.medal === 'PLATINUM' || accuracy >= 93;
      let hasUnclaimedTiers = false;
      if (isPlatinum) {
        const TIERS: ClaimableTier[] = ['free', 'taste', 'special_picks', 'alpha', 'prophecy'];
        for (const t of TIERS) {
          if (TIER_ORDER[t] <= TIER_ORDER[currentTier]) {
            if (!claimedSet.has(t)) {
              hasUnclaimedTiers = true;
              break;
            }
          }
        }
      } else {
        hasUnclaimedTiers = currentTierValue > maxClaimedTierValue;
      }

      if (hasUnclaimedTiers) {
        setClaimStatus('ready');
      } else {
        setClaimStatus('claimed');
      }
    }
    checkClaim();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result, songId, user]);

  const handleClaimReward = async () => {
    if (claimStatus !== 'ready' || !user || !result || !songId) return;
    // Defense in depth: prizes require the card AND Award Play unlocked for this song.
    if (!isEligibleForReward) {
      console.warn('[GameResults] Reward claim blocked: not eligible (ownership / award-play / modifier).');
      setClaimStatus('failed');
      return;
    }
    setClaimStatus('claiming');
    const isPlatinum = result.medal === 'PLATINUM' || accuracy >= 93;
 
    try {
      if (tiersToClaim.length === 0) {
        setClaimStatus('claimed');
        return;
      }

      const size = 'single';
      const allCards: OwnedCard[] = [];

      // Record this run before asking for packs: vault-engine grants each tier only
      // against the player's best server-recorded accuracy for the song.
      const { error: runErr } = await submitGameplayRecord({
        songId,
        score: result.score,
        accuracy: Number(accuracy.toFixed(2)),
        maxCombo: result.maxCombo,
        medal: result.medal,
        packRewarded: false,
        rewardTier: 'none',
        runToken: (await ensureRunToken(true)) ?? undefined,
      });
      if (runErr) {
        console.warn('Failed to record run before reward claim:', runErr);
      }

      for (const tier of tiersToClaim) {
        const cards = await purchasePack(tier, size, undefined, undefined, true, { songId });
        if (cards && cards.length > 0) {
          allCards.push(...cards);
        }
      }

      if (allCards.length > 0) {
        // Unconditionally cache the highest tier locally to prevent race conditions or back-button exploit
        localStorage.setItem(`reward_tier_${songId}`, currentTier);
 
        // Save score record to Supabase (single entry for the highest tier unlocked)
        const highestTierClaimed = tiersToClaim[tiersToClaim.length - 1] || currentTier;
        const mappedTier = (
          {
            free: 'common',
            taste: 'enhanced',
            special_picks: 'rare',
            alpha: 'epic',
            prophecy: 'legendary'
          }[highestTierClaimed] || highestTierClaimed
        );

        const { error: dbErr } = await submitGameplayRecord({
          songId,
          score: result.score,
          accuracy: Number(accuracy.toFixed(2)),
          maxCombo: result.maxCombo,
          medal: result.medal,
          packRewarded: true,
          rewardTier: mappedTier,
          // Fresh token: the high-score path above already consumed the
          // countdown token, and tokens are single-use.
          runToken: (await ensureRunToken(true)) ?? undefined,
        });
        
        if (dbErr) {
          console.warn('Failed to submit gameplay_records via submit_score RPC:', dbErr);
        }
 
        // Add to collection in store
        useVaultStore.getState().addToCollection(allCards);
        // Sync claimed rewards in store
        useVaultStore.getState().syncClaimedRewards(songId, tiersToClaim);
 
        // Setup reveal metadata and start reveal
        const cfg = PACK_CONFIGS[currentTier];
        useVaultStore.getState().startReveal(allCards, {
          category: currentTier,
          size,
          label: isPlatinum 
            ? `PLATINUM REWARD BUNDLE (${allCards.length} CARDS)` 
            : `${cfg?.label || currentTier.toUpperCase()} — ${result.medal} CLEAR`,
          icon: isPlatinum ? '🏆' : (cfg?.icon || '🏆'),
          accent: cfg?.accent || '#ffd700',
          gradient: cfg?.gradient || 'linear-gradient(145deg, #1a1200, #0c0800)',
          price: 'EARNED',
          cardCount: allCards.length,
          revealType: 'cinematic',
        });
 
        // Clear result session storage to prevent going back to this results screen
        sessionStorage.removeItem(`result_${songId}`);
 
        // Go to reveal page
        audioManager.playSfx('open_chest', 0.9);
        setLocation('/vault/reveal');
      } else {
        setClaimStatus('failed');
      }
    } catch (err) {
      console.error('Failed to claim reward pack:', err);
      setClaimStatus('failed');
    }
  };

  if (!ready || !result) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: isAvant ? '#050505' : '#080808' }}>
        <div className="font-mono text-xs tracking-widest animate-pulse" style={{ color: isAvant ? '#39FF14' : 'rgba(255,255,255,0.3)' }}>LOADING...</div>
      </div>
    );
  }

  // ── CAMPAIGN path: passed/failed, replay availability, next stage ─────────
  if (result.mode === 'campaign' && songId) {
    return <CampaignResults songId={songId} song={song} result={result} accuracy={accuracy} coverUrl={activeCoverUrl} />;
  }

  // On-demand plays (collection, codex, award play, search) go back where they came from.
  const onDemandBack = gameOrigin === 'songs' ? '/songs' : gameOrigin ? `/${gameOrigin}` : `/chapter/${chapterMonth}`;
  const onDemandBackLabel = gameOrigin === 'songs' ? 'AWARD PLAY'
    : gameOrigin.includes('collection') ? 'COLLECTION'
    : gameOrigin.includes('codex') || gameOrigin.startsWith('song') ? 'CODEX'
    : gameOrigin.startsWith('chapter/') ? 'CHAPTER'
    : 'VAULT';

  const medal = MEDALS[result.medal] ?? MEDALS.NONE;
  const acc = Math.round(accuracy);
  const fromFreePlay = gameOrigin === 'songs';
  const backRoute = onDemandBack;

  // Card ownership check (centralized) + Award Play unlock (10 shards for this song)
  const ownsCard = song ? ownsCardForDay(collection, song.day) : false;
  const awardUnlocked = song ? isAwardPlayUnlocked(fragments, song.day) : false;
  const shardCount = song ? getShardsForDay(fragments, song.day) : 0;

  // Pack reward eligibility (Owned Play + Award Play unlocked + default difficulty + no modifier cards)
  const activeMod = sessionStorage.getItem(`active_modifier_type_${songId}`);
  const hasModifier = activeMod && activeMod !== 'none';
  const diffOverride = sessionStorage.getItem(`diff_override_${songId}`);
  const diffVal = diffOverride ? parseInt(diffOverride, 10) : NaN;
  // Difficulty modifier only disqualifies in Award Play (fromFreePlay)
  const hasDiffModified = fromFreePlay && !isNaN(diffVal) && song && diffVal !== song.difficultyLevel;
  const isEligibleForReward = ownsCard && awardUnlocked && !hasModifier && !hasDiffModified;

  // Pre-calculate tiers to claim
  const isPlatinum = result ? (result.medal === 'PLATINUM' || accuracy >= 93) : false;
  const tiersToClaim: ClaimableTier[] = [];
  if (result) {
    if (isPlatinum) {
      const TIERS: ClaimableTier[] = ['free', 'taste', 'special_picks', 'alpha', 'prophecy'];
      for (const t of TIERS) {
        if (TIER_ORDER[t] <= TIER_ORDER[currentTier]) {
          if (!alreadyClaimedTiers.has(t)) {
            tiersToClaim.push(t);
          }
        }
      }
    } else {
      const localTier = localStorage.getItem(`reward_tier_${songId}`);
      let maxVal = localTier ? (TIER_ORDER[localTier] ?? 0) : -1;
      for (const t of alreadyClaimedTiers) {
        const val = TIER_ORDER[t] ?? 0;
        if (val > maxVal) maxVal = val;
      }
      if (currentTierValue > maxVal) {
        tiersToClaim.push(currentTier);
      }
    }
  }

  const rOpts = loadOpts();
  const isPractice = !!rOpts.noteGenerationSource && rOpts.noteGenerationSource !== 'auto';
  const blockedReason = !ownsCard
    ? "NO AWARDS // YOU DON'T OWN THIS CARD"
    : !awardUnlocked
    ? `NO AWARDS // AWARD PLAY NOT UNLOCKED (${shardCount}/10 SHARDS)`
    : 'NO AWARDS // MODIFIER OR DIFFICULTY OVERRIDE ON';

  // ── ON-DEMAND path (cleared and failed, classic and avant-garde) ────────
  return (
    <>
      <OnDemandResults
        key={songId}
        songId={songId!}
        song={song}
        result={result}
        accuracy={accuracy}
        coverUrl={activeCoverUrl}
        theme={isAvant ? 'avant' : 'classic'}
        medalMessage={medal.message}
        isNewBest={isNew}
        isPractice={isPractice}
        fromFreePlay={fromFreePlay}
        backRoute={backRoute}
        backLabel={onDemandBackLabel}
        nextSong={nextSong}
        deluxe={deluxeDay && !isDeluxeSongId(songId) ? {
          unlockAccuracy: DELUXE_UNLOCK_ACCURACY,
          justUnlocked: earnsDeluxe && !deluxeHadUnlock.current,
          unlocked: earnsDeluxe || isDeluxeUnlocked(collection, deluxeDay),
          playPath: `/play/${deluxeSongId(deluxeDay)}`,
        } : undefined}
        reward={{
          eligible: isEligibleForReward,
          blockedReason,
          status: claimStatus,
          tiers: tiersToClaim,
          currentTier,
          onClaim: handleClaimReward,
        }}
        account={{
          state: !user || user.is_anonymous ? 'guest' : !username ? 'needs-username' : 'ready',
          username: username ?? '',
          onConnect: () => setShowAuthModal(true),
          onClaimUsername: () => setShowIdentityModal(true),
        }}
        onCast={handleCastScore}
        onShare={handleShareRun}
        onNavigate={setLocation}
        quickReturn={<QuickReturnGrid onNavigate={setLocation} />}
      />
      <OnboardingFlowModal
        isOpen={isOnboardingModalOpen}
        onClose={() => setIsOnboardingModalOpen(false)}
        gameStats={{
          accuracy: acc,
          notesHit: result.total,
          maxCombo: result.maxCombo,
          songTitle: song?.title,
          dayNumber: song?.day,
        }}
      />
    </>
  );
}
