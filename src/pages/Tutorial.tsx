import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { audioManager } from "../game/audio";
import { getCurrentDay } from "../utils/dayCalc";
import { getCardByDay, claimDailyCard } from "../services/vaultService";
import { loadCatalog, type GameSong } from "../game/api";
import Card from "../components/Card";
import PackContainer from "../components/cinematic/PackContainer";
import type { RevealPackMeta } from "../store/useVaultStore";
import type { OwnedCard } from "../services/vaultService";
import {
  Volume2,
  Award,
  Zap,
  Shield,
  Layers,
  Lock,
  RotateCcw,
  Sparkles,
  User,
  Check,
  X,
  Loader2,
  Camera,
  ChevronRight,
  Flame,
  Globe,
  Radio,
  Music,
  Disc,
  Wallet,
  Key,
  Copy,
  ExternalLink,
  ShieldCheck,
  CheckCircle,
} from "lucide-react";
import { supabase } from "../services/supabaseClient";
import { useVaultStore } from "../store/useVaultStore";
import { useAuthStore } from "../store/useAuthStore";
import { farcasterService } from "../services/farcasterService";
import { CYBER_AVATAR_PRESETS, type AvatarPreset } from "../utils/avatarPresets";
import { getIdenticon } from "../utils/identicon";

type TutorialPhase = "intro" | "results" | "pack" | "ecosystem" | "identity" | "connector" | "complete";

