// Geometry shared by the foil pack openers: a jagged tear along the printed
// tear strip, and the foil confetti thrown off when it snaps.

export const FOIL_TEAR_Y = 11.5; // % from the top, matches .fp-tear
export const FOIL_TEAR_EDGE = Array.from({ length: 15 }, (_, i) => {
  const x = (i / 14) * 100;
  const y = FOIL_TEAR_Y + (i % 2 === 0 ? -0.9 : 0.9) + Math.sin(i * 1.7) * 0.6;
  return `${x.toFixed(1)}% ${y.toFixed(2)}%`;
});
export const FOIL_STRIP_CLIP = `polygon(0 0, 100% 0, ${[...FOIL_TEAR_EDGE].reverse().join(', ')})`;
export const FOIL_BODY_CLIP = `polygon(${FOIL_TEAR_EDGE.join(', ')}, 100% 100%, 0 100%)`;

export const FOIL_CONFETTI = Array.from({ length: 22 }, (_, i) => ({
  x: 4 + ((i * 37) % 92),
  dx: ((i * 53) % 120) - 60,
  dy: -60 - ((i * 29) % 110),
  rot: ((i * 71) % 540) - 270,
  w: 3 + (i % 4),
  h: 5 + ((i * 3) % 6),
  hue: (i * 47) % 360,
  delay: (i % 6) * 0.015,
}));
