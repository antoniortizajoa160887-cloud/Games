import { playMusic, sfx } from '../audio';
import { buzz } from '../platform';
import { profile } from '../save';
import { h } from '../ui/dom';
import { sprite, THEME_NAMES, TIER_COLORS, type Theme } from './art';

export interface CatcherResult { score: number; best: boolean }

interface Faller { tier: number; x: number; y: number; vy: number; r: number; spin: number; angle: number }
interface Spark { x: number; y: number; vx: number; vy: number; life: number; color: string }

const DURATION = 60;

/**
 * Star Catcher minigame: pieces fall from the sky. Tap the ones that match the target before
 * they leave the screen. The target changes every few catches and everything speeds up.
 */
export class CatcherSession {
  readonly el: HTMLElement;
  private canvas: HTMLCanvasElement;
  private g: CanvasRenderingContext2D;
  private theme: Theme = profile.settings.theme;
  private fallers: Faller[] = [];
  private sparks: Spark[] = [];
  private score = 0;
  private streak = 0;
  private target = 2;
  private caught = 0;
  private spawnIn = 0;
  private time = DURATION;
  private raf = 0;
  private last = performance.now();
  private ended = false;
  private paused = false;
  private dpr = 1;
  private hudScore: HTMLElement;
  private hudTime: HTMLElement;
  private hudTarget: HTMLCanvasElement;
  private hudTargetName: HTMLElement;

  constructor(private onEnd: (r: CatcherResult) => void, private onQuit: () => void) {
    this.canvas = h('canvas.board') as HTMLCanvasElement;
    this.g = this.canvas.getContext('2d')!;
    this.hudScore = h('div.score-num', {}, '0');
    this.hudTime = h('div.goal-pill', {}, `⏱ ${DURATION}s`);
    this.hudTarget = h('canvas.next-preview', { width: 96, height: 96 }) as HTMLCanvasElement;
    this.hudTargetName = h('div.next-label', {}, '');
    this.el = h('div.screen.play', {},
      this.canvas,
      h('div.hud', {},
        h('div.hud-top', {},
          h('button.icon-btn', { onclick: () => this.togglePause(), 'aria-label': 'Pause' }, 'II'),
          h('div.score-box', {}, h('div.mode-title', {}, 'Star Catcher'), this.hudScore, h('div.score-sub', {}, profile.bestCatcher ? `Best ${profile.bestCatcher}` : 'Tap the matching pieces')),
          h('div.next-box', {}, h('div.next-label', {}, 'Catch'), this.hudTarget, this.hudTargetName),
        ),
        this.hudTime,
      ),
    );
    this.canvas.addEventListener('pointerdown', e => this.tap(e));
    new ResizeObserver(() => this.resize()).observe(this.el);
    playMusic('catcher');
    this.drawTarget();
    this.raf = requestAnimationFrame(t => this.frame(t));
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    this.el.remove();
  }

  back(): boolean {
    if (this.ended) return false;
    this.togglePause();
    return true;
  }

  private togglePause() {
    if (this.ended) return;
    this.paused = !this.paused;
    this.el.querySelector('.modal')?.remove();
    if (this.paused) {
      this.el.append(h('div.modal', {},
        h('h2', {}, 'Paused'),
        h('button.btn.primary', { onclick: () => this.togglePause() }, '▶ Resume'),
        h('button.btn', { onclick: () => { this.ended = true; this.onQuit(); } }, '⌂ Quit to menu'),
      ));
    } else this.last = performance.now();
  }

  private resize() {
    const rect = this.el.getBoundingClientRect();
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(rect.width * this.dpr);
    this.canvas.height = Math.round(rect.height * this.dpr);
  }

  private drawTarget() {
    const c = this.hudTarget, g = c.getContext('2d')!;
    g.clearRect(0, 0, c.width, c.height);
    const s = sprite(this.target, 30, this.theme);
    g.drawImage(s, c.width / 2 - s.width / 2, c.height / 2 - s.height / 2);
    this.hudTargetName.textContent = THEME_NAMES[this.theme][this.target];
  }

