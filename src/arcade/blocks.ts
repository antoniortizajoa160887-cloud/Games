import { sfx } from '../audio';
import { drawPiece, type Theme } from '../game/art';
import { buzz } from '../platform';
import { profile } from '../save';
import { h } from '../ui/dom';
import { fitCanvas, Shell, type ArcadeGame, type ArcadeHooks } from './shell';

const N = 8;
type Shape = Array<[number, number]>;

const SHAPES: Shape[] = [
  [[0, 0]],
  [[0, 0], [0, 1]], [[0, 0], [1, 0]],
  [[0, 0], [0, 1], [0, 2]], [[0, 0], [1, 0], [2, 0]],
  [[0, 0], [0, 1], [0, 2], [0, 3]], [[0, 0], [1, 0], [2, 0], [3, 0]],
  [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4]], [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]],
  [[0, 0], [0, 1], [1, 0], [1, 1]],
  [[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2], [2, 0], [2, 1], [2, 2]],
  [[0, 0], [1, 0], [1, 1]], [[0, 1], [1, 0], [1, 1]], [[0, 0], [0, 1], [1, 0]], [[0, 0], [0, 1], [1, 1]],
  [[0, 0], [1, 0], [2, 0], [2, 1]], [[0, 0], [0, 1], [0, 2], [1, 0]], [[0, 0], [0, 1], [1, 1], [2, 1]], [[0, 2], [1, 0], [1, 1], [1, 2]],
  [[0, 0], [0, 1], [0, 2], [1, 1]], [[0, 1], [1, 0], [1, 1], [2, 1]],
  [[0, 1], [0, 2], [1, 0], [1, 1]], [[0, 0], [1, 0], [1, 1], [2, 1]],
];

interface Piece { shape: Shape; tier: number }
interface Fading { r: number; c: number; tier: number; t: number }

/** Meteor Blocks: drag shapes onto the 8×8 grid; full rows and columns burst. */
export class BlocksGame implements ArcadeGame {
  readonly el: HTMLElement;
  private shell: Shell;
  private canvas: HTMLCanvasElement;
  private g: CanvasRenderingContext2D;
  private grid: number[][] = Array.from({ length: N }, () => Array(N).fill(-1));
  private tray: Array<Piece | null> = [];
  private fading: Fading[] = [];
  private score = 0;
  private combo = 0;
  private theme: Theme = profile.settings.theme;
  private w = 0; private hgt = 0; private dpr = 1;
  private cell = 36; private bx = 0; private by = 0;
  private trayY = 0; private slotW = 0; private miniCell = 18;
  private drag: { slot: number; x: number; y: number } | null = null;
  private raf = 0;
  private ro: ResizeObserver;

  constructor(hooks: ArcadeHooks) {
    this.shell = new Shell('Meteor Blocks', profile.arcade.blocks ? `Best ${profile.arcade.blocks.toLocaleString('en-US')}` : 'Fill rows and columns', hooks);
    this.el = this.shell.el;
    this.canvas = h('canvas.arcade-canvas') as HTMLCanvasElement;
    this.g = this.canvas.getContext('2d')!;
    this.shell.body.append(h('div.canvas-wrap', {}, this.canvas));
    this.ro = fitCanvas(this.canvas, (w, hh, d) => { this.w = w; this.hgt = hh; this.dpr = d; this.layout(); });
    this.canvas.addEventListener('pointerdown', e => this.down(e));
    this.canvas.addEventListener('pointermove', e => { if (this.drag) { this.drag.x = e.offsetX; this.drag.y = e.offsetY; } });
    this.canvas.addEventListener('pointerup', () => this.up());
    this.canvas.addEventListener('pointercancel', () => { this.drag = null; });
    this.refill();
    this.raf = requestAnimationFrame(() => this.frame());
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    this.el.remove();
  }

  back() { return this.shell.back(); }

  private layout() {
    this.cell = Math.floor(Math.min((this.w - 24) / N, (this.hgt * 0.66) / N));
    this.bx = (this.w - this.cell * N) / 2;
    this.by = 8;
    this.trayY = this.by + this.cell * N + Math.max(24, (this.hgt - this.cell * N - 8) * 0.45);
    this.slotW = this.w / 3;
    this.miniCell = Math.min(this.cell * 0.62, this.slotW / 4.6);
  }

  private refill() {
    this.tray = [0, 1, 2].map(() => ({ shape: SHAPES[Math.floor(Math.random() * SHAPES.length)], tier: Math.floor(Math.random() * 7) }));
  }

  private down(e: PointerEvent) {
    if (this.shell.paused || this.shell.ended) return;
    if (e.offsetY < this.trayY - this.miniCell * 3) return;
    const slot = Math.min(2, Math.floor(e.offsetX / this.slotW));
    if (!this.tray[slot]) return;
    this.canvas.setPointerCapture(e.pointerId);
    this.drag = { slot, x: e.offsetX, y: e.offsetY };
    sfx.click();
  }

