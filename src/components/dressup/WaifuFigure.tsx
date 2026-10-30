/**
 * WaifuFigure.tsx — layered SVG paper doll for the Daily Waifu Dress-Up.
 *
 * Every garment is drawn as a shape filled with a base paint and a texture
 * overlay generated from its material (the 16 OUTFIT_STYLES in artTypes.ts),
 * so "Liquid Chrome" and "Acid Denim" read differently in the same colour.
 */

import { useId, type ReactNode } from 'react';
import type { OutfitStyle } from '../../utils/artTypes';
import { ACCENT_COLOR, BASE_COLOR, SCENES, type Outfit, type GarmentChoice } from '../../game/dressUp';

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

// ---------------------------------------------------------------------------
// Marker-comic hand (the anidoodle "koi" recipe): flat cel fills, ONE light from the upper
// left, a hard-edged shadow shape on the side away from it, and a contour that thickens on the
// shadow side and thins where the light hits. Shadows are hue-shifted toward violet, not grey.
// ---------------------------------------------------------------------------
const LIGHT: [number, number] = [-6, -5];
const SHADOW_INK = '#3b1d5e';
const MASK_BOX = { maskUnits: 'userSpaceOnUse' as const, x: -320, y: -120, width: 940, height: 840 };

/** One shape drawn in the marker-comic hand. `mirrored` keeps the light on the same side. */
function Cel({ d, fill, fillOpacity = 1, texture, textureFilter, shade = SHADOW_INK, shadeOpacity = 0.3, line, depth = 1, weight = 1, mirrored = false }: {
  d: string;
  fill: string;
  fillOpacity?: number;
  texture?: string;
  textureFilter?: string;
  shade?: string;
  shadeOpacity?: number;
  line: string;
  depth?: number;
  weight?: number;
  mirrored?: boolean;
}) {
  const id = useSvgId('cel');
  const dx = (mirrored ? -LIGHT[0] : LIGHT[0]) * depth;
  const dy = LIGHT[1] * depth;
  return (
    <g>
      <defs>
        <mask id={`${id}-s`} {...MASK_BOX}>
          <path d={d} fill="#fff" />
          <path d={d} fill="#000" transform={`translate(${dx} ${dy})`} />
        </mask>
        <mask id={`${id}-l`} {...MASK_BOX}>
          <rect x="-320" y="-120" width="940" height="840" fill="#fff" />
          <path d={d} fill="#000" transform={`translate(${dx * 0.4} ${dy * 0.4})`} />
        </mask>
      </defs>
      <path d={d} fill={fill} fillOpacity={fillOpacity} stroke="none" />
      {texture && <path d={d} fill={texture} stroke="none" filter={textureFilter} />}
      <path d={d} fill={shade} fillOpacity={shadeOpacity} stroke="none" mask={`url(#${id}-s)`} />
      <path d={d} fill="none" stroke={line} strokeWidth={0.9 * weight} strokeLinejoin="round" />
      <path d={d} fill="none" stroke={line} strokeWidth={2.4 * weight} strokeLinejoin="round" mask={`url(#${id}-l)`} />
    </g>
  );
}

const SKIN_LINE = mix(SKIN_SHADE, '#000000', 0.45);
/** Skin in the marker hand: a flat fill with a warm cel shadow. */
function Skin({ d, mirrored, depth = 1 }: { d: string; mirrored?: boolean; depth?: number }) {
  return <Cel d={d} fill={SKIN} shade="#d9826e" shadeOpacity={0.55} line={SKIN_LINE} depth={depth} mirrored={mirrored} />;
}

type Wrap = 'bust' | 'hips';
const neutral = 'rgb(128,128,128)';
const WRAP_MAPS: Record<Wrap, string> = {
  bust: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 600" width="300" height="600"><defs>
<linearGradient id="a" gradientUnits="userSpaceOnUse" x1="92" x2="150"><stop offset="0" stop-color="rgb(214,128,128)"/><stop offset=".5" stop-color="${neutral}"/><stop offset="1" stop-color="rgb(42,128,128)"/></linearGradient>
<linearGradient id="b" gradientUnits="userSpaceOnUse" x1="150" x2="208"><stop offset="0" stop-color="rgb(214,128,128)"/><stop offset=".5" stop-color="${neutral}"/><stop offset="1" stop-color="rgb(42,128,128)"/></linearGradient>
<radialGradient id="f"><stop offset="0" stop-color="#fff"/><stop offset=".55" stop-color="#fff"/><stop offset="1" stop-color="#000"/></radialGradient>
<mask id="ma"><ellipse cx="121" cy="238" rx="31" ry="34" fill="url(#f)"/></mask><mask id="mb"><ellipse cx="179" cy="238" rx="31" ry="34" fill="url(#f)"/></mask></defs>
<rect width="300" height="600" fill="${neutral}"/><rect x="90" y="204" width="60" height="68" fill="url(#a)" mask="url(#ma)"/><rect x="150" y="204" width="60" height="68" fill="url(#b)" mask="url(#mb)"/></svg>`,
  hips: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 600" width="300" height="600"><defs>
<linearGradient id="c" gradientUnits="userSpaceOnUse" x1="80" x2="220"><stop offset="0" stop-color="rgb(64,128,128)"/><stop offset=".2" stop-color="rgb(110,128,128)"/><stop offset=".5" stop-color="${neutral}"/><stop offset=".8" stop-color="rgb(146,128,128)"/><stop offset="1" stop-color="rgb(192,128,128)"/></linearGradient>
<linearGradient id="v" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000"/><stop offset=".25" stop-color="#fff"/><stop offset=".75" stop-color="#fff"/><stop offset="1" stop-color="#000"/></linearGradient>
<mask id="m"><rect x="80" y="284" width="140" height="120" fill="url(#v)"/></mask></defs>
<rect width="300" height="600" fill="${neutral}"/><rect x="80" y="284" width="140" height="120" fill="url(#c)" mask="url(#m)"/></svg>`,
};

function WrapFilter({ id, wrap }: { id: string; wrap: Wrap }) {
  return (
    <filter id={id} filterUnits="userSpaceOnUse" x="0" y="0" width="300" height="600" colorInterpolationFilters="sRGB">
      <feImage href={`data:image/svg+xml,${encodeURIComponent(WRAP_MAPS[wrap])}`} x="0" y="0" width="300" height="600" preserveAspectRatio="none" result="map" />
      <feDisplacementMap in="SourceGraphic" in2="map" scale={wrap === 'bust' ? 16 : 12} xChannelSelector="R" yChannelSelector="G" />
    </filter>
  );
}

/**
 * Draws a list of paths in a garment's paint with a hard cel shadow on top.
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
  // Tops wrap their pattern over the bust, bottoms around the hips.
  const wrap: Wrap | undefined = id === 'top' ? 'bust' : id === 'bottom' ? 'hips' : undefined;
  const wrapId = `${uid}-wrap`;
  const layer = (d: string, key: string, transform?: string) => (
    <g key={key} transform={transform}>
      <Cel d={d} fill={paint.base} fillOpacity={paint.baseOpacity} texture={paint.texture} textureFilter={wrap && paint.texture ? `url(#${wrapId})` : undefined} line={paint.stroke} mirrored={!!transform} />
    </g>
  );
  return (
    <g>
      <defs>
        {paint.defs}
        {wrap && paint.texture && <WrapFilter id={wrapId} wrap={wrap} />}
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
// Loomis head: cranium ball, cheekbones at the eye line, then a long soft jaw to a small, slightly squared chin.
const HEAD = 'M150 51 C184 51 203 77 203 108 C203 124 200.5 136 194.5 146 C186.5 158.5 168 172.5 154.5 176.8 Q150 178 145.5 176.8 C132 172.5 113.5 158.5 105.5 146 C99.5 136 97 124 97 108 C97 77 116 51 150 51 Z';
// Longer, tapered neck that flares into the trapezius.
const NECK = 'M141 160 C141 174 140.5 184 137 195 Q150 201 163 195 C159.5 184 159 174 159 160 Z';
// Exaggerated pin-up hourglass: bust ~x96–204, waist ~x124–176, hips ~x90–210.
const TORSO = 'M116 196 C126 193 133 191 138 190 Q150 199 162 190 C167 191 174 193 184 196 C200 208 206 230 202 250 C198 264 182 270 177 278 C172 288 173 298 186 312 C202 326 212 340 210 352 L90 352 C88 340 98 326 114 312 C127 298 128 288 123 278 C118 270 102 264 98 250 C94 230 100 208 116 196 Z';
// Arms sit in a slight A-pose so they frame the curves instead of hiding them.
// The arm runs into the back of the hand in one contour, so there is no seam at the wrist. The
// outer forearm swells just below the elbow (brachioradialis) and the inner edge narrows to the wrist.
const ARM = 'M118 198 C98 200 88 212 85 230 C82.6 246 80.4 262 78.6 278 C77.4 286 75 292 72.6 302 C70.6 314 69.2 326 68 336 C64.6 342 62.4 348 62.4 353.6 C62.2 357.4 62.6 361.4 63.6 364 C64.4 366 66.2 366 66.6 363.8 C66.8 362.6 66.8 361.4 66.9 360.4 C67 363.4 67.4 367.6 68.6 369.2 C69.8 370.6 71.1 369.6 71.2 367.6 C71.3 365 71.3 362.6 71.3 361 C71.5 364.6 72 369.6 73.4 371 C74.8 372.2 75.9 370.8 75.9 368.4 C75.9 365.6 75.9 363 76 361 C76.3 364 76.8 368.2 78 369.2 C79.4 370.2 80.3 367.8 80.4 364.6 C80.6 361 80.7 358 80.6 355.6 C80.6 350 79.6 345 78.2 340.6 C79.4 330 82.6 316 85.6 304 C87.4 296 89.4 291 90.6 287 C93.4 270 98 252 104 238 Z';
// Relaxed hanging hand (her right; mirrored for the left), seen from the front with the palm to
// the thigh: the back of the hand, four fingers in length order (middle > ring >= index > little,
// little finger on the outside), knuckles on an arc, and the thumb in front on the inner side.
// Thumb tucked behind the index finger on the inner side: drawn under the arm, so only a smooth
// sliver shows along the edge of the hand.
const THUMB = 'M77.4 341.4 C81.4 344.4 83.6 349.4 83.6 354.6 C83.6 359.2 82.4 362.6 80.4 364.4 L76 360 L75.6 344 Z';
// Leg and foot in one contour, front view. Outer calf swells high, inner calf low; the knee is the
// narrow point; the ankle tapers to the malleoli; the foot flares to five toes, big toe inside.
const LEG = 'M89.4 344 L150 344 C150.5 372 148.5 404 146 432 C147.6 440 148 448 146.4 456 C145.4 462 145.6 468 146.4 478 C147 492 145 512 142.6 530 C141 540 140 548 140.8 554 C143.6 561 147.2 567 148 573 C148.6 577.4 147 581.2 143.6 581.4 C142.2 581.4 141.4 580.8 141 580 C140 581.6 137.6 581.8 136.8 580.2 C135.8 581.4 133.4 581.4 132.6 579.8 C131.6 580.8 129.4 580.6 128.8 579.2 C127.4 579.8 125 579.2 124.8 577.4 C124.4 574.4 125.4 570.4 126 567 C126.8 562 127.8 558 127.4 552 C127 536 120.4 516 114.6 500 C110.8 488 110.6 474 113 464 C114.6 458 117.4 453 117.4 448 C112 436 103 422 97.6 404 C92.4 386 88.8 366 89.4 344 Z';
// One rounded bust volume (left; mirrored for the right). It is drawn over the chest and
// collarbones so the upper curve reads as sitting in front of them.
// A gravity teardrop, not a circle: the upper pole slopes off the chest wall below the collarbone,
// the fullness sits low and outside, then the fold turns under and rises to the sternum.
const BUST = 'M150 238 C149 226 144 214 134 208 C126 203.5 116 203 108 207 C99 212 94.5 224 94.5 238 C94.5 254 104 266 120 267.5 C134 268.5 146 261 149.5 250 C150.3 246 150.4 242 150 238 Z';
// Base layer: a pastel sports bra and bike shorts so the figure is never undressed.
// The bra follows the bust tops with a scooped front and a wide band under the bust.
const SPORTS_BRA = 'M96 232 C100 216 112 210 124 212 C136 214 146 220 150 232 C154 220 164 214 176 212 C188 210 200 216 204 232 C204 242 203 246 202 250 C199 262 188 268 179 276 Q150 282 121 276 C112 268 101 262 98 250 Z';
// Wide straps from the cups up over the shoulder slope (left; mirrored for the right).
const BRA_STRAP = 'M112 214 C114 207 118 201 122 197 L131 196 C128 201 126 207 125.4 213 Z';
// Mid-thigh bike shorts: waistband at the navel line, snug over the hips, hems curving round each thigh.
const SHORTS = 'M108 318 Q150 324 192 318 C201 328 211.6 338 211.8 352 C212.2 372 207.6 390 201.6 406 Q178 412 154 408 L150 392 L146 408 Q122 412 98.4 406 C92.4 390 87.8 372 88.2 352 C88.4 338 99 328 108 318 Z';
const TOES = 'M141 580 L141.3 576.8 M136.8 580.2 L136.9 577.4 M132.6 579.8 L132.5 577.2 M128.8 579.2 L128.5 576.8';

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

/** A spur gear outline: square teeth around a rim, for the foundry backdrop. */
function gearPath(cx: number, cy: number, r: number, teeth: number): string {
  const pts: string[] = [];
  for (let i = 0; i < teeth * 4; i++) {
    const ang = (i / (teeth * 4)) * Math.PI * 2;
    const rr = i % 4 < 2 ? r + 6 : r;
    pts.push(`${(cx + Math.cos(ang) * rr).toFixed(1)} ${(cy + Math.sin(ang) * rr).toFixed(1)}`);
  }
  return `M${pts.join(' L')} Z`;
}