  private tap(e: PointerEvent) {
    if (this.paused || this.ended) return;
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left, y = e.clientY - rect.top;
    for (let i = this.fallers.length - 1; i >= 0; i--) {
      const f = this.fallers[i];
      if (Math.hypot(f.x - x, f.y - y) > f.r + 14) continue;
      this.fallers.splice(i, 1);
      this.burst(f.x, f.y, TIER_COLORS[f.tier]);
      if (f.tier === this.target) {
        this.streak++;
        this.caught++;
        this.score += 10 + Math.min(this.streak, 10) * 2;
        sfx.hit();
        buzz(false);
        if (this.caught % 6 === 0) {
          this.target = Math.floor(Math.random() * 7);
          this.drawTarget();
          sfx.chain(3);
        }
      } else {
        this.streak = 0;
        this.score = Math.max(0, this.score - 15);
        this.time = Math.max(0, this.time - 2);
        sfx.miss();
        buzz(true);
      }
      this.hudScore.textContent = String(this.score);
      return;
    }
  }

  private burst(x: number, y: number, color: string) {
    for (let i = 0; i < 14; i++) {
      const a = Math.random() * Math.PI * 2, s = 1 + Math.random() * 4;
      this.sparks.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 1, color });
    }
  }

  private frame(t: number) {
    this.raf = requestAnimationFrame(tt => this.frame(tt));
    const dt = Math.min(50, t - this.last) / 1000;
    this.last = t;
    const w = this.canvas.width / this.dpr, hgt = this.canvas.height / this.dpr;
    if (!this.paused && !this.ended) {
      this.time -= dt;
      const speedUp = 1 + (DURATION - this.time) / DURATION * 1.2;
      this.spawnIn -= dt;
      if (this.spawnIn <= 0) {
        this.spawnIn = 0.55 / speedUp;
        // About a third of pieces match the target.
        const tier = Math.random() < 0.35 ? this.target : Math.floor(Math.random() * 7);
        const r = Math.min(44, Math.max(22, w * 0.06 + tier * 1.5));
        this.fallers.push({ tier, x: r + Math.random() * (w - 2 * r), y: 110, vy: (70 + Math.random() * 60) * speedUp, r, spin: (Math.random() - 0.5) * 2, angle: 0 });
      }
      for (const f of this.fallers) {
        f.y += f.vy * dt;
        f.angle += f.spin * dt;
      }
      const missed = this.fallers.filter(f => f.y - f.r > hgt && f.tier === this.target).length;
      if (missed) this.streak = 0;
      this.fallers = this.fallers.filter(f => f.y - f.r <= hgt);
      this.hudTime.textContent = `⏱ ${Math.ceil(Math.max(0, this.time))}s   🔥 ×${this.streak}`;
      if (this.time <= 0) this.finish();
    }
    const g = this.g;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const bg = g.createLinearGradient(0, 0, 0, hgt);
    bg.addColorStop(0, '#0f1a3c');
    bg.addColorStop(1, '#2a1650');
    g.fillStyle = bg;
    g.fillRect(0, 0, w, hgt);
    for (const f of this.fallers) {
      const s = sprite(f.tier, f.r * this.dpr, this.theme);
      const sw = s.width / this.dpr;
      g.save();
      g.translate(f.x, f.y);
      g.rotate(f.angle);
      g.drawImage(s, -sw / 2, -sw / 2, sw, sw);
      g.restore();
    }
    for (const s of this.sparks) {
      s.x += s.vx;
      s.y += s.vy;
      s.life -= dt * 1.8;
      g.globalAlpha = Math.max(0, s.life);
      g.fillStyle = s.color;
      g.beginPath();
      g.arc(s.x, s.y, 3, 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;
    this.sparks = this.sparks.filter(s => s.life > 0);
  }

  private finish() {
    this.ended = true;
    const best = this.score > profile.bestCatcher;
    sfx.win();
    setTimeout(() => this.onEnd({ score: this.score, best }), 600);
  }
}
