/**
 * English and Spanish.
 *
 * The game is written in English. In Spanish, text is looked up in the Spanish table (./es.ts) as it reaches the
 * page: a watcher translates every text node that is added or changed. Keys with {0}-style holes cover text with
 * numbers or names in it ("Best {0}"); the holes are translated too. Text with no entry stays in English.
 * Canvas text does not pass through the page, so games call tr() for it.
 */
import { profile } from '../save';
import { ES } from './es';

export type Lang = 'en' | 'es';

/** Spanish for any es-* phone language, English otherwise. */
export function deviceLang(): Lang {
  const list = navigator.languages?.length ? navigator.languages : [navigator.language];
  for (const l of list) {
    const base = (l || '').toLowerCase().slice(0, 2);
    if (base === 'es') return 'es';
    if (base === 'en') return 'en';
  }
  return 'en';
}

export function lang(): Lang {
  const c = profile.settings.lang ?? 'auto';
  return c === 'auto' ? deviceLang() : c;
}

interface Pattern { re: RegExp; out: string; weight: number }
const exact = new Map<string, string>();
const patterns: Pattern[] = [];
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function compile() {
  if (exact.size) return;
  for (const [en, es] of Object.entries(ES)) {
    if (!/\{\d\}/.test(en)) { exact.set(en, es); continue; }
    let src = '', last = 0;
    for (const m of en.matchAll(/\{(\d)\}/g)) {
      src += escape(en.slice(last, m.index)) + `(?<h${m[1]}>.+?)`;
      last = m.index! + m[0].length;
    }
    src += escape(en.slice(last));
    patterns.push({ re: new RegExp(`^${src}$`, 's'), out: es, weight: en.replace(/\{\d\}/g, '').length });
  }
  patterns.sort((a, b) => b.weight - a.weight);
}

function core(s: string): string {
  const hit = exact.get(s);
  if (hit !== undefined) return hit;
  for (const p of patterns) {
    const m = p.re.exec(s);
    if (m) return p.out.replace(/\{(\d)\}/g, (_, n: string) => core(m.groups?.[`h${n}`] ?? ''));
  }
  return s;
}

/** The text in the current language (keeps leading and trailing spaces). */
export function tr(s: string): string {
  if (lang() !== 'es' || !s.trim()) return s;
  compile();
  const lead = s.match(/^\s*/)![0], trail = s.match(/\s*$/)![0];
  return lead + core(s.trim()) + trail;
}

const done = new WeakMap<Text, string>();

function fix(node: Text) {
  if (done.get(node) === node.data) return;
  if (node.parentElement?.closest('[data-i18n="off"]')) return;
  const out = tr(node.data);
  done.set(node, out);
  if (out !== node.data) node.data = out;
}

function walk(n: Node) {
  if (n.nodeType === Node.TEXT_NODE) fix(n as Text);
  else n.childNodes.forEach(walk);
}

/** Starts translating the page; call once at start-up. */
export function startI18n() {
  document.documentElement.lang = lang();
  new MutationObserver(list => {
    if (lang() !== 'es') return;
    for (const m of list) {
      if (m.type === 'characterData') fix(m.target as Text);
      else m.addedNodes.forEach(walk);
    }
  }).observe(document.body, { subtree: true, childList: true, characterData: true });
}
