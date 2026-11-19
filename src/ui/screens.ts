import { applyVolumes, playMusic, sfx, unlockAudio } from '../audio';
import { dailyChallenge, goalText, LEVELS, twistText, type LevelDef } from '../core/levels';
import { hashSeed, todayKey } from '../core/rng';
import { TIERS } from '../core/tiers';
import { FINALE_NAME, sprite, THEME_LABEL, THEME_NAMES, type Theme } from '../game/art';
import { CatcherSession } from '../game/catcher';
import { levelMode, PlaySession, SKINS, type ModeConfig, type RunResult } from '../game/play';
import { currentMissions, missionsReady, profile, refreshPeriods, resetProgress, save, totalStars, track, type DomeSkin, type PowerUp } from '../save';
import { APP_VERSION, BUILD_ID, checkForUpdate, RELEASE_PAGE } from '../update';
import { openExternal } from '../platform';
import { clear, h, toast } from './dom';

const app = () => document.getElementById('app')!;

interface Active { destroy(): void; back(): boolean }
let active: Active | null = null;
let backTo: (() => void) | null = null;

function show(el: HTMLElement, back: (() => void) | null, session: Active | null = null) {
  active?.destroy();
  active = session;
  backTo = back;
  const root = app();
  clear(root);
  root.append(el);
  el.classList.add('enter');
}

/** Android back button. Returns false when on the home screen (the app then closes). */
export function handleBack(): boolean {
  if (document.querySelector('.modal.overlay')) {
    document.querySelector('.modal.overlay')!.remove();
    return true;
  }
  if (active) return active.back();
  if (backTo) {
    backTo();
    return true;
  }
  return false;
}

function topBar(title: string, back: () => void): HTMLElement {
  return h('div.topbar', {},
    h('button.icon-btn', { onclick: () => { sfx.click(); back(); }, 'aria-label': 'Back' }, '‹'),
    h('h1', {}, title),
    coinChip(),
  );
}

function coinChip(): HTMLElement {
  return h('div.coins', {}, h('span.coin-icon', {}, '★'), profile.coins.toLocaleString('en-US'));
}

function spriteImg(tier: number, r: number, cls = ''): HTMLElement {
  const s = sprite(tier, r * 2, profile.settings.theme);
  const c = h('canvas', { width: s.width, height: s.height, class: cls }) as HTMLCanvasElement;
  c.getContext('2d')!.drawImage(s, 0, 0);
  c.style.width = `${s.width / 2}px`;
  c.style.height = `${s.height / 2}px`;
  return c;
}

const names = () => THEME_NAMES[profile.settings.theme];

// ----- Home -----

export function home() {
  refreshPeriods();
  playMusic('home');
  const ready = missionsReady();
  const orbit = h('div.orbit', {});
  [0, 2, 4, 6, 8, 10].forEach((t, i) => {
    const s = spriteImg(t, 10 + t * 1.6, 'orbiter');
    s.style.setProperty('--i', String(i));
    orbit.append(s);
  });
  const tile = (icon: string, label: string, sub: string, onclick: () => void, badge = 0) =>
    h('button.tile', { onclick: () => { unlockAudio(); sfx.click(); onclick(); } },
      h('span.tile-icon', {}, icon), h('span.tile-label', {}, label), h('span.tile-sub', {}, sub),
      badge ? h('span.badge', {}, String(badge)) : null);
  const el = h('div.screen.home', {},
    h('div.home-top', {}, coinChip(), h('button.icon-btn', { onclick: () => { sfx.click(); settings(); }, 'aria-label': 'Settings' }, '⚙')),
    h('div.logo', {}, h('div.logo-main', {}, 'Stellar Drop'), h('div.logo-sub', {}, `${THEME_LABEL[profile.settings.theme]} merge puzzle`)),
    orbit,
    h('div.best', {}, `Best ${profile.bestClassic.toLocaleString('en-US')}`),
    h('button.play-btn', { onclick: () => { unlockAudio(); sfx.click(); startRun(classicMode()); } }, '▶ Play'),
    h('div.tiles', {},
      tile('🪐', 'Levels', `${totalStars()} / ${LEVELS.length * 3} ★`, levels),
      tile('🎮', 'Minigames', '4 games', minigames),
      tile('🏆', 'Challenges', 'Daily + weekly', challenges, ready),
      tile('📖', 'Atlas', 'Collection', atlas),
      tile('🛍', 'Shop', 'Skins + power-ups', shop),
      tile('🎨', 'Theme', THEME_LABEL[profile.settings.theme], themePicker),
    ),
  );
  show(el, null);
}