/** Three-tier pine silhouette standing on the floor line. */
function pinePath(x: number, top: number, w: number): string {
  return `M${x} ${top} L${x + w * 0.5} ${top + 40} L${x + w * 0.25} ${top + 40} L${x + w * 0.8} ${top + 95} L${x + w * 0.4} ${top + 95} L${x + w} 600 `
    + `L${x - w} 600 L${x - w * 0.4} ${top + 95} L${x - w * 0.8} ${top + 95} L${x - w * 0.25} ${top + 40} L${x - w * 0.5} ${top + 40} Z`;
}

/** Four-point sparkle star centred on the origin. */
const SPARKLE = 'M0 -7 L1.4 -1.4 L7 0 L1.4 1.4 L0 7 L-1.4 1.4 L-7 0 L-1.4 -1.4 Z';

function Scene({ category }: { category: string }) {
  const scene = SCENES.find((s) => s.category === category) ?? SCENES[6];
  const [a, b, c] = scene.colors;
  const bgId = useSvgId('scene');
  const glowId = `${bgId}-glow`;
  const floorId = `${bgId}-floor`;
  const orbId = `${bgId}-orb`;
  const moonId = `${bgId}-moon`;
  const voidScene = category === 'Minimalist & Surrealism';
  return (
    <g>
      <defs>
        <linearGradient id={bgId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={a} />
          <stop offset="1" stopColor={b} />
        </linearGradient>
        <radialGradient id={glowId}>
          <stop offset="0" stopColor={c} stopOpacity="0.5" />
          <stop offset="1" stopColor={c} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={floorId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity={voidScene ? 0.12 : 0.4} />
        </linearGradient>
        <radialGradient id={orbId} cx="0.38" cy="0.35" r="0.7">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.7" stopColor="#e2e8f0" />
          <stop offset="1" stopColor="#94a3b8" />
        </radialGradient>
        <mask id={moonId} {...MASK_BOX}>
          <circle cx="236" cy="96" r="24" fill="#fff" />
          <circle cx="246" cy="88" r="21" fill="#000" />
        </mask>
      </defs>
      <rect width="300" height="600" fill={`url(#${bgId})`} />
      {/* A soft key-light bloom behind the figure separates her from every backdrop. */}
      {!voidScene && <ellipse cx="150" cy="270" rx="150" ry="240" fill={`url(#${glowId})`} opacity="0.45" />}

      {category === 'Cyberpunk & Sci-Fi' && (
        <g>
          {/* Far skyline in haze, then lit towers in front. */}
          <path d="M0 470 L0 300 L18 300 L18 262 L40 262 L40 320 L58 320 L58 232 L70 232 L70 214 L74 214 L74 232 L84 232 L84 290 L110 290 L110 252 L130 252 L130 470 Z M170 470 L170 272 L196 272 L196 222 L204 222 L204 200 L207 200 L207 222 L214 222 L214 300 L240 300 L240 242 L262 242 L262 312 L282 312 L282 272 L300 272 L300 470 Z" fill={b} opacity="0.85" />
          {[20, 70, 200, 250].map((x, i) => (
            <g key={i}>
              <rect x={x} y={180 + i * 25} width="34" height={420} fill="#0b0b1a" stroke={c} strokeOpacity="0.5" />
              <path d={`M${x + 17} ${180 + i * 25} L${x + 17} ${160 + i * 25}`} stroke={c} strokeOpacity="0.6" />
              <circle cx={x + 17} cy={158 + i * 25} r="1.6" fill="#ff007f" className="wf-flicker" />
              {[0, 1, 2, 3, 4, 5].map((r) => (
                <rect key={r} x={x + 6} y={200 + i * 25 + r * 40} width="8" height="5" fill={r % 2 ? c : '#ff007f'}
                  className="wf-flicker" style={{ animationDelay: `${(i * 6 + r) * 0.37}s` }} />
              ))}
              {[0, 1, 2, 3, 4].map((r) => (
                <rect key={`w${r}`} x={x + 20} y={210 + i * 25 + r * 40} width="8" height="3" fill={c} opacity="0.35" />
              ))}
            </g>
          ))}
          {/* Wet street: neon edges reflected on the floor. */}
          <path d="M0 520 L300 520" stroke={c} strokeOpacity="0.35" />
          {[37, 87, 217, 267].map((x) => <path key={x} d={`M${x} 524 L${x} 560`} stroke={x % 2 ? '#ff007f' : c} strokeOpacity="0.25" strokeWidth="4" />)}
        </g>
      )}
      {category === 'Dark Fantasy & Gothic' && (
        <g>
          {/* Lancet windows of stained glass, with light falling from them. */}
          {[18, 240].map((x) => (
            <g key={x}>
              <path d={`M${x + 21} 300 L${x - 10} 520 L${x + 52} 520 Z`} fill={c} opacity="0.07" />
              <path d={`M${x} 300 L${x} 220 Q${x + 21} 176 ${x + 42} 220 L${x + 42} 300 Z`} fill={c} fillOpacity="0.22" stroke={c} strokeOpacity="0.6" strokeWidth="2" />
              <path d={`M${x + 21} 196 L${x + 21} 300 M${x} 250 L${x + 42} 250 M${x} 275 L${x + 42} 275`} stroke="#000" strokeOpacity="0.55" strokeWidth="1.5" />
              <rect x={x + 4} y="226" width="12" height="20" fill="#7c3aed" opacity="0.35" />
              <rect x={x + 26} y="254" width="12" height="18" fill="#fbbf24" opacity="0.3" />
            </g>
          ))}
          <g fill="none" stroke={c} strokeOpacity="0.6" strokeWidth="3">
            <path d="M40 600 L40 160 Q150 20 260 160 L260 600" />
            <circle cx="150" cy="150" r="46" fill={c} fillOpacity="0.12" />
            <path d="M150 104 L150 196 M104 150 L196 150 M118 118 L182 182 M182 118 L118 182" strokeWidth="1.5" />
            <circle cx="150" cy="150" r="14" strokeWidth="2" />
          </g>
          {/* Candles with a warm bloom. */}
          {[60, 240].map((x) => (
            <g key={x}>
              <circle cx={x} cy="420" r="14" fill="#fbbf24" opacity="0.12" />
              <rect x={x - 3} y="424" width="6" height="22" fill="#e7e5e4" opacity="0.8" />
              <path d={`M${x} 412 Q${x + 4} 419 ${x} 424 Q${x - 4} 419 ${x} 412 Z`} fill="#fbbf24" className="wf-flicker" />
            </g>
          ))}
        </g>
      )}
      {category === 'Neon Retro & Synthwave' && (
        <g>
          <circle cx="150" cy="300" r="120" fill={`url(#${glowId})`} />
          <circle cx="150" cy="300" r="90" fill={c} opacity="0.85" />
          {[0, 1, 2, 3, 4].map((i) => <rect key={i} x="50" y={300 + i * 14} width="200" height={5 + i} fill={a} />)}
          {[...Array(9)].map((_, i) => <line key={i} x1={150} y1={380} x2={-150 + i * 75} y2={600} stroke="#ff007f" strokeOpacity="0.7" />)}
          {[0, 1, 2, 3, 4].map((i) => <line key={`h${i}`} x1="0" x2="300" y1={400 + i * i * 9} y2={400 + i * i * 9} stroke="#ff007f" strokeOpacity="0.7" />)}
        </g>
      )}
      {category === 'High-Fashion & Vogue' && (
        <g>
          {/* Runway strip in perspective, the crowd as camera flashes along its sides. */}
          <path d="M126 440 L174 440 L270 600 L30 600 Z" fill={c} opacity="0.06" />
          <path d="M126 440 L30 600 M174 440 L270 600" stroke={c} strokeOpacity="0.25" />
          {[...Array(14)].map((_, i) => (
            <circle key={i} cx={i < 7 ? 8 + i * 14 : 180 + (i - 7) * 16} cy={420 + (i % 3) * 10} r={i % 4 === 0 ? 3 : 1.6} fill="#ffffff"
              opacity="0.6" className="wf-twinkle" style={{ animationDelay: `${i * 0.33}s` }} />
          ))}
          <ellipse cx="150" cy="585" rx="130" ry="18" fill={c} opacity="0.15" />
          <path d="M150 0 L60 600 L240 600 Z" fill={c} opacity="0.07" className="wf-twinkle" style={{ animationDuration: '5s' }} />
        </g>
      )}
      {category === 'Impressionist & Fine Art' && (
        <g>
          {/* Rolling hills in two values, dabs of colour over them. */}
          <path d="M0 410 Q70 370 150 400 T300 390 L300 600 L0 600 Z" fill={a} opacity="0.55" />
          <path d="M0 470 Q90 440 170 466 T300 456 L300 600 L0 600 Z" fill="#2a9d8f" opacity="0.45" />
          {[...Array(28)].map((_, i) => (
            <circle key={i} cx={(i * 53) % 300} cy={360 + ((i * 37) % 240)} r={10 + (i % 4) * 5} fill={i % 3 ? c : '#e76f51'} opacity="0.55" />
          ))}
          {[...Array(16)].map((_, i) => (
            <path key={`s${i}`} d={`M${(i * 41) % 300} ${60 + ((i * 59) % 260)} q8 -4 16 0`} fill="none" stroke="#ffffff"
              strokeOpacity="0.18" strokeWidth="4" strokeLinecap="round" />
          ))}
        </g>
      )}
      {category === 'Anime & Celestial' && (
        <g>
          <ellipse cx="150" cy="240" rx="260" ry="40" transform="rotate(-28 150 240)" fill={c} opacity="0.06" />
          <circle cx="236" cy="96" r="40" fill={`url(#${glowId})`} />
          <circle cx="236" cy="96" r="24" fill={c} mask={`url(#${moonId})`} />
          {[...Array(30)].map((_, i) => (
            <circle key={i} cx={(i * 71) % 300} cy={(i * 43) % 600} r={i % 5 === 0 ? 2.4 : 1.2} fill={c}
              className="wf-twinkle" style={{ animationDelay: `${(i % 7) * 0.4}s` }} />
          ))}
          {[[48, 70, 1], [270, 260, 0.7], [30, 330, 0.8], [200, 40, 0.6]].map(([x, y, s], i) => (
            <path key={`k${i}`} d={SPARKLE} transform={`translate(${x} ${y}) scale(${s})`} fill="#ffffff"
              className="wf-twinkle" style={{ animationDelay: `${i * 0.7}s` }} />
          ))}
        </g>
      )}
      {voidScene && (
        <g>
          {/* Surreal still life: a floating pearl and a door onto a daytime sky, both casting shadows on the horizon. */}
          <ellipse cx="232" cy="478" rx="26" ry="4" fill={c} opacity="0.12" />
          <g className="wf-float">
            <circle cx="232" cy="92" r="30" fill={`url(#${orbId})`} stroke={c} strokeOpacity="0.35" strokeWidth="1.2" />
            <path d="M212 104 Q226 122 252 108" fill="none" stroke={c} strokeOpacity="0.12" strokeWidth="6" strokeLinecap="round" />
          </g>
          <path d="M36 470 L70 470 L92 482 L58 482 Z" fill={c} opacity="0.1" />
          <rect x="30" y="372" width="40" height="98" fill="#bfdbfe" stroke={c} strokeOpacity="0.55" strokeWidth="1.5" />
          <path d="M36 404 q5 -7 12 -3 q6 -6 12 1 q6 1 4 6 l-30 0 q-3 -4 2 -4 Z" fill="#ffffff" opacity="0.9" />
          <path d="M70 372 L80 378 L80 470 L70 470 Z" fill="#94a3b8" stroke={c} strokeOpacity="0.55" strokeWidth="1" />
          <line x1="0" y1="470" x2="300" y2="470" stroke={c} strokeOpacity="0.3" />
        </g>
      )}
      {category === 'Streetwear & Graffiti' && (
        <g>
          {[...Array(12)].map((_, i) => <rect key={i} x={(i % 4) * 75 + (Math.floor(i / 4) % 2) * 37} y={Math.floor(i / 4) * 40 + 380} width="74" height="39" fill={b} stroke={a} />)}
          <path d="M20 200 Q60 140 100 210 T190 190 T280 220" fill="none" stroke={c} strokeWidth="10" strokeLinecap="round" opacity="0.8" />
          <path d="M30 260 Q90 230 150 270 T280 250" fill="none" stroke="#ff007f" strokeWidth="7" strokeLinecap="round" opacity="0.7" />
          {/* Paint drips under each stroke. */}
          {[[46, 172, 18], [100, 210, 26], [236, 204, 14], [262, 214, 22]].map(([x, y, l]) => (
            <path key={x} d={`M${x} ${y} L${x} ${y + l}`} stroke={c} strokeWidth="2.4" strokeLinecap="round" opacity="0.75" />
          ))}
          {[[60, 250, 16], [150, 270, 20], [222, 258, 12]].map(([x, y, l]) => (
            <path key={x} d={`M${x} ${y} L${x} ${y + l}`} stroke="#ff007f" strokeWidth="2" strokeLinecap="round" opacity="0.65" />
          ))}
        </g>
      )}
      {category === 'Organic & Nature Noir' && (
        <g>
          {[...Array(7)].map((_, i) => <path key={`b${i}`} d={pinePath(i * 50 + 10, 180 + (i % 2) * 30, 20)} fill={b} opacity="0.5" />)}
          <rect x="0" y="430" width="300" height="70" fill={c} opacity="0.06" />
          {[...Array(8)].map((_, i) => (
            <path key={i} d={pinePath(i * 40 + 25, 230 + (i % 3) * 40, 26)} fill="#021a0c" stroke={c} strokeOpacity="0.35" />
          ))}
          {[...Array(10)].map((_, i) => (
            <circle key={`f${i}`} cx={(i * 67 + 20) % 300} cy={160 + ((i * 89) % 300)} r="2" fill="#d9f99d"
              className="wf-twinkle" style={{ animationDelay: `${i * 0.31}s` }} />
          ))}
        </g>
      )}
      {category === 'Industrial & Mechanical' && (
        <g>
          {/* Pipes along the wall, interlocking gears, a floor grate and sparks. */}
          <rect x="0" y="136" width="300" height="12" fill={b} stroke="#000" strokeOpacity="0.5" />
          <rect x="0" y="160" width="300" height="6" fill={b} opacity="0.8" />
          {[30, 130, 230].map((x) => <rect key={x} x={x} y="132" width="10" height="20" fill="#52525b" stroke="#000" strokeOpacity="0.5" />)}
          <g fill={b} stroke={c} strokeOpacity="0.55" strokeWidth="1.5">
            <path d={gearPath(56, 250, 34, 10)} />
            <path d={gearPath(252, 300, 24, 8)} />
          </g>
          <circle cx="56" cy="250" r="10" fill={a} stroke={c} strokeOpacity="0.55" />
          <circle cx="252" cy="300" r="7" fill={a} stroke={c} strokeOpacity="0.55" />
          <g stroke={c} strokeOpacity="0.5" fill="none" strokeWidth="2">
            <path d="M0 500 L300 500 M0 520 L300 520" />
            {[0, 1, 2, 3, 4, 5].map((i) => <path key={i} d={`M${i * 60} 500 L${i * 60 + 30} 520`} />)}
          </g>
          {[[236, 470, -12, -18], [240, 474, 10, -14], [232, 476, -4, -24]].map(([x, y, dx, dy], i) => (
            <path key={i} d={`M${x} ${y} l${dx} ${dy}`} stroke="#fbbf24" strokeWidth="1.4" strokeLinecap="round"
              className="wf-flicker" style={{ animationDelay: `${i * 0.4}s` }} />
          ))}
        </g>
      )}
      {/* Floor plane darkens toward the viewer so the feet sit on something. */}
      <rect x="0" y="470" width="300" height="130" fill={`url(#${floorId})`} />
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

// Hair ends are clumps that taper to points, not a cut edge: each lock bulges, then narrows to its tip.
const HAIR_MASS = 'M92 120 C86 46 214 46 208 120 C210 150 204 172 196 186 C189.9 187.8 183.7 191.0 180.7 192.0 C178.4 189.0 175.3 187.0 173.0 185.0 C174.5 188.7 168.4 194.0 165.3 195.0 C163.0 192.0 160.0 187.0 157.7 185.0 C159.2 187.5 153.1 190.0 150.0 191.0 C147.7 188.0 144.6 187.0 142.3 185.0 C143.9 188.4 137.7 193.0 134.7 194.0 C132.4 191.0 129.3 187.0 127.0 185.0 C128.5 187.8 122.4 191.0 119.3 192.0 C113.2 188.0 107.1 188.0 104.0 186.0 C96 172 90 150 92 120 Z';
const TWIN_TAIL = 'M106 88 C70 98 54 156 60 226 C64 276 72 310 80 336 C81.5 331 83 327 84.5 325 C85.5 332 87.5 340 90 347 C89.6 338 90.6 330 91.6 324 C92.6 328 93.4 332 94 335 C93 300 93.6 262 96 222 C100 172 106 130 114 100 Z';
const PONYTAIL = 'M166 62 C214 52 240 98 232 168 C228 218 234 260 246 296 C240 292 236 290 233 288 C235 294 237 300 238 306 C232 298 226 292 222 286 C222 291 222 297 220 302 C208 276 204 232 202 182 C200 132 194 96 172 80 Z';
const LONG_BACK = 'M92 118 C86 176 84 262 92 344 C97.8 349.0 103.6 355.0 106.5 356.0 C108.7 353.0 111.6 346.0 113.8 344.0 C112.3 350.8 118.1 361.0 121.0 362.0 C123.2 359.0 126.1 346.0 128.2 344.0 C126.8 348.7 132.6 354.0 135.5 355.0 C137.7 352.0 140.6 346.0 142.8 344.0 C141.3 350.2 147.1 359.0 150.0 360.0 C152.2 357.0 155.1 346.0 157.2 344.0 C155.8 348.4 161.6 353.0 164.5 354.0 C166.7 351.0 169.6 346.0 171.8 344.0 C170.3 350.5 176.1 360.0 179.0 361.0 C181.2 358.0 184.1 346.0 186.2 344.0 C184.8 349.3 190.6 356.0 193.5 357.0 C199.3 353.0 205.1 348.0 208.0 346.0 C216 262 214 176 208 118 Z';

function HairBack({ item, color }: { item: string; color: string }) {
  const { defs, p, dark } = useHairPaint(color);
  const strands = (d: string) => <path d={d} fill="none" stroke={dark} strokeOpacity="0.45" strokeWidth="1" />;
  return (
    <g>
      <defs>{defs}</defs>
      {item === 'long' && <>
        <Cel d={LONG_BACK} fill={p.fill} line={p.stroke} />
        {strands('M114 190 C110 250 112 300 113.8 344 M128 186 C126 260 127 310 128.2 344 M147 190 C148 260 143 310 142.8 344 M172 186 C174 260 173 310 171.8 344 M186 190 C190 250 188 300 186.2 344')}
      </>}
      {item === 'twintails' && [false, true].map((right) => (
        <g key={String(right)} transform={right ? MIRROR : undefined}>
          <g className="wf-sway" style={{ transformOrigin: '108px 92px', animationDelay: right ? '-2.2s' : '0s' }}>
            <Cel d={TWIN_TAIL} fill={p.fill} line={p.stroke} mirrored={right} />
            {strands('M98 120 C80 170 78 260 84.5 325 M104 112 C92 170 90 260 91.6 324')}
          </g>
        </g>
      ))}
      {item === 'ponytail' && (
        <g className="wf-sway" style={{ transformOrigin: '170px 66px' }}>
          <Cel d={PONYTAIL} fill={p.fill} line={p.stroke} />
          {strands('M190 90 C220 130 220 220 233 288 M180 86 C206 140 210 230 222 286')}
        </g>
      )}
      <Cel d={HAIR_MASS} fill={p.fill} line={p.stroke} />
    </g>
  );
}

function HairFront({ item, color }: { item: string; color: string }) {
  const { defs, p, dark } = useHairPaint(color);
  // Crown cap peaks above the head (y≈47) and ends in a fringe of bangs.
  const cap = 'M97 128 C88 22 212 22 203 128 C200 112 196 102 190 94 C188 102 184 108 178 112 C175 102 170 94 163 90 C160 100 156 106 150 110 C145 100 140 94 133 90 C130 100 126 106 122 112 C118 102 114 96 110 94 C105 104 100 116 97 128 Z';
  const sideLength = item === 'long' ? 250 : item === 'bob' ? 186 : 200;
  const side = `M97 118 C92 150 92.5 ${sideLength - 36} 99 ${sideLength - 4} C100 ${sideLength - 10} 101.5 ${sideLength - 14} 102.5 ${sideLength - 16} C103.5 ${sideLength - 10} 104.8 ${sideLength - 5} 106 ${sideLength} C107.5 ${sideLength - 26} 109 ${sideLength - 60} 111 132 Z`;
  return (
    <g>
      <defs>{defs}</defs>
      {item === 'buns' && [false, true].map((right) => (
        <g key={String(right)} transform={right ? MIRROR : undefined}>
          <Cel d="M88 58 A22 22 0 1 0 132 58 A22 22 0 1 0 88 58 Z" fill={p.fill} line={p.stroke} mirrored={right} depth={0.7} />
          <path d="M96 52 C102 44 116 42 124 50" fill="none" stroke="#fff" strokeOpacity="0.35" strokeWidth="3" strokeLinecap="round" />
          <path d="M98 70 C106 78 118 78 126 72" fill="none" stroke={dark} strokeOpacity="0.5" />
        </g>
      ))}
      {item === 'bob' && [false, true].map((right) => (
        <g key={String(right)} transform={right ? MIRROR : undefined}>
          <Cel d="M95 112 C88 150 89 172 98 186 C100 184.5 102 183.4 103.6 183 C104.6 186.4 106 189.4 108.4 191.6 C111.6 182 112 170 110 160 C106 140 106 126 110 116 Z" fill={p.fill} line={p.stroke} mirrored={right} depth={0.6} />
          <path d="M100 130 C97 152 98 168 103 182" fill="none" stroke={dark} strokeOpacity="0.4" strokeWidth="0.9" strokeLinecap="round" />
        </g>
      ))}
      {item !== 'bob' && <>
        <Cel d={side} fill={p.fill} line={p.stroke} depth={0.6} />
        <g transform={MIRROR}><Cel d={side} fill={p.fill} line={p.stroke} depth={0.6} mirrored /></g>
      </>}
      {/* Darker under-layer of hair seen through the gaps between the bangs, for depth. */}
      <path d="M100 122 C103 110 107 102 113 98 L118 111 L125.6 100 L130.6 112 L139.4 102 L145.6 113 L151.6 103 L157.6 113 L165.6 102 L170 112 L176 100 L183 111 L188 98 C194 102 198 111 200 122 L200 88 L100 88 Z"
        fill={mix(color, '#000000', 0.18)} stroke={p.stroke} strokeWidth="0.9" />
      <Cel d={cap} fill={p.fill} line={p.stroke} />
      {/* Loose wisps falling forward from the parting. */}
      <path d="M150 72 C146.4 86 143 98 138.6 115 C142.6 104 147.6 92 150 72 Z M151 76 C155 90 158.6 100 160.6 113 C160.4 102 156 88 151 76 Z" fill={p.fill} stroke={p.stroke} strokeWidth="0.9" strokeLinejoin="round" />
      {/* Angel-ring highlight and fringe strands. */}
      <path d="M110 86 C122 72 138 66 156 65 L154 69.5 L150 73 L146.5 69.6 L141 76 L136.4 72 L130.6 79.6 L125.4 75.6 L118.6 85 L114.6 81.4 Z" fill="#ffffff" fillOpacity="0.42" />
      <path d="M162 66 C172 67.4 181 72 188 79 L184 81 L180 78 L176.4 82.6 L172 77.6 L167 73.6 Z" fill="#ffffff" fillOpacity="0.24" />
      <path d="M134 64 Q128 80 133 90 M150 58 Q150 88 150 108 M166 64 Q172 80 163 90" fill="none" stroke={dark} strokeOpacity="0.45" />
      <path d="M122 112 C119 96 123 80 133 68 M178 112 C181 96 177 80 167 68 M110 94 C108 84 112 74 121 65 M190 94 C192 84 188 74 179 65" fill="none" stroke={dark} strokeOpacity="0.28" strokeWidth="0.9" strokeLinecap="round" />
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

// Face, redrawn on a Loomis head: brow line at y≈96, eye line at y≈120 (just below half the head,
// the anime convention), nose base at y≈141, mouth at y≈153, chin at y≈177. Adult proportions:
// eyes about one eye-width apart, upturned outer corners, the iris tucked under the upper lid.
// Every shape is a hand-placed path (left side; mirrored for the right), shaded toward the same
// upper-left light as the body.
const EYE_WHITE = 'M116.5 119 C120 109.5 136 107 145 119.5 C142.5 127.5 134 132 125.5 131 C120 130 117.5 125.5 116.5 119 Z';
const UPPER_LASH = 'M113.5 120 C118 107 135.5 104 146 118 L145.2 119.4 C136 109.5 121.5 110.2 117 120.4 Z';
const LASH_WING = 'M116.8 117.6 L109 114 C110.4 116.4 112.8 118.6 115.6 120.2 Z';
const LID_CREASE = 'M117.5 107.5 C124 101.5 137.5 101 145 109.5';
const LID_SHADOW = 'M116 118.5 C121 110 135 108.5 145 121 C135 113.5 123 113.5 117.5 121.5 Z';
const LOWER_LASH = 'M116.8 121.5 C119.2 128 125.2 131 132.5 130.8';
// Brows sit high with a gentle arch and the inner end lifted, which reads soft rather than stern.
const BROW = 'M145.5 96.5 C140 92 131 90 122.5 91 C118.5 91.5 115.5 92.8 113.5 95 C117.5 93.8 121 93.2 125 93.3 C132.8 93.6 139.6 94.6 145.5 96.5 Z';
const EYESHADOW = 'M116.5 117 C118 106 136 100.5 146 112 C146.5 106 136 98 124 100 C117.5 101.2 113.5 108 116.5 117 Z';
const UPPER_LIP = 'M142 152.6 C144.4 150.4 146.6 148.4 148.7 149.3 Q150 150.1 151.3 149.3 C153.4 148.4 155.6 150.4 158 152.6 Q150 154 142 152.6 Z';
const LOWER_LIP = 'M142.9 153.1 Q150 154.6 157.1 153.1 C156 157.6 153.4 159.8 150 159.8 C146.6 159.8 144 157.6 142.9 153.1 Z';
// The fringe's cast shadow on the forehead: the bang zigzag pushed down and away from the light.
const BANG_SHADOW = 'M97 134 C100 122 105 110 110 100 C114 102 118 108 122 118 C126 112 130 106 133 96 C140 100 145 106 150 116 C156 112 160 106 163 96 C170 100 175 108 178 118 C184 114 188 108 190 100 C196 108 200 118 203 134 L203 60 L97 60 Z';

/** Brows are drawn over the fringe, the anime convention, so the expression always reads. */
function Brows() {
  return (
    <g opacity="0.9">
      {[0, 1].map((side) => (
        <path key={side} d={BROW} fill={mix(LINE, '#7a4a3a', 0.35)} transform={side ? MIRROR : undefined} />
      ))}
    </g>
  );
}

function Face({ eyeColor }: { eyeColor: string }) {
  const irisId = useSvgId('iris');
  const eyeClip = useSvgId('eyeclip');
  const headClip = useSvgId('headclip');
  const lipId = useSvgId('lip');
  return (
    <g>
      <defs>
        <linearGradient id={irisId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={mix(eyeColor, '#000000', 0.7)} />
          <stop offset="0.45" stopColor={mix(eyeColor, '#000000', 0.15)} />
          <stop offset="1" stopColor={mix(eyeColor, '#ffffff', 0.5)} />
        </linearGradient>
        <linearGradient id={lipId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e0446f" />
          <stop offset="1" stopColor="#b8255c" />
        </linearGradient>
        <clipPath id={eyeClip}><path d={EYE_WHITE} /><path d={EYE_WHITE} transform={MIRROR} /></clipPath>
        <clipPath id={headClip}><path d={HEAD} /></clipPath>
      </defs>

      {/* Fringe shadow across the forehead. */}
      <path d={BANG_SHADOW} fill="#d9826e" opacity="0.45" clipPath={`url(#${headClip})`} transform="translate(2 5)" />
      {[0, 1].map((side) => (
        <g key={side} transform={side ? MIRROR : undefined}>
          <path d={EYESHADOW} fill="#b4467e" opacity="0.28" />
        </g>
      ))}

      {/* Eyes. The blink scales an inner group so its CSS transform doesn't fight the mirror. */}
      <g className="wf-blink">
        {[0, 1].map((side) => (
          <g key={side} transform={side ? MIRROR : undefined}>
            <path d={EYE_WHITE} fill="#fbf7ff" />
          </g>
        ))}
        <g clipPath={`url(#${eyeClip})`}>
          {[0, 1].map((side) => (
            <g key={side} transform={side ? MIRROR : undefined}>
              {/* Iris tucked under the upper lid, pupil, the lid's shadow on the white. */}
              <ellipse cx="131" cy="121.5" rx="8.6" ry="10.8" fill={`url(#${irisId})`} />
              <ellipse cx="131" cy="121.5" rx="8.6" ry="10.8" fill="none" stroke={mix(eyeColor, '#000000', 0.6)} strokeWidth="1" />
              <ellipse cx="131" cy="122" rx="3.4" ry="5" fill="#120a20" />
              <path d={LID_SHADOW} fill="#3b1d5e" opacity="0.22" />
            </g>
          ))}
        </g>
        {[0, 1].map((side) => (
          <g key={side} transform={side ? MIRROR : undefined}>
            {/* Catchlights toward the upper-left light (same screen side on both eyes). */}
            <ellipse cx={side ? 134.5 : 127.5} cy="115.8" rx="3.1" ry="2.7" fill="#ffffff" />
            <circle cx={side ? 128.5 : 135} cy="126.2" r="1.2" fill="#ffffff" opacity="0.85" />
            <path d={UPPER_LASH} fill={LINE} />
            <path d={LASH_WING} fill={LINE} />
            <path d="M119 111.5 L113.5 106.2 M123.5 108.8 L119.6 103.6" stroke={LINE} strokeWidth="1.3" strokeLinecap="round" />
            <path d={LOWER_LASH} fill="none" stroke={LINE} strokeOpacity="0.7" strokeWidth="0.9" strokeLinecap="round" />
            <path d={LID_CREASE} fill="none" stroke={LINE} strokeOpacity="0.45" strokeWidth="0.9" strokeLinecap="round" />
            {/* Inner corner of the eye. */}
            <path d="M145.6 121.6 Q147.6 122.6 146 124.2" fill="none" stroke="#c97a7a" strokeWidth="1" strokeLinecap="round" />
          </g>
        ))}
      </g>

      {/* Blush: a soft wash with three quick hatch strokes on each cheek. */}
      {[0, 1].map((side) => (
        <g key={side} transform={side ? MIRROR : undefined}>
          <path d="M113 140 C116 135.5 128 135 132 139.5 C128 143.5 117 144 113 140 Z" fill="#ff7eb6" opacity="0.28" />
          <path d="M118 137.5 L116 141.5 M122 137.5 L120 141.5 M126 137.5 L124 141.5" stroke="#f0609a" strokeOpacity="0.55" strokeWidth="0.9" strokeLinecap="round" />
        </g>
      ))}

      {/* Nose: the tip, and its cel shadow on the side away from the light. */}
      <path d="M151.4 130 C153 134.6 154.6 138.2 153.8 141.2 C152.8 140.2 152 139.8 151 139.8 Z" fill="#d9826e" opacity="0.55" />
      <path d="M150.6 140.4 Q153.4 141.4 151.8 143" fill="none" stroke={SKIN_LINE} strokeWidth="1.1" strokeLinecap="round" />

      {/* Lips: a defined cupid's bow over a fuller lower lip, the mouth line darkest at the corners. */}
      <path d={UPPER_LIP} fill="#a61e52" />
      <path d={LOWER_LIP} fill={`url(#${lipId})`} />
      <path d="M141.6 152.4 Q146 153.8 150 153.5 Q154 153.8 158.4 152.4" fill="none" stroke="#5c0f30" strokeWidth="1" strokeLinecap="round" />
      <path d="M140.8 151.8 L142.2 152.8 M159.2 151.8 L157.8 152.8" stroke="#5c0f30" strokeOpacity="0.6" strokeWidth="0.8" strokeLinecap="round" />
      <path d="M145.6 155.6 Q148 154.9 150.2 155.5" fill="none" stroke="#ffffff" strokeOpacity="0.75" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M147 161.8 Q150 162.8 153 161.8" fill="none" stroke="#d9826e" strokeOpacity="0.6" strokeWidth="0.9" strokeLinecap="round" />

      {/* Pin-up beauty mark. */}
      <circle cx="163" cy="149.5" r="1.1" fill={LINE} />
    </g>
  );
}

function Hand() {
  return (
    <g fill="none" stroke={SKIN_LINE} strokeLinecap="round">
      {/* The fingers are part of the arm's contour; thin lines part them up to the knuckles. */}
      <path d="M66.9 360.4 Q66.8 358.4 66.4 356.8 M71.3 361 Q71.3 359 71 357.4 M76 361 Q76.1 359 75.9 357.2" strokeOpacity="0.5" strokeWidth="0.6" />
      {/* Knuckles: small highlights across the back of the hand. */}
      <path d="M64.4 354.6 Q65.6 353.6 66.8 354.4 M68.8 355.4 Q70.2 354.4 71.6 355.2 M73.6 355.4 Q75 354.4 76.4 355.2" stroke="#ffffff" strokeOpacity="0.4" strokeWidth="0.8" />
      {/* Nails on the fingertips that turn toward us. */}
      <path d="M68.4 368.4 Q69.6 369.6 70.8 368.6 M72.6 370.4 Q73.8 371.6 75 370.4 M77.4 368.4 Q78.6 369.4 79.6 368" strokeOpacity="0.45" strokeWidth="0.6" />
    </g>
  );
}

function Body() {
  return (
    <g>
      {[false, true].map((m) => (
        <g key={String(m)} transform={m ? MIRROR : undefined}>
          <Skin d={LEG} mirrored={m} />
          {/* Knee: the kneecap's lower edge and the dimple above it. */}
          <path d="M124 460 Q131 464 138 460 M127.5 449 Q131 447 135 449" fill="none" stroke={SKIN_LINE} strokeOpacity="0.45" strokeWidth="0.9" />
          {/* Form shading: inner-thigh shadow where the thighs meet, a shade under the kneecap, and a
              shin highlight on the lit leg (dimmer on the far one). */}
          <path d="M150 400 C147 412 145.4 428 146.6 444 C148 438 149.4 424 150 410 Z" fill={SKIN_SHADE} stroke="none" />
          <path d="M125 461.6 Q131 467 137.4 461.6 Q131 470 125 461.6 Z" fill={SKIN_SHADE} stroke="none" opacity="0.8" />
          <path d="M134 472 C135 490 134.6 508 132.6 526" fill="none" stroke="#ffffff" strokeOpacity={m ? 0.25 : 0.55} strokeWidth="2.2" strokeLinecap="round" />
          <path d="M108 420 C112 432 118 442 124 448" fill="none" stroke="#ffffff" strokeOpacity={m ? 0.2 : 0.45} strokeWidth="2" strokeLinecap="round" />
          <path d={TOES} fill="none" stroke={SKIN_LINE} strokeOpacity="0.6" strokeWidth="0.8" strokeLinecap="round" />
          {/* Big-toe nail, the tendon down the instep, and the ankle bones (inner one higher). */}
          <path d="M143 578 Q144.6 577 146 578" fill="none" stroke={SKIN_LINE} strokeOpacity="0.5" strokeWidth="0.6" />
          <path d="M138.5 560 Q141.6 566 143.6 573" fill="none" stroke={SKIN_LINE} strokeOpacity="0.25" strokeWidth="0.7" />
          <path d="M140 548 Q142 551 141 554.5 M128.6 551 Q127.6 554 128.8 557" fill="none" stroke={SKIN_LINE} strokeOpacity="0.4" strokeWidth="0.7" />
        </g>
      ))}
      {/* Cool rim light along the shadow-side calf and outer thigh. */}
      <g transform={MIRROR} fill="none" stroke="#dbeafe" strokeOpacity="0.7" strokeWidth="1.3" strokeLinecap="round">
        <path d="M115.8 470 C113.8 480 114.2 490 117.2 500" />
        <path d="M100.6 412 C104 420 108 428 112 434" />
      </g>
      {/* Contact shadows where the feet meet the floor. */}
      <ellipse cx="136" cy="581.4" rx="13" ry="2.2" fill="#000" opacity="0.3" />
      <ellipse cx="164" cy="581.4" rx="13" ry="2.2" fill="#000" opacity="0.3" />
    </g>
  );
}


/** Torso, arms and the base layer; `base` colours the sports bra and bike shorts. */
function UpperBody({ base }: { base: string }) {
  const BASE_FILL = base;
  const BASE_SHADE = mix(base, '#7a1f52', 0.35);
  const BASE_LINE = mix(base, '#2a0a1e', 0.62);
  const hipClip = useSvgId('hip');
  const armClip = useSvgId('arm');
  return (
    <g stroke={SKIN_LINE} strokeWidth="1.1" strokeLinejoin="round">
      {/* Below the knuckles the arm fades to a finer cel and contour drawn underneath it: at the arm's full depth
          the shadow and the heavy shadow-side line fray in the narrow gaps between the fingers. */}
      <defs>
        <clipPath id={hipClip} clipPathUnits="userSpaceOnUse"><rect x="60" y="344.8" width="90" height="40" /></clipPath>
        <linearGradient id={`${armClip}-g`} gradientUnits="userSpaceOnUse" x1="0" y1="351" x2="0" y2="361">
          <stop offset="0" stopColor="#fff" />
          <stop offset="1" stopColor="#000" />
        </linearGradient>
        <mask id={`${armClip}-a`} {...MASK_BOX}><rect x="-320" y="-120" width="940" height="840" fill={`url(#${armClip}-g)`} /></mask>
      </defs>
      {[false, true].map((m) => (
        <g key={String(m)} transform={m ? MIRROR : undefined}>
          <Skin d={THUMB} depth={0.35} mirrored={m} />
          <Cel d={ARM} fill={SKIN} shade="#d9826e" shadeOpacity={0.55} line={SKIN_LINE} depth={0.3} weight={0.8} mirrored={m} />
          <g mask={`url(#${armClip}-a)`}><Skin d={ARM} mirrored={m} /></g>
          <Hand />
          {/* Deltoid edge, elbow crease at the waistline, tendons on the back of the hand. */}
          <path d="M86.5 250 Q90 240 97 233" fill="none" strokeOpacity="0.3" strokeWidth="0.8" />
          <path d="M79.4 281.6 Q83.4 284.4 87.8 283" fill="none" strokeOpacity="0.45" strokeWidth="0.8" />
          {/* Forearm muscle: the brachioradialis swell turning toward the slimmer wrist. */}
          <path d="M77.6 290 C75.4 302 73.6 314 72.6 324" fill="none" strokeOpacity="0.18" strokeWidth="0.7" />
          <path d="M68.4 343 L67.6 351 M72 344 L71.6 352 M75.6 343.6 L75.8 351.6" fill="none" strokeOpacity="0.16" strokeWidth="0.6" strokeLinecap="round" />
          {/* Highlights down the outer edge of the upper arm and forearm, brighter on the lit arm. */}
          <path d="M97 204 C91 212 88.4 224 87.6 238 M80.6 290 C78.8 300 77 310 75.6 320" fill="none" stroke="#ffffff" strokeOpacity={m ? 0.2 : 0.5} strokeWidth="2" strokeLinecap="round" />
        </g>
      ))}
      <Skin d={NECK} depth={0.5} />
      {/* Chin shadow, neck tendons and the notch between the collarbones. */}
      <path d="M141 168 Q150 182 159 168 L159 178 Q150 188 141 178 Z" fill={SKIN_SHADE} stroke="none" opacity="0.85" />
      <Skin d={TORSO} />
      {/* Soft neck base: hide the torso's top contour so the neck flows into the chest, then the
          tendons converge into the notch between the collarbones. */}
      <path d="M137.6 187.6 Q150 197.4 162.4 187.6 L164 199.6 Q150 205 136 199.6 Z" fill={SKIN} stroke="none" />
      <path d="M143.4 180 Q145.6 189 148.6 197 M156.6 180 Q154.4 189 151.4 197" fill="none" strokeOpacity="0.16" />
      <path d="M137 194 Q141 197.6 146 198.4 M163 194 Q159 197.6 154 198.4" fill="none" stroke={SKIN_SHADE} strokeWidth="2.4" strokeLinecap="round" />
      {/* Trapezius: the slope from the neck down to each shoulder, over the torso's top edge. */}
      {[false, true].map((m) => (
        <g key={String(m)} transform={m ? MIRROR : undefined}>
          <path d="M141.4 170 C140.4 183 131 191 111 197.6 L122 201 L139 196 Z" fill={SKIN} stroke="none" />
          {m && <path d="M141.4 170 C140.4 183 131 191 111 197.6 L118 199.6 C130 195 137.6 189 140 180 Z" fill="#d9826e" fillOpacity="0.4" stroke="none" />}
          <path d="M141.4 170 C140.4 183 131 191 111 197.6" fill="none" strokeWidth={m ? 1.8 : 1.1} />
        </g>
      ))}
      <path d="M130 200 Q138 203 145 200 M155 200 Q162 203 170 200 M147.5 198 Q150 200 152.5 198" fill="none" strokeOpacity="0.4" />
      {/* Bust volumes sit in front of the collarbones; the sports bra neckline follows their curve. */}
      {[0, 1].map((side) => (
        <g key={side} transform={side ? MIRROR : undefined}>
          <Skin d={BUST} mirrored={!!side} depth={0.8} />
          <path d="M104 216 Q107 211 112 209" fill="none" stroke="#ffffff" strokeOpacity="0.55" strokeWidth="2.2" strokeLinecap="round" />
        </g>
      ))}
      {[false, true].map((m) => (
        <g key={String(m)} transform={m ? MIRROR : undefined}>
          {/* Skin patch over the hip where the torso and leg shapes meet, so the high leg cut shows no seam. */}
          <path d="M93.4 334 C90.4 340 89.6 346 89.6 352 C89.6 358 90 362 90.6 366 L150 378 L150 334 Z" fill={SKIN} stroke="none" />
          {/* Redraw the top of the leg over the patch so its contour and cel shadow run unbroken up to the leg cut. */}
          <g clipPath={`url(#${hipClip})`}><Skin d={LEG} mirrored={m} /></g>
          <path d="M89.2 343 L89.4 345.4" fill="none" strokeWidth={m ? 1.8 : 1.1} />
          <path d="M90 345 C102 350 124 360 141 373" fill="none" stroke={SKIN_SHADE} strokeWidth="4" strokeLinecap="round" />
        </g>
      ))}
      {/* Midriff form: the bra band's cast shadow, the waist turning away on the shadow side, a soft
          line down the centre and a highlight along the lit side of the waist. */}
      <path d="M121 276 Q150 282 179 276 L176.4 282 Q150 289 123.6 282 Z" fill={SKIN_SHADE} stroke="none" />
      <path d="M177 278 C172 288 173 298 186 312 L192 318 L183 318 C174 308 168 296 171.4 283 Z" fill={SKIN_SHADE} stroke="none" />
      <path d="M123 278 C128 288 127 298 114 312 L111 315 C120 304 124 294 121.6 284 Z" fill={SKIN_SHADE} stroke="none" opacity="0.6" />
      <path d="M150 284 L150 293" fill="none" strokeOpacity="0.18" strokeWidth="0.9" strokeLinecap="round" />
      <path d="M126.4 286 C127.6 294 125 302 118 310" fill="none" stroke="#ffffff" strokeOpacity="0.5" strokeWidth="2" strokeLinecap="round" />
      <path d="M150 296 Q148.6 300 150 304" fill="none" strokeOpacity="0.35" strokeWidth="1" strokeLinecap="round" />
      {/* Cool rim light on the shadow side: outer upper arm, forearm and waist. */}
      <g transform={MIRROR} fill="none" stroke="#dbeafe" strokeOpacity="0.7" strokeWidth="1.3" strokeLinecap="round">
        <path d="M87.2 228 C85.8 242 84.2 256 82.6 268 M74.2 300 C72.8 310 71.6 320 70.6 330" />
        <path d="M125.4 283 C128.6 291 128 299 119 309" />
      </g>
      <Cel d={SHORTS} fill={BASE_FILL} shade={BASE_SHADE} shadeOpacity={0.6} line={BASE_LINE} />
      <g fill="none" stroke={BASE_LINE} strokeLinecap="round">
        <path d="M108.6 325 Q150 331 191.4 325" strokeOpacity="0.45" />
        <path d="M150 352 L150 392" strokeOpacity="0.35" />
        <path d="M99.6 399 Q122 405 145 401.6 M155 401.6 Q178 405 200.4 399" strokeOpacity="0.4" />
      </g>
      {/* The shorts' hems cast a thin shadow round each thigh. */}
      <path d="M98.4 406 Q122 412 146 408 L146.4 412.4 Q123 416.6 100 411 Z M201.6 406 Q178 412 154 408 L153.6 412.4 Q177 416.6 200 411 Z" fill={SKIN_SHADE} stroke="none" />
      <g fill="none" stroke="#ffffff" strokeLinecap="round">
        <path d="M94 352 C94 366 96 380 100 392" strokeWidth="2.6" strokeOpacity="0.6" />
        <path d="M112 330 C108 336 104 342 102 348" strokeWidth="2" strokeOpacity="0.45" />
      </g>
      {[false, true].map((m) => (
        <g key={String(m)} transform={m ? MIRROR : undefined}>
          <Cel d={BRA_STRAP} fill={BASE_FILL} shade={BASE_SHADE} shadeOpacity={0.6} line={BASE_LINE} mirrored={m} weight={0.8} />
        </g>
      ))}
      <Cel d={SPORTS_BRA} fill={BASE_FILL} shade={BASE_SHADE} shadeOpacity={0.6} line={BASE_LINE} />
      <path d="M119 268 Q150 275 181 268" fill="none" stroke={BASE_LINE} strokeOpacity="0.45" strokeLinecap="round" />
      <g fill="none" stroke="#ffffff" strokeLinecap="round">
        <path d="M103 238 C103 227 109 219 119 216.5" strokeWidth="3" strokeOpacity="0.75" />
        <path d="M157 233 C159 225 165 220 173 218.5" strokeWidth="2.2" strokeOpacity="0.45" />
      </g>
      <BustShading upper={false} />
    </g>
  );
}

/** Contour lines that sell the curves; reused on top of every top. */
function BustShading({ opacity = 0.35, upper = true }: { opacity?: number; upper?: boolean }) {
  return (
    <g fill="none" stroke="#000" strokeOpacity={opacity} strokeWidth="1.4" strokeLinecap="round">
      {/* Upper curves give tops the same rounded shape as the bust underneath. */}
      {upper && <path d="M96 236 C96 220 104 208 116 206 C128 204.5 140 210 147 222" strokeOpacity={opacity * 0.6} />}
      {upper && <path d="M204 236 C204 220 196 208 184 206 C172 204.5 160 210 153 222" strokeOpacity={opacity * 0.6} />}
      {upper && <path d="M104 238 C104 227 110 219 120 216.5" stroke="#ffffff" strokeOpacity="0.5" strokeWidth="3" />}
      {upper && <path d="M158 233 C160 225 166 220 174 218.5" stroke="#ffffff" strokeOpacity="0.3" strokeWidth="2.2" />}
      <path d="M98 252 Q110 268 124 268 Q140 268 148 256" />
      <path d="M202 252 Q190 268 176 268 Q160 268 152 256" />
      <path d="M150 230 L150 246" strokeOpacity={opacity * 0.8} />
      <path d="M126 290 Q150 296 174 290" strokeOpacity={opacity * 0.5} />
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
      <Garment id="legwear" choice={choice} mirror={['M93 384 L149 384 L149 396 L96 396 Z']} />
      <path d={LEG} fill={`url(#${netId})`} />
      <path d={LEG} fill={`url(#${netId})`} transform={MIRROR} />
    </g>
  );
}

/** Hosiery reads as stretched knit: sheen down the shin, a lit kneecap, a reinforced toe, and an optional lace-topped welt. */
function HosieryDetails({ welt }: { welt?: number }) {
  return (
    <g fill="none" strokeLinecap="round">
      {[false, true].map((m) => (
        <g key={String(m)} transform={m ? MIRROR : undefined}>
          <path d="M124 372 C127 404 129 432 131.4 458 C133.4 496 133.6 528 134.4 556" stroke="#ffffff" strokeOpacity="0.22" strokeWidth="5" />
          <path d="M127 450 Q131.6 446.6 136.4 450" stroke="#ffffff" strokeOpacity="0.32" strokeWidth="3" />
          <path d="M126 570 Q136 566 147.4 572" stroke="#000" strokeOpacity="0.25" strokeWidth="1.2" />
          {welt !== undefined && (
            <g>
              <path d={`M${99} ${welt} L148.4 ${welt} L147.8 ${welt + 10} Q124 ${welt + 12} 101.6 ${welt + 9} Z`} fill="#000" fillOpacity="0.16" stroke="none" />
              <path d={`M101.6 ${welt + 9} Q124 ${welt + 12} 147.8 ${welt + 10}`} stroke="#000" strokeOpacity="0.35" />
              <path d={`M99.6 ${welt + 1} L148 ${welt + 1}`} stroke="#ffffff" strokeOpacity="0.9" strokeWidth="2.8" strokeDasharray="1.6 1.8" />
            </g>
          )}
        </g>
      ))}
    </g>
  );
}

const THIGH_HIGH = 'M98.6 404 L148.4 404 C147.6 416 146.8 425 146 432 C147.6 440 148 448 146.4 456 C145.4 462 145.6 468 146.4 478 C147 492 145 512 142.6 530 C141 540 140 548 140.8 554 C143.6 561 147.2 567 148 573 C148.6 577.4 147 581.2 143.6 581.4 L128 580.2 C125 579.2 124.4 574.4 126 567 C126.8 562 127.8 558 127.4 552 C127 536 120.4 516 114.6 500 C110.8 488 110.6 474 113 464 C114.6 458 117.4 453 117.4 448 C113 436 106 424 100 408 Z';

/** A sock: the stocking cut off at `top`, with a ribbed cuff band across the cut. */
function Sock({ choice, top }: { choice: GarmentChoice; top: number }) {
  const clipId = useSvgId('sock');
  const cuff = top < 500
    ? 'M113.2 466 L147 466 L146.8 474 L114.4 474 Z'
    : 'M127 548 L141.2 548 L140.8 554 L127.4 554 Z';
  return (
    <g>
      <defs><clipPath id={clipId}><rect x="0" y={top} width="300" height={600 - top} /></clipPath></defs>
      <g clipPath={`url(#${clipId})`}><Garment id="legwear" choice={choice} mirror={[LEG]} /></g>
      <Garment id="legwear-cuff" choice={choice} mirror={[cuff]}
        details={<g stroke="#000" strokeOpacity="0.22">{[0, 1].map((m) => (
          <g key={m} transform={m ? MIRROR : undefined}>
            {(top < 500 ? [118, 124, 130, 136, 142] : [130, 134, 138]).map((x) => <path key={x} d={`M${x} ${top + 1} L${x} ${top + (top < 500 ? 7 : 5)}`} />)}
          </g>
        ))}</g>} />
    </g>
  );
}

function Legwear({ choice }: { choice: GarmentChoice }) {
  const id = 'legwear';
  switch (choice.item) {
    case 'thighhighs':
      return <Garment id={id} choice={choice} mirror={[THIGH_HIGH]}
        details={<HosieryDetails welt={404} />} />;
    case 'stockings':
      return <Garment id={id} choice={choice} mirror={[LEG]} details={<HosieryDetails />} />;
    case 'fishnet':
      return <Fishnet choice={choice} />;
    case 'kneesocks':
      return <Sock choice={choice} top={466} />;
    case 'anklesocks':
      return <Sock choice={choice} top={548} />;
    case 'warmers':
      return <Garment id={id} choice={choice} mirror={['M113.6 468 L146.6 468 C147.6 490 145.4 516 142.4 552 L126.8 552 C125.6 534 121 516 116.6 498 C113.8 486 113.2 476 113.6 468 Z']}
        details={<g stroke="#000" strokeOpacity="0.25">{[480, 492, 504, 516, 528, 540].map((y) => <g key={y}><path d={`M119 ${y} L148 ${y}`} /><path d={`M181 ${y} L152 ${y}`} /></g>)}</g>} />;
    default:
      return null;
  }
}

function Shoes({ choice }: { choice: GarmentChoice }) {
  const id = 'shoes';
  switch (choice.item) {
    case 'platforms':
      return <Garment id={id} choice={choice} mirror={[
        'M126 566 C127 562 131 560 136 560 C141 560 145.5 562 147.6 567 C149.4 573 149 579 147.5 582 L125.6 582 C124 578 124.4 571 126 566 Z',
        'M124.4 581 L148.8 581 C149.6 584 149.4 588 148.6 590 L124.8 590 C124 588 123.8 584 124.4 581 Z']}
        details={<g fill="none" strokeLinecap="round">
          <path d="M129 566 Q133 563.4 138 563.6 M171 566 Q167 563.4 162 563.6" stroke="#ffffff" strokeOpacity="0.55" strokeWidth="1.6" />
          <path d="M124.6 585.4 L148.8 585.4 M175.4 585.4 L151.2 585.4" stroke="#000" strokeOpacity="0.35" strokeWidth="1" />
        </g>} />;
    case 'boots':
      return <Garment id={id} choice={choice} mirror={['M110.4 486 L147.4 486 C147.4 510 144 538 143 558 C147 564 150.6 572 150.4 580 C150.2 584 149.4 586.6 148 588 L124 588 C122.4 584 122.4 576 123.6 570 C124.4 564 123.4 560 121 554 C120 530 113.6 506 110.4 486 Z', 'M122.8 582 L150.6 582 C150.6 585 149.6 587.4 148 588.4 L124 588.4 C123 586.8 122.6 584.6 122.8 582 Z']}
        details={<g stroke="#000" strokeOpacity="0.45">{[500, 514, 528, 542].map((y) => <g key={y}><path d={`M126 ${y} L142 ${y + 6}`} /><path d={`M174 ${y} L158 ${y + 6}`} /></g>)}</g>} />;
    case 'sneakers':
      return <Garment id={id} choice={choice} mirror={['M125.4 562 C127 556 132 553 136 553.5 C141 553.6 145.2 556 147.4 562 C149.6 568 150 575 149 581 L124.4 581 C123.6 574 123.8 567 125.4 562 Z']}
        details={<g>
          {[false, true].map((m) => (
            <g key={String(m)} transform={m ? MIRROR : undefined} strokeLinecap="round">
              <path d="M123.6 579 L150 579 C150.8 581 150.6 584 149.6 585.4 L124 585.4 C123 584 122.8 581 123.6 579 Z" fill="#ffffff" stroke={LINE} strokeWidth="0.9" />
              <path d="M131 560.4 L141.4 562.4 M130.6 564.4 L141.8 566.4 M130.4 568.4 L142 570.4" stroke="#ffffff" strokeWidth="1.3" />
              <path d="M125 574.4 C130 571.8 143 571.8 149.2 574.4" fill="none" stroke="#000" strokeOpacity="0.3" />
            </g>
          ))}
        </g>} />;
    case 'sandals':
      // Thin sole, an ankle strap, a T-strap down the instep and a strap across the toes.
      return <Garment id={id} choice={choice} mirror={[
        'M124.2 579.4 L149 579.4 C149.8 581.4 149.6 584 148.8 585.4 L124.6 585.4 C123.8 583.8 123.6 581.4 124.2 579.4 Z',
        'M127 552.6 L141.2 552.6 L141.4 556.4 L126.8 556.4 Z',
        'M133.2 556 L136.4 556 L138.2 569 L135 569.4 Z',
        'M125.4 569 Q137 565.6 148.2 569.8 L148.4 573.6 Q137 569.8 125.2 573 Z']}
        details={<g>{[false, true].map((m) => (
          <circle key={String(m)} cx="140" cy="554.5" r="1.1" fill="#fde68a" stroke={LINE} strokeWidth="0.5" transform={m ? MIRROR : undefined} />
        ))}</g>} />;
    case 'flats':
      return <Garment id={id} choice={choice} mirror={[
        'M125.2 568 C127.6 565.4 131.8 564.6 136.6 564.6 C141.6 564.6 145.6 566 147.8 569 C149.6 574 149.2 579 147.6 582 L125.2 582 C123.8 578 124 572 125.2 568 Z']}
        details={<g>{[false, true].map((m) => (
          <g key={String(m)} transform={m ? MIRROR : undefined} stroke={LINE} strokeWidth="0.6">
            {/* Little bow at the toe line and a lit edge along the vamp. */}
            <path d="M136 567 L132.4 565 L132.4 569 Z M136 567 L139.6 565 L139.6 569 Z" fill="#000" fillOpacity="0.3" />
            <path d="M126.6 571 Q130 567.4 135 567" fill="none" stroke="#ffffff" strokeOpacity="0.5" strokeWidth="1.3" strokeLinecap="round" />
          </g>
        ))}</g>} />;
    case 'maryjanes':
      return <Garment id={id} choice={choice} mirror={[
        'M125.2 567 C127.4 563.4 131.6 562 136.4 562 C141.4 562 145.6 564 147.8 568 C149.6 573 149.2 579 147.6 582 L125.2 582 C123.8 578 124 571.6 125.2 567 Z',
        'M127.6 557.4 C132 559 137.4 559.6 142 558.6 L142.4 561.4 C137.6 562.4 132 561.8 127.2 560.2 Z']}
        details={<g>
          {[false, true].map((m) => (
            <g key={String(m)} transform={m ? MIRROR : undefined}>
              <circle cx="141" cy="560" r="1.4" fill="#fde68a" stroke={LINE} strokeWidth="0.6" />
              <path d="M124.8 580.6 L148.2 580.6 L147.8 583.6 L125.2 583.6 Z" fill="#000" fillOpacity="0.4" />
              <path d="M129 568 Q133 565.2 138 565.4" fill="none" stroke="#ffffff" strokeOpacity="0.55" strokeWidth="1.4" strokeLinecap="round" />
            </g>
          ))}
        </g>} />;
    default:
      return null;
  }
}

// Pleated hem: alternating knife-pleat points along a curve that dips at the front.
const PLEAT_HEM: [number, number][] = [...Array(13)].map((_, i) => {
  const x = 218 - i * (136 / 12);
  const t = (x - 150) / 68;
  return [x, 392 + 7 * (1 - t * t) + (i % 2 ? 3.4 : 0)];
});
const PLEATED = `M120 296 L180 296 C200 312 212 336 218 392 ${PLEAT_HEM.map(([x, y]) => `L${x.toFixed(1)} ${y.toFixed(1)}`).join(' ')} C88 336 100 312 120 296 Z`;
// Separate legs that split below the crotch and break over the foot.
const PANT_LEG = 'M89 344 L150 344 L150 372 C149 410 148 450 147.8 480 C147.6 510 148 540 149.4 566 Q136 570.4 121.2 566 C120 540 114 510 109.4 480 C106.8 444 96 404 90 372 Z';

function Bottom({ choice }: { choice: GarmentChoice }) {
  const id = 'bottom';
  switch (choice.item) {
    case 'pleated':
      return <Garment id={id} choice={choice} paths={[PLEATED]}
        details={<g fill="none" strokeLinecap="round">
          {PLEAT_HEM.slice(1, -1).map(([x, y], i) => (
            <path key={x} d={`M${(150 + (x - 150) * 0.45).toFixed(1)} 300 L${x.toFixed(1)} ${y.toFixed(1)}`}
              stroke={i % 2 ? '#ffffff' : '#000'} strokeOpacity={i % 2 ? 0.3 : 0.3} strokeWidth={i % 2 ? 1.4 : 1} />
          ))}
        </g>} />;
    case 'shorts':
      // Real shorts: two leg openings around the thighs, a waistband with a button, fly stitching and pockets.
      return <Garment id={id} choice={choice} paths={['M118 298 L182 298 C202 314 212 336 212 364 Q190 373 166 372 Q156 370 150 380 Q144 370 134 372 Q110 373 88 364 C88 336 98 314 118 298 Z']}
        details={<g fill="none" strokeLinecap="round">
          <path d="M118 298 L182 298 L185.6 306 Q150 311 114.4 306 Z" fill="#000" fillOpacity="0.18" stroke="#000" strokeOpacity="0.35" />
          <circle cx="150" cy="303.6" r="2" fill="#fde68a" stroke={LINE} strokeWidth="0.6" />
          <path d="M150 309 L150 346 Q152 354 158 358 M155 309 L155 346" stroke="#000" strokeOpacity="0.3" strokeDasharray="2 1.6" />
          {[false, true].map((m) => (
            <g key={String(m)} transform={m ? MIRROR : undefined} stroke="#000">
              <path d="M116 308 Q122 322 103 332" strokeOpacity="0.32" />
              <path d="M89 360 Q111 368.6 134 367.6 Q145 366 149.4 374" strokeOpacity="0.3" strokeWidth="1.6" />
              <path d="M138 352 Q144 360 148 372" strokeOpacity="0.18" />
            </g>
          ))}
        </g>} />;
    case 'mini':
      return <Garment id={id} choice={choice} paths={['M118 294 L182 294 C200 312 212 336 210 358 L207 384 Q150 398 93 384 L90 358 C88 336 100 312 118 294 Z']}
        details={<g fill="none" stroke="#000" strokeLinecap="round">
          <path d="M150 342 L150 391" strokeOpacity="0.4" />
          {/* Tension folds pull from the hips toward the centre where the skirt stretches over the thighs. */}
          {[false, true].map((m) => (
            <g key={String(m)} transform={m ? MIRROR : undefined}>
              <path d="M100 336 Q114 334 126 342 M96 352 Q112 350 128 358" strokeOpacity="0.2" strokeWidth="1" />
              <path d="M94 384 Q120 392 146 391.4" strokeOpacity="0.25" strokeWidth="1.8" />
            </g>
          ))}
        </g>} />;
    case 'gown':
      return <Garment id={id} choice={choice} paths={['M120 288 L180 288 C200 312 212 336 210 362 C206 420 190 470 196 520 Q208 554 230 568 Q214 577 198 572 Q184 583 166 577 Q150 587 134 577 Q116 583 102 572 Q86 577 70 568 Q92 554 104 520 C110 470 94 420 90 362 C88 336 100 312 120 288 Z']}
        details={<g fill="none" stroke="#000" strokeOpacity="0.18" strokeWidth="2" strokeLinecap="round">
          {/* Each fold runs down into a trough of the wavy hem. */}
          <path d="M128 330 Q118 450 102 571" /><path d="M172 330 Q182 450 198 571" />
          <path d="M140 420 Q136 500 134 576" strokeWidth="1.4" /><path d="M160 420 Q164 500 166 576" strokeWidth="1.4" />
          <path d="M150 300 Q146 430 150 584" stroke="#fff" strokeOpacity="0.22" strokeWidth="3" />
        </g>} />;
    case 'tutu':
      // Two tiers of tulle flaring from the waistband, each with a scalloped hem.
      return <Garment id={id} choice={choice} paths={[
        'M120 300 L180 300 C206 314 226 336 238 366 Q226 375 213 369 Q199 380 184 372 Q167 382 150 374 Q133 382 116 372 Q101 380 87 369 Q74 375 62 366 C74 336 94 314 120 300 Z',
        'M120 300 L180 300 C200 312 214 330 222 352 Q210 360 198 354 Q184 364 168 357 Q150 366 132 357 Q116 364 102 354 Q90 360 78 352 C86 330 100 312 120 300 Z',
        'M118 294 L182 294 L183.6 303 Q150 307 116.4 303 Z']}
        details={<g fill="none" stroke="#000" strokeOpacity="0.16" strokeLinecap="round">
          {[96, 116, 136, 164, 184, 204].map((x) => <path key={x} d={`M${150 + (x - 150) * 0.4} 306 L${x} ${358 + Math.abs(x - 150) * 0.05}`} />)}
          <path d="M80 350 Q150 344 220 350" stroke="#ffffff" strokeOpacity="0.3" strokeWidth="2" />
        </g>} />;
    case 'aline':
      return <Garment id={id} choice={choice} paths={['M118 294 L182 294 C200 312 212 336 212 358 C216 390 222 420 228 452 Q150 468 72 452 C78 420 84 390 88 358 C88 336 100 312 118 294 Z']}
        details={<g fill="none" stroke="#000" strokeLinecap="round">
          {/* Soft folds fan out from the hips toward the hem. */}
          <path d="M108 362 Q98 410 90 455 M192 362 Q202 410 210 455 M132 372 Q126 420 122 460 M168 372 Q174 420 178 460" strokeOpacity="0.18" strokeWidth="1.4" />
          <path d="M150 300 Q148 380 150 462" stroke="#ffffff" strokeOpacity="0.25" strokeWidth="3" />
          <path d="M118 294 L182 294 L184 302 Q150 306 116 302 Z" fill="#000" fillOpacity="0.15" strokeOpacity="0.3" />
        </g>} />;
    case 'pants':
      return <Garment id={id} choice={choice} paths={['M118 294 L182 294 C200 312 212 336 210 352 L150 356 L90 352 C88 336 100 312 118 294 Z']}
        mirror={[PANT_LEG]}
        details={<g fill="none" stroke="#000" strokeLinecap="round">
          {[false, true].map((m) => (
            <g key={String(m)} transform={m ? MIRROR : undefined}>
              {/* Pressed crease, knee drag and the break where the hem pools on the foot. */}
              <path d="M128 372 Q129 470 135 566" strokeOpacity="0.18" strokeWidth="1.2" />
              <path d="M146.6 372 Q140 390 134 398 M120 456 Q130 461 144 456 M121 470 Q130 473.6 143 470" strokeOpacity="0.22" />
              <path d="M124 556 Q134 552 146 557" strokeOpacity="0.25" />
            </g>
          ))}
        </g>} />;
    default:
      return null;
  }
}

// Tops follow the hourglass: bust to ~y266, waist at ~y280.
// Sleeves hug the deltoid and end in a hem that curves around the arm, not a flat cut.
const SLEEVE_SHORT = 'M118 198 C98 200 88 212 85 230 C83.6 238 81.4 246 79.4 254 Q90 259.4 102.6 251 C103 244 103.6 238 104.4 232 Z';
const SLEEVE_LONG = 'M118 198 C98 200 88 212 85 230 C82 248 78.6 266 76.6 280 C75.4 290 73 298 70.8 306 C68.8 318 66 330 64.6 340 Q72.8 344 81.6 341.6 C83 330 85.4 316 87.4 304 C89 296 90.4 292 91.4 288 C94 270 98.6 252 104.4 238 Z';

/** Drag lines from the armpit, the hem's inner shadow, and (long) the bunching at the elbow and a cuff. */
function SleeveFolds({ long = false }: { long?: boolean }) {
  return (
    <g fill="none" stroke="#000" strokeLinecap="round">
      {[false, true].map((m) => (
        <g key={String(m)} transform={m ? MIRROR : undefined}>
          <path d="M102 234 Q95.6 240 92.4 249" strokeOpacity="0.28" strokeWidth="1" />
          {long ? (
            <g>
              <path d="M78.6 280.6 Q83 284.4 89.6 282 M77.8 289.6 Q81.6 292.2 87.6 290.4 M75 300 Q79 302.6 84.6 300" strokeOpacity="0.32" strokeWidth="0.9" />
              <path d="M72 318 Q77 321 83.6 317.6" strokeOpacity="0.22" strokeWidth="0.8" />
              <path d="M65.4 333.4 Q73.6 337.6 82.4 335" strokeOpacity="0.4" strokeWidth="1" />
              <path d="M65 336.6 Q73 340.6 82 338.2" stroke="#ffffff" strokeOpacity="0.35" strokeWidth="1.4" />
            </g>
          ) : (
            <path d="M81.6 250.6 Q90.6 254.6 101.6 247.8" strokeOpacity="0.25" strokeWidth="1.6" />
          )}
        </g>
      ))}
    </g>
  );
}

function Top({ choice }: { choice: GarmentChoice }) {
  const id = 'top';
  switch (choice.item) {
    case 'tank':
      // Narrow straps, a scooped front and a hem that stops just above the navel.
      return <Garment id={id} choice={choice}
        paths={['M116 199 L125 197.6 Q150 236 175 197.6 L184 199 C200 210 206 230 202 250 C198 264 184 272 178 280 C175 287 175 292 176.6 296 Q150 302 123.4 296 C125 292 125 287 122 280 C116 272 102 264 98 250 C94 230 100 210 116 199 Z']}
        details={<g fill="none" strokeLinecap="round">
          <path d="M124 296.6 Q150 303 176 296.6 L174.6 301 Q150 307 125.4 301 Z" fill="#000" fillOpacity="0.25" stroke="none" />
          <path d="M125 197.6 Q150 236 175 197.6" stroke={LINE} strokeWidth="2.4" />
          <path d="M104 238 C104 227 110 219 120 216.5" stroke="#ffffff" strokeOpacity="0.45" strokeWidth="3" />
        </g>} />;
    case 'tube':
      return <Garment id={id} choice={choice}
        paths={['M95.6 231 C99.6 214 112 208 124 210 C136 212 146 218 150 230 C154 218 164 212 176 210 C188 208 200.4 214 204.4 231 C204.4 242 203 247 202 252 C198 264 186 270 178 274 Q150 280 122 274 C114 270 102 264 98 252 C97 247 95.6 242 95.6 231 Z']}
        details={<g fill="none" strokeLinecap="round">
          <path d="M98 236 Q150 230 202 236 M98.6 246 Q150 240 201.4 246 M100 256 Q150 250 200 256" stroke="#000" strokeOpacity="0.14" />
          <path d="M104 236 C104 226 110 219 120 216" stroke="#ffffff" strokeOpacity="0.5" strokeWidth="3" />
        </g>} />;
    case 'crop':
      return <Garment id={id} choice={choice}
        // Scoop-neck tee: ribbed neckband, fabric bridging between the bust, and a hem that casts a shadow on the waist.
        paths={['M116 196 C124 193 130 192 134 192 Q150 232 166 192 C170 192 176 193 184 196 C200 208 206 230 202 250 C199 260 190 266 182 270 Q150 276 118 270 C110 266 101 260 98 250 C94 230 100 208 116 196 Z']}
        mirror={[SLEEVE_SHORT]} details={<g fill="none" strokeLinecap="round">
          <path d="M120 271 Q150 278 180 271 L178 276.6 Q150 283.6 122 276.6 Z" fill="#000" fillOpacity="0.3" stroke="none" />
          <path d="M134 192 Q150 232 166 192" stroke={LINE} strokeWidth="3.4" />
          <path d="M134 192 Q150 232 166 192" stroke="#ffffff" strokeOpacity="0.55" strokeWidth="1.6" strokeDasharray="0.8 1.4" />
          <path d="M119 266 Q150 272 181 266" stroke="#000" strokeOpacity="0.25" />
          {[false, true].map((m) => (
            <g key={String(m)} transform={m ? MIRROR : undefined} stroke="#000">
              {/* Drag lines from the bust apex up to the shoulder seam and out to the armpit. */}
              <path d="M124 222 Q120 210 119 200 M114 226 Q108 222 104 214" strokeOpacity="0.2" />
            </g>
          ))}
          <path d="M140 250 Q150 247.6 160 250 M142 258 Q150 256 158 258" stroke="#000" strokeOpacity="0.18" />
          <SleeveFolds />
          <BustShading opacity={0.3} />
        </g>} />;
    case 'bikini':
      return <Garment id={id} choice={choice}
        // Triangle cups on thin halter strings that taper up to the neck, joined by a ring at the centre.
        mirror={['M98 232 C104 216 124 210 136 214 Q145 220 149 234 L149 252 C145 263 134 269 121 268 C107 267 99 258 97 246 Z', 'M125 215 Q130.6 200.6 139 188.4 L141.4 190 Q133.6 201.6 128.4 216.6 Z']}
        details={<g>
          <g fill="none" stroke="#000" strokeLinecap="round">
            {[false, true].map((m) => (
              <g key={String(m)} transform={m ? MIRROR : undefined}>
                {/* Gather seam from the strap down the cup, and the cup's lower band. */}
                <path d="M127 216 Q125 240 123 266" strokeOpacity="0.22" />
                <path d="M100 252 Q110 264 124 266 Q138 266 147.6 256" strokeOpacity="0.3" strokeWidth="1.6" />
              </g>
            ))}
          </g>
          <circle cx="150" cy="239" r="3.4" fill="none" stroke="#fde68a" strokeWidth="1.8" />
          <circle cx="150" cy="239" r="3.4" fill="none" stroke={LINE} strokeWidth="0.6" />
          <BustShading opacity={0.25} />
        </g>} />;
    case 'corset':
      return <Garment id={id} choice={choice}
        // Overbust-free waist cincher: lace trim on top, boning that follows the curve, a pointed busk at the front.
        paths={['M98 240 Q124 258 150 246 Q176 258 202 240 C202 258 184 270 177 278 C172 288 173 298 186 314 Q168 316 150 326 Q132 316 114 314 C127 298 128 288 123 278 C116 270 98 258 98 240 Z']}
        details={<g fill="none" strokeLinecap="round">
          {[false, true].map((m) => (
            <g key={String(m)} transform={m ? MIRROR : undefined} stroke="#000">
              <path d="M112 254 C124 268 126 284 121 300" strokeOpacity="0.25" />
              <path d="M126 256 C134 272 134 292 128 314" strokeOpacity="0.25" />
              <path d="M139 252 C142 272 142 296 140 318" strokeOpacity="0.2" />
            </g>
          ))}
          {/* Lace edge along the neckline. */}
          <path d="M98 240 Q124 258 150 246 Q176 258 202 240" stroke="#ffffff" strokeOpacity="0.85" strokeWidth="2.6" strokeDasharray="1.4 2.2" />
          {/* Modesty panel showing between the laced edges, then grommets and the criss-cross lace. */}
          <path d="M145 252 L155 252 L155 318 L150 322 L145 318 Z" fill="#000" fillOpacity="0.28" stroke="none" />
          <path d={[256, 266, 276, 286, 296, 306].map((y) => `M145 ${y} L155 ${y + 10} M155 ${y} L145 ${y + 10}`).join(' ')} stroke="#ffffff" strokeOpacity="0.85" strokeWidth="1.1" />
          {[256, 266, 276, 286, 296, 306].map((y) => (
            <g key={y}>
              <circle cx="145" cy={y} r="1.3" fill="#e5e7eb" stroke={LINE} strokeWidth="0.5" />
              <circle cx="155" cy={y} r="1.3" fill="#e5e7eb" stroke={LINE} strokeWidth="0.5" />
            </g>
          ))}
          <BustShading opacity={0.3} upper={false} />
        </g>} />;
    case 'sailor':
      // Nautical pin-up halter: tied under the bust, bare midriff.
      return <Garment id={id} choice={choice}
        paths={['M116 196 C130 189 170 189 184 196 C200 208 206 230 202 250 C199 262 190 270 182 276 Q150 284 118 276 C110 270 101 262 98 250 C94 230 100 208 116 196 Z']}
        mirror={[SLEEVE_SHORT]}
        details={<g>
          {/* Pin-up nautical halter (not a school collar): navy piping on a plunging neckline and a gold anchor. */}
          <path d="M124 193 Q136 214 150 236 Q164 214 176 193" fill="none" stroke="#1e3a5f" strokeWidth="3.2" />
          <path d="M124 193 Q136 214 150 236 Q164 214 176 193" fill="none" stroke="#ffffff" strokeWidth="0.9" />
          <g transform="translate(150 252)" fill="none" stroke="#fde68a" strokeWidth="1.6" strokeLinecap="round">
            <path d="M0 -6 L0 6 M-3.4 -3 L3.4 -3 M-5 2 Q-4 7 0 7 Q4 7 5 2" />
            <circle cx="0" cy="-7.6" r="1.6" />
          </g>
          {/* The halter ties in a knot under the bust. */}
          <path d="M150 278 Q143 284 139 294 L144 293 Q147 286 150 282 Q153 286 156 293 L161 294 Q157 284 150 278 Z" fill={choice.color} stroke={LINE} strokeWidth="0.9" />
          <ellipse cx="150" cy="278.6" rx="4.4" ry="3.4" fill={choice.color} stroke={LINE} strokeWidth="0.9" />
          <SleeveFolds />
          <BustShading opacity={0.3} />
        </g>} />;
    case 'kimono':
      return <Garment id={id} choice={choice}
        // The robe follows the hourglass under the obi; the furisode sleeves hang from the forearm.
        paths={['M114 194 C130 186 170 186 186 194 C202 212 208 236 204 256 C200 266 186 272 180 280 C178 290 180 300 192 314 C206 328 214 342 214 358 Q182 366 150 362 Q118 366 86 358 C86 342 94 328 108 314 C120 300 122 290 120 280 C114 272 100 266 96 256 C92 236 98 212 114 194 Z']}
        mirror={['M118 198 C94 202 84 220 80 244 C76 270 70 300 64.6 336 Q73 340 82 336 C85 345 91 351 99 353 Q106 354 106.6 346 L105.6 240 Z']}
        details={<g>
          <g fill="none" stroke="#000" strokeLinecap="round">
            {[false, true].map((m) => (
              <g key={String(m)} transform={m ? MIRROR : undefined}>
                <path d="M92 254 Q87 292 89 334 M99.6 262 Q97.6 304 100.4 348" strokeOpacity="0.22" strokeWidth="1.1" />
                <path d="M83 338 Q88 347 99 350" strokeOpacity="0.3" />
                <path d="M110 320 Q100 334 96 356 M124 324 Q122 342 124 362" strokeOpacity="0.16" strokeWidth="1.1" />
              </g>
            ))}
          </g>
          {/* Collar: the left panel crosses over the right, both edged in a white eri. */}
          <g fill="none">
            <path d="M128 192 Q137 222 153 250" stroke={LINE} strokeOpacity="0.55" strokeWidth="4.6" />
            <path d="M128 192 Q137 222 153 250" stroke="#ffffff" strokeWidth="3" />
            <path d="M172 192 Q165 234 140 274" stroke={LINE} strokeOpacity="0.55" strokeWidth="4.6" />
            <path d="M172 192 Q165 234 140 274" stroke="#ffffff" strokeWidth="3" />
            <path d="M169 200 Q163 236 141 268" stroke="#000" strokeOpacity="0.15" strokeWidth="1.4" />
          </g>
          <path d="M150 286 Q148 324 150 362" fill="none" stroke="#000" strokeOpacity="0.3" />
          {/* Obi cinches the waist to keep the hourglass, tied off with a gold cord. */}
          <path d="M120 272 Q150 280 180 272 L181 300 Q150 307 119 300 Z" fill="#1e1b4b" stroke={LINE} />
          <path d="M121 278 Q150 285 179 278" fill="none" stroke="#ffffff" strokeOpacity="0.18" strokeWidth="2" />
          <path d="M119.6 287.4 Q150 294 180.4 287.4" fill="none" stroke="#fde68a" strokeWidth="1.6" />
          <circle cx="150" cy="290.6" r="2.4" fill="#fde68a" stroke={LINE} strokeWidth="0.7" />
          <BustShading opacity={0.25} />
        </g>} />;
    case 'jacket':
      return <Garment id={id} choice={choice}
        mirror={['M115 195 C128 189 140 189 147 191 L142 268 Q121 269 102 258 C94 236 100 210 115 195 Z', SLEEVE_LONG]}
        details={<g>
          {/* Notched lapels folded back over each front panel, rolling to a point at the front edge. */}
          {[false, true].map((m) => (
            <g key={String(m)} transform={m ? MIRROR : undefined}>
              <path d="M146.6 191 L141 240 L120 213 L126.6 210 L121 202.6 Q132 194 146.6 191 Z" fill="#000" fillOpacity="0.14" stroke={LINE} strokeWidth="1" strokeLinejoin="round" />
              <path d="M144.4 197 L140 232" fill="none" stroke="#ffffff" strokeOpacity="0.35" strokeWidth="1.2" />
              <path d="M141.6 268 Q122 268.6 103 258.6" fill="none" stroke="#000" strokeOpacity="0.3" strokeWidth="1.6" />
            </g>
          ))}
          <SleeveFolds long />
        </g>} />;
    default:
      return null;
  }
}

/** The head is drawn at 0.8 scale around the chin so the body reads ~7 heads tall. */
const HEAD_SCALE = 'translate(150 180) scale(0.8) translate(-150 -184)';

function Accessory({ item, color }: { item: string; color: string }) {
  const visorId = useSvgId('visor');
  switch (item) {
    case 'bow':
      return <g>
        <Cel d="M118 62 C104 46 90 50 93 63 C96 75 110 71 118 62 Z" fill={color} line={LINE} depth={0.5} />
        <Cel d="M118 62 C130 46 145 49 142 62 C139 74 126 71 118 62 Z" fill={color} line={LINE} depth={0.5} />
        <path d="M116 64 L109 82 L114.6 79 L117 85 L119.6 66 Z M120 64 L127 82 L121.6 79.6 L119 85 Z" fill={color} stroke={LINE} strokeWidth="1" />
        <circle cx="118" cy="62.4" r="4.4" fill={mix(color, '#000000', 0.18)} stroke={LINE} strokeWidth="1.1" />
        <path d="M97 58 Q101 52 107 52 M131 52 Q137 52 139.6 57" fill="none" stroke="#ffffff" strokeOpacity="0.55" strokeWidth="1.6" strokeLinecap="round" />
      </g>;
    case 'tiara':
      return <g stroke={LINE} strokeWidth="1" strokeLinejoin="round">
        <path d="M114 70 Q150 56 186 70 L183 75 Q150 63 117 75 Z" fill="#fde68a" />
        <path d="M128 66.4 L133 50 L138.4 62.6 L144 58 L150 38 L156 58 L161.6 62.6 L167 50 L172 66.4 Q150 59 128 66.4 Z" fill="#fde68a" />
        <circle cx="150" cy="56" r="3.8" fill={color} />
        <circle cx="133" cy="60.6" r="2" fill={color} />
        <circle cx="167" cy="60.6" r="2" fill={color} />
        <path d="M148.6 54.6 L149.6 53.8 M131 66 Q150 59.6 169 66" fill="none" stroke="#ffffff" strokeOpacity="0.75" strokeWidth="1.2" strokeLinecap="round" />
      </g>;
    case 'glasses':
      return <g fill="none" strokeLinecap="round">
        {[false, true].map((m) => (
          <g key={String(m)} transform={m ? MIRROR : undefined}>
            <circle cx="131" cy="121" r="17" fill="#ffffff" fillOpacity="0.12" stroke={color} strokeWidth="3" />
            <circle cx="131" cy="121" r="18.6" stroke={LINE} strokeWidth="0.9" />
            <path d="M114 117 L100 113" stroke={color} strokeWidth="2.6" />
            <path d="M121 109 Q126 106 131 106" stroke="#ffffff" strokeOpacity="0.6" strokeWidth="1.6" />
          </g>
        ))}
        <path d="M147.6 118 Q150 114.6 152.4 118" stroke={color} strokeWidth="2.6" />
      </g>;
    case 'flowers':
      // Daisies along a leafy band over the crown, small at the sides and largest at the top.
      return <g stroke={LINE} strokeWidth="0.9">
        <path d="M104 80 Q150 50 196 80" fill="none" stroke="#4d7c0f" strokeWidth="3" />
        {[[106, 78, 5], [120, 66, 6.4], [135, 59, 7.2], [150, 57, 8], [165, 59, 7.2], [180, 66, 6.4], [194, 78, 5]].map(([x, y, r]) => (
          <g key={x} transform={`translate(${x} ${y})`}>
            {[0, 72, 144, 216, 288].map((a) => <ellipse key={a} cx="0" cy={-r * 0.6} rx={r * 0.42} ry={r * 0.62} fill={color} transform={`rotate(${a})`} />)}
            <circle r={r * 0.36} fill="#fde68a" />
          </g>
        ))}
      </g>;
    case 'catears':
      return <g fill="#1a1a2e" stroke={LINE} strokeWidth="1.5">
        {[false, true].map((m) => (
          <g key={String(m)} transform={m ? MIRROR : undefined}>
            <path d="M105 75 C102.6 60 103.4 42 108 30 C119 37 130 47 139 58 Z" />
            <path d="M112 65 C110.8 56 111 48 113.4 42 C120 46.6 126 52.6 130.6 58 Z" fill={color} />
            <path d="M107 50 C107 42 108 36 109.4 33" fill="none" stroke="#ffffff" strokeOpacity="0.4" strokeWidth="1.4" />
          </g>
        ))}
      </g>;
    case 'halo':
      // A gold torus: soft glow, inked edge, lit top rim and a shaded underside.
      return <g className="wf-float" fill="none" strokeLinecap="round">
        <ellipse cx="150" cy="32" rx="42" ry="11.5" stroke="#fde68a" strokeOpacity="0.25" strokeWidth="13" />
        <ellipse cx="150" cy="32" rx="40" ry="10" stroke={LINE} strokeWidth="7" />
        <ellipse cx="150" cy="32" rx="40" ry="10" stroke="#fde68a" strokeWidth="5" />
        <path d="M113 37.6 Q150 46 187 37.6" stroke="#d4a017" strokeWidth="2.2" />
        <path d="M116 25.6 Q150 18.6 184 25.6" stroke="#ffffff" strokeWidth="1.6" strokeOpacity="0.9" />
        <path d="M124 41 L128 41.6" stroke="#ffffff" strokeWidth="1.6" />
      </g>;
    case 'visor':
      // Wraparound visor that follows the face, a tinted lens with glare streaks and LED earpieces.
      return <g>
        <defs>
          <linearGradient id={visorId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#00f0ff" stopOpacity="0.7" />
            <stop offset="1" stopColor="#ff007f" stopOpacity="0.55" />
          </linearGradient>
        </defs>
        <path d="M100 112 Q150 100 200 112 L198 127 Q174 137 150 131 Q126 137 102 127 Z" fill={`url(#${visorId})`} stroke="#0f172a" strokeWidth="2" />
        <path d="M100 112 Q150 100 200 112" fill="none" stroke="#1e293b" strokeWidth="4" strokeLinecap="round" />
        <path d="M122 108.6 L113 128.4 M131 107.4 L123.4 129.6" stroke="#ffffff" strokeOpacity="0.55" strokeWidth="2.6" strokeLinecap="round" />
        <path d="M170 107.4 L166 116" stroke="#ffffff" strokeOpacity="0.4" strokeWidth="1.6" strokeLinecap="round" />
        <path d="M106 121 Q150 112 194 121" fill="none" stroke="#ffffff" strokeOpacity="0.7" className="wf-twinkle" />
        {[false, true].map((m) => (
          <g key={String(m)} transform={m ? MIRROR : undefined}>
            <rect x="94" y="108" width="8" height="16" rx="2.4" fill="#1e293b" stroke={LINE} strokeWidth="1" />
            <circle cx="98" cy="119" r="1.4" fill="#00f0ff" className="wf-flicker" />
          </g>
        ))}
      </g>;
    case 'headphones':
      return <g>
        <path d="M98 118 C94 40 206 40 202 118" fill="none" stroke="#111" strokeWidth="7" />
        <path d="M112 66 C126 50 148 46 166 50" fill="none" stroke="#ffffff" strokeOpacity="0.35" strokeWidth="2" strokeLinecap="round" />
        {[false, true].map((m) => (
          <g key={String(m)} transform={m ? MIRROR : undefined}>
            <path d="M96 112 L97 100 L102 100 L102.6 112 Z" fill="#2a2a33" stroke={LINE} strokeWidth="1" />
            <Cel d="M90.6 106 C86.6 111 85.6 133 90.6 140 L101 140 C104.6 133 104.6 112 101 106 Z" fill={color} line={LINE} mirrored={m} depth={0.6} />
            <path d="M101 107.6 C104.6 113 104.8 132 101.4 138.6 L105.6 138 C108.2 132 108.2 113 105.4 108 Z" fill="#2a2a33" stroke={LINE} strokeWidth="0.9" />
            <ellipse cx="95" cy="123" rx="4" ry="9" fill="none" stroke="#ffffff" strokeOpacity="0.45" strokeWidth="1.2" />
            <path d="M89.6 114 C89 120 89 126 89.6 131" fill="none" stroke="#ffffff" strokeOpacity="0.6" strokeWidth="1.6" strokeLinecap="round" />
          </g>
        ))}
      </g>;
    default:
      return null;
  }
}

/** Drawn in body space (not head space) so it wraps the middle of the neck. */
function Choker({ color }: { color: string }) {
  return (
    <g stroke={LINE} strokeWidth="1">
      <path d="M139.6 181 Q150 185.5 160.4 181 L160.8 188 Q150 192.5 139.2 188 Z" fill="#111" />
      <path d="M141 183 Q150 187 159 183" fill="none" stroke="#ffffff" strokeOpacity="0.25" />
      <path d="M150 190 L150 193" />
      <circle cx="150" cy="195.5" r="3.2" fill={color} />
      <circle cx="149" cy="194.5" r="1" fill="#ffffff" stroke="none" opacity="0.8" />
    </g>
  );
}

/** Fairy wings sit behind the whole figure, translucent so the scene shows through. */
function Wings({ color }: { color: string }) {
  return (
    <g className="wf-sway" style={{ transformOrigin: '150px 250px' }} stroke={mix(color, '#000000', 0.55)} strokeWidth="1.4" strokeLinejoin="round">
      {[false, true].map((m) => (
        <g key={String(m)} transform={m ? MIRROR : undefined}>
          <path d="M146 236 C118 168 52 140 30 168 C14 192 50 236 128 252 Z" fill={color} fillOpacity="0.5" />
          <path d="M146 258 C108 262 58 290 64 326 C70 352 118 330 144 274 Z" fill={color} fillOpacity="0.42" />
          <path d="M140 240 C110 210 74 184 44 176 M138 246 C104 236 70 224 46 204 M140 266 C114 280 90 300 74 322" fill="none" strokeOpacity="0.45" strokeWidth="0.9" />
          <path d="M40 170 C52 160 72 162 90 172" fill="none" stroke="#ffffff" strokeOpacity="0.6" strokeWidth="2" strokeLinecap="round" />
        </g>
      ))}
    </g>
  );
}

/** Extras worn over the outfit (wings are drawn separately, behind the body). */
function Extra({ item, color }: { item: string; color: string }) {
  const dark = mix(color, '#000000', 0.55);
  switch (item) {
    case 'bag':
      // Cross-body strap from her right shoulder down to a small bag on the opposite hip.
      return <g strokeLinejoin="round">
        <path d="M122 198 C140 236 166 282 190 322" fill="none" stroke={LINE} strokeWidth="5.4" strokeLinecap="round" />
        <path d="M122 198 C140 236 166 282 190 322" fill="none" stroke={dark} strokeWidth="3.4" strokeLinecap="round" />
        <Cel d="M178 320 C178 316 181 314 185 314 L207 314 C211 314 214 316 214 320 L215 346 C215 350 212 352 208 352 L184 352 C180 352 177 350 177 346 Z" fill={color} line={LINE} depth={0.6} />
        <path d="M177.6 322 Q196 334 214.4 322 L214.4 318 Q196 330 177.6 318 Z" fill="#000" fillOpacity="0.2" />
        <circle cx="196" cy="329.4" r="2.2" fill="#fde68a" stroke={LINE} strokeWidth="0.7" />
        <path d="M181 340 L181 347" stroke="#ffffff" strokeOpacity="0.5" strokeWidth="1.6" strokeLinecap="round" />
      </g>;
    case 'scarf':
      return <g stroke={LINE} strokeWidth="1.1" strokeLinejoin="round">
        <Cel d="M136 192 L124 256 L141 258 L147 200 Z" fill={color} line={LINE} depth={0.6} />
        <Cel d="M136 182 Q150 192 164 182 L169 197 Q150 211 131 197 Z" fill={color} line={LINE} depth={0.6} />
        <path d="M125 257 L124 264 M129 257.6 L128.4 265 M133 258 L132.6 265.6 M137 258.4 L136.8 266 M140.6 258.6 L140.6 266" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
        <path d="M134 190 Q150 200 166 190 M140 214 L133 250" fill="none" stroke="#000" strokeOpacity="0.2" />
        <path d="M134 186 Q141 192 148 194" fill="none" stroke="#ffffff" strokeOpacity="0.5" strokeWidth="1.6" strokeLinecap="round" />
      </g>;
    case 'bangles':
      return <g fill="none" strokeLinecap="round">
        {[false, true].map((m) => (
          <g key={String(m)} transform={m ? MIRROR : undefined}>
            {[330, 335.4].map((y) => (
              <g key={y}>
                <ellipse cx="74.4" cy={y} rx="7.4" ry="2.4" stroke={LINE} strokeWidth="3.4" />
                <ellipse cx="74.4" cy={y} rx="7.4" ry="2.4" stroke={color} strokeWidth="2" />
              </g>
            ))}
            <path d="M68 330.4 Q70 332 73 332.4" stroke="#ffffff" strokeOpacity="0.7" strokeWidth="1" />
          </g>
        ))}
      </g>;
    case 'wand':
      // Held in her left hand: a slim stick angled up and out to a star.
      return <g strokeLinejoin="round">
        <path d="M226 366 L246 296" stroke={LINE} strokeWidth="4.4" strokeLinecap="round" />
        <path d="M226 366 L246 296" stroke="#fde68a" strokeWidth="2.4" strokeLinecap="round" />
        <path d="M247 276 L251.4 287.6 L263.6 288 L254 295.6 L257.4 307.4 L247 300.4 L236.6 307.4 L240 295.6 L230.4 288 L242.6 287.6 Z" fill={color} stroke={LINE} strokeWidth="1.3" />
        <path d="M241 289.6 L246 285" stroke="#ffffff" strokeOpacity="0.7" strokeWidth="1.6" strokeLinecap="round" />
        <g className="wf-twinkle" fill="#fde68a"><path d={SPARKLE} transform="translate(266 276) scale(0.6)" /><path d={SPARKLE} transform="translate(230 280) scale(0.45)" /></g>
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
  const key = (g: GarmentChoice) => `${g.item}-${g.material}-${g.color}`;
  const accentColor = outfit.accessory.color ?? ACCENT_COLOR;
  const extra = outfit.extra ?? { item: 'none', color: ACCENT_COLOR };
  return (
    <svg viewBox="0 0 300 600" className={`wf-root ${className ?? ''}`} role="img" aria-label="Dress-up character">
      <style>{ANIM_CSS}</style>
      <Scene category={outfit.scene} />
      <g className="wf-breathe">
        <g transform={HEAD_SCALE}><HairBack item={outfit.hair.item} color={outfit.hair.color} /></g>
      </g>
      {extra.item === 'wings' && <Pop k={`wings-${extra.color}`}><Wings color={extra.color} /></Pop>}
      <Body />
      <Pop k={key(outfit.legwear)}><Legwear choice={outfit.legwear} /></Pop>
      <Pop k={key(outfit.shoes)}><Shoes choice={outfit.shoes} /></Pop>
      {/* Layers, back to front: wings, body, torso and base sports bra and shorts, bottom, top, choker, extras, head. */}
      <g className="wf-breathe">
        <UpperBody base={outfit.base ?? BASE_COLOR} />
        <Pop k={key(outfit.bottom)}><Bottom choice={outfit.bottom} /></Pop>
        <Pop k={key(outfit.top)}><Top choice={outfit.top} /></Pop>
        {outfit.accessory.item === 'choker' && <Pop k="choker"><Choker color={accentColor} /></Pop>}
        {extra.item !== 'wings' && <Pop k={`${extra.item}-${extra.color}`}><Extra item={extra.item} color={extra.color} /></Pop>}
        <g transform={HEAD_SCALE}>
          <Skin d={HEAD} depth={0.8} />
          {/* Face form: the jaw turning away from the light, and the side locks' cast shadow on each cheek. */}
          <path d="M197 128 C195 146 185 160 168 171 C180 160 188 148 191 132 Z" fill="#d9826e" opacity="0.32" />
          <path d="M111 134 C108 150 108.4 164 112.4 175 L117 171 C114 160 113.6 147 115.6 136 Z" fill="#d9826e" opacity="0.22" />
          <path d="M189 134 C192 150 191.6 164 187.6 175 L183 171 C186 160 186.4 147 184.4 136 Z" fill="#d9826e" opacity="0.32" />
          <Face eyeColor={eyeColor} />
          <Pop k={`${outfit.hair.item}-${outfit.hair.color}`}><HairFront item={outfit.hair.item} color={outfit.hair.color} /></Pop>
          <Brows />
          <Pop k={`${outfit.accessory.item}-${accentColor}`}><Accessory item={outfit.accessory.item} color={accentColor} /></Pop>
        </g>
      </g>
      {celebrate && <Sparkles />}
    </svg>
  );
}
