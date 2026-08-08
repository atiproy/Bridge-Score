import { describe, expect, it } from 'vitest';
import {
  baseTrickScore,
  clampTricks,
  contractTricks,
  gameOrPartScoreBonus,
  insultBonus,
  overtrickScore,
  scoreDeal,
  slamBonus,
  trickScore,
  undertrickScore,
} from './scoring';
import { presetById } from './presets';
import type { Deal, Level, Risk, RuleSet, Strain, TeamVulnerability } from './types';

const PARTY: RuleSet = presetById('party').rules;
const RUBBER: RuleSet = presetById('rubber-full').rules;
const CASUAL: RuleSet = presetById('casual').rules;

const NONE: TeamVulnerability = { A: false, B: false };
const A_VUL: TeamVulnerability = { A: true, B: false };
const ALL_VUL: TeamVulnerability = { A: true, B: true };

function makeDeal(partial: Partial<Deal> = {}): Deal {
  return {
    id: 'd',
    passedOut: false,
    declarer: 'A',
    level: 1,
    strain: 'NT',
    risk: 'none',
    tricksWon: 7,
    createdAt: 0,
    ...partial,
  };
}

/** Net points to each side for a deal. */
function net(
  partial: Partial<Deal>,
  rules: RuleSet = PARTY,
  vul: TeamVulnerability = NONE,
): { A: number; B: number } {
  const s = scoreDeal(makeDeal(partial), rules, vul);
  return { A: s.A.total, B: s.B.total };
}

describe('trick score table', () => {
  const cases: [Level, Strain, number][] = [
    [1, 'C', 20], [2, 'C', 40], [3, 'C', 60], [4, 'C', 80], [5, 'C', 100],
    [6, 'C', 120], [7, 'C', 140],
    [1, 'D', 20], [5, 'D', 100], [7, 'D', 140],
    [1, 'H', 30], [2, 'H', 60], [3, 'H', 90], [4, 'H', 120], [5, 'H', 150],
    [6, 'H', 180], [7, 'H', 210],
    [1, 'S', 30], [4, 'S', 120], [7, 'S', 210],
    [1, 'NT', 40], [2, 'NT', 70], [3, 'NT', 100], [4, 'NT', 130],
    [5, 'NT', 160], [6, 'NT', 190], [7, 'NT', 220],
  ];

  it.each(cases)('%d%s scores %d', (level, strain, expected) => {
    expect(baseTrickScore(level, strain)).toBe(expected);
  });

  it('doubles and redoubles the trick score', () => {
    expect(trickScore(4, 'H', 'none')).toBe(120);
    expect(trickScore(4, 'H', 'doubled')).toBe(240);
    expect(trickScore(4, 'H', 'redoubled')).toBe(480);
    expect(trickScore(1, 'NT', 'redoubled')).toBe(160);
  });

  it('needs level + 6 tricks', () => {
    expect(contractTricks(1)).toBe(7);
    expect(contractTricks(7)).toBe(13);
  });
});

describe('overtricks', () => {
  it('undoubled overtricks are worth the normal trick value', () => {
    expect(overtrickScore(1, 'C', 'none', false)).toBe(20);
    expect(overtrickScore(2, 'S', 'none', true)).toBe(60);
  });

  it('a No Trump overtrick is 30, not 40', () => {
    expect(overtrickScore(1, 'NT', 'none', false)).toBe(30);
    expect(overtrickScore(3, 'NT', 'none', true)).toBe(90);
  });

  it('doubled overtricks are 100 / 200 by vulnerability', () => {
    expect(overtrickScore(1, 'C', 'doubled', false)).toBe(100);
    expect(overtrickScore(1, 'C', 'doubled', true)).toBe(200);
    expect(overtrickScore(3, 'H', 'doubled', true)).toBe(600);
  });

  it('redoubled overtricks are 200 / 400 by vulnerability', () => {
    expect(overtrickScore(1, 'C', 'redoubled', false)).toBe(200);
    expect(overtrickScore(1, 'C', 'redoubled', true)).toBe(400);
  });

  it('is zero when the contract is made exactly', () => {
    expect(overtrickScore(0, 'H', 'doubled', true)).toBe(0);
  });
});

