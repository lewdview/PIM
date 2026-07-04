#!/usr/bin/env node
/**
 * split_songs.mjs
 *
 * Fetches the master release data from https://th3scr1b3.art/release-data.json
 * and splits it into lightweight catalogs and individual song/card detail JSONs.
 */

import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DATA = path.join(__dirname, '../public/data');
const SONGS_DIR = path.join(ROOT_DATA, 'songs');
const CARDS_DIR = path.join(ROOT_DATA, 'cards');

// Create directories if they do not exist
fs.mkdirSync(SONGS_DIR, { recursive: true });
fs.mkdirSync(CARDS_DIR, { recursive: true });

const RELEASE_DATA_URL = 'https://th3scr1b3.art/release-data.json';

// Seeded random helper for card rarities
function seededRandom(seed) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// Helper to snap to beat
function snapToBeat(time, bpm, subdivision = 16) {
  const subDur = (60 / bpm) * (4 / subdivision);
  return Math.round(time / subDur) * subDur;
}

// Constants copied from api.ts for note generation
const PHRASE_PATTERNS = [
  [0, 1, 2, 1, 0, 2, 1, 0], [2, 1, 0, 1, 2, 0, 1, 2], [0, 2, 1, 0, 2, 1, 0, 2],
  [1, 0, 2, 1, 0, 2, 1, 0], [0, 2, 0, 1, 2, 1, 2, 0], [1, 1, 0, 2, 1, 1, 2, 0],
  [0, 0, 1, 2, 2, 1, 0, 2], [0, 1, 0, 2, 1, 2, 0, 1], [2, 0, 2, 0, 1, 1, 2, 0],
  [1, 0, 1, 2, 1, 0, 1, 2], [0, 1, 1, 2, 2, 1, 1, 0], [2, 2, 1, 1, 0, 0, 1, 1],
  [0, 2, 2, 0, 1, 1, 1, 1], [1, 2, 0, 1, 2, 0, 1, 2], [1, 0, 2, 1, 0, 2, 1, 0],
  [0, 1, 2, 2, 1, 0, 0, 1], [1, 1, 1, 0, 2, 0, 2, 0], [0, 0, 2, 2, 0, 0, 2, 2],
  [1, 2, 1, 0, 1, 2, 1, 0], [0, 2, 1, 1, 0, 2, 1, 1], [0, 1, 2, 0, 1, 2, 0, 1],
  [2, 1, 0, 2, 1, 0, 2, 1], [1, 0, 1, 0, 1, 2, 1, 2], [0, 0, 0, 1, 2, 2, 2, 1],
  [1, 2, 2, 1, 0, 0, 1, 1], [0, 2, 0, 2, 1, 0, 2, 1], [0, 1, 0, 1, 2, 1, 2, 1],
  [1, 0, 2, 0, 1, 2, 0, 2], [2, 2, 0, 0, 1, 1, 2, 2], [1, 1, 2, 0, 1, 1, 0, 2]
];

const SWIPE_MIXED_PATTERNS = [
  [{ type: 'tap', lane: 1 }, { type: 'swipe', lane: 0, dir: 'up-left' }, { type: 'tap', lane: 1 }, { type: 'swipe', lane: 2, dir: 'up-right' }],
  [{ type: 'swipe', lane: 1, dir: 'up' }, { type: 'tap', lane: 0 }, { type: 'tap', lane: 2 }, { type: 'swipe', lane: 1, dir: 'down' }],
  [{ type: 'swipe', lane: 0, dir: 'left' }, { type: 'swipe', lane: 2, dir: 'right' }, { type: 'tap', lane: 1 }, { type: 'tap', lane: 1 }],
  [{ type: 'tap', lane: 0 }, { type: 'swipe', lane: 1, dir: 'right' }, { type: 'swipe', lane: 2, dir: 'up-right' }, { type: 'tap', lane: 2 }],
  [{ type: 'swipe', lane: 0, dir: 'up' }, { type: 'tap', lane: 1 }, { type: 'swipe', lane: 2, dir: 'down' }, { type: 'tap', lane: 1 }],
  [{ type: 'swipe', lane: 0, dir: 'down' }, { type: 'swipe', lane: 2, dir: 'down' }, { type: 'tap', lane: 1 }, { type: 'swipe', lane: 1, dir: 'up' }],
  [{ type: 'tap', lane: 1 }, { type: 'tap', lane: 1 }, { type: 'swipe', lane: 0, dir: 'left' }, { type: 'swipe', lane: 2, dir: 'right' }],
  [{ type: 'swipe', lane: 2, dir: 'right' }, { type: 'tap', lane: 1 }, { type: 'swipe', lane: 0, dir: 'left' }, { type: 'tap', lane: 1 }],
  [{ type: 'tap', lane: 0 }, { type: 'tap', lane: 2 }, { type: 'swipe', lane: 1, dir: 'down' }, { type: 'swipe', lane: 1, dir: 'up' }],
  [{ type: 'swipe', lane: 1, dir: 'up-left' }, { type: 'swipe', lane: 1, dir: 'up-right' }, { type: 'tap', lane: 0 }, { type: 'tap', lane: 2 }],
  [{ type: 'swipe', lane: 1, dir: 'up' }, { type: 'swipe', lane: 1, dir: 'down' }, { type: 'tap', lane: 0 }, { type: 'tap', lane: 2 }],
  [{ type: 'swipe', lane: 0, dir: 'left' }, { type: 'swipe', lane: 2, dir: 'right' }, { type: 'tap', lane: 1 }, { type: 'swipe', lane: 1, dir: 'up' }],
  [{ type: 'swipe', lane: 0, dir: 'left' }, { type: 'swipe', lane: 1, dir: 'up' }, { type: 'swipe', lane: 2, dir: 'right' }, { type: 'tap', lane: 1 }],
  [{ type: 'swipe', lane: 0, dir: 'up-left' }, { type: 'tap', lane: 2 }, { type: 'swipe', lane: 2, dir: 'up-right' }, { type: 'tap', lane: 0 }],
  [{ type: 'tap', lane: 1 }, { type: 'swipe', lane: 0, dir: 'down' }, { type: 'swipe', lane: 2, dir: 'down' }, { type: 'swipe', lane: 1, dir: 'down' }],
  [{ type: 'swipe', lane: 1, dir: 'down-left' }, { type: 'tap', lane: 0 }, { type: 'swipe', lane: 1, dir: 'down-right' }, { type: 'tap', lane: 2 }],
  [{ type: 'tap', lane: 0 }, { type: 'swipe', lane: 0, dir: 'up' }, { type: 'tap', lane: 2 }, { type: 'swipe', lane: 2, dir: 'up' }],
  [{ type: 'swipe', lane: 1, dir: 'left' }, { type: 'swipe', lane: 1, dir: 'right' }, { type: 'tap', lane: 0 }, { type: 'tap', lane: 2 }],
  [{ type: 'swipe', lane: 0, dir: 'up' }, { type: 'swipe', lane: 1, dir: 'up' }, { type: 'swipe', lane: 2, dir: 'up' }, { type: 'tap', lane: 1 }],
  [{ type: 'tap', lane: 1 }, { type: 'swipe', lane: 0, dir: 'up-left' }, { type: 'tap', lane: 1 }, { type: 'swipe', lane: 2, dir: 'down-right' }]
];

