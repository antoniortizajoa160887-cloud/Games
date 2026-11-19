import { sfx } from '../audio';
import { COMET } from '../core/tiers';
import { drawPiece, TIER_COLORS, type Theme } from '../game/art';
import { buzz } from '../platform';
import { profile } from '../save';
import { h } from '../ui/dom';
import { tr } from '../i18n';
import { fitCanvas, Shell, type ArcadeGame, type ArcadeHooks } from './shell';

const COLS = 13;
const ROWS = 17;
type P = [number, number];

/** Comet Trail: steer the comet, collect pieces and grow a trail. Don't hit the walls or yourself. */
export class SnakeGame implements ArcadeGame {
  readonly el: HTMLElement;
  private shell: Shell;
  private canvas: HTMLCanvasElement;
  private g: CanvasRenderingContext2D;
  private theme: Theme = profile.settings.theme;
  private w = 0; private hgt = 0; private dpr = 1; private cell = 24; private ox = 0; private oy = 0;
  private body: Array<{ p: P; tier: number }> = [];
  private dir: P = [0, 1];
  private queued: P[] = [];
  private food: { p: P; tier: number } = { p: [0, 0], tier: 0 };
  private star: { p: P; until: number } | null = null;
  private stepMs = 190;
  private acc = 0;
  private last = performance.now();
  private score = 0;
  private eaten = 0;
  private started = false;
  private start: { x: number; y: number } | null = null;
  private raf = 0;
  private ro: ResizeObserver;
  private onKey = (e: KeyboardEvent) => {
    const d = ({ ArrowLeft: [0, -1], ArrowRight: [0, 1], ArrowUp: [-1, 0], ArrowDown: [1, 0] } as Record<string, P>)[e.key];
    if (d) { e.preventDefault(); this.turn(d); }
  };

  constructor(hooks: ArcadeHooks) {
    this.shell = new Shell('Comet Trail', profile.arcade.snake ? `Best ${profile.arcade.snake.toLocaleString('en-US')}` : 'Swipe to steer', hooks, 'rush');
    this.el = this.shell.el;
    this.canvas = h('canvas.arcade-canvas') as HTMLCanvasElement;
    this.g = this.canvas.getContext('2d')!;
    this.shell.body.append(h('div.canvas-wrap', {}, this.canvas));
    for (let i = 0; i < 3; i++) this.body.push({ p: [8, 6 - i], tier: 0 });
    this.placeFood();
    this.ro = fitCanvas(this.canvas, (w, hh, d) => { this.w = w; this.hgt = hh; this.dpr = d; this.layout(); });
    // Swipe anywhere on the screen to steer.
    this.el.addEventListener('pointerdown', e => { this.start = { x: e.clientX, y: e.clientY }; });
    this.el.addEventListener('pointermove', e => this.swipe(e));
    this.el.addEventListener('pointerup', () => { this.start = null; });
    window.addEventListener('keydown', this.onKey);
    this.raf = requestAnimationFrame(t => this.frame(t));
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    window.removeEventListener('keydown', this.onKey);
    this.el.remove();
  }

  back() { return this.shell.back(); }

  private layout() {
    this.cell = Math.floor(Math.min((this.w - 16) / COLS, (this.hgt - 16) / ROWS));
    this.ox = (this.w - this.cell * COLS) / 2;
    this.oy = (this.hgt - this.cell * ROWS) / 2;
  }

