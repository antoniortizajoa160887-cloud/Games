import Matter from 'matter-js';
import { applyVolumes, playMusic, sfx, type Track } from '../audio';
import { DOME_HEIGHT, goalText, starsFor, twistText, type Goal, type LevelDef, type Peg } from '../core/levels';
import { rng } from '../core/rng';
import { coinsFor, ScoreKeeper } from '../core/scoring';
import { COMET, COMET_EVERY, DROP_WEIGHTS, STAR } from '../core/tiers';
import { buzz } from '../platform';
import { profile, save, track, type PowerUp } from '../save';
import { h } from '../ui/dom';
import { drawFace, FINALE_NAME, hasArt, mascotUrl, sprite, THEME_NAMES, themeBg, TIER_COLORS, tierRadius, type Pose, type Theme } from './art';

const { Engine, Bodies, Body, Composite, Events } = Matter;

export type ModeKind = 'classic' | 'daily' | 'level' | 'challenge' | 'rush' | 'zen' | 'tiny';

export interface ModeConfig {
  kind: ModeKind;
  title: string;
  width: number;
  pegs: Peg[];
  maxDropTier: number;
  seed?: number;
  goal?: Goal;
  drops?: number;
  timeLimit?: number; // seconds
  noOverflow?: boolean;
  noPulse?: boolean;
  noComet?: boolean;
  dropCooldown: number; // ms
  powerUps: boolean;
  secondChance: boolean;
  music: Track;
  level?: LevelDef;
}

export interface RunResult {
  mode: ModeConfig;
  score: number;
  biggest: number;
  bestChain: number;
  won?: boolean;
  stars?: number;
  coins: number;
  reason: 'overflow' | 'time' | 'goal' | 'drops' | 'quit';
}

export function levelMode(level: LevelDef, kind: 'level' | 'challenge' = 'level'): ModeConfig {
  return {
    kind,
    title: kind === 'challenge' ? 'Daily Challenge' : `Level ${level.id}`,
    width: level.width,
    pegs: level.pegs,
    maxDropTier: level.maxDropTier,
    seed: kind === 'challenge' ? undefined : 1000 + level.id,
    goal: level.goal,
    drops: level.drops,
    noPulse: level.twist === 'noPulse',
    noComet: level.twist === 'noComet',
    dropCooldown: level.twist === 'fastDrops' ? 220 : 420,
    powerUps: kind === 'level',
    secondChance: false,
    music: 'play',
    level,
  };
}

const RIM_Y = 70;
const HANG_Y = 28;
const OVER_LIMIT_MS = 3000;
const SAG = 34;

interface BodyData { tier: number; born: number; over: number; dead: boolean; seed: number }
type SBody = Matter.Body & { plugin: { sd?: BodyData } };

interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; size: number }
interface Ring { x: number; y: number; r: number; max: number; life: number; color: string }
interface Popup { x: number; y: number; text: string; life: number; color: string; size: number }

