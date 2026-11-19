import { applyVolumes, playMusic, sfx, unlockAudio } from '../audio';
import { dailyChallenge, goalText, LEVELS, twistText, type LevelDef } from '../core/levels';
import { hashSeed, todayKey } from '../core/rng';
import { TIERS } from '../core/tiers';
import { bgUrl, FINALE_NAME, hasArt, mascotUrl, preloadTheme, sprite, THEME_LABEL, THEME_NAMES, type Pose, type Theme } from '../game/art';
import { CatcherSession } from '../game/catcher';
import { BlocksGame } from '../arcade/blocks';
import { BubblesGame } from '../arcade/bubbles';
import { FusionGame } from '../arcade/fusion';
import { Match3Game } from '../arcade/match3';
import { PairsGame } from '../arcade/pairs';
import { SnakeGame } from '../arcade/snake';
import type { ArcadeGame, ArcadeHooks } from '../arcade/shell';
import { levelMode, PlaySession, SKINS, type ModeConfig, type RunResult } from '../game/play';
import { currentMissions, missionsReady, profile, refreshPeriods, resetProgress, save, totalStars, track, type DomeSkin, type PowerUp } from '../save';
import { APP_VERSION, BUILD_ID, checkForUpdate, RELEASE_PAGE } from '../update';
import { openExternal } from '../platform';
import { lang } from '../i18n';
import { clear, confetti, h, toast } from './dom';
import { chestReady, checkTrophies, freeSpinReady, gameFinished, openChest, openWheel, spinsWaiting } from './rewards';
import { CHEST_EVERY, TROPHIES } from '../core/rewards';
import { closeGuide, firstTime, GUIDE_NAME, GUIDE_ORDER, markSeen, openGuide, type GuideId } from './howto';

const app = () => document.getElementById('app')!;

interface Active { destroy(): void; back(): boolean }
let active: Active | null = null;
let backTo: (() => void) | null = null;

function show(el: HTMLElement, back: (() => void) | null, session: Active | null = null) {
  active?.destroy();
  active = session;
  backTo = back;
  document.querySelectorAll('.modal.overlay, .reward-back').forEach(m => m.remove());
  closeGuide();
  const root = app();
  clear(root);
  root.style.backgroundImage = `url(${bgUrl(profile.settings.theme)})`;
  root.append(el);
  el.classList.add('enter');
}

