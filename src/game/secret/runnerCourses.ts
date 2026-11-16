export const RUNNER_STAGES = [1, 2, 3, 4, 5, 6] as const;
export type RunnerStage = (typeof RUNNER_STAGES)[number];

type ChartHazard = 'drone' | 'bar' | 'pit' | 'spike' | 'platform' | 'laser';
type ObstacleKind = ChartHazard | 'coin' | 'whistle';

export interface RunnerObstacle {
  kind: ObstacleKind;
  beat: number;
  len: number;
  done: boolean;
  destroyedAt?: number;
}

export const RUNNER_COURSES = {
  1: { title: 'ROOFTOP RUN', beats: 72, clearId: 'runner', brief: 'Jump the rooftop gaps and cut through the patrol drones.' },
  2: { title: 'SIGNAL DISTRICT', beats: 56, clearId: 'runner-district', brief: 'Slide under low beams between jumps and drone strikes.' },
  3: { title: 'PRISM RELAY', beats: 48, clearId: 'runner-relay', brief: 'Block on the beat before a vertical laser reaches you. Slide under low pink beams.' },
  4: { title: 'GLASSWORKS', beats: 52, clearId: 'runner-glassworks', brief: 'Watch for lasers immediately after the gaps and raised platforms.' },
  5: { title: 'NULL SPIRE', beats: 52, clearId: 'runner-spire', brief: 'Reset your guard between back-to-back laser strikes.' },
  6: { title: 'LAST TRANSMISSION', beats: 60, clearId: 'runner-transmission', brief: 'Switch between jumping, slashing, and blocking through the final relay.' },
} as const;

export const RUNNER_WHISTLES = {
  rooftop: { name: 'Rooftop Whistle', from: 1, to: 3, beat: 6.5, hint: 'Try taunting near the rooftop speaker with gold lights.' },
  prism: { name: 'Prism Whistle', from: 3, to: 5, beat: 27.5, hint: 'Deflect the relay’s gold laser.' },
} as const;

export type RunnerWhistleId = keyof typeof RUNNER_WHISTLES;

export function parseRunnerStage(value: string | null) {
  return RUNNER_STAGES.find(stage => String(stage) === value);
}

const LATER_CHARTS: Record<Exclude<RunnerStage, 1>, Record<ChartHazard, readonly number[]>> = {
  2: {
    drone: [6, 12, 18, 21, 28, 34, 39, 46, 52],
    bar: [8, 15, 24, 30, 37, 44, 50],
    pit: [10, 16, 26, 36, 48, 53],
    spike: [13, 20, 29, 40, 42, 51],
    platform: [32, 47],
    laser: [],
  },
  3: {
    drone: [13, 20, 32, 40],
    bar: [15, 25, 34, 45],
    pit: [8, 30, 38],
    spike: [12, 19, 22, 33, 42],
    platform: [],
    laser: [6, 10, 17, 23, 27, 36, 43],
  },
  4: {
    drone: [8, 18, 25, 38],
    bar: [7, 14, 21, 31, 40, 45],
    pit: [9, 19, 29, 41, 48],
    spike: [13, 17, 20, 34, 46],
    platform: [26, 50],
    laser: [5, 11, 16, 23, 30, 33, 36, 42, 47],
  },
  5: {
    drone: [7, 12, 22, 27, 36, 44],
    bar: [6, 11, 18, 23, 28, 37, 43, 47],
    pit: [9, 16, 20, 24, 31, 39, 45],
    spike: [14, 19, 30, 33, 42, 48],
    platform: [],
    laser: [5, 8, 13, 15, 21, 25, 29, 34, 35, 41, 46, 49],
  },
  6: {
    drone: [6, 11, 15, 22, 25, 31, 36, 43, 49, 55],
    bar: [8, 12, 18, 24, 28, 33, 40, 44, 48, 53],
    pit: [7, 16, 20, 29, 35, 42, 46, 50],
    spike: [10, 14, 19, 23, 26, 32, 37, 39, 52, 57],
    platform: [],
    laser: [5, 9, 13, 17, 21, 27, 30, 34, 38, 41, 45, 47, 51, 54, 56],
  },
};

export function runnerCourse(stage: RunnerStage, rand: () => number) {
  const obstacles: RunnerObstacle[] = [];
  const add = (kind: ObstacleKind, beat: number, len = 0) => obstacles.push({ kind, beat, len, done: false });

  if (stage === 1) {
    add('drone', 5.5);
    add('whistle', RUNNER_WHISTLES.rooftop.beat);
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
    // The listed beat is the input cue. Actual contact follows the cue.
    const chart = LATER_CHARTS[stage];
    for (const beat of chart.drone) add('drone', beat + 0.5);
    for (const beat of chart.bar) add('bar', beat + 0.25);
    for (const beat of chart.pit) add('pit', beat + 0.25, 0.65);
    for (const beat of chart.laser) add('laser', beat + 0.5);
    for (const beat of chart.spike) {
      add('spike', beat + 0.5);
      add('coin', beat + 0.5);
    }
    for (const beat of chart.platform) {
      add('platform', beat + 0.5, 1);
      add('coin', beat + 1.2);
    }
  }
  return obstacles.sort((a, b) => a.beat - b.beat);
}
