import { TIERS } from '../core/tiers';
import { rng } from '../core/rng';

/**
 * Every body is drawn in code (no image files), once per size, into a small canvas that is
 * then stamped and rotated each frame.
 */

const cache = new Map<string, HTMLCanvasElement>();

export type Theme = 'space' | 'sea' | 'gems' | 'sweets';

/** Names of the 11 tiers in each theme (space names live in core/tiers.ts). */
export const THEME_NAMES: Record<Theme, string[]> = {
  space: TIERS.map(t => t.name),
  sea: ['Bubble', 'Shell', 'Shrimp', 'Clownfish', 'Pufferfish', 'Crab', 'Octopus', 'Turtle', 'Dolphin', 'Shark', 'Whale'],
  gems: ['Quartz', 'Amethyst', 'Topaz', 'Citrine', 'Aquamarine', 'Peridot', 'Garnet', 'Sapphire', 'Emerald', 'Ruby', 'Diamond'],
  sweets: ['Sprinkle', 'Candy', 'Lollipop', 'Cookie', 'Cupcake', 'Donut', 'Chocolate', 'Pudding', 'Cake Slice', 'Birthday Cake', 'Wedding Cake'],
};
export const THEME_LABEL: Record<Theme, string> = { space: 'Space', sea: 'Sea creatures', gems: 'Gemstones', sweets: 'Sweets' };
export const FINALE_NAME: Record<Theme, string> = { space: 'Supernova', sea: 'Tidal Wave', gems: 'Crown Jewel', sweets: 'Sugar Rush' };

const EMOJI: Record<'sea' | 'sweets', string[]> = {
  sea: ['🫧', '🐚', '🦐', '🐠', '🐡', '🦀', '🐙', '🐢', '🐬', '🦈', '🐳'],
  sweets: ['✨', '🍬', '🍭', '🍪', '🧁', '🍩', '🍫', '🍮', '🍰', '🎂', '💒'],
};
const BUBBLE: Record<'sea' | 'sweets', string[][]> = {
  sea: [['#e8fbff', '#7fd3f0'], ['#fff1e6', '#f2a97c'], ['#ffe2e2', '#f07a7a'], ['#fff0d6', '#f0a03c'], ['#fff8d0', '#e0c040'], ['#ffe0d8', '#e0603c'],
    ['#f6e0ff', '#a060d0'], ['#e0ffe8', '#3fae6a'], ['#e0f0ff', '#4a8fe0'], ['#e8eef4', '#6f8597'], ['#dfeaff', '#3459b8']],
  sweets: [['#fff6fb', '#ffb3d9'], ['#ffe6f2', '#ff6fae'], ['#fff0e0', '#ff9a5a'], ['#fff4dc', '#d79a4e'], ['#fde8ff', '#d278e8'], ['#ffe8ee', '#f07090'],
    ['#f3e2d6', '#7b4a2e'], ['#fff6d6', '#e0b040'], ['#fff0f4', '#f08aa8'], ['#f4f0ff', '#9a7ae0'], ['#ffffff', '#e8c8a8']],
};
const GEM: string[][] = [
  ['#ffffff', '#c8c8d8'], ['#e6c8ff', '#8a3fd0'], ['#fff2c0', '#e0a020'], ['#fff6a0', '#d8b000'], ['#d8fbff', '#3fb8d8'], ['#e8ffb0', '#7ab820'],
  ['#ffb8c0', '#a01830'], ['#b8d0ff', '#1840b0'], ['#b8ffd8', '#109050'], ['#ffb0c8', '#d0104a'], ['#ffffff', '#a8e8ff'],
];

