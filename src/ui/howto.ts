/**
 * How to play: the guide sheet every game opens from its ? button, from the Arcade cards and from
 * Settings. The first time someone plays a game, the sheet opens by itself with the game held still.
 * The text is written in English and Spanish (src/i18n/guides.ts), so the page translator skips it.
 */
import { sfx } from '../audio';
import { mascotUrl, pieceEl, THEME_NAMES } from '../game/art';
import { lang, tr } from '../i18n';
import { GUIDES_EN, GUIDES_ES, type Guide, type GuideId } from '../i18n/guides';
import { profile, save } from '../save';
import { h } from './dom';

export type { GuideId };

/** A game that can be held still while its guide is open. */
export interface Holdable { hold(on: boolean): void }

export const GUIDE_NAME: Record<GuideId, string> = {
  drop: 'Stellar Drop', rush: 'Meteor Rush', tiny: 'Tiny Dome', zen: 'Zen Orbit', catcher: 'Star Catcher',
  fusion: 'Planet Fusion', blocks: 'Meteor Blocks', bubbles: 'Bubble Nebula', snake: 'Comet Trail', match3: 'Gem Swap', pairs: 'Star Pairs',
};

/** Piece shown at the top of each guide (-1 is the Comet). */
const GUIDE_ART: Record<GuideId, number> = { drop: 10, rush: 1, tiny: 7, zen: 5, catcher: 3, fusion: 6, blocks: 2, bubbles: 4, snake: -1, match3: 9, pairs: 8 };

export const GUIDE_ORDER: GuideId[] = ['drop', 'rush', 'tiny', 'zen', 'catcher', 'fusion', 'blocks', 'bubbles', 'snake', 'match3', 'pairs'];

const L = (en: string, es: string) => (lang() === 'es' ? es : en);

function guideFor(id: GuideId): Guide {
  const g = (lang() === 'es' ? GUIDES_ES : GUIDES_EN)[id];
  const top = tr(THEME_NAMES[profile.settings.theme][10]);
  const fill = (s: string) => s.replaceAll('{top}', top);
  return {
    goal: fill(g.goal),
    steps: g.steps.map(fill),
    controls: g.controls.map(([a, b]) => [fill(a), fill(b)]),
    specials: g.specials?.map(([a, b]) => [fill(a), fill(b)]),
    scoring: g.scoring.map(fill),
    tips: g.tips.map(fill),
  };
}

/** Closes the open guide, if any. Returns true when one was open (for the Android back button). */
export function closeGuide(): boolean {
  const back = document.querySelector<HTMLElement & { close?: () => void }>('.howto-back');
  if (!back) return false;
  back.close?.();
  return true;
}

/** Opens the How to play sheet. `first` is the first-time version, which ends with "Let's play!". */
export function openGuide(id: GuideId, onClose?: () => void, first = false) {
  closeGuide();
  const g = guideFor(id);
  const T = {
    eyebrow: L('How to play', 'Cómo jugar'), goal: L('Goal', 'Objetivo'), steps: L('How it works', 'Cómo funciona'),
    controls: L('Controls', 'Controles'), specials: L('Specials', 'Especiales'), scoring: L('Points and coins', 'Puntos y monedas'),
    tips: L("Luma's tips", 'Consejos de Luma'), ok: first ? L("Let's play!", '¡A jugar!') : L('Got it', 'Entendido'), close: L('Close', 'Cerrar'),
  };
  const sid = (s: string) => `howto-${s}`;
  const sections: Array<[string, string]> = [['goal', T.goal], ['steps', T.steps], ['controls', T.controls], ...(g.specials?.length ? [['specials', T.specials] as [string, string]] : []), ['scoring', T.scoring], ['tips', T.tips]];
  const jump = (s: string) => (e: Event) => { e.preventDefault(); sheet.querySelector(`#${sid(s)}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
  const head = (key: string, icon: string, text: string) => h('h3.ht-h', { id: sid(key) }, h('span.ht-ico', {}, icon), text);

  const done = () => { sfx.click(); close(); };
  const sheet = h('div.howto.panel.ornate', { role: 'dialog', 'aria-modal': 'true', 'aria-label': T.eyebrow },
    h('div.ht-top', {},
      h('div.ht-art', {}, pieceEl(GUIDE_ART[id], 24, profile.settings.theme)),
      h('div.ht-title', {}, h('small', {}, T.eyebrow), h('h2', {}, tr(GUIDE_NAME[id]))),
      h('button.ht-x', { type: 'button', 'aria-label': T.close, onclick: done }, '✕')),
    h('nav.ht-chips', {}, ...sections.map(([k, label]) => h('a', { href: `#${sid(k)}`, onclick: jump(k) }, label))),
    h('div.ht-body', {},
      h('section.ht-goal', {}, head('goal', '🎯', T.goal), h('p', {}, g.goal)),
      h('section', {}, head('steps', '📖', T.steps), h('ol.ht-steps', {}, ...g.steps.map(s => h('li', {}, s)))),
      h('section', {}, head('controls', '👆', T.controls),
        h('div.ht-grid', {}, ...g.controls.map(([name, text]) => h('div.ht-card', {}, h('b', {}, name), h('span', {}, text))))),
      g.specials?.length ? h('section', {}, head('specials', '✨', T.specials),
        h('ul.ht-list', {}, ...g.specials.map(([name, text]) => h('li', {}, h('b', {}, name), ' ', text)))) : null,
      h('section', {}, head('scoring', '★', T.scoring), h('ul.ht-list', {}, ...g.scoring.map(s => h('li', {}, s)))),
      h('section.ht-tips', { id: sid('tips') },
        h('img', { src: mascotUrl('think'), alt: '' }),
        h('div', {}, h('b', {}, T.tips), ...g.tips.map(t => h('p', {}, t))))),
    h('button.btn.primary.ht-ok', { type: 'button', onclick: done }, T.ok));
  const back = h('div.howto-back', { 'data-i18n': 'off', lang: lang() }, sheet) as HTMLElement & { close?: () => void };
  back.addEventListener('pointerdown', e => { if (e.target === back) done(); });
  // Taps on the sheet must not reach the game underneath.
  back.addEventListener('pointerup', e => e.stopPropagation());
  function close() {
    back.remove();
    onClose?.();
  }
  back.close = close;
  document.body.append(back);
  return close;
}

/** The round ? button for a game's top bar. The game is held still while the guide is open. */
export function helpButton(id: GuideId, game: Holdable): HTMLElement {
  return h('button.icon-btn.help-btn', {
    type: 'button', 'aria-label': L('How to play', 'Cómo jugar'),
    onclick: (e: Event) => { e.stopPropagation(); sfx.click(); game.hold(true); openGuide(id, () => game.hold(false)); },
  }, '?');
}

const seen = (id: GuideId) => (profile.seenHow ?? []).includes(id);

export function markSeen(id: GuideId) {
  if (seen(id)) return;
  profile.seenHow = [...(profile.seenHow ?? []), id];
  save();
}

/** Opens the guide by itself the first time someone plays a game (unless turned off in Settings). */
export function firstTime(id: GuideId, game: Holdable & { el: HTMLElement }) {
  if (seen(id) || profile.settings.howTo === false) return;
  setTimeout(() => {
    if (!game.el.isConnected || document.querySelector('.howto-back')) return;
    markSeen(id);
    game.hold(true);
    openGuide(id, () => game.hold(false), true);
  }, 350);
}