describe('undertrick penalty ladder', () => {
  it('undoubled: 50 a trick, 100 when vulnerable', () => {
    expect(undertrickScore(1, 'none', false)).toBe(50);
    expect(undertrickScore(4, 'none', false)).toBe(200);
    expect(undertrickScore(1, 'none', true)).toBe(100);
    expect(undertrickScore(4, 'none', true)).toBe(400);
    expect(undertrickScore(13, 'none', false)).toBe(650);
  });

  it('doubled, not vulnerable: 100, 300, 500, 800, 1100', () => {
    expect(undertrickScore(1, 'doubled', false)).toBe(100);
    expect(undertrickScore(2, 'doubled', false)).toBe(300);
    expect(undertrickScore(3, 'doubled', false)).toBe(500);
    expect(undertrickScore(4, 'doubled', false)).toBe(800);
    expect(undertrickScore(5, 'doubled', false)).toBe(1100);
    expect(undertrickScore(13, 'doubled', false)).toBe(3500);
  });

  it('doubled, vulnerable: 200, 500, 800, 1100', () => {
    expect(undertrickScore(1, 'doubled', true)).toBe(200);
    expect(undertrickScore(2, 'doubled', true)).toBe(500);
    expect(undertrickScore(3, 'doubled', true)).toBe(800);
    expect(undertrickScore(4, 'doubled', true)).toBe(1100);
    expect(undertrickScore(13, 'doubled', true)).toBe(3800);
  });

  it('redoubled is exactly double the doubled penalty', () => {
    const risks: Risk[] = ['doubled', 'redoubled'];
    for (let n = 1; n <= 13; n += 1) {
      for (const vul of [false, true]) {
        expect(undertrickScore(n, risks[1], vul)).toBe(
          undertrickScore(n, risks[0], vul) * 2,
        );
      }
    }
  });

  it('redoubled spot checks', () => {
    expect(undertrickScore(1, 'redoubled', false)).toBe(200);
    expect(undertrickScore(2, 'redoubled', false)).toBe(600);
    expect(undertrickScore(1, 'redoubled', true)).toBe(400);
    expect(undertrickScore(2, 'redoubled', true)).toBe(1000);
  });

  it('is zero when nothing is down', () => {
    expect(undertrickScore(0, 'doubled', true)).toBe(0);
  });
});

describe('bonuses', () => {
  it('slam bonuses only apply at levels 6 and 7', () => {
    expect(slamBonus(5, false)).toBe(0);
    expect(slamBonus(6, false)).toBe(500);
    expect(slamBonus(6, true)).toBe(750);
    expect(slamBonus(7, false)).toBe(1000);
    expect(slamBonus(7, true)).toBe(1500);
  });

  it('insult bonus is 50 doubled, 100 redoubled', () => {
    expect(insultBonus('none')).toBe(0);
    expect(insultBonus('doubled')).toBe(50);
    expect(insultBonus('redoubled')).toBe(100);
  });

  it('game bonus turns on at a trick score of 100', () => {
    expect(gameOrPartScoreBonus(90, false)).toBe(50);
    expect(gameOrPartScoreBonus(100, false)).toBe(300);
    expect(gameOrPartScoreBonus(100, true)).toBe(500);
  });
});

