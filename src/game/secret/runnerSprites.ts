import atlasUrl from './assets/runner.webp';

const CELL = 224;
const ROW = { run: 0, jump: 1, slide: 2, attack: 3, damage: 4, death: 5, resurrect: 6, taunt: 7, block: 8, doubleJump: 9 };
const REVIVE_BASELINES = [621, 621, 634, 621, 621, 643, 684, 711, 719, 719];

export type RunnerPose = keyof typeof ROW;

let atlas: HTMLImageElement | undefined;

function runnerAtlas() {
  if (!atlas) {
    atlas = new Image();
    atlas.src = atlasUrl;
  }
  return atlas;
}

export function prepareRunnerSprites() {
  return runnerAtlas().decode();
}

export function drawRunnerSprite(
  ctx: CanvasRenderingContext2D,
  pose: RunnerPose,
  frame: number,
  x: number,
  feet: number,
  size: number,
) {
  const image = runnerAtlas();
  if (!image.naturalWidth) return false;

  // Keep a common pivot across the sheet. The resurrection frames use a
  // slightly different floor line as the character gets back to her feet.
  const baseline = pose === 'resurrect' ? REVIVE_BASELINES[frame] : 663;
  ctx.drawImage(
    image,
    frame * CELL, ROW[pose] * CELL, CELL, CELL,
    x - size * 0.46, feet - (baseline / 720) * size, size, size,
  );
  return true;
}
