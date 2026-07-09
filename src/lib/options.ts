import { useVaultStore } from '../store/useVaultStore';

export type GameOpts = {
  missSystem: boolean;
  hudMisses: boolean;
  comboDisplay: boolean;
  judgmentText: boolean;
  audioOffset: number;
  laneKeys: [string, string, string];
  laneColors: [string, string, string];
  useLocalFiles: boolean;
  noteGenerationSource: 'auto' | 'lyrics' | 'bpm';
  bgMusic: boolean;
  gameBackground: string;
  gameTrack: string;
  backgroundBlur: number;
  cardBack: string;
  haptics: boolean;
  noteTheme: string;
  gameSenseEnabled: boolean;
};

export interface GameBackground {
  id: string;
  name: string;
  desc: string;
  unlockText: string;
  unlockScore: number;
}

export const GAME_BACKGROUNDS: GameBackground[] = [
  { id: 'cover_blur', name: 'Default Blur', desc: 'Ambient cover art blurring', unlockText: 'Unlocked', unlockScore: 0 },
  { id: 'neon_grid', name: 'Neon Grid', desc: 'Synthwave neon network grid', unlockText: 'Requires 1,000 Echo Score', unlockScore: 1000 },
  { id: 'cyber_streets', name: 'Matrix Cyber', desc: 'Green binary rain frequency', unlockText: 'Requires 5,000 Echo Score', unlockScore: 5000 },
  { id: 'space_nebula', name: 'Void Space', desc: 'Moving nebula & stardust', unlockText: 'Requires 10,000 Echo Score', unlockScore: 10000 },
  { id: 'sunset_skyline', name: 'Sunset Skyline', desc: 'Vibrant retro sun & wireframe city', unlockText: 'Requires 15,000 Echo Score', unlockScore: 15000 },
  { id: 'glitch_matrix', name: 'Corrupted Signal', desc: 'Glitching digital terminal lines', unlockText: 'Requires 20,000 Echo Score', unlockScore: 20000 },
  { id: 'cyber_cityscape', name: 'Neon Cityscape', desc: 'Skyscrapers & glowing holo adverts', unlockText: 'Requires 25,000 Echo Score', unlockScore: 25000 },
  { id: 'toxic_hazard', name: 'Acid Hazard', desc: 'Toxic warnings & hex grid waves', unlockText: 'Requires 30,000 Echo Score', unlockScore: 30000 },
  { id: 'living_vault', name: 'The Living Vault', desc: 'Corridor overrides & crystallizing card shards', unlockText: 'Requires 35,000 Echo Score', unlockScore: 35000 },
  { id: 'prismatic_aurora', name: 'Chroma Aurora', desc: 'Shimmering chromatic light ribbons', unlockText: 'Requires 40,000 Echo Score', unlockScore: 40000 },
  { id: 'hyperdrive_warp', name: 'Hyperspace Warp', desc: 'Speed tunnel lines warping past', unlockText: 'Requires 50,000 Echo Score', unlockScore: 50000 },
  { id: 'gold_record', name: 'Gold Record', desc: 'Prestige gold vinyl spin & golden audio waves', unlockText: 'Requires Promo Code', unlockScore: 999999 },
];

export interface GameTrack {
  id: string;
  name: string;
  desc: string;
  unlockText: string;
  unlockScore: number;
}

export const GAME_TRACKS: GameTrack[] = [
  { id: 'classic', name: 'Classic Track', desc: 'Standard perspective lanes', unlockText: 'Unlocked', unlockScore: 0 },
  { id: 'sacred_visualizer', name: 'Sacred Visualizer', desc: 'Direct note-lane visualizer overlay', unlockText: 'Unlocked', unlockScore: 0 },
];

export const DEFAULT_OPTS: GameOpts = {
  missSystem: true,
  hudMisses: true,
  comboDisplay: true,
  judgmentText: true,
  audioOffset: 0,
  laneKeys: ["a", "s", "d"],
  laneColors: ["#FF1493", "#00E5FF", "#39FF14"],
  useLocalFiles: false,
  noteGenerationSource: "auto",
  bgMusic: false,
  gameBackground: "cover_blur",
  gameTrack: "classic",
  backgroundBlur: 18,
  cardBack: "classic",
  haptics: true,
  noteTheme: "classic",
  gameSenseEnabled: false,
};

