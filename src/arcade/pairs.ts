import { sfx } from '../audio';
import { pieceEl, type Theme } from '../game/art';
import { buzz } from '../platform';
import { profile } from '../save';
import { h } from '../ui/dom';
import { Shell, type ArcadeGame, type ArcadeHooks } from './shell';

const BOARDS: Array<[number, number]> = [[4, 3], [4, 4], [4, 5], [5, 6]]; // cols, rows

/** Star Pairs: flip two cards at a time and find the matching pieces before time runs out. */
export class PairsGame implements ArcadeGame {
  readonly el: HTMLElement;
  private shell: Shell;
  private grid: HTMLElement;
  private theme: Theme = profile.settings.theme;
  private round = 0;
  private open: HTMLElement[] = [];
  private left = 0;
  private score = 0;
  private time = 60;
  private timer = 0;
  private lock = false;
  private streak = 0;

  constructor(hooks: ArcadeHooks) {
    this.shell = new Shell('Star Pairs', `⏱ ${this.time}s`, hooks, 'catcher');
    this.el = this.shell.el;
    this.grid = h('div.pairs-grid', {});
    this.shell.body.append(this.grid, h('p.arcade-hint', {}, 'Find every pair. Clearing a board adds 15 seconds.'));
    this.shell.onPause = p => { if (p) window.clearInterval(this.timer); else this.tick(); };
    this.deal();
    this.tick();
  }

  destroy() {
    window.clearInterval(this.timer);
    this.el.remove();
  }

  back() { return this.shell.back(); }

  private tick() {
    window.clearInterval(this.timer);
    this.timer = window.setInterval(() => {
      if (this.shell.ended) return;
      this.time--;
      this.shell.setSub(`⏱ ${this.time}s · Board ${this.round}`);
      if (this.time <= 5 && this.time > 0) sfx.warn();
      if (this.time <= 0) {
        window.clearInterval(this.timer);
        sfx.gameOver();
        this.shell.finish(this.score, 600);
      }
    }, 1000);
  }

  private deal() {
    const [cols, rows] = BOARDS[Math.min(this.round, BOARDS.length - 1)];
    this.round++;
    const pairs = (cols * rows) / 2;
    const tiers = shuffle([...Array(11).keys()]).slice(0, Math.min(11, pairs));
    while (tiers.length < pairs) tiers.push(tiers[tiers.length % 11]);
    const deck = shuffle([...tiers, ...tiers]);
    this.left = pairs;
    this.grid.replaceChildren();
    this.grid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    this.grid.style.setProperty('--cols', String(cols));
    const r = Math.min(30, Math.max(18, 140 / cols));
    deck.forEach((tier, i) => {
      const card = h('button.pcard', { 'data-tier': tier, style: `animation-delay:${i * 25}ms` },
        h('span.pc-inner', {}, h('span.pc-back', {}, '✦'), h('span.pc-front', {}, pieceEl(tier, r, this.theme))));
      card.onclick = () => this.flip(card);
      this.grid.append(card);
    });
    this.shell.setSub(`⏱ ${this.time}s · Board ${this.round}`);
  }

  private flip(card: HTMLElement) {
    if (this.lock || this.shell.paused || this.shell.ended || card.classList.contains('up')) return;
    card.classList.add('up');
    sfx.click();
    this.open.push(card);
    if (this.open.length < 2) return;
    const [a, b] = this.open;
    this.open = [];
    if (a.dataset.tier === b.dataset.tier) {
      this.streak++;
      this.score += 50 * this.streak;
      this.shell.setScore(this.score);
      const tier = Number(a.dataset.tier);
      setTimeout(() => { a.classList.add('done'); b.classList.add('done'); sfx.merge(tier, this.streak); buzz(false); }, 250);
      if (--this.left === 0) {
        this.lock = true;
        setTimeout(() => {
          this.score += this.time * 5;
          this.time += 15;
          this.shell.setScore(this.score);
          sfx.win();
          this.deal();
          this.lock = false;
        }, 900);
      }
    } else {
      this.streak = 0;
      this.lock = true;
      setTimeout(() => { a.classList.remove('up'); b.classList.remove('up'); this.lock = false; sfx.miss(); }, 750);
    }
  }
}

function shuffle<T>(a: T[]): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