describe('full deal scores, per-deal (Party) rules', () => {
  it('4H made exactly, not vulnerable, is 420', () => {
    expect(net({ level: 4, strain: 'H', tricksWon: 10 })).toEqual({ A: 420, B: 0 });
  });

  it('4H made exactly, vulnerable, is 620', () => {
    expect(net({ level: 4, strain: 'H', tricksWon: 10 }, PARTY, A_VUL)).toEqual({
      A: 620,
      B: 0,
    });
  });

  it('3NT made exactly is 400 / 600', () => {
    expect(net({ level: 3, strain: 'NT', tricksWon: 9 })).toEqual({ A: 400, B: 0 });
    expect(net({ level: 3, strain: 'NT', tricksWon: 9 }, PARTY, A_VUL)).toEqual({
      A: 600,
      B: 0,
    });
  });

  it('part scores get 50', () => {
    expect(net({ level: 2, strain: 'S', tricksWon: 8 })).toEqual({ A: 110, B: 0 });
    expect(net({ level: 1, strain: 'NT', tricksWon: 7 })).toEqual({ A: 90, B: 0 });
    expect(net({ level: 2, strain: 'C', tricksWon: 8 })).toEqual({ A: 90, B: 0 });
  });

  it('3NT plus one overtrick is 430', () => {
    expect(net({ level: 3, strain: 'NT', tricksWon: 10 })).toEqual({ A: 430, B: 0 });
  });

  it('1NT making all thirteen tricks is 270', () => {
    // 40 trick + six overtricks at 30 + 50 part score.
    expect(net({ level: 1, strain: 'NT', tricksWon: 13 })).toEqual({ A: 270, B: 0 });
  });

  it('small slam in spades is 980 / 1430', () => {
    expect(net({ level: 6, strain: 'S', tricksWon: 12 })).toEqual({ A: 980, B: 0 });
    expect(net({ level: 6, strain: 'S', tricksWon: 12 }, PARTY, A_VUL)).toEqual({
      A: 1430,
      B: 0,
    });
  });

  it('grand slam in No Trump is 1520 / 2220', () => {
    expect(net({ level: 7, strain: 'NT', tricksWon: 13 })).toEqual({ A: 1520, B: 0 });
    expect(net({ level: 7, strain: 'NT', tricksWon: 13 }, PARTY, A_VUL)).toEqual({
      A: 2220,
      B: 0,
    });
  });

  it('2S doubled making exactly reaches game: 470', () => {
    // 60 x 2 = 120 trick score, which clears the 100 game threshold.
    expect(net({ level: 2, strain: 'S', risk: 'doubled', tricksWon: 8 })).toEqual({
      A: 470,
      B: 0,
    });
  });

  it('1NT doubled making exactly stays a part score: 180', () => {
    expect(net({ level: 1, strain: 'NT', risk: 'doubled', tricksWon: 7 })).toEqual({
      A: 180,
      B: 0,
    });
  });

  it('1NT redoubled making exactly reaches game: 560', () => {
    expect(net({ level: 1, strain: 'NT', risk: 'redoubled', tricksWon: 7 })).toEqual({
      A: 560,
      B: 0,
    });
  });

  it('4S doubled made exactly is 590 / 790', () => {
    expect(net({ level: 4, strain: 'S', risk: 'doubled', tricksWon: 10 })).toEqual({
      A: 590,
      B: 0,
    });
    expect(
      net({ level: 4, strain: 'S', risk: 'doubled', tricksWon: 10 }, PARTY, A_VUL),
    ).toEqual({ A: 790, B: 0 });
  });

  it('4H doubled with an overtrick is 690 / 990', () => {
    expect(net({ level: 4, strain: 'H', risk: 'doubled', tricksWon: 11 })).toEqual({
      A: 690,
      B: 0,
    });
    expect(
      net({ level: 4, strain: 'H', risk: 'doubled', tricksWon: 11 }, PARTY, A_VUL),
    ).toEqual({ A: 990, B: 0 });
  });
});