const SLIDE_MIXED_PATTERNS = [
  [{ type: 'slide', lane: 0, target: 1, dir: 'right' }, { type: 'tap', lane: 1 }, { type: 'slide', lane: 1, target: 2, dir: 'right' }, { type: 'tap', lane: 2 }],
  [{ type: 'slide', lane: 0, target: 2, dir: 'right' }, { type: 'tap', lane: 1 }, { type: 'slide', lane: 2, target: 0, dir: 'left' }, { type: 'tap', lane: 1 }],
  [{ type: 'tap', lane: 1 }, { type: 'slide', lane: 1, target: 0, dir: 'left' }, { type: 'tap', lane: 0 }, { type: 'slide', lane: 0, target: 1, dir: 'right' }],
  [{ type: 'tap', lane: 0 }, { type: 'slide', lane: 1, target: 2, dir: 'right' }, { type: 'tap', lane: 2 }, { type: 'slide', lane: 2, target: 1, dir: 'left' }],
  [{ type: 'slide', lane: 2, target: 0, dir: 'left' }, { type: 'tap', lane: 0 }, { type: 'slide', lane: 0, target: 2, dir: 'right' }, { type: 'tap', lane: 2 }],
  [{ type: 'tap', lane: 1 }, { type: 'tap', lane: 1 }, { type: 'slide', lane: 0, target: 2, dir: 'right' }, { type: 'tap', lane: 2 }],
  [{ type: 'slide', lane: 1, target: 0, dir: 'left' }, { type: 'slide', lane: 0, target: 1, dir: 'right' }, { type: 'tap', lane: 2 }, { type: 'tap', lane: 1 }],
  [{ type: 'tap', lane: 2 }, { type: 'slide', lane: 2, target: 0, dir: 'left' }, { type: 'tap', lane: 0 }, { type: 'slide', lane: 0, target: 2, dir: 'right' }],
  [{ type: 'slide', lane: 1, target: 0, dir: 'left' }, { type: 'tap', lane: 2 }, { type: 'slide', lane: 1, target: 2, dir: 'right' }, { type: 'tap', lane: 0 }],
  [{ type: 'slide', lane: 0, target: 2, dir: 'right' }, { type: 'slide', lane: 2, target: 0, dir: 'left' }, { type: 'tap', lane: 1 }, { type: 'tap', lane: 1 }],
  [{ type: 'slide', lane: 0, target: 1, dir: 'right' }, { type: 'slide', lane: 1, target: 0, dir: 'left' }, { type: 'slide', lane: 0, target: 2, dir: 'right' }, { type: 'tap', lane: 2 }],
  [{ type: 'slide', lane: 2, target: 1, dir: 'left' }, { type: 'slide', lane: 1, target: 2, dir: 'right' }, { type: 'tap', lane: 0 }, { type: 'tap', lane: 1 }],
  [{ type: 'tap', lane: 1 }, { type: 'slide', lane: 0, target: 2, dir: 'right' }, { type: 'slide', lane: 2, target: 1, dir: 'left' }, { type: 'tap', lane: 0 }],
  [{ type: 'slide', lane: 1, target: 0, dir: 'left' }, { type: 'slide', lane: 0, target: 2, dir: 'right' }, { type: 'tap', lane: 1 }, { type: 'tap', lane: 2 }],
  [{ type: 'slide', lane: 0, target: 1, dir: 'right' }, { type: 'tap', lane: 2 }, { type: 'slide', lane: 2, target: 1, dir: 'left' }, { type: 'tap', lane: 0 }],
  [{ type: 'slide', lane: 1, target: 2, dir: 'right' }, { type: 'slide', lane: 2, target: 0, dir: 'left' }, { type: 'tap', lane: 1 }, { type: 'swipe', lane: 1, dir: 'up' }],
  [{ type: 'tap', lane: 0 }, { type: 'slide', lane: 1, target: 0, dir: 'left' }, { type: 'tap', lane: 2 }, { type: 'slide', lane: 1, target: 2, dir: 'right' }],
  [{ type: 'slide', lane: 0, target: 2, dir: 'right' }, { type: 'tap', lane: 1 }, { type: 'swipe', lane: 2, dir: 'down' }, { type: 'tap', lane: 0 }]
];

