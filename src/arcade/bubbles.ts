import { sfx } from '../audio';
import { drawPiece, type Theme } from '../game/art';
import { buzz } from '../platform';
import { profile } from '../save';
import { h } from '../ui/dom';
import { tr } from '../i18n';
import { DISTINCT, fitCanvas, Shell, type ArcadeGame, type ArcadeHooks } from './shell';

const COLS = 8;
const KINDS = 5;
const START_ROWS = 5;
const MISSES_PER_ROW = 5;

interface Shot { x: number; y: number; vx: number; vy: number; tier: number }
interface Bit { x: number; y: number; vy: number; tier: number; t: number; fall: boolean }

/** Bubble Nebula: aim and shoot; groups of three or more matching pieces pop. */
export class BubblesGame implements ArcadeGame {
  readonly el: HTMLElement;
  private shell: Shell;
  private canvas: HTMLCanvasElement;
  private g: CanvasRenderingContext2D;
  private grid: number[][] = [];
  private parity = 0;
  private theme: Theme = profile.settings.theme;
  private kinds = DISTINCT[this.theme].slice(0, KINDS);
  private w = 0; private hgt = 0; private dpr = 1; private R = 20; private rowH = 34;
  private sx = 0; private sy = 0; private maxRows = 12;
  private aim = -Math.PI / 2;
  private aiming = false;
  private shot: Shot | null = null;
  private current = 0;
  private next = 0;
  private bits: Bit[] = [];
  private score = 0;
  private misses = 0;
  private raf = 0;
  private ro: ResizeObserver;

  constructor(hooks: ArcadeHooks) {
    this.shell = new Shell('Bubble Nebula', profile.arcade.bubbles ? `Best ${profile.arcade.bubbles.toLocaleString('en-US')}` : 'Match 3 to pop', hooks);
    this.el = this.shell.el;
    this.canvas = h('canvas.arcade-canvas') as HTMLCanvasElement;
    this.g = this.canvas.getContext('2d')!;
    this.shell.body.append(h('div.canvas-wrap', {}, this.canvas));
    for (let r = 0; r < START_ROWS; r++) this.grid.push(this.randomRow(r));
    this.current = this.pick();
    this.next = this.pick();
    this.ro = fitCanvas(this.canvas, (w, hh, d) => { this.w = w; this.hgt = hh; this.dpr = d; this.layout(); });
    this.canvas.addEventListener('pointerdown', e => { this.aiming = true; this.point(e); this.canvas.setPointerCapture(e.pointerId); });
    this.canvas.addEventListener('pointermove', e => { if (this.aiming) this.point(e); });
    this.canvas.addEventListener('pointerup', e => { if (!this.aiming) return; this.aiming = false; this.point(e); this.fire(); });
    this.canvas.addEventListener('pointercancel', () => { this.aiming = false; });
    this.raf = requestAnimationFrame(() => this.frame());
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    this.el.remove();
  }

  back() { return this.shell.back(); }

  private layout() {
    this.R = Math.min(this.w / (COLS * 2 + 1), 30);
    this.rowH = this.R * Math.sqrt(3);
    this.sx = this.w / 2;
    this.sy = this.hgt - this.R * 2.2;
    this.maxRows = Math.floor((this.sy - this.R * 3) / this.rowH);
  }

  private ox() { return (this.w - (COLS * 2 + 1) * this.R) / 2; }
  private odd(r: number) { return (r + this.parity) % 2 === 1; }
  private cx(r: number, c: number) { return this.ox() + this.R + c * 2 * this.R + (this.odd(r) ? this.R : 0); }
  private cy(r: number) { return this.R + 6 + r * this.rowH; }

  private randomRow(r: number) {
    return Array.from({ length: COLS }, (_, c) => (this.odd(r) && c === COLS - 1 ? -1 : this.kinds[Math.floor(Math.random() * KINDS)]));
  }

  /** Next piece: one of the kinds still on the board, so every shot can help. */
  private pick() {
    const left = new Set(this.grid.flat().filter(v => v >= 0));
    const kinds = left.size ? [...left] : this.kinds;
    return kinds[Math.floor(Math.random() * kinds.length)];
  }