describe('failed contracts pay the defenders', () => {
  it('gives the points to the other side, not the declarer', () => {
    expect(net({ level: 4, strain: 'H', tricksWon: 9 })).toEqual({ A: 0, B: 50 });
    expect(net({ level: 4, strain: 'H', tricksWon: 9, declarer: 'B' })).toEqual({
      A: 50,
      B: 0,
    });
  });

  it('uses the declarer vulnerability, not the defender', () => {
    // A declares and is vulnerable: 100 a trick.
    expect(net({ level: 4, strain: 'H', tricksWon: 8 }, PARTY, A_VUL)).toEqual({
      A: 0,
      B: 200,
    });
    // B declares while A is the vulnerable side: B is not vulnerable, so 50.
    expect(
      net({ level: 4, strain: 'H', tricksWon: 8, declarer: 'B' }, PARTY, A_VUL),
    ).toEqual({ A: 100, B: 0 });
  });

  it('doubled and set is the escalating ladder', () => {
    expect(net({ level: 4, strain: 'H', risk: 'doubled', tricksWon: 9 })).toEqual({
      A: 0,
      B: 100,
    });
    expect(net({ level: 4, strain: 'H', risk: 'doubled', tricksWon: 8 })).toEqual({
      A: 0,
      B: 300,
    });
    expect(
      net({ level: 4, strain: 'H', risk: 'doubled', tricksWon: 8 }, PARTY, ALL_VUL),
    ).toEqual({ A: 0, B: 500 });
  });

  it('taking zero tricks in 7NT redoubled vulnerable is 7600', () => {
    expect(
      net({ level: 7, strain: 'NT', risk: 'redoubled', tricksWon: 0 }, PARTY, ALL_VUL),
    ).toEqual({ A: 0, B: 7600 });
  });

  it('records the number of undertricks', () => {
    const s = scoreDeal(makeDeal({ level: 6, strain: 'S', tricksWon: 7 }), PARTY, NONE);
    expect(s.outcome).toBe('set');
    expect(s.undertricks).toBe(5);
    expect(s.overtricks).toBe(0);
  });
});

describe('Rubber differs from per-deal scoring', () => {
  it('pays no game bonus on the deal', () => {
    // The 300 game bonus is replaced by the rubber bonus at the end.
    expect(net({ level: 4, strain: 'H', tricksWon: 10 }, RUBBER)).toEqual({
      A: 120,
      B: 0,
    });
  });

  it('pays no part score bonus either', () => {
    expect(net({ level: 2, strain: 'S', tricksWon: 8 }, RUBBER)).toEqual({ A: 60, B: 0 });
  });

  it('still pays slam and insult bonuses', () => {
    // 180 trick + 500 small slam, no game bonus.
    expect(net({ level: 6, strain: 'S', tricksWon: 12 }, RUBBER)).toEqual({
      A: 680,
      B: 0,
    });
    expect(net({ level: 2, strain: 'S', risk: 'doubled', tricksWon: 8 }, RUBBER)).toEqual({
      A: 170,
      B: 0,
    });
  });

  it('puts the trick score below the line and bonuses above', () => {
    const s = scoreDeal(
      makeDeal({ level: 4, strain: 'H', tricksWon: 11 }),
      RUBBER,
      NONE,
    );
    expect(s.A.below).toBe(120);
    expect(s.A.above).toBe(30);
  });
});

describe('honours', () => {
  it('awards 100 for four trump honours', () => {
    expect(
      net(
        { level: 4, strain: 'H', tricksWon: 10, honours: { team: 'A', value: 100 } },
        RUBBER,
      ),
    ).toEqual({ A: 220, B: 0 });
  });

  it('awards 150 for five honours or four aces', () => {
    expect(
      net(
        { level: 4, strain: 'H', tricksWon: 10, honours: { team: 'A', value: 150 } },
        RUBBER,
      ),
    ).toEqual({ A: 270, B: 0 });
  });

  it('counts even when the contract fails, and can go to the defenders', () => {
    expect(
      net(
        { level: 4, strain: 'H', tricksWon: 8, honours: { team: 'B', value: 150 } },
        RUBBER,
      ),
    ).toEqual({ A: 0, B: 250 });
  });

  it('is ignored, with a warning, when the rules do not award it', () => {
    const s = scoreDeal(
      makeDeal({ level: 4, strain: 'H', tricksWon: 10, honours: { team: 'A', value: 150 } }),
      PARTY,
      NONE,
    );
    expect(s.A.total).toBe(420);
    expect(s.warnings).toHaveLength(1);
  });
});