// ----- Modes -----

function classicMode(): ModeConfig {
  return { kind: 'classic', title: 'Classic', width: 400, pegs: [], maxDropTier: 4, dropCooldown: 420, powerUps: true, secondChance: true, music: 'play' };
}

function dailyMode(): ModeConfig {
  return { kind: 'daily', title: 'Daily Constellation', width: 400, pegs: [], maxDropTier: 4, seed: hashSeed('daily:' + todayKey()), dropCooldown: 420, powerUps: false, secondChance: false, music: 'play' };
}

const MINIGAMES: Array<{ id: string; icon: string; name: string; desc: string; best: () => number; mode?: () => ModeConfig }> = [
  { id: 'rush', icon: '☄️', name: 'Meteor Rush', desc: '90 seconds, fast drops. Score as much as you can.', best: () => profile.bestRush,
    mode: () => ({ kind: 'rush', title: 'Meteor Rush', width: 400, pegs: [], maxDropTier: 3, timeLimit: 90, dropCooldown: 200, powerUps: false, secondChance: false, music: 'rush' }) },
  { id: 'tiny', icon: '🔭', name: 'Tiny Dome', desc: 'A narrow dome. Survive as long as you can.', best: () => profile.bestTiny,
    mode: () => ({ kind: 'tiny', title: 'Tiny Dome', width: 280, pegs: [], maxDropTier: 3, dropCooldown: 420, powerUps: false, secondChance: true, music: 'play' }) },
  { id: 'zen', icon: '🌙', name: 'Zen Orbit', desc: 'No game over. Calm music, just merge and relax.', best: () => 0,
    mode: () => ({ kind: 'zen', title: 'Zen Orbit', width: 400, pegs: [], maxDropTier: 4, noOverflow: true, dropCooldown: 420, powerUps: false, secondChance: false, music: 'zen' }) },
  { id: 'catcher', icon: '✨', name: 'Star Catcher', desc: 'Tap the falling pieces that match the target. 60 seconds.', best: () => profile.bestCatcher },
];

function startRun(mode: ModeConfig) {
  const session = new PlaySession(mode, r => results(r), () => (mode.kind === 'level' ? levels() : mode.kind === 'challenge' || mode.kind === 'daily' ? challenges() : ['rush', 'tiny', 'zen'].includes(mode.kind) ? minigames() : home()));
  show(session.el, null, session);
}

window.addEventListener('sd-restart', e => startRun((e as CustomEvent<ModeConfig>).detail));

function startCatcher() {
  const s = new CatcherSession(r => {
    if (r.best) profile.bestCatcher = r.score;
    const coins = Math.floor(r.score / 20);
    profile.coins += coins;
    track({ type: 'minigame' });
    save();
    resultCard('Star Catcher', r.score, r.best, coins, null, () => startCatcher(), minigames);
  }, minigames);
  show(s.el, null, s);
}

// ----- Results -----

