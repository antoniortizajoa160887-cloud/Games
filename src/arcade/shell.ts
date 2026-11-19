import { playMusic, sfx, type Track } from '../audio';
import { h } from '../ui/dom';

/** What every Arcade game hands back to the menu screens. */
export interface ArcadeGame {
  readonly el: HTMLElement;
  destroy(): void;
  back(): boolean;
}

export interface ArcadeHooks {
  onEnd(score: number): void;
  onQuit(): void;
  onRestart(): void;
}

/**
 * The frame shared by the Arcade games: top bar with pause, title and score, a body the game
 * fills, and the pause menu.
 */
export class Shell {
  readonly el: HTMLElement;
  readonly body: HTMLElement;
  private scoreEl: HTMLElement;
  private subEl: HTMLElement;
  paused = false;
  ended = false;
  onPause: (paused: boolean) => void = () => {};

  constructor(title: string, sub: string, private hooks: ArcadeHooks, music: Track = 'play') {
    this.scoreEl = h('div.score-num', {}, '0');
    this.subEl = h('div.score-sub', {}, sub);
    this.body = h('div.arcade-body', {});
    this.el = h('div.screen.play.arcade', {},
      h('div.arcade-top', {},
        h('button.icon-btn', { onclick: () => this.togglePause(), 'aria-label': 'Pause' }, 'II'),
        h('div.score-box', {}, h('div.mode-title', {}, title), this.scoreEl, this.subEl),
        h('span.arcade-spacer'),
      ),
      this.body,
    );
    playMusic(music);
  }

  setScore(n: number) { this.scoreEl.textContent = n.toLocaleString('en-US'); }
  setSub(text: string) { this.subEl.textContent = text; }

  togglePause() {
    if (this.ended) return;
    this.paused = !this.paused;
    this.el.querySelector('.modal')?.remove();
    this.onPause(this.paused);
    if (!this.paused) return;
    sfx.click();
    this.el.append(h('div.modal', {},
      h('h2', {}, 'Paused'),
      h('button.btn.primary', { onclick: () => this.togglePause() }, '▶ Resume'),
      h('button.btn', { onclick: () => { this.ended = true; this.hooks.onRestart(); } }, '↻ Restart'),
      h('button.btn', { onclick: () => { this.ended = true; this.hooks.onQuit(); } }, '⌂ Quit'),
    ));
  }

  /** Back button: pause first, quit from the pause menu. */
  back(): boolean {
    if (this.ended) return false;
    if (this.paused) { this.ended = true; this.hooks.onQuit(); return true; }
    this.togglePause();
    return true;
  }

  finish(score: number, delay = 700) {
    if (this.ended) return;
    this.ended = true;
    setTimeout(() => this.hooks.onEnd(score), delay);
  }
}

/** Keeps a canvas sized to its parent at the device pixel ratio (capped at 2). */
export function fitCanvas(canvas: HTMLCanvasElement, onResize: (w: number, h: number, dpr: number) => void): ResizeObserver {
  const ro = new ResizeObserver(() => {
    const r = canvas.parentElement!.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(r.width * dpr);
    canvas.height = Math.round(r.height * dpr);
    canvas.style.width = `${r.width}px`;
    canvas.style.height = `${r.height}px`;
    onResize(r.width, r.height, dpr);
  });
  ro.observe(canvas.parentElement!);
  return ro;
}

/** Six pieces per theme that are easy to tell apart at a glance (for match games). */
export const DISTINCT: Record<'space' | 'sea' | 'gems' | 'sweets', number[]> = {
  space: [0, 2, 4, 5, 7, 9],
  sea: [0, 3, 4, 6, 7, 9],
  gems: [0, 1, 2, 4, 5, 9],
  sweets: [1, 2, 3, 4, 6, 7],
};
