export const STAGE_BOUNDS = [
  { stage: 1, name: "Stage 1",      pct: 0.00, difficulty: "EASY"   },
  { stage: 2, name: "Stage 2",      pct: 0.15, difficulty: "MEDIUM" },
  { stage: 3, name: "Stage 3",      pct: 0.35, difficulty: "HARD"   },
  { stage: 4, name: "Stage 4",      pct: 0.60, difficulty: "BRUTAL" },
  { stage: 5, name: "FINAL STAGE",  pct: 0.80, difficulty: "BRUTAL" }
] as const;


export const MEDAL_STOPS = [
  { name: "BRONZE", acc: 40, color: "#CD7F32" },
  { name: "SILVER", acc: 60, color: "#C0C0C0" },
  { name: "GOLD", acc: 80, color: "#FFD700" },
  { name: "PLATINUM", acc: 93, color: "#E0E0FF" },
] as const;


export const MEDAL_COLOR_MAP: Record<string, string> = {
  BRONZE: "#CD7F32",
  SILVER: "#C0C0C0",
  GOLD: "#FFD700",
  PLATINUM: "#E0E0FF",
  NONE: "#444",
};


export const LANE_COUNT = 3;


export const HIT_RATIO = 0.78;


export const HW_TOP = 0.65;


export const HW_BOT = 0.99;


export const MATRIX_CHARS = ["P", "I", "M", "0", "1", "X", "Y", "Ø", "Δ", "Ω", "7", "5", "A", "C", "F"];


export const MATRIX_COLUMNS = Array.from({ length: 18 }).map((_, i) => {
  const delay = `${(i * 0.3) % 5}s`;
  const duration = `${3.5 + (i % 4) * 1.5}s`;
  const opacity = 0.22 + ((i * 4) % 8) * 0.08;
  const fontSize = `${9 + (i % 3) * 3.5}px`;
  const left = `${i * 5.5 + 2}%`;
  const headChar = MATRIX_CHARS[i % MATRIX_CHARS.length];
  const bodyText = Array.from({ length: 29 })
    .map((_, charIdx) => MATRIX_CHARS[(i + (charIdx + 1) * 7) % MATRIX_CHARS.length])
    .join("\n");
  return { left, delay, duration, opacity, fontSize, headChar, bodyText };
});


export const POWER_UPS = [
  {
    threshold: 20,
    type: "FEVER",
    duration: 9,
    multiplier: 2,
    color: "#E5B800",
    label: "FEVER",
  },
  {
    threshold: 40,
    type: "SURGE",
    duration: 11,
    multiplier: 3,
    color: "#FF1493",
    label: "SURGE",
  },
  {
    threshold: 60,
    type: "SIGNAL_LOCK",
    duration: 14,
    multiplier: 4,
    color: "#39FF14",
    label: "SIGNAL LOCK",
  },
] as const;


export type PUType = (typeof POWER_UPS)[number]["type"];