function results(r: RunResult) {
  const m = r.mode;
  let best = false;
  const bump = (key: 'bestClassic' | 'bestRush' | 'bestTiny') => { if (r.score > profile[key]) { profile[key] = r.score; best = true; } };
  if (m.kind === 'classic') bump('bestClassic');
  if (m.kind === 'rush') bump('bestRush');
  if (m.kind === 'tiny') bump('bestTiny');
  if (m.kind === 'daily' && r.score > profile.daily.best) { profile.daily.best = r.score; best = true; }
  if (['rush', 'tiny', 'zen'].includes(m.kind)) track({ type: 'minigame' });
  if (m.kind !== 'level' && m.kind !== 'challenge') track({ type: 'runScore', score: r.score });
  let coins = r.coins;
  if (m.kind === 'level' && r.won && m.level) {
    const prev = profile.levelStars[m.level.id - 1] ?? 0;
    if ((r.stars ?? 0) > prev) {
      track({ type: 'levelStars', stars: (r.stars ?? 0) - prev });
      profile.levelStars[m.level.id - 1] = r.stars ?? 0;
    }
  }
  if (m.kind === 'challenge' && r.won && !profile.daily.challengeDone) {
    profile.daily.challengeDone = true;
    coins += 100;
  }
  profile.coins += coins;
  profile.totals.runs++;
  save();
  const title = m.goal ? (r.won ? 'Goal complete!' : 'Out of luck…') : r.reason === 'time' ? "Time's up!" : 'Dome overflow!';
  const again = () => startRun(m.level && m.kind === 'level' ? levelMode(m.level) : m);
  const next = m.kind === 'level' && r.won && m.level && m.level.id < LEVELS.length ? () => levelIntro(LEVELS[m.level!.id]) : null;
  const back = m.kind === 'level' ? levels : m.kind === 'challenge' || m.kind === 'daily' ? challenges : ['rush', 'tiny', 'zen'].includes(m.kind) ? minigames : home;
  resultCard(title, r.score, best, coins, r.won ? r.stars ?? null : null, again, back, next, r.biggest);
}

function resultCard(title: string, score: number, best: boolean, coins: number, stars: number | null, again: () => void, back: () => void, next: (() => void) | null = null, biggest = -1) {
  playMusic('home');
  const starRow = stars !== null ? h('div.stars-big', {}, ...[1, 2, 3].map(i => h('span', { class: i <= stars ? 'on' : '', style: `--d:${i * 0.25}s` }, '★'))) : null;
  const el = h('div.screen.results', {},
    h('div.result-card', {},
      h('h1', {}, title),
      starRow,
      h('div.big-score', {}, score.toLocaleString('en-US')),
      best ? h('div.new-best', {}, '🎉 New best!') : null,
      biggest >= 0 ? h('div.biggest', {}, 'Biggest: ', biggest >= TIERS.length ? FINALE_NAME[profile.settings.theme] : names()[biggest], biggest < TIERS.length ? spriteImg(biggest, 16) : null) : null,
      h('div.earned', {}, `+${coins} ★ coins`),
      next ? h('button.btn.primary', { onclick: () => { sfx.click(); next(); } }, 'Next level ▶') : null,
      h('button.btn' + (next ? '' : '.primary'), { onclick: () => { sfx.click(); again(); } }, '↻ Play again'),
      h('button.btn', { onclick: () => { sfx.click(); back(); } }, '⌂ Menu'),
    ),
  );
  if (coins > 0) setTimeout(() => sfx.coin(), 500);
  show(el, back);
}

// ----- Levels -----

function levels() {
  playMusic('home');
  const grid = h('div.level-grid', {});
  LEVELS.forEach((lv, i) => {
    const stars = profile.levelStars[i] ?? 0;
    const unlocked = i === 0 || (profile.levelStars[i - 1] ?? 0) > 0;
    grid.append(h('button.level-cell' + (lv.challenge ? '.challenge' : '') + (unlocked ? '' : '.locked'), {
      onclick: () => { if (!unlocked) { toast('Finish the level before to unlock this one'); return; } sfx.click(); levelIntro(lv); },
    },
    h('span.num', {}, unlocked ? String(lv.id) : '🔒'),
    h('span.lv-stars', {}, '★'.repeat(stars) + '☆'.repeat(3 - stars))));
  });
  show(h('div.screen.list', {}, topBar('Levels', home), h('p.hint', {}, 'Reach the goal before you run out of drops. Every 5th level is a challenge with a twist.'), grid), home);
}