describe('simplified rules', () => {
  it('Casual ignores vulnerability entirely', () => {
    const asIfVulnerable = net({ level: 4, strain: 'H', tricksWon: 10 }, CASUAL, ALL_VUL);
    const notVulnerable = net({ level: 4, strain: 'H', tricksWon: 10 }, CASUAL, NONE);
    expect(asIfVulnerable).toEqual(notVulnerable);
    expect(asIfVulnerable).toEqual({ A: 420, B: 0 });
  });

  it('Casual ignores a double that was somehow recorded, and says so', () => {
    const s = scoreDeal(
      makeDeal({ level: 4, strain: 'H', risk: 'doubled', tricksWon: 10 }),
      CASUAL,
      NONE,
    );
    expect(s.A.total).toBe(420);
    expect(s.warnings.some((w) => w.includes('Doubling'))).toBe(true);
  });

  it('Casual still pays slam bonuses', () => {
    expect(net({ level: 6, strain: 'S', tricksWon: 12 }, CASUAL)).toEqual({
      A: 980,
      B: 0,
    });
  });
});

describe('passed out deals', () => {
  it('scores nothing for either side', () => {
    const s = scoreDeal(makeDeal({ passedOut: true }), PARTY, NONE);
    expect(s.A.total).toBe(0);
    expect(s.B.total).toBe(0);
    expect(s.outcome).toBe('passed');
    expect(s.headline).toBe('Passed out');
  });
});

describe('input hardening', () => {
  it('clamps trick counts into 0..13', () => {
    expect(clampTricks(-4)).toBe(0);
    expect(clampTricks(99)).toBe(13);
    expect(clampTricks(7.8)).toBe(7);
    expect(clampTricks(Number.NaN)).toBe(0);
  });

  it('never awards points to both sides from the contract itself', () => {
    for (let tricks = 0; tricks <= 13; tricks += 1) {
      const s = scoreDeal(makeDeal({ level: 4, strain: 'H', tricksWon: tricks }), PARTY, NONE);
      expect(s.A.total === 0 || s.B.total === 0).toBe(true);
    }
  });

  it('always produces a non-negative score for both sides', () => {
    const strains: Strain[] = ['C', 'D', 'H', 'S', 'NT'];
    const risks: Risk[] = ['none', 'doubled', 'redoubled'];
    for (let level = 1 as Level; level <= 7; level = (level + 1) as Level) {
      for (const strain of strains) {
        for (const risk of risks) {
          for (let tricks = 0; tricks <= 13; tricks += 1) {
            for (const vul of [NONE, ALL_VUL]) {
              const s = scoreDeal(
                makeDeal({ level, strain, risk, tricksWon: tricks }),
                PARTY,
                vul,
              );
              expect(s.A.total).toBeGreaterThanOrEqual(0);
              expect(s.B.total).toBeGreaterThanOrEqual(0);
              expect(s.A.total + s.B.total).toBeGreaterThan(0);
            }
          }
        }
      }
    }
  });

  it('every explanation line sums to the side totals', () => {
    const s = scoreDeal(
      makeDeal({
        level: 6,
        strain: 'H',
        risk: 'doubled',
        tricksWon: 13,
        honours: { team: 'B', value: 150 },
      }),
      RUBBER,
      A_VUL,
    );
    const sumFor = (team: 'A' | 'B') =>
      s.lines.filter((l) => l.team === team).reduce((acc, l) => acc + l.points, 0);
    expect(sumFor('A')).toBe(s.A.total);
    expect(sumFor('B')).toBe(s.B.total);
  });
});
