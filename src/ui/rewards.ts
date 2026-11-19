/** The Lucky Wheel, the Star Chest and trophy awards (rules in core/rewards.ts). */
import { sfx } from '../audio';
import { todayKey } from '../core/rng';
import { CHEST_EVERY, chestPrizes, grant, newTrophies, WHEEL, wheelSlice, type Prize } from '../core/rewards';
import { buzz } from '../platform';
import { profile, save } from '../save';
import { confetti, h, toast } from './dom';

const POWER_ICON = { pop: '💥', swap: '🔄', boost: '⏫' } as const;
const POWER_NAME = { pop: 'Pop', swap: 'Swap', boost: 'Boost' } as const;
const SLICE_COLORS = ['#7a5cff', '#ff6fae', '#4fc3ff', '#ffb547', '#9b6bff', '#46d6a0', '#ff8a5c', '#ffd84a'];

export const freeSpinReady = () => profile.rewards.freeSpinDay !== todayKey();
export const spinsWaiting = () => profile.rewards.spins + (freeSpinReady() ? 1 : 0);
export const chestReady = () => profile.rewards.chest >= CHEST_EVERY;

function prizeEl(p: Prize): HTMLElement {
  return 'coins' in p
    ? h('div.prize', {}, h('span.prize-icon', {}, '★'), h('span', {}, `+${p.coins} coins`))
    : h('div.prize', {}, h('span.prize-icon', {}, POWER_ICON[p.power]), h('span', {}, `${POWER_NAME[p.power]} ×${p.count}`));
}

/** Call once for every finished game: moves the Star Chest along. */
export function gameFinished() {
  profile.rewards.chest = Math.min(CHEST_EVERY, profile.rewards.chest + 1);
  save();
}

/** Awards any trophies that were just earned, with a toast for each. */
export function checkTrophies() {
  const list = newTrophies(profile);
  if (!list.length) return;
  for (const t of list) {
    profile.rewards.trophies.push(t.id);
    profile.coins += t.reward;
  }
  save();
  list.forEach((t, i) => setTimeout(() => { sfx.win(); toast(`🏆 ${t.name} · +${t.reward} ★`, 2600); }, 600 + i * 2800));
}

function sheet(...children: Array<HTMLElement | null>): { back: HTMLElement; close: () => void } {
  const back = h('div.reward-back', {}, h('div.reward-card.panel.ornate', {}, ...children));
  document.body.append(back);
  return { back, close: () => back.remove() };
}