function levelIntro(lv: LevelDef) {
  const tw = twistText(lv.twist);
  const modal = h('div.modal.overlay', {},
    h('h2', {}, `Level ${lv.id}${lv.challenge ? ' · Challenge' : ''}`),
    h('p.goal', {}, '🎯 ', goalText(lv.goal, names())),
    lv.goal.kind !== 'score' ? spriteImg(lv.goal.tier, 22) : null,
    h('p', {}, `⬇ ${lv.drops} drops${lv.width < 400 ? ' · narrow dome' : ''}${lv.pegs.length ? ' · asteroid pegs' : ''}`),
    tw ? h('p.twist', {}, `⚠ ${tw}`) : null,
    h('p.small', {}, '★★★ with 40% of drops left, ★★ with 20%.'),
    h('button.btn.primary', { onclick: () => { modal.remove(); sfx.click(); startRun(levelMode(lv)); } }, '▶ Start'),
    h('button.btn', { onclick: () => modal.remove() }, 'Close'),
  );
  document.body.append(modal);
}

// ----- Minigames -----

function minigames() {
  playMusic('home');
  const list = h('div.cards', {});
  for (const g of MINIGAMES) {
    list.append(h('button.card', { onclick: () => { unlockAudio(); sfx.click(); if (g.mode) startRun(g.mode()); else startCatcher(); } },
      h('span.card-icon', {}, g.icon),
      h('span.card-body', {}, h('span.card-title', {}, g.name), h('span.card-desc', {}, g.desc), g.best() ? h('span.card-best', {}, `Best ${g.best().toLocaleString('en-US')}`) : null)));
  }
  show(h('div.screen.list', {}, topBar('Minigames', home), list), home);
}

// ----- Challenges -----

function challenges() {
  playMusic('home');
  refreshPeriods();
  const today = todayKey();
  const ch = dailyChallenge(today);
  const tw = twistText(ch.twist);
  const { daily, weekly } = currentMissions();
  const missionRow = (m: (typeof daily)[number], box: typeof profile.missions) => {
    const p = box.progress[m.id] ?? 0;
    const done = p >= m.target;
    const claimed = box.claimed.includes(m.id);
    return h('div.mission' + (claimed ? '.claimed' : ''), {},
      h('div.m-text', {}, m.text),
      h('div.m-bar', {}, h('div.m-fill', { style: `width:${Math.round((p / m.target) * 100)}%` })),
      h('div.m-foot', {}, h('span', {}, `${p} / ${m.target}`),
        claimed ? h('span.m-done', {}, '✓ Claimed')
        : h('button.btn.small' + (done ? '.primary' : ''), {
          disabled: !done,
          onclick: () => { box.claimed.push(m.id); profile.coins += m.reward; save(); sfx.coin(); toast(`+${m.reward} ★ coins`); challenges(); },
        }, `Claim ${m.reward} ★`)));
  };
  const el = h('div.screen.list', {},
    topBar('Challenges', home),
    h('div.card.feature', {},
      h('span.card-icon', {}, '🏆'),
      h('span.card-body', {},
        h('span.card-title', {}, 'Daily Challenge'),
        h('span.card-desc', {}, `${goalText(ch.goal, names())} in ${ch.drops} drops${tw ? ` · ${tw}` : ''}`),
        h('span.card-best', {}, profile.daily.challengeDone ? '✓ Done today' : 'Reward: 100 ★')),
      h('button.btn.primary.small', { onclick: () => { unlockAudio(); sfx.click(); startRun(levelMode(ch, 'challenge')); } }, 'Play')),
    h('div.card.feature', {},
      h('span.card-icon', {}, '🌌'),
      h('span.card-body', {},
        h('span.card-title', {}, 'Daily Constellation'),
        h('span.card-desc', {}, 'Same drops all day. Beat your own best for today.'),
        h('span.card-best', {}, profile.daily.best ? `Today's best ${profile.daily.best.toLocaleString('en-US')}` : 'Not played yet today')),
      h('button.btn.primary.small', { onclick: () => { unlockAudio(); sfx.click(); startRun(dailyMode()); } }, 'Play')),
    h('h2.section', {}, 'Daily missions'),
    ...daily.map(m => missionRow(m, profile.missions)),
    h('h2.section', {}, 'Weekly missions'),
    ...weekly.map(m => missionRow(m, profile.weekly)),
  );
  show(el, home);
}

