/**
 * WaifuFigure.tsx — layered SVG paper doll for the Daily Waifu Dress-Up.
 *
 * Every garment is drawn as a shape filled with a base paint and a texture
 * overlay generated from its material (the 16 OUTFIT_STYLES in artTypes.ts),
 * so "Liquid Chrome" and "Acid Denim" read differently in the same colour.
 */

import { useId, type ReactNode } from 'react';
import type { OutfitStyle } from '../../utils/artTypes';
import { SCENES, type Outfit, type GarmentChoice } from '../../game/dressUp';

const SKIN = '#ffe3d3';
const SKIN_SHADE = '#f4c4ae';
const LINE = '#2a1a2e';
const MIRROR = 'translate(300,0) scale(-1,1)';

/** SVG-safe unique id so several figures can share a page without def clashes. */
function useSvgId(prefix: string): string {
  return prefix + useId().replace(/[^a-zA-Z0-9_-]/g, '');
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mix(a: string, b: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  const m = (x: number, y: number) => Math.round(x + (y - x) * t).toString(16).padStart(2, '0');
  return `#${m(r1, r2)}${m(g1, g2)}${m(b1, b2)}`;
}

interface Paint {
  defs: ReactNode;
  base: string;
  baseOpacity: number;
  texture?: string;
  stroke: string;
}

/** Builds gradient + pattern defs for one garment's material and colour. */
function materialPaint(id: string, material: OutfitStyle, color: string): Paint {
  const light = mix(color, '#ffffff', 0.6);
  const dark = mix(color, '#000000', 0.55);
  const stroke = mix(color, '#000000', 0.6);
  const lin = (stops: [number, string, number?][], x2 = 1, y2 = 1) => (
    <linearGradient id={`${id}-base`} x1="0" y1="0" x2={x2} y2={y2}>
      {stops.map(([o, c, op], i) => (
        <stop key={i} offset={o} stopColor={c} stopOpacity={op ?? 1} />
      ))}
    </linearGradient>
  );
  const pat = (w: number, h: number, body: ReactNode, rotate = 0) => (
    <pattern id={`${id}-tex`} width={w} height={h} patternUnits="userSpaceOnUse" patternTransform={`rotate(${rotate})`}>
      {body}
    </pattern>
  );

  switch (material) {
    case 'shiny':
      return {
        defs: lin([[0, dark], [0.3, color], [0.42, '#ffffff'], [0.5, color], [1, dark]], 1, 0.4),
        base: `url(#${id}-base)`, baseOpacity: 1, stroke,
      };
    case 'pastel': {
      const soft = mix(color, '#ffffff', 0.55);
      return {
        defs: <>
          {lin([[0, soft], [1, mix(soft, '#ffffff', 0.3)]])}
          {pat(8, 8, <circle cx="4" cy="4" r="1" fill="#ffffff" opacity="0.6" />)}
        </>,
        base: `url(#${id}-base)`, baseOpacity: 1, texture: `url(#${id}-tex)`, stroke: mix(soft, '#000000', 0.35),
      };
    }
    case 'clear':
      return {
        defs: <>
          {lin([[0, color, 0.25], [1, color, 0.45]])}
          {pat(14, 14, <line x1="0" y1="0" x2="0" y2="14" stroke="#ffffff" strokeWidth="2" opacity="0.5" />, 35)}
        </>,
        base: `url(#${id}-base)`, baseOpacity: 1, texture: `url(#${id}-tex)`, stroke: '#ffffff',
      };
    case 'leather':
      return {
        defs: <>
          {lin([[0, mix(color, '#000', 0.35)], [1, mix(color, '#000', 0.7)]])}
          {pat(12, 12, <circle cx="6" cy="6" r="1.6" fill="#e5e7eb" stroke="#64748b" strokeWidth="0.5" />)}
        </>,
        base: `url(#${id}-base)`, baseOpacity: 1, texture: `url(#${id}-tex)`, stroke: '#000000',
      };
    case 'silk':
      return {
        defs: <>
          {lin([[0, color], [0.35, light], [0.6, color], [0.85, light], [1, color]], 1, 0.2)}
          {pat(30, 20, <path d="M0 10 Q7.5 2 15 10 T30 10" fill="none" stroke="#ffffff" strokeWidth="0.8" opacity="0.35" />)}
        </>,
        base: `url(#${id}-base)`, baseOpacity: 1, texture: `url(#${id}-tex)`, stroke,
      };
    case 'lacey':
      return {
        defs: <>
          {lin([[0, color, 0.55], [1, color, 0.75]])}
          {pat(10, 10, <>
            <circle cx="5" cy="5" r="3.2" fill="none" stroke={light} strokeWidth="0.9" />
            <circle cx="0" cy="0" r="1.2" fill={light} />
            <circle cx="10" cy="10" r="1.2" fill={light} />
          </>)}
        </>,
        base: `url(#${id}-base)`, baseOpacity: 1, texture: `url(#${id}-tex)`, stroke,
      };
    case 'latex':
      return {
        defs: lin([[0, '#000000'], [0.25, dark], [0.38, color], [0.44, '#ffffff'], [0.5, color], [0.75, dark], [1, '#000000']], 1, 0.15),
        base: `url(#${id}-base)`, baseOpacity: 1, stroke: '#000000',
      };
    case 'velvet':
      return {
        defs: (
          <radialGradient id={`${id}-base`} cx="0.5" cy="0.4" r="0.7">
            <stop offset="0" stopColor={mix(color, '#ffffff', 0.15)} />
            <stop offset="0.6" stopColor={mix(color, '#000000', 0.3)} />
            <stop offset="1" stopColor={mix(color, '#000000', 0.7)} />
          </radialGradient>
        ),
        base: `url(#${id}-base)`, baseOpacity: 1, stroke: '#000000',
      };
    case 'metallic':
      return {
        defs: <>
          {lin([[0, dark], [0.2, light], [0.4, color], [0.6, light], [0.8, dark], [1, color]], 0.3, 1)}
          {pat(6, 6, <circle cx="3" cy="3" r="2.2" fill="none" stroke={dark} strokeWidth="0.6" opacity="0.6" />)}
        </>,
        base: `url(#${id}-base)`, baseOpacity: 1, texture: `url(#${id}-tex)`, stroke: dark,
      };
    case 'holographic':
      return {
        defs: <>
          {lin([[0, '#ff7eb6'], [0.2, '#fde68a'], [0.4, '#a7f3d0'], [0.6, '#7dd3fc'], [0.8, '#c084fc'], [1, '#ff7eb6']])}
          {pat(40, 40, <rect width="40" height="40" fill={color} opacity="0.4" />)}
        </>,
        base: `url(#${id}-base)`, baseOpacity: 1, texture: `url(#${id}-tex)`, stroke: mix(color, '#000', 0.4),
      };
    case 'cyber_mesh':
      return {
        defs: <>
          {lin([[0, '#05050b'], [1, mix(color, '#000', 0.75)]])}
          {pat(9, 9, <path d="M0 0 L9 0 M0 0 L0 9" stroke={color} strokeWidth="1.2" opacity="0.95" />, 45)}
        </>,
        base: `url(#${id}-base)`, baseOpacity: 1, texture: `url(#${id}-tex)`, stroke: color,
      };
    case 'denim': {
      const indigo = mix(color, '#3b5b8c', 0.55);
      return {
        defs: <>
          {lin([[0, mix(indigo, '#fff', 0.2)], [0.5, indigo], [1, mix(indigo, '#000', 0.3)]])}
          {pat(4, 4, <line x1="0" y1="0" x2="0" y2="4" stroke="#ffffff" strokeWidth="0.7" opacity="0.3" />, 45)}
        </>,
        base: `url(#${id}-base)`, baseOpacity: 1, texture: `url(#${id}-tex)`, stroke: mix(indigo, '#000', 0.6),
      };
    }
    case 'feathers':
      return {
        defs: <>
          {lin([[0, light], [1, dark]], 0, 1)}
          {pat(12, 10, <path d="M0 10 Q6 -2 12 10" fill={color} stroke={dark} strokeWidth="0.6" opacity="0.85" />)}
        </>,
        base: `url(#${id}-base)`, baseOpacity: 1, texture: `url(#${id}-tex)`, stroke: dark,
      };
    case 'organza':
      return {
        defs: <>
          {lin([[0, light, 0.35], [1, color, 0.5]], 0, 1)}
          {pat(20, 8, <rect y="0" width="20" height="3" fill="#ffffff" opacity="0.25" />)}
        </>,
        base: `url(#${id}-base)`, baseOpacity: 1, texture: `url(#${id}-tex)`, stroke: light,
      };
    case 'chrome':
      return {
        defs: lin([[0, '#ffffff'], [0.25, mix(color, '#cbd5e1', 0.6)], [0.45, '#334155'], [0.55, '#f8fafc'], [0.8, mix(color, '#94a3b8', 0.5)], [1, '#1e293b']], 0.2, 1),
        base: `url(#${id}-base)`, baseOpacity: 1, stroke: '#0f172a',
      };
    case 'knit':
    default:
      return {
        defs: <>
          {lin([[0, color], [1, mix(color, '#000', 0.2)]], 0, 1)}
          {pat(5, 10, <path d="M2.5 0 L2.5 10" stroke={dark} strokeWidth="1.4" opacity="0.45" />)}
        </>,
        base: `url(#${id}-base)`, baseOpacity: 1, texture: `url(#${id}-tex)`, stroke,
      };
  }
}

/** Draws a list of paths in a garment's paint. `mirror` paths are drawn on both sides. */
/**
 * Draws a list of paths in a garment's paint with a soft volume shade on top.
 * `mirror` paths are drawn on both sides of the body.
 */
function Garment({ id, choice, paths = [], mirror = [], details }: {
  id: string;
  choice: GarmentChoice;
  paths?: string[];
  mirror?: string[];
  details?: ReactNode;
}) {
  const uid = useSvgId(id);
  const paint = materialPaint(uid, choice.material, choice.color);
  const layer = (d: string, key: string, transform?: string) => (
    <g key={key} transform={transform}>
      <path d={d} fill={paint.base} fillOpacity={paint.baseOpacity} />
      {paint.texture && <path d={d} fill={paint.texture} />}
      <path d={d} fill={`url(#${uid}-shade)`} />
      <path d={d} fill="none" stroke={paint.stroke} strokeWidth="1.4" strokeLinejoin="round" />
    </g>
  );
  return (
    <g>
      <defs>
        {paint.defs}
        <linearGradient id={`${uid}-shade`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#000" stopOpacity="0.28" />
          <stop offset="0.22" stopColor="#000" stopOpacity="0" />
          <stop offset="0.7" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.32" />
        </linearGradient>
      </defs>
      {paths.map((d, i) => layer(d, `p${i}`))}
      {mirror.map((d, i) => (
        <g key={`m${i}`}>
          {layer(d, `ml${i}`)}
          {layer(d, `mr${i}`, MIRROR)}
        </g>
      ))}
      {details}
    </g>
  );
}

// ---------------------------------------------------------------------------
// Body geometry (viewBox 0 0 300 600). Left-side limbs are mirrored.
// ---------------------------------------------------------------------------
const HEAD = 'M150 52 C183 52 202 78 202 110 C202 133 193 147 179 159 C167 169 158 174 150 174 C142 174 133 169 121 159 C107 147 98 133 98 110 C98 78 117 52 150 52 Z';
const NECK = 'M139 158 L139 196 Q150 203 161 196 L161 158 Z';
const TORSO = 'M114 198 C128 190 172 190 186 198 C192 214 190 236 184 252 C178 270 178 288 182 302 C192 316 196 330 194 344 L106 344 C104 330 108 316 118 302 C122 288 122 270 116 252 C110 236 108 214 114 198 Z';
const ARM = 'M117 200 C103 202 97 214 96 232 L92 282 C90 304 90 326 93 344 L106 344 C106 326 106 306 106 288 L112 240 Z';
const HAND = 'M92 342 C88 352 90 364 98 366 C105 366 108 356 106 342 Z';
const LEG = 'M108 340 L150 340 L148 420 C146 450 146 470 144 500 C143 525 142 545 142 560 L128 560 C126 540 124 520 122 500 C118 470 116 448 114 420 C108 392 106 366 108 340 Z';
const FOOT = 'M127 556 L143 556 C146 568 145 576 139 579 L125 579 C121 574 122 564 127 556 Z';

/** Keyframes for the idle loop and outfit-change pop; disabled for reduced motion. */
const ANIM_CSS = `
.wf-breathe { animation: wf-breathe 3.8s ease-in-out infinite; }
.wf-blink { transform-box: fill-box; transform-origin: center; animation: wf-blink 5.2s infinite; }
.wf-sway { animation: wf-sway 4.4s ease-in-out infinite; }
.wf-sway-r { animation: wf-sway 4.4s ease-in-out infinite reverse; }
.wf-pop { transform-box: fill-box; transform-origin: center; animation: wf-pop 0.45s cubic-bezier(.2,1.6,.4,1) both; }
.wf-twinkle { animation: wf-twinkle 2.6s ease-in-out infinite; }
.wf-flicker { animation: wf-flicker 3.4s steps(1) infinite; }
.wf-float { animation: wf-float 6s ease-in-out infinite; }
.wf-sparkle { transform-box: fill-box; transform-origin: center; animation: wf-sparkle 1.6s ease-out infinite; }
@keyframes wf-breathe { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-2.2px); } }
@keyframes wf-blink { 0%,93%,100% { transform: scaleY(1); } 95.5% { transform: scaleY(0.08); } }
@keyframes wf-sway { 0%,100% { transform: rotate(-2.5deg); } 50% { transform: rotate(2.5deg); } }
@keyframes wf-pop { 0% { opacity: 0; transform: scale(0.9); } 100% { opacity: 1; transform: scale(1); } }
@keyframes wf-twinkle { 0%,100% { opacity: 0.25; } 50% { opacity: 1; } }
@keyframes wf-flicker { 0%,100% { opacity: 0.9; } 40% { opacity: 0.25; } 45% { opacity: 0.9; } 70% { opacity: 0.5; } }
@keyframes wf-float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
@keyframes wf-sparkle { 0% { opacity: 0; transform: scale(0.2) rotate(0deg); } 30% { opacity: 1; } 100% { opacity: 0; transform: scale(1.3) rotate(90deg); } }
@media (prefers-reduced-motion: reduce) { .wf-root * { animation: none !important; } }
`;

function Scene({ category }: { category: string }) {
  const scene = SCENES.find((s) => s.category === category) ?? SCENES[6];
  const [a, b, c] = scene.colors;
  const bgId = useSvgId('scene');
  return (
    <g>
      <defs>
        <linearGradient id={bgId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={a} />
          <stop offset="1" stopColor={b} />
        </linearGradient>
      </defs>
      <rect width="300" height="600" fill={`url(#${bgId})`} />
      {category === 'Cyberpunk & Sci-Fi' && [20, 70, 200, 250].map((x, i) => (
        <g key={i}>
          <rect x={x} y={180 + i * 25} width="34" height={420} fill="#0b0b1a" stroke={c} strokeOpacity="0.5" />
          {[0, 1, 2, 3, 4, 5].map((r) => (
            <rect key={r} x={x + 6} y={200 + i * 25 + r * 40} width="8" height="5" fill={r % 2 ? c : '#ff007f'}
              className="wf-flicker" style={{ animationDelay: `${(i * 6 + r) * 0.37}s` }} />
          ))}
        </g>
      ))}
      {category === 'Dark Fantasy & Gothic' && (
        <g fill="none" stroke={c} strokeOpacity="0.6" strokeWidth="3">
          <path d="M40 600 L40 160 Q150 20 260 160 L260 600" />
          <circle cx="150" cy="150" r="46" />
          <path d="M150 104 L150 196 M104 150 L196 150 M118 118 L182 182 M182 118 L118 182" strokeWidth="1.5" />
          {[60, 240].map((x) => <circle key={x} cx={x} cy="420" r="5" fill="#fbbf24" stroke="none" className="wf-flicker" />)}
        </g>
      )}
      {category === 'Neon Retro & Synthwave' && (
        <g>
          <circle cx="150" cy="300" r="90" fill={c} opacity="0.85" />
          {[0, 1, 2, 3, 4].map((i) => <rect key={i} x="50" y={300 + i * 14} width="200" height={5 + i} fill={a} />)}
          {[...Array(9)].map((_, i) => <line key={i} x1={150} y1={380} x2={-150 + i * 75} y2={600} stroke="#ff007f" strokeOpacity="0.7" />)}
          {[0, 1, 2, 3, 4].map((i) => <line key={`h${i}`} x1="0" x2="300" y1={400 + i * i * 9} y2={400 + i * i * 9} stroke="#ff007f" strokeOpacity="0.7" />)}
        </g>
      )}
      {category === 'High-Fashion & Vogue' && (
        <g>
          <ellipse cx="150" cy="585" rx="130" ry="18" fill={c} opacity="0.15" />
          <path d="M150 0 L60 600 L240 600 Z" fill={c} opacity="0.07" className="wf-twinkle" style={{ animationDuration: '5s' }} />
        </g>
      )}
      {category === 'Impressionist & Fine Art' && [...Array(28)].map((_, i) => (
        <circle key={i} cx={(i * 53) % 300} cy={360 + ((i * 37) % 240)} r={10 + (i % 4) * 5} fill={i % 3 ? c : '#e76f51'} opacity="0.55" />
      ))}
      {category === 'Anime & Celestial' && [...Array(30)].map((_, i) => (
        <circle key={i} cx={(i * 71) % 300} cy={(i * 43) % 600} r={i % 5 === 0 ? 2.4 : 1.2} fill={c}
          className="wf-twinkle" style={{ animationDelay: `${(i % 7) * 0.4}s` }} />
      ))}
      {category === 'Minimalist & Surrealism' && (
        <g>
          <circle cx="232" cy="92" r="34" fill={c} opacity="0.85" className="wf-float" />
          <line x1="0" y1="470" x2="300" y2="470" stroke={c} strokeOpacity="0.3" />
        </g>
      )}
      {category === 'Streetwear & Graffiti' && (
        <g>
          {[...Array(12)].map((_, i) => <rect key={i} x={(i % 4) * 75} y={Math.floor(i / 4) * 40 + 380} width="74" height="39" fill={b} stroke={a} />)}
          <path d="M20 200 Q60 140 100 210 T190 190 T280 220" fill="none" stroke={c} strokeWidth="10" strokeLinecap="round" opacity="0.8" />
          <path d="M30 260 Q90 230 150 270 T280 250" fill="none" stroke="#ff007f" strokeWidth="7" strokeLinecap="round" opacity="0.7" />
        </g>
      )}
      {category === 'Organic & Nature Noir' && (
        <g>
          {[...Array(8)].map((_, i) => (
            <path key={i} d={`M${i * 40 + 5} 600 L${i * 40 + 25} ${220 + (i % 3) * 40} L${i * 40 + 45} 600 Z`} fill={b} stroke={c} strokeOpacity="0.4" />
          ))}
          {[...Array(10)].map((_, i) => (
            <circle key={`f${i}`} cx={(i * 67 + 20) % 300} cy={160 + ((i * 89) % 300)} r="2" fill="#d9f99d"
              className="wf-twinkle" style={{ animationDelay: `${i * 0.31}s` }} />
          ))}
        </g>
      )}
      {category === 'Industrial & Mechanical' && (
        <g stroke={c} strokeOpacity="0.5" fill="none" strokeWidth="2">
          <circle cx="60" cy="120" r="40" strokeDasharray="10 6" />
          <circle cx="250" cy="200" r="30" strokeDasharray="8 5" />
          <path d="M0 500 L300 500 M0 520 L300 520" />
          {[0, 1, 2, 3, 4, 5].map((i) => <path key={i} d={`M${i * 60} 500 L${i * 60 + 30} 520`} />)}
        </g>
      )}
      {/* Floor shadow grounds the character in every scene. */}
      <ellipse cx="150" cy="582" rx="56" ry="9" fill="#000" opacity="0.35" />
    </g>
  );
}

// ---------------------------------------------------------------------------
// Hair: a back mass behind the body, style pieces anchored to the head, and a
// front cap with bangs that covers the crown so the scalp never shows.
// ---------------------------------------------------------------------------
interface HairPaint { fill: string; stroke: string; strokeWidth: number }

function useHairPaint(color: string): { defs: ReactNode; p: HairPaint; dark: string } {
  const id = useSvgId('hair');
  const dark = mix(color, '#000000', 0.45);
  return {
    defs: (
      <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={mix(color, '#ffffff', 0.18)} />
        <stop offset="0.55" stopColor={color} />
        <stop offset="1" stopColor={mix(color, '#000000', 0.3)} />
      </linearGradient>
    ),
    p: { fill: `url(#${id})`, stroke: dark, strokeWidth: 1.4 },
    dark,
  };
}

const HAIR_MASS = 'M92 120 C86 46 214 46 208 120 C210 150 204 172 196 186 Q150 198 104 186 C96 172 90 150 92 120 Z';
const TWIN_TAIL = 'M106 88 C70 98 54 156 60 226 C64 276 74 312 86 340 C88 302 92 262 96 222 C100 172 106 130 114 100 Z';
const PONYTAIL = 'M166 62 C214 52 240 98 232 168 C228 218 236 262 248 300 C214 282 204 232 202 182 C200 132 194 96 172 80 Z';
const LONG_BACK = 'M92 118 C86 176 84 262 92 344 C118 356 182 356 208 344 C216 262 214 176 208 118 Z';

function HairBack({ item, color }: { item: string; color: string }) {
  const { defs, p, dark } = useHairPaint(color);
  const strands = (d: string) => <path d={d} fill="none" stroke={dark} strokeOpacity="0.45" strokeWidth="1" />;
  return (
    <g>
      <defs>{defs}</defs>
      {item === 'long' && <>
        <path d={LONG_BACK} {...p} />
        {strands('M118 190 C114 250 116 300 120 340 M150 190 L150 350 M182 190 C186 250 184 300 180 340')}
      </>}
      {item === 'twintails' && [false, true].map((right) => (
        <g key={String(right)} transform={right ? MIRROR : undefined}>
          <g className="wf-sway" style={{ transformOrigin: '108px 92px', animationDelay: right ? '-2.2s' : '0s' }}>
            <path d={TWIN_TAIL} {...p} />
            {strands('M98 120 C80 170 76 240 84 320 M104 112 C92 170 92 230 94 280')}
          </g>
        </g>
      ))}
      {item === 'ponytail' && (
        <g className="wf-sway" style={{ transformOrigin: '170px 66px' }}>
          <path d={PONYTAIL} {...p} />
          {strands('M190 90 C220 130 214 200 228 280 M180 86 C206 140 204 210 214 260')}
        </g>
      )}
      <path d={HAIR_MASS} {...p} />
    </g>
  );
}

function HairFront({ item, color }: { item: string; color: string }) {
  const { defs, p, dark } = useHairPaint(color);
  // Crown cap peaks above the head (y≈47) and ends in a fringe of bangs.
  const cap = 'M97 128 C88 22 212 22 203 128 C200 112 196 102 190 94 C188 102 184 108 178 112 C175 102 170 94 163 90 C160 100 156 106 150 110 C145 100 140 94 133 90 C130 100 126 106 122 112 C118 102 114 96 110 94 C105 104 100 116 97 128 Z';
  const sideLength = item === 'long' ? 250 : item === 'bob' ? 186 : 200;
  const side = `M97 118 C92 150 94 ${sideLength - 30} 103 ${sideLength} C106 ${sideLength - 26} 108 ${sideLength - 60} 111 132 Z`;
  return (
    <g>
      <defs>{defs}</defs>
      {item === 'buns' && [false, true].map((right) => (
        <g key={String(right)} transform={right ? MIRROR : undefined}>
          <circle cx="110" cy="58" r="22" {...p} />
          <path d="M96 52 C102 44 116 42 124 50" fill="none" stroke="#fff" strokeOpacity="0.35" strokeWidth="3" strokeLinecap="round" />
          <path d="M98 70 C106 78 118 78 126 72" fill="none" stroke={dark} strokeOpacity="0.5" />
        </g>
      ))}
      {item === 'bob' && [false, true].map((right) => (
        <path key={String(right)} d="M95 112 C88 150 92 176 106 190 C112 184 112 170 110 160 C106 140 106 126 110 116 Z" {...p} transform={right ? MIRROR : undefined} />
      ))}
      {item !== 'bob' && <>
        <path d={side} {...p} />
        <path d={side} {...p} transform={MIRROR} />
      </>}
      <path d={cap} {...p} />
      {/* Angel-ring highlight and fringe strands. */}
      <path d="M114 78 Q150 62 186 78" fill="none" stroke="#ffffff" strokeOpacity="0.4" strokeWidth="5" strokeLinecap="round" />
      <path d="M134 64 Q128 80 133 90 M150 58 Q150 88 150 108 M166 64 Q172 80 163 90" fill="none" stroke={dark} strokeOpacity="0.45" />
      {item === 'twintails' && [false, true].map((right) => (
        <g key={String(right)} transform={right ? MIRROR : undefined}>
          <circle cx="107" cy="90" r="7" fill="#ff007f" stroke={LINE} />
          <circle cx="105" cy="88" r="2" fill="#fff" opacity="0.7" />
        </g>
      ))}
      {item === 'ponytail' && <path d="M164 62 L178 74" stroke="#ff007f" strokeWidth="6" strokeLinecap="round" />}
    </g>
  );
}

function Face({ eyeColor }: { eyeColor: string }) {
  const irisId = useSvgId('iris');
  return (
    <g>
      <defs>
        <linearGradient id={irisId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1e1b4b" />
          <stop offset="0.55" stopColor={eyeColor} />
          <stop offset="1" stopColor={mix(eyeColor, '#ffffff', 0.55)} />
        </linearGradient>
      </defs>
      <g className="wf-blink">
        {[0, 1].map((side) => (
          <g key={side} transform={side ? MIRROR : undefined}>
            <path d="M117 119 C121 106 139 104 145 116 C145 128 138 134 130 134 C122 134 117 128 117 119 Z" fill="#ffffff" />
            <ellipse cx="132" cy="121" rx="8.5" ry="11.5" fill={`url(#${irisId})`} />
            <ellipse cx="132" cy="122" rx="4" ry="6" fill="#0f0a1e" />
            <circle cx="128.5" cy="116" r="3" fill="#ffffff" />
            <circle cx="135" cy="127" r="1.4" fill="#ffffff" opacity="0.8" />
            {/* Lash line with an outer flick. */}
            <path d="M115 117 C121 104 139 101 147 113 L149 110 C141 98 119 98 112 114 Z" fill={LINE} />
            <path d="M113 115 L107 111" stroke={LINE} strokeWidth="2" strokeLinecap="round" />
          </g>
        ))}
      </g>
      {[0, 1].map((side) => (
        <g key={side} transform={side ? MIRROR : undefined}>
          <path d="M121 97 Q131 92 142 96" fill="none" stroke={mix(LINE, '#ffffff', 0.2)} strokeWidth="2" strokeLinecap="round" />
          <ellipse cx="124" cy="141" rx="8" ry="3.5" fill="#ff7eb6" opacity="0.35" />
        </g>
      ))}
      <path d="M150 136 L148.5 141" stroke={SKIN_SHADE} strokeWidth="1.6" strokeLinecap="round" />
      <path d="M144 152 Q150 157 156 152" fill="none" stroke="#b4485a" strokeWidth="1.8" strokeLinecap="round" />
    </g>
  );
}

function Body({ skinId }: { skinId: string }) {
  const skin = `url(#${skinId})`;
  return (
    <g stroke={mix(SKIN_SHADE, '#000000', 0.35)} strokeWidth="1.3" strokeLinejoin="round">
      <path d={LEG} fill={skin} />
      <path d={LEG} fill={skin} transform={MIRROR} />
      <path d="M124 448 Q130 452 136 448 M176 448 Q170 452 164 448" fill="none" strokeOpacity="0.5" />
      <path d={FOOT} fill={skin} />
      <path d={FOOT} fill={skin} transform={MIRROR} />
      {/* Neutral base bodysuit so the figure is always dressed. */}
      <path d="M108 336 L192 336 L190 360 Q150 370 110 360 Z" fill="#2b2140" />
    </g>
  );
}

function UpperBody({ skinId }: { skinId: string }) {
  const skin = `url(#${skinId})`;
  return (
    <g stroke={mix(SKIN_SHADE, '#000000', 0.35)} strokeWidth="1.3" strokeLinejoin="round">
      <path d={ARM} fill={skin} />
      <path d={ARM} fill={skin} transform={MIRROR} />
      <path d={HAND} fill={skin} />
      <path d={HAND} fill={skin} transform={MIRROR} />
      <path d={NECK} fill={skin} />
      <path d="M139 168 Q150 180 161 168 L161 178 Q150 186 139 178 Z" fill={SKIN_SHADE} stroke="none" opacity="0.8" />
      <path d={TORSO} fill="#2b2140" />
      <path d="M128 202 Q150 210 172 202" fill="none" stroke="#ffffff" strokeOpacity="0.15" />
    </g>
  );
}

function Fishnet({ choice }: { choice: GarmentChoice }) {
  const netId = useSvgId('fishnet');
  return (
    <g>
      <defs>
        <pattern id={netId} width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <path d="M0 0 L8 0 M0 0 L0 8" stroke={choice.color} strokeWidth="1.3" />
        </pattern>
      </defs>
      <Garment id="legwear" choice={choice} mirror={['M112 380 L149 380 L149 392 L113 392 Z']} />
      <path d={LEG} fill={`url(#${netId})`} />
      <path d={LEG} fill={`url(#${netId})`} transform={MIRROR} />
    </g>
  );
}

function Legwear({ choice }: { choice: GarmentChoice }) {
  const id = 'legwear';
  switch (choice.item) {
    case 'thighhighs':
      return <Garment id={id} choice={choice} mirror={['M113 404 L149 404 L148 420 C146 450 146 470 144 500 C143 525 142 545 142 560 L128 560 C126 540 124 520 122 500 C118 470 116 448 114 420 Z']}
        details={<g stroke="#000" strokeOpacity="0.35" strokeWidth="4"><path d="M113 408 L149 408" /><path d="M187 408 L151 408" /></g>} />;
    case 'stockings':
      return <Garment id={id} choice={choice} mirror={[LEG]} />;
    case 'fishnet':
      return <Fishnet choice={choice} />;
    case 'warmers':
      return <Garment id={id} choice={choice} mirror={['M119 468 L149 468 C149 500 148 530 148 552 L120 552 C116 524 116 496 119 468 Z']}
        details={<g stroke="#000" strokeOpacity="0.25">{[480, 492, 504, 516, 528, 540].map((y) => <g key={y}><path d={`M120 ${y} L148 ${y}`} /><path d={`M180 ${y} L152 ${y}`} /></g>)}</g>} />;
    default:
      return null;
  }
}

function Shoes({ choice }: { choice: GarmentChoice }) {
  const id = 'shoes';
  switch (choice.item) {
    case 'platforms':
      return <Garment id={id} choice={choice} mirror={['M124 548 L146 548 C148 556 149 566 148 572 L148 590 L120 590 L120 572 C120 564 122 556 124 548 Z']}
        details={<g fill="#000" opacity="0.35"><rect x="120" y="582" width="28" height="8" /><rect x="152" y="582" width="28" height="8" /></g>} />;
    case 'boots':
      return <Garment id={id} choice={choice} mirror={['M120 486 L148 486 L147 560 C152 572 151 582 148 588 L117 588 C113 574 116 562 122 554 Z']}
        details={<g stroke="#000" strokeOpacity="0.45">{[500, 514, 528, 542].map((y) => <g key={y}><path d={`M126 ${y} L142 ${y + 6}`} /><path d={`M174 ${y} L158 ${y + 6}`} /></g>)}</g>} />;
    case 'sneakers':
      return <Garment id={id} choice={choice} mirror={['M122 550 L146 550 C151 562 151 574 148 582 L116 582 C114 566 116 558 122 550 Z']}
        details={<g fill="#ffffff"><rect x="114" y="578" width="36" height="6" rx="2" /><rect x="150" y="578" width="36" height="6" rx="2" /></g>} />;
    case 'maryjanes':
      return <Garment id={id} choice={choice} mirror={['M123 560 L146 560 C149 570 147 578 143 582 L120 582 C117 572 118 566 123 560 Z', 'M124 556 L146 552 L146 556 L124 560 Z']} />;
    default:
      return null;
  }
}

function Bottom({ choice }: { choice: GarmentChoice }) {
  const id = 'bottom';
  switch (choice.item) {
    case 'pleated':
      return <Garment id={id} choice={choice} paths={['M116 294 L184 294 L206 382 Q150 390 94 382 Z']}
        details={<g stroke="#000" strokeOpacity="0.28">{[106, 122, 138, 150, 162, 178, 194].map((x) => <path key={x} d={`M${150 + (x - 150) * 0.4} 298 L${x} 384`} />)}</g>} />;
    case 'shorts':
      return <Garment id={id} choice={choice} paths={['M110 298 L190 298 L194 358 L154 360 L150 346 L146 360 L106 358 Z']}
        details={<path d="M150 302 L150 344" stroke="#000" strokeOpacity="0.3" />} />;
    case 'mini':
      return <Garment id={id} choice={choice} paths={['M114 294 L186 294 L194 368 Q150 374 106 368 Z']}
        details={<path d="M150 332 L150 370" stroke="#000" strokeOpacity="0.4" />} />;
    case 'gown':
      return <Garment id={id} choice={choice} paths={['M116 290 L184 290 Q198 360 224 562 Q150 586 76 562 Q102 360 116 290 Z']}
        details={<g fill="none" stroke="#000" strokeOpacity="0.18" strokeWidth="2"><path d="M132 320 Q120 450 108 566" /><path d="M168 320 Q180 450 192 566" /><path d="M150 300 Q146 430 160 576" stroke="#fff" strokeOpacity="0.22" strokeWidth="3" /></g>} />;
    case 'pants':
      return <Garment id={id} choice={choice} paths={['M108 296 L192 296 L194 342 L150 346 L106 342 Z']}
        mirror={['M106 338 L150 338 L148 450 Q150 510 156 558 L118 558 Q120 500 116 450 Q104 395 106 338 Z']} />;
    default:
      return null;
  }
}

function Top({ choice }: { choice: GarmentChoice }) {
  const id = 'top';
  switch (choice.item) {
    case 'crop':
      return <Garment id={id} choice={choice} paths={['M114 198 C128 190 172 190 186 198 C190 214 189 234 186 252 Q150 262 114 252 C111 234 110 214 114 198 Z']}
        mirror={['M117 200 C103 202 97 214 96 232 L95 246 L111 248 L113 226 Z']} />;
    case 'bikini':
      return <Garment id={id} choice={choice} mirror={['M120 218 Q134 210 148 222 L146 248 Q132 254 118 248 Z', 'M128 214 L138 192 L140 194 L131 216 Z']}
        details={<path d="M146 232 L154 232" stroke={choice.color} strokeWidth="3" />} />;
    case 'corset':
      return <Garment id={id} choice={choice} paths={['M116 218 Q150 230 184 218 L182 252 Q176 278 180 304 Q150 314 120 304 Q124 278 118 252 Z']}
        details={<g stroke="#ffffff" strokeOpacity="0.7" strokeWidth="1.2">{[236, 252, 268, 284, 296].map((y) => <path key={y} d={`M144 ${y} L156 ${y + 8} M156 ${y} L144 ${y + 8}`} />)}</g>} />;
    case 'sailor':
      return <Garment id={id} choice={choice}
        paths={['M114 198 C128 190 172 190 186 198 C192 214 190 236 184 252 C179 270 179 288 182 302 L118 302 C121 288 121 270 116 252 C110 236 108 214 114 198 Z']}
        mirror={['M117 200 C103 202 97 214 96 232 L93 268 L108 272 L112 240 Z']}
        details={<g>
          <path d="M122 194 L150 236 L178 194 L192 218 L150 248 L108 218 Z" fill="#ffffff" stroke={LINE} />
          <path d="M114 214 L150 240 L186 214" fill="none" stroke={choice.color} strokeWidth="2" />
          <path d="M150 240 L137 266 L150 258 L163 266 Z" fill="#ef4444" stroke={LINE} />
        </g>} />;
    case 'kimono':
      return <Garment id={id} choice={choice}
        paths={['M112 196 C128 188 172 188 188 196 L192 342 L108 342 Z']}
        mirror={['M117 200 C92 208 76 250 70 290 L72 336 L106 326 L112 240 Z']}
        details={<g>
          <path d="M128 194 L150 262 L172 194" fill="none" stroke="#ffffff" strokeOpacity="0.8" strokeWidth="4" />
          <rect x="110" y="272" width="80" height="26" fill="#1e1b4b" stroke={LINE} />
          <path d="M150 272 L150 298" stroke="#fde68a" strokeWidth="3" />
        </g>} />;
    case 'jacket':
      return <Garment id={id} choice={choice}
        mirror={['M113 198 C128 190 140 190 147 192 L141 266 L115 262 C112 242 110 218 113 198 Z', 'M117 200 C103 202 97 214 96 232 L91 300 L106 302 L112 240 Z']}
        details={<g stroke="#000" strokeOpacity="0.4"><path d="M141 204 L129 232" /><path d="M159 204 L171 232" /></g>} />;
    default:
      return null;
  }
}

function Accessory({ item }: { item: string }) {
  switch (item) {
    case 'choker':
      return <g><rect x="138" y="170" width="24" height="7" rx="2" fill="#111" stroke={LINE} /><circle cx="150" cy="180" r="4" fill="#ff007f" stroke={LINE} /></g>;
    case 'catears':
      return <g fill="#1a1a2e" stroke={LINE} strokeWidth="1.5">
        <path d="M106 74 L108 30 L138 58 Z" /><path d="M194 74 L192 30 L162 58 Z" />
        <path d="M112 64 L113 42 L130 58 Z" fill="#ff7eb6" /><path d="M188 64 L187 42 L170 58 Z" fill="#ff7eb6" />
      </g>;
    case 'halo':
      return <g className="wf-float"><ellipse cx="150" cy="32" rx="40" ry="10" fill="none" stroke="#fde68a" strokeWidth="5" opacity="0.95" /><ellipse cx="150" cy="32" rx="40" ry="10" fill="none" stroke="#fff" strokeWidth="1.5" opacity="0.8" /></g>;
    case 'visor':
      return <g><rect x="104" y="108" width="92" height="24" rx="11" fill="#00f0ff" opacity="0.5" stroke="#0f172a" strokeWidth="2" /><path d="M112 114 L188 114" stroke="#ffffff" strokeOpacity="0.8" className="wf-twinkle" /></g>;
    case 'headphones':
      return <g stroke={LINE} strokeWidth="1.5">
        <path d="M98 118 C94 40 206 40 202 118" fill="none" stroke="#111" strokeWidth="7" />
        <rect x="88" y="106" width="17" height="34" rx="7" fill="#ff007f" />
        <rect x="195" y="106" width="17" height="34" rx="7" fill="#ff007f" />
      </g>;
    default:
      return null;
  }
}

/** Re-mounts its children whenever `k` changes so the pop animation replays. */
function Pop({ k, children }: { k: string; children: ReactNode }) {
  return <g key={k} className="wf-pop">{children}</g>;
}

const SPARKLES: [number, number, number][] = [[60, 140, 0], [238, 210, 0.3], [82, 420, 0.6], [226, 470, 0.9], [150, 30, 1.2], [40, 300, 0.45], [262, 340, 0.75]];

function Sparkles() {
  return (
    <g fill="#fde68a">
      {SPARKLES.map(([x, y, delay]) => (
        <path key={`${x}-${y}`} className="wf-sparkle" style={{ animationDelay: `${delay}s` }}
          d={`M${x} ${y - 10} L${x + 3} ${y - 3} L${x + 10} ${y} L${x + 3} ${y + 3} L${x} ${y + 10} L${x - 3} ${y + 3} L${x - 10} ${y} L${x - 3} ${y - 3} Z`} />
      ))}
    </g>
  );
}

export default function WaifuFigure({ outfit, className, celebrate = false, eyeColor = '#7c3aed' }: {
  outfit: Outfit;
  className?: string;
  celebrate?: boolean;
  eyeColor?: string;
}) {
  const skinId = useSvgId('skin');
  const key = (g: GarmentChoice) => `${g.item}-${g.material}-${g.color}`;
  return (
    <svg viewBox="0 0 300 600" className={`wf-root ${className ?? ''}`} role="img" aria-label="Dress-up character">
      <style>{ANIM_CSS}</style>
      <defs>
        <linearGradient id={skinId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={SKIN_SHADE} />
          <stop offset="0.3" stopColor={SKIN} />
          <stop offset="0.75" stopColor={SKIN} />
          <stop offset="1" stopColor={SKIN_SHADE} />
        </linearGradient>
      </defs>
      <Scene category={outfit.scene} />
      <g className="wf-breathe">
        <HairBack item={outfit.hair.item} color={outfit.hair.color} />
      </g>
      <Body skinId={skinId} />
      <Pop k={key(outfit.legwear)}><Legwear choice={outfit.legwear} /></Pop>
      <Pop k={key(outfit.shoes)}><Shoes choice={outfit.shoes} /></Pop>
      <Pop k={key(outfit.bottom)}><Bottom choice={outfit.bottom} /></Pop>
      <g className="wf-breathe">
        <UpperBody skinId={skinId} />
        <Pop k={key(outfit.top)}><Top choice={outfit.top} /></Pop>
        <path d={HEAD} fill={`url(#${skinId})`} stroke={mix(SKIN_SHADE, '#000000', 0.35)} strokeWidth="1.3" />
        <Face eyeColor={eyeColor} />
        <Pop k={`${outfit.hair.item}-${outfit.hair.color}`}><HairFront item={outfit.hair.item} color={outfit.hair.color} /></Pop>
        <Pop k={outfit.accessory.item}><Accessory item={outfit.accessory.item} /></Pop>
      </g>
      {celebrate && <Sparkles />}
    </svg>
  );
}
