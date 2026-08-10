/**
 * Pure Contract Bridge scoring. No React, no storage, no side effects.
 *
 * Reference values follow the official Laws of Duplicate Bridge / Laws of
 * Rubber Bridge scoring tables. Every constant here is covered by a test in
 * `scoring.test.ts` so a change to the tables fails loudly.
 */

import type {
  Deal,
  DealScore,
  ExplainLine,
  Level,
  Risk,
  RuleSet,
  SideScore,
  Strain,
  TeamId,
  TeamVulnerability,
} from './types';

/** Points per odd trick. NoTrump's first trick is worth 40, the rest 30. */
export const TRICK_VALUE: Record<Strain, number> = {
  C: 20,
  D: 20,
  H: 30,
  S: 30,
  NT: 30,
};

export const NT_FIRST_TRICK = 40;

/** Trick score at or above this wins a game. */
export const GAME_THRESHOLD = 100;

export const STRAIN_LABEL: Record<Strain, string> = {
  C: '♣',
  D: '♦',
  H: '♥',
  S: '♠',
  NT: 'NT',
};

export const STRAIN_NAME: Record<Strain, string> = {
  C: 'Clubs',
  D: 'Diamonds',
  H: 'Hearts',
  S: 'Spades',
  NT: 'No Trump',
};

/** Suits printed in red. Used by the UI and by the plain-text export. */
export const RED_STRAINS: Strain[] = ['H', 'D'];

/** Bidding order, lowest to highest. */
export const STRAIN_ORDER: Strain[] = ['C', 'D', 'H', 'S', 'NT'];

export const RISK_SUFFIX: Record<Risk, string> = {
  none: '',
  doubled: ' X',
  redoubled: ' XX',
};

export const RISK_NAME: Record<Risk, string> = {
  none: 'undoubled',
  doubled: 'doubled',
  redoubled: 'redoubled',
};

export function riskMultiplier(risk: Risk): 1 | 2 | 4 {
  if (risk === 'doubled') return 2;
  if (risk === 'redoubled') return 4;
  return 1;
}

export function otherTeam(team: TeamId): TeamId {
  return team === 'A' ? 'B' : 'A';
}

/** Tricks the contract needs: the book of 6 plus the odd tricks bid. */
export function contractTricks(level: Level): number {
  return level + 6;
}

/**
 * Base trick score, before doubling.
 * Minors 20/trick, majors 30/trick, NT 40 for the first then 30.
 */
export function baseTrickScore(level: Level, strain: Strain): number {
  if (strain === 'NT') return NT_FIRST_TRICK + (level - 1) * 30;
  return level * TRICK_VALUE[strain];
}

/** Trick score including the doubling multiplier. This is the below-the-line score. */
export function trickScore(level: Level, strain: Strain, risk: Risk): number {
  return baseTrickScore(level, strain) * riskMultiplier(risk);
}

/**
 * Overtrick value.
 * Undoubled: the suit's normal trick value (NT overtricks are 30, not 40).
 * Doubled:   100 non-vulnerable, 200 vulnerable, per trick.
 * Redoubled: 200 non-vulnerable, 400 vulnerable, per trick.
 */
export function overtrickScore(
  count: number,
  strain: Strain,
  risk: Risk,
  vulnerable: boolean,
): number {
  if (count <= 0) return 0;
  if (risk === 'none') return count * TRICK_VALUE[strain];
  const base = vulnerable ? 200 : 100;
  return count * base * (risk === 'redoubled' ? 2 : 1);
}

/**
 * Penalty paid to the defenders when the contract fails.
 *
 * Undoubled:        50/trick non-vulnerable, 100/trick vulnerable.
 * Doubled, non-vul: 100 for the 1st, 200 for the 2nd and 3rd, 300 thereafter.
 * Doubled, vul:     200 for the 1st, 300 for each subsequent.
 * Redoubled:        exactly double the doubled figures.
 */
export function undertrickScore(count: number, risk: Risk, vulnerable: boolean): number {
  if (count <= 0) return 0;
  if (risk === 'none') return count * (vulnerable ? 100 : 50);

  const multiplier = risk === 'redoubled' ? 2 : 1;
  let total = 0;
  for (let n = 1; n <= count; n += 1) {
    let value: number;
    if (vulnerable) {
      value = n === 1 ? 200 : 300;
    } else if (n === 1) {
      value = 100;
    } else if (n <= 3) {
      value = 200;
    } else {
      value = 300;
    }
    total += value * multiplier;
  }
  return total;
}

/** Small slam 500/750, grand slam 1000/1500. Only paid when the contract makes. */
export function slamBonus(level: Level, vulnerable: boolean): number {
  if (level === 6) return vulnerable ? 750 : 500;
  if (level === 7) return vulnerable ? 1500 : 1000;
  return 0;
}

