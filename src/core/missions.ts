import { hashSeed, rng } from './rng';
import { TIERS } from './tiers';

/** Things the game reports as you play; missions count them. */
export type StatEvent =
  | { type: 'make'; tier: number }
  | { type: 'chain'; length: number }
  | { type: 'runScore'; score: number }
  | { type: 'minigame' }
  | { type: 'levelStars'; stars: number }
  | { type: 'pulse' }
  | { type: 'supernova' };

export interface Mission {
  id: string;
  text: string;
  target: number;
  reward: number;
  match: MissionMatch;
}

export type MissionMatch =
  | { type: 'make'; tier: number }
  | { type: 'chain'; length: number }
  | { type: 'runScore'; score: number }
  | { type: 'minigame' }
  | { type: 'levelStars' }
  | { type: 'pulse' };

/** How much one event moves a mission forward. */
export function progressOf(m: MissionMatch, e: StatEvent): number {
  if (m.type === 'make' && e.type === 'make') return e.tier >= m.tier ? 1 : 0;
  if (m.type === 'chain' && e.type === 'chain') return e.length >= m.length ? 1 : 0;
  if (m.type === 'runScore' && e.type === 'runScore') return e.score >= m.score ? 1 : 0;
  if (m.type === 'minigame' && e.type === 'minigame') return 1;
  if (m.type === 'levelStars' && e.type === 'levelStars') return e.stars;
  if (m.type === 'pulse' && e.type === 'pulse') return 1;
  return 0;
}

function makeMission(r: () => number, scale: number, idx: number, prefix: string): Mission {
  const kind = Math.floor(r() * 6);
  const id = `${prefix}-${idx}`;
  switch (kind) {
    case 0: {
      const tier = 4 + Math.floor(r() * 3);
      const target = Math.max(1, Math.round((tier >= 6 ? 1 : 3) * scale));
      return { id, text: `Make ${target} × ${TIERS[tier].name} or bigger`, target, reward: 30 * scale + tier * 5, match: { type: 'make', tier } };
    }
    case 1: {
      const length = 3 + Math.floor(r() * 2);
      const target = Math.round(2 * scale);
      return { id, text: `Chain ${length} merges in a row, ${target} times`, target, reward: 40 * scale, match: { type: 'chain', length } };
    }
    case 2: {
      const score = (2 + Math.floor(r() * 4)) * 500 * Math.min(scale, 2);
      return { id, text: `Score ${score.toLocaleString('en-US')} in one run`, target: 1, reward: 50 * scale, match: { type: 'runScore', score } };
    }
    case 3: {
      const target = Math.round(2 * scale);
      return { id, text: `Play ${target} minigames`, target, reward: 30 * scale, match: { type: 'minigame' } };
    }
    case 4: {
      const target = Math.round(4 * scale);
      return { id, text: `Earn ${target} level stars`, target, reward: 40 * scale, match: { type: 'levelStars' } };
    }
    default: {
      const target = Math.round(5 * scale);
      return { id, text: `Use Gravity Pulse ${target} times`, target, reward: 25 * scale, match: { type: 'pulse' } };
    }
  }
}

/** Three missions for a day, the same all day. Kinds don't repeat. */
export function dailyMissions(dateKey: string): Mission[] {
  return pickDistinct(rng(hashSeed('missions:' + dateKey)), 3, 1, 'd' + dateKey);
}

/** Two bigger missions for a week. */
export function weeklyMissions(weekKey: string): Mission[] {
  return pickDistinct(rng(hashSeed('weekly:' + weekKey)), 2, 4, 'w' + weekKey);
}

function pickDistinct(r: () => number, n: number, scale: number, prefix: string): Mission[] {
  const out: Mission[] = [];
  let guard = 0;
  while (out.length < n && guard++ < 100) {
    const m = makeMission(r, scale, out.length, prefix);
    if (!out.some(o => o.match.type === m.match.type)) out.push(m);
  }
  return out;
}
