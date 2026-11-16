export type RunnerStage = 1 | 2;
type ObstacleKind = 'spike' | 'bar' | 'pit' | 'coin' | 'platform' | 'drone';

export interface RunnerObstacle {
  kind: ObstacleKind;
  beat: number;
  len: number;
  done: boolean;
  destroyedAt?: number;
}

export const RUNNER_COURSES = {
  1: { title: 'ROOFTOP RUN', beats: 72 },
  2: { title: 'SIGNAL DISTRICT', beats: 56 },
} as const;

export function runnerCourse(stage: RunnerStage, rand: () => number) {
  const obstacles: RunnerObstacle[] = [];
  const add = (kind: ObstacleKind, beat: number, len = 0) => obstacles.push({ kind, beat, len, done: false });

  if (stage === 1) {
    add('drone', 5.5);
    for (let b = 8; b < 24; b += 2) {
      add('spike', b + 0.5);
      if ((b / 2) % 2 === 0) add('coin', b + 0.5);
    }
    for (let b = 24; b < 40; b += 2) {
      const r = rand();
      if (r < 0.4) add('bar', b + 0.25);
      else if (r < 0.7) add('pit', b + 0.25, 0.65);
      else add('spike', b + 0.5);
    }
    for (let b = 40; b < 56; b += 5) {
      add('platform', b + 0.5, 3);
      add('coin', b + 2);
      add('coin', b + 3);
    }
    for (let b = 56; b < 68; b++) {
      const r = rand();
      if (r < 0.35) add('spike', b + 0.5);
      else if (r < 0.6) add('bar', b + 0.25);
      else if (r < 0.75) add('pit', b + 0.25, 0.65);
      else add('coin', b + 0.5);
    }
    add('drone', 69.5);
  } else {
    // Each entry is the whole beat on which the player should act.
    for (const b of [6, 12, 18, 21, 28, 34, 39, 46, 52]) add('drone', b + 0.5);
    for (const b of [8, 15, 24, 30, 37, 44, 50]) add('bar', b + 0.25);
    for (const b of [10, 16, 26, 36, 48, 53]) add('pit', b + 0.25, 0.65);
    for (const b of [13, 20, 29, 40, 42, 51]) {
      add('spike', b + 0.5);
      add('coin', b + 0.5);
    }
    for (const b of [32, 47]) {
      add('platform', b + 0.5, 1);
      add('coin', b + 1.2);
    }
  }
  return obstacles.sort((a, b) => a.beat - b.beat);
}