export function loadOpts(): GameOpts {
  const store = useVaultStore.getState();
  const dbSettings = store.settings;
  const dbProgression = store.progression;
  const dbCheats = store.unlockedCheats;

  const bool = (key: string, def: boolean) =>
    localStorage.getItem(key) === null ? def : localStorage.getItem(key) !== "false";

  const isNoclipUnlocked = dbCheats?.noclip ?? (localStorage.getItem("opt_unlocked_noclip") === "true");
  const isIddqdUnlocked = dbCheats?.iddqd ?? (localStorage.getItem("opt_unlocked_iddqd") === "true");

  return {
    missSystem: isNoclipUnlocked 
      ? (dbSettings?.missSystem ?? bool("opt_missSystem", true)) 
      : true,
    hudMisses: dbSettings?.hudMisses ?? bool("opt_hudMisses", true),
    comboDisplay: dbSettings?.comboDisplay ?? bool("opt_comboDisplay", true),
    judgmentText: dbSettings?.judgmentText ?? bool("opt_judgmentText", true),
    audioOffset: dbSettings?.audioOffset ?? (parseFloat(localStorage.getItem("opt_audioOffset") ?? "0") || 0),
    laneKeys: [
      dbSettings?.laneKeys?.[0] ?? (localStorage.getItem("opt_laneKey_0") ?? DEFAULT_OPTS.laneKeys[0]),
      dbSettings?.laneKeys?.[1] ?? (localStorage.getItem("opt_laneKey_1") ?? DEFAULT_OPTS.laneKeys[1]),
      dbSettings?.laneKeys?.[2] ?? (localStorage.getItem("opt_laneKey_2") ?? DEFAULT_OPTS.laneKeys[2]),
    ],
    laneColors: [
      dbSettings?.laneColors?.[0] ?? (localStorage.getItem("opt_laneColor_0") ?? DEFAULT_OPTS.laneColors[0]),
      dbSettings?.laneColors?.[1] ?? (localStorage.getItem("opt_laneColor_1") ?? DEFAULT_OPTS.laneColors[1]),
      dbSettings?.laneColors?.[2] ?? (localStorage.getItem("opt_laneColor_2") ?? DEFAULT_OPTS.laneColors[2]),
    ],
    useLocalFiles: bool("opt_useLocalFiles", false),
    noteGenerationSource: (() => {
      if (!isIddqdUnlocked) return "auto";
      const v = dbProgression?.noteGenerationSource ?? localStorage.getItem("opt_noteGenerationSource");
      return (v === "lyrics" || v === "bpm" || v === "auto") ? v : "auto";
    })(),
    bgMusic: dbSettings?.bgMusic ?? bool("opt_bgMusic", false),
    gameBackground: dbSettings?.gameBackground ?? (localStorage.getItem("opt_gameBackground") ?? "cover_blur"),
    gameTrack: dbSettings?.gameTrack ?? (localStorage.getItem("opt_gameTrack") ?? "classic"),
    backgroundBlur: dbSettings?.backgroundBlur ?? (parseFloat(localStorage.getItem("opt_backgroundBlur") ?? "18") || 18),
    cardBack: dbSettings?.cardBack ?? (localStorage.getItem("opt_cardBack") ?? "classic"),
    haptics: dbSettings?.haptics ?? bool("opt_haptics", true),
    noteTheme: dbSettings?.noteTheme ?? (localStorage.getItem("opt_noteTheme") ?? "classic"),
    gameSenseEnabled: bool("opt_gameSenseEnabled", false),
  };
}

export function saveLaneKey(lane: 0 | 1 | 2, key: string) {
  localStorage.setItem(`opt_laneKey_${lane}`, key);
}

export function saveLaneColor(lane: 0 | 1 | 2, color: string) {
  localStorage.setItem(`opt_laneColor_${lane}`, color);
}

export function resetOpts() {
  Object.keys(localStorage)
    .filter(k => k.startsWith("opt_"))
    .forEach(k => localStorage.removeItem(k));
}

export function keyLabel(rawKey: string): string {
  const arrows: Record<string, string> = {
    ArrowLeft: "←", ArrowRight: "→", ArrowUp: "↑", ArrowDown: "↓",
    " ": "SPC",
  };
  return arrows[rawKey] ?? rawKey.toUpperCase();
}

export function getActiveTheme(): 'classic' | 'avant-garde' {
  if (typeof sessionStorage !== 'undefined') {
    const val = sessionStorage.getItem('pim_active_theme');
    if (val === 'classic' || val === 'avant-garde') return val;
  }
  if (typeof localStorage !== 'undefined') {
    const val = localStorage.getItem('pim_intro_type');
    if (val === 'classic' || val === 'avant-garde') return val;
  }
  return 'classic';
}
