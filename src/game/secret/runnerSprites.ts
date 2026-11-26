import classicRight from './assets/runner-classic-right.webp';
import classicLeft from './assets/runner-classic-left.webp';
import neonRight from './assets/runner-neon-right.webp';
import neonLeft from './assets/runner-neon-left.webp';
import spriteData from './assets/runnerSprites.json';

const ALL_SKINS = { classic: 'Classic', neon: 'Neon', bodypaint: 'Bodypaint' } as const;
export type RunnerSkin = keyof typeof ALL_SKINS;
// Portal builds (Playgama, klyo, CrazyGames, Gamealia) follow the portals' content
// rules, like their Prestige Art: no Bodypaint outfit and none of the butt_* emotes.
const PORTAL = import.meta.env.VITE_PLATFORM === 'playgama';
export const RUNNER_SKINS: Partial<Record<RunnerSkin, string>> = PORTAL
  ? { classic: ALL_SKINS.classic, neon: ALL_SKINS.neon }
  : ALL_SKINS;
export type RunnerFacing = 'right' | 'left';
export const RUNNER_FRAMES = 16;

export const RUNNER_EMOTES = {
  taunt: 'Scythe flourish',
  peace_bounce: 'Peace bounce',
  peace_bounce2: 'Peace bounce II',
  peace_bounce3: 'Peace bounce III',
  peace_bounce4: 'Peace bounce IV',
  butt_bounce: 'Bounce',
  butt_twerk: 'Twerk',
  butt_hipcircle: 'Hip circle',
  butt_wiggle: 'Wiggle',
  butt_squatpop: 'Squat pop',
  butt_hipbounce: 'Hip bounce',
  butt_lookback: 'Look back',
  butt_cheekclap: 'Clap',
  butt_archwiggle: 'Arch wiggle',
} as const;

export type RunnerEmote = keyof typeof RUNNER_EMOTES;
export type RunnerPose = 'idle' | 'run' | 'jump' | 'doubleJump' | 'attack' | 'jumpAttack'
  | 'throw' | 'block' | 'slide' | 'damage' | 'death' | 'resurrect' | 'turn' | RunnerEmote;
export type RunnerAppearance = { skin: RunnerSkin; emote: RunnerEmote };

const ALIASES: Partial<Record<RunnerPose, string>> = { doubleJump: 'djump', jumpAttack: 'jump_attack', damage: 'hurt', turn: 'turn_around' };
const URLS: Record<RunnerSkin, Record<RunnerFacing, string>> = {
  classic: { right: classicRight, left: classicLeft },
  neon: { right: neonRight, left: neonLeft },
  bodypaint: { right: '', left: '' },
};
// The condition is written out (not PORTAL) so the bundler drops the import in portal builds.
const bodypaintReady: Promise<void> = import.meta.env.VITE_PLATFORM === 'playgama'
  ? Promise.resolve()
  : import('./runnerBodypaint').then((m) => { URLS.bodypaint = m.default; });
type Sprite = { row: number; frames: { pivot: number; baseline: number; height: number }[] };
const DATA: { cell: number; skins: Record<RunnerSkin, Record<RunnerFacing, Record<string, Sprite>>> } = spriteData;
const KEY = 'beat-runner-appearance';
let appearance: RunnerAppearance = { skin: 'classic', emote: 'taunt' };
let cachedSkin: RunnerSkin | null = null;
let atlases: Partial<Record<RunnerFacing, HTMLImageElement>> = {};

export function runnerEmotes(skin: RunnerSkin) {
  return (Object.keys(RUNNER_EMOTES) as RunnerEmote[]).filter(pose => DATA.skins[skin].right[pose] && !(PORTAL && pose.startsWith('butt_')));
}

export function readRunnerAppearance(): RunnerAppearance {
  try {
    const stored = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (stored && Object.hasOwn(RUNNER_SKINS, stored.skin)) {
      const skin: RunnerSkin = stored.skin;
      appearance = { skin, emote: runnerEmotes(skin).includes(stored.emote) ? stored.emote : 'taunt' };
    }
  } catch { /* Use the current session's selection. */ }
  return { ...appearance };
}

export function saveRunnerAppearance(next: RunnerAppearance) {
  appearance = { skin: next.skin, emote: runnerEmotes(next.skin).includes(next.emote) ? next.emote : 'taunt' };
  try {
    localStorage.setItem(KEY, JSON.stringify(appearance));
  } catch { /* Use the current session's selection. */ }
}

function runnerAtlas(skin: RunnerSkin, facing: RunnerFacing) {
  // Retain only the selected outfit's decoded textures.
  if (cachedSkin !== skin) {
    atlases = {};
    cachedSkin = skin;
  }
  let atlas = atlases[facing];
  if (!atlas && URLS[skin][facing]) {
    atlas = new Image();
    atlas.src = URLS[skin][facing];
    atlases[facing] = atlas;
  }
  return atlas ?? new Image();
}

export async function prepareRunnerSprites(skin: RunnerSkin = readRunnerAppearance().skin) {
  if (skin === 'bodypaint') await bodypaintReady;
  return Promise.all([runnerAtlas(skin, 'right').decode(), runnerAtlas(skin, 'left').decode()]);
}

function drawSprite(
  ctx: CanvasRenderingContext2D, pose: string, frame: number, x: number, feet: number,
  height: number, skin: RunnerSkin, facing: RunnerFacing,
) {
  const atlas = runnerAtlas(skin, facing);
  const sprite = DATA.skins[skin][facing][pose];
  if (!sprite || !atlas.naturalWidth) return false;
  const index = Math.max(0, Math.min(RUNNER_FRAMES - 1, Math.floor(frame)));
  const metrics = sprite.frames[index];
  const size = height / metrics.height;
  const baseline = pose.includes('boomerang') ? metrics.baseline + metrics.height / 2 : metrics.baseline;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(
    atlas, index * DATA.cell, sprite.row * DATA.cell, DATA.cell, DATA.cell,
    x - metrics.pivot * size, feet - baseline * size, size, size,
  );
  ctx.restore();
  return true;
}

export function drawRunnerSprite(
  ctx: CanvasRenderingContext2D, pose: RunnerPose, frame: number, x: number, feet: number,
  size: number, skin: RunnerSkin = readRunnerAppearance().skin, facing: RunnerFacing = 'right',
) {
  return drawSprite(ctx, ALIASES[pose] ?? pose, frame, x, feet, size * 0.85, skin, facing);
}

export function drawRunnerScythe(
  ctx: CanvasRenderingContext2D, frame: number, x: number, y: number, size: number,
  returning: boolean, skin: RunnerSkin, facing: RunnerFacing,
) {
  const pose = returning && DATA.skins[skin][facing].shared_boomerang ? 'shared_boomerang' : 'boomerang';
  return drawSprite(ctx, pose, frame, x, y + size / 2, size, skin, facing);
}
