import { hashSeed, rng } from './rng';
import { TIERS } from './tiers';

export type Goal =
  | { kind: 'tier'; tier: number } // make one body of this tier
  | { kind: 'score'; value: number } // reach this score
  | { kind: 'count'; tier: number; count: number }; // make this many bodies of this tier

export interface Peg { x: number; y: number; r: number }

export interface LevelDef {
  id: number; // 1-based
  goal: Goal;
  drops: number; // drop limit
  width: number; // dome width in world units (400 = normal)
  pegs: Peg[];
  maxDropTier: number; // highest tier that can drop (0..4)
  challenge: boolean; // every 5th level
  twist?: 'noPulse' | 'noComet' | 'fastDrops';
}

export const LEVEL_COUNT = 30;
export const DOME_HEIGHT = 600;

/** Rows of static asteroid pegs, spread across the dome. */
function pegRow(width: number, y: number, n: number, r = 9): Peg[] {
  const pegs: Peg[] = [];
  for (let i = 0; i < n; i++) pegs.push({ x: (width * (i + 1)) / (n + 1), y, r });
  return pegs;
}

// [goal, drops, width, pegRows, maxDropTier, twist]
type Row = [Goal, number, number, Array<[number, number]>, number, LevelDef['twist']?];
const T = (tier: number): Goal => ({ kind: 'tier', tier });
const S = (value: number): Goal => ({ kind: 'score', value });
const C = (tier: number, count: number): Goal => ({ kind: 'count', tier, count });

const ROWS: Row[] = [
  [T(4), 45, 400, [], 2],
  [T(5), 60, 400, [], 3],
  [S(400), 55, 400, [], 4],
  [C(2, 6), 50, 400, [], 2],
  [T(5), 55, 400, [[330, 3]], 3, 'noComet'],
  [T(6), 85, 400, [], 4],
  [C(4, 3), 70, 400, [], 4],
  [S(900), 80, 400, [[360, 2]], 4],
  [T(6), 80, 340, [], 4],
  [C(5, 2), 90, 400, [[300, 3], [420, 2]], 4, 'noPulse'],
  [T(7), 120, 400, [], 4],
  [S(1500), 110, 400, [], 4],
  [C(3, 8), 90, 360, [], 3],
  [T(7), 120, 400, [[340, 4]], 4],
  [T(7), 115, 340, [[380, 2]], 4, 'noComet'],
  [S(2200), 140, 400, [], 4],
  [C(6, 2), 140, 400, [], 4],
  [T(8), 170, 400, [], 4],
  [S(2800), 160, 380, [[330, 3]], 4],
  [T(8), 175, 360, [[360, 3]], 4, 'fastDrops'],
  [C(5, 5), 160, 400, [], 4],
  [S(3500), 180, 400, [[300, 2], [430, 3]], 4],
  [T(8), 160, 340, [], 4],
  [C(7, 2), 200, 400, [], 4],
  [T(9), 230, 400, [[350, 3]], 4, 'noPulse'],
  [S(4500), 220, 400, [], 4],
  [C(6, 4), 220, 380, [], 4],
  [T(9), 240, 360, [], 4],
  [S(6000), 260, 400, [[320, 2], [440, 3]], 4],
  [T(10), 320, 400, [], 4, 'noComet'],
];

export const LEVELS: LevelDef[] = ROWS.map(([goal, drops, width, rows, maxDropTier, twist], i) => ({
  id: i + 1,
  goal,
  drops,
  width,
  pegs: rows.flatMap(([y, n]) => pegRow(width, y, n)),
  maxDropTier,
  challenge: (i + 1) % 5 === 0,
  twist,
}));

export function goalText(goal: Goal, names: string[] = TIERS.map(t => t.name)): string {
  switch (goal.kind) {
    case 'tier': return `Make a ${names[goal.tier]}`;
    case 'score': return `Score ${goal.value.toLocaleString('en-US')} points`;
    case 'count': return `Make ${goal.count} × ${names[goal.tier]}`;
  }
}

/** Stars for a won level: more drops left over means more stars. */
export function starsFor(dropsLeft: number, drops: number): 1 | 2 | 3 {
  const left = dropsLeft / drops;
  if (left >= 0.4) return 3;
  if (left >= 0.2) return 2;
  return 1;
}

const TWISTS: LevelDef['twist'][] = [undefined, 'noPulse', 'noComet', 'fastDrops'];

/** The Daily Challenge: a level made from the date, the same all day. */
export function dailyChallenge(dateKey: string): LevelDef {
  const r = rng(hashSeed('challenge:' + dateKey));
  const pick = <V>(xs: V[]): V => xs[Math.floor(r() * xs.length)];
  const kind = pick(['tier', 'score', 'count'] as const);
  const goal: Goal =
    kind === 'tier' ? T(6 + Math.floor(r() * 3))
    : kind === 'score' ? S(1500 + Math.floor(r() * 6) * 250)
    : C(4 + Math.floor(r() * 2), 3 + Math.floor(r() * 2));
  const width = pick([400, 400, 380, 360]);
  const pegRows: Array<[number, number]> = r() < 0.5 ? [] : [[300 + Math.floor(r() * 120), 2 + Math.floor(r() * 2)]];
  const drops = goal.kind === 'tier' ? 90 + (goal.tier - 6) * 45 : goal.kind === 'score' ? 60 + goal.value / 20 : 110 + (goal.tier - 4) * 50;
  return {
    id: 0,
    goal,
    drops: Math.round(drops),
    width,
    pegs: pegRows.flatMap(([y, n]) => pegRow(width, y, n)),
    maxDropTier: 4,
    challenge: true,
    twist: pick(TWISTS),
  };
}

export function twistText(t: LevelDef['twist']): string | null {
  switch (t) {
    case 'noPulse': return 'No Gravity Pulse';
    case 'noComet': return 'No Comets';
    case 'fastDrops': return 'Fast drops';
    default: return null;
  }
}