const DUAL_TAP_PATTERNS = [
  [{ a: { type: 'tap', lane: 0 }, b: { type: 'tap', lane: 2 } }, { a: { type: 'tap', lane: 1 }, b: { type: 'tap', lane: 1 } }, { a: { type: 'tap', lane: 0 }, b: { type: 'tap', lane: 2 } }, { a: { type: 'tap', lane: 1 }, b: { type: 'tap', lane: 1 } }],
  [{ a: { type: 'tap', lane: 0 }, b: { type: 'tap', lane: 1 } }, { a: { type: 'tap', lane: 2 }, b: { type: 'tap', lane: 2 } }, { a: { type: 'tap', lane: 1 }, b: { type: 'tap', lane: 2 } }, { a: { type: 'tap', lane: 0 }, b: { type: 'tap', lane: 2 } }],
  [{ a: { type: 'tap', lane: 0 }, b: { type: 'tap', lane: 1 } }, { a: { type: 'tap', lane: 1 }, b: { type: 'tap', lane: 2 } }, { a: { type: 'tap', lane: 0 }, b: { type: 'tap', lane: 2 } }, { a: { type: 'tap', lane: 0 }, b: { type: 'tap', lane: 1 } }],
  [{ a: { type: 'tap', lane: 1 }, b: { type: 'tap', lane: 1 } }, { a: { type: 'tap', lane: 1 }, b: { type: 'tap', lane: 1 } }, { a: { type: 'tap', lane: 0 }, b: { type: 'tap', lane: 2 } }, { a: { type: 'tap', lane: 0 }, b: { type: 'tap', lane: 2 } }],
  [{ a: { type: 'tap', lane: 0 }, b: { type: 'tap', lane: 2 } }, { a: { type: 'tap', lane: 0 }, b: { type: 'tap', lane: 1 } }, { a: { type: 'tap', lane: 0 }, b: { type: 'tap', lane: 2 } }, { a: { type: 'tap', lane: 1 }, b: { type: 'tap', lane: 2 } }],
  [{ a: { type: 'tap', lane: 0 }, b: { type: 'tap', lane: 1 } }, { a: { type: 'tap', lane: 1 }, b: { type: 'tap', lane: 2 } }, { a: { type: 'tap', lane: 0 }, b: { type: 'tap', lane: 1 } }, { a: { type: 'tap', lane: 1 }, b: { type: 'tap', lane: 2 } }],
  [{ a: { type: 'tap', lane: 0 }, b: { type: 'tap', lane: 2 } }, { a: { type: 'tap', lane: 1 }, b: { type: 'tap', lane: 1 } }, { a: { type: 'tap', lane: 0 }, b: { type: 'tap', lane: 1 } }, { a: { type: 'tap', lane: 1 }, b: { type: 'tap', lane: 2 } }],
  [{ a: { type: 'tap', lane: 0 }, b: { type: 'tap', lane: 2 } }, { a: { type: 'tap', lane: 1 }, b: { type: 'tap', lane: 2 } }, { a: { type: 'tap', lane: 0 }, b: { type: 'tap', lane: 1 } }, { a: { type: 'tap', lane: 0 }, b: { type: 'tap', lane: 2 } }],
  [{ a: { type: 'tap', lane: 0 }, b: { type: 'tap', lane: 2 } }, { a: { type: 'tap', lane: 0 }, b: { type: 'tap', lane: 2 } }, { a: { type: 'tap', lane: 1 }, b: { type: 'tap', lane: 1 } }, { a: { type: 'tap', lane: 0 }, b: { type: 'tap', lane: 2 } }],
  [{ a: { type: 'tap', lane: 0 }, b: { type: 'tap', lane: 1 } }, { a: { type: 'tap', lane: 0 }, b: { type: 'tap', lane: 1 } }, { a: { type: 'tap', lane: 1 }, b: { type: 'tap', lane: 2 } }, { a: { type: 'tap', lane: 1 }, b: { type: 'tap', lane: 2 } }],
  [{ a: { type: 'tap', lane: 1 }, b: { type: 'tap', lane: 1 } }, { a: { type: 'tap', lane: 0 }, b: { type: 'tap', lane: 2 } }, { a: { type: 'tap', lane: 1 }, b: { type: 'tap', lane: 1 } }, { a: { type: 'tap', lane: 0 }, b: { type: 'tap', lane: 2 } }],
  [{ a: { type: 'tap', lane: 0 }, b: { type: 'tap', lane: 1 } }, { a: { type: 'tap', lane: 0 }, b: { type: 'tap', lane: 2 } }, { a: { type: 'tap', lane: 1 }, b: { type: 'tap', lane: 2 } }, { a: { type: 'tap', lane: 0 }, b: { type: 'tap', lane: 2 } }],
  [{ a: { type: 'tap', lane: 0 }, b: { type: 'tap', lane: 2 } }, { a: { type: 'tap', lane: 1 }, b: { type: 'tap', lane: 2 } }, { a: { type: 'tap', lane: 0 }, b: { type: 'tap', lane: 2 } }, { a: { type: 'tap', lane: 0 }, b: { type: 'tap', lane: 1 } }],
  [{ a: { type: 'tap', lane: 0 }, b: { type: 'tap', lane: 1 } }, { a: { type: 'tap', lane: 1 }, b: { type: 'tap', lane: 2 } }, { a: { type: 'tap', lane: 0 }, b: { type: 'tap', lane: 2 } }, { a: { type: 'tap', lane: 1 }, b: { type: 'tap', lane: 1 } }],
  [{ a: { type: 'tap', lane: 0 }, b: { type: 'tap', lane: 2 } }, { a: { type: 'tap', lane: 0 }, b: { type: 'tap', lane: 2 } }, { a: { type: 'tap', lane: 0 }, b: { type: 'tap', lane: 2 } }, { a: { type: 'tap', lane: 1 }, b: { type: 'tap', lane: 1 } }],
  [{ a: { type: 'tap', lane: 1 }, b: { type: 'tap', lane: 2 } }, { a: { type: 'tap', lane: 0 }, b: { type: 'tap', lane: 1 } }, { a: { type: 'tap', lane: 1 }, b: { type: 'tap', lane: 2 } }, { a: { type: 'tap', lane: 0 }, b: { type: 'tap', lane: 2 } }]
];

