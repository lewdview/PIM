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
      <path d={d} fill={paint.base} fillOpacity={paint.baseOpacity} stroke={paint.stroke} strokeWidth="1.5" strokeLinejoin="round" />
      {paint.texture && <path d={d} fill={paint.texture} stroke="none" />}
    </g>
  );
  return (
    <g>
      <defs>{paint.defs}</defs>
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
const TORSO = 'M110 190 Q150 176 190 190 L186 245 Q178 275 180 300 Q194 318 194 342 L106 342 Q106 318 120 300 Q122 275 114 245 Z';
const ARM = 'M112 192 Q96 196 93 228 L86 300 Q83 330 88 352 Q95 360 101 350 Q101 322 105 300 L116 238 Z';
const LEG = 'M108 336 L150 336 L147 450 Q145 505 143 560 L127 560 Q123 505 118 450 Q106 395 108 336 Z';
const FOOT = 'M126 556 L144 556 Q147 572 140 578 L124 578 Q120 570 126 556 Z';

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
          {[0, 1, 2, 3, 4, 5].map((r) => <rect key={r} x={x + 6} y={200 + i * 25 + r * 40} width="8" height="5" fill={r % 2 ? c : '#ff007f'} opacity="0.8" />)}
        </g>
      ))}
      {category === 'Dark Fantasy & Gothic' && (
        <g fill="none" stroke={c} strokeOpacity="0.6" strokeWidth="3">
          <path d="M40 600 L40 160 Q150 20 260 160 L260 600" />
          <circle cx="150" cy="150" r="46" />
          <path d="M150 104 L150 196 M104 150 L196 150 M118 118 L182 182 M182 118 L118 182" strokeWidth="1.5" />
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
          <path d="M150 0 L60 600 L240 600 Z" fill={c} opacity="0.07" />
        </g>
      )}
      {category === 'Impressionist & Fine Art' && [...Array(28)].map((_, i) => (
        <circle key={i} cx={(i * 53) % 300} cy={360 + ((i * 37) % 240)} r={10 + (i % 4) * 5} fill={i % 3 ? c : '#e76f51'} opacity="0.55" />
      ))}
      {category === 'Anime & Celestial' && [...Array(30)].map((_, i) => (
        <circle key={i} cx={(i * 71) % 300} cy={(i * 43) % 600} r={i % 5 === 0 ? 2.4 : 1.2} fill={c} />
      ))}
      {category === 'Minimalist & Surrealism' && (
        <g>
          <circle cx="230" cy="90" r="34" fill={c} opacity="0.85" />
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
      {category === 'Organic & Nature Noir' && [...Array(8)].map((_, i) => (
        <path key={i} d={`M${i * 40 + 5} 600 L${i * 40 + 25} ${220 + (i % 3) * 40} L${i * 40 + 45} 600 Z`} fill={b} stroke={c} strokeOpacity="0.4" />
      ))}
      {category === 'Industrial & Mechanical' && (
        <g stroke={c} strokeOpacity="0.5" fill="none" strokeWidth="2">
          <circle cx="60" cy="120" r="40" strokeDasharray="10 6" />
          <circle cx="250" cy="200" r="30" strokeDasharray="8 5" />
          <path d="M0 500 L300 500 M0 520 L300 520" />
          {[0, 1, 2, 3, 4, 5].map((i) => <path key={i} d={`M${i * 60} 500 L${i * 60 + 30} 520`} />)}
        </g>
      )}
    </g>
  );
}

function HairBack({ item, color }: { item: string; color: string }) {
  const p = { fill: color, stroke: LINE, strokeWidth: 1.5 };
  switch (item) {
    case 'twintails':
      return (
        <g>
          <path d="M108 92 Q60 110 58 220 Q56 290 80 330 Q78 260 98 200 Q108 150 112 110 Z" {...p} />
          <path d="M108 92 Q60 110 58 220 Q56 290 80 330 Q78 260 98 200 Q108 150 112 110 Z" {...p} transform={MIRROR} />
          <path d="M100 116 Q150 40 200 116 L200 150 L100 150 Z" {...p} />
        </g>
      );
    case 'long':
      return <path d="M98 100 Q150 30 202 100 Q214 200 206 330 L94 330 Q86 200 98 100 Z" {...p} />;
    case 'ponytail':
      return (
        <g>
          <path d="M100 116 Q150 40 200 116 L200 150 L100 150 Z" {...p} />
          <path d="M180 60 Q240 70 232 180 Q226 260 246 300 Q200 270 200 190 Q198 120 176 80 Z" {...p} />
        </g>
      );
    case 'buns':
      return (
        <g>
          <circle cx="104" cy="62" r="22" {...p} />
          <circle cx="196" cy="62" r="22" {...p} />
          <path d="M100 116 Q150 40 200 116 L200 160 L100 160 Z" {...p} />
        </g>
      );
    case 'bob':
    default:
      return <path d="M96 110 Q150 30 204 110 Q210 150 200 170 L100 170 Q90 150 96 110 Z" {...p} />;
  }
}

