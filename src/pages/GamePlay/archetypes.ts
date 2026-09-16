import type { GameSong } from '@/game/api';

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


export function isArchetypeDevModeEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  const isDev = import.meta.env.DEV || import.meta.env.MODE === 'development';
  const optDev = localStorage.getItem('opt_archetypeDevMode') === 'true' || localStorage.getItem('opt_devMode') === 'true';
  const urlDev = new URLSearchParams(window.location.search).get('dev') === 'true' || new URLSearchParams(window.location.search).get('archetypes') === 'true';
  return isDev || optDev || urlDev;
}