const DUAL_HOLD_PATTERNS = [
  [{ a: { type: 'hold', lane: 0 }, b: { type: 'tap', lane: 2 } }, { a: { type: 'tap', lane: 1 }, b: { type: 'tap', lane: 1 } }, { a: { type: 'hold', lane: 2 }, b: { type: 'tap', lane: 0 } }, { a: { type: 'tap', lane: 1 }, b: { type: 'tap', lane: 1 } }],
  [{ a: { type: 'hold', lane: 0 }, b: { type: 'hold', lane: 2 } }, { a: { type: 'tap', lane: 1 }, b: { type: 'tap', lane: 1 } }, { a: { type: 'tap', lane: 0 }, b: { type: 'tap', lane: 2 } }, { a: { type: 'tap', lane: 1 }, b: { type: 'tap', lane: 1 } }],
  [{ a: { type: 'hold', lane: 1 }, b: { type: 'tap', lane: 0 } }, { a: { type: 'tap', lane: 2 }, b: { type: 'tap', lane: 2 } }, { a: { type: 'hold', lane: 1 }, b: { type: 'tap', lane: 2 } }, { a: { type: 'tap', lane: 0 }, b: { type: 'tap', lane: 0 } }],
  [{ a: { type: 'hold', lane: 0 }, b: { type: 'tap', lane: 1 } }, { a: { type: 'tap', lane: 1 }, b: { type: 'tap', lane: 1 } }, { a: { type: 'tap', lane: 1 }, b: { type: 'tap', lane: 1 } }, { a: { type: 'hold', lane: 2 }, b: { type: 'tap', lane: 1 } }],
  [{ a: { type: 'hold', lane: 2 }, b: { type: 'tap', lane: 0 } }, { a: { type: 'tap', lane: 1 }, b: { type: 'tap', lane: 1 } }, { a: { type: 'tap', lane: 0 }, b: { type: 'tap', lane: 0 } }, { a: { type: 'tap', lane: 1 }, b: { type: 'tap', lane: 1 } }],
  [{ a: { type: 'hold', lane: 0 }, b: { type: 'tap', lane: 1 } }, { a: { type: 'hold', lane: 2 }, b: { type: 'tap', lane: 1 } }, { a: { type: 'hold', lane: 0 }, b: { type: 'tap', lane: 2 } }, { a: { type: 'tap', lane: 1 }, b: { type: 'tap', lane: 1 } }],
  [{ a: { type: 'hold', lane: 0 }, b: { type: 'tap', lane: 1 } }, { a: { type: 'tap', lane: 2 }, b: { type: 'hold', lane: 1 } }, { a: { type: 'hold', lane: 2 }, b: { type: 'tap', lane: 1 } }, { a: { type: 'tap', lane: 0 }, b: { type: 'hold', lane: 1 } }],
  [{ a: { type: 'hold', lane: 0 }, b: { type: 'hold', lane: 1 } }, { a: { type: 'tap', lane: 2 }, b: { type: 'tap', lane: 2 } }, { a: { type: 'hold', lane: 1 }, b: { type: 'hold', lane: 2 } }, { a: { type: 'tap', lane: 0 }, b: { type: 'tap', lane: 0 } }],
  [{ a: { type: 'hold', lane: 1 }, b: { type: 'hold', lane: 1 } }, { a: { type: 'tap', lane: 0 }, b: { type: 'tap', lane: 2 } }, { a: { type: 'tap', lane: 0 }, b: { type: 'tap', lane: 2 } }, { a: { type: 'hold', lane: 1 }, b: { type: 'hold', lane: 1 } }],
  [{ a: { type: 'hold', lane: 0 }, b: { type: 'tap', lane: 2 } }, { a: { type: 'hold', lane: 0 }, b: { type: 'tap', lane: 1 } }, { a: { type: 'hold', lane: 2 }, b: { type: 'tap', lane: 0 } }, { a: { type: 'hold', lane: 2 }, b: { type: 'tap', lane: 1 } }],
  [{ a: { type: 'hold', lane: 1 }, b: { type: 'tap', lane: 0 } }, { a: { type: 'tap', lane: 2 }, b: { type: 'tap', lane: 2 } }, { a: { type: 'hold', lane: 1 }, b: { type: 'tap', lane: 2 } }, { a: { type: 'tap', lane: 0 }, b: { type: 'tap', lane: 0 } }],
  [{ a: { type: 'hold', lane: 0 }, b: { type: 'hold', lane: 2 } }, { a: { type: 'tap', lane: 1 }, b: { type: 'tap', lane: 1 } }, { a: { type: 'hold', lane: 1 }, b: { type: 'hold', lane: 1 } }, { a: { type: 'tap', lane: 0 }, b: { type: 'tap', lane: 2 } }],
  [{ a: { type: 'hold', lane: 0 }, b: { type: 'tap', lane: 1 } }, { a: { type: 'hold', lane: 2 }, b: { type: 'tap', lane: 1 } }, { a: { type: 'tap', lane: 0 }, b: { type: 'tap', lane: 2 } }, { a: { type: 'hold', lane: 1 }, b: { type: 'tap', lane: 1 } }],
  [{ a: { type: 'hold', lane: 2 }, b: { type: 'tap', lane: 0 } }, { a: { type: 'hold', lane: 1 }, b: { type: 'tap', lane: 0 } }, { a: { type: 'hold', lane: 0 }, b: { type: 'tap', lane: 2 } }, { a: { type: 'hold', lane: 1 }, b: { type: 'tap', lane: 2 } }],
  [{ a: { type: 'hold', lane: 0 }, b: { type: 'hold', lane: 2 } }, { a: { type: 'tap', lane: 1 }, b: { type: 'tap', lane: 1 } }, { a: { type: 'tap', lane: 1 }, b: { type: 'tap', lane: 1 } }, { a: { type: 'hold', lane: 0 }, b: { type: 'hold', lane: 2 } }],
  [{ a: { type: 'hold', lane: 1 }, b: { type: 'tap', lane: 0 } }, { a: { type: 'hold', lane: 2 }, b: { type: 'tap', lane: 1 } }, { a: { type: 'hold', lane: 0 }, b: { type: 'tap', lane: 2 } }, { a: { type: 'hold', lane: 1 }, b: { type: 'tap', lane: 0 } }]
];

