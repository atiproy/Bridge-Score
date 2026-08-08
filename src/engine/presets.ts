import type { RulePreset, RuleSet } from './types';

/**
 * Presets run from simplest to most complete. The first entry is the default so
 * a table that just wants to keep score is never made to learn vulnerability.
 * Every preset stays fully editable afterwards via the individual toggles.
 */
export const PRESETS: RulePreset[] = [
  {
    id: 'casual',
    name: 'Casual',
    tagline: 'Simplest — just contracts and tricks',
    detail:
      'No vulnerability, no doubling, no honours. Make your contract and take the trick score plus a flat bonus; go down and the other side takes 50 a trick. The quickest way to keep score.',
    rules: {
      mode: 'duplicate',
      vulnerability: false,
      doubles: false,
      honours: false,
      slamBonuses: true,
      insultBonus: false,
    },
  },
  {
    id: 'party',
    name: 'Party Bridge',
    tagline: 'Each deal scored on its own',
    detail:
      'Every deal is settled immediately with a game or part-score bonus, exactly like duplicate scoring. Vulnerability follows the standard board cycle and can be overridden per deal. No rubber to finish, so you can stop whenever you like.',
    rules: {
      mode: 'duplicate',
      vulnerability: true,
      doubles: true,
      honours: false,
      slamBonuses: true,
      insultBonus: true,
    },
  },
  {
    id: 'chicago',
    name: 'Chicago',
    tagline: 'Four-deal rounds, fixed vulnerability',
    detail:
      'Four deals to a round. Nobody is vulnerable on the first, one side on each of the middle two, and both on the fourth. Scored per deal like Party Bridge. Popular when you want a defined finish.',
    rules: {
      mode: 'chicago',
      vulnerability: true,
      doubles: true,
      honours: false,
      slamBonuses: true,
      insultBonus: true,
    },
  },
  {
    id: 'rubber-simple',
    name: 'Rubber',
    tagline: 'Classic above/below the line',
    detail:
      'Trick scores go below the line and 100 wins a game. Win two games to take the rubber and its bonus — 700 if the other side has none, 500 if they have one. Winning a game makes you vulnerable. Honours are switched off.',
    rules: {
      mode: 'rubber',
      vulnerability: true,
      doubles: true,
      honours: false,
      slamBonuses: true,
      insultBonus: true,
    },
  },
  {
    id: 'rubber-full',
    name: 'Rubber — full laws',
    tagline: 'Everything, honours included',
    detail:
      'Complete Rubber Bridge scoring with the honours bonus: 100 for four trump honours in one hand, 150 for all five, or 150 for all four aces in a No Trump contract. Honours count even when the contract fails.',
    rules: {
      mode: 'rubber',
      vulnerability: true,
      doubles: true,
      honours: true,
      slamBonuses: true,
      insultBonus: true,
    },
  },
];

export const DEFAULT_PRESET_ID = 'party';

export function presetById(id: string): RulePreset {
  return PRESETS.find((p) => p.id === id) ?? PRESETS[1];
}

export function defaultRules(): RuleSet {
  return { ...presetById(DEFAULT_PRESET_ID).rules };
}

/** Finds the preset matching a rule set exactly, so edits show as "Custom". */
export function matchPreset(rules: RuleSet): RulePreset | undefined {
  return PRESETS.find(
    (p) =>
      p.rules.mode === rules.mode &&
      p.rules.vulnerability === rules.vulnerability &&
      p.rules.doubles === rules.doubles &&
      p.rules.honours === rules.honours &&
      p.rules.slamBonuses === rules.slamBonuses &&
      p.rules.insultBonus === rules.insultBonus,
  );
}

export const MODE_LABEL: Record<RuleSet['mode'], string> = {
  rubber: 'Rubber',
  duplicate: 'Per deal',
  chicago: 'Chicago',
};