/** Android back button. Returns false when on the home screen (the app then closes). */
export function handleBack(): boolean {
  if (closeGuide()) return true;
  const rb = document.querySelector('.reward-back');
  if (rb) { rb.remove(); return true; }
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

const RANKS = ['Stargazer', 'Comet Chaser', 'Moon Walker', 'Planet Keeper', 'Star Captain', 'Nebula Hero', 'Galaxy Master'];

/** Player level from everything done so far: stars, discoveries and games played. */
function rank() {
  const xp = totalStars() * 10 + profile.atlas.filter(Boolean).length * 25 + profile.totals.runs * 4 + Math.floor(profile.totals.merges / 10);
  const lvl = Math.floor(Math.sqrt(xp / 15)) + 1;
  const from = (lvl - 1) ** 2 * 15, to = lvl ** 2 * 15;
  return { lvl, title: RANKS[Math.min(RANKS.length - 1, Math.floor((lvl - 1) / 3))], pct: Math.round(((xp - from) / (to - from)) * 100) };
}

const TIPS = [
  'Two of the same piece merge into a bigger one!',
  'Merge quickly one after another for a chain bonus.',
  'Every 10 merges charge the Gravity Pulse. Tap ✦ to shake things down.',
  'Keep pieces below the dashed line, or the dome overflows.',
  'Catch a comet: it merges with anything it touches.',
  'Big pieces in the corners leave room in the middle.',
  'Come back every day for a new Daily Challenge.',
];
let tipIndex = Math.floor(Math.random() * TIPS.length);

function mascot(pose: Pose, cls = ''): HTMLElement {
  return h('img.mascot' + (cls ? '.' + cls : ''), { src: mascotUrl(pose), alt: 'Luma' });
}

/** Bottom tab bar shared by the main screens. */
function tabBar(active: string): HTMLElement {
  const ready = missionsReady();
  const tab = (id: string, icon: string, label: string, go: () => void, badge = 0) =>
    h('button.tab' + (id === active ? '.on' : ''), { onclick: () => { if (id === active) return; unlockAudio(); sfx.click(); go(); } },
      h('span.tab-icon', {}, icon), h('span.tab-label', {}, label), badge ? h('span.badge', {}, String(badge)) : null);
  return h('nav.tabbar', {},
    tab('home', '🏠', 'Home', home),
    tab('levels', '🪐', 'Levels', levels),
    tab('arcade', '🕹', 'Arcade', () => arcade()),
    tab('daily', '🏆', 'Daily', challenges, ready),
    tab('shop', '🛍', 'Shop', shop));
}

function nextLevel(): LevelDef {
  const i = LEVELS.findIndex((_, k) => !(profile.levelStars[k] > 0));
  return LEVELS[i < 0 ? LEVELS.length - 1 : i];
}

export function home() {
  refreshPeriods();
  playMusic('home');
  preloadTheme(profile.settings.theme);
  const r = rank();
  const { daily } = currentMissions();
  const missionsDone = daily.filter(m => (profile.missions.progress[m.id] ?? 0) >= m.target).length;
  const biggest = profile.atlas.slice(0, 11).lastIndexOf(true);
  const bubble = h('div.bubble', {}, TIPS[tipIndex]);
  const luma = mascot('wave', 'home-mascot');
  luma.onclick = () => {
    sfx.click();
    tipIndex = (tipIndex + 1) % TIPS.length;
    bubble.textContent = TIPS[tipIndex];
    luma.classList.remove('hop'); void luma.offsetWidth; luma.classList.add('hop');
  };
  const go = (f: () => void) => () => { unlockAudio(); sfx.click(); f(); };
  const lv = nextLevel();
  const today = (icon: string, title: string, sub: string, done: boolean, f: () => void) =>
    h('button.today-card.panel' + (done ? '.done' : ''), { onclick: go(f) },
      h('span.today-icon', {}, icon), h('span.today-title', {}, title), h('span.today-sub', {}, done ? '✓ Done' : sub));
  const game = (tier: number, title: string, sub: string, f: () => void) =>
    h('button.game-card.panel', { onclick: go(f) }, spriteImg(tier, 30, 'game-art'), h('span.game-title', {}, title), h('span.game-sub', {}, sub));
  const ch = dailyChallenge(todayKey());
  const el = h('div.screen.home.tabbed', {},
    h('header.home-head', {},
      h('div.avatar', {}, mascot('wave')),
      h('div.rank', {},
        h('div.rank-title', {}, r.title),
        h('div.rank-bar', {}, h('div.rank-fill', { style: `width:${r.pct}%` }), h('span.rank-lvl', {}, `Lv ${r.lvl}`))),
      coinChip(),
      h('button.icon-btn.help-btn', { onclick: () => { sfx.click(); openGuide('drop'); }, 'aria-label': 'How to play' }, '?'),
      h('button.icon-btn', { onclick: () => { sfx.click(); settings(); }, 'aria-label': 'Settings' }, '⚙')),
    h('div.hero', {},
      h('div.logo', {}, h('div.logo-main', {}, 'Stellar Drop'), h('div.logo-sub', {}, `${THEME_LABEL[profile.settings.theme]} merge puzzle`)),
      h('div.hero-row', {}, luma, bubble)),
    h('div.continue.panel.ornate', {},
      h('div.cont-art', {}, spriteImg(Math.max(4, biggest), 26)),
      h('div.cont-body', {},
        h('div.cont-kicker', {}, 'Classic'),
        h('div.cont-title', {}, profile.bestClassic ? `Best ${profile.bestClassic.toLocaleString('en-US')}` : 'Start your first dome'),
        h('div.cont-sub', {}, biggest >= 0 ? `Biggest: ${names()[biggest]}` : 'Merge your way up to the Star')),
      h('button.play-round', { onclick: go(() => startRun(classicMode())), 'aria-label': 'Play' }, '▶')),
    h('button.level-strip.panel', { onclick: go(() => levelIntro(lv)) },
      h('span.ls-num', {}, String(lv.id)),
      h('span.ls-body', {}, h('span.ls-title', {}, `Level ${lv.id}${lv.challenge ? ' · Challenge' : ''}`), h('span.ls-goal', {}, goalText(lv.goal, names()))),
      h('span.ls-stars', {}, `${totalStars()} ★`)),
    h('h2.section', {}, 'Today'),
    h('div.today-row', {},
      today('🏆', 'Challenge', `${ch.drops} drops`, profile.daily.challengeDone, challenges),
      today('🌌', 'Constellation', profile.daily.best ? `Best ${profile.daily.best.toLocaleString('en-US')}` : 'New today', false, () => startRun(dailyMode())),
      today('🎯', 'Missions', `${missionsDone} / ${daily.length}`, missionsDone === daily.length && missionsReady() === 0, challenges)),
    h('h2.section', {}, 'Rewards'),
    h('div.today-row', {},
      today('🎡', 'Lucky Wheel', spinsWaiting() ? (freeSpinReady() ? 'Free spin!' : `${spinsWaiting()} spins`) : 'Win a level', false, () => openWheel(home)),
      today('🎁', 'Star Chest', chestReady() ? 'Open it!' : `${profile.rewards.chest} / ${CHEST_EVERY} games`, false, () => (chestReady() ? openChest(home) : toast(`Finish ${CHEST_EVERY - profile.rewards.chest} more games to open it`))),
      today('🏆', 'Trophies', `${profile.rewards.trophies.length} / ${TROPHIES.length}`, false, trophies)),
    h('h2.section', {}, 'Games', h('button.see-all', { onclick: go(() => arcade()) }, 'See all ›')),
    h('div.game-row', {},
      game(1, 'Meteor Rush', profile.bestRush ? `Best ${profile.bestRush.toLocaleString('en-US')}` : '90 seconds', () => startRun(MINIGAMES[0].mode!())),
      game(7, 'Tiny Dome', profile.bestTiny ? `Best ${profile.bestTiny.toLocaleString('en-US')}` : 'Narrow dome', () => startRun(MINIGAMES[1].mode!())),
      game(5, 'Zen Orbit', 'No game over', () => startRun(MINIGAMES[2].mode!())),
      game(3, 'Star Catcher', profile.bestCatcher ? `Best ${profile.bestCatcher}` : 'Tap to catch', startCatcher),
      ...ARCADE.map(a => game(a.art, a.name, profile.arcade[a.id] ? `Best ${profile.arcade[a.id].toLocaleString('en-US')}` : a.tag, () => startArcade(a))),
      game(10, 'Atlas', `${profile.atlas.filter(Boolean).length} / 12 found`, atlas),
      game(9, 'Theme', THEME_LABEL[profile.settings.theme], themePicker)),
    tabBar('home'),
  );
  show(el, null);
}

/** First-time walkthrough shown over the first Classic game. */
function guide(over: HTMLElement) {
  const steps: Array<[Pose, string]> = [
    ['wave', "Hi, I'm Luma! Drag your finger to aim, then let go to drop a piece."],
    ['think', 'Two of the same piece touch and merge into the next, bigger one.'],
    ['worried', "Keep everything below the dashed line. If a piece stays above it for 3 seconds, it's game over."],
    ['cheer', 'Every 10 merges charge the Gravity Pulse ✦. Now try to make a Star!'],
    ['think', 'Tap ? at the top any time to read all the rules, controls and tips.'],
  ];
  let i = 0;
  const pic = mascot(steps[0][0], 'guide-mascot');
  const text = h('p', {}, steps[0][1]);
  const dots = h('div.guide-dots', {}, ...steps.map((_, k) => h('span', { class: k === 0 ? 'on' : '' })));
  const btn = h('button.btn.primary', {}, 'Next');
  const box = h('div.guide', {}, h('div.guide-card.panel.ornate', {}, pic, text, dots, btn));
  btn.onclick = () => {
    sfx.click();
    i++;
    if (i >= steps.length) {
      profile.seenGuide = true;
      markSeen('drop');
      save();
      box.remove();
      return;
    }
    pic.setAttribute('src', mascotUrl(steps[i][0]));
    text.textContent = steps[i][1];
    [...dots.children].forEach((d, k) => d.classList.toggle('on', k === i));
    if (i === steps.length - 1) btn.textContent = "Let's play!";
  };
  over.append(box);
}

// ----- Modes -----

function classicMode(): ModeConfig {
  return { kind: 'classic', title: 'Classic', width: 400, pegs: [], maxDropTier: 4, dropCooldown: 420, powerUps: true, secondChance: true, music: 'play' };
}

function dailyMode(): ModeConfig {
  return { kind: 'daily', title: 'Daily Constellation', width: 400, pegs: [], maxDropTier: 4, seed: hashSeed('daily:' + todayKey()), dropCooldown: 420, powerUps: false, secondChance: false, music: 'play' };
}

const MINIGAMES: Array<{ id: GuideId; icon: string; name: string; desc: string; best: () => number; mode?: () => ModeConfig }> = [
  { id: 'rush', icon: '☄️', name: 'Meteor Rush', desc: '90 seconds, fast drops. Score as much as you can.', best: () => profile.bestRush,
    mode: () => ({ kind: 'rush', title: 'Meteor Rush', width: 400, pegs: [], maxDropTier: 3, timeLimit: 90, dropCooldown: 200, powerUps: false, secondChance: false, music: 'rush' }) },
  { id: 'tiny', icon: '🔭', name: 'Tiny Dome', desc: 'A narrow dome. Survive as long as you can.', best: () => profile.bestTiny,
    mode: () => ({ kind: 'tiny', title: 'Tiny Dome', width: 280, pegs: [], maxDropTier: 3, dropCooldown: 420, powerUps: false, secondChance: true, music: 'play' }) },
  { id: 'zen', icon: '🌙', name: 'Zen Orbit', desc: 'No game over. Calm music, just merge and relax.', best: () => 0,
    mode: () => ({ kind: 'zen', title: 'Zen Orbit', width: 400, pegs: [], maxDropTier: 4, noOverflow: true, dropCooldown: 420, powerUps: false, secondChance: false, music: 'zen' }) },
  { id: 'catcher', icon: '✨', name: 'Star Catcher', desc: 'Tap the falling pieces that match the target. 60 seconds.', best: () => profile.bestCatcher },
];

const GAME_ART: Record<string, number> = { rush: 1, tiny: 7, zen: 5, catcher: 3 };

function startRun(mode: ModeConfig) {
  const session = new PlaySession(mode, r => results(r), () => (mode.kind === 'level' ? levels() : mode.kind === 'challenge' || mode.kind === 'daily' ? challenges() : ['rush', 'tiny', 'zen'].includes(mode.kind) ? minigames() : home()));
  show(session.el, null, session);
  const gid = session.guideId();
  if (gid === 'drop') { if (!profile.seenGuide && profile.settings.howTo !== false) guide(session.el); }
  else firstTime(gid, session);
}

window.addEventListener('sd-restart', e => startRun((e as CustomEvent<ModeConfig>).detail));

function startCatcher() {
  const s = new CatcherSession(r => {
    if (r.best) profile.bestCatcher = r.score;
    const coins = Math.floor(r.score / 20);
    profile.coins += coins;
    profile.totals.runs++;
    track({ type: 'minigame' });
    save();
    gameFinished();
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
  if ((m.kind === 'level' || m.kind === 'challenge') && r.won) profile.rewards.spins++;
  profile.coins += coins;
  profile.totals.runs++;
  save();
  gameFinished();
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
    h('div.result-card.panel.ornate', {},
      mascot(stars !== null || best ? 'cheer' : score > 0 ? 'think' : 'worried', 'result-mascot'),
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
  const card = el.querySelector('.result-card')!;
  const extras = h('div.result-extras', {});
  const fillExtras = () => {
    extras.replaceChildren(...[
      spinsWaiting() ? h('button.reward-btn.wheel', { onclick: () => { sfx.click(); openWheel(fillExtras); } }, h('span', {}, '🎡'), h('span', {}, 'Spin the Lucky Wheel'), h('b', {}, String(spinsWaiting()))) : null,
      chestReady() ? h('button.reward-btn.chest', { onclick: () => { sfx.click(); openChest(fillExtras); } }, h('span', {}, '🎁'), h('span', {}, 'Open the Star Chest')) : null,
      !chestReady() ? h('div.chest-meter', {}, h('span', {}, '🎁'), h('div.cm-bar', {}, h('div.cm-fill', { style: `width:${(profile.rewards.chest / CHEST_EVERY) * 100}%` })), h('span.cm-n', {}, `${profile.rewards.chest}/${CHEST_EVERY}`)) : null,
    ].filter((x): x is HTMLElement => !!x));
  };
  fillExtras();
  card.insertBefore(extras, card.querySelector('.btn'));
  setTimeout(checkTrophies, 900);
  if (coins > 0) setTimeout(() => sfx.coin(), 500);
  if (best || (stars ?? 0) >= 1) setTimeout(() => confetti(), 250);
  show(el, back);
}

// ----- Levels -----

const REGIONS = [
  { name: 'Moon Meadows', tier: 5 },
  { name: 'Ring Belt', tier: 8 },
  { name: 'Star Forge', tier: 10 },
];

function levels() {
  playMusic('home');
  const current = nextLevel().id;
  const ROW = 92;
  const xs = LEVELS.map((_, i) => 50 + 30 * Math.sin(i * 0.95));
  const per = 10;
  const banners = Math.ceil(LEVELS.length / per);
  const BANNER = 70;
  const yOf = (i: number) => Math.floor(i / per + 1) * BANNER + i * ROW + ROW / 2;
  const height = yOf(LEVELS.length - 1) + ROW / 2 + 10;
  const path = LEVELS.map((_, i) => `${i ? 'L' : 'M'}${xs[i]} ${yOf(i)}`).join(' ');
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', `0 0 100 ${height}`);
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.classList.add('path-line');
  svg.innerHTML = `<path d="${path}" /><path class="done" d="${LEVELS.slice(0, current).map((_, i) => `${i ? 'L' : 'M'}${xs[i]} ${yOf(i)}`).join(' ')}" />`;
  const map = h('div.level-map', { style: `height:${height}px` }, svg);
  for (let b = 0; b < banners; b++) {
    const r = REGIONS[b % REGIONS.length];
    map.append(h('div.region.panel', { style: `top:${b * (per * ROW + BANNER) + 8}px` }, spriteImg(r.tier, 16), h('span', {}, r.name), h('span.region-n', {}, `${b * per + 1}–${Math.min(LEVELS.length, (b + 1) * per)}`)));
  }
  LEVELS.forEach((lv, i) => {
    const stars = profile.levelStars[i] ?? 0;
    const unlocked = i === 0 || (profile.levelStars[i - 1] ?? 0) > 0;
    const node = h('button.node' + (lv.challenge ? '.challenge' : '') + (unlocked ? '' : '.locked') + (lv.id === current ? '.current' : ''), {
      style: `left:${xs[i]}%;top:${yOf(i)}px`,
      onclick: () => { if (!unlocked) { toast('Finish the level before to unlock this one'); return; } sfx.click(); levelIntro(lv); },
    },
    h('span.num', {}, unlocked ? String(lv.id) : '🔒'),
    unlocked ? h('span.node-stars', {}, ...[1, 2, 3].map(k => h('span', { class: k <= stars ? 'on' : '' }, '★'))) : null,
    lv.id === current ? mascot('wave', 'node-mascot' + (xs[i] > 50 ? '.left' : '')) : null);
    map.append(node);
  });
  const el = h('div.screen.list.tabbed', {}, topBar('Levels', home), h('p.hint', {}, `${totalStars()} / ${LEVELS.length * 3} ★ · Every 5th level is a challenge with a twist.`), map, tabBar('levels'));
  show(el, home);
  requestAnimationFrame(() => el.querySelector('.node.current')?.scrollIntoView({ block: 'center' }));
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

// ----- Arcade -----

type Category = 'All' | 'Merge' | 'Puzzle' | 'Action' | 'Relax';
interface ArcadeDef { id: GuideId; name: string; tag: string; desc: string; art: number; cat: Category; coinDiv: number; make: (hooks: ArcadeHooks) => ArcadeGame }

const ARCADE: ArcadeDef[] = [
  { id: 'fusion', name: 'Planet Fusion', tag: 'Swipe & merge', desc: 'Swipe the board. Matching pieces merge into bigger ones.', art: 6, cat: 'Merge', coinDiv: 40, make: hk => new FusionGame(hk) },
  { id: 'blocks', name: 'Meteor Blocks', tag: 'Block puzzle', desc: 'Fit the shapes on the grid. Fill rows and columns to clear them.', art: 2, cat: 'Puzzle', coinDiv: 10, make: hk => new BlocksGame(hk) },
  { id: 'bubbles', name: 'Bubble Nebula', tag: 'Aim & pop', desc: 'Shoot pieces and pop groups of three or more.', art: 4, cat: 'Action', coinDiv: 15, make: hk => new BubblesGame(hk) },
  { id: 'snake', name: 'Comet Trail', tag: 'Steer & grow', desc: 'Steer the comet, collect pieces and grow your trail.', art: -1, cat: 'Action', coinDiv: 15, make: hk => new SnakeGame(hk) },
  { id: 'match3', name: 'Gem Swap', tag: 'Match 3', desc: 'Swap neighbours to line up three or more. 30 moves.', art: 9, cat: 'Puzzle', coinDiv: 20, make: hk => new Match3Game(hk) },
  { id: 'pairs', name: 'Star Pairs', tag: 'Memory', desc: 'Flip cards and find every pair before time runs out.', art: 8, cat: 'Relax', coinDiv: 25, make: hk => new PairsGame(hk) },
];

let arcadeCat: Category = 'All';

function arcade(cat: Category = arcadeCat) {
  arcadeCat = cat;
  playMusic('home');
  const entries: Array<{ id: GuideId; name: string; desc: string; art: number; cat: Category; best: number; play: () => void }> = [
    ...ARCADE.map(a => ({ id: a.id, name: a.name, desc: a.desc, art: a.art, cat: a.cat, best: profile.arcade[a.id] ?? 0, play: () => startArcade(a) })),
    ...MINIGAMES.map(m => ({ id: m.id, name: m.name, desc: m.desc, art: GAME_ART[m.id] ?? 4, cat: (m.id === 'zen' ? 'Relax' : m.id === 'tiny' ? 'Merge' : 'Action') as Category, best: m.best(), play: () => (m.mode ? startRun(m.mode()) : startCatcher()) })),
  ];
  const chips = h('div.chips', {}, ...(['All', 'Merge', 'Puzzle', 'Action', 'Relax'] as Category[]).map(c =>
    h('button.chip' + (c === cat ? '.on' : ''), { onclick: () => { sfx.click(); arcade(c); } }, c)));
  const list = h('div.arcade-grid', {}, ...entries.filter(e => cat === 'All' || e.cat === cat).map(e =>
    h('button.arcade-card.panel', { onclick: () => { unlockAudio(); sfx.click(); e.play(); } },
      h('div.ac-art', {}, spriteImg(e.art, 30)),
      h('div.ac-name', {}, e.name),
      h('div.ac-desc', {}, e.desc),
      h('div.ac-best', {}, e.best ? `Best ${e.best.toLocaleString('en-US')}` : 'New'),
      howToChip(e.id))));
  show(h('div.screen.list.tabbed', {}, topBar('Arcade', home), chips, list, tabBar('arcade')), home);
}

/** Small ? on a game card that opens its How to play (without starting the game). */
function howToChip(id: GuideId): HTMLElement {
  return h('span.howto-chip', {
    role: 'button', tabindex: 0, 'aria-label': 'How to play',
    onclick: (e: Event) => { e.stopPropagation(); sfx.click(); openGuide(id); },
  }, '?');
}

function startArcade(a: ArcadeDef) {
  const game = a.make({
    guide: a.id,
    onEnd: score => {
      const best = score > (profile.arcade[a.id] ?? 0);
      if (best) profile.arcade[a.id] = score;
      const coins = Math.floor(score / a.coinDiv);
      profile.coins += coins;
      profile.totals.runs++;
      track({ type: 'minigame' });
      save();
      gameFinished();
      resultCard(a.name, score, best, coins, null, () => startArcade(a), () => arcade());
    },
    onQuit: () => arcade(),
    onRestart: () => startArcade(a),
  });
  show(game.el, null, game);
}

// ----- Minigames -----

function minigames() {
  playMusic('home');
  const list = h('div.cards', {});
  for (const g of MINIGAMES) {
    list.append(h('button.card', { onclick: () => { unlockAudio(); sfx.click(); if (g.mode) startRun(g.mode()); else startCatcher(); } },
      spriteImg(GAME_ART[g.id] ?? 4, 24),
      h('span.card-body', {}, h('span.card-title', {}, g.name), h('span.card-desc', {}, g.desc), g.best() ? h('span.card-best', {}, `Best ${g.best().toLocaleString('en-US')}`) : null),
      howToChip(g.id)));
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
  const el = h('div.screen.list.tabbed', {},
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
    tabBar('daily'),
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
  show(h('div.screen.list.tabbed', {}, topBar('Atlas', home), h('p.hint', {}, `${found} / 12 discovered`), grid, tabBar('')), home);
}

// ----- Trophies -----

function trophies() {
  const got = profile.rewards.trophies;
  const list = h('div.trophy-list', {}, ...TROPHIES.map(t => {
    const [have, need] = t.progress(profile);
    const done = got.includes(t.id);
    return h('div.trophy' + (done ? '.done' : ''), {},
      h('span.tr-icon', {}, t.icon),
      h('div.tr-body', {},
        h('div.tr-name', {}, t.name),
        h('div.tr-text', {}, t.text),
        done ? null : h('div.m-bar', {}, h('div.m-fill', { style: `width:${Math.min(100, (have / need) * 100)}%` }))),
      h('span.tr-reward', {}, done ? '✓' : `${t.reward} ★`));
  }));
  show(h('div.screen.list', {}, topBar('Trophies', home), h('p.hint', {}, `${got.length} / ${TROPHIES.length} earned`), list), home);
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
  const el = h('div.screen.list.tabbed', {},
    topBar('Shop', home),
    h('p.hint', {}, 'Everything here is bought with coins you earn by playing.'),
    h('h2.section', {}, 'Dome skins'),
    h('div.shop-grid', {}, ...(Object.keys(SKINS) as DomeSkin[]).map(skinCard)),
    h('h2.section', {}, 'Power-ups'),
    h('div.shop-grid', {},
      powerCard('pop', '💥', 'Pop', 'Remove one piece'),
      powerCard('swap', '🔄', 'Swap', 'Change the next drop'),
      powerCard('boost', '⏫', 'Boost', 'Level up one piece')),
    tabBar('shop'),
  );
  show(el, home);
}

// ----- Theme + settings -----

let pickerTimer = 0;
function refreshPicker() {
  clearTimeout(pickerTimer);
  pickerTimer = window.setTimeout(themePicker, 120);
}

function themePicker() {
  for (const t of Object.keys(THEME_LABEL) as Theme[]) {
    if (!hasArt(0, t)) preloadTheme(t, () => { if (document.querySelector('.theme-opt')) refreshPicker(); });
  }
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
      onclick: () => { profile.settings.theme = t; save(); sfx.click(); preloadTheme(t); themePicker(); },
    }, h('span.card-title', {}, THEME_LABEL[t]), row);
  });
  show(h('div.screen.list', {}, topBar('Theme', home), h('p.hint', {}, 'Pick how the pieces look. The rules are the same in every theme.'), ...opts), home);
}

function settings() {
  const slider = (label: string, key: 'music' | 'sfx') => h('label.setting', {}, h('span', {}, label),
    h('input', { type: 'range', min: 0, max: 1, step: 0.05, value: profile.settings[key], oninput: (e: Event) => { profile.settings[key] = Number((e.target as HTMLInputElement).value); applyVolumes(); save(); } }));
  const toggle = (label: string, key: 'vibration' | 'faces' | 'howTo') => h('label.setting', {}, h('span', {}, label),
    h('input', { type: 'checkbox', checked: profile.settings[key], onchange: (e: Event) => { profile.settings[key] = (e.target as HTMLInputElement).checked; save(); } }));
  const status = h('p.small', {}, '');
  const el = h('div.screen.list', {},
    topBar('Settings', home),
    slider('🎵 Music', 'music'),
    slider('🔊 Sound effects', 'sfx'),
    toggle('📳 Vibration', 'vibration'),
    toggle('😊 Faces on pieces', 'faces'),
    h('button.btn', { onclick: () => { sfx.click(); themePicker(); } }, `🎨 Theme: ${THEME_LABEL[profile.settings.theme]}`),
    h('label.setting', {}, h('span', {}, '🌐 Language'),
      h('select.lang', { onchange: (e: Event) => { profile.settings.lang = (e.target as HTMLSelectElement).value as 'auto' | 'en' | 'es'; save(); document.documentElement.lang = lang(); settings(); } },
        ...([['auto', 'Phone language'], ['en', 'English'], ['es', 'Español']] as const).map(([v, label]) => h('option', { value: v, selected: profile.settings.lang === v }, label)))),
    h('h2.section', {}, 'How to play'),
    toggle('💡 Show how to play on first game', 'howTo'),
    h('div.howto-list', {}, ...GUIDE_ORDER.map(id => h('button.chip', { onclick: () => { sfx.click(); openGuide(id); } }, GUIDE_NAME[id]))),
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