const BPM_PATTERNS = [
  [{ beat: 0, lane: 1, type: 'tap' }, { beat: 1, lane: 2, type: 'tap' }, { beat: 2, lane: 0, type: 'tap' }, { beat: 3, lane: 1, type: 'tap' }],
  [{ beat: 0, lane: 0, type: 'tap' }, { beat: 0.5, lane: 2, type: 'swipe', swipeDirection: 'right' }, { beat: 1.5, lane: 1, type: 'tap' }, { beat: 2, lane: 0, type: 'tap' }, { beat: 3, lane: 2, type: 'swipe', swipeDirection: 'up' }, { beat: 3.5, lane: 1, type: 'tap' }],
  [{ beat: 0, lane: 0, type: 'tap' }, { beat: 0.5, lane: 1, type: 'tap' }, { beat: 1, lane: 2, type: 'hold', holdDurationBeats: 1.0 }, { beat: 2.5, lane: 0, type: 'tap' }, { beat: 3, lane: 1, type: 'swipe', swipeDirection: 'left' }],
  [{ beat: 0, lane: 0, type: 'tap' }, { beat: 0, lane: 2, type: 'tap' }, { beat: 0.75, lane: 1, type: 'tap' }, { beat: 1.5, lane: 0, type: 'tap' }, { beat: 1.5, lane: 2, type: 'tap' }, { beat: 2.25, lane: 1, type: 'tap' }, { beat: 3, lane: 0, type: 'tap' }, { beat: 3, lane: 2, type: 'tap' }],
  [{ beat: 0, lane: 0, type: 'slide', holdDurationBeats: 1.5, targetLane: 2, swipeDirection: 'right' }, { beat: 1.5, lane: 2, type: 'tap' }, { beat: 2.0, lane: 2, type: 'slide', holdDurationBeats: 1.5, targetLane: 0, swipeDirection: 'left' }, { beat: 3.5, lane: 0, type: 'tap' }],
  [{ beat: 0, lane: 1, type: 'tap' }, { beat: 0.33, lane: 0, type: 'swipe', swipeDirection: 'left' }, { beat: 0.66, lane: 2, type: 'swipe', swipeDirection: 'right' }, { beat: 1.5, lane: 1, type: 'tap' }, { beat: 2.5, lane: 0, type: 'tap' }, { beat: 3, lane: 2, type: 'swipe', swipeDirection: 'up' }],
  [{ beat: 0, lane: 0, type: 'hold', holdDurationBeats: 1.5 }, { beat: 0, lane: 2, type: 'hold', holdDurationBeats: 1.5 }, { beat: 1.5, lane: 1, type: 'tap' }, { beat: 2.0, lane: 1, type: 'tap' }, { beat: 2.5, lane: 1, type: 'swipe', swipeDirection: 'up' }],
  [{ beat: 0, lane: 0, type: 'hold', holdDurationBeats: 1.5 }, { beat: 0.5, lane: 2, type: 'tap' }, { beat: 1.0, lane: 1, type: 'tap' }, { beat: 2.0, lane: 2, type: 'hold', holdDurationBeats: 1.5 }, { beat: 2.5, lane: 0, type: 'tap' }, { beat: 3.0, lane: 1, type: 'tap' }],
  [{ beat: 0, lane: 1, type: 'tap' }, { beat: 1, lane: 0, type: 'swipe', swipeDirection: 'down-left' }, { beat: 1.5, lane: 2, type: 'swipe', swipeDirection: 'down-right' }, { beat: 2.5, lane: 1, type: 'tap' }, { beat: 3, lane: 0, type: 'swipe', swipeDirection: 'up-left' }, { beat: 3.5, lane: 2, type: 'swipe', swipeDirection: 'up-right' }],
  [{ beat: 0, lane: 1, type: 'slide', holdDurationBeats: 1.0, targetLane: 0, swipeDirection: 'left' }, { beat: 1.0, lane: 0, type: 'slide', holdDurationBeats: 1.0, targetLane: 2, swipeDirection: 'right' }, { beat: 2.0, lane: 2, type: 'slide', holdDurationBeats: 1.0, targetLane: 1, swipeDirection: 'left' }, { beat: 3.0, lane: 1, type: 'swipe', swipeDirection: 'up' }],
  [{ beat: 0, lane: 0, type: 'tap' }, { beat: 0, lane: 1, type: 'tap' }, { beat: 0.75, lane: 1, type: 'tap' }, { beat: 0.75, lane: 2, type: 'tap' }, { beat: 1.5, lane: 0, type: 'tap' }, { beat: 1.5, lane: 2, type: 'tap' }, { beat: 2.5, lane: 1, type: 'swipe', swipeDirection: 'down' }, { beat: 3.0, lane: 0, type: 'tap' }, { beat: 3.5, lane: 2, type: 'tap' }],
  [{ beat: 0, lane: 0, type: 'slide', holdDurationBeats: 1.0, targetLane: 1, swipeDirection: 'right' }, { beat: 1.0, lane: 2, type: 'slide', holdDurationBeats: 1.0, targetLane: 1, swipeDirection: 'left' }, { beat: 2.0, lane: 1, type: 'hold', holdDurationBeats: 1.5 }, { beat: 2.5, lane: 0, type: 'tap' }, { beat: 3.0, lane: 2, type: 'tap' }]
];