const easeOutBack = (t: number) => {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

/** One run of the merge game in any mode. */
export class PlaySession {
  readonly el: HTMLElement;
  private canvas: HTMLCanvasElement;
  private g: CanvasRenderingContext2D;
  private engine = Engine.create({ enableSleeping: false });
  private bodies: SBody[] = [];
  private keeper = new ScoreKeeper();
  private rand: () => number;
  private theme: Theme = profile.settings.theme;
  private names = THEME_NAMES[profile.settings.theme];
  private W: number;
  private H = DOME_HEIGHT;

  private current = 0;
  private next = 0;
  private aimX: number;
  private lastDrop = -1e9;
  private dropsUsed = 0;
  private lastDropAt = 0;
  private made = new Map<number, number>();
  private pulseCharge = 0;
  private pulses = 0;
  private usedSecondChance = false;
  private targeting: PowerUp | null = null;
  private paused = false;
  private ended = false;
  private startedAt = performance.now();
  private elapsedPaused = 0;
  private pauseStart = 0;
  private danger = 0;
  private cheerUntil = 0;
  private pose: Pose = 'wave';
  private lastWarn = 0;

  private particles: Particle[] = [];
  private rings: Ring[] = [];
  private popups: Popup[] = [];
  private shake = 0;
  private flash = 0;
  private blackHole = 0;
  private stars: Array<[number, number, number, number]> = [];

  private scale = 1;
  private ox = 0;
  private oy = 0;
  private dpr = 1;
  private raf = 0;
  private lastFrame = performance.now();
  private acc = 0;
  private merges: Array<[SBody, SBody]> = [];

  private hud: Record<string, HTMLElement> = {};
  private nextCanvas: HTMLCanvasElement;
  private resizeObs: ResizeObserver;
  private bg = document.createElement('canvas');

  constructor(private mode: ModeConfig, private onEnd: (r: RunResult) => void, private onQuit: () => void) {
    this.W = mode.width;
    this.aimX = this.W / 2;
    this.rand = rng(mode.seed ?? Math.floor(Math.random() * 2 ** 31));
    this.engine.gravity.y = 1.15;
    this.engine.positionIterations = 8;
    this.engine.velocityIterations = 6;

    this.canvas = h('canvas.board') as HTMLCanvasElement;
    this.g = this.canvas.getContext('2d')!;
    this.nextCanvas = h('canvas.next-preview', { width: 96, height: 96 }) as HTMLCanvasElement;
    this.el = h('div.screen.play', {}, this.canvas, this.buildHud());

    const sr = rng(7);
    for (let i = 0; i < 140; i++) this.stars.push([sr(), sr(), sr() * 1.6 + 0.3, sr() * 6]);

    this.buildWorld();
    this.current = this.rollTier();
    this.next = this.rollTier();
    this.bindInput();
    Events.on(this.engine, 'collisionStart', e => this.onCollide(e.pairs));
    Events.on(this.engine, 'collisionActive', e => this.onCollide(e.pairs));

    this.resizeObs = new ResizeObserver(() => this.resize());
    this.resizeObs.observe(this.el);
    playMusic(mode.music);
    this.updateHud();
    this.raf = requestAnimationFrame(t => this.frame(t));
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    this.resizeObs.disconnect();
    Engine.clear(this.engine);
    this.el.remove();
  }

  /** Android back button: pause first, then leave. */
  back(): boolean {
    if (this.ended) return false;
    if (!this.paused) this.pause();
    else this.quit();
    return true;
  }

  // ----- world -----

  private buildWorld() {
    const W = this.W, H = this.H;
    const opts = { isStatic: true, friction: 0.4, restitution: 0.05, label: 'wall' };
    const walls: Matter.Body[] = [
      Bodies.rectangle(-30, H / 2 - 200, 60, H + 600, opts),
      Bodies.rectangle(W + 30, H / 2 - 200, 60, H + 600, opts),
    ];
    // A rounded floor: short slabs following a shallow curve, so bodies roll to the middle.
    const N = 18;
    const fy = (x: number) => H - SAG * Math.pow((x - W / 2) / (W / 2), 2);
    for (let i = 0; i < N; i++) {
      const x0 = (W * i) / N, x1 = (W * (i + 1)) / N;
      const y0 = fy(x0), y1 = fy(x1);
      const ang = Math.atan2(y1 - y0, x1 - x0);
      const len = Math.hypot(x1 - x0, y1 - y0) + 4;
      const t = 40;
      const cx = (x0 + x1) / 2 - Math.sin(ang) * -t / 2;
      const cy = (y0 + y1) / 2 + Math.cos(ang) * t / 2;
      walls.push(Bodies.rectangle(cx, cy, len, t, { ...opts, angle: ang }));
    }
    for (const p of this.mode.pegs) walls.push(Bodies.circle(p.x, p.y, p.r, { ...opts, label: 'peg' }));
    Composite.add(this.engine.world, walls);
  }

  private floorY(x: number) {
    return this.H - SAG * Math.pow((x - this.W / 2) / (this.W / 2), 2);
  }

  private rollTier(): number {
    if (!this.mode.noComet && this.rand() < 1 / COMET_EVERY && this.dropsUsed > 3) return COMET;
    const w = DROP_WEIGHTS.slice(0, this.mode.maxDropTier + 1);
    let x = this.rand() * w.reduce((a, b) => a + b, 0);
    for (let i = 0; i < w.length; i++) {
      x -= w[i];
      if (x < 0) return i;
    }
    return 0;
  }

  private addBody(tier: number, x: number, y: number, vx = 0, vy = 0): SBody {
    const r = tierRadius(tier);
    const b = Bodies.circle(x, y, r, {
      restitution: 0.08,
      friction: 0.25,
      frictionStatic: 0.5,
      frictionAir: 0.012,
      density: 0.001,
      label: 'body',
    }) as SBody;
    b.plugin = { sd: { tier, born: this.now(), over: 0, dead: false, seed: Math.random() * 10 } };
    Body.setVelocity(b, { x: vx, y: vy });
    Composite.add(this.engine.world, b);
    this.bodies.push(b);
    return b;
  }

  private removeBody(b: SBody) {
    b.plugin.sd!.dead = true;
    Composite.remove(this.engine.world, b);
    this.bodies = this.bodies.filter(o => o !== b);
  }

  private now() {
    return performance.now() - this.elapsedPaused;
  }

  // ----- merging -----

  private onCollide(pairs: Matter.Pair[]) {
    for (const p of pairs) {
      const a = p.bodyA as SBody, b = p.bodyB as SBody;
      const da = a.plugin?.sd, db = b.plugin?.sd;
      if (!da || !db || da.dead || db.dead) continue;
      if (da.tier === db.tier && da.tier !== COMET) {
        da.dead = db.dead = true;
        this.merges.push([a, b]);
      } else if (da.tier === COMET || db.tier === COMET) {
        const comet = da.tier === COMET ? a : b;
        const other = comet === a ? b : a;
        if (other.plugin.sd!.tier === COMET) continue;
        comet.plugin.sd!.dead = other.plugin.sd!.dead = true;
        this.merges.push([comet, other]);
      }
    }
  }

  private processMerges() {
    const list = this.merges;
    this.merges = [];
    for (const [a, b] of list) {
      const ta = a.plugin.sd!.tier, tb = b.plugin.sd!.tier;
      const tier = ta === COMET ? tb : ta;
      const x = ta === COMET ? b.position.x : (a.position.x + b.position.x) / 2;
      const y = ta === COMET ? b.position.y : (a.position.y + b.position.y) / 2;
      this.removeBody(a);
      this.removeBody(b);
      if (ta === COMET) {
        this.burst(x, y, '#9ff3ff', 18, 1.3);
        this.popup(x, y - 20, 'Comet!', '#9ff3ff', 20);
      }
      if (tier >= STAR) {
        this.supernova(x, y);
        continue;
      }
      const nt = tier + 1;
      const vx = (a.velocity.x + b.velocity.x) / 2;
      this.addBody(nt, x, y, vx, -2.2);
      const res = this.keeper.merge(nt, this.now());
      this.made.set(nt, (this.made.get(nt) ?? 0) + 1);
      track({ type: 'make', tier: nt });
      if (res.chain >= 2) track({ type: 'chain', length: res.chain });
      this.burst(x, y, TIER_COLORS[nt], 10 + nt * 3, 1 + nt * 0.12);
      this.rings.push({ x, y, r: tierRadius(nt), max: tierRadius(nt) * 2.2, life: 0, color: TIER_COLORS[nt] });
      this.popup(x, y - tierRadius(nt) - 8, `+${res.points}`, '#fff', 16 + nt);
      if (res.chain >= 2) {
        this.popup(x, y - tierRadius(nt) - 34, `Chain ×${res.chain}!`, '#ffd84a', 20);
        sfx.chain(res.chain);
      }
      if (res.firstTime) this.popup(this.W / 2, 140, `New: ${this.names[nt]}!`, TIER_COLORS[nt], 26);
      if (nt >= 6) { this.shake = Math.min(14, 4 + nt); buzz(true); } else buzz(false);
      sfx.merge(nt, res.chain);
      if (nt >= 6 || res.chain >= 3 || res.firstTime) this.cheer(1600);
      this.pulseCharge++;
      if (this.pulseCharge >= 10) {
        this.pulseCharge = 0;
        if (this.pulses < 2) this.pulses++;
      }
      this.checkGoal();
    }
    if (list.length) this.updateHud();
  }

  private supernova(x: number, y: number) {
    this.keeper.supernova();
    track({ type: 'supernova' });
    this.flash = 1;
    this.shake = 22;
    buzz(true);
    sfx.supernova();
    this.cheer(2600);
    this.rings.push({ x, y, r: 10, max: 900, life: 0, color: '#fff7c0' });
    this.burst(x, y, '#fff2a0', 80, 3);
    this.popup(this.W / 2, 200, `${FINALE_NAME[this.theme]}! +500`, '#fff2a0', 34);
    for (const b of [...this.bodies]) {
      const t = b.plugin.sd!.tier;
      if (t <= 4) {
        this.burst(b.position.x, b.position.y, TIER_COLORS[Math.max(0, t)], 6, 1);
        this.removeBody(b);
      } else {
        const dx = b.position.x - x, dy = b.position.y - y;
        const d = Math.max(30, Math.hypot(dx, dy));
        Body.setVelocity(b, { x: (dx / d) * 8, y: (dy / d) * 8 - 4 });
      }
    }
    this.checkGoal();
  }

  // ----- effects -----

  private burst(x: number, y: number, color: string, n: number, power: number) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = (1 + Math.random() * 3) * power;
      this.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 1, life: 0, max: 500 + Math.random() * 500, color, size: 2 + Math.random() * 3 * power });
    }
  }

  private popup(x: number, y: number, text: string, color: string, size: number) {
    this.popups.push({ x, y, text, life: 0, color, size });
  }

  // ----- input -----

  private bindInput() {
    const toWorld = (e: PointerEvent) => {
      const rect = this.canvas.getBoundingClientRect();
      return { x: (e.clientX - rect.left - this.ox) / this.scale, y: (e.clientY - rect.top - this.oy) / this.scale };
    };
    let down = false;
    this.canvas.addEventListener('pointerdown', e => {
      if (this.paused || this.ended) return;
      down = true;
      this.canvas.setPointerCapture(e.pointerId);
      if (!this.targeting) this.aimX = toWorld(e).x;
    });
    this.canvas.addEventListener('pointermove', e => {
      if (!down || this.paused || this.targeting) return;
      this.aimX = toWorld(e).x;
    });
    this.canvas.addEventListener('pointerup', e => {
      if (!down) return;
      down = false;
      if (this.paused || this.ended) return;
      const p = toWorld(e);
      if (this.targeting) this.useTarget(p.x, p.y);
      else {
        this.aimX = p.x;
        this.drop();
      }
    });
  }

  private clampAim(tier: number) {
    const r = tierRadius(tier);
    return Math.max(r + 1, Math.min(this.W - r - 1, this.aimX));
  }

  private drop() {
    const t = this.now();
    if (t - this.lastDrop < this.mode.dropCooldown) return;
    if (this.mode.drops !== undefined && this.dropsUsed >= this.mode.drops) return;
    this.lastDrop = t;
    this.lastDropAt = t;
    const x = this.clampAim(this.current);
    this.addBody(this.current, x, HANG_Y, 0, 1);
    this.dropsUsed++;
    sfx.drop();
    this.current = this.next;
    this.next = this.rollTier();
    this.updateHud();
  }

  private usePulse() {
    if (this.mode.noPulse || this.pulses <= 0 || this.paused || this.ended) return;
    this.pulses--;
    track({ type: 'pulse' });
    sfx.pulse();
    buzz(true);
    this.shake = 10;
    this.rings.push({ x: this.W / 2, y: this.H, r: 20, max: 700, life: 0, color: '#9fdcff' });
    for (const b of this.bodies) {
      const lift = 6 + Math.random() * 3 - b.plugin.sd!.tier * 0.25;
      Body.setVelocity(b, { x: (Math.random() - 0.5) * 3, y: -Math.max(3, lift) });
    }
    this.updateHud();
  }

  private usePower(p: PowerUp) {
    if (this.paused || this.ended || profile.power[p] <= 0) return;
    sfx.click();
    if (p === 'swap') {
      profile.power.swap--;
      save();
      this.current = this.rollTier();
      if (this.current === COMET) this.current = 0;
      sfx.pop();
      this.updateHud();
      return;
    }
    this.targeting = this.targeting === p ? null : p;
    this.updateHud();
  }

  private useTarget(x: number, y: number) {
    const p = this.targeting!;
    const hit = this.bodies.find(b => Math.hypot(b.position.x - x, b.position.y - y) <= tierRadius(b.plugin.sd!.tier) + 6);
    if (!hit) {
      this.targeting = null;
      this.updateHud();
      return;
    }
    const tier = hit.plugin.sd!.tier;
    profile.power[p]--;
    save();
    this.targeting = null;
    if (p === 'pop') {
      this.burst(hit.position.x, hit.position.y, TIER_COLORS[Math.max(0, tier)], 16, 1.2);
      this.removeBody(hit);
      sfx.pop();
    } else if (p === 'boost' && tier >= 0) {
      const { x: bx, y: by } = hit.position;
      this.removeBody(hit);
      if (tier >= STAR) this.supernova(bx, by);
      else {
        this.addBody(tier + 1, bx, by, 0, -2);
        this.made.set(tier + 1, (this.made.get(tier + 1) ?? 0) + 1);
        track({ type: 'make', tier: tier + 1 });
        this.burst(bx, by, TIER_COLORS[tier + 1], 20, 1.4);
        sfx.merge(tier + 1, 1);
        this.checkGoal();
      }
    }
    this.updateHud();
  }

  // ----- rules -----

  private timeLeft(): number {
    if (!this.mode.timeLimit) return Infinity;
    return Math.max(0, this.mode.timeLimit - (this.now() - this.startedAt) / 1000);
  }

  private goalProgress(): { done: boolean; text: string } | null {
    const goal = this.mode.goal;
    if (!goal) return null;
    if (goal.kind === 'score') return { done: this.keeper.score >= goal.value, text: `${this.keeper.score.toLocaleString('en-US')} / ${goal.value.toLocaleString('en-US')}` };
    if (goal.kind === 'tier') {
      const done = [...this.made.keys()].some(t => t >= goal.tier) || this.keeper.biggest >= goal.tier;
      return { done, text: done ? 'Done!' : `Biggest: ${this.keeper.biggest >= 0 ? this.names[this.keeper.biggest] : '–'}` };
    }
    let n = 0;
    for (const [t, c] of this.made) if (t >= goal.tier) n += c;
    return { done: n >= goal.count, text: `${Math.min(n, goal.count)} / ${goal.count}` };
  }

  private checkGoal() {
    const gp = this.goalProgress();
    if (gp?.done && !this.ended) {
      const drops = this.mode.drops ?? 1;
      const stars = starsFor(drops - this.dropsUsed, drops);
      setTimeout(() => this.finish('goal', true, stars), 700);
      this.ended = true;
      sfx.win();
    }
  }

  private step(dt: number) {
    const now = this.now();
    // Overflow: a settled body resting above the rim line for 3 seconds ends the run.
    let danger = 0;
    for (const b of this.bodies) {
      const d = b.plugin.sd!;
      if (now - d.born < 1500) continue;
      if (b.position.y - tierRadius(d.tier) < RIM_Y) d.over += dt;
      else d.over = 0;
      danger = Math.max(danger, d.over);
      if (this.mode.noOverflow && d.over > 1200) {
        this.burst(b.position.x, b.position.y, TIER_COLORS[Math.max(0, d.tier)], 14, 1);
        this.removeBody(b);
        sfx.pop();
      }
    }
    this.danger = this.mode.noOverflow ? 0 : danger;
    if (this.danger > 0 && now - this.lastWarn > 700) {
      this.lastWarn = now;
      sfx.warn();
    }
    if (this.danger > OVER_LIMIT_MS) this.overflow();
    this.setPose(now < this.cheerUntil ? 'cheer' : this.danger > 0 ? 'worried' : 'wave');
    if (this.mode.timeLimit && this.timeLeft() <= 0) this.finish('time');
    if (this.mode.drops !== undefined && this.dropsUsed >= this.mode.drops && now - this.lastDropAt > 2500) this.finish('drops', false);
  }

  private overflow() {
    if (this.mode.secondChance && !this.usedSecondChance) {
      this.usedSecondChance = true;
      this.pause(false);
      const box = h('div.modal',
        {},
        h('h2', {}, 'Dome overflow!'),
        h('p', {}, 'Use your free Second Chance? A black hole will swallow the small pieces.'),
        h('button.btn.primary', { onclick: () => { box.remove(); this.resume(); this.secondChance(); } }, '🌀 Second Chance'),
        h('button.btn', { onclick: () => { box.remove(); this.resume(); this.finish('overflow'); } }, 'End run'),
      );
      this.el.append(box);
      return;
    }
    this.finish('overflow');
  }

  private secondChance() {
    this.blackHole = 1;
    sfx.supernova();
    for (const b of [...this.bodies]) {
      const t = b.plugin.sd!.tier;
      if (t <= 2) {
        this.burst(b.position.x, b.position.y, '#b48cff', 8, 0.8);
        this.removeBody(b);
      } else b.plugin.sd!.over = 0;
    }
    this.danger = 0;
  }

  private finish(reason: RunResult['reason'], won?: boolean, stars?: number) {
    if (this.ended && reason !== 'goal') return;
    this.ended = true;
    if (reason === 'overflow' || (reason === 'drops' && won === false)) sfx.gameOver();
    if (reason === 'time') sfx.win();
    const score = this.keeper.score;
    let coins = coinsFor(score);
    if (won && stars) coins += 10 * stars;
    const result: RunResult = { mode: this.mode, score, biggest: this.keeper.biggest, bestChain: this.keeper.bestChain, won, stars, coins, reason };
    if (this.mode.goal && reason !== 'goal') result.won = false;
    setTimeout(() => this.onEnd(result), reason === 'goal' ? 0 : 900);
  }

  pause(showMenu = true) {
    if (this.paused || this.ended) return;
    this.paused = true;
    this.pauseStart = performance.now();
    if (!showMenu) return;
    const box = h('div.modal',
      {},
      h('h2', {}, 'Paused'),
      h('button.btn.primary', { onclick: () => { box.remove(); this.resume(); } }, '▶ Resume'),
      h('button.btn', { onclick: () => { box.remove(); this.restart(); } }, '↻ Restart'),
      h('div.row',
        {},
        h('label', {}, '🎵', h('input', { type: 'range', min: 0, max: 1, step: 0.05, value: profile.settings.music, oninput: (e: Event) => { profile.settings.music = Number((e.target as HTMLInputElement).value); applyVolumes(); save(); } })),
        h('label', {}, '🔊', h('input', { type: 'range', min: 0, max: 1, step: 0.05, value: profile.settings.sfx, oninput: (e: Event) => { profile.settings.sfx = Number((e.target as HTMLInputElement).value); applyVolumes(); save(); } })),
      ),
      h('button.btn', { onclick: () => { box.remove(); this.quit(); } }, '⌂ Quit to menu'),
    );
    box.classList.add('pause-menu');
    this.el.append(box);
  }

  private resume() {
    if (!this.paused) return;
    this.paused = false;
    this.elapsedPaused += performance.now() - this.pauseStart;
    this.lastFrame = performance.now();
    this.el.querySelector('.pause-menu')?.remove();
  }

  private restart() {
    this.ended = true;
    this.onQuit();
    window.dispatchEvent(new CustomEvent('sd-restart', { detail: this.mode }));
  }

  private quit() {
    this.ended = true;
    this.onQuit();
  }

  // ----- Mascot -----

  private cheer(ms: number) {
    this.cheerUntil = Math.max(this.cheerUntil, this.now() + ms);
  }

  private setPose(p: Pose) {
    if (p === this.pose) return;
    this.pose = p;
    const m = this.hud.mascot as HTMLImageElement;
    m.src = mascotUrl(p);
    m.classList.remove('hop');
    void m.offsetWidth;
    m.classList.add('hop');
  }

  // ----- HUD -----

  private buildHud(): HTMLElement {
    const m = this.mode;
    this.hud.score = h('div.score-num', {}, '0');
    this.hud.sub = h('div.score-sub', {}, '');
    this.hud.goal = h('div.goal-pill', {}, '');
    this.hud.pulse = h('button.pulse-btn', { onclick: () => this.usePulse(), 'aria-label': 'Gravity Pulse' }, h('span.ring'), h('span.icon', {}, '✦'), h('span.count', {}, '0'));
    const power = (p: PowerUp, icon: string, label: string) => {
      const b = h('button.power', { onclick: () => this.usePower(p), 'aria-label': label }, h('span.icon', {}, icon), h('span.count', {}, '0'), h('span.label', {}, label));
      this.hud['p-' + p] = b;
      return b;
    };
    const bottom = h('div.hud-bottom', {},
      m.powerUps ? power('pop', '💥', 'Pop') : h('span.spacer'),
      m.powerUps ? power('swap', '🔄', 'Swap') : h('span.spacer'),
      m.noPulse ? h('span.spacer') : this.hud.pulse,
      m.powerUps ? power('boost', '⏫', 'Boost') : h('span.spacer'),
    );
    this.hud.mascot = h('img.hud-mascot', { src: mascotUrl('wave'), alt: '' });
    this.hud.hint = h('div.target-hint', {}, '');
    return h('div.hud', {},
      h('div.hud-top', {},
        h('button.icon-btn', { onclick: () => this.pause(), 'aria-label': 'Pause' }, 'II'),
        h('div.score-box', {}, h('div.mode-title', {}, m.title), this.hud.score, this.hud.sub),
        h('div.next-box', {}, h('div.next-label', {}, 'Next'), this.nextCanvas),
      ),
      this.hud.goal,
      this.hud.hint,
      bottom,
      this.hud.mascot,
    );
  }

  private updateHud() {
    const m = this.mode;
    this.hud.score.textContent = this.keeper.score.toLocaleString('en-US');
    const best = m.kind === 'classic' ? profile.bestClassic : m.kind === 'rush' ? profile.bestRush : m.kind === 'tiny' ? profile.bestTiny : m.kind === 'daily' ? profile.daily.best : 0;
    this.hud.sub.textContent = best ? `Best ${best.toLocaleString('en-US')}` : '';
    const parts: string[] = [];
    if (m.goal) {
      const gp = this.goalProgress()!;
      parts.push(`🎯 ${goalText(m.goal, this.names)} · ${gp.text}`);
    }
    if (m.drops !== undefined) parts.push(`⬇ ${Math.max(0, m.drops - this.dropsUsed)} drops`);
    if (m.timeLimit) parts.push(`⏱ ${Math.ceil(this.timeLeft())}s`);
    const tw = m.level ? twistText(m.level.twist) : null;
    if (tw) parts.push(`⚠ ${tw}`);
    this.hud.goal.textContent = parts.join('   ');
    this.hud.goal.style.display = parts.length ? '' : 'none';
    const pc = this.hud.pulse;
    pc.querySelector('.count')!.textContent = String(this.pulses);
    pc.classList.toggle('ready', this.pulses > 0);
    (pc.querySelector('.ring') as HTMLElement).style.setProperty('--p', String(this.pulses >= 2 ? 1 : this.pulseCharge / 10));
    for (const p of ['pop', 'swap', 'boost'] as PowerUp[]) {
      const b = this.hud['p-' + p];
      if (!b) continue;
      b.querySelector('.count')!.textContent = String(profile.power[p]);
      b.classList.toggle('empty', profile.power[p] <= 0);
      b.classList.toggle('active', this.targeting === p);
    }
    this.hud.hint.textContent = this.targeting === 'pop' ? 'Tap a piece to pop it' : this.targeting === 'boost' ? 'Tap a piece to level it up' : '';
    this.hud.hint.style.display = this.targeting ? '' : 'none';
    this.drawNext();
  }

  private drawNext() {
    const c = this.nextCanvas, g = c.getContext('2d')!;
    g.clearRect(0, 0, c.width, c.height);
    const r = this.next === COMET ? 22 : Math.min(36, 14 + this.next * 6);
    const s = sprite(this.next, r, this.theme);
    g.drawImage(s, c.width / 2 - s.width / 2, c.height / 2 - s.height / 2);
  }

  // ----- render loop -----

  private resize() {
    const rect = this.el.getBoundingClientRect();
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(rect.width * this.dpr);
    this.canvas.height = Math.round(rect.height * this.dpr);
    this.canvas.style.width = rect.width + 'px';
    this.canvas.style.height = rect.height + 'px';
    const top = 128, bottom = 104;
    const availH = Math.max(200, rect.height - top - bottom);
    const viewW = this.W + 36, viewH = this.H + 30 + 40;
    this.scale = Math.min((rect.width - 12) / viewW, availH / viewH);
    this.ox = (rect.width - this.W * this.scale) / 2;
    this.oy = top + (availH - viewH * this.scale) / 2 + 40 * this.scale;
    // Pre-render the sky so each frame only stamps it.
    this.bg.width = this.canvas.width;
    this.bg.height = this.canvas.height;
    const bg = this.bg.getContext('2d')!;
    const cw = this.bg.width, ch = this.bg.height;
    const lin = bg.createLinearGradient(0, 0, 0, ch);
    lin.addColorStop(0, '#1a1240');
    lin.addColorStop(0.55, '#2a1856');
    lin.addColorStop(1, '#120c2c');
    bg.fillStyle = lin;
    bg.fillRect(0, 0, cw, ch);
    const pic = themeBg(this.theme, () => { if (!this.ended) this.resize(); });
    if (pic) {
      // Cover-fit the theme picture, then dim it so the pieces stay easy to see.
      const k = Math.max(cw / pic.naturalWidth, ch / pic.naturalHeight);
      const pw = pic.naturalWidth * k, ph = pic.naturalHeight * k;
      bg.drawImage(pic, (cw - pw) / 2, (ch - ph) / 2, pw, ph);
      const dim = bg.createLinearGradient(0, 0, 0, ch);
      dim.addColorStop(0, 'rgba(14,8,40,0.45)');
      dim.addColorStop(0.5, 'rgba(14,8,40,0.62)');
      dim.addColorStop(1, 'rgba(14,8,40,0.75)');
      bg.fillStyle = dim;
      bg.fillRect(0, 0, cw, ch);
    }
    for (const [x, y, rad, col] of [[0.8, 0.2, 0.7, '160,80,220,0.25'], [0.1, 0.85, 0.6, '60,120,220,0.18']] as const) {
      const nb = bg.createRadialGradient(cw * x, ch * y, 0, cw * x, ch * y, cw * rad);
      nb.addColorStop(0, `rgba(${col})`);
      nb.addColorStop(1, 'rgba(0,0,0,0)');
      bg.fillStyle = nb;
      bg.fillRect(0, 0, cw, ch);
    }
  }

  private frame(t: number) {
    this.raf = requestAnimationFrame(tt => this.frame(tt));
    const dt = Math.min(50, t - this.lastFrame);
    this.lastFrame = t;
    if (!this.paused) {
      this.acc += dt;
      while (this.acc >= 1000 / 60) {
        Engine.update(this.engine, 1000 / 60);
        this.processMerges();
        this.acc -= 1000 / 60;
      }
      if (!this.ended) this.step(dt);
      if (this.mode.timeLimit && Math.floor(t / 250) !== Math.floor((t - dt) / 250)) this.updateHud();
    }
    this.render(dt);
  }

  private render(dt: number) {
    const g = this.g, d = this.dpr;
    const cw = this.canvas.width / d, ch = this.canvas.height / d;
    const now = this.now();
    g.setTransform(d, 0, 0, d, 0, 0);
    // background (drawn once per resize)
    g.drawImage(this.bg, 0, 0, cw, ch);
    for (const [sx, sy, sz, ph] of this.stars) {
      g.globalAlpha = 0.35 + 0.65 * Math.abs(Math.sin(now / 900 + ph));
      g.fillStyle = '#fff';
      g.fillRect(sx * cw, sy * ch, sz, sz);
    }
    g.globalAlpha = 1;

    // camera shake
    const sh = this.shake;
    this.shake = Math.max(0, this.shake - dt * 0.03);
    const sx = (Math.random() - 0.5) * sh, sy = (Math.random() - 0.5) * sh;
    g.setTransform(d * this.scale, 0, 0, d * this.scale, d * (this.ox + sx), d * (this.oy + sy));

    this.drawDome(now);

    // pegs
    for (const p of this.mode.pegs) {
      const s = sprite(3, p.r * this.scale);
      g.drawImage(s, p.x - s.width / 2 / this.scale, p.y - s.height / 2 / this.scale, s.width / this.scale, s.height / this.scale);
    }

    // aim guide and hanging piece
    if (!this.ended && !this.targeting) {
      const ax = this.clampAim(this.current);
      g.strokeStyle = 'rgba(255,255,255,0.25)';
      g.setLineDash([6, 8]);
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(ax, HANG_Y);
      g.lineTo(ax, this.floorY(ax));
      g.stroke();
      g.setLineDash([]);
      const ready = now - this.lastDrop >= this.mode.dropCooldown;
      g.globalAlpha = ready ? 1 : 0.5;
      this.drawBody(this.current, ax, HANG_Y, 0, 1, now, false, 0);
      g.globalAlpha = 1;
      // launcher
      g.fillStyle = '#c99a4a';
      g.beginPath();
      g.roundRect(ax - 20, HANG_Y - tierRadius(this.current) - 16, 40, 10, 4);
      g.fill();
    }

    // bodies
    for (const b of this.bodies) {
      const sd = b.plugin.sd!;
      const age = now - sd.born;
      const sc = age < 260 ? 0.55 + 0.45 * easeOutBack(age / 260) : 1;
      let excited = false;
      if (sd.tier >= 0) {
        const rr = tierRadius(sd.tier);
        excited = this.bodies.some(o => o !== b && o.plugin.sd!.tier === sd.tier && Math.hypot(o.position.x - b.position.x, o.position.y - b.position.y) < rr * 2 + 24);
      }
      if (sd.tier === COMET) this.drawCometTail(b);
      if (sd.tier === STAR) this.drawStarGlow(b.position.x, b.position.y, now);
      this.drawBody(sd.tier, b.position.x, b.position.y, b.angle, sc, now, excited, sd.seed);
      if (sd.over > 0 && !this.mode.noOverflow) {
        g.strokeStyle = `rgba(255,80,80,${0.4 + 0.4 * Math.sin(now / 80)})`;
        g.lineWidth = 3;
        g.beginPath();
        g.arc(b.position.x, b.position.y, tierRadius(sd.tier) + 3, 0, Math.PI * 2);
        g.stroke();
      }
    }

    // effects
    for (const r of this.rings) {
      r.life += dt;
      const k = Math.min(1, r.life / 450);
      g.strokeStyle = r.color;
      g.globalAlpha = 1 - k;
      g.lineWidth = 4 * (1 - k) + 1;
      g.beginPath();
      g.arc(r.x, r.y, r.r + (r.max - r.r) * k, 0, Math.PI * 2);
      g.stroke();
    }
    this.rings = this.rings.filter(r => r.life < 450);
    for (const p of this.particles) {
      p.life += dt;
      p.x += p.vx * dt * 0.06;
      p.y += p.vy * dt * 0.06;
      p.vy += 0.004 * dt;
      g.globalAlpha = Math.max(0, 1 - p.life / p.max);
      g.fillStyle = p.color;
      g.beginPath();
      g.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      g.fill();
    }
    this.particles = this.particles.filter(p => p.life < p.max);
    g.textAlign = 'center';
    for (const p of this.popups) {
      p.life += dt;
      const k = p.life / 1100;
      g.globalAlpha = Math.max(0, 1 - k * k);
      g.font = `900 ${p.size}px Nunito, system-ui, sans-serif`;
      g.lineWidth = 4;
      g.strokeStyle = 'rgba(20,10,50,0.8)';
      g.strokeText(p.text, p.x, p.y - k * 40);
      g.fillStyle = p.color;
      g.fillText(p.text, p.x, p.y - k * 40);
    }
    this.popups = this.popups.filter(p => p.life < 1100);
    g.globalAlpha = 1;

    if (this.blackHole > 0) {
      this.blackHole = Math.max(0, this.blackHole - dt / 1400);
      const k = this.blackHole;
      const cx = this.W / 2, cy = this.H * 0.55;
      const grad = g.createRadialGradient(cx, cy, 0, cx, cy, 160 * k + 20);
      grad.addColorStop(0, 'rgba(0,0,0,0.95)');
      grad.addColorStop(0.5, 'rgba(90,40,160,0.6)');
      grad.addColorStop(1, 'rgba(90,40,160,0)');
      g.fillStyle = grad;
      g.beginPath();
      g.arc(cx, cy, 160 * k + 20, 0, Math.PI * 2);
      g.fill();
    }

    g.setTransform(d, 0, 0, d, 0, 0);
    if (this.flash > 0) {
      g.fillStyle = `rgba(255,250,230,${this.flash})`;
      g.fillRect(0, 0, cw, ch);
      this.flash = Math.max(0, this.flash - dt / 700);
    }
    if (this.danger > 0) {
      const left = Math.ceil((OVER_LIMIT_MS - this.danger) / 1000);
      g.fillStyle = `rgba(255,60,60,${0.12 + 0.08 * Math.sin(now / 100)})`;
      g.fillRect(0, 0, cw, ch);
      g.font = '900 54px Nunito, system-ui, sans-serif';
      g.textAlign = 'center';
      g.fillStyle = '#ff6b6b';
      g.fillText(String(Math.max(1, left)), cw / 2, this.oy + RIM_Y * this.scale + 70);
    }
  }

  private drawBody(tier: number, x: number, y: number, angle: number, sc: number, now: number, excited: boolean, seed: number) {
    const g = this.g;
    const art = hasArt(tier, this.theme);
    // Pieces wiggle when a twin is close, so a possible merge is easy to spot.
    if (excited && art) sc *= 1 + 0.05 * Math.sin(now / 70 + seed);
    const r = tierRadius(tier) * sc;
    const s = sprite(tier, r * this.scale * this.dpr, this.theme);
    const w = s.width / this.scale / this.dpr;
    g.save();
    g.translate(x, y);
    g.rotate(angle);
    g.drawImage(s, -w / 2, -w / 2, w, w);
    g.restore();
    if (!art && profile.settings.faces && tier >= 0 && this.theme !== 'sea') drawFace(g, x, y, tier === 8 && this.theme === 'space' ? r * 0.86 : r, tier, now, excited, seed);
  }

  private drawStarGlow(x: number, y: number, now: number) {
    const g = this.g;
    const r = tierRadius(STAR) * (1.35 + 0.08 * Math.sin(now / 300));
    const grad = g.createRadialGradient(x, y, r * 0.5, x, y, r);
    grad.addColorStop(0, 'rgba(255,220,100,0.5)');
    grad.addColorStop(1, 'rgba(255,180,60,0)');
    g.fillStyle = grad;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }

  private drawCometTail(b: SBody) {
    const g = this.g;
    const v = b.velocity;
    const sp = Math.hypot(v.x, v.y);
    const dx = sp > 0.3 ? -v.x / sp : 0, dy = sp > 0.3 ? -v.y / sp : -1;
    const len = 50 + sp * 6;
    const x = b.position.x, y = b.position.y;
    const grad = g.createLinearGradient(x, y, x + dx * len, y + dy * len);
    grad.addColorStop(0, 'rgba(160,240,255,0.8)');
    grad.addColorStop(1, 'rgba(160,240,255,0)');
    g.strokeStyle = grad;
    g.lineWidth = 22;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + dx * len, y + dy * len);
    g.stroke();
  }

  private drawDome(now: number) {
    const g = this.g, W = this.W, H = this.H;
    const skin = SKINS[profile.skin] ?? SKINS.glass;
    // glass interior
    g.beginPath();
    g.moveTo(0, RIM_Y - 40);
    g.lineTo(0, this.floorY(0));
    for (let x = 0; x <= W; x += 10) g.lineTo(x, this.floorY(x));
    g.lineTo(W, RIM_Y - 40);
    g.closePath();
    g.fillStyle = skin.fill;
    g.fill();
    // walls and floor outline
    g.shadowColor = skin.glow;
    g.shadowBlur = skin.glowBlur;
    g.strokeStyle = skin.stroke;
    g.lineWidth = skin.width;
    g.lineJoin = 'round';
    g.beginPath();
    g.moveTo(-skin.width / 2, RIM_Y - 40);
    g.lineTo(-skin.width / 2, this.floorY(0));
    for (let x = 0; x <= W; x += 10) g.lineTo(x, this.floorY(x) + skin.width / 2);
    g.lineTo(W + skin.width / 2, RIM_Y - 40);
    g.stroke();
    g.shadowBlur = 0;
    // highlight streak
    g.strokeStyle = 'rgba(255,255,255,0.12)';
    g.lineWidth = 6;
    g.beginPath();
    g.moveTo(14, RIM_Y);
    g.lineTo(14, H * 0.7);
    g.stroke();
    // base plate
    g.fillStyle = skin.base;
    g.beginPath();
    g.roundRect(-24, H + 6, W + 48, 18, 8);
    g.fill();
    // rim line
    g.setLineDash([10, 8]);
    g.strokeStyle = this.danger > 0 ? `rgba(255,80,80,${0.6 + 0.4 * Math.sin(now / 90)})` : 'rgba(255,215,120,0.55)';
    g.lineWidth = 2.5;
    g.beginPath();
    g.moveTo(0, RIM_Y);
    g.lineTo(W, RIM_Y);
    g.stroke();
    g.setLineDash([]);
  }
}

export const SKINS: Record<string, { fill: string; stroke: string; width: number; glow: string; glowBlur: number; base: string; name: string; price: number }> = {
  glass: { name: 'Glass Dome', price: 0, fill: 'rgba(170,190,255,0.06)', stroke: 'rgba(210,225,255,0.75)', width: 5, glow: 'rgba(160,190,255,0.6)', glowBlur: 12, base: '#b8873a' },
  crystal: { name: 'Crystal Dome', price: 600, fill: 'rgba(120,230,255,0.09)', stroke: '#8ff0ff', width: 6, glow: '#4fd8ff', glowBlur: 18, base: '#4aa8c8' },
  brass: { name: 'Brass Telescope', price: 900, fill: 'rgba(255,200,120,0.06)', stroke: '#e0b060', width: 9, glow: 'rgba(255,190,90,0.5)', glowBlur: 10, base: '#8a5a20' },
  neon: { name: 'Neon Arcade', price: 1200, fill: 'rgba(255,60,200,0.06)', stroke: '#ff5ad8', width: 6, glow: '#ff5ad8', glowBlur: 24, base: '#5a2ad8' },
};