/** The Lucky Wheel. Uses a waiting spin, or today's free spin. */
export function openWheel(onClose?: () => void) {
  const n = WHEEL.length, step = 360 / n;
  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('viewBox', '-100 -100 200 200');
  svg.classList.add('wheel-svg');
  let inner = '';
  WHEEL.forEach((p, i) => {
    const a0 = ((i * step - 90 - step / 2) * Math.PI) / 180, a1 = (((i + 1) * step - 90 - step / 2) * Math.PI) / 180;
    inner += `<path d="M0 0 L${95 * Math.cos(a0)} ${95 * Math.sin(a0)} A95 95 0 0 1 ${95 * Math.cos(a1)} ${95 * Math.sin(a1)} Z" fill="${SLICE_COLORS[i]}" stroke="#2a1660" stroke-width="2"/>`;
    const label = 'coins' in p ? `${p.coins}` : POWER_ICON[p.power];
    const sub = 'coins' in p ? '★' : '×1';
    inner += `<g transform="rotate(${i * step})"><text y="-58" text-anchor="middle" class="wl">${label}</text><text y="-40" text-anchor="middle" class="ws">${sub}</text></g>`;
  });
  inner += '<circle r="95" fill="none" stroke="#ffcf5a" stroke-width="5"/>';
  for (let i = 0; i < n; i++) {
    const a = ((i * step - 90 - step / 2) * Math.PI) / 180;
    inner += `<circle cx="${95 * Math.cos(a)}" cy="${95 * Math.sin(a)}" r="3.5" fill="#fff6d0"/>`;
  }
  inner += '<circle r="16" fill="#ffcf5a" stroke="#8a4a08" stroke-width="3"/><text y="6" text-anchor="middle" class="wc">★</text>';
  svg.innerHTML = inner;
  const rotor = h('div.wheel-rotor', {}, svg);
  const result = h('div.wheel-result', {});
  const left = h('p.small', {}, '');
  const spin = h('button.btn.primary', {}, '🎡 Spin');
  const done = h('button.btn', {}, 'Close');
  const { close } = sheet(h('h2', {}, 'Lucky Wheel'), h('div.wheel-wrap', {}, h('div.wheel-pointer', {}), rotor), result, left, spin, done);
  let turned = 0;
  let spinning = false;
  const refresh = () => {
    const w = spinsWaiting();
    left.textContent = w ? `Spins left: ${w}` : 'Win a level for another spin, or come back tomorrow.';
    spin.style.display = w ? '' : 'none';
  };
  refresh();
  done.onclick = () => { if (spinning) return; sfx.click(); close(); onClose?.(); };
  spin.onclick = () => {
    if (spinning || !spinsWaiting()) return;
    spinning = true;
    if (freeSpinReady()) profile.rewards.freeSpinDay = todayKey();
    else profile.rewards.spins--;
    profile.rewards.spun++;
    const slice = wheelSlice(Math.random());
    const prize = WHEEL[slice];
    grant(profile, prize);
    save();
    result.replaceChildren();
    spin.setAttribute('disabled', '');
    // Land on the slice with a little random offset inside it, after 5 full turns.
    const target = 360 * 5 + (360 - slice * step) + (Math.random() - 0.5) * step * 0.6;
    turned = turned - (turned % 360) + target;
    rotor.style.transition = 'transform 4.2s cubic-bezier(0.12, 0.7, 0.18, 1)';
    rotor.style.transform = `rotate(${turned}deg)`;
    // Ticks that slow down with the wheel.
    let tick = 0;
    const ticker = () => { if (tick > 26) return; sfx.click(); tick++; setTimeout(ticker, 40 + tick * tick * 0.45); };
    ticker();
    setTimeout(() => {
      spinning = false;
      spin.removeAttribute('disabled');
      result.replaceChildren(h('div.you-won', {}, 'You won'), prizeEl(prize));
      ('coins' in prize && prize.coins >= 250) ? (sfx.supernova(), confetti(90)) : (sfx.coin(), confetti(40));
      buzz(true);
      refresh();
      checkTrophies();
    }, 4300);
  };
}

/** The Star Chest: opens when ready, with a shake, a burst and its prizes. */
export function openChest(onClose?: () => void) {
  if (!chestReady()) return;
  const prizes = chestPrizes(profile.rewards.chestsOpened);
  const big = prizes[0] && 'coins' in prizes[0] && prizes[0].coins > 150;
  const box = h('div.chest-box', {}, '🎁');
  const list = h('div.prize-list', {});
  const open = h('button.btn.primary', {}, 'Open');
  const done = h('button.btn', { style: 'display:none' }, 'Collect');
  const { close } = sheet(h('h2', {}, big ? 'Big Star Chest!' : 'Star Chest'), h('p.small', {}, `You finished ${CHEST_EVERY} games.`), box, list, open, done);
  open.onclick = () => {
    open.style.display = 'none';
    sfx.click();
    box.classList.add('shake');
    setTimeout(() => {
      box.classList.remove('shake');
      box.classList.add('burst');
      box.textContent = '✨';
      profile.rewards.chest = 0;
      profile.rewards.chestsOpened++;
      for (const p of prizes) grant(profile, p);
      save();
      sfx.supernova();
      buzz(true);
      confetti(80);
      prizes.forEach((p, i) => setTimeout(() => { list.append(prizeEl(p)); sfx.coin(); }, 300 + i * 260));
      setTimeout(() => { done.style.display = ''; checkTrophies(); }, 400 + prizes.length * 260);
    }, 1100);
  };
  done.onclick = () => { sfx.click(); close(); onClose?.(); };
}
