import { sfx } from '../audio';
import { TIERS } from '../core/tiers';
import { pieceEl, type Theme } from '../game/art';
import { buzz } from '../platform';
import { profile } from '../save';
import { h } from '../ui/dom';
import { Shell, type ArcadeGame, type ArcadeHooks } from './shell';

const N = 4;
const STAR = TIERS.length - 1;

interface Tile { id: number; tier: number; r: number; c: number; el: HTMLElement }

/** Planet Fusion: swipe the board; two equal pieces that collide merge into the next one. */
export class FusionGame implements ArcadeGame {
  readonly el: HTMLElement;
  private shell: Shell;
  private board: HTMLElement;
  private tiles: Tile[] = [];
  private nextId = 1;
  private score = 0;
  private cell = 70;
  private gap = 8;
  private busy = false;
  private theme: Theme = profile.settings.theme;
  private start: { x: number; y: number } | null = null;
  private ro: ResizeObserver;
  private onKey = (e: KeyboardEvent) => {
    const d = ({ ArrowLeft: [0, -1], ArrowRight: [0, 1], ArrowUp: [-1, 0], ArrowDown: [1, 0] } as Record<string, [number, number]>)[e.key];
    if (d) { e.preventDefault(); this.move(d[0], d[1]); }
  };

  constructor(hooks: ArcadeHooks) {
    this.shell = new Shell('Planet Fusion', profile.arcade.fusion ? `Best ${profile.arcade.fusion.toLocaleString('en-US')}` : 'Swipe to merge', hooks);
    this.el = this.shell.el;
    this.board = h('div.fusion-board', {});
    for (let i = 0; i < N * N; i++) this.board.append(h('div.fusion-cell', {}));
    this.shell.body.append(h('div.fusion-wrap', {}, this.board), h('p.arcade-hint', {}, 'Swipe up, down, left or right. Two matching pieces merge into the next one. Make a Star!'));
    this.board.addEventListener('pointerdown', e => { this.start = { x: e.clientX, y: e.clientY }; });
    this.board.addEventListener('pointerup', e => this.swipe(e));
    this.board.addEventListener('pointercancel', () => { this.start = null; });
    window.addEventListener('keydown', this.onKey);
    this.ro = new ResizeObserver(() => this.layout());
    this.ro.observe(this.shell.body);
    this.spawn();
    this.spawn();
  }

  destroy() {
    this.ro.disconnect();
    window.removeEventListener('keydown', this.onKey);
    this.el.remove();
  }

  back() { return this.shell.back(); }

  private layout() {
    const w = Math.min(this.shell.body.clientWidth - 24, 420);
    this.gap = Math.round(w * 0.025);
    this.cell = Math.floor((w - this.gap * (N + 1)) / N);
    const size = this.cell * N + this.gap * (N + 1);
    this.board.style.width = this.board.style.height = `${size}px`;
    [...this.board.querySelectorAll<HTMLElement>('.fusion-cell')].forEach((c, i) => this.place(c, Math.floor(i / N), i % N));
    for (const t of this.tiles) {
      t.el.replaceChildren(pieceEl(t.tier, this.cell * 0.44, this.theme));
      this.place(t.el, t.r, t.c);
    }
  }

  private place(el: HTMLElement, r: number, c: number) {
    el.style.width = el.style.height = `${this.cell}px`;
    el.style.transform = `translate(${this.gap + c * (this.cell + this.gap)}px, ${this.gap + r * (this.cell + this.gap)}px)`;
  }

  private addTile(tier: number, r: number, c: number, cls: string) {
    const el = h('div.fusion-tile.' + cls, {}, pieceEl(tier, this.cell * 0.44, this.theme));
    const t: Tile = { id: this.nextId++, tier, r, c, el };
    this.place(el, r, c);
    this.board.append(el);
    this.tiles.push(t);
    return t;
  }

  private spawn() {
    const free: Array<[number, number]> = [];
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (!this.at(r, c)) free.push([r, c]);
    if (!free.length) return;
    const [r, c] = free[Math.floor(Math.random() * free.length)];
    this.addTile(Math.random() < 0.88 ? 0 : 1, r, c, 'spawn');
  }

  private at(r: number, c: number) {
    return this.tiles.find(t => t.r === r && t.c === c);
  }

  private swipe(e: PointerEvent) {
    if (!this.start) return;
    const dx = e.clientX - this.start.x, dy = e.clientY - this.start.y;
    this.start = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
    if (Math.abs(dx) > Math.abs(dy)) this.move(0, dx > 0 ? 1 : -1);
    else this.move(dy > 0 ? 1 : -1, 0);
  }

  private move(dr: number, dc: number) {
    if (this.busy || this.shell.paused || this.shell.ended) return;
    let moved = false;
    let gained = 0;
    let best = -1;
    const merged = new Set<number>();
    const doomed: Tile[] = [];
    const lines = [...Array(N).keys()];
    const order = dr > 0 || dc > 0 ? [...lines].reverse() : lines;
    for (const a of lines) {
      for (const b of order) {
        const r = dr ? b : a, c = dc ? b : a;
        const t = this.tiles.find(x => x.r === r && x.c === c && !doomed.includes(x));
        if (!t) continue;
        let nr = r, nc = c;
        while (true) {
          const tr = nr + dr, tc = nc + dc;
          if (tr < 0 || tr >= N || tc < 0 || tc >= N) break;
          const o = this.tiles.find(x => x.r === tr && x.c === tc && !doomed.includes(x));
          if (!o) { nr = tr; nc = tc; continue; }
          if (o.tier === t.tier && !merged.has(o.id)) {
            // Merge into o: t slides onto it and disappears.
            doomed.push(t);
            nr = tr; nc = tc;
            if (o.tier >= STAR) {
              doomed.push(o);
              gained += 2000;
            } else {
              o.tier++;
              merged.add(o.id);
              gained += 2 ** (o.tier + 1);
              best = Math.max(best, o.tier);
            }
          }
          break;
        }
        if (nr !== r || nc !== c) {
          moved = true;
          t.r = nr; t.c = nc;
          this.place(t.el, nr, nc);
        }
      }
    }
    if (!moved) return;
    this.busy = true;
    sfx.drop();
    setTimeout(() => {
      for (const t of doomed) t.el.remove();
      this.tiles = this.tiles.filter(t => !doomed.includes(t));
      for (const t of this.tiles) {
        if (!merged.has(t.id)) continue;
        t.el.replaceChildren(pieceEl(t.tier, this.cell * 0.44, this.theme));
        t.el.classList.remove('pop');
        void t.el.offsetWidth;
        t.el.classList.add('pop');
      }
      if (best >= 0) { sfx.merge(best, 1); buzz(best >= 6); }
      if (gained >= 2000) sfx.supernova();
      this.score += gained;
      this.shell.setScore(this.score);
      this.spawn();
      this.busy = false;
      if (!this.canMove()) {
        sfx.gameOver();
        this.shell.finish(this.score, 900);
      }
    }, 130);
  }

  private canMove() {
    if (this.tiles.length < N * N) return true;
    for (const t of this.tiles) {
      const right = this.at(t.r, t.c + 1), down = this.at(t.r + 1, t.c);
      if (right?.tier === t.tier || down?.tier === t.tier) return true;
    }
    return false;
  }
}