  /** Grid cell where the dragged shape's top-left would land, held above the finger. */
  private target(): { r: number; c: number; ok: boolean } | null {
    if (!this.drag) return null;
    const p = this.tray[this.drag.slot]!;
    const [rows, cols] = dims(p.shape);
    const gx = this.drag.x - (cols * this.cell) / 2;
    const gy = this.drag.y - rows * this.cell - this.cell * 1.2;
    const c = Math.round((gx - this.bx) / this.cell), r = Math.round((gy - this.by) / this.cell);
    return { r, c, ok: this.fits(p.shape, r, c) };
  }

  private fits(shape: Shape, r: number, c: number) {
    return shape.every(([dr, dc]) => r + dr >= 0 && r + dr < N && c + dc >= 0 && c + dc < N && this.grid[r + dr][c + dc] < 0);
  }

  private up() {
    const t = this.target();
    const d = this.drag;
    this.drag = null;
    if (!t || !d || !t.ok) return;
    const p = this.tray[d.slot]!;
    for (const [dr, dc] of p.shape) this.grid[t.r + dr][t.c + dc] = p.tier;
    this.tray[d.slot] = null;
    this.score += p.shape.length;
    sfx.drop();
    // Clear full rows and columns.
    const rows = [...Array(N).keys()].filter(r => this.grid[r].every(v => v >= 0));
    const cols = [...Array(N).keys()].filter(c => this.grid.every(row => row[c] >= 0));
    const lines = rows.length + cols.length;
    if (lines) {
      this.combo++;
      for (const r of rows) for (let c = 0; c < N; c++) this.fade(r, c);
      for (const c of cols) for (let r = 0; r < N; r++) this.fade(r, c);
      this.score += 10 * lines * lines * this.combo;
      sfx.merge(Math.min(10, 3 + lines * 2), this.combo);
      if (this.combo > 1) sfx.chain(this.combo);
      buzz(lines > 1);
    } else this.combo = 0;
    this.shell.setScore(this.score);
    if (this.tray.every(x => !x)) this.refill();
    if (!this.tray.some(x => x && this.anyFit(x.shape))) {
      sfx.gameOver();
      this.shell.finish(this.score, 1000);
    }
  }

  private fade(r: number, c: number) {
    if (this.grid[r][c] < 0) return;
    this.fading.push({ r, c, tier: this.grid[r][c], t: 0 });
    this.grid[r][c] = -1;
  }

  private anyFit(shape: Shape) {
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (this.fits(shape, r, c)) return true;
    return false;
  }

  private frame() {
    this.raf = requestAnimationFrame(() => this.frame());
    const g = this.g, cs = this.cell;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    g.clearRect(0, 0, this.w, this.hgt);
    // board
    g.fillStyle = 'rgba(20,12,50,0.75)';
    roundRect(g, this.bx - 6, this.by - 6, cs * N + 12, cs * N + 12, 14);
    g.fill();
    g.strokeStyle = 'rgba(255,207,90,0.55)';
    g.lineWidth = 1.5;
    g.stroke();
    const t = this.target();
    const ghost = new Set<string>();
    if (t?.ok && this.drag) for (const [dr, dc] of this.tray[this.drag.slot]!.shape) ghost.add(`${t.r + dr},${t.c + dc}`);
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      const x = this.bx + c * cs, y = this.by + r * cs;
      g.fillStyle = ghost.has(`${r},${c}`) ? 'rgba(255,207,90,0.35)' : 'rgba(255,255,255,0.06)';
      roundRect(g, x + 2, y + 2, cs - 4, cs - 4, 6);
      g.fill();
      if (this.grid[r][c] >= 0) drawPiece(g, this.grid[r][c], x + cs / 2, y + cs / 2, cs * 0.46, this.theme, this.dpr);
    }
    // bursting cells
    for (const f of this.fading) {
      f.t += 1 / 18;
      g.globalAlpha = Math.max(0, 1 - f.t);
      const s = 0.46 * (1 + f.t * 0.8);
      drawPiece(g, f.tier, this.bx + f.c * cs + cs / 2, this.by + f.r * cs + cs / 2, cs * s, this.theme, this.dpr);
    }
    g.globalAlpha = 1;
    this.fading = this.fading.filter(f => f.t < 1);
    // tray
    this.tray.forEach((p, i) => {
      if (!p) return;
      const dragging = this.drag?.slot === i;
      const [rows, cols] = dims(p.shape);
      const size = dragging ? cs : this.miniCell;
      const cx = dragging ? this.drag!.x : this.slotW * (i + 0.5);
      const cy = dragging ? this.drag!.y - rows * cs / 2 - cs * 1.2 : this.trayY;
      if (!dragging && !this.anyFit(p.shape)) g.globalAlpha = 0.35;
      for (const [dr, dc] of p.shape) {
        drawPiece(g, p.tier, cx + (dc - cols / 2 + 0.5) * size, cy + (dr - rows / 2 + 0.5) * size, size * 0.47, this.theme, this.dpr);
      }
      g.globalAlpha = 1;
    });
  }
}

function dims(shape: Shape): [number, number] {
  return [Math.max(...shape.map(s => s[0])) + 1, Math.max(...shape.map(s => s[1])) + 1];
}

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.roundRect(x, y, w, h, r);
}
