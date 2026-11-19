/**
 * Rewards between games, like Mahjong's: the Lucky Wheel (a spin for every level win and one free
 * spin a day), the Star Chest (opens every few finished games) and Trophies (one-time goals that
 * pay coins). Pure rules here; the screens are in ui/rewards.ts.
 */
import type { PowerUp, Profile } from '../save';

export type Prize = { coins: number } | { power: PowerUp; count: number };

/** Wheel slices, clockwise from the top. */
export const WHEEL: Prize[] = [
  { coins: 25 }, { power: 'pop', count: 1 }, { coins: 50 }, { power: 'swap', count: 1 },
  { coins: 100 }, { power: 'boost', count: 1 }, { coins: 250 }, { coins: 500 },
];
/** How likely each slice is (the 500 jackpot is the rarest). */
export const WHEEL_WEIGHTS = [6, 4, 5, 4, 3, 2, 2, 1];

/** Which slice a random number in [0, 1) lands on. */
export function wheelSlice(roll: number): number {
  const total = WHEEL_WEIGHTS.reduce((a, b) => a + b, 0);
  let x = roll * total;
  for (let i = 0; i < WHEEL_WEIGHTS.length; i++) {
    x -= WHEEL_WEIGHTS[i];
    if (x < 0) return i;
  }
  return WHEEL_WEIGHTS.length - 1;
}

/** Dome skins in the Shop (glass, crystal, brass, neon). */
const SKINS_COUNT = 4;

/** The Star Chest opens after this many finished games. */
export const CHEST_EVERY = 7;

/** Every chest has coins and one of each power-up; every 4th is a big one. */
export function chestPrizes(opened: number): Prize[] {
  const big = (opened + 1) % 4 === 0;
  return [{ coins: big ? 400 : 150 }, { power: 'pop', count: big ? 2 : 1 }, { power: 'swap', count: big ? 2 : 1 }, { power: 'boost', count: 1 }];
}

export function grant(p: Profile, prize: Prize) {
  if ('coins' in prize) p.coins += prize.coins;
  else p.power[prize.power] += prize.count;
}

export interface Trophy {
  id: string;
  icon: string;
  name: string;
  text: string;
  reward: number;
  /** Progress towards the goal as [have, need]. */
  progress: (p: Profile) => [number, number];
}

const stars = (p: Profile) => p.levelStars.reduce((a, b) => a + (b || 0), 0);
const levelsDone = (p: Profile) => p.levelStars.filter(s => s > 0).length;
const found = (p: Profile) => p.atlas.slice(0, 11).filter(Boolean).length;
const arcadePlayed = (p: Profile) => Object.values(p.arcade).filter(v => v > 0).length;

export const TROPHIES: Trophy[] = [
  { id: 'first', icon: '🚀', name: 'Lift Off', text: 'Finish your first game.', reward: 20, progress: p => [p.totals.runs, 1] },
  { id: 'runs50', icon: '🛰', name: 'Frequent Flyer', text: 'Finish 50 games.', reward: 150, progress: p => [p.totals.runs, 50] },
  { id: 'merge100', icon: '✨', name: 'Stardust Collector', text: 'Make 100 merges.', reward: 40, progress: p => [p.totals.merges, 100] },
  { id: 'merge1000', icon: '💫', name: 'Merge Master', text: 'Make 1,000 merges.', reward: 150, progress: p => [p.totals.merges, 1000] },
  { id: 'merge5000', icon: '🌠', name: 'Cosmic Engine', text: 'Make 5,000 merges.', reward: 400, progress: p => [p.totals.merges, 5000] },
  { id: 'atlas6', icon: '🔭', name: 'Explorer', text: 'Discover 6 pieces in the Atlas.', reward: 50, progress: p => [found(p), 6] },
  { id: 'atlas11', icon: '🌟', name: 'Full Atlas', text: 'Discover all 11 pieces.', reward: 250, progress: p => [found(p), 11] },
  { id: 'nova', icon: '💥', name: 'Supernova', text: 'Merge two of the biggest piece.', reward: 300, progress: p => [p.totals.supernovas, 1] },
  { id: 'level10', icon: '🌙', name: 'Moon Meadows', text: 'Finish levels 1 to 10.', reward: 100, progress: p => [Math.min(10, levelsDone(p)), 10] },
  { id: 'level20', icon: '🪐', name: 'Ring Belt', text: 'Finish levels 1 to 20.', reward: 200, progress: p => [Math.min(20, levelsDone(p)), 20] },
  { id: 'level30', icon: '☀️', name: 'Star Forge', text: 'Finish all 30 levels.', reward: 400, progress: p => [levelsDone(p), 30] },
  { id: 'stars45', icon: '⭐', name: 'Star Gatherer', text: 'Earn 45 level stars.', reward: 150, progress: p => [stars(p), 45] },
  { id: 'stars90', icon: '🏅', name: 'Perfect Sky', text: 'Earn all 90 level stars.', reward: 500, progress: p => [stars(p), 90] },
  { id: 'score10k', icon: '🎯', name: 'High Flyer', text: 'Score 10,000 in Classic.', reward: 100, progress: p => [p.bestClassic, 10000] },
  { id: 'score30k', icon: '🏆', name: 'Legend of the Dome', text: 'Score 30,000 in Classic.', reward: 300, progress: p => [p.bestClassic, 30000] },
  { id: 'arcade6', icon: '🕹', name: 'Arcade Tourist', text: 'Play all 6 Arcade games.', reward: 120, progress: p => [arcadePlayed(p), 6] },
  { id: 'chest3', icon: '🎁', name: 'Treasure Hunter', text: 'Open 3 Star Chests.', reward: 100, progress: p => [p.rewards.chestsOpened, 3] },
  { id: 'spin10', icon: '🎡', name: 'Lucky Star', text: 'Spin the Lucky Wheel 10 times.', reward: 100, progress: p => [p.rewards.spun, 10] },
  { id: 'skins', icon: '🫧', name: 'Dome Designer', text: 'Own every dome skin.', reward: 200, progress: p => [p.skins.length, SKINS_COUNT] },
  { id: 'rich', icon: '💰', name: 'Treasure Trove', text: 'Hold 2,000 coins at once.', reward: 100, progress: p => [p.coins, 2000] },
];

/** Trophies whose goal is met but not yet awarded. */
export function newTrophies(p: Profile): Trophy[] {
  return TROPHIES.filter(t => !p.rewards.trophies.includes(t.id) && t.progress(p)[0] >= t.progress(p)[1]);
}