function HairFront({ item, color }: { item: string; color: string }) {
  const p = { fill: color, stroke: LINE, strokeWidth: 1.5 };
  const bangs = 'M100 104 Q150 46 200 104 Q192 92 184 112 Q176 94 166 116 Q156 92 146 118 Q136 94 128 114 Q118 94 110 116 Q104 100 100 104 Z';
  return (
    <g>
      <path d={bangs} {...p} />
      {item === 'twintails' && <>
        <circle cx="110" cy="92" r="7" fill="#ff007f" stroke={LINE} />
        <circle cx="190" cy="92" r="7" fill="#ff007f" stroke={LINE} />
      </>}
      {item === 'bob' && <>
        <path d="M100 104 Q94 140 104 166 L112 166 Q104 140 110 112 Z" {...p} />
        <path d="M100 104 Q94 140 104 166 L112 166 Q104 140 110 112 Z" {...p} transform={MIRROR} />
      </>}
      {item === 'long' && <>
        <path d="M100 104 Q90 170 98 250 L110 250 Q102 170 110 112 Z" {...p} />
        <path d="M100 104 Q90 170 98 250 L110 250 Q102 170 110 112 Z" {...p} transform={MIRROR} />
      </>}
    </g>
  );
}

function Face() {
  return (
    <g>
      <ellipse cx="150" cy="114" rx="46" ry="52" fill={SKIN} stroke={LINE} strokeWidth="1.5" />
      {[0, 1].map((side) => (
        <g key={side} transform={side ? MIRROR : undefined}>
          <ellipse cx="131" cy="118" rx="10" ry="13" fill="#ffffff" stroke={LINE} strokeWidth="1.2" />
          <ellipse cx="132" cy="120" rx="7.5" ry="10.5" fill="#6d28d9" />
          <ellipse cx="132" cy="122" rx="4" ry="6" fill="#1e1b4b" />
          <circle cx="129" cy="115" r="2.6" fill="#ffffff" />
          <path d="M119 106 Q131 98 143 106" fill="none" stroke={LINE} strokeWidth="2.4" strokeLinecap="round" />
          <ellipse cx="124" cy="138" rx="7" ry="3.5" fill="#ff7eb6" opacity="0.45" />
        </g>
      ))}
      <path d="M144 145 Q150 150 156 145" fill="none" stroke={LINE} strokeWidth="1.6" strokeLinecap="round" />
    </g>
  );
}

function Body() {
  return (
    <g stroke={LINE} strokeWidth="1.5" strokeLinejoin="round">
      <path d={LEG} fill={SKIN} />
      <path d={LEG} fill={SKIN} transform={MIRROR} />
      <path d={FOOT} fill={SKIN} />
      <path d={FOOT} fill={SKIN} transform={MIRROR} />
      <path d={ARM} fill={SKIN} />
      <path d={ARM} fill={SKIN} transform={MIRROR} />
      <rect x="140" y="150" width="20" height="36" fill={SKIN_SHADE} />
      {/* Neutral base bodysuit so the figure is always dressed. */}
      <path d={TORSO} fill="#2b2140" />
      <path d="M108 336 L192 336 L188 356 Q150 364 112 356 Z" fill="#2b2140" />
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
      <Garment id="legwear" choice={choice} mirror={['M112 380 L148 380 L148 392 L113 392 Z']} />
      <path d={LEG} fill={`url(#${netId})`} />
      <path d={LEG} fill={`url(#${netId})`} transform={MIRROR} />
    </g>
  );
}