export default function Tutorial() {
  const [, setLocation] = useLocation();
  const [tutPhase, setTutPhase] = useState<TutorialPhase>("intro");
  const [dailyCard, setDailyCard] = useState<any>(null);
  const [dailySong, setDailySong] = useState<GameSong | null>(null);
  const [catalog, setCatalog] = useState<GameSong[]>([]);
  const [score, setScore] = useState(0);

  // Replay check
  const [isReplay, setIsReplay] = useState(false);

  // Signed-in users replaying the tutorial skip first-run onboarding side effects:
  // no duplicate welcome pack, no username re-pick, no profile re-save.
  const authUser = useAuthStore((s) => s.user);
  const skipFirstRunSteps = isReplay && !!authUser;

  // 2-Card Welcome Pack State
  const [welcomeCards, setWelcomeCards] = useState<OwnedCard[]>([]);
  const [hasPreparedPack, setHasPreparedPack] = useState(false);

  // Ecosystem Dossier Tab
  const [activeDossierTab, setActiveDossierTab] = useState<number>(0);

  // Pilot Identity State (Forced on Web, Auto on Farcaster)
  const [isFarcaster, setIsFarcaster] = useState(false);
  const [fcUser, setFcUser] = useState<any>(null);
  const [username, setUsername] = useState("");
  const [selectedAvatarUrl, setSelectedAvatarUrl] = useState<string | null>(null);
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [isValidFormat, setIsValidFormat] = useState(true);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  const [isSavingIdentity, setIsSavingIdentity] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Phase 6: Wallet Connector State
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [isConnectingWallet, setIsConnectingWallet] = useState(false);
  const [walletCopied, setWalletCopied] = useState(false);

  // 1. Initial Load: Daily Song, Card, Catalog & URL Params
  useEffect(() => {
    async function load() {
      try {
        const today = getCurrentDay();
        const card = await getCardByDay(today);
        setDailyCard(card);

        const loadedCatalog = await loadCatalog();
        setCatalog(loadedCatalog);

        const matched =
          loadedCatalog.find((s) => s.day === today) ||
          loadedCatalog.find((s) => s.id === card?.id) ||
          loadedCatalog.find((s) => s.day === today % (loadedCatalog.length || 1)) ||
          loadedCatalog[0];
        setDailySong(matched);

        // Check Farcaster
        farcasterService.init();
        const isFc = farcasterService.isFarcaster();
        const user = farcasterService.getUser();
        setIsFarcaster(isFc);
        setFcUser(user);
        if (user?.username) {
          setUsername(user.username);
        }
        if (user?.pfpUrl) {
          setSelectedAvatarUrl(user.pfpUrl);
        }
      } catch (err) {
        console.error("Failed to load onboarding daily metadata:", err);
      }
    }
    load();

    const completed =
      localStorage.getItem("pim_tutorial_completed") === "true" ||
      useVaultStore.getState().progression.tutorialCompleted;
    setIsReplay(completed);

    const params = new URLSearchParams(window.location.search);
    const phaseParam = params.get("phase");
    const scoreParam = params.get("score");
    if (phaseParam === "results") {
      setTutPhase("results");
      if (scoreParam) {
        setScore(parseInt(scoreParam, 10) || 0);
      }
    }
  }, []);

  // 2. Prepare 2-Card Welcome Pack (Daily Song Card + Random Other Card)
  // Skipped for signed-in users replaying the tutorial (no duplicate pack).
  useEffect(() => {
    if (!dailyCard || catalog.length === 0 || hasPreparedPack) return;
    if (skipFirstRunSteps) return;

    async function preparePack() {
      setHasPreparedPack(true);
      const today = getCurrentDay();

      // Card 1: Guaranteed Song of the Day Card
      const sotdOwned: OwnedCard = {
        id: `welcome-${dailyCard.id}`,
        cardId: dailyCard.id,
        claimedAt: new Date().toISOString(),
        source: "daily_claim",
        edition: 1,
        maxSupply: dailyCard.maxSupply || 500,
        isEcho: false,
        blockchainStatus: "off-chain",
        card: dailyCard,
      };

      // Card 2: Random Other Card from the 365 Catalog
      const candidates = catalog.filter(
        (s) => s.id !== dailyCard.id && s.day !== today
      );
      const randomSong =
        candidates[Math.floor(Math.random() * candidates.length)] || catalog[0];
      const randomCardData = await getCardByDay(randomSong.day || 1);

      const finalRandomCard = randomCardData || {
        id: randomSong.id,
        day: randomSong.day || 1,
        title: randomSong.title,
        artist: randomSong.artist,
        rarity: "uncommon",
        coverUrl: randomSong.coverArt,
        audioUrl: randomSong.audioUrl,
        mood: randomSong.mood || "dark",
        energy: 0.7,
        valence: 0.6,
        tempo: randomSong.bpm || 120,
        maxSupply: 500,
      };

      const randomOwned: OwnedCard = {
        id: `welcome-random-${finalRandomCard.id}`,
        cardId: finalRandomCard.id,
        claimedAt: new Date().toISOString(),
        source: "taste",
        edition: 1,
        maxSupply: finalRandomCard.maxSupply || 500,
        isEcho: false,
        blockchainStatus: "off-chain",
        card: finalRandomCard,
      };

      const pack = [sotdOwned, randomOwned];
      setWelcomeCards(pack);
      useVaultStore.getState().addToCollection(pack);
    }

    preparePack();
  }, [dailyCard, catalog, hasPreparedPack, skipFirstRunSteps]);

  // 3. Debounced Username Validation
  useEffect(() => {
    if (isFarcaster && fcUser?.username) {
      setIsValidFormat(true);
      setIsAvailable(true);
      return;
    }

    if (username.length < 3) {
      setIsValidFormat(username.length === 0);
      setIsAvailable(null);
      return;
    }

    const valid = /^[a-zA-Z0-9_\-.]+$/.test(username) && username.length <= 20;
    setIsValidFormat(valid);
    if (!valid) {
      setIsAvailable(null);
      return;
    }

    setIsCheckingUsername(true);
    const timeoutId = setTimeout(async () => {
      try {
        const clean = username.trim();
        const { data } = await supabase
          .from("profiles")
          .select("id")
          .ilike("username", clean)
          .maybeSingle();

        setIsAvailable(!data);
      } catch (err) {
        setIsAvailable(true); // default allowable if offline/guest
      } finally {
        setIsCheckingUsername(false);
      }
    }, 280);

    return () => clearTimeout(timeoutId);
  }, [username, isFarcaster, fcUser]);

  // Start Phase 2 Gameplay in GamePlay Engine
  const startGameplay = useCallback(() => {
    if (!dailySong) return;
    audioManager.playSfx("select_start_song", 0.7);
    setLocation(`/play/${dailySong.id}?tutorial=true`);
  }, [dailySong, setLocation]);

  // Avatar Image Upload Processor
  const handleAvatarFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) return;
    if (file.size > 2 * 1024 * 1024) return;

    setAvatarFile(file);
    setSelectedPresetId(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      setSelectedAvatarUrl(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Avatar Preset Picker
  const handleSelectPreset = (preset: AvatarPreset) => {
    setSelectedPresetId(preset.id);
    setSelectedAvatarUrl(preset.avatarUrl);
    setAvatarFile(null);
    audioManager.playSfx("tap_nav", 0.15);
  };

  // Fetch / verify wallet status
  const refreshWalletInfo = useCallback(async () => {
    try {
      const authUser = useAuthStore.getState().user;
      let address: string | null =
        authUser?.user_metadata?.wallet_address ||
        authUser?.user_metadata?.wallet ||
        null;

      if (!address && authUser?.id) {
        const { data } = await supabase
          .from("profiles")
          .select("wallet_address")
          .eq("id", authUser.id)
          .maybeSingle();
        if (data?.wallet_address) {
          address = data.wallet_address;
        }
      }

      if (!address) {
        address = localStorage.getItem("guest_wallet_address");
      }

      if (!address) {
        const pkey = localStorage.getItem("th3vault_ephemeral_wallet_pkey");
        if (pkey) {
          try {
            const { Wallet } = await import("ethers");
            address = new Wallet(pkey).address;
          } catch (e) {
            // non-fatal
          }
        }
      }

      setWalletAddress(address || null);
    } catch (err) {
      console.warn("[Tutorial] Failed to refresh wallet status:", err);
    }
  }, []);

  useEffect(() => {
    refreshWalletInfo();
  }, [tutPhase, refreshWalletInfo]);

  // Connect Web3 / Base Smart Wallet
  const handleConnectWeb3Wallet = async () => {
    setIsConnectingWallet(true);
    audioManager.playSfx("tap_nav", 0.15);
    try {
      const res = await useAuthStore.getState().signInWithWallet();
      if (res?.error) {
        useAuthStore.getState().setShowAuthModal(true);
      } else {
        await refreshWalletInfo();
        audioManager.playSfx("gold_get", 0.5);
      }
    } catch (err) {
      console.error("[Tutorial] Wallet connection error:", err);
      useAuthStore.getState().setShowAuthModal(true);
    } finally {
      setIsConnectingWallet(false);
      await refreshWalletInfo();
    }
  };

  // Generate Ephemeral Smart Wallet
  const handleGenerateEphemeralWallet = async () => {
    setIsConnectingWallet(true);
    audioManager.playSfx("tap_nav", 0.15);
    try {
      await useAuthStore.getState().signInWithEphemeralWallet();
      await refreshWalletInfo();
      audioManager.playSfx("gold_get", 0.5);
    } catch (err) {
      console.error("[Tutorial] Ephemeral wallet generation error:", err);
    } finally {
      setIsConnectingWallet(false);
      await refreshWalletInfo();
    }
  };

  // Copy wallet address to clipboard
  const handleCopyAddress = (addr: string) => {
    navigator.clipboard.writeText(addr);
    setWalletCopied(true);
    audioManager.playSfx("tap_nav", 0.12);
    setTimeout(() => setWalletCopied(false), 2000);
  };

  // Replay finish: signed-in users replaying skip the username re-pick and the
  // profile re-save entirely — just exit the tutorial.
  const handleFinishReplay = () => {
    audioManager.playSfx("gold_get", 0.6);
    const postTutorialDest = typeof window !== 'undefined' ? sessionStorage.getItem('post_tutorial_redirect') : null;
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('post_tutorial_redirect');
    }
    const destination = postTutorialDest && postTutorialDest !== '/tutorial' ? postTutorialDest : '/arcade';
    setLocation(destination);
  };

  // Complete Identity & Finalize Onboarding
  const handleSaveIdentityAndFinish = async () => {
    if (isSavingIdentity) return;
    setIsSavingIdentity(true);

    try {
      let finalUsername = username.trim();
      let finalAvatar = selectedAvatarUrl;

      // If Farcaster user, use known credentials
      if (isFarcaster && fcUser) {
        finalUsername = fcUser.username || finalUsername || "warpcast_pilot";
        finalAvatar = fcUser.pfpUrl || finalAvatar;
      }

      // If user provided a file upload, save as webp
      const currentUser = useAuthStore.getState().user;
      if (avatarFile && currentUser) {
        try {
          const filePath = `${currentUser.id}/${currentUser.id}.webp`;
          const { error: uploadError } = await supabase.storage
            .from("avatars")
            .upload(filePath, avatarFile, { upsert: true, contentType: "image/webp" });
          if (!uploadError) {
            const { data } = supabase.storage.from("avatars").getPublicUrl(filePath);
            finalAvatar = data.publicUrl;
          }
        } catch (e) {
          console.warn("[Identity] Storage upload non-fatal fallback:", e);
        }
      }

      // Update Supabase profile
      if (currentUser) {
        await supabase
          .from("profiles")
          .update({
            username: finalUsername,
            display_name: finalUsername,
            avatar_url: finalAvatar,
            ...(walletAddress ? { wallet_address: walletAddress } : {}),
            has_onboarded: true,
          })
          .eq("id", currentUser.id);
      }

      // Update local store
      const { updateProfile, completeOnboarding } = useVaultStore.getState();
      if (updateProfile) {
        await updateProfile(finalUsername, finalAvatar, finalUsername).catch(() => {});
      }
      if (completeOnboarding) {
        await completeOnboarding().catch(() => {});
      }

      // Mark tutorial completed permanently
      localStorage.setItem("pim_tutorial_completed", "true");
      useVaultStore.getState().updateProgression({ tutorialCompleted: true });

      audioManager.playSfx("gold_get", 0.6);
      const postTutorialDest = typeof window !== 'undefined' ? sessionStorage.getItem('post_tutorial_redirect') : null;
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('post_tutorial_redirect');
      }
      const destination = postTutorialDest && postTutorialDest !== '/tutorial' ? postTutorialDest : '/arcade';
      setLocation(destination);
    } catch (err) {
      console.error("Failed to complete pilot identity setup:", err);
      // Fallback mark complete
      localStorage.setItem("pim_tutorial_completed", "true");
      useVaultStore.getState().updateProgression({ tutorialCompleted: true });
      const { completeOnboarding } = useVaultStore.getState();
      if (completeOnboarding) {
        await completeOnboarding().catch(() => {});
      }
      const postTutorialDest = typeof window !== 'undefined' ? sessionStorage.getItem('post_tutorial_redirect') : null;
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('post_tutorial_redirect');
      }
      const destination = postTutorialDest && postTutorialDest !== '/tutorial' ? postTutorialDest : '/arcade';
      setLocation(destination);
    } finally {
      setIsSavingIdentity(false);
    }
  };

  // Welcome Pack metadata configuration (2-Card Pack)
  const welcomePackMeta: RevealPackMeta = {
    category: "taste",
    size: "double",
    label: "WELCOME TRANSMISSION // DUAL",
    icon: "⚡",
    accent: "#39FF14",
    gradient: "linear-gradient(160deg, #050d03 0%, #0d280b 45%, #020702 100%)",
    price: "FREE",
    cardCount: 2,
    revealType: "cinematic",
  };

  // Ecosystem Dossier Tabs Definition
  const DOSSIER_TABS = [
    {
      id: "collectibles",
      badge: "COLLECTIBLES",
      title: "SONGS AS OWNED CARDS",
      icon: Disc,
      accent: "#FF1493",
      content: (
        <div className="space-y-3 font-mono text-[11px] text-zinc-300 leading-relaxed text-left">
          <p className="text-white font-bold">
            In PIM, music is not just streamed — it is <span className="text-[#FF1493]">owned and mastered</span>.
          </p>
          <div className="space-y-2 border-t border-white/10 pt-3 text-[10.5px]">
            <p>
              • <strong className="text-white">Full Playback & Stems:</strong> Owning a song card unlocks the full master track and isolated stem mixing (Bass, Vocals, Drums).
            </p>
            <p>
              • <strong className="text-white">Deck Building:</strong> Equipped card collections boost score multipliers and unlock custom stage visualizer skins.
            </p>
            <p>
              • <strong className="text-white">Preview Limits:</strong> Unowned cards have limited preview timers; unlocking cards removes all barriers permanently.
            </p>
          </div>
        </div>
      ),
    },
    {
      id: "award_play",
      badge: "SKILL ECONOMY",
      title: "AWARD PLAY & MEDALS",
      icon: Award,
      accent: "#39FF14",
      content: (
        <div className="space-y-3 font-mono text-[11px] text-zinc-300 leading-relaxed text-left">
          <p className="text-white font-bold">
            High accuracy unlocks tokens, medal certifications, and leaderboard prestige.
          </p>
          <div className="grid grid-cols-2 gap-2 border-t border-white/10 pt-3 text-[10px]">
            <div className="p-2 border border-[#CD7F32]/40 bg-[#CD7F32]/10 rounded">
              <span className="text-[#CD7F32] font-black block">BRONZE (&gt;70%)</span>
              Baseline clearance
            </div>
            <div className="p-2 border border-[#C0C0C0]/40 bg-[#C0C0C0]/10 rounded">
              <span className="text-[#C0C0C0] font-black block">SILVER (&gt;85%)</span>
              Advanced timing
            </div>
            <div className="p-2 border border-[#FFD700]/40 bg-[#FFD700]/10 rounded">
              <span className="text-[#FFD700] font-black block">GOLD (&gt;95%)</span>
              Master class accuracy
            </div>
            <div className="p-2 border border-[#E0E0FF]/40 bg-[#E0E0FF]/10 rounded">
              <span className="text-[#E0E0FF] font-black block">PLATINUM (100%)</span>
              Full combo perfection
            </div>
          </div>
          <p className="text-[10px] text-zinc-400 mt-2">
            Medal milestones award <strong className="text-yellow-400">$V⚡ tokens</strong> for forging and targeted pulls.
          </p>
        </div>
      ),
    },
    {
      id: "campaign",
      badge: "365 RELEASES",
      title: "THE 365-DAY CAMPAIGN",
      icon: Globe,
      accent: "#00E5FF",
      content: (
        <div className="space-y-3 font-mono text-[11px] text-zinc-300 leading-relaxed text-left">
          <p className="text-white font-bold">
            A brand-new song drops every single calendar day of the year.
          </p>
          <div className="space-y-2 border-t border-white/10 pt-3 text-[10.5px]">
            <p>
              • <strong className="text-white">12 Monthly Chapters:</strong> Travel across constellation roadmap stages and unlock milestone reward chests.
            </p>
            <p>
              • <strong className="text-white">Daily Drops:</strong> Every 24 hours brings a fresh daily card claim and competitive daily leaderboard stage.
            </p>
            <p>
              • <strong className="text-white">Time-Locked Archival:</strong> Unclaimed drops rotate into the vault archive, accessible via the Forge.
            </p>
          </div>
        </div>
      ),
    },
    {
      id: "rarity_odds",
      badge: "SUPPLY CAPS",
      title: "RARITY TIERS & GACHA ODDS",
      icon: Sparkles,
      accent: "#FFD700",
      content: (
        <div className="space-y-3 font-mono text-[11px] text-zinc-300 leading-relaxed text-left">
          <p className="text-white font-bold">
            Velocity-balanced hard supply caps protect rarity and value.
          </p>
          <div className="space-y-1.5 border-t border-white/10 pt-2.5 text-[10px]">
            <div className="flex justify-between border-b border-white/5 pb-1">
              <span className="text-zinc-400">COMMON</span>
              <span className="text-white font-bold">2,000 Copies (Gameplay)</span>
            </div>
            <div className="flex justify-between border-b border-white/5 pb-1">
              <span className="text-[#00E5FF]">UNCOMMON</span>
              <span className="text-white font-bold">500 Copies (50 On-Chain)</span>
            </div>
            <div className="flex justify-between border-b border-white/5 pb-1">
              <span className="text-[#39FF14]">RARE</span>
              <span className="text-white font-bold">100 Copies (25 On-Chain)</span>
            </div>
            <div className="flex justify-between border-b border-white/5 pb-1">
              <span className="text-[#FFD700]">LEGENDARY</span>
              <span className="text-white font-bold">10 Copies (3 On-Chain)</span>
            </div>
            <div className="flex justify-between border-b border-white/5 pb-1">
              <span className="text-[#A855F7]">MYTHIC</span>
              <span className="text-white font-bold">1 of 1 (Mintable on Base EVM)</span>
            </div>
          </div>
          <div className="bg-white/5 p-2 rounded text-[9.5px] text-zinc-400 mt-2 space-y-1">
            <p>• <strong>Drought Pity:</strong> 25 pulls without Rare guarantees Rare+ on next pull.</p>
            <p>• <strong>Midnight Drop:</strong> 12:00 AM – 2:00 AM grants 2× Legendary drop odds.</p>
            <p>• <strong>7-Day Streak:</strong> Grants +50% boost to Rare and Legendary drop rates.</p>
          </div>
        </div>
      ),
    },
    {
      id: "forge",
      badge: "THE FORGE",
      title: "DECONSTRUCTION & FUSION",
      icon: Flame,
      accent: "#FF3800",
      content: (
        <div className="space-y-3 font-mono text-[11px] text-zinc-300 leading-relaxed text-left">
          <p className="text-white font-bold">
            The Forge is the master synthesis laboratory for card tokenomics.
          </p>
          <div className="space-y-2 border-t border-white/10 pt-3 text-[10.5px]">
            <p>
              • <strong className="text-white">Card Burning:</strong> Deconstruct unwanted or duplicate cards into <strong className="text-yellow-400">$V⚡ tokens</strong>.
            </p>
            <p>
              • <strong className="text-white">Targeted Pulls (500 $V⚡):</strong> Forge any specific card from the entire 365-day catalog on demand.
            </p>
            <p>
              • <strong className="text-white">Duplicate Fusion:</strong> Combine 3 identical cards of the same day and tier to forge 1 card of the next tier!
            </p>
          </div>
        </div>
      ),
    },
  ];

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-[#090807] text-white z-[80]">
      {/* CRT Scanline & grid screen effects */}
      <div
        className="absolute inset-0 pointer-events-none z-[99]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,20,147,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(0,229,255,0.015) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />
      <div
        className="absolute inset-0 pointer-events-none z-[99]"
        style={{
          background:
            "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0, 0, 0, 0.2) 2px, rgba(0, 0, 0, 0.2) 4px)",
        }}
      />

      {/* Decorative stomp headers */}
      <div className="absolute top-4 left-4 pointer-events-none font-mono text-[9px] text-[#00E5FF]/60 font-black tracking-widest z-10 uppercase">
        SYS_VER // PIM_VAULT_v2
      </div>
      <div className="absolute top-4 right-4 pointer-events-none font-mono text-[9px] text-[#FF1493]/60 font-black tracking-widest z-10 uppercase">
        SECTOR // FLIGHT_ACADEMY
      </div>

      {isReplay && tutPhase !== "complete" && (
        <div className="absolute top-12 left-1/2 -translate-x-1/2 bg-amber-500/20 border-2 border-black text-amber-300 font-mono text-[9px] font-black px-4 py-1.5 tracking-widest uppercase rounded-sm z-20 flex items-center gap-1.5 shadow-[4px_4px_0px_#000]">
          <Lock size={10} /> REPLAY MODE — TRAINING PRACTICE
        </div>
      )}

      <AnimatePresence mode="wait">
        {/* ── PHASE 1: INTRO BRIEFING & SONG OF THE DAY ── */}
        {tutPhase === "intro" && (
          <motion.div
            key="intro"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="flex-1 flex flex-col items-center justify-center p-6 text-center relative z-10 overflow-y-auto"
          >
            <div className="relative border-4 border-black bg-[#151311] p-8 max-w-md w-full shadow-[8px_8px_0px_#000] rounded-lg">
              {/* Corner accent blocks */}
              <div className="absolute -top-3.5 -left-3.5 w-6 h-6 bg-[#FF1493] border-4 border-black" />
              <div className="absolute -top-3.5 -right-3.5 w-6 h-6 bg-[#00E5FF] border-4 border-black" />
              <div className="absolute -bottom-3.5 -left-3.5 w-6 h-6 bg-[#39FF14] border-4 border-black" />
              <div className="absolute -bottom-3.5 -right-3.5 w-6 h-6 bg-yellow-400 border-4 border-black" />

              <div className="font-mono text-[9px] text-zinc-400 tracking-[0.4em] mb-2 uppercase font-black">
                // FLIGHT ACADEMY PROTOCOL //
              </div>
              <h1 className="font-mono text-3xl md:text-4xl font-extrabold text-white tracking-tighter mb-4 leading-none uppercase">
                CALIBRATE <br />
                <span className="text-[#FF1493]">STAGE 1</span>
              </h1>

              {/* Song of the Day Spotlight Card */}
              <div className="border-2 border-black bg-black/50 p-3 rounded mb-5 flex items-center gap-3 text-left">
                {dailySong?.coverArt ? (
                  <img
                    src={dailySong.coverArt}
                    alt={dailySong.title}
                    className="w-14 h-14 rounded object-cover border border-white/20 shrink-0"
                  />
                ) : (
                  <div className="w-14 h-14 rounded bg-[#FF1493]/20 border border-[#FF1493] flex items-center justify-center shrink-0">
                    <Music size={24} className="text-[#FF1493]" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-mono text-[8px] text-[#39FF14] font-black tracking-widest uppercase">
                    SONG OF THE DAY // DAY {getCurrentDay()}
                  </div>
                  <div className="font-mono text-sm font-black text-white truncate uppercase">
                    {dailySong?.title || "TRANSMISSION ZERO"}
                  </div>
                  <div className="font-mono text-[10px] text-zinc-400 truncate">
                    {dailySong?.artist || "PIM CORE"} · {dailySong?.bpm || 120} BPM
                  </div>
                </div>
              </div>

              {/* Curriculum Objectives */}
              <div className="space-y-2.5 font-mono text-[11px] text-zinc-300 leading-relaxed mb-6 border-t-2 border-black pt-4 text-left">
                <div className="flex items-center justify-between text-[#00E5FF] font-black tracking-wide">
                  <span>TRAINING CURRICULUM (7 NOTE TYPES):</span>
                  <span className="text-[#39FF14] text-[9px]">3 HITS PER NOTE</span>
                </div>
                <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[9.5px]">
                  <p className="flex items-center gap-1.5">
                    <span className="text-[#39FF14] font-black">■ 01:</span>
                    <span><strong>TAP:</strong> Target line timing</span>
                  </p>
                  <p className="flex items-center gap-1.5">
                    <span className="text-[#FFD700] font-black">▬ 02:</span>
                    <span><strong>HOLD:</strong> Health regeneration</span>
                  </p>
                  <p className="flex items-center gap-1.5">
                    <span className="text-[#00E5FF] font-black">➔ 03:</span>
                    <span><strong>SWIPE:</strong> Directional flicks</span>
                  </p>
                  <p className="flex items-center gap-1.5">
                    <span className="text-[#FF69B4] font-black">⚡ 04:</span>
                    <span><strong>HOLD-SWIPE:</strong> Sustain to flick</span>
                  </p>
                  <p className="flex items-center gap-1.5">
                    <span className="text-[#7B68EE] font-black">⤹ 05:</span>
                    <span><strong>SLIDE:</strong> Cross-lane ribbons</span>
                  </p>
                  <p className="flex items-center gap-1.5">
                    <span className="text-[#FF1493] font-black">✦ 06:</span>
                    <span><strong>REMIX:</strong> Audio stem filters</span>
                  </p>
                  <p className="flex items-center gap-1.5">
                    <span className="text-[#00FFFF] font-black">▲ 07:</span>
                    <span><strong>LIFT:</strong> Precision release</span>
                  </p>
                  <p className="flex items-center gap-1.5">
                    <span className="text-yellow-400 font-black">↺ 08:</span>
                    <span><strong>REWIND:</strong> 3-miss rollback</span>
                  </p>
                </div>
              </div>

              {dailySong ? (
                <>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={startGameplay}
                    className="w-full py-4.5 bg-gradient-to-r from-[#FF1493] to-[#ff3800] text-black font-mono font-black text-xs tracking-[0.25em] uppercase hover:opacity-95 transition-all rounded border-2 border-black shadow-[4px_4px_0px_#000] cursor-pointer"
                  >
                    PROVE COMPATIBILITY [STAGE 1]
                  </motion.button>

                  {isReplay && (
                    <button
                      type="button"
                      onClick={() => {
                        audioManager.playSfx("tap_nav", 0.15);
                        setLocation("/arcade");
                      }}
                      className="mt-3 w-full py-2.5 bg-white/5 hover:bg-white/10 text-white/50 hover:text-white font-mono text-[9px] tracking-widest uppercase transition-all rounded border border-white/10 cursor-pointer"
                    >
                      EXIT TO ARCADE ➔
                    </button>
                  )}
                </>
              ) : (
                <div className="font-mono text-[10px] text-zinc-500 animate-pulse py-2">
                  DECRYPTING DAILY TRACK...
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* ── PHASE 2: STAGE 1 CLEARED RESULTS ── */}
        {tutPhase === "results" && (
          <motion.div
            key="results"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="flex-1 flex flex-col items-center justify-center p-6 text-center relative z-10"
          >
            <div className="relative border-4 border-black bg-[#151311] p-8 max-w-sm w-full shadow-[8px_8px_0px_#000] rounded-lg">
              <div className="absolute -top-3.5 -left-3.5 w-6 h-6 bg-[#FF1493] border-4 border-black" />
              <div className="absolute -top-3.5 -right-3.5 w-6 h-6 bg-[#00E5FF] border-4 border-black" />
              <div className="absolute -bottom-3.5 -left-3.5 w-6 h-6 bg-[#39FF14] border-4 border-black" />
              <div className="absolute -bottom-3.5 -right-3.5 w-6 h-6 bg-yellow-400 border-4 border-black" />

              <motion.div
                initial={{ scale: 0, rotate: -30 }}
                animate={{ scale: 1, rotate: -6 }}
                transition={{ type: "spring", stiffness: 200, damping: 12 }}
                className="w-20 h-20 mx-auto rounded-lg bg-gradient-to-br from-[#39FF14] to-[#00E5FF] border-4 border-black shadow-[5px_5px_0px_#000] flex items-center justify-center text-3xl font-black text-black mb-5"
              >
                S+
              </motion.div>

              <div className="font-mono text-[9px] text-[#39FF14] tracking-[0.4em] mb-2 uppercase font-black">
                // STAGE 1 CERTIFIED //
              </div>
              <h2 className="font-mono text-2xl font-black tracking-tighter text-white uppercase mb-5 leading-none">
                FLIGHT ACADEMY CLEARED
              </h2>

              <div className="space-y-3 border-y-2 border-black py-4 mb-6 text-left font-mono text-xs">
                <div className="flex justify-between">
                  <span className="text-zinc-500">SIGNAL INTEGRITY</span>
                  <span className="text-[#39FF14] font-bold">100.0% [STABLE]</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">REWIND TECHNIQUE</span>
                  <span className="text-[#FF1493] font-black uppercase">ACQUIRED</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">HEALING FREQUENCY</span>
                  <span className="text-[#FFD700] font-black uppercase">MASTERED</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">STAGE 1 SCORE</span>
                  <span className="text-[#00E5FF] font-black">{score}</span>
                </div>
              </div>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  audioManager.playSfx("tap_nav", 0.15);
                  setTutPhase(skipFirstRunSteps ? "ecosystem" : "pack");
                }}
                className="w-full py-4 bg-gradient-to-r from-[#39FF14] to-[#00E5FF] text-black font-mono font-black text-xs tracking-[0.2em] uppercase hover:opacity-95 transition-all rounded border-2 border-black shadow-[4px_4px_0px_#000] cursor-pointer"
              >
                {skipFirstRunSteps ? "CONTINUE" : "CLAIM 2-CARD WELCOME PACK"}
              </motion.button>
            </div>
          </motion.div>
        )}

        {/* ── PHASE 3: CINEMATIC 2-CARD PACK OPENING ── */}
        {tutPhase === "pack" && (
          <motion.div
            key="pack"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 bg-[#050402]"
          >
            {welcomeCards.length > 0 && (
              <PackContainer
                meta={welcomePackMeta}
                cards={welcomeCards}
                onComplete={() => {
                  audioManager.playSfx("tap_nav", 0.15);
                  setTutPhase("ecosystem");
                }}
              />
            )}
          </motion.div>
        )}

        {/* ── PHASE 4: INTERACTIVE ECOSYSTEM DOSSIER ── */}
        {tutPhase === "ecosystem" && (
          <motion.div
            key="ecosystem"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="flex-1 flex flex-col items-center justify-between py-6 px-4 overflow-y-auto relative z-10 max-w-xl mx-auto w-full"
          >
            <div className="text-center mt-2 w-full">
              <div className="font-mono text-[9px] text-[#00E5FF] tracking-[0.4em] mb-1 uppercase font-black">
                // SYSTEM ARCHITECTURE //
              </div>
              <h2 className="font-mono text-2xl font-black tracking-widest text-white uppercase">
                THE PIM ECOSYSTEM
              </h2>
              <p className="font-mono text-[10.5px] text-zinc-400 mt-1">
                Explore the five pillars of the rhythm economy before locking your pilot identity.
              </p>
            </div>

            {/* Dossier Navigation Pills */}
            <div className="flex flex-wrap justify-center gap-1.5 my-4 w-full">
              {DOSSIER_TABS.map((tab, idx) => {
                const isActive = activeDossierTab === idx;
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setActiveDossierTab(idx);
                      audioManager.playSfx("tap_nav", 0.12);
                    }}
                    className="px-2.5 py-1.5 rounded text-[9px] font-mono font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5"
                    style={{
                      background: isActive ? tab.accent : "rgba(255,255,255,0.05)",
                      color: isActive ? "#000" : "#a1a1aa",
                      border: `1px solid ${isActive ? tab.accent : "rgba(255,255,255,0.1)"}`,
                    }}
                  >
                    <Icon size={11} />
                    {tab.badge}
                  </button>
                );
              })}
            </div>

            {/* Active Dossier Tab Content */}
            <div className="w-full border-4 border-black bg-[#151311] p-5 shadow-[6px_6px_0px_#000] rounded-lg mb-4">
              <div className="flex items-center justify-between mb-3 border-b border-white/10 pb-2">
                <span
                  className="font-mono text-[9px] font-black uppercase px-2 py-0.5 rounded text-black tracking-widest"
                  style={{ background: DOSSIER_TABS[activeDossierTab].accent }}
                >
                  PILLAR 0{activeDossierTab + 1}
                </span>
                <span className="font-mono text-xs font-black uppercase text-white tracking-wider">
                  {DOSSIER_TABS[activeDossierTab].title}
                </span>
              </div>
              {DOSSIER_TABS[activeDossierTab].content}
            </div>

            {/* Dossier Progression Button */}
            <div className="w-full flex gap-3">
              {activeDossierTab < DOSSIER_TABS.length - 1 ? (
                <button
                  onClick={() => {
                    setActiveDossierTab((prev) => prev + 1);
                    audioManager.playSfx("tap_nav", 0.12);
                  }}
                  className="w-full py-3.5 bg-white/10 hover:bg-white/15 text-white font-mono font-black text-xs tracking-[0.2em] uppercase rounded border-2 border-black transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  NEXT PILLAR ({activeDossierTab + 2}/5) <ChevronRight size={14} />
                </button>
              ) : null}

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  audioManager.playSfx("tap_nav", 0.15);
                  setTutPhase(skipFirstRunSteps ? "connector" : "identity");
                }}
                className={`py-3.5 bg-gradient-to-r from-[#FF1493] to-[#ff3800] text-black font-mono font-black text-xs tracking-[0.25em] uppercase hover:opacity-95 transition-all rounded border-2 border-black shadow-[4px_4px_0px_#000] cursor-pointer flex items-center justify-center gap-2 ${
                  activeDossierTab === DOSSIER_TABS.length - 1 ? "w-full" : "px-6 shrink-0"
                }`}
              >
                {skipFirstRunSteps ? "PROCEED TO WALLET →" : "PROCEED TO IDENTITY →"}
              </motion.button>
            </div>
          </motion.div>
        )}

        {/* ── PHASE 5: PILOT IDENTITY (FARCASTER AUTO-PULL vs FORCED WEB) ── */}
        {tutPhase === "identity" && (
          <motion.div
            key="identity"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="flex-1 flex flex-col items-center justify-between py-6 px-4 overflow-y-auto relative z-10 max-w-md mx-auto w-full"
          >
            <div className="text-center mt-2 w-full">
              <div className="font-mono text-[9px] text-[#39FF14] tracking-[0.4em] mb-1 uppercase font-black">
                // NEURAL LINK LOCK-IN //
              </div>
              <h2 className="font-mono text-2xl font-black tracking-widest text-white uppercase">
                PILOT IDENTITY
              </h2>
              <p className="font-mono text-[10px] text-zinc-400 mt-1">
                {isFarcaster
                  ? "Verified Warpcast profile detected. Confirm identity to write card provenance."
                  : "Choose your unique pilot @username and profile avatar to record scores on leaderboards."}
              </p>
            </div>

            {/* ── Option A: Farcaster Verified User ── */}
            {isFarcaster && fcUser ? (
              <div className="w-full border-4 border-black bg-[#151311] p-6 rounded-lg shadow-[8px_8px_0px_#000] space-y-4 my-4">
                <div className="flex items-center gap-2 font-mono text-[9px] text-[#8A63D2] tracking-widest uppercase font-black">
                  <Radio size={12} className="text-[#8A63D2] animate-pulse" />
                  WARPCAST MINI APP PROTOCOL
                </div>

                <div className="flex items-center gap-4 border border-[#8A63D2]/40 bg-[#8A63D2]/10 p-3.5 rounded">
                  {fcUser.pfpUrl ? (
                    <img
                      src={fcUser.pfpUrl}
                      alt={fcUser.username}
                      className="w-16 h-16 rounded-full object-cover border-2 border-[#8A63D2]"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-[#8A63D2] flex items-center justify-center font-bold text-lg">
                      {fcUser.username?.slice(0, 2).toUpperCase() || "FC"}
                    </div>
                  )}
                  <div>
                    <div className="font-mono text-base font-black text-white uppercase">
                      @{fcUser.username}
                    </div>
                    <div className="font-mono text-[10px] text-zinc-400">
                      {fcUser.displayName || "Farcaster Pilot"} · FID {fcUser.fid}
                    </div>
                    <div className="mt-1 flex items-center gap-1 font-mono text-[9px] text-[#39FF14] font-bold">
                      <Check size={11} /> IDENTITY VERIFIED
                    </div>
                  </div>
                </div>

                <div className="font-mono text-[10.5px] text-zinc-400 leading-relaxed border-t border-white/10 pt-3">
                  Your Farcaster username and profile image will be bound to your card collection and global leaderboard telemetry.
                </div>
              </div>
            ) : (
              /* ── Option B: Forced Web Setup (Username + Avatar Selection) ── */
              <div className="w-full border-4 border-black bg-[#151311] p-5 rounded-lg shadow-[8px_8px_0px_#000] space-y-4 my-3 text-left">
                {/* 1. Username Input */}
                <div>
                  <label className="block font-mono text-[10px] text-zinc-400 uppercase font-black mb-1.5">
                    1. PILOT @USERNAME (REQUIRED)
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="e.g. cyber_scribe_01"
                      className="w-full bg-black/60 border-2 border-white/20 text-white font-mono px-3.5 py-2.5 text-xs focus:outline-none focus:border-[#FFD700] transition-colors rounded-sm"
                      maxLength={20}
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      {username.length === 0 ? null : isCheckingUsername ? (
                        <Loader2 size={14} className="text-white/50 animate-spin" />
                      ) : !isValidFormat ? (
                        <X size={14} className="text-[#ff3800]" />
                      ) : isAvailable === true ? (
                        <Check size={14} className="text-[#39FF14]" />
                      ) : isAvailable === false ? (
                        <X size={14} className="text-[#ff3800]" />
                      ) : null}
                    </div>
                  </div>
                  <div className="font-mono text-[9px] text-zinc-500 mt-1 h-3.5">
                    {username.length > 0 && !isValidFormat && "3-20 chars, alphanumeric + _ only"}
                    {isAvailable === false && "Username taken — choose another alias"}
                    {isAvailable === true && "Username available!"}
                  </div>
                </div>

                {/* 2. Avatar Selection */}
                <div>
                  <label className="block font-mono text-[10px] text-zinc-400 uppercase font-black mb-1.5">
                    2. PROFILE AVATAR (CHOOSE PRESET OR UPLOAD)
                  </label>

                  {/* Selected Avatar Preview & File Input Trigger */}
                  <div className="flex items-center gap-3.5 mb-3 p-2 bg-black/40 border border-white/10 rounded">
                    <div
                      className="w-14 h-14 rounded-full overflow-hidden bg-zinc-900 border-2 border-white/20 cursor-pointer relative group shrink-0"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        accept=".jpg,.jpeg,.png,.webp"
                        onChange={handleAvatarFileChange}
                      />
                      {selectedAvatarUrl ? (
                        <img
                          src={selectedAvatarUrl}
                          alt="Avatar Preview"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-zinc-600">
                          <User size={20} />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <Camera size={16} className="text-white" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="px-3 py-1 bg-white/10 hover:bg-white/15 text-white font-mono text-[9.5px] font-bold tracking-wider uppercase rounded border border-white/20 cursor-pointer"
                      >
                        UPLOAD CUSTOM PHOTO
                      </button>
                      <p className="font-mono text-[8.5px] text-zinc-500 mt-1">
                        JPG, PNG, or WebP (max 2MB)
                      </p>
                    </div>
                  </div>

                  {/* Cyberpunk Preset Avatar Palette */}
                  <div className="font-mono text-[8.5px] text-zinc-400 uppercase font-bold mb-1">
                    OR SELECT A CYBER PILOT EMBLEM:
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {CYBER_AVATAR_PRESETS.map((preset) => {
                      const isSelected = selectedPresetId === preset.id;
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => handleSelectPreset(preset)}
                          className="p-1 rounded-sm border transition-all cursor-pointer flex flex-col items-center gap-1"
                          style={{
                            background: isSelected ? `${preset.accent}25` : "rgba(0,0,0,0.4)",
                            borderColor: isSelected ? preset.accent : "rgba(255,255,255,0.15)",
                            boxShadow: isSelected ? `0 0 8px ${preset.accent}60` : "none",
                          }}
                        >
                          <img
                            src={preset.avatarUrl}
                            alt={preset.name}
                            className="w-9 h-9 rounded object-cover"
                          />
                          <span
                            className="font-mono text-[7.5px] font-black truncate w-full text-center"
                            style={{ color: isSelected ? preset.accent : "#a1a1aa" }}
                          >
                            {preset.callsign}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Proceed to Wallet Connector Action */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                audioManager.playSfx("tap_nav", 0.15);
                setTutPhase("connector");
              }}
              disabled={
                !isFarcaster &&
                (username.length < 3 ||
                  !isValidFormat ||
                  isAvailable === false ||
                  !selectedAvatarUrl)
              }
              className="w-full py-4 bg-gradient-to-r from-[#39FF14] to-[#00E5FF] text-black font-mono font-black text-xs tracking-[0.25em] uppercase hover:opacity-95 transition-all rounded border-2 border-black shadow-[4px_4px_0px_#000] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
            >
              PROCEED TO WALLET CONNECTOR →
            </motion.button>
          </motion.div>
        )}

        {/* ── PHASE 6: WALLET CONNECTOR & FINAL ONBOARDING LOCK-IN ── */}
        {tutPhase === "connector" && (
          <motion.div
            key="connector"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="flex-1 flex flex-col items-center justify-between py-6 px-4 overflow-y-auto relative z-10 max-w-md mx-auto w-full"
          >
            <div className="text-center mt-2 w-full">
              <div className="font-mono text-[9px] text-[#00E5FF] tracking-[0.4em] mb-1 uppercase font-black">
                // PROTOCOL FINALIZATION //
              </div>
              <h2 className="font-mono text-2xl font-black tracking-widest text-white uppercase">
                WALLET CONNECTOR
              </h2>
              <p className="font-mono text-[10px] text-zinc-400 mt-1">
                {skipFirstRunSteps
                  ? "Review or reconnect your Base EVM Smart Wallet."
                  : "Link your Base EVM Smart Wallet to sign provenance for your 2-Card Welcome Pack and finalize your profile."}
              </p>
            </div>

            {/* Confirmed Pilot Card Preview */}
            <div className="w-full border-4 border-black bg-[#151311] p-4 rounded-lg shadow-[6px_6px_0px_#000] my-3">
              <div className="flex items-center justify-between border-b border-white/10 pb-2.5 mb-3">
                <span className="font-mono text-[9px] text-[#39FF14] font-black tracking-widest uppercase flex items-center gap-1.5">
                  <ShieldCheck size={12} className="text-[#39FF14]" />
                  PILOT CREDENTIALS READY
                </span>
                <button
                  type="button"
                  onClick={() => {
                    audioManager.playSfx("tap_nav", 0.12);
                    setTutPhase("identity");
                  }}
                  className="font-mono text-[9px] text-zinc-400 hover:text-white uppercase underline cursor-pointer"
                  style={{ display: skipFirstRunSteps ? "none" : undefined }}
                >
                  EDIT ALIAS
                </button>
              </div>

              <div className="flex items-center gap-3.5">
                {selectedAvatarUrl ? (
                  <img
                    src={selectedAvatarUrl}
                    alt={username || "Pilot"}
                    className="w-12 h-12 rounded-full object-cover border-2 border-[#39FF14]"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-zinc-800 border-2 border-white/20 flex items-center justify-center">
                    <User size={20} className="text-zinc-400" />
                  </div>
                )}
                <div className="flex-1 min-w-0 text-left">
                  <div className="font-mono text-sm font-black text-white truncate uppercase">
                    @{username || (isFarcaster && fcUser?.username) || "PILOT_01"}
                  </div>
                  <div className="font-mono text-[10px] text-zinc-400 truncate">
                    {isFarcaster ? "WARPCAST MINI APP PROTOCOL" : "CADET PILOT // FLIGHT ACADEMY"}
                  </div>
                </div>
                <div className="px-2 py-1 bg-[#39FF14]/15 border border-[#39FF14]/50 rounded text-[9px] font-mono text-[#39FF14] font-bold">
                  S1 CLEAR
                </div>
              </div>
            </div>

            {/* Wallet Link Status & Actions */}
            <div className="w-full border-4 border-black bg-[#151311] p-5 rounded-lg shadow-[6px_6px_0px_#000] mb-3 text-left space-y-4">
              <div className="flex items-center justify-between border-b border-white/10 pb-2">
                <span className="font-mono text-[10px] text-zinc-300 font-black tracking-wider uppercase flex items-center gap-1.5">
                  <Wallet size={13} className="text-[#00E5FF]" />
                  BASE EVM NETWORK (CHAIN ID 8453)
                </span>
                {walletAddress ? (
                  <span className="flex items-center gap-1 font-mono text-[8.5px] text-[#39FF14] font-black uppercase">
                    <span className="w-2 h-2 rounded-full bg-[#39FF14] animate-pulse" />
                    CONNECTED
                  </span>
                ) : (
                  <span className="flex items-center gap-1 font-mono text-[8.5px] text-amber-400 font-black uppercase">
                    <span className="w-2 h-2 rounded-full bg-amber-400" />
                    UNLINKED
                  </span>
                )}
              </div>

              {walletAddress ? (
                /* Connected State */
                <div className="space-y-3">
                  <div className="bg-black/60 border border-[#39FF14]/40 p-3 rounded flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="font-mono text-[8.5px] text-zinc-400 uppercase tracking-widest">
                        SIGNING ADDRESS
                      </div>
                      <div className="font-mono text-xs text-[#00E5FF] font-black tracking-wider truncate">
                        {walletAddress}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleCopyAddress(walletAddress)}
                        className="px-2 py-1 bg-white/10 hover:bg-white/15 text-white rounded text-[9px] font-mono font-bold flex items-center gap-1 transition-all cursor-pointer"
                        title="Copy Address"
                      >
                        {walletCopied ? (
                          <>
                            <Check size={11} className="text-[#39FF14]" /> COPIED
                          </>
                        ) : (
                          <>
                            <Copy size={11} /> COPY
                          </>
                        )}
                      </button>
                      <a
                        href={`https://basescan.org/address/${walletAddress}`}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 bg-white/10 hover:bg-white/15 text-white/70 hover:text-white rounded transition-all"
                        title="View on BaseScan"
                      >
                        <ExternalLink size={12} />
                      </a>
                    </div>
                  </div>

                  <div className="space-y-1.5 font-mono text-[10px] text-zinc-300">
                    <div className="flex items-center gap-2">
                      <CheckCircle size={12} className="text-[#39FF14] shrink-0" />
                      <span>2-Card Welcome Pack provenance assigned to this address</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle size={12} className="text-[#39FF14] shrink-0" />
                      <span>Zero-gas sponsored gameplay on Base L2</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle size={12} className="text-[#39FF14] shrink-0" />
                      <span>Scores, medals, and $V⚡ tokens anchored to your profile</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleConnectWeb3Wallet}
                    disabled={isConnectingWallet}
                    className="w-full py-2 bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white font-mono text-[9px] tracking-widest uppercase transition-all rounded border border-white/10 cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    {isConnectingWallet ? <Loader2 size={12} className="animate-spin" /> : <Wallet size={12} />}
                    SWITCH OR RECONNECT DIFFERENT WALLET
                  </button>
                </div>
              ) : (
                /* Unlinked State: Offer Primary Web3 and Guest Ephemeral */
                <div className="space-y-3">
                  <p className="font-mono text-[10.5px] text-zinc-300 leading-relaxed">
                    Connecting your Base Smart Wallet securely signs ownership of your cards and ensures your progress is never lost across browsers.
                  </p>

                  <div className="space-y-2 pt-1">
                    {/* Primary Web3 Button */}
                    <button
                      type="button"
                      onClick={handleConnectWeb3Wallet}
                      disabled={isConnectingWallet}
                      className="w-full py-3 bg-gradient-to-r from-[#00E5FF] to-[#39FF14] text-black font-mono font-black text-xs tracking-wider uppercase hover:opacity-95 transition-all rounded border-2 border-black shadow-[3px_3px_0px_#000] cursor-pointer flex items-center justify-center gap-2"
                    >
                      {isConnectingWallet ? (
                        <>
                          <Loader2 size={14} className="animate-spin" /> CONNECTING BASE SMART WALLET...
                        </>
                      ) : (
                        <>
                          <Zap size={14} className="fill-black" /> CONNECT BASE SMART WALLET / WEB3
                        </>
                      )}
                    </button>

                    {/* Guest Ephemeral Smart Wallet Generation */}
                    <button
                      type="button"
                      onClick={handleGenerateEphemeralWallet}
                      disabled={isConnectingWallet}
                      className="w-full py-2.5 bg-black/60 hover:bg-black/80 text-amber-300 font-mono font-bold text-[10px] tracking-wider uppercase transition-all rounded border border-amber-400/40 cursor-pointer flex items-center justify-center gap-2"
                    >
                      {isConnectingWallet ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <Key size={12} className="text-amber-400" />
                      )}
                      GUEST PILOT // GENERATE EPHEMERAL SMART WALLET
                    </button>
                  </div>

                  <p className="font-mono text-[9px] text-zinc-500 text-center">
                    Instant zero-friction generation. Ephemeral keys are saved locally on this device.
                  </p>
                </div>
              )}
            </div>

            {/* Final CTA: Save Profile and Enter the Vault (replay skips the save) */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={skipFirstRunSteps ? handleFinishReplay : handleSaveIdentityAndFinish}
              disabled={isSavingIdentity}
              className="w-full py-4 bg-gradient-to-r from-[#39FF14] via-[#00E5FF] to-[#FF1493] text-black font-mono font-black text-xs tracking-[0.25em] uppercase hover:opacity-95 transition-all rounded border-2 border-black shadow-[4px_4px_0px_#000] cursor-pointer flex items-center justify-center gap-2"
            >
              {isSavingIdentity ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> SAVING PROFILE & WRITING TO VAULT...
                </>
              ) : skipFirstRunSteps ? (
                "ENTER THE VAULT ➔"
              ) : (
                "SAVE PROFILE & ENTER THE VAULT ➔"
              )}
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
