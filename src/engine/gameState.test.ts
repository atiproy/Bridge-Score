import { describe, expect, it } from 'vitest';
import {
  CHICAGO_VUL_CYCLE,
  DUPLICATE_VUL_CYCLE,
  computeGame,
  unfinishedRubberSettlement,
  vulnerabilityForBoard,
} from './gameState';
import { presetById } from './presets';
import type { Deal, Level, RuleSet, Strain, TeamId } from './types';

const PARTY: RuleSet = presetById('party').rules;
const RUBBER: RuleSet = presetById('rubber-simple').rules;
const CHICAGO: RuleSet = presetById('chicago').rules;
const CASUAL: RuleSet = presetById('casual').rules;

let seq = 0;
function d(
  declarer: TeamId,
  level: Level,
  strain: Strain,
  tricksWon: number,
  extra: Partial<Deal> = {},
): Deal {
  seq += 1;
  return {
    id: `d${seq}`,
    passedOut: false,
    declarer,
    level,
    strain,
    risk: 'none',
    tricksWon,
    createdAt: seq,
    ...extra,
  };
}

describe('vulnerability cycles', () => {
  it('follows the 16-board duplicate cycle', () => {
    expect(vulnerabilityForBoard(0, DUPLICATE_VUL_CYCLE)).toEqual({ A: false, B: false });
    expect(vulnerabilityForBoard(1, DUPLICATE_VUL_CYCLE)).toEqual({ A: true, B: false });
    expect(vulnerabilityForBoard(2, DUPLICATE_VUL_CYCLE)).toEqual({ A: false, B: true });
    expect(vulnerabilityForBoard(3, DUPLICATE_VUL_CYCLE)).toEqual({ A: true, B: true });
    // Wraps around after sixteen boards.
    expect(vulnerabilityForBoard(16, DUPLICATE_VUL_CYCLE)).toEqual(
      vulnerabilityForBoard(0, DUPLICATE_VUL_CYCLE),
    );
  });

  it('follows the fixed Chicago four-deal cycle', () => {
    expect(vulnerabilityForBoard(0, CHICAGO_VUL_CYCLE)).toEqual({ A: false, B: false });
    expect(vulnerabilityForBoard(1, CHICAGO_VUL_CYCLE)).toEqual({ A: true, B: false });
    expect(vulnerabilityForBoard(2, CHICAGO_VUL_CYCLE)).toEqual({ A: false, B: true });
    expect(vulnerabilityForBoard(3, CHICAGO_VUL_CYCLE)).toEqual({ A: true, B: true });
    expect(vulnerabilityForBoard(4, CHICAGO_VUL_CYCLE)).toEqual({ A: false, B: false });
  });

  it('applies the Chicago cycle to consecutive deals', () => {
    const deals = [
      d('A', 4, 'H', 10),
      d('A', 4, 'H', 10),
      d('A', 4, 'H', 10),
      d('A', 4, 'H', 10),
    ];
    const state = computeGame(deals, CHICAGO);
    expect(state.deals.map((s) => s.vulnerability)).toEqual([
      { A: false, B: false },
      { A: true, B: false },
      { A: false, B: true },
      { A: true, B: true },
    ]);
    // 420 + 620 + 420 + 620
    expect(state.totals.A).toBe(2080);
  });

  it('honours a per-deal override in duplicate mode', () => {
    const deals = [d('A', 4, 'H', 10, { vulnerabilityOverride: { A: true, B: true } })];
    const state = computeGame(deals, { ...PARTY, vulnerability: true });
    expect(state.deals[0].vulnerability).toEqual({ A: true, B: true });
    expect(state.totals.A).toBe(620);
  });

  it('treats nobody as vulnerable when the rule is switched off', () => {
    const deals = [d('A', 4, 'H', 10), d('A', 4, 'H', 10), d('A', 4, 'H', 10)];
    const state = computeGame(deals, CASUAL);
    state.deals.forEach((s) => expect(s.vulnerability).toEqual({ A: false, B: false }));
    expect(state.totals.A).toBe(1260);
  });
});

