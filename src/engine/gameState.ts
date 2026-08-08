/**
 * Walks a list of deals and derives everything that depends on history:
 * vulnerability, games won, rubber completion and bonuses, running totals.
 *
 * This is a pure fold over `Deal[]`. Nothing about the match is stored twice,
 * so deleting or editing deal 3 automatically re-derives deals 4..n. That is
 * what makes undo and inline editing safe.
 */

import { GAME_THRESHOLD, otherTeam, scoreDeal } from './scoring';
import type {
  Deal,
  GameEvent,
  GameState,
  RubberRecord,
  RuleSet,
  ScoredDeal,
  TeamId,
  TeamVulnerability,
} from './types';

/** Rubber bonus for winning two games to none. */
export const RUBBER_BONUS_TWO_NIL = 700;
/** Rubber bonus for winning two games to one. */
export const RUBBER_BONUS_TWO_ONE = 500;
/** Awarded to a side that has won a game when an unfinished rubber is settled. */
export const UNFINISHED_RUBBER_BONUS = 300;
/** Awarded for a part score in an unfinished game when a rubber is settled. */
export const UNFINISHED_PART_SCORE_BONUS = 100;

type VulPattern = 'none' | 'A' | 'B' | 'all';

/** The standard 16-board duplicate vulnerability cycle, with A = N/S, B = E/W. */
export const DUPLICATE_VUL_CYCLE: VulPattern[] = [
  'none', 'A', 'B', 'all',
  'A', 'B', 'all', 'none',
  'B', 'all', 'none', 'A',
  'all', 'none', 'A', 'B',
];

/** Chicago's fixed four-deal cycle. */
export const CHICAGO_VUL_CYCLE: VulPattern[] = ['none', 'A', 'B', 'all'];

function expand(pattern: VulPattern): TeamVulnerability {
  return {
    A: pattern === 'A' || pattern === 'all',
    B: pattern === 'B' || pattern === 'all',
  };
}

export function vulnerabilityForBoard(index: number, cycle: VulPattern[]): TeamVulnerability {
  const safe = ((index % cycle.length) + cycle.length) % cycle.length;
  return expand(cycle[safe]);
}

const NO_VULNERABILITY: TeamVulnerability = { A: false, B: false };

function freshRubber(index: number): RubberRecord {
  return { index, gamesWon: { A: 0, B: 0 }, complete: false, bonus: 0 };
}

/**
 * The bonus a side would collect if the match stopped right now with the
 * current rubber unfinished. Shown to the user, never silently added.
 */
export function unfinishedRubberSettlement(
  gamesWon: { A: number; B: number },
  currentLeg: { A: number; B: number },
): { team: TeamId; amount: number; reason: string }[] {
  const out: { team: TeamId; amount: number; reason: string }[] = [];
  (['A', 'B'] as TeamId[]).forEach((team) => {
    if (gamesWon[team] > 0) {
      out.push({
        team,
        amount: UNFINISHED_RUBBER_BONUS,
        reason: 'Won a game in the unfinished rubber',
      });
    }
    if (currentLeg[team] > 0) {
      out.push({
        team,
        amount: UNFINISHED_PART_SCORE_BONUS,
        reason: 'Holds a part score in the unfinished game',
      });
    }
  });
  return out;
}

export interface ComputeOptions {
  /** Adds the unfinished-rubber settlement into the totals. */
  settleUnfinishedRubber?: boolean;
}