  private point(e: PointerEvent) {
    const a = Math.atan2(e.offsetY - this.sy, e.offsetX - this.sx);
    this.aim = Math.max(-Math.PI + 0.17, Math.min(-0.17, a > Math.PI / 2 ? -Math.PI + 0.17 : a > 0 ? -0.17 : a));
  }

  private fire() {
    if (this.shot || this.shell.paused || this.shell.ended) return;
    const sp = this.R * 0.55;
    this.shot = { x: this.sx, y: this.sy, vx: Math.cos(this.aim) * sp, vy: Math.sin(this.aim) * sp, tier: this.current };
    this.current = this.next;
    this.next = this.pick();
    sfx.drop();
  }

  private step() {
    const s = this.shot;
    if (!s) return;
    for (let k = 0; k < 4 && this.shot; k++) {
      s.x += s.vx; s.y += s.vy;
      const left = this.ox() + this.R, right = this.ox() + (COLS * 2) * this.R;
      if (s.x < left) { s.x = left; s.vx = Math.abs(s.vx); }
      if (s.x > right) { s.x = right; s.vx = -Math.abs(s.vx); }
      if (s.y <= this.cy(0)) { this.snap(s); return; }
      for (let r = 0; r < this.grid.length; r++) for (let c = 0; c < COLS; c++) {
        if (this.grid[r][c] < 0) continue;
        if (Math.hypot(this.cx(r, c) - s.x, this.cy(r) - s.y) < this.R * 1.75) { this.snap(s); return; }
      }
    }
  }

  private snap(s: Shot) {
    this.shot = null;
    // Nearest empty cell to where the shot stopped.
    let best: [number, number] | null = null, bd = Infinity;
    const rMax = Math.min(this.grid.length, Math.floor((s.y - this.R) / this.rowH) + 2);
    for (let r = 0; r <= rMax; r++) {
      if (!this.grid[r]) this.grid[r] = Array(COLS).fill(-1);
      for (let c = 0; c < COLS; c++) {
        if (this.grid[r][c] >= 0 || (this.odd(r) && c === COLS - 1)) continue;
        const d = Math.hypot(this.cx(r, c) - s.x, this.cy(r) - s.y);
        if (d < bd) { bd = d; best = [r, c]; }
      }
    }
    if (!best) return;
    const [r, c] = best;
    this.grid[r][c] = s.tier;
    const group = this.flood(r, c, v => v === s.tier);
    if (group.length >= 3) {
      for (const [gr, gc] of group) this.remove(gr, gc, false);
      const anchored = new Set<string>();
      for (let cc = 0; cc < COLS; cc++) if (this.grid[0]?.[cc] >= 0) for (const [ar, ac] of this.flood(0, cc, v => v >= 0)) anchored.add(`${ar},${ac}`);
      let dropped = 0;
      this.grid.forEach((row, rr) => row.forEach((v, cc) => { if (v >= 0 && !anchored.has(`${rr},${cc}`)) { this.remove(rr, cc, true); dropped++; } }));
      this.score += group.length * 10 + dropped * 20 + (group.length + dropped >= 6 ? 50 : 0);
      sfx.merge(Math.min(10, group.length + dropped), 1);
      if (dropped) sfx.chain(2);
      buzz(dropped > 3);
    } else {
      this.misses++;
      sfx.hit();
      if (this.misses >= MISSES_PER_ROW) { this.misses = 0; this.pushRow(); }
    }
    while (this.grid.length && this.grid[this.grid.length - 1].every(v => v < 0)) this.grid.pop();
    this.shell.setScore(this.score);
    this.shell.setSub(`New row in ${MISSES_PER_ROW - this.misses}`);
    if (!this.grid.flat().some(v => v >= 0)) {
      this.score += 500;
      this.shell.setScore(this.score);
      sfx.win();
      for (let rr = 0; rr < START_ROWS; rr++) this.grid[rr] = this.randomRow(rr);
    }
    if (this.grid.length > this.maxRows) {
      sfx.gameOver();
      this.shell.finish(this.score, 900);
    }
  }

