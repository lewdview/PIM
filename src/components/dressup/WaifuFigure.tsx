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
const ARM = 'M118 198 C98 200 88 212 85 230 C82 248 79 266 77.5 280 C76 290 74 297 72 306 C70 318 67.6 330 66.2 338 C63 344 61.8 350 62.4 356 Q71 358.6 80.6 355.6 C81 350 80.6 345 79.8 341 C81.5 330 84 316 86 304 C87.6 296 89 292 90 288 C93 270 98 252 104 238 Z';
// Relaxed hanging hand (her right; mirrored for the left), seen from the front with the palm to
// the thigh: the back of the hand, four fingers in length order (middle > ring >= index > little,
// little finger on the outside), knuckles on an arc, and the thumb in front on the inner side.
const FINGERS = [
  'M62.6 352.6 C62 357 62 361.6 63.2 364.2 C64.4 365.6 66 364.8 66.4 362 C66.8 359 66.8 356 66.6 353 C65.6 351.2 63.4 351.2 62.6 352.6 Z', // little
  'M66.6 353 C66 359 66.2 364.6 67.6 367.8 C68.8 369.4 70.6 368.8 71 366 C71.4 362 71.2 357 71 353.4 C70 351.4 67.6 351.4 66.6 353 Z', // ring
  'M71 353.4 C70.6 359 71 365 72.4 368.8 C73.6 370.6 75.4 370 75.8 367 C76 362.6 75.8 357.6 75.6 353.2 C74.6 351.4 72 351.4 71 353.4 Z', // middle
  'M75.6 353 C75.6 358.4 76 363 77.2 366 C78.4 367.6 80 367 80.4 364.4 C80.8 360.6 80.6 356 80.4 352.6 C79.4 350.8 76.6 350.8 75.6 353 Z', // index
];
const THUMB = 'M79.6 345 C82.4 348 83.2 353 81.6 357.6 C80.6 360 78.2 359.6 78 357.4 C78.4 353.6 78.2 350 77 347 Z';
// Leg and foot in one contour, front view. Outer calf swells high, inner calf low; the knee is the
// narrow point; the ankle tapers to the malleoli; the foot flares to five toes, big toe inside.
const LEG = 'M92 344 L150 344 C150.5 372 148.5 404 146 432 C147.6 440 148 448 146.4 456 C145.4 462 145.6 468 146.4 478 C147 492 145 512 142.6 530 C141.6 540 141 548 141.6 554 C143.6 561 147.2 567 148 573 C148.6 577.4 147 581.2 143.6 581.4 C142.2 581.4 141.4 580.8 141 580 C140 581.6 137.6 581.8 136.8 580.2 C135.8 581.4 133.4 581.4 132.6 579.8 C131.6 580.8 129.4 580.6 128.8 579.2 C127.4 579.8 125 579.2 124.8 577.4 C124.4 574.4 125.4 570.4 126 567 C126.8 562 127.8 558 127.4 552 C126.4 534 121.5 516 117 498 C114 486 113.4 474 115 464 C116 458 116.6 454 116 448 C113 436 106 424 100 408 C92 390 89 366 92 344 Z';
// One rounded bust volume (left; mirrored for the right). It is drawn over the chest and
// collarbones so the upper curve reads as sitting in front of them.
// A gravity teardrop, not a circle: the upper pole slopes off the chest wall below the collarbone,
// the fullness sits low and outside, then the fold turns under and rises to the sternum.
const BUST = 'M150 238 C149 226 144 214 134 208 C126 203.5 116 203 108 207 C99 212 94.5 224 94.5 238 C94.5 254 104 266 120 267.5 C134 268.5 146 261 149.5 250 C150.3 246 150.4 242 150 238 Z';
// Base layer: a plain, featureless strapless leotard so the figure is never undressed.
const BODYSUIT = 'M96 232 C100 216 112 210 124 212 C136 214 146 220 150 232 C154 220 164 214 176 212 C188 210 200 216 204 232 C204 242 203 246 202 250 C198 264 182 270 177 278 C172 288 173 298 186 312 C202 326 212 340 210 352 L208 360 Q180 362 160 368 L140 368 Q120 362 92 360 L90 352 C88 340 98 326 114 312 C127 298 128 288 123 278 C118 270 102 264 98 250 Z';
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
      <Cel d={cap} fill={p.fill} line={p.stroke} />
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
    <g>
      {FINGERS.map((d) => <Skin key={d} d={d} depth={0.35} />)}
      {/* Nails on the fingertips that turn toward us. */}
      <path d="M67.9 366.6 Q69 367.8 70.2 366.8 M72.4 368.4 Q73.6 369.6 74.8 368.6 M77.4 365.4 Q78.6 366.4 79.6 365.4" fill="none" stroke={SKIN_LINE} strokeOpacity="0.45" strokeWidth="0.6" strokeLinecap="round" />
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
          <path d={TOES} fill="none" stroke={SKIN_LINE} strokeOpacity="0.6" strokeWidth="0.8" strokeLinecap="round" />
          {/* Big-toe nail, the tendon down the instep, and the ankle bones (inner one higher). */}
          <path d="M143 578 Q144.6 577 146 578" fill="none" stroke={SKIN_LINE} strokeOpacity="0.5" strokeWidth="0.6" />
          <path d="M138.5 560 Q141.6 566 143.6 573" fill="none" stroke={SKIN_LINE} strokeOpacity="0.25" strokeWidth="0.7" />
          <path d="M140 548 Q142 551 141 554.5 M128.6 551 Q127.6 554 128.8 557" fill="none" stroke={SKIN_LINE} strokeOpacity="0.4" strokeWidth="0.7" />
        </g>
      ))}
      {/* Contact shadows where the feet meet the floor. */}
      <ellipse cx="136" cy="581.4" rx="13" ry="2.2" fill="#000" opacity="0.3" />
      <ellipse cx="164" cy="581.4" rx="13" ry="2.2" fill="#000" opacity="0.3" />
    </g>
  );
}