export function computeGame(
  deals: Deal[],
  rules: RuleSet,
  options: ComputeOptions = {},
): GameState {
  const totals = { A: 0, B: 0 };
  let gamesWon = { A: 0, B: 0 };
  let currentLeg = { A: 0, B: 0 };
  let vulnerability: TeamVulnerability = { ...NO_VULNERABILITY };

  const rubbers: RubberRecord[] = [freshRubber(0)];
  const scored: ScoredDeal[] = [];
  const allEvents: GameEvent[] = [];
  let rubberIndex = 0;
  /** Deal index within the current rubber / Chicago round. */
  let indexInCycle = 0;

  deals.forEach((deal, i) => {
    let dealVulnerability: TeamVulnerability;

    if (!rules.vulnerability) {
      dealVulnerability = { ...NO_VULNERABILITY };
    } else if (rules.mode === 'rubber') {
      dealVulnerability = { A: gamesWon.A > 0, B: gamesWon.B > 0 };
    } else if (rules.mode === 'chicago') {
      dealVulnerability = vulnerabilityForBoard(indexInCycle, CHICAGO_VUL_CYCLE);
    } else {
      dealVulnerability = deal.vulnerabilityOverride
        ? { ...deal.vulnerabilityOverride }
        : vulnerabilityForBoard(i, DUPLICATE_VUL_CYCLE);
    }

    const score = scoreDeal(deal, rules, dealVulnerability);
    const events: GameEvent[] = [];
    /** The rubber this deal was played in, captured before any rollover. */
    const playedInRubber = rubberIndex;

    totals.A += score.A.total;
    totals.B += score.B.total;

    if (score.outcome === 'set') {
      const defender = otherTeam(deal.declarer);
      events.push({
        kind: 'set',
        team: defender,
        message: `Set by ${score.undertricks}`,
      });
    }

    if (score.outcome === 'made' && rules.slamBonuses && deal.level >= 6) {
      events.push({
        kind: deal.level === 7 ? 'grand-slam' : 'slam',
        team: deal.declarer,
        message: deal.level === 7 ? 'Grand slam bid and made' : 'Small slam bid and made',
      });
    }

    if (rules.mode === 'rubber') {
      currentLeg = { A: currentLeg.A + score.A.below, B: currentLeg.B + score.B.below };

      // Only the declaring side can score below the line on a deal, so at most
      // one side can reach game here. The loop is defensive, not expected.
      (['A', 'B'] as TeamId[]).forEach((team) => {
        if (currentLeg[team] < GAME_THRESHOLD) return;

        gamesWon = { ...gamesWon, [team]: gamesWon[team] + 1 };
        currentLeg = { A: 0, B: 0 };
        rubbers[rubberIndex].gamesWon = { ...gamesWon };

        events.push({
          kind: 'game-won',
          team,
          message: `Game ${gamesWon[team]} won`,
        });

        if (gamesWon[team] === 2) {
          const opponent = otherTeam(team);
          const bonus =
            gamesWon[opponent] === 0 ? RUBBER_BONUS_TWO_NIL : RUBBER_BONUS_TWO_ONE;
          totals[team] += bonus;

          rubbers[rubberIndex] = {
            ...rubbers[rubberIndex],
            complete: true,
            winner: team,
            bonus,
            bonusTeam: team,
          };

          events.push({
            kind: 'rubber-won',
            team,
            message: `Rubber won ${gamesWon[team]}-${gamesWon[opponent]} (+${bonus})`,
          });

          rubberIndex += 1;
          rubbers.push(freshRubber(rubberIndex));
          gamesWon = { A: 0, B: 0 };
          currentLeg = { A: 0, B: 0 };
        }
      });

      vulnerability = { A: gamesWon.A > 0, B: gamesWon.B > 0 };
      indexInCycle += 1;
    } else if (rules.mode === 'chicago') {
      indexInCycle = (indexInCycle + 1) % CHICAGO_VUL_CYCLE.length;
      vulnerability = vulnerabilityForBoard(indexInCycle, CHICAGO_VUL_CYCLE);
    } else {
      vulnerability = vulnerabilityForBoard(i + 1, DUPLICATE_VUL_CYCLE);
    }

    if (!rules.vulnerability) vulnerability = { ...NO_VULNERABILITY };

    allEvents.push(...events);

    scored.push({
      deal,
      score,
      vulnerability: dealVulnerability,
      rubberIndex: playedInRubber,
      displayNumber: i + 1,
      events,
      runningTotals: { ...totals },
    });
  });

  const state: GameState = {
    deals: scored,
    totals: { ...totals },
    gamesWon: { ...gamesWon },
    currentLeg: { ...currentLeg },
    vulnerability,
    rubbers,
    rubberComplete: scored[scored.length - 1]?.events.some((e) => e.kind === 'rubber-won') ?? false,
    events: allEvents,
  };

  if (rules.mode === 'rubber' && options.settleUnfinishedRubber) {
    const hasPlay = gamesWon.A + gamesWon.B > 0 || currentLeg.A + currentLeg.B > 0;
    if (hasPlay) {
      unfinishedRubberSettlement(gamesWon, currentLeg).forEach((s) => {
        state.totals[s.team] += s.amount;
      });
    }
  }

  return state;
}

/** Vulnerability that will apply to the next deal, for the entry screen. */
export function nextVulnerability(state: GameState): TeamVulnerability {
  return state.vulnerability;
}