function drawEmoji(g: CanvasRenderingContext2D, tier: number, r: number, theme: 'sea' | 'sweets') {
  const [light, dark] = BUBBLE[theme][tier];
  shade(g, r, light, dark);
  circle(g, 0, 0, r);
  g.fill();
  g.font = `${Math.round(r * 1.25)}px "Noto Color Emoji", "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(EMOJI[theme][tier], 0, r * 0.08);
  rim(g, r, 'rgba(255,255,255,0.5)');
}

function drawGem(g: CanvasRenderingContext2D, tier: number, r: number) {
  const [light, dark] = GEM[tier];
  const sides = 6 + (tier % 3) * 2;
  const pts: Array<[number, number]> = [];
  for (let i = 0; i < sides; i++) {
    const a = (i / sides) * Math.PI * 2 - Math.PI / 2;
    pts.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  shade(g, r, light, dark);
  g.beginPath();
  pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
  g.closePath();
  g.fill();
  // table (top facet) and facet lines
  const inner = pts.map(([x, y]) => [x * 0.5, y * 0.5 - r * 0.05] as [number, number]);
  g.fillStyle = 'rgba(255,255,255,0.28)';
  g.beginPath();
  inner.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
  g.closePath();
  g.fill();
  g.strokeStyle = 'rgba(255,255,255,0.45)';
  g.lineWidth = Math.max(1, r * 0.04);
  g.beginPath();
  for (let i = 0; i < sides; i++) { g.moveTo(pts[i][0], pts[i][1]); g.lineTo(inner[i][0], inner[i][1]); }
  g.stroke();
  g.fillStyle = 'rgba(255,255,255,0.8)';
  g.beginPath();
  g.ellipse(-r * 0.3, -r * 0.45, r * 0.14, r * 0.07, -0.6, 0, Math.PI * 2);
  g.fill();
}

export const TIER_COLORS = [
  '#c9a8ff', '#9aa0ad', '#9fdcff', '#a5774f', '#e9e6f2', '#cfd4e6',
  '#e2603c', '#3d8fe0', '#e8b84a', '#f09a4a', '#ffd84a',
];

/** A sprite of `tier` with radius `r` in screen pixels. Its canvas is 2.2r wide (rings stick out). */
// ----- Illustrated pieces (public/art/items/<theme>/NN.webp), drawn for this game with Higgsfield -----

const images = new Map<string, HTMLImageElement>();
const loaded = new Set<string>();
const listeners = new Set<() => void>();

function imgKey(theme: Theme, tier: number) {
  // The Comet is shared by every theme.
  return tier < 0 ? 'space/11' : `${theme}/${String(tier).padStart(2, '0')}`;
}

/** Starts loading a theme's pieces; `done` runs when all of them are ready. */
export function preloadTheme(theme: Theme, done?: () => void) {
  const keys = [...Array(11).keys()].map(t => imgKey(theme, t)).concat(imgKey(theme, -1));
  let left = keys.filter(k => !loaded.has(k)).length;
  if (!left) { done?.(); return; }
  for (const k of keys) {
    if (images.has(k)) continue;
    const im = new Image();
    im.decoding = 'async';
    im.onload = () => {
      loaded.add(k);
      for (const f of listeners) f();
      if (--left === 0) done?.();
    };
    im.onerror = () => { if (--left === 0) done?.(); };
    im.src = `art/items/${k}.webp`;
    images.set(k, im);
  }
}

// ----- Backgrounds and the mascot (public/art/bg, public/art/mascot) -----

export type Pose = 'wave' | 'cheer' | 'think' | 'worried';
export const mascotUrl = (pose: Pose) => `art/mascot/${pose}.webp`;
export const bgUrl = (theme: Theme) => `art/bg/${theme}.webp`;

const bgs = new Map<Theme, HTMLImageElement>();
/** The theme's background picture once it has loaded (null before; `onload` then runs when ready). */
export function themeBg(theme: Theme, onload?: () => void): HTMLImageElement | null {
  let im = bgs.get(theme);
  if (!im) {
    im = new Image();
    im.src = bgUrl(theme);
    bgs.set(theme, im);
  }
  if (im.complete && im.naturalWidth) return im;
  if (onload) im.addEventListener('load', onload, { once: true });
  return null;
}

export function onArtLoaded(f: () => void) {
  listeners.add(f);
  return () => listeners.delete(f);
}

/** True when the piece has illustrated art (then no code-drawn face is added). */
export function hasArt(tier: number, theme: Theme) {
  return loaded.has(imgKey(theme, tier));
}

// How wide the art is drawn compared with the physics circle (rings and sun rays stick out).
function artScale(tier: number) {
  return tier === 8 ? 2.5 : tier === 10 ? 2.36 : tier < 0 ? 2.25 : 2.1;
}

export function sprite(tier: number, r: number, theme: Theme = 'space'): HTMLCanvasElement {
  const px = Math.max(4, Math.round(r));
  const art = hasArt(tier, theme);
  const key = `${theme}:${tier}:${px}:${art ? 1 : 0}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const size = Math.ceil(px * 2.6);
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  g.translate(size / 2, size / 2);
  if (art) {
    const im = images.get(imgKey(theme, tier))!;
    const w = px * artScale(tier);
    g.imageSmoothingQuality = 'high';
    g.drawImage(im, -w / 2, -w / 2, w, w);
  } else if (theme === 'space' || tier < 0) draw(g, tier, px);
  else if (theme === 'gems') drawGem(g, tier, px);
  else drawEmoji(g, tier, px, theme);
  cache.set(key, c);
  return c;
}