function Legwear({ choice }: { choice: GarmentChoice }) {
  const id = 'legwear';
  switch (choice.item) {
    case 'thighhighs':
      return <Garment id={id} choice={choice} mirror={['M114 410 L148 410 L146 450 Q145 505 143 560 L127 560 Q123 505 118 450 Z']}
        details={<><path d="M114 410 L148 410" stroke="#000" strokeOpacity="0.4" strokeWidth="4" /><path d="M186 410 L152 410" stroke="#000" strokeOpacity="0.4" strokeWidth="4" /></>} />;
    case 'stockings':
      return <Garment id={id} choice={choice} mirror={[LEG]} />;
    case 'fishnet':
      return <Fishnet choice={choice} />;
    case 'warmers':
      return <Garment id={id} choice={choice} mirror={['M120 470 L150 470 L150 550 L120 550 Q114 510 120 470 Z']} />;
    default:
      return null;
  }
}

function Shoes({ choice }: { choice: GarmentChoice }) {
  const id = 'shoes';
  switch (choice.item) {
    case 'platforms':
      return <Garment id={id} choice={choice} mirror={['M124 548 L146 548 L148 572 L148 590 L120 590 L120 572 Z']} />;
    case 'boots':
      return <Garment id={id} choice={choice} mirror={['M121 488 L148 488 L147 560 Q152 578 148 588 L118 588 Q114 572 122 556 Z']}
        details={<g stroke="#000" strokeOpacity="0.45">{[500, 514, 528, 542].map((y) => <g key={y}><path d={`M126 ${y} L142 ${y + 6}`} /><path d={`M174 ${y} L158 ${y + 6}`} /></g>)}</g>} />;
    case 'sneakers':
      return <Garment id={id} choice={choice} mirror={['M122 550 L146 550 Q152 568 148 582 L116 582 Q114 566 122 550 Z']}
        details={<g fill="#ffffff"><rect x="114" y="578" width="36" height="6" rx="2" /><rect x="150" y="578" width="36" height="6" rx="2" /></g>} />;
    case 'maryjanes':
      return <Garment id={id} choice={choice} mirror={['M123 560 L146 560 Q149 574 143 582 L120 582 Q117 570 123 560 Z', 'M124 556 L146 552 L146 556 L124 560 Z']} />;
    default:
      return null;
  }
}

function Bottom({ choice }: { choice: GarmentChoice }) {
  const id = 'bottom';
  switch (choice.item) {
    case 'pleated':
      return <Garment id={id} choice={choice} paths={['M116 292 L184 292 L204 380 L96 380 Z']}
        details={<g stroke="#000" strokeOpacity="0.3">{[112, 128, 144, 160, 176, 192].map((x) => <path key={x} d={`M${(x + 150) / 2 + 0} 296 L${x} 378`} />)}</g>} />;
    case 'shorts':
      return <Garment id={id} choice={choice} paths={['M110 298 L190 298 L194 356 L154 358 L150 344 L146 358 L106 356 Z']} />;
    case 'mini':
      return <Garment id={id} choice={choice} paths={['M114 292 L186 292 L194 366 L106 366 Z']}
        details={<path d="M150 330 L150 366" stroke="#000" strokeOpacity="0.4" />} />;
    case 'gown':
      return <Garment id={id} choice={choice} paths={['M116 290 L184 290 Q196 360 222 560 Q150 584 78 560 Q104 360 116 290 Z']}
        details={<path d="M150 300 Q146 430 160 570" fill="none" stroke="#ffffff" strokeOpacity="0.25" strokeWidth="3" />} />;
    case 'pants':
      return <Garment id={id} choice={choice} paths={['M108 296 L192 296 L194 340 L150 344 L106 340 Z']}
        mirror={['M106 336 L150 336 L148 450 Q150 510 156 556 L118 556 Q120 500 116 450 Q104 395 106 336 Z']} />;
    default:
      return null;
  }
}