function UpperBody() {
  return (
    <g stroke={SKIN_LINE} strokeWidth="1.1" strokeLinejoin="round">
      {[false, true].map((m) => (
        <g key={String(m)} transform={m ? MIRROR : undefined}>
          <Skin d={ARM} mirrored={m} />
          <Hand />
          {/* Deltoid edge, elbow crease at the waistline, tendons on the back of the hand. */}
          <path d="M86.5 250 Q90 240 97 233" fill="none" strokeOpacity="0.3" strokeWidth="0.8" />
          <path d="M80 283 Q83.5 285.5 87.5 284" fill="none" strokeOpacity="0.45" strokeWidth="0.8" />
          <path d="M68 346 L67 354 M72 347 L71.6 355.4 M76 346.4 L76.2 355" fill="none" strokeOpacity="0.18" strokeWidth="0.6" strokeLinecap="round" />
          <Skin d={THUMB} depth={0.35} mirrored={m} />
        </g>
      ))}
      <Skin d={NECK} depth={0.5} />
      {/* Chin shadow, neck tendons and the notch between the collarbones. */}
      <path d="M141 168 Q150 182 159 168 L159 178 Q150 188 141 178 Z" fill={SKIN_SHADE} stroke="none" opacity="0.85" />
      <path d="M143 180 Q145 188 148 195 M157 180 Q155 188 152 195" fill="none" strokeOpacity="0.22" />
      <Skin d={TORSO} />
      {/* Trapezius: the slope from the neck down to each shoulder, over the torso's top edge. */}
      {[false, true].map((m) => (
        <g key={String(m)} transform={m ? MIRROR : undefined}>
          <path d="M141.4 170 C140.4 183 131 191 111 197.6 L122 201 L139 196 Z" fill={SKIN} stroke="none" />
          {m && <path d="M141.4 170 C140.4 183 131 191 111 197.6 L118 199.6 C130 195 137.6 189 140 180 Z" fill="#d9826e" fillOpacity="0.4" stroke="none" />}
          <path d="M141.4 170 C140.4 183 131 191 111 197.6" fill="none" strokeWidth={m ? 1.8 : 1.1} />
        </g>
      ))}
      <path d="M130 200 Q138 203 145 200 M155 200 Q162 203 170 200 M147.5 198 Q150 200 152.5 198" fill="none" strokeOpacity="0.4" />
      {/* Bust volumes sit in front of the collarbones; the leotard neckline follows their curve. */}
      {[0, 1].map((side) => (
        <g key={side} transform={side ? MIRROR : undefined}>
          <Skin d={BUST} mirrored={!!side} depth={0.8} />
          <path d="M104 216 Q107 211 112 209" fill="none" stroke="#ffffff" strokeOpacity="0.55" strokeWidth="2.2" strokeLinecap="round" />
        </g>
      ))}
      <Cel d={BODYSUIT} fill="#2b2140" shade="#0d0716" shadeOpacity={0.55} line="#150e22" />
      <g fill="none" stroke="#7b67a6" strokeLinecap="round">
        <path d="M103 238 C103 227 109 219 119 216.5" strokeWidth="3" strokeOpacity="0.75" />
        <path d="M157 233 C159 225 165 220 173 218.5" strokeWidth="2.2" strokeOpacity="0.45" />
        <path d="M99 336 C103 325 109 318 116 313" strokeWidth="2.6" strokeOpacity="0.55" />
        <path d="M129 284 C128 292 128 298 131 304" strokeWidth="1.6" strokeOpacity="0.35" />
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

const THIGH_HIGH = 'M98.6 404 L148.4 404 C147.6 416 146.8 425 146 432 C147.6 440 148 448 146.4 456 C145.4 462 145.6 468 146.4 478 C147 492 145 512 142.6 530 C141.6 540 141 548 141.6 554 C143.6 561 147.2 567 148 573 C148.6 577.4 147 581.2 143.6 581.4 L128 580.2 C125 579.2 124.4 574.4 126 567 C126.8 562 127.8 558 127.4 552 C126.4 534 121.5 516 117 498 C114 486 113.4 474 115 464 C116 458 116.6 454 116 448 C113 436 106 424 100 408 Z';

function Legwear({ choice }: { choice: GarmentChoice }) {
  const id = 'legwear';
  switch (choice.item) {
    case 'thighhighs':
      return <Garment id={id} choice={choice} mirror={[THIGH_HIGH]}
        details={<g stroke="#000" strokeOpacity="0.35" strokeWidth="4"><path d="M100 408 L149 408" /><path d="M200 408 L151 408" /></g>} />;
    case 'stockings':
      return <Garment id={id} choice={choice} mirror={[LEG]} />;
    case 'fishnet':
      return <Fishnet choice={choice} />;
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
      return <Garment id={id} choice={choice} mirror={['M112.6 486 L147.4 486 C147.4 510 144 538 143 558 C147 564 150.6 572 150.4 580 C150.2 584 149.4 586.6 148 588 L124 588 C122.4 584 122.4 576 123.6 570 C124.4 564 123.4 560 121 554 C120 530 115 506 112.6 486 Z', 'M122.8 582 L150.6 582 C150.6 585 149.6 587.4 148 588.4 L124 588.4 C123 586.8 122.6 584.6 122.8 582 Z']}
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

function Bottom({ choice }: { choice: GarmentChoice }) {
  const id = 'bottom';
  switch (choice.item) {
    case 'pleated':
      return <Garment id={id} choice={choice} paths={['M120 296 L180 296 C200 312 212 336 218 392 Q150 404 82 392 C88 336 100 312 120 296 Z']}
        details={<g stroke="#000" strokeOpacity="0.28">{[92, 110, 128, 150, 172, 190, 208].map((x) => <path key={x} d={`M${150 + (x - 150) * 0.45} 302 L${x} 394`} />)}</g>} />;
    case 'shorts':
      return <Garment id={id} choice={choice} paths={['M118 298 L182 298 C202 314 212 336 212 364 Q182 372 158 374 L142 374 Q118 372 88 364 C88 336 98 314 118 298 Z']}
        details={<path d="M150 302 L150 360" stroke="#000" strokeOpacity="0.3" />} />;
    case 'mini':
      return <Garment id={id} choice={choice} paths={['M118 294 L182 294 C200 312 212 336 210 358 L206 384 Q150 394 94 384 L90 358 C88 336 100 312 118 294 Z']}
        details={<path d="M150 342 L150 390" stroke="#000" strokeOpacity="0.4" />} />;
    case 'gown':
      return <Garment id={id} choice={choice} paths={['M120 288 L180 288 C200 312 212 336 210 362 C206 420 190 470 196 520 Q208 554 230 568 Q150 590 70 568 Q92 554 104 520 C110 470 94 420 90 362 C88 336 100 312 120 288 Z']}
        details={<g fill="none" stroke="#000" strokeOpacity="0.18" strokeWidth="2"><path d="M128 330 Q118 450 112 560" /><path d="M172 330 Q182 450 188 560" /><path d="M150 300 Q146 430 160 578" stroke="#fff" strokeOpacity="0.22" strokeWidth="3" /></g>} />;
    case 'pants':
      return <Garment id={id} choice={choice} paths={['M118 294 L182 294 C200 312 212 336 210 352 L150 356 L90 352 C88 336 100 312 118 294 Z']}
        mirror={['M90 344 L150 344 L148 450 Q150 510 158 560 L116 560 Q118 500 110 450 Q90 396 90 344 Z']} />;
    default:
      return null;
  }
}

// Tops follow the hourglass: bust to ~y266, waist at ~y280.
const SLEEVE_SHORT = 'M118 198 C98 200 88 212 85 230 L83 246 L101 250 L104 226 Z';
const SLEEVE_LONG = 'M118 198 C98 200 88 212 85 230 L73 300 L88 303 L104 238 Z';

function Top({ choice }: { choice: GarmentChoice }) {
  const id = 'top';
  switch (choice.item) {
    case 'crop':
      return <Garment id={id} choice={choice}
        paths={['M116 196 C130 189 170 189 184 196 C200 208 206 230 202 250 C199 260 190 266 182 270 Q150 276 118 270 C110 266 101 260 98 250 C94 230 100 208 116 196 Z']}
        mirror={[SLEEVE_SHORT]} details={<BustShading opacity={0.3} />} />;
    case 'bikini':
      return <Garment id={id} choice={choice}
        mirror={['M98 232 C104 216 124 210 136 214 Q145 220 149 234 L149 252 C145 263 134 269 121 268 C107 267 99 258 97 246 Z', 'M124 214 L137 190 L140 192 L128 216 Z']}
        details={<g><path d="M147 238 L153 238" stroke={choice.color} strokeWidth="3" /><BustShading opacity={0.25} /></g>} />;
    case 'corset':
      return <Garment id={id} choice={choice}
        paths={['M98 240 Q124 258 150 246 Q176 258 202 240 C202 258 184 270 177 278 C172 288 173 298 186 314 Q150 322 114 314 C127 298 128 288 123 278 C116 270 98 258 98 240 Z']}
        details={<g>
          <g stroke="#ffffff" strokeOpacity="0.7" strokeWidth="1.2">{[258, 272, 286, 300].map((y) => <path key={y} d={`M144 ${y} L156 ${y + 8} M156 ${y} L144 ${y + 8}`} />)}</g>
          <BustShading opacity={0.3} />
        </g>} />;
    case 'sailor':
      // Nautical pin-up halter: tied under the bust, bare midriff.
      return <Garment id={id} choice={choice}
        paths={['M116 196 C130 189 170 189 184 196 C200 208 206 230 202 250 C199 262 190 270 182 276 Q150 284 118 276 C110 270 101 262 98 250 C94 230 100 208 116 196 Z']}
        mirror={[SLEEVE_SHORT]}
        details={<g>
          <path d="M122 194 L150 232 L178 194 L194 214 L150 244 L106 214 Z" fill="#ffffff" stroke={LINE} />
          <path d="M112 212 L150 238 L188 212" fill="none" stroke={choice.color} strokeWidth="2" />
          <path d="M150 272 L134 296 L150 286 L166 296 Z" fill="#ef4444" stroke={LINE} />
          <BustShading opacity={0.3} />
        </g>} />;
    case 'kimono':
      return <Garment id={id} choice={choice}
        paths={['M114 194 C130 186 170 186 186 194 C202 212 208 236 204 258 L208 352 L92 352 L96 258 C92 236 98 212 114 194 Z']}
        mirror={['M118 198 C88 206 70 248 62 290 L60 338 L92 330 L104 238 Z']}
        details={<g>
          <path d="M128 194 L150 254 L172 194" fill="none" stroke="#ffffff" strokeOpacity="0.8" strokeWidth="4" />
          {/* Obi cinches the waist to keep the hourglass. */}
          <path d="M122 270 Q150 278 178 270 L176 298 Q150 304 124 298 Z" fill="#1e1b4b" stroke={LINE} />
          <path d="M150 274 L150 301" stroke="#fde68a" strokeWidth="3" />
          <BustShading opacity={0.25} />
        </g>} />;
    case 'jacket':
      return <Garment id={id} choice={choice}
        mirror={['M115 195 C128 189 140 189 147 191 L141 266 L102 258 C94 236 100 210 115 195 Z', SLEEVE_LONG]}
        details={<g stroke="#000" strokeOpacity="0.4"><path d="M141 204 L129 232" /><path d="M159 204 L171 232" /></g>} />;
    default:
      return null;
  }
}

/** The head is drawn at 0.8 scale around the chin so the body reads ~7 heads tall. */
const HEAD_SCALE = 'translate(150 180) scale(0.8) translate(-150 -184)';

function Accessory({ item }: { item: string }) {
  switch (item) {
    case 'catears':
      return <g fill="#1a1a2e" stroke={LINE} strokeWidth="1.5">
        {[false, true].map((m) => (
          <g key={String(m)} transform={m ? MIRROR : undefined}>
            <path d="M105 75 C102.6 60 103.4 42 108 30 C119 37 130 47 139 58 Z" />
            <path d="M112 65 C110.8 56 111 48 113.4 42 C120 46.6 126 52.6 130.6 58 Z" fill="#ff7eb6" />
            <path d="M107 50 C107 42 108 36 109.4 33" fill="none" stroke="#ffffff" strokeOpacity="0.4" strokeWidth="1.4" />
          </g>
        ))}
      </g>;
    case 'halo':
      return <g className="wf-float"><ellipse cx="150" cy="32" rx="40" ry="10" fill="none" stroke="#fde68a" strokeWidth="5" opacity="0.95" /><ellipse cx="150" cy="32" rx="40" ry="10" fill="none" stroke="#fff" strokeWidth="1.5" opacity="0.8" /></g>;
    case 'visor':
      return <g><rect x="104" y="108" width="92" height="24" rx="11" fill="#00f0ff" opacity="0.5" stroke="#0f172a" strokeWidth="2" /><path d="M112 114 L188 114" stroke="#ffffff" strokeOpacity="0.8" className="wf-twinkle" /></g>;
    case 'headphones':
      return <g>
        <path d="M98 118 C94 40 206 40 202 118" fill="none" stroke="#111" strokeWidth="7" />
        <path d="M112 66 C126 50 148 46 166 50" fill="none" stroke="#ffffff" strokeOpacity="0.35" strokeWidth="2" strokeLinecap="round" />
        {[false, true].map((m) => (
          <g key={String(m)} transform={m ? MIRROR : undefined}>
            <path d="M96 112 L97 100 L102 100 L102.6 112 Z" fill="#2a2a33" stroke={LINE} strokeWidth="1" />
            <Cel d="M90.6 106 C86.6 111 85.6 133 90.6 140 L101 140 C104.6 133 104.6 112 101 106 Z" fill="#ff007f" line={LINE} mirrored={m} depth={0.6} />
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
function Choker() {
  return (
    <g stroke={LINE} strokeWidth="1">
      <path d="M139.6 181 Q150 185.5 160.4 181 L160.8 188 Q150 192.5 139.2 188 Z" fill="#111" />
      <path d="M141 183 Q150 187 159 183" fill="none" stroke="#ffffff" strokeOpacity="0.25" />
      <path d="M150 190 L150 193" />
      <circle cx="150" cy="195.5" r="3.2" fill="#ff007f" />
      <circle cx="149" cy="194.5" r="1" fill="#ffffff" stroke="none" opacity="0.8" />
    </g>
  );
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
  return (
    <svg viewBox="0 0 300 600" className={`wf-root ${className ?? ''}`} role="img" aria-label="Dress-up character">
      <style>{ANIM_CSS}</style>
      <Scene category={outfit.scene} />
      <g className="wf-breathe">
        <g transform={HEAD_SCALE}><HairBack item={outfit.hair.item} color={outfit.hair.color} /></g>
      </g>
      <Body />
      <Pop k={key(outfit.legwear)}><Legwear choice={outfit.legwear} /></Pop>
      <Pop k={key(outfit.shoes)}><Shoes choice={outfit.shoes} /></Pop>
      {/* Layers, back to front: torso and base leotard, bottom, top, choker, head. */}
      <g className="wf-breathe">
        <UpperBody />
        <Pop k={key(outfit.bottom)}><Bottom choice={outfit.bottom} /></Pop>
        <Pop k={key(outfit.top)}><Top choice={outfit.top} /></Pop>
        {outfit.accessory.item === 'choker' && <Pop k="choker"><Choker /></Pop>}
        <g transform={HEAD_SCALE}>
          <Skin d={HEAD} depth={0.8} />
          <Face eyeColor={eyeColor} />
          <Pop k={`${outfit.hair.item}-${outfit.hair.color}`}><HairFront item={outfit.hair.item} color={outfit.hair.color} /></Pop>
          <Brows />
          <Pop k={outfit.accessory.item}><Accessory item={outfit.accessory.item} /></Pop>
        </g>
      </g>
      {celebrate && <Sparkles />}
    </svg>
  );
}