function circle(g: CanvasRenderingContext2D, x: number, y: number, r: number) {
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
}

function shade(g: CanvasRenderingContext2D, r: number, light: string, dark: string) {
  const grad = g.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r);
  grad.addColorStop(0, light);
  grad.addColorStop(1, dark);
  g.fillStyle = grad;
}

function rim(g: CanvasRenderingContext2D, r: number, color = 'rgba(255,255,255,0.35)') {
  circle(g, 0, 0, r - 0.5);
  g.strokeStyle = color;
  g.lineWidth = Math.max(1, r * 0.06);
  g.stroke();
  // soft highlight
  const hl = g.createRadialGradient(-r * 0.4, -r * 0.45, 0, -r * 0.4, -r * 0.45, r * 0.6);
  hl.addColorStop(0, 'rgba(255,255,255,0.45)');
  hl.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = hl;
  circle(g, 0, 0, r);
  g.fill();
}

function craters(g: CanvasRenderingContext2D, r: number, n: number, seed: number, color: string) {
  const rand = rng(seed);
  g.save();
  circle(g, 0, 0, r);
  g.clip();
  for (let i = 0; i < n; i++) {
    const a = rand() * Math.PI * 2;
    const d = rand() * r * 0.7;
    const cr = r * (0.08 + rand() * 0.16);
    const x = Math.cos(a) * d;
    const y = Math.sin(a) * d;
    circle(g, x, y, cr);
    g.fillStyle = color;
    g.fill();
    circle(g, x + cr * 0.15, y + cr * 0.15, cr * 0.8);
    g.fillStyle = 'rgba(255,255,255,0.12)';
    g.fill();
  }
  g.restore();
}

