import { sfx } from '../audio';
import { drawPiece, type Theme } from '../game/art';
import { buzz } from '../platform';
import { profile } from '../save';
import { h } from '../ui/dom';
import { DISTINCT, fitCanvas, Shell, type ArcadeGame, type ArcadeHooks } from './shell';

const N = 8;
const MOVES = 30;

interface Cell { tier: number; y: number; vy: number; dying: number }

/** Gem Swap: swap neighbours to line up three or more of the same piece. 30 moves. */
export class Match3Game implements ArcadeGame {
  readonly el: HTMLElement;
  private shell: Shell;
  private canvas: HTMLCanvasElement;
  private g: CanvasRenderingContext2D;
  private theme: Theme = profile.settings.theme;
  private kinds = DISTINCT[this.theme];
  private grid: Array<Array<Cell | null>> = [];
  private w = 0; private hgt = 0; private dpr = 1; private cs = 40; private ox = 0; private oy = 0;
  private sel: [number, number] | null = null;
  private start: { x: number; y: number; r: number; c: number } | null = null;
  private swap: { a: [number, number]; b: [number, number]; t: number; back: boolean } | null = null;
  private moves = MOVES;
  private score = 0;
  private combo = 0;
  private idleSince = performance.now();
  private hint: [[number, number], [number, number]] | null = null;
  private raf = 0;
  private ro: ResizeObserver;

  constructor(hooks: ArcadeHooks) {
    this.shell = new Shell('Gem Swap', `${MOVES} moves`, hooks);
    this.el = this.shell.el;
    this.canvas = h('canvas.arcade-canvas') as HTMLCanvasElement;
    this.g = this.canvas.getContext('2d')!;
    this.shell.body.append(h('div.canvas-wrap', {}, this.canvas), h('p.arcade-hint', {}, 'Swipe a piece onto its neighbour. Line up 3 or more. Longer lines score more.'));
    for (let r = 0; r < N; r++) {
      this.grid.push([]);
      for (let c = 0; c < N; c++) {
        let t: number;
        do t = this.kinds[Math.floor(Math.random() * this.kinds.length)];
        while ((c >= 2 && this.grid[r][c - 1]!.tier === t && this.grid[r][c - 2]!.tier === t) || (r >= 2 && this.grid[r - 1][c]!.tier === t && this.grid[r - 2][c]!.tier === t));
        this.grid[r].push({ tier: t, y: r - N - 1 + r * 0.3, vy: 0, dying: 0 });
      }
    }
    this.ro = fitCanvas(this.canvas, (w, hh, d) => { this.w = w; this.hgt = hh; this.dpr = d; this.layout(); });
    this.canvas.addEventListener('pointerdown', e => this.down(e));
    this.canvas.addEventListener('pointermove', e => this.move(e));
    this.canvas.addEventListener('pointerup', () => { this.start = null; });
    this.raf = requestAnimationFrame(() => this.frame());
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    this.el.remove();
  }

  back() { return this.shell.back(); }

  private layout() {
    this.cs = Math.floor(Math.min((this.w - 20) / N, (this.hgt - 20) / N));
    this.ox = (this.w - this.cs * N) / 2;
    this.oy = 8;
  }

  private settled() {
    return !this.swap && this.grid.every((row, r) => row.every(c => c && !c.dying && Math.abs(c.y - r) < 0.001));
  }

  private cellAt(x: number, y: number): [number, number] | null {
    const c = Math.floor((x - this.ox) / this.cs), r = Math.floor((y - this.oy) / this.cs);
    return r >= 0 && r < N && c >= 0 && c < N ? [r, c] : null;
  }

  private down(e: PointerEvent) {
    if (this.shell.paused || this.shell.ended || !this.settled() || this.moves <= 0) return;
    const p = this.cellAt(e.offsetX, e.offsetY);
    if (!p) return;
    this.canvas.setPointerCapture(e.pointerId);
    if (this.sel && Math.abs(this.sel[0] - p[0]) + Math.abs(this.sel[1] - p[1]) === 1) {
      this.trySwap(this.sel, p);
      this.sel = null;
      return;
    }
    this.sel = p;
    this.start = { x: e.offsetX, y: e.offsetY, r: p[0], c: p[1] };
    sfx.click();
  }