// ----- Atlas -----

function atlas() {
  const theme = profile.settings.theme;
  const grid = h('div.atlas-grid', {});
  names().forEach((name, t) => {
    const found = !!profile.atlas[t];
    const img = spriteImg(t, 26, found ? '' : 'silhouette');
    grid.append(h('button.atlas-card' + (found ? '' : '.locked'), {
      onclick: () => {
        if (!found) { toast('Merge to discover this one'); return; }
        const modal = h('div.modal.overlay', {}, spriteImg(t, 44), h('h2', {}, name), h('p', {}, theme === 'space' ? TIERS[t].fact : `Tier ${t + 1} of 11. ${TIERS[t].points} points each time you make one.`), h('button.btn', { onclick: () => modal.remove() }, 'Close'));
        document.body.append(modal);
      },
    }, img, h('span', {}, found ? name : '???')));
  });
  const nova = !!profile.atlas[11];
  grid.append(h('div.atlas-card.finale' + (nova ? '' : '.locked'), {}, h('span.card-icon', {}, nova ? '💥' : '🔒'), h('span', {}, nova ? FINALE_NAME[theme] : '???')));
  const found = profile.atlas.filter(Boolean).length;
  show(h('div.screen.list', {}, topBar('Atlas', home), h('p.hint', {}, `${found} / 12 discovered`), grid), home);
}

// ----- Shop -----

const POWER_PRICES: Record<PowerUp, number> = { pop: 150, swap: 100, boost: 250 };

function shop() {
  const skinCard = (id: DomeSkin) => {
    const s = SKINS[id];
    const owned = profile.skins.includes(id);
    const equipped = profile.skin === id;
    return h('div.shop-item', {},
      h('div.skin-swatch', { style: `border-color:${s.stroke};box-shadow:0 0 14px ${s.glow};background:${s.fill}` }),
      h('div.si-name', {}, s.name),
      equipped ? h('div.si-tag', {}, 'Equipped')
      : owned ? h('button.btn.small', { onclick: () => { profile.skin = id; save(); sfx.click(); shop(); } }, 'Use')
      : h('button.btn.small.primary', {
        onclick: () => {
          if (profile.coins < s.price) { toast('Not enough coins yet'); return; }
          profile.coins -= s.price; profile.skins.push(id); profile.skin = id; save(); sfx.coin(); shop();
        },
      }, `${s.price} ★`));
  };
  const powerCard = (p: PowerUp, icon: string, name: string, desc: string) => h('div.shop-item', {},
    h('div.si-icon', {}, icon), h('div.si-name', {}, `${name} (${profile.power[p]})`), h('div.si-desc', {}, desc),
    h('button.btn.small.primary', {
      onclick: () => {
        if (profile.coins < POWER_PRICES[p]) { toast('Not enough coins yet'); return; }
        profile.coins -= POWER_PRICES[p]; profile.power[p]++; save(); sfx.coin(); shop();
      },
    }, `${POWER_PRICES[p]} ★`));
  const el = h('div.screen.list', {},
    topBar('Shop', home),
    h('p.hint', {}, 'Everything here is bought with coins you earn by playing.'),
    h('h2.section', {}, 'Dome skins'),
    h('div.shop-grid', {}, ...(Object.keys(SKINS) as DomeSkin[]).map(skinCard)),
    h('h2.section', {}, 'Power-ups'),
    h('div.shop-grid', {},
      powerCard('pop', '💥', 'Pop', 'Remove one piece'),
      powerCard('swap', '🔄', 'Swap', 'Change the next drop'),
      powerCard('boost', '⏫', 'Boost', 'Level up one piece')),
  );
  show(el, home);
}

