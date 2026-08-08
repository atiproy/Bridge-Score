import type { Deal, RuleSet, Strain, TeamId } from '../engine/types';
import { RISK_SUFFIX, STRAIN_LABEL } from '../engine/scoring';

/** Fallback names so the UI never renders an empty team label. */
export const DEFAULT_TEAM_NAMES: Record<TeamId, string> = {
  A: 'We',
  B: 'They',
};

export function teamName(
  teams: Record<TeamId, { name: string }>,
  team: TeamId,
): string {
  return teams[team].name.trim() || DEFAULT_TEAM_NAMES[team];
}

export function isRedSuit(strain: Strain): boolean {
  return strain === 'H' || strain === 'D';
}

export function contractText(deal: Deal, rules: RuleSet): string {
  if (deal.passedOut) return 'Passed out';
  const risk = rules.doubles ? deal.risk : 'none';
  return `${deal.level}${STRAIN_LABEL[deal.strain]}${RISK_SUFFIX[risk]}`;
}

/** "10 tricks" / "1 trick" */
export function trickWord(n: number): string {
  return `${n} ${n === 1 ? 'trick' : 'tricks'}`;
}

/** Result relative to the contract: "=", "+2", "−3" (a real minus sign). */
export function resultDelta(tricksWon: number, needed: number): string {
  const diff = tricksWon - needed;
  if (diff === 0) return '=';
  if (diff > 0) return `+${diff}`;
  return `−${Math.abs(diff)}`;
}

export function formatPoints(n: number): string {
  return n.toLocaleString('en-US');
}

export function ordinal(n: number): string {
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

export function makeDealId(): string {
  // crypto.randomUUID is unavailable on some older mobile browsers over http.
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `deal-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}
