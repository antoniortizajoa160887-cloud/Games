import { SUPERNOVA_BONUS, TIERS } from './tiers';

export const CHAIN_WINDOW_MS = 1500;

/** Multiplier for the nth merge in a quick chain (n starts at 1). */
export function chainMultiplier(n: number): number {
  if (n <= 1) return 1;
  if (n === 2) return 1.2;
  if (n === 3) return 1.5;
  return 2;
}

/** Tracks score, quick chains and first-time tier bonuses for one run. */
export class ScoreKeeper {
  score = 0;
  chain = 0;
  bestChain = 0;
  biggest = -1;
  merges = 0;
  private lastMergeAt = -Infinity;
  private reached = new Set<number>();

  /** A merge made a body of `tier` at time `now` (ms). Returns the points it gave. */
  merge(tier: number, now: number): { points: number; chain: number; firstTime: boolean } {
    this.chain = now - this.lastMergeAt <= CHAIN_WINDOW_MS ? this.chain + 1 : 1;
    this.lastMergeAt = now;
    this.bestChain = Math.max(this.bestChain, this.chain);
    this.merges++;
    let points = Math.round(TIERS[tier].points * chainMultiplier(this.chain));
    const firstTime = tier >= 5 && !this.reached.has(tier);
    if (firstTime) points += 50 * (tier + 1);
    this.reached.add(tier);
    this.biggest = Math.max(this.biggest, tier);
    this.score += points;
    return { points, chain: this.chain, firstTime };
  }

  supernova(): number {
    this.score += SUPERNOVA_BONUS;
    this.biggest = TIERS.length; // past the Star
    return SUPERNOVA_BONUS;
  }
}

/** Coins earned from a finished run. */
export function coinsFor(score: number): number {
  return Math.floor(score / 100);
}
