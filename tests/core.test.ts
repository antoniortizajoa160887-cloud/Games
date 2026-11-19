import { describe, expect, it } from 'vitest';
import { dailyChallenge, goalText, LEVELS, starsFor } from '../src/core/levels';
import { dailyMissions, progressOf, weeklyMissions } from '../src/core/missions';
import { hashSeed, rng, weekKey } from '../src/core/rng';
import { chainMultiplier, coinsFor, ScoreKeeper } from '../src/core/scoring';
import { STAR, TIERS } from '../src/core/tiers';

describe('tiers', () => {
  it('grow in size and points', () => {
    for (let i = 1; i < TIERS.length; i++) {
      expect(TIERS[i].radius).toBeGreaterThan(TIERS[i - 1].radius);
      expect(TIERS[i].points).toBeGreaterThan(TIERS[i - 1].points);
    }
    expect(STAR).toBe(10);
  });
  it('the biggest piece still fits the narrowest dome', () => {
    const narrowest = Math.min(...LEVELS.map(l => l.width), 280);
    expect(TIERS[STAR].radius * 2).toBeLessThan(narrowest);
  });
});

describe('rng', () => {
  it('is repeatable from a seed', () => {
    const a = rng(42), b = rng(42);
    for (let i = 0; i < 10; i++) expect(a()).toBe(b());
    expect(hashSeed('2026-11-19')).toBe(hashSeed('2026-11-19'));
  });
  it('makes week keys', () => {
    expect(weekKey(new Date(2026, 10, 19))).toMatch(/^2026-W\d\d$/);
  });
});

describe('scoring', () => {
  it('rewards quick chains', () => {
    expect(chainMultiplier(1)).toBe(1);
    expect(chainMultiplier(4)).toBe(2);
    const k = new ScoreKeeper();
    k.merge(1, 0);
    const second = k.merge(1, 500);
    expect(second.chain).toBe(2);
    expect(k.merge(1, 5000).chain).toBe(1);
  });
  it('gives a one-time bonus for big new pieces', () => {
    const k = new ScoreKeeper();
    expect(k.merge(5, 0).firstTime).toBe(true);
    expect(k.merge(5, 10000).firstTime).toBe(false);
    expect(coinsFor(250)).toBe(2);
  });
});

describe('levels', () => {
  it('has 30 levels with every 5th a challenge', () => {
    expect(LEVELS).toHaveLength(30);
    expect(LEVELS.filter(l => l.challenge).map(l => l.id)).toEqual([5, 10, 15, 20, 25, 30]);
  });
  it('keeps pegs inside the dome and below the rim', () => {
    for (const l of LEVELS) for (const p of l.pegs) {
      expect(p.x).toBeGreaterThan(0);
      expect(p.x).toBeLessThan(l.width);
      expect(p.y).toBeGreaterThan(200);
    }
  });
  it('gives stars by drops left', () => {
    expect(starsFor(50, 100)).toBe(3);
    expect(starsFor(25, 100)).toBe(2);
    expect(starsFor(1, 100)).toBe(1);
  });
  it('makes the same daily challenge all day', () => {
    expect(dailyChallenge('2026-11-19')).toEqual(dailyChallenge('2026-11-19'));
    expect(goalText(dailyChallenge('2026-11-19').goal).length).toBeGreaterThan(5);
  });
});

describe('missions', () => {
  it('picks distinct daily and weekly missions', () => {
    for (const d of ['2026-11-19', '2026-11-20', '2026-12-01']) {
      const m = dailyMissions(d);
      expect(m).toHaveLength(3);
      expect(new Set(m.map(x => x.match.type)).size).toBe(3);
    }
    expect(weeklyMissions('2026-W47')).toHaveLength(2);
  });
  it('counts matching events', () => {
    expect(progressOf({ type: 'make', tier: 5 }, { type: 'make', tier: 6 })).toBe(1);
    expect(progressOf({ type: 'make', tier: 5 }, { type: 'make', tier: 4 })).toBe(0);
    expect(progressOf({ type: 'levelStars' }, { type: 'levelStars', stars: 3 })).toBe(3);
  });
});