/** "For the insult": 50 for making a doubled contract, 100 redoubled. */
export function insultBonus(risk: Risk): number {
  if (risk === 'doubled') return 50;
  if (risk === 'redoubled') return 100;
  return 0;
}

/** Duplicate / Chicago: 300 or 500 for game, 50 for a part score. */
export function gameOrPartScoreBonus(score: number, vulnerable: boolean): number {
  if (score >= GAME_THRESHOLD) return vulnerable ? 500 : 300;
  return 50;
}

function emptySide(): SideScore {
  return { below: 0, above: 0, total: 0 };
}

function add(side: SideScore, line: 'below' | 'above', points: number): void {
  if (line === 'below') side.below += points;
  else side.above += points;
  side.total += points;
}

/** Clamp a possibly-corrupt persisted value into the legal trick range. */
export function clampTricks(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(13, Math.max(0, Math.trunc(value)));
}

export function formatContract(level: Level, strain: Strain, risk: Risk): string {
  return `${level}${STRAIN_LABEL[strain]}${RISK_SUFFIX[risk]}`;
}

/**
 * Score a single deal in isolation.
 *
 * `vulnerability` is supplied by the caller because in Rubber and Chicago it is
 * derived from the deals that came before — see `computeGame`.
 */
export function scoreDeal(
  deal: Deal,
  rules: RuleSet,
  vulnerability: TeamVulnerability,
): DealScore {
  const A = emptySide();
  const B = emptySide();
  const lines: ExplainLine[] = [];
  const warnings: string[] = [];
  const sides: Record<TeamId, SideScore> = { A, B };

  const push = (
    team: TeamId,
    line: 'below' | 'above',
    label: string,
    points: number,
    formula?: string,
    emphasis?: boolean,
  ): void => {
    if (points === 0) return;
    add(sides[team], line, points);
    lines.push({ team, line, label, points, formula, emphasis });
  };

  // Honours are independent of the contract's outcome, and either side can
  // claim them, so they are scored even on a passed-out board's neighbours.
  const applyHonours = (): void => {
    if (!deal.honours) return;
    if (!rules.honours) {
      warnings.push('Honours were claimed but the current rules do not award them.');
      return;
    }
    if (rules.mode !== 'rubber') {
      warnings.push('Honours only apply in Rubber Bridge; this claim was ignored.');
      return;
    }
    push(
      deal.honours.team,
      'above',
      deal.honours.value === 150 ? 'Honours (5 trump honours / 4 aces)' : 'Honours (4 trump honours)',
      deal.honours.value,
      'Held in one hand, scored above the line regardless of the result',
    );
  };

  if (deal.passedOut) {
    applyHonours();
    return {
      A,
      B,
      headline: 'Passed out',
      outcome: 'passed',
      contractTricks: 0,
      overtricks: 0,
      undertricks: 0,
      lines,
      warnings,
    };
  }

  const effectiveRisk: Risk = rules.doubles ? deal.risk : 'none';
  if (!rules.doubles && deal.risk !== 'none') {
    warnings.push('Doubling is switched off in the current rules, so it was ignored.');
  }

  const declarer = deal.declarer;
  const defender = otherTeam(declarer);
  const declarerVul = rules.vulnerability ? vulnerability[declarer] : false;
  const defenderVul = rules.vulnerability ? vulnerability[defender] : false;

  const needed = contractTricks(deal.level);
  const won = clampTricks(deal.tricksWon);
  const made = won >= needed;
  const overtricks = made ? won - needed : 0;
  const undertricks = made ? 0 : needed - won;

  const contract = formatContract(deal.level, deal.strain, effectiveRisk);

  if (made) {
    const trick = trickScore(deal.level, deal.strain, effectiveRisk);
    const baseFormula =
      deal.strain === 'NT'
        ? `40 for the first + ${deal.level - 1} x 30 = ${baseTrickScore(deal.level, deal.strain)}`
        : `${deal.level} x ${TRICK_VALUE[deal.strain]} = ${baseTrickScore(deal.level, deal.strain)}`;
    const riskNote =
      effectiveRisk === 'none' ? '' : `, ${RISK_NAME[effectiveRisk]} x${riskMultiplier(effectiveRisk)}`;

    push(
      declarer,
      'below',
      `Contract made: ${contract}`,
      trick,
      `${baseFormula}${riskNote}`,
      true,
    );

    if (overtricks > 0) {
      const per =
        effectiveRisk === 'none'
          ? TRICK_VALUE[deal.strain]
          : (declarerVul ? 200 : 100) * (effectiveRisk === 'redoubled' ? 2 : 1);
      const why =
        effectiveRisk === 'none'
          ? `${overtricks} x ${per} (normal trick value)`
          : `${overtricks} x ${per} (${RISK_NAME[effectiveRisk]}, ${declarerVul ? 'vulnerable' : 'not vulnerable'})`;
      push(
        declarer,
        'above',
        `Overtrick${overtricks === 1 ? '' : 's'} (+${overtricks})`,
        overtrickScore(overtricks, deal.strain, effectiveRisk, declarerVul),
        why,
      );
    }

    if (rules.slamBonuses) {
      const slam = slamBonus(deal.level, declarerVul);
      if (slam > 0) {
        push(
          declarer,
          'above',
          deal.level === 7 ? 'Grand slam bonus' : 'Small slam bonus',
          slam,
          `Bid and made all ${deal.level === 7 ? '13' : '12'} tricks, ${declarerVul ? 'vulnerable' : 'not vulnerable'}`,
        );
      } else if (deal.level < 6 && won >= 12) {
        // The tricks for a slam were taken but the slam itself was never bid.
        // The bonus rewards the bid, not just the trick count, so this is a
        // deliberate zero — but it looks exactly like a bug from the outside.
        const missedGrand = won >= 13;
        warnings.push(
          `Bidding ${missedGrand ? 7 : 6}${STRAIN_LABEL[deal.strain]} instead would have earned a ${
            missedGrand ? 'grand' : 'small'
          } slam bonus — it only counts when the slam is actually bid, not just made.`,
        );
      }
    }

    if (rules.insultBonus) {
      const insult = insultBonus(effectiveRisk);
      if (insult > 0) {
        push(
          declarer,
          'above',
          'Bonus for making a ' + RISK_NAME[effectiveRisk] + ' contract',
          insult,
          'Traditionally called the bonus "for the insult"',
        );
      }
    }

    // Rubber pays for game via the rubber bonus at the end, so no per-deal
    // game bonus. Duplicate and Chicago pay it immediately.
    if (rules.mode !== 'rubber') {
      const bonus = gameOrPartScoreBonus(trick, declarerVul);
      push(
        declarer,
        'above',
        trick >= GAME_THRESHOLD
          ? `Game bonus (${declarerVul ? 'vulnerable' : 'not vulnerable'})`
          : 'Part score bonus',
        bonus,
        trick >= GAME_THRESHOLD
          ? `Trick score of ${trick} reaches the ${GAME_THRESHOLD}-point game threshold`
          : `Trick score of ${trick} is below the ${GAME_THRESHOLD}-point game threshold`,
      );
    }
  } else {
    const penalty = undertrickScore(undertricks, effectiveRisk, declarerVul);
    const detail =
      effectiveRisk === 'none'
        ? `${undertricks} x ${declarerVul ? 100 : 50} (${declarerVul ? 'vulnerable' : 'not vulnerable'})`
        : `${RISK_NAME[effectiveRisk]} and ${declarerVul ? 'vulnerable' : 'not vulnerable'}: ${describeUndertrickSteps(undertricks, effectiveRisk, declarerVul)}`;
    push(
      defender,
      'above',
      `Contract failed: ${contract} down ${undertricks}`,
      penalty,
      detail,
      true,
    );
  }

  applyHonours();

  const outcome: DealScore['outcome'] = made ? 'made' : 'set';
  const headline = made
    ? `${contract} made ${won}`
    : `${contract} down ${undertricks}`;

  void defenderVul; // defender vulnerability never affects the score, only display

  return {
    A,
    B,
    headline,
    outcome,
    contractTricks: needed,
    overtricks,
    undertricks,
    lines,
    warnings,
  };
}

/** "100 + 200 + 200" — shows the escalating penalty ladder to the user. */
export function describeUndertrickSteps(
  count: number,
  risk: Risk,
  vulnerable: boolean,
): string {
  if (count <= 0) return '0';
  const multiplier = risk === 'redoubled' ? 2 : 1;
  const steps: number[] = [];
  for (let n = 1; n <= count; n += 1) {
    let value: number;
    if (risk === 'none') {
      value = vulnerable ? 100 : 50;
    } else if (vulnerable) {
      value = (n === 1 ? 200 : 300) * multiplier;
    } else if (n === 1) {
      value = 100 * multiplier;
    } else if (n <= 3) {
      value = 200 * multiplier;
    } else {
      value = 300 * multiplier;
    }
    steps.push(value);
  }
  const sum = steps.reduce((a, b) => a + b, 0);
  return steps.length === 1 ? `${sum}` : `${steps.join(' + ')} = ${sum}`;
}