  private pushRow() {
    this.parity ^= 1;
    this.grid.unshift(this.randomRow(0));
    sfx.warn();
  }

  private remove(r: number, c: number, fall: boolean) {
    this.bits.push({ x: this.cx(r, c), y: this.cy(r), vy: fall ? -2 : 0, tier: this.grid[r][c], t: 0, fall });
    this.grid[r][c] = -1;
  }

  private neighbours(r: number, c: number): Array<[number, number]> {
    const o = this.odd(r) ? 0 : -1;
    return [[r, c - 1], [r, c + 1], [r - 1, c + o], [r - 1, c + o + 1], [r + 1, c + o], [r + 1, c + o + 1]];
  }

  private flood(r: number, c: number, ok: (v: number) => boolean) {
    const seen = new Set<string>([`${r},${c}`]);
    const out: Array<[number, number]> = [];
    const stack: Array<[number, number]> = [[r, c]];
    while (stack.length) {
      const [cr, cc] = stack.pop()!;
      out.push([cr, cc]);
      for (const [nr, nc] of this.neighbours(cr, cc)) {
        const k = `${nr},${nc}`;
        if (seen.has(k) || nr < 0 || nc < 0 || nc >= COLS || !this.grid[nr] || !ok(this.grid[nr][nc])) continue;
        seen.add(k);
        stack.push([nr, nc]);
      }
    }
    return out;
  }

  private frame() {
    this.raf = requestAnimationFrame(() => this.frame());
    if (!this.shell.paused) this.step();
    const g = this.g, R = this.R;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    g.clearRect(0, 0, this.w, this.hgt);
    // danger line
    const lineY = this.cy(this.maxRows) - R;
    g.strokeStyle = 'rgba(255,120,120,0.45)';
    g.setLineDash([8, 8]);
    g.beginPath(); g.moveTo(this.ox(), lineY); g.lineTo(this.w - this.ox(), lineY); g.stroke();
    g.setLineDash([]);
    for (let r = 0; r < this.grid.length; r++) for (let c = 0; c < COLS; c++) {
      if (this.grid[r][c] >= 0) drawPiece(g, this.grid[r][c], this.cx(r, c), this.cy(r), R * 0.98, this.theme, this.dpr);
    }
    for (const b of this.bits) {
      b.t += 1 / 30;
      if (b.fall) { b.vy += 0.5; b.y += b.vy; }
      g.globalAlpha = Math.max(0, 1 - b.t);
      drawPiece(g, b.tier, b.x, b.y, R * (b.fall ? 0.98 : 0.98 + b.t * 0.6), this.theme, this.dpr);
    }
    g.globalAlpha = 1;
    this.bits = this.bits.filter(b => b.t < 1);
    // aim guide
    if (this.aiming && !this.shot) {
      g.fillStyle = 'rgba(255,255,255,0.6)';
      let x = this.sx, y = this.sy, vx = Math.cos(this.aim), vy = Math.sin(this.aim);
      for (let i = 1; i < 26; i++) {
        x += vx * R * 0.9; y += vy * R * 0.9;
        if (x < this.ox() + R || x > this.w - this.ox() - R) vx = -vx;
        if (y < this.cy(0)) break;
        if (i % 2 === 0) { g.beginPath(); g.arc(x, y, 3, 0, Math.PI * 2); g.fill(); }
      }
    }
    if (this.shot) drawPiece(g, this.shot.tier, this.shot.x, this.shot.y, R * 0.98, this.theme, this.dpr);
    else drawPiece(g, this.current, this.sx, this.sy, R * 1.05, this.theme, this.dpr);
    g.fillStyle = 'rgba(255,255,255,0.7)';
    g.font = '700 11px Nunito, sans-serif';
    g.textAlign = 'center';
    g.fillText(tr('NEXT'), this.sx + R * 3.4, this.sy - R * 0.9);
    drawPiece(g, this.next, this.sx + R * 3.4, this.sy, R * 0.7, this.theme, this.dpr);
  }
}