function generateNotesFromLyrics(words, bpm = 100) {
  const notes = [];
  let id = 0;
  let patternIdx = 0;
  let noteInPattern = 0;
  let lastSnapped = -1;
  const MIN_GAP = 0.15;
  let phraseCount = 0;

  let phraseType = 'tap';

  for (const word of words) {
    if (word.start < 1.0) continue;

    const snapped = snapToBeat(word.start, bpm, 16);
    if (snapped - lastSnapped < MIN_GAP) continue;

    if (lastSnapped > 0 && snapped - lastSnapped > 0.65) {
      phraseCount++;
      noteInPattern = 0;
      patternIdx++;

      if (phraseCount < 3) {
        phraseType = 'tap';
      } else {
        const cycle = (phraseCount - 2) % 16;
        if (cycle === 1 || cycle === 9) phraseType = 'dual';
        else if (cycle === 2 || cycle === 10) phraseType = 'swipe';
        else if (cycle === 4 || cycle === 12) phraseType = 'slide';
        else if (cycle === 5 || cycle === 13) phraseType = 'dual_hold';
        else if (cycle === 7 || cycle === 15) phraseType = 'swipe';
        else phraseType = 'tap';
      }
    }

    const dur = word.end - word.start;

    if (phraseType === 'dual') {
      const p = DUAL_TAP_PATTERNS[patternIdx % DUAL_TAP_PATTERNS.length];
      const step = p[noteInPattern % p.length];
      noteInPattern++;
      lastSnapped = snapped;
      notes.push({
        id: id++, time: snapped, lane: step.a.lane,
        type: step.a.type === 'slide' ? 'hold' : step.a.type,
        holdDuration: step.a.type === 'hold' ? Math.max(0.5, dur) : undefined,
      });
      if (step.b.lane !== step.a.lane) {
        notes.push({
          id: id++, time: snapped, lane: step.b.lane,
          type: step.b.type === 'slide' ? 'hold' : step.b.type,
          holdDuration: step.b.type === 'hold' ? Math.max(0.5, dur) : undefined,
        });
      }
      continue;
    }

    if (phraseType === 'dual_hold') {
      const p = DUAL_HOLD_PATTERNS[patternIdx % DUAL_HOLD_PATTERNS.length];
      const step = p[noteInPattern % p.length];
      noteInPattern++;
      lastSnapped = snapped;
      const isHoldA = step.a.type === 'hold';
      notes.push({
        id: id++, time: snapped, lane: step.a.lane,
        type: step.a.type === 'slide' ? 'hold' : step.a.type,
        holdDuration: isHoldA ? Math.max(0.5, Math.min(dur * 0.8, 1.5)) : undefined,
      });
      if (step.b.lane !== step.a.lane) {
        const isHoldB = step.b.type === 'hold';
        notes.push({
          id: id++, time: snapped, lane: step.b.lane,
          type: step.b.type === 'slide' ? 'hold' : step.b.type,
          holdDuration: isHoldB ? Math.max(0.5, Math.min(dur * 0.8, 1.5)) : undefined,
        });
      }
      continue;
    }

    let lane;
    let type = 'tap';
    let targetLane;
    let swipeDirection;
    let holdDuration;

    if (phraseType === 'swipe') {
      const p = SWIPE_MIXED_PATTERNS[patternIdx % SWIPE_MIXED_PATTERNS.length];
      const entry = p[noteInPattern % p.length];
      lane = entry.lane;
      type = entry.type === 'slide' ? 'hold' : entry.type;
      swipeDirection = entry.dir;
      if (type === 'hold') holdDuration = Math.max(0.5, dur);
    } else if (phraseType === 'slide') {
      const p = SLIDE_MIXED_PATTERNS[patternIdx % SLIDE_MIXED_PATTERNS.length];
      const entry = p[noteInPattern % p.length];
      lane = entry.lane;
      targetLane = entry.target;
      swipeDirection = entry.dir;
      type = entry.type === 'slide' ? 'hold' : entry.type;
      if (type === 'hold') holdDuration = Math.max(0.6, Math.min(dur, 2.0));
    } else {
      const p = PHRASE_PATTERNS[patternIdx % PHRASE_PATTERNS.length];
      lane = p[noteInPattern % p.length];
      if (dur > 0.6) {
        type = 'hold';
        holdDuration = Math.min(dur * 0.8, 2.0);
      } else {
        type = 'tap';
      }
    }

    noteInPattern++;
    lastSnapped = snapped;

    notes.push({
      id: id++,
      time: snapped,
      lane,
      type,
      holdDuration,
      targetLane,
      swipeDirection,
    });
  }

  return notes;
}

function generateNotesFromBPM(bpm, duration) {
  const beatDur    = 60 / bpm;
  const measureDur = beatDur * 4;
  const notes = [];
  let id = 0;
  let measureStart = 2.5;

  let pi = 0;
  while (measureStart + measureDur < duration - 3) {
    for (const e of BPM_PATTERNS[pi % BPM_PATTERNS.length]) {
      const t = measureStart + e.beat * beatDur;
      if (t < duration - 3) {
        const type = e.type === 'slide' ? 'hold' : (e.type ?? 'tap');
        const holdDuration = e.type === 'hold' || e.type === 'slide'
          ? (e.holdDurationBeats ?? 1.0) * beatDur
          : undefined;
        notes.push({
          id: id++,
          time: t,
          lane: e.lane,
          type,
          holdDuration,
          targetLane: e.targetLane,
          swipeDirection: e.swipeDirection
        });
      }
    }
    measureStart += measureDur;
    pi++;
  }
  return notes;
}

function generateNotesInterwoven(words, bpm, duration) {
  const lyricNotes = generateNotesFromLyrics(words, bpm);
  if (lyricNotes.length === 0) {
    return generateNotesFromBPM(bpm, duration);
  }

  lyricNotes.sort((a, b) => a.time - b.time);

  const beatDur = 60 / bpm;
  const measureDur = beatDur * 4;

  const gaps = [];
  if (lyricNotes[0].time > 4.0) {
    gaps.push({ start: 1.0, end: lyricNotes[0].time });
  }

  for (let i = 0; i < lyricNotes.length - 1; i++) {
    const currentNote = lyricNotes[i];
    const nextNote = lyricNotes[i + 1];
    const currentEnd = currentNote.time + (currentNote.holdDuration ?? 0);
    const gapLen = nextNote.time - currentEnd;
    
    if (gapLen > 3.5) {
      gaps.push({ start: currentEnd, end: nextNote.time });
    }
  }

  const lastNote = lyricNotes[lyricNotes.length - 1];
  const lastEnd = lastNote.time + (lastNote.holdDuration ?? 0);
  if (duration - lastEnd > 5.0) {
    gaps.push({ start: lastEnd, end: duration - 3.0 });
  }

  const bpmNotes = [];
  let pi = 0;

  for (const gap of gaps) {
    const startBound = gap.start + 0.75;
    const endBound = gap.end - 0.75;
    if (endBound - startBound < measureDur) continue;

    let measureStart = snapToBeat(startBound, bpm, 4);
    if (measureStart < startBound) {
      measureStart += beatDur;
    }

    while (measureStart + measureDur <= endBound) {
      for (const e of BPM_PATTERNS[pi % BPM_PATTERNS.length]) {
        const t = measureStart + e.beat * beatDur;
        if (t >= startBound && t <= endBound) {
          const type = e.type === 'slide' ? 'hold' : (e.type ?? 'tap');
          const holdDuration = e.type === 'hold' || e.type === 'slide'
            ? (e.holdDurationBeats ?? 1.0) * beatDur
            : undefined;

          bpmNotes.push({
            time: t,
            lane: e.lane,
            type,
            holdDuration,
            targetLane: e.targetLane,
            swipeDirection: e.swipeDirection
          });
        }
      }
      measureStart += measureDur;
      pi++;
    }
  }

  const allRawNotes = [
    ...lyricNotes.map(n => ({
      time: n.time,
      lane: n.lane,
      type: n.type,
      holdDuration: n.holdDuration,
      targetLane: n.targetLane,
      swipeDirection: n.swipeDirection
    })),
    ...bpmNotes
  ];

  allRawNotes.sort((a, b) => a.time - b.time);

  const uniqueNotes = [];
  for (const note of allRawNotes) {
    const isDuplicate = uniqueNotes.some(existing => 
      Math.abs(existing.time - note.time) < 0.12 && existing.lane === note.lane
    );
    if (!isDuplicate) {
      uniqueNotes.push(note);
    }
  }

  const merged = [];
  let nextId = 0;
  for (const raw of uniqueNotes) {
    merged.push({
      id: nextId++,
      ...raw
    });
  }

  return merged;
}

