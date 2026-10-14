import type { GameSong } from '@/game/api';
import type { PovMode } from '@/lib/options';

export type TrackArchetype =
  | 'cyber_tunnel'
  | 'corkscrew_slide'
  | 'radial_orbit'
  | 'horizontal_drift'
  | 'wave_coaster'
  | 'matrix_split';


export interface ArchetypeMeta {
  key: TrackArchetype;
  name: string;
  stage3Title: string;
  stage4Title: string;
  stage5Title: string;
  primerColor: string;
  stage5Color: string;
}


export const ARCHETYPE_METAS: Record<TrackArchetype, ArchetypeMeta> = {
  cyber_tunnel: {
    key: 'cyber_tunnel',
    name: '3D CYBER TUNNEL',
    stage3Title: 'STAGE 3: 3D CYBER TUNNEL',
    stage4Title: 'STAGE 4: CYBER PRIMER VOID',
    stage5Title: 'STAGE 5: HYPER-SPEED TUNNEL OVERDRIVE',
    primerColor: '#00E5FF',
    stage5Color: '#FF007F',
  },
  corkscrew_slide: {
    key: 'corkscrew_slide',
    name: 'CORKSCREW HELICAL SLIDE',
    stage3Title: 'STAGE 3: CORKSCREW HELICAL SLIDE',
    stage4Title: 'STAGE 4: PLASMA PRIMER VOID',
    stage5Title: 'STAGE 5: TURBO CORKSCREW OVERDRIVE',
    primerColor: '#FF7B00',
    stage5Color: '#FFD700',
  },
  radial_orbit: {
    key: 'radial_orbit',
    name: '360° RADIAL CYBER ORBIT',
    stage3Title: 'STAGE 3: 360° RADIAL ORBIT',
    stage4Title: 'STAGE 4: STARLIGHT PRIMER VOID',
    stage5Title: 'STAGE 5: ORBITAL SUPERNOVA ZENITH',
    primerColor: '#00F5D4',
    stage5Color: '#39FF14',
  },
  horizontal_drift: {
    key: 'horizontal_drift',
    name: 'HORIZONTAL SIDE-SCROLLER',
    stage3Title: 'STAGE 3: HORIZONTAL SIDE-SCROLLER',
    stage4Title: 'STAGE 4: NEON DRIFT PRIMER',
    stage5Title: 'STAGE 5: HYPER-DRIVE SIDE-SCROLLER',
    primerColor: '#FF1493',
    stage5Color: '#00E5FF',
  },
  wave_coaster: {
    key: 'wave_coaster',
    name: 'WAVE ROLLERCOASTER',
    stage3Title: 'STAGE 3: 3D WAVE ROLLERCOASTER',
    stage4Title: 'STAGE 4: LAVA PRIMER VOID',
    stage5Title: 'STAGE 5: HIGH-G ROLLERCOASTER OVERDRIVE',
    primerColor: '#EF4444',
    stage5Color: '#F59E0B',
  },
  matrix_split: {
    key: 'matrix_split',
    name: 'SPLIT HORIZON MATRIX',
    stage3Title: 'STAGE 3: SPLIT HORIZON MATRIX',
    stage4Title: 'STAGE 4: PRISMATIC MATRIX PRIMER',
    stage5Title: 'STAGE 5: HYPER-MATRIX CROSS-OVERLOAD',
    primerColor: '#A855F7',
    stage5Color: '#3B82F6',
  },
};


export function selectSongArchetype(song?: GameSong | null): TrackArchetype {
  if (!song) return 'cyber_tunnel';

  if (song.archetype && ['corkscrew_slide', 'cyber_tunnel', 'wave_coaster', 'matrix_split'].includes(song.archetype)) {
    return song.archetype;
  }

  // 1. PRIORITY 1: Explicit Lyrics Theme Trigger (strict whole-word regex)
  if (song.lyrics && typeof song.lyrics === 'string') {
    const text = song.lyrics.toLowerCase();
    if (/\b(matrix|split|dimension|pixel|glitch|fracture|code|hologram)\b/i.test(text)) return 'matrix_split';
    if (/\b(tunnel|vortex|warp|hyperspace|cyber|portal|speedway)\b/i.test(text)) return 'cyber_tunnel';
    if (/\b(coaster|ocean|gravity|surf|tide|wave|float|drift|breeze)\b/i.test(text)) return 'wave_coaster';
    if (/\b(corkscrew|spiral|helix|whirl|twist|spinning|looping)\b/i.test(text)) return 'corkscrew_slide';
  }

  // 2. PRIORITY 2: Distinct BPM & Mood Characteristics
  const bpm = song.bpm || 120;
  const tags = (song.moodTags || []).map(t => t.toLowerCase());

  if (tags.some(t => ['glitch', 'industrial', 'chaos', 'cyberpunk'].includes(t))) return 'matrix_split';
  if (tags.some(t => ['synthwave', 'techno', 'trance', 'speed', 'futuristic'].includes(t)) || bpm >= 148) return 'cyber_tunnel';
  if (tags.some(t => ['ambient', 'acoustic', 'slow', 'ballad'].includes(t)) || bpm < 88) return 'wave_coaster';
  if (tags.some(t => ['dance', 'groove', 'funk', 'disco'].includes(t)) || (bpm >= 124 && bpm <= 136)) return 'corkscrew_slide';

  // 3. PRIORITY 3: Perfectly distributed 4-way Day rotation
  const archetypes: TrackArchetype[] = ['cyber_tunnel', 'corkscrew_slide', 'wave_coaster', 'matrix_split'];
  const dayNum = typeof song.day === 'number' && song.day > 0 ? song.day : 
                 parseInt((song.id || '').replace(/\D+/g, '') || '0', 10);
  return archetypes[(dayNum || 1) % archetypes.length];
}


/**
 * Camera views each archetype can show at stages 3 and 5. The first entry is the
 * archetype's original view; the rest are themed POVs so songs of the same style
 * don't all look alike.
 */
export const ARCHETYPE_POV_POOLS: Record<TrackArchetype, PovMode[]> = {
  cyber_tunnel: ['cyber_tunnel', 'hyper_prism', 'singularity_void'],
  corkscrew_slide: ['corkscrew', 'dna_helix', 'mobius_loop', 'orbital_halo'],
  wave_coaster: ['rollercoaster', 'horizontal_drift', 'ground_zero', 'circle'],
  matrix_split: ['matrix_split', 'cockpit_hud', 'vertigo_drop'],
  radial_orbit: ['circle', 'orbital_halo'],
  horizontal_drift: ['horizontal_drift', 'ground_zero'],
};

/** Picks the song's stage 3/5 camera from its archetype's pool. Stable per song. */
export function selectSongPov(song: GameSong | null | undefined, archetype: TrackArchetype): PovMode {
  const pool = ARCHETYPE_POV_POOLS[archetype] || ARCHETYPE_POV_POOLS.cyber_tunnel;
  const key = String(song?.id ?? song?.day ?? song?.title ?? '');
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return pool[(h >>> 0) % pool.length];
}


export function isArchetypeDevModeEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  const isDev = import.meta.env.DEV || import.meta.env.MODE === 'development';
  const optDev = localStorage.getItem('opt_archetypeDevMode') === 'true' || localStorage.getItem('opt_devMode') === 'true';
  const urlDev = new URLSearchParams(window.location.search).get('dev') === 'true' || new URLSearchParams(window.location.search).get('archetypes') === 'true';
  return isDev || optDev || urlDev;
}