  private swipe(e: PointerEvent) {
    if (!this.start) return;
    const dx = e.clientX - this.start.x, dy = e.clientY - this.start.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 22) return;
    this.turn(Math.abs(dx) > Math.abs(dy) ? [0, dx > 0 ? 1 : -1] : [dy > 0 ? 1 : -1, 0]);
    this.start = { x: e.clientX, y: e.clientY };
  }

  private turn(d: P) {
    const lastDir = this.queued[this.queued.length - 1] ?? this.dir;
    if (d[0] === -lastDir[0] && d[1] === -lastDir[1]) return;
    if (d[0] === lastDir[0] && d[1] === lastDir[1]) { this.started = true; return; }
    this.started = true;
    if (this.queued.length < 2) this.queued.push(d);
  }

  private free(): P {
    for (;;) {
      const p: P = [Math.floor(Math.random() * ROWS), Math.floor(Math.random() * COLS)];
      if (!this.body.some(b => b.p[0] === p[0] && b.p[1] === p[1]) && !(this.star && same(this.star.p, p))) return p;
    }
  }

  private placeFood() {
    this.food = { p: this.free(), tier: Math.min(10, Math.floor(this.eaten / 4) + Math.floor(Math.random() * 3)) };
  }

  private tick(now: number) {
    if (this.queued.length) this.dir = this.queued.shift()!;
    const head = this.body[0].p;
    const next: P = [head[0] + this.dir[0], head[1] + this.dir[1]];
    const hitWall = next[0] < 0 || next[0] >= ROWS || next[1] < 0 || next[1] >= COLS;
    const grow = same(next, this.food.p);
    const hitSelf = this.body.slice(0, grow ? undefined : -1).some(b => same(b.p, next));
    if (hitWall || hitSelf) {
      sfx.gameOver();
      buzz(true);
      this.shell.finish(this.score, 900);
      return;
    }
    // Each segment takes the place of the one ahead; the head is the Comet.
    const tiers = this.body.map(b => b.tier);
    this.body.unshift({ p: next, tier: 0 });
    this.body.forEach((b, i) => { b.tier = i === 0 ? 0 : tiers[i - 1]; });
    if (grow) {
      this.body[this.body.length - 1].tier = this.food.tier;
      this.eaten++;
      this.score += 10 * (this.food.tier + 1);
      sfx.merge(this.food.tier, 1);
      this.stepMs = Math.max(85, 190 - this.eaten * 3);
      this.placeFood();
      if (!this.star && Math.random() < 0.25) this.star = { p: this.free(), until: now + 6000 };
    } else this.body.pop();
    if (this.star && same(next, this.star.p)) {
      this.score += 250;
      this.star = null;
      sfx.supernova();
      buzz(true);
    }
    if (this.star && now > this.star.until) this.star = null;
    this.shell.setScore(this.score);
  }

  private frame(t: number) {
    this.raf = requestAnimationFrame(tt => this.frame(tt));
    const dt = Math.min(100, t - this.last);
    this.last = t;
    if (this.started && !this.shell.paused && !this.shell.ended) {
      this.acc += dt;
      while (this.acc >= this.stepMs && !this.shell.ended) { this.acc -= this.stepMs; this.tick(t); }
    }
    const g = this.g, cs = this.cell;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    g.clearRect(0, 0, this.w, this.hgt);
    g.fillStyle = 'rgba(20,12,50,0.7)';
    g.beginPath(); g.roundRect(this.ox - 4, this.oy - 4, cs * COLS + 8, cs * ROWS + 8, 14); g.fill();
    g.strokeStyle = 'rgba(255,207,90,0.55)'; g.lineWidth = 1.5; g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.05)';
    for (let r = 0; r < ROWS; r++) for (let c = (r % 2); c < COLS; c += 2) g.fillRect(this.ox + c * cs, this.oy + r * cs, cs, cs);
    const at = (p: P): P => [this.ox + p[1] * cs + cs / 2, this.oy + p[0] * cs + cs / 2];
    // food pulses gently
    const [fx, fy] = at(this.food.p);
    drawPiece(g, this.food.tier, fx, fy, cs * (0.42 + 0.04 * Math.sin(t / 180)), this.theme, this.dpr);
    if (this.star) {
      const [sx, sy] = at(this.star.p);
      g.globalAlpha = this.star.until - t < 1500 ? 0.5 + 0.5 * Math.sin(t / 60) : 1;
      drawPiece(g, 10, sx, sy, cs * 0.55, this.theme, this.dpr);
      g.globalAlpha = 1;
    }
    // glowing trail behind the body
    g.strokeStyle = 'rgba(160,220,255,0.25)';
    g.lineWidth = cs * 0.5; g.lineCap = 'round'; g.lineJoin = 'round';
    g.beginPath();
    this.body.forEach((b, i) => { const [x, y] = at(b.p); if (i) g.lineTo(x, y); else g.moveTo(x, y); });
    g.stroke();
    for (let i = this.body.length - 1; i > 0; i--) {
      const [x, y] = at(this.body[i].p);
      drawPiece(g, this.body[i].tier, x, y, cs * 0.4, this.theme, this.dpr);
    }
    if (!this.started) {
      g.fillStyle = 'rgba(255,255,255,0.9)';
      g.font = '800 18px Fredoka, Nunito, sans-serif';
      g.textAlign = 'center';
      g.fillText(tr('Swipe to start'), this.w / 2, this.oy + cs * 3);
    }
    const [hx, hy] = at(this.body[0].p);
    g.save();
    g.translate(hx, hy);
    g.rotate(Math.atan2(this.dir[0], this.dir[1]) + Math.PI);
    g.shadowColor = TIER_COLORS[3]; g.shadowBlur = 12;
    drawPiece(g, COMET, 0, 0, cs * 0.55, this.theme, this.dpr);
    g.restore();
  }
}

function same(a: P, b: P) { return a[0] === b[0] && a[1] === b[1]; }