function stageifyNotes(notes, duration, bpm, difficultyLevel) {
  const beatDuration = 60 / bpm;
  const stageBounds = [
    { stage: 1, name: "Stage 1", startTime: 0, endTime: duration * 0.20, difficulty: "Very Easy" },
    { stage: 2, name: "Stage 2", startTime: duration * 0.20, endTime: duration * 0.40, difficulty: "Easy" },
    { stage: 3, name: "Stage 3", startTime: duration * 0.40, endTime: duration * 0.65, difficulty: "Medium" },
    { stage: 4, name: "Stage 4", startTime: duration * 0.65, endTime: duration * 0.80, difficulty: "Hard" },
    { stage: 5, name: "Stage 5", startTime: duration * 0.80, endTime: duration, difficulty: "Expert" }
  ];

  const boundaries = [
    duration * 0.20,
    duration * 0.40,
    duration * 0.65,
    duration * 0.80
  ];

  const processed = [];

  notes.forEach(note => {
    const isInTransitionGap = boundaries.some(b => note.time >= b + 1.2 && note.time <= b + 4.2);
    if (isInTransitionGap) {
      return;
    }

    let stage = 5;
    for (let i = 0; i < stageBounds.length; i++) {
      if (note.time >= stageBounds[i].startTime && note.time < stageBounds[i].endTime) {
        stage = stageBounds[i].stage;
        break;
      }
    }

    const clone = { ...note, stage };

    if (stage === 1) {
      clone.type = 'tap';
      delete clone.holdDuration;
      delete clone.targetLane;
      delete clone.swipeDirection;
      const lastNote = processed.filter(n => n.stage === 1).pop();
      if (lastNote && clone.time - lastNote.time < beatDuration * 0.85) {
        return;
      }
    } else if (stage === 2) {
      if (clone.type === 'swipe') {
        clone.type = 'tap';
        delete clone.swipeDirection;
      }
      const lastNote = processed.filter(n => n.stage === 2).pop();
      if (lastNote && clone.time - lastNote.time < beatDuration * 0.45) {
        return;
      }
    } else if (stage === 3) {
      const lastNote = processed.filter(n => n.stage === 3).pop();
      if (lastNote && clone.time - lastNote.time < beatDuration * 0.22) {
        return;
      }
    } else if (stage === 4) {
      const lastNote = processed.filter(n => n.stage === 4).pop();
      if (lastNote && clone.time - lastNote.time < beatDuration * 0.15) {
        return;
      }
    } else if (stage === 5) {
      const lastNote = processed.filter(n => n.stage === 5).pop();
      if (lastNote && clone.time - lastNote.time < beatDuration * 0.08) {
        return;
      }
    }

    if (stage <= 3) {
      const duplicateTime = processed.some(n => Math.abs(n.time - clone.time) < 0.02);
      if (duplicateTime) {
        return;
      }
    }

    processed.push(clone);
  });

  const finalNotes = processed.map((note, index) => ({
    ...note,
    id: index
  }));

  const stagesWithCounts = stageBounds.map(sb => {
    const noteCount = finalNotes.filter(n => n.stage === sb.stage).length;
    return {
      ...sb,
      noteCount
    };
  });

  return { notes: finalNotes, stages: stagesWithCounts };
}


function calcDifficulty(bpm, valence, noteCount, duration = 180) {
  const bpmNorm = (bpm - 80) / 100;
  const bpmScore = Math.min(10, Math.max(1, Math.round(1 + 9 * Math.max(0, Math.min(1, bpmNorm)))));
  const nps = noteCount / Math.max(30, duration);
  const densityScore = Math.min(10, Math.max(1, Math.round(nps * 3.5)));
  const valenceBoost = valence < 0.35 ? 1 : valence > 0.7 ? -1 : 0;
  const raw = (bpmScore * 0.4 + densityScore * 0.5) + valenceBoost;
  return Math.max(1, Math.min(10, Math.round(raw)));
}

// Helper to resolve supabase urls (mirroring resolving inside buildGameSong)
function resolveUrls(r) {
  const dayNum = r.day;
  let audioUrl = r.storedAudioUrl || '';
  let coverArt = r.coverArt || null;
  if (coverArt) {
    coverArt = coverArt.replace(/\.png$/i, '.jpg');
  }
  return { audioUrl, coverArt };
}

// JSON Fetch logic
function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch(e) { reject(e); } });
    }).on('error', reject);
  });
}

