import { dailyMissions, progressOf, weeklyMissions, type Mission, type StatEvent } from './core/missions';
import { todayKey, weekKey } from './core/rng';

export type PowerUp = 'pop' | 'swap' | 'boost';
export type DomeSkin = 'glass' | 'crystal' | 'brass' | 'neon';

export interface Settings {
  music: number; // 0..1
  sfx: number; // 0..1
  vibration: boolean;
  faces: boolean;
  theme: 'space' | 'sea' | 'gems' | 'sweets';
  lang: 'auto' | 'en' | 'es';
}

export interface Profile {
  coins: number;
  bestClassic: number;
  bestRush: number;
  bestTiny: number;
  bestCatcher: number;
  arcade: Record<string, number>; // best score per Arcade game
  levelStars: number[]; // index = level id - 1
  atlas: boolean[]; // tiers discovered, plus supernova at the end
  power: Record<PowerUp, number>;
  skins: DomeSkin[];
  skin: DomeSkin;
  daily: { key: string; best: number; challengeDone: boolean };
  missions: { key: string; progress: Record<string, number>; claimed: string[] };
  weekly: { key: string; progress: Record<string, number>; claimed: string[] };
  totals: { runs: number; merges: number; supernovas: number };
  settings: Settings;
  seenGuide: boolean;
}

const KEY = 'stellar-drop-save-v1';

function fresh(): Profile {
  return {
    coins: 100,
    bestClassic: 0,
    bestRush: 0,
    bestTiny: 0,
    bestCatcher: 0,
    arcade: {},
    levelStars: [],
    atlas: [],
    power: { pop: 2, swap: 2, boost: 1 },
    skins: ['glass'],
    skin: 'glass',
    daily: { key: '', best: 0, challengeDone: false },
    missions: { key: '', progress: {}, claimed: [] },
    weekly: { key: '', progress: {}, claimed: [] },
    totals: { runs: 0, merges: 0, supernovas: 0 },
    settings: { music: 0.6, sfx: 0.8, vibration: true, faces: true, theme: 'space', lang: 'auto' },
    seenGuide: false,
  };
}

function load(): Profile {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return fresh();
    const p = JSON.parse(raw) as Partial<Profile>;
    const f = fresh();
    return { ...f, ...p, power: { ...f.power, ...p.power }, arcade: { ...p.arcade }, settings: { ...f.settings, ...p.settings }, totals: { ...f.totals, ...p.totals } };
  } catch {
    return fresh();
  }
}

export const profile: Profile = load();

export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(profile)); } catch { /* storage full or blocked */ }
}

export function resetProgress() {
  const keep = profile.settings;
  Object.assign(profile, fresh(), { settings: keep });
  save();
}

/** Rolls the daily and weekly boards over when the date changes. */
export function refreshPeriods() {
  const d = todayKey();
  if (profile.daily.key !== d) profile.daily = { key: d, best: 0, challengeDone: false };
  if (profile.missions.key !== d) profile.missions = { key: d, progress: {}, claimed: [] };
  const w = weekKey();
  if (profile.weekly.key !== w) profile.weekly = { key: w, progress: {}, claimed: [] };
}

export function currentMissions(): { daily: Mission[]; weekly: Mission[] } {
  refreshPeriods();
  return { daily: dailyMissions(profile.missions.key), weekly: weeklyMissions(profile.weekly.key) };
}

/** Counts an event toward every open mission. */
export function track(e: StatEvent) {
  const { daily, weekly } = currentMissions();
  for (const [list, box] of [[daily, profile.missions], [weekly, profile.weekly]] as const) {
    for (const m of list) {
      const add = progressOf(m.match, e);
      if (add) box.progress[m.id] = Math.min(m.target, (box.progress[m.id] ?? 0) + add);
    }
  }
  if (e.type === 'make') {
    profile.atlas[e.tier] = true;
    profile.totals.merges++;
  }
  if (e.type === 'supernova') {
    profile.atlas[11] = true;
    profile.totals.supernovas++;
  }
}

export function missionsReady(): number {
  const { daily, weekly } = currentMissions();
  let n = 0;
  for (const m of daily) if ((profile.missions.progress[m.id] ?? 0) >= m.target && !profile.missions.claimed.includes(m.id)) n++;
  for (const m of weekly) if ((profile.weekly.progress[m.id] ?? 0) >= m.target && !profile.weekly.claimed.includes(m.id)) n++;
  return n;
}

export function totalStars(): number {
  return profile.levelStars.reduce((a, b) => a + (b || 0), 0);
}
