// Overcooked-style camera: orthographic, facing straight ahead (yaw 0), tilted from above (pitch 55°).
// Arena world: x to the right, y toward the viewer (bottom of screen), z up. Unit = 1 tile.
// Colorfigures figures are loaded with ?yaw=0&pitch=55 so the angle matches.
export const PITCH = 55;
const rad = (PITCH * Math.PI) / 180;
export const SP = Math.sin(rad);
export const CP = Math.cos(rad);
export const UNIT = 48; // px per tile (width)

export const px = (x: number) => x * UNIT;
export const py = (y: number, z = 0) => (y * SP - z * CP) * UNIT;
/** Draw order: the closer to the viewer (larger y), the further in front. */
export const zIndex = (y: number) => Math.round(y * 10) + 10;

/** Colorfigures-style palette (l light, m medium, d dark) + Monad purple. */
export const PALET = {
  ungu: { l: '#b3a4ff', m: '#836ef9', d: '#2e2461' },
  mustard: { l: '#f4b829', m: '#d49c1f', d: '#4e4a18' },
  tomato: { l: '#ef6a4c', m: '#cf5038', d: '#4a2219' },
  mint: { l: '#93d3b0', m: '#71b693', d: '#1f4034' },
  cobalt: { l: '#76a0e2', m: '#5a82c6', d: '#1c2948' },
  blush: { l: '#f3a6bb', m: '#d8869c', d: '#4b2430' },
} as const;
export type NamaPalet = keyof typeof PALET;
export const TINTA = '#231e16';
export const KERTAS = '#f2efe7';