function Top({ choice }: { choice: GarmentChoice }) {
  const id = 'top';
  switch (choice.item) {
    case 'crop':
      return <Garment id={id} choice={choice} paths={['M112 192 Q150 182 188 192 L186 246 Q150 256 114 246 Z']}
        mirror={['M112 192 Q100 194 98 212 L110 218 L118 200 Z']} />;
    case 'bikini':
      return <Garment id={id} choice={choice} mirror={['M120 212 Q134 204 148 216 L146 244 Q132 250 118 244 Z', 'M128 208 L136 186 L138 188 L131 210 Z']}
        details={<path d="M146 228 L154 228" stroke={choice.color} strokeWidth="3" />} />;
    case 'corset':
      return <Garment id={id} choice={choice} paths={['M116 214 Q150 226 184 214 L182 250 Q176 276 180 302 Q150 312 120 302 Q124 276 118 250 Z']}
        details={<g stroke="#ffffff" strokeOpacity="0.7" strokeWidth="1.2">{[232, 248, 264, 280, 294].map((y) => <path key={y} d={`M144 ${y} L156 ${y + 8} M156 ${y} L144 ${y + 8}`} />)}</g>} />;
    case 'sailor':
      return <Garment id={id} choice={choice}
        paths={['M110 190 Q150 178 190 190 L186 245 Q180 276 182 300 L118 300 Q120 276 114 245 Z']}
        mirror={['M112 192 Q96 196 93 228 L90 262 L106 266 L116 238 Z']}
        details={<g>
          <path d="M120 188 L150 230 L180 188 L192 214 L150 244 L108 214 Z" fill="#ffffff" stroke={LINE} />
          <path d="M150 236 L138 262 L150 254 L162 262 Z" fill="#ef4444" stroke={LINE} />
        </g>} />;
    case 'kimono':
      return <Garment id={id} choice={choice}
        paths={['M110 190 Q150 178 190 190 L190 340 L110 340 Z']}
        mirror={['M112 192 Q88 200 70 280 L74 330 L106 320 L116 238 Z']}
        details={<g>
          <path d="M126 188 L150 260 L174 188" fill="none" stroke="#ffffff" strokeOpacity="0.8" strokeWidth="4" />
          <rect x="110" y="270" width="80" height="26" fill="#1e1b4b" stroke={LINE} />
          <path d="M150 270 L150 296" stroke="#fde68a" strokeWidth="3" />
        </g>} />;
    case 'jacket':
      return <Garment id={id} choice={choice}
        mirror={['M110 190 Q132 182 146 186 L140 262 L114 258 L116 238 Z', 'M112 192 Q96 196 93 228 L86 300 L104 302 L116 238 Z']}
        details={<g stroke="#000" strokeOpacity="0.4"><path d="M140 200 L128 230" /><path d="M160 200 L172 230" /></g>} />;
    default:
      return null;
  }
}

function Accessory({ item }: { item: string }) {
  switch (item) {
    case 'choker':
      return <g><rect x="138" y="164" width="24" height="7" rx="2" fill="#111" stroke={LINE} /><circle cx="150" cy="174" r="4" fill="#ff007f" stroke={LINE} /></g>;
    case 'catears':
      return <g fill="#1a1a2e" stroke={LINE} strokeWidth="1.5">
        <path d="M108 80 L112 40 L138 66 Z" /><path d="M192 80 L188 40 L162 66 Z" />
        <path d="M114 72 L116 52 L130 66 Z" fill="#ff7eb6" /><path d="M186 72 L184 52 L170 66 Z" fill="#ff7eb6" />
      </g>;
    case 'halo':
      return <ellipse cx="150" cy="40" rx="40" ry="10" fill="none" stroke="#fde68a" strokeWidth="5" opacity="0.95" />;
    case 'visor':
      return <g><rect x="104" y="106" width="92" height="22" rx="10" fill="#00f0ff" opacity="0.55" stroke="#0f172a" strokeWidth="2" /><path d="M110 112 L190 112" stroke="#ffffff" strokeOpacity="0.8" /></g>;
    case 'headphones':
      return <g stroke={LINE} strokeWidth="1.5">
        <path d="M100 116 Q150 30 200 116" fill="none" stroke="#111" strokeWidth="7" />
        <rect x="90" y="106" width="16" height="32" rx="6" fill="#ff007f" />
        <rect x="194" y="106" width="16" height="32" rx="6" fill="#ff007f" />
      </g>;
    default:
      return null;
  }
}

export default function WaifuFigure({ outfit, className }: { outfit: Outfit; className?: string }) {
  return (
    <svg viewBox="0 0 300 600" className={className} role="img" aria-label="Dress-up character">
      <Scene category={outfit.scene} />
      <HairBack item={outfit.hair.item} color={outfit.hair.color} />
      <Body />
      <Legwear choice={outfit.legwear} />
      <Shoes choice={outfit.shoes} />
      <Bottom choice={outfit.bottom} />
      <Top choice={outfit.top} />
      <Face />
      <HairFront item={outfit.hair.item} color={outfit.hair.color} />
      <Accessory item={outfit.accessory.item} />
    </svg>
  );
}