function draw(g: CanvasRenderingContext2D, tier: number, r: number) {
  switch (tier) {
    case 0: { // Stardust: glowing lilac puff with a sparkle
      const glow = g.createRadialGradient(0, 0, 0, 0, 0, r);
      glow.addColorStop(0, '#fff');
      glow.addColorStop(0.35, '#d9c2ff');
      glow.addColorStop(1, '#7d55d9');
      g.fillStyle = glow;
      circle(g, 0, 0, r);
      g.fill();
      g.fillStyle = 'rgba(255,255,255,0.95)';
      g.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4;
        const d = i % 2 === 0 ? r * 0.75 : r * 0.18;
        g.lineTo(Math.cos(a) * d, Math.sin(a) * d);
      }
      g.closePath();
      g.fill();
      break;
    }
    case 1: { // Pebble
      shade(g, r, '#c3c8d2', '#5d6370');
      circle(g, 0, 0, r);
      g.fill();
      craters(g, r, 2, 11, 'rgba(40,44,55,0.35)');
      rim(g, r);
      break;
    }
    case 2: { // Ice Shard: faceted crystal ball
      shade(g, r, '#e9fbff', '#3f9ad6');
      circle(g, 0, 0, r);
      g.fill();
      g.save();
      circle(g, 0, 0, r);
      g.clip();
      g.strokeStyle = 'rgba(255,255,255,0.55)';
      g.lineWidth = Math.max(1, r * 0.05);
      const pts: Array<[number, number]> = [];
      for (let i = 0; i < 6; i++) pts.push([Math.cos(i * Math.PI / 3 + 0.3) * r * 0.55, Math.sin(i * Math.PI / 3 + 0.3) * r * 0.55]);
      g.beginPath();
      pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
      g.closePath();
      for (const [x, y] of pts) { g.moveTo(x, y); g.lineTo(x * 1.9, y * 1.9); g.moveTo(x, y); g.lineTo(0, 0); }
      g.stroke();
      g.restore();
      rim(g, r, 'rgba(220,250,255,0.7)');
      break;
    }
    case 3: { // Asteroid: lumpy brown rock
      const rand = rng(33);
      g.beginPath();
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2;
        const d = r * (0.88 + rand() * 0.12);
        g.lineTo(Math.cos(a) * d, Math.sin(a) * d);
      }
      g.closePath();
      shade(g, r, '#c99a6b', '#5c3b22');
      g.fill();
      craters(g, r * 0.92, 5, 7, 'rgba(60,35,18,0.45)');
      break;
    }
    case 4: { // Moonlet
      shade(g, r, '#ffffff', '#a9a6bb');
      circle(g, 0, 0, r);
      g.fill();
      craters(g, r, 5, 44, 'rgba(120,118,140,0.4)');
      rim(g, r);
      break;
    }
    case 5: { // Moon with dark seas
      shade(g, r, '#f4f6ff', '#8d93ad');
      circle(g, 0, 0, r);
      g.fill();
      g.save();
      circle(g, 0, 0, r);
      g.clip();
      g.fillStyle = 'rgba(110,116,145,0.45)';
      for (const [x, y, s] of [[-0.3, -0.1, 0.35], [0.25, 0.2, 0.28], [0.1, -0.45, 0.2]]) {
        g.beginPath();
        g.ellipse(x * r, y * r, s * r, s * r * 0.75, 0.5, 0, Math.PI * 2);
        g.fill();
      }
      g.restore();
      craters(g, r, 6, 55, 'rgba(120,124,150,0.35)');
      rim(g, r);
      break;
    }
    case 6: { // Rocky Planet: red desert with canyon bands
      shade(g, r, '#ffad7a', '#8c2a18');
      circle(g, 0, 0, r);
      g.fill();
      g.save();
      circle(g, 0, 0, r);
      g.clip();
      g.strokeStyle = 'rgba(110,30,15,0.5)';
      g.lineWidth = r * 0.07;
      for (let i = -2; i <= 2; i++) {
        g.beginPath();
        g.moveTo(-r, i * r * 0.3);
        g.bezierCurveTo(-r * 0.3, i * r * 0.3 - r * 0.15, r * 0.3, i * r * 0.3 + r * 0.15, r, i * r * 0.3);
        g.stroke();
      }
      g.restore();
      craters(g, r, 3, 66, 'rgba(110,30,15,0.35)');
      rim(g, r);
      break;
    }
    case 7: { // Ocean Planet
      shade(g, r, '#7cc7ff', '#123f8f');
      circle(g, 0, 0, r);
      g.fill();
      g.save();
      circle(g, 0, 0, r);
      g.clip();
      const rand = rng(77);
      g.fillStyle = '#4fbf6a';
      for (let i = 0; i < 5; i++) {
        const x = (rand() - 0.5) * r * 1.4;
        const y = (rand() - 0.5) * r * 1.4;
        g.beginPath();
        for (let k = 0; k < 9; k++) {
          const a = (k / 9) * Math.PI * 2;
          const d = r * (0.18 + rand() * 0.18);
          g.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d);
        }
        g.closePath();
        g.fill();
      }
      g.fillStyle = 'rgba(255,255,255,0.75)';
      for (let i = 0; i < 4; i++) {
        g.beginPath();
        g.ellipse((rand() - 0.5) * r * 1.4, (rand() - 0.5) * r * 1.4, r * 0.35, r * 0.08, -0.2, 0, Math.PI * 2);
        g.fill();
      }
      g.restore();
      rim(g, r, 'rgba(170,220,255,0.6)');
      break;
    }
    case 8: { // Ringed Planet: ring behind and in front
      g.save();
      g.rotate(-0.35);
      g.strokeStyle = 'rgba(240,210,140,0.85)';
      g.lineWidth = r * 0.14;
      g.beginPath();
      g.ellipse(0, 0, r * 1.25, r * 0.36, 0, Math.PI, Math.PI * 2);
      g.stroke();
      g.restore();
      shade(g, r, '#ffe59a', '#a8701c');
      circle(g, 0, 0, r * 0.86);
      g.fill();
      g.save();
      circle(g, 0, 0, r * 0.86);
      g.clip();
      g.fillStyle = 'rgba(150,95,30,0.3)';
      for (let i = -3; i <= 3; i += 2) g.fillRect(-r, i * r * 0.18, r * 2, r * 0.12);
      g.restore();
      g.save();
      g.rotate(-0.35);
      g.strokeStyle = 'rgba(255,230,170,0.95)';
      g.lineWidth = r * 0.14;
      g.beginPath();
      g.ellipse(0, 0, r * 1.25, r * 0.36, 0, 0, Math.PI);
      g.stroke();
      g.restore();
      g.save();
      g.scale(0.86, 0.86);
      rim(g, r);
      g.restore();
      break;
    }
    case 9: { // Gas Giant: bands and a storm
      shade(g, r, '#ffd2a1', '#a14f17');
      circle(g, 0, 0, r);
      g.fill();
      g.save();
      circle(g, 0, 0, r);
      g.clip();
      const bands = ['rgba(255,240,215,0.5)', 'rgba(170,80,25,0.45)', 'rgba(255,220,180,0.45)', 'rgba(150,70,25,0.4)', 'rgba(255,240,215,0.4)'];
      bands.forEach((c, i) => {
        g.fillStyle = c;
        const y = -r + (i + 0.5) * (r * 2 / bands.length);
        g.beginPath();
        g.ellipse(0, y, r * 1.2, r * 0.13, 0, 0, Math.PI * 2);
        g.fill();
      });
      g.fillStyle = 'rgba(190,70,35,0.8)';
      g.beginPath();
      g.ellipse(r * 0.3, r * 0.3, r * 0.2, r * 0.12, 0, 0, Math.PI * 2);
      g.fill();
      g.restore();
      rim(g, r);
      break;
    }
    case 10: { // Star: bright sun with corona
      const cor = g.createRadialGradient(0, 0, r * 0.7, 0, 0, r * 1.25);
      cor.addColorStop(0, 'rgba(255,220,90,0.8)');
      cor.addColorStop(1, 'rgba(255,160,40,0)');
      g.fillStyle = cor;
      circle(g, 0, 0, r * 1.25);
      g.fill();
      const body = g.createRadialGradient(-r * 0.2, -r * 0.2, r * 0.1, 0, 0, r);
      body.addColorStop(0, '#fffbe0');
      body.addColorStop(0.6, '#ffd84a');
      body.addColorStop(1, '#ff9a1f');
      g.fillStyle = body;
      circle(g, 0, 0, r);
      g.fill();
      break;
    }
    default: { // Comet head
      const head = g.createRadialGradient(0, 0, 0, 0, 0, r);
      head.addColorStop(0, '#ffffff');
      head.addColorStop(0.5, '#9ff3ff');
      head.addColorStop(1, '#2a8fd6');
      g.fillStyle = head;
      circle(g, 0, 0, r);
      g.fill();
    }
  }
}