// ----- Theme + settings -----

function themePicker() {
  const opts = (Object.keys(THEME_LABEL) as Theme[]).map(t => {
    const row = h('div.theme-preview', {});
    for (const tier of [0, 3, 6, 9]) {
      const s = sprite(tier, 36, t);
      const c = h('canvas', { width: s.width, height: s.height }) as HTMLCanvasElement;
      c.getContext('2d')!.drawImage(s, 0, 0);
      c.style.width = `${s.width / 2}px`;
      row.append(c);
    }
    return h('button.theme-opt' + (profile.settings.theme === t ? '.selected' : ''), {
      onclick: () => { profile.settings.theme = t; save(); sfx.click(); themePicker(); },
    }, h('span.card-title', {}, THEME_LABEL[t]), row);
  });
  show(h('div.screen.list', {}, topBar('Theme', home), h('p.hint', {}, 'Pick how the pieces look. The rules are the same in every theme.'), ...opts), home);
}

function settings() {
  const slider = (label: string, key: 'music' | 'sfx') => h('label.setting', {}, h('span', {}, label),
    h('input', { type: 'range', min: 0, max: 1, step: 0.05, value: profile.settings[key], oninput: (e: Event) => { profile.settings[key] = Number((e.target as HTMLInputElement).value); applyVolumes(); save(); } }));
  const toggle = (label: string, key: 'vibration' | 'faces') => h('label.setting', {}, h('span', {}, label),
    h('input', { type: 'checkbox', checked: profile.settings[key], onchange: (e: Event) => { profile.settings[key] = (e.target as HTMLInputElement).checked; save(); } }));
  const status = h('p.small', {}, '');
  const el = h('div.screen.list', {},
    topBar('Settings', home),
    slider('🎵 Music', 'music'),
    slider('🔊 Sound effects', 'sfx'),
    toggle('📳 Vibration', 'vibration'),
    toggle('😊 Faces on pieces', 'faces'),
    h('button.btn', { onclick: () => { sfx.click(); themePicker(); } }, `🎨 Theme: ${THEME_LABEL[profile.settings.theme]}`),
    h('h2.section', {}, 'Updates'),
    h('p.small', {}, `Version ${APP_VERSION} · build ${BUILD_ID}`),
    h('button.btn', {
      onclick: async () => {
        status.textContent = 'Checking…';
        const r = await checkForUpdate(true);
        status.textContent = r === 'new' ? 'A new version is ready: tap Download at the top.' : r === 'same' ? 'You have the latest version.' : 'Could not check right now.';
      },
    }, '🔄 Check for updates'),
    h('button.btn', { onclick: () => openExternal(RELEASE_PAGE) }, '⬇ Open the download page'),
    status,
    h('h2.section', {}, 'Progress'),
    h('button.btn.danger', {
      onclick: () => {
        const modal = h('div.modal.overlay', {}, h('h2', {}, 'Reset all progress?'), h('p', {}, 'Coins, stars, scores and unlocks will be erased. Settings stay.'),
          h('button.btn.danger', { onclick: () => { resetProgress(); modal.remove(); toast('Progress reset'); home(); } }, 'Reset'),
          h('button.btn', { onclick: () => modal.remove() }, 'Cancel'));
        document.body.append(modal);
      },
    }, 'Reset progress'),
  );
  show(el, home);
}