describe('rubber progression', () => {
  it('wins a game when the below-the-line total reaches 100', () => {
    const state = computeGame([d('A', 4, 'H', 10)], RUBBER);
    expect(state.gamesWon).toEqual({ A: 1, B: 0 });
    expect(state.currentLeg).toEqual({ A: 0, B: 0 });
    expect(state.vulnerability).toEqual({ A: true, B: false });
    expect(state.totals.A).toBe(120);
  });

  it('accumulates part scores across deals toward a game', () => {
    const state = computeGame([d('A', 2, 'S', 8)], RUBBER);
    expect(state.gamesWon).toEqual({ A: 0, B: 0 });
    expect(state.currentLeg).toEqual({ A: 60, B: 0 });

    const state2 = computeGame([d('A', 2, 'S', 8), d('A', 2, 'H', 8)], RUBBER);
    expect(state2.gamesWon).toEqual({ A: 1, B: 0 });
    expect(state2.currentLeg).toEqual({ A: 0, B: 0 });
  });

  it('wipes an unfinished part score when the opponents win a game', () => {
    const state = computeGame(
      [d('A', 2, 'S', 8), d('B', 4, 'H', 10), d('A', 2, 'S', 8)],
      RUBBER,
    );
    expect(state.gamesWon).toEqual({ A: 0, B: 1 });
    // A's first 60 was wiped by B's game, so A is back to a bare 60.
    expect(state.currentLeg).toEqual({ A: 60, B: 0 });
  });

  it('pays 700 for a two-nil rubber', () => {
    const state = computeGame([d('A', 4, 'H', 10), d('A', 4, 'H', 10)], RUBBER);
    expect(state.totals.A).toBe(940); // 120 + 120 + 700
    expect(state.totals.B).toBe(0);
    expect(state.rubbers[0].complete).toBe(true);
    expect(state.rubbers[0].winner).toBe('A');
    expect(state.rubbers[0].bonus).toBe(700);
  });

  it('pays 500 for a two-one rubber', () => {
    const state = computeGame(
      [d('A', 4, 'H', 10), d('B', 4, 'S', 10), d('A', 4, 'H', 10)],
      RUBBER,
    );
    expect(state.totals.A).toBe(740); // 120 + 120 + 500
    expect(state.totals.B).toBe(120);
    expect(state.rubbers[0].bonus).toBe(500);
  });

  it('starts a fresh rubber after one completes', () => {
    const deals = [d('A', 4, 'H', 10), d('A', 4, 'H', 10), d('B', 2, 'S', 8)];
    const state = computeGame(deals, RUBBER);
    expect(state.rubbers).toHaveLength(2);
    expect(state.gamesWon).toEqual({ A: 0, B: 0 });
    expect(state.currentLeg).toEqual({ A: 0, B: 60 });
    // The last deal was played in the second rubber.
    expect(state.deals[2].rubberIndex).toBe(1);
    expect(state.deals[1].rubberIndex).toBe(0);
    // Nobody is vulnerable again in the new rubber.
    expect(state.deals[2].vulnerability).toEqual({ A: false, B: false });
  });

  it('makes the winner of a game vulnerable on the next deal', () => {
    const state = computeGame([d('A', 4, 'H', 10), d('A', 4, 'H', 8)], RUBBER);
    expect(state.deals[1].vulnerability).toEqual({ A: true, B: false });
    // Down two while vulnerable: 200 to B.
    expect(state.totals.B).toBe(200);
  });

  it('emits events for games, rubbers and slams', () => {
    const state = computeGame([d('A', 6, 'S', 12), d('A', 4, 'H', 10)], RUBBER);
    const kinds = state.events.map((e) => e.kind);
    expect(kinds).toContain('slam');
    expect(kinds).toContain('game-won');
    expect(kinds).toContain('rubber-won');
  });

  it('settles an unfinished rubber only when asked', () => {
    const deals = [d('A', 4, 'H', 10), d('B', 2, 'S', 8)];
    const plain = computeGame(deals, RUBBER);
    expect(plain.totals.A).toBe(120);
    expect(plain.totals.B).toBe(60);

    const settled = computeGame(deals, RUBBER, { settleUnfinishedRubber: true });
    expect(settled.totals.A).toBe(420); // 120 + 300 for the game won
    expect(settled.totals.B).toBe(160); // 60 + 100 for the part score
  });

  it('describes the unfinished settlement', () => {
    const out = unfinishedRubberSettlement({ A: 1, B: 0 }, { A: 0, B: 60 });
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ team: 'A', amount: 300 });
    expect(out[1]).toMatchObject({ team: 'B', amount: 100 });
  });
});

describe('history is fully re-derived', () => {
  const deals = [d('A', 4, 'H', 10), d('A', 4, 'H', 10), d('B', 4, 'S', 10)];

  it('changes later deals when an earlier one is deleted', () => {
    const withAll = computeGame(deals, RUBBER);
    const withoutFirst = computeGame(deals.slice(1), RUBBER);

    // With all three, A finishes a rubber; without the first, A has one game.
    expect(withAll.totals.A).toBe(940);
    expect(withoutFirst.totals.A).toBe(120);
    // And the third deal is now played by a non-vulnerable B in a live rubber.
    expect(withAll.deals[2].vulnerability).toEqual({ A: false, B: false });
    expect(withoutFirst.deals[1].vulnerability).toEqual({ A: true, B: false });
  });

  it('changes totals when a deal is edited in place', () => {
    const edited = [deals[0], { ...deals[1], tricksWon: 9 }, deals[2]];
    const state = computeGame(edited, RUBBER);
    // A's second deal now fails by one while vulnerable: 100 to B.
    expect(state.totals.A).toBe(120);
    expect(state.gamesWon).toEqual({ A: 1, B: 1 });
  });

  it('is a pure function of its inputs', () => {
    const a = computeGame(deals, RUBBER);
    const b = computeGame(deals, RUBBER);
    expect(a.totals).toEqual(b.totals);
    expect(a.deals.map((x) => x.score.A.total)).toEqual(
      b.deals.map((x) => x.score.A.total),
    );
  });

  it('handles an empty match', () => {
    const state = computeGame([], RUBBER);
    expect(state.totals).toEqual({ A: 0, B: 0 });
    expect(state.deals).toHaveLength(0);
    expect(state.vulnerability).toEqual({ A: false, B: false });
    expect(state.rubberComplete).toBe(false);
  });

  it('keeps running totals in step with the final totals', () => {
    const state = computeGame(deals, PARTY);
    const last = state.deals[state.deals.length - 1];
    expect(last.runningTotals).toEqual(state.totals);
  });

  it('numbers deals from one', () => {
    const state = computeGame(deals, PARTY);
    expect(state.deals.map((s) => s.displayNumber)).toEqual([1, 2, 3]);
  });

  it('ignores passed-out deals in the totals but keeps them on the card', () => {
    const withPass = computeGame(
      [d('A', 4, 'H', 10), d('A', 1, 'C', 0, { passedOut: true }), d('A', 4, 'H', 10)],
      RUBBER,
    );
    expect(withPass.deals).toHaveLength(3);
    expect(withPass.totals.A).toBe(940);
  });
});