/** Little face: eyes that blink, and open wide when a twin is near. */
export function drawFace(g: CanvasRenderingContext2D, x: number, y: number, r: number, tier: number, t: number, excited: boolean, seed: number) {
  if (r < 9) return;
  const blink = ((t / 1000 + seed * 0.37) % 4) < 0.12;
  const eyeY = y + r * 0.05;
  const dx = r * 0.28;
  const er = Math.max(1.2, r * (excited ? 0.12 : 0.09));
  const dark = tier === 10 ? '#8a4a00' : '#2a1d4a';
  g.fillStyle = dark;
  g.strokeStyle = dark;
  g.lineWidth = Math.max(1, r * 0.06);
  g.lineCap = 'round';
  for (const s of [-1, 1]) {
    if (blink) {
      g.beginPath();
      g.moveTo(x + s * dx - er, eyeY);
      g.lineTo(x + s * dx + er, eyeY);
      g.stroke();
    } else {
      g.beginPath();
      g.arc(x + s * dx, eyeY, er, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#fff';
      g.beginPath();
      g.arc(x + s * dx - er * 0.3, eyeY - er * 0.3, er * 0.35, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = dark;
    }
  }
  g.beginPath();
  if (excited) g.arc(x, eyeY + r * 0.2, r * 0.12, 0, Math.PI);
  else g.arc(x, eyeY + r * 0.16, r * 0.1, 0.15 * Math.PI, 0.85 * Math.PI);
  g.stroke();
  // cheeks
  g.fillStyle = 'rgba(255,120,150,0.35)';
  for (const s of [-1, 1]) {
    g.beginPath();
    g.arc(x + s * r * 0.48, eyeY + r * 0.15, r * 0.1, 0, Math.PI * 2);
    g.fill();
  }
}

export function tierRadius(tier: number): number {
  return tier < 0 ? 18 : TIERS[tier].radius;
}

/** Draws a piece centred at (x, y) with radius r (CSS pixels) on a canvas scaled by dpr. */
export function drawPiece(g: CanvasRenderingContext2D, tier: number, x: number, y: number, r: number, theme: Theme, dpr = 1) {
  const s = sprite(tier, r * dpr, theme);
  const w = s.width / dpr;
  g.drawImage(s, x - w / 2, y - w / 2, w, w);
}

/** A piece as a DOM element, `r` CSS pixels in radius, sharp on high-density screens. */
export function pieceEl(tier: number, r: number, theme: Theme, cls = ''): HTMLCanvasElement {
  const s = sprite(tier, r * 2, theme);
  const c = document.createElement('canvas');
  c.width = s.width;
  c.height = s.height;
  c.getContext('2d')!.drawImage(s, 0, 0);
  c.style.width = c.style.height = `${s.width / 2}px`;
  if (cls) c.className = cls;
  return c;
}