  private move(e: PointerEvent) {
    if (!this.start) return;
    const dx = e.offsetX - this.start.x, dy = e.offsetY - this.start.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < this.cs * 0.35) return;
    const to: [number, number] = Math.abs(dx) > Math.abs(dy) ? [this.start.r, this.start.c + (dx > 0 ? 1 : -1)] : [this.start.r + (dy > 0 ? 1 : -1), this.start.c];
    const from: [number, number] = [this.start.r, this.start.c];
    this.start = null;
    this.sel = null;
    if (to[0] < 0 || to[0] >= N || to[1] < 0 || to[1] >= N) return;
    this.trySwap(from, to);
  }

  /** A swap that makes a line, or null when the board is stuck. */
  private findMove(): [[number, number], [number, number]] | null {
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      for (const [dr, dc] of [[0, 1], [1, 0]]) {
        const b: [number, number] = [r + dr, c + dc];
        if (b[0] >= N || b[1] >= N) continue;
        this.exchange([r, c], b);
        const ok = this.matches().size > 0;
        this.exchange([r, c], b);
        if (ok) return [[r, c], b];
      }
    }
    return null;
  }

  private trySwap(a: [number, number], b: [number, number]) {
    this.idleSince = performance.now();
    this.hint = null;
    this.exchange(a, b);
    const ok = this.matches().size > 0;
    this.exchange(a, b);
    this.swap = { a, b, t: 0, back: !ok };
    sfx.drop();
  }

  private exchange(a: [number, number], b: [number, number]) {
    const t = this.grid[a[0]][a[1]];
    this.grid[a[0]][a[1]] = this.grid[b[0]][b[1]];
    this.grid[b[0]][b[1]] = t;
  }

  /** Cells in a line of 3+, as "r,c" keys, with the line lengths summed for scoring. */
  private matches() {
    const hit = new Map<string, number>();
    const scan = (get: (i: number, j: number) => Cell | null, key: (i: number, j: number) => string) => {
      for (let i = 0; i < N; i++) {
        let run = 1;
        for (let j = 1; j <= N; j++) {
          const cur = j < N ? get(i, j) : null, prev = get(i, j - 1);
          if (cur && prev && cur.tier === prev.tier && !cur.dying && !prev.dying) run++;
          else {
            if (run >= 3) for (let k = j - run; k < j; k++) hit.set(key(i, k), Math.max(hit.get(key(i, k)) ?? 0, run));
            run = 1;
          }
        }
      }
    };
    scan((i, j) => this.grid[i][j], (i, j) => `${i},${j}`);
    scan((i, j) => this.grid[j][i], (i, j) => `${j},${i}`);
    return hit;
  }

  private resolve() {
    const hit = this.matches();
    if (!hit.size) {
      this.combo = 0;
      if (this.moves <= 0) { sfx.win(); this.shell.finish(this.score, 600); return; }
      if (!this.findMove()) {
        // No move left: drop in a fresh set of pieces.
        for (const row of this.grid) for (const c of row) if (c) c.dying = 0.001;
        this.combo = 1;
      }
      return;
    }
    this.combo++;
    let pts = 0;
    for (const [k, len] of hit) {
      const [r, c] = k.split(',').map(Number);
      this.grid[r][c]!.dying = 0.001;
      pts += len >= 5 ? 40 : len === 4 ? 25 : 10;
    }
    this.score += pts * this.combo;
    this.shell.setScore(this.score);
    sfx.merge(Math.min(10, 2 + hit.size), this.combo);
    if (this.combo > 1) sfx.chain(this.combo);
    buzz(hit.size > 4);
  }

  private collapse() {
    for (let c = 0; c < N; c++) {
      const col: Cell[] = [];
      for (let r = N - 1; r >= 0; r--) if (this.grid[r][c] && !this.grid[r][c]!.dying) col.push(this.grid[r][c]!);
      const missing = N - col.length;
      for (let k = 0; k < missing; k++) col.push({ tier: this.kinds[Math.floor(Math.random() * this.kinds.length)], y: -1 - k, vy: 0, dying: 0 });
      for (let r = N - 1, i = 0; r >= 0; r--, i++) this.grid[r][c] = col[i];
    }
  }

  private frame() {
    this.raf = requestAnimationFrame(() => this.frame());
    const paused = this.shell.paused;
    // swap animation
    if (this.swap && !paused) {
      this.swap.t += 1 / 9;
      if (this.swap.t >= 1) {
        const s = this.swap;
        if (s.back) { this.swap = null; sfx.miss(); }
        else {
          this.exchange(s.a, s.b);
          this.swap = null;
          this.moves--;
          this.shell.setSub(`${this.moves} moves left`);
          this.resolve();
        }
      }
    }
    // dying pieces shrink, then the column falls
    let anyDying = false;
    for (const row of this.grid) for (const c of row) if (c?.dying) { anyDying = true; if (!paused) c.dying += 1 / 12; }
    if (anyDying && this.grid.every(row => row.every(c => !c?.dying || c.dying >= 1))) this.collapse();
    let falling = false;
    if (!paused) this.grid.forEach((row, r) => row.forEach(c => {
      if (!c || c.dying) return;
      if (c.y < r) { c.vy += 0.025; c.y = Math.min(r, c.y + c.vy); falling = true; } else { c.y = r; c.vy = 0; }
    }));
    if (!falling && !anyDying && !this.swap && this.combo > 0 && !this.shell.ended) this.resolve();
    if (!falling && !anyDying && !this.swap && this.combo === 0 && this.moves <= 0 && !this.shell.ended) this.resolve();

    const g = this.g, cs = this.cs;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    g.clearRect(0, 0, this.w, this.hgt);
    g.fillStyle = 'rgba(20,12,50,0.75)';
    g.beginPath(); g.roundRect(this.ox - 5, this.oy - 5, cs * N + 10, cs * N + 10, 14); g.fill();
    g.strokeStyle = 'rgba(255,207,90,0.55)'; g.lineWidth = 1.5; g.stroke();
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      g.fillStyle = (r + c) % 2 ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.03)';
      g.fillRect(this.ox + c * cs, this.oy + r * cs, cs, cs);
    }
    if (this.sel) {
      g.strokeStyle = '#ffcf5a'; g.lineWidth = 3;
      g.beginPath(); g.roundRect(this.ox + this.sel[1] * cs + 2, this.oy + this.sel[0] * cs + 2, cs - 4, cs - 4, 8); g.stroke();
    }
    if (this.settled() && this.moves > 0 && performance.now() - this.idleSince > 5000) {
      this.hint ??= this.findMove();
      if (this.hint) {
        g.strokeStyle = `rgba(255,255,255,${0.4 + 0.4 * Math.sin(performance.now() / 150)})`; g.lineWidth = 3;
        for (const [hr, hc] of this.hint) { g.beginPath(); g.roundRect(this.ox + hc * cs + 3, this.oy + hr * cs + 3, cs - 6, cs - 6, 8); g.stroke(); }
      }
    }
    g.save();
    g.beginPath(); g.rect(this.ox, this.oy, cs * N, cs * N); g.clip();
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      const cell = this.grid[r][c];
      if (!cell) continue;
      let x = c, y = cell.y;
      if (this.swap) {
        const k = this.swap.back ? Math.sin(this.swap.t * Math.PI) : this.swap.t;
        const { a, b } = this.swap;
        if (r === a[0] && c === a[1]) { x += (b[1] - a[1]) * k; y += (b[0] - a[0]) * k; }
        if (r === b[0] && c === b[1]) { x += (a[1] - b[1]) * k; y += (a[0] - b[0]) * k; }
      }
      const s = cell.dying ? Math.max(0, 1 - cell.dying) * (1 + cell.dying * 0.4) : 1;
      if (s <= 0) continue;
      drawPiece(g, cell.tier, this.ox + x * cs + cs / 2, this.oy + y * cs + cs / 2, cs * 0.45 * s, this.theme, this.dpr);
    }
    g.restore();
  }
}
