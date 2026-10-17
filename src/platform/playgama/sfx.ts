import compressedSfx from './compressedSfx.json';

const IS_PLAYGAMA = import.meta.env.VITE_PLATFORM === 'playgama';
const COMPRESSED = new Set<string>(compressedSfx);

/** Playgama only accepts plain Latin file names; the build renames sfx files the same way. */
export function playgamaSfxName(name: string): string {
  return name.replace(/[^A-Za-z0-9._-]/g, '_');
}

/**
 * URL of a file in public/audio/sfx. The Playgama archive has a 300 MB cap, so
 * scripts/build-playgama.mjs re-encodes the long music beds listed in
 * compressedSfx.json to MP3; short hit sounds stay WAV to keep them latency-free.
 */
export function sfxUrl(name: string): string {
  if (!IS_PLAYGAMA) return `/audio/sfx/${encodeURIComponent(name)}.wav`;
  const ext = COMPRESSED.has(name) ? 'mp3' : 'wav';
  return `/audio/sfx/${playgamaSfxName(name)}.${ext}`;
}
