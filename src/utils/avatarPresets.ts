// ════════════════════════════════════════════════════════════════════════════════
// avatarPresets.ts — High-Fidelity Cyberpunk Pilot Avatar Presets for PIM
// Vector SVG data URLs with distinctive neon brutalist faction aesthetics
// ════════════════════════════════════════════════════════════════════════════════

export interface AvatarPreset {
  id: string;
  name: string;
  callsign: string;
  faction: string;
  accent: string;
  bg: string;
  avatarUrl: string;
}

function svgToDataUrl(svg: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export const CYBER_AVATAR_PRESETS: AvatarPreset[] = [
  {
    id: 'cyber-scribe',
    name: 'Cyber Scribe',
    callsign: 'SCRIBE_01',
    faction: 'PIM CORE',
    accent: '#FF1493',
    bg: '#14030a',
    avatarUrl: svgToDataUrl(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
        <rect width="100" height="100" fill="#14030a"/>
        <circle cx="50" cy="50" r="46" stroke="#FF1493" stroke-width="3" fill="none" stroke-dasharray="4,2"/>
        <circle cx="50" cy="50" r="38" fill="#250515"/>
        <path d="M50 20 L75 68 L25 68 Z" fill="none" stroke="#FF1493" stroke-width="3"/>
        <circle cx="50" cy="46" r="8" fill="#FF1493"/>
        <line x1="50" y1="68" x2="50" y2="82" stroke="#FF1493" stroke-width="4"/>
        <circle cx="50" cy="82" r="3" fill="#00E5FF"/>
      </svg>
    `.trim()),
  },
  {
    id: 'neon-valkyrie',
    name: 'Neon Valkyrie',
    callsign: 'VALK_99',
    faction: 'NEURAL FREQ',
    accent: '#00E5FF',
    bg: '#021018',
    avatarUrl: svgToDataUrl(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
        <rect width="100" height="100" fill="#021018"/>
        <polygon points="50,6 94,50 50,94 6,50" fill="none" stroke="#00E5FF" stroke-width="3"/>
        <polygon points="50,18 82,50 50,82 18,50" fill="#062230"/>
        <path d="M28 42 L50 62 L72 42" fill="none" stroke="#00E5FF" stroke-width="4" stroke-linecap="round"/>
        <circle cx="50" cy="34" r="7" fill="#39FF14"/>
      </svg>
    `.trim()),
  },
  {
    id: 'bass-architect',
    name: 'Bass Architect',
    callsign: 'ARCH_BASS',
    faction: 'LOW-END LABS',
    accent: '#39FF14',
    bg: '#041204',
    avatarUrl: svgToDataUrl(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
        <rect width="100" height="100" fill="#041204"/>
        <circle cx="50" cy="50" r="44" stroke="#39FF14" stroke-width="2" fill="none"/>
        <rect x="24" y="24" width="52" height="52" fill="#0a2a0a" stroke="#39FF14" stroke-width="3"/>
        <line x1="24" y1="50" x2="76" y2="50" stroke="#39FF14" stroke-width="2" stroke-dasharray="2,2"/>
        <line x1="50" y1="24" x2="50" y2="76" stroke="#39FF14" stroke-width="2" stroke-dasharray="2,2"/>
        <circle cx="50" cy="50" r="9" fill="#FFD700"/>
      </svg>
    `.trim()),
  },
  {
    id: 'void-runner',
    name: 'Void Runner',
    callsign: 'RUNNER_Ø',
    faction: 'OUTER VOID',
    accent: '#A855F7',
    bg: '#0e0416',
    avatarUrl: svgToDataUrl(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
        <rect width="100" height="100" fill="#0e0416"/>
        <circle cx="50" cy="50" r="45" stroke="#A855F7" stroke-width="3" fill="none"/>
        <circle cx="50" cy="50" r="32" fill="#200a35"/>
        <path d="M30 65 Q 50 20 70 65" fill="none" stroke="#A855F7" stroke-width="4" stroke-linecap="round"/>
        <circle cx="50" cy="38" r="6" fill="#FF1493"/>
      </svg>
    `.trim()),
  },
  {
    id: 'fever-monarch',
    name: 'Fever Monarch',
    callsign: 'FEVER_77',
    faction: 'POWER RHYTHM',
    accent: '#FFD700',
    bg: '#181202',
    avatarUrl: svgToDataUrl(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
        <rect width="100" height="100" fill="#181202"/>
        <polygon points="50,8 64,36 96,36 70,56 80,88 50,68 20,88 30,56 4,36 36,36" fill="#2e2204" stroke="#FFD700" stroke-width="2.5"/>
        <circle cx="50" cy="52" r="10" fill="#FFD700"/>
        <circle cx="50" cy="52" r="5" fill="#181202"/>
      </svg>
    `.trim()),
  },
  {
    id: 'signal-ghost',
    name: 'Signal Ghost',
    callsign: 'GHOST_SYS',
    faction: 'LOST TELEMETRY',
    accent: '#E0E0FF',
    bg: '#080812',
    avatarUrl: svgToDataUrl(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
        <rect width="100" height="100" fill="#080812"/>
        <circle cx="50" cy="50" r="44" stroke="#E0E0FF" stroke-width="2" stroke-dasharray="6,4" fill="none"/>
        <path d="M30 72 C 30 35, 70 35, 70 72 Z" fill="#18182e" stroke="#E0E0FF" stroke-width="3"/>
        <circle cx="42" cy="50" r="4" fill="#00E5FF"/>
        <circle cx="58" cy="50" r="4" fill="#FF1493"/>
        <path d="M32 72 Q 40 64 50 72 T 68 72" fill="none" stroke="#E0E0FF" stroke-width="2"/>
      </svg>
    `.trim()),
  },
  {
    id: 'glitch-master',
    name: 'Glitch Master',
    callsign: 'GLITCH_X',
    faction: 'ROGUE SYNAPSE',
    accent: '#FF3800',
    bg: '#140502',
    avatarUrl: svgToDataUrl(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
        <rect width="100" height="100" fill="#140502"/>
        <rect x="15" y="15" width="70" height="70" fill="none" stroke="#FF3800" stroke-width="3"/>
        <rect x="22" y="28" width="56" height="10" fill="#FF3800"/>
        <rect x="18" y="44" width="64" height="12" fill="#00E5FF"/>
        <rect x="26" y="62" width="48" height="10" fill="#39FF14"/>
        <line x1="8" y1="50" x2="92" y2="50" stroke="#FF3800" stroke-width="2" stroke-dasharray="5,5"/>
      </svg>
    `.trim()),
  },
  {
    id: 'warp-pilot',
    name: 'Warp Pilot',
    callsign: 'WARP_8453',
    faction: 'BASE MAINNET',
    accent: '#0052FF',
    bg: '#010818',
    avatarUrl: svgToDataUrl(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
        <rect width="100" height="100" fill="#010818"/>
        <circle cx="50" cy="50" r="44" stroke="#0052FF" stroke-width="3" fill="none"/>
        <circle cx="50" cy="50" r="32" fill="#0052FF"/>
        <circle cx="50" cy="50" r="14" fill="#ffffff"/>
      </svg>
    `.trim()),
  },
];