async function main() {
  let data;
  const localPaths = [
    path.join(__dirname, '../public/release-data.json'),
    path.join(__dirname, '../release-data.json'),
    '/Volumes/extremeUno/th3scr1b3-365-warp/public/release-data.json'
  ];

  let loadedLocal = false;
  for (const localPath of localPaths) {
    if (fs.existsSync(localPath)) {
      try {
        console.log(`Loading local release data from ${localPath}...`);
        data = JSON.parse(fs.readFileSync(localPath, 'utf8'));
        loadedLocal = true;
        break;
      } catch (e) {
        console.warn(`Failed to parse local release data at ${localPath}:`, e.message);
      }
    }
  }

  if (!loadedLocal) {
    console.log(`Fetching release data from remote URL ${RELEASE_DATA_URL}...`);
    data = await fetchJson(RELEASE_DATA_URL);
  }

  const rawReleases = data.releases || [];

  // Deduplicate by day — keep first occurrence if the source data has repeats
  const seenDays = new Set();
  const releases = rawReleases.filter(r => {
    if (seenDays.has(r.day)) {
      console.warn(`[split_songs] Skipping duplicate day ${r.day} in source data.`);
      return false;
    }
    seenDays.add(r.day);
    return true;
  });

  console.log(`Got ${rawReleases.length} raw releases → ${releases.length} unique days.`);

  const songCatalog = [];
  const cardCatalog = [];

  for (const r of releases) {
    const day = r.day;
    const lyricsWords = r.lyricsWords || [];
    const bpm = r.tempo || 100;
    const duration = Math.ceil(r.duration || 180);
    const valence = r.valence ?? 0.5;

    // Default note generation strategy (similar to 'auto' mode in api.ts)
    const rawNotes = lyricsWords.length > 15
      ? generateNotesInterwoven(lyricsWords, bpm, duration)
      : generateNotesFromBPM(bpm, duration);

    const difficultyLevel = calcDifficulty(bpm, valence, rawNotes.length, duration);
    const { notes, stages } = stageifyNotes(rawNotes, duration, bpm, difficultyLevel);
    const { audioUrl, coverArt } = resolveUrls(r);

    const songId = `day-${String(day).padStart(3, '0')}`;
    const cardId = `card-${day}`;

    // Seeded random rarity for this card (to match deterministic roll in vaultService)
    const rng = seededRandom(day * 7919 + 31337);
    const traitScore = (Math.abs((r.energy ?? 0.5) - 0.5) * 2 + Math.abs(valence - 0.5) * 2) / 2;
    const rarityRoll = rng();
    let rarity = 'common';
    if (rarityRoll < 0.02 + traitScore * 0.01) rarity = 'legendary';
    else if (rarityRoll < 0.12 + traitScore * 0.05) rarity = 'rare';
    else if (rarityRoll < 0.35 + traitScore * 0.05) rarity = 'uncommon';

    // 1. Unlocks & requirements setup
    // Setup unlock requirement for the song (e.g. requires the card or fragments)
    const unlockReq = {
      card: cardId,
      fragments: 10
    };

    // 2. Full song details JSON
    const songDetail = {
      id: songId,
      day,
      date: r.date,
      title: r.title || r.canonicalTitle || `Day ${day}`,
      artist: 'TH3SCR1B3',
      bpm,
      duration,
      mood: r.mood === 'light' ? 'light' : 'dark',
      valence,
      moodTags: Array.isArray(r.tags) ? r.tags.slice(0, 3) : [],
      description: r.description || '',
      audioUrl,
      coverArt,
      notes,
      stages,
      key: r.key || '',
      genre: Array.isArray(r.genre) ? r.genre : [],
      difficultyLevel,
      lyrics: r.lyrics || '',
      lyricsSegments: r.lyricsSegments || [],
      unlock: unlockReq
    };

    const songDetailPath = path.join(SONGS_DIR, `${songId}.json`);
    fs.writeFileSync(songDetailPath, JSON.stringify(songDetail, null, 2));

    // 3. Add to lightweight song catalog (without large arrays)
    songCatalog.push({
      id: songId,
      day,
      date: r.date,
      title: songDetail.title,
      artist: songDetail.artist,
      bpm,
      duration,
      mood: songDetail.mood,
      valence,
      moodTags: songDetail.moodTags,
      description: songDetail.description,
      audioUrl,
      coverArt,
      key: songDetail.key,
      genre: songDetail.genre,
      difficultyLevel,
      stages,
      unlock: unlockReq
    });

    // 4. Card details JSON
    const cardDetail = {
      id: cardId,
      day,
      title: songDetail.title,
      storageTitle: r.storageTitle,
      mood: songDetail.mood,
      rarity,
      energy: r.energy ?? 0.5,
      valence,
      tempo: bpm,
      genre: songDetail.genre,
      tags: songDetail.moodTags,
      coverUrl: coverArt || '',
      audioUrl,
      description: songDetail.description,
      claimedCount: Math.floor(seededRandom(day * 9973)() * 45),
      maxSupply: 100,
      song: songId
    };

    const cardDetailPath = path.join(CARDS_DIR, `${cardId}.json`);
    fs.writeFileSync(cardDetailPath, JSON.stringify(cardDetail, null, 2));

    // 5. Add to card catalog (contains full details since they are small)
    cardCatalog.push(cardDetail);
  }

  // 6. Write catalog files
  fs.writeFileSync(path.join(ROOT_DATA, 'song_catalog.json'), JSON.stringify(songCatalog, null, 2));
  fs.writeFileSync(path.join(ROOT_DATA, 'card_catalog.json'), JSON.stringify(cardCatalog, null, 2));

  // 7. Write the 3 local test songs into JSON too
  const localTestSongs = [
    {
      id: 'transmission-001',
      title: 'TRANSMISSION 001',
      artist: 'TH3SCR1B3',
      bpm: 82,
      duration: 95,
      difficulty: 'LIGHT',
      difficultyLevel: 3,
      description: 'The signal finds you in the dark. Begin here.',
      moodTag: 'Melancholic / Ambient',
      audioUrl: 'https://pznmptudgicrmljjafex.supabase.co/storage/v1/object/public/releaseready/audio/january/were%20going%20crazy%20world.wav',
      coverArt: 'https://pznmptudgicrmljjafex.supabase.co/storage/v1/object/public/releaseready/covers/january/01%20-%20Were%20Going%20Crazy%20World.jpg',
      notes: []
    },
    {
      id: 'signal-rising',
      title: 'SIGNAL_RISING',
      artist: 'TH3SCR1B3',
      bpm: 120,
      duration: 100,
      difficulty: 'DARK',
      difficultyLevel: 6,
      description: 'The transmission intensifies. The static becomes music.',
      moodTag: 'Driving / Electronic',
      audioUrl: 'https://pznmptudgicrmljjafex.supabase.co/storage/v1/object/public/releaseready/audio/january/were%20going%20crazy%20world.wav',
      coverArt: 'https://pznmptudgicrmljjafex.supabase.co/storage/v1/object/public/releaseready/covers/january/01%20-%20Were%20Going%20Crazy%20World.jpg',
      notes: []
    },
    {
      id: 'break-of-light',
      title: 'BR34K_OF_LIGHT',
      artist: 'TH3SCR1B3',
      bpm: 145,
      duration: 110,
      difficulty: 'VOID',
      difficultyLevel: 9,
      description: 'Past the dark, velocity becomes transcendence.',
      moodTag: 'Intense / Euphoric',
      audioUrl: 'https://pznmptudgicrmljjafex.supabase.co/storage/v1/object/public/releaseready/audio/january/were%20going%20crazy%20world.wav',
      coverArt: 'https://pznmptudgicrmljjafex.supabase.co/storage/v1/object/public/releaseready/covers/january/01%20-%20Were%20Going%20Crazy%20World.jpg',
      notes: []
    }
  ];

  for (const song of localTestSongs) {
    const detailPath = path.join(SONGS_DIR, `${song.id}.json`);
    fs.writeFileSync(detailPath, JSON.stringify(song, null, 2));
  }

  console.log(`Successfully split database.`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
