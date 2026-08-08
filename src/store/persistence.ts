/**
 * localStorage persistence with defensive validation.
 *
 * A saved match outlives deploys, so anything read back is treated as hostile
 * until proven well-formed: a corrupt or half-written entry must never brick
 * the app, it should just start a fresh match.
 */

import type { Deal, Level, Risk, RuleSet, Strain, TeamId } from '../engine/types';
import { clampTricks } from '../engine/scoring';
import { defaultRules, DEFAULT_PRESET_ID } from '../engine/presets';
import { initialState, type MatchState } from './matchReducer';

export const STORAGE_KEY = 'bridge-scorer:match:v1';
export const THEME_KEY = 'bridge-scorer:theme:v1';

const STRAINS: Strain[] = ['C', 'D', 'H', 'S', 'NT'];
const RISKS: Risk[] = ['none', 'doubled', 'redoubled'];
const MODES: RuleSet['mode'][] = ['rubber', 'duplicate', 'chicago'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function str(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function parseDeal(value: unknown): Deal | null {
  if (!isRecord(value)) return null;

  const declarer: TeamId = value.declarer === 'B' ? 'B' : 'A';
  const levelRaw = Number(value.level);
  const level = (Number.isFinite(levelRaw) ? Math.min(7, Math.max(1, Math.trunc(levelRaw))) : 1) as Level;
  const strain = STRAINS.includes(value.strain as Strain) ? (value.strain as Strain) : 'NT';
  const risk = RISKS.includes(value.risk as Risk) ? (value.risk as Risk) : 'none';

  let honours: Deal['honours'] = null;
  if (isRecord(value.honours)) {
    const team: TeamId = value.honours.team === 'B' ? 'B' : 'A';
    const v = Number(value.honours.value);
    if (v === 100 || v === 150) honours = { team, value: v };
  }

  let vulnerabilityOverride: Deal['vulnerabilityOverride'];
  if (isRecord(value.vulnerabilityOverride)) {
    vulnerabilityOverride = {
      A: bool(value.vulnerabilityOverride.A, false),
      B: bool(value.vulnerabilityOverride.B, false),
    };
  }

  return {
    id: str(value.id) || `deal-${Math.random().toString(36).slice(2, 10)}`,
    passedOut: bool(value.passedOut, false),
    declarer,
    declarerPlayer: typeof value.declarerPlayer === 'string' ? value.declarerPlayer : undefined,
    level,
    strain,
    risk,
    tricksWon: clampTricks(Number(value.tricksWon)),
    honours,
    vulnerabilityOverride,
    createdAt: Number.isFinite(Number(value.createdAt)) ? Number(value.createdAt) : Date.now(),
    note: typeof value.note === 'string' ? value.note : undefined,
  };
}

function parseDeals(value: unknown): Deal[] {
  if (!Array.isArray(value)) return [];
  return value.map(parseDeal).filter((d): d is Deal => d !== null);
}

function parseRules(value: unknown): RuleSet {
  const fallback = defaultRules();
  if (!isRecord(value)) return fallback;
  return {
    mode: MODES.includes(value.mode as RuleSet['mode'])
      ? (value.mode as RuleSet['mode'])
      : fallback.mode,
    vulnerability: bool(value.vulnerability, fallback.vulnerability),
    doubles: bool(value.doubles, fallback.doubles),
    honours: bool(value.honours, fallback.honours),
    slamBonuses: bool(value.slamBonuses, fallback.slamBonuses),
    insultBonus: bool(value.insultBonus, fallback.insultBonus),
  };
}

function parseTeam(value: unknown, fallbackName: string): { name: string; players: string[] } {
  if (!isRecord(value)) return { name: fallbackName, players: [] };
  const players = Array.isArray(value.players)
    ? value.players.filter((p): p is string => typeof p === 'string').slice(0, 2)
    : [];
  return { name: str(value.name, fallbackName), players };
}

export function parseState(raw: unknown): MatchState | null {
  if (!isRecord(raw)) return null;
  const base = initialState();

  const deals = parseDeals(raw.deals);
  const phase = raw.phase === 'play' ? 'play' : 'setup';

  return {
    ...base,
    phase,
    teams: {
      A: parseTeam(isRecord(raw.teams) ? raw.teams.A : undefined, ''),
      B: parseTeam(isRecord(raw.teams) ? raw.teams.B : undefined, ''),
    },
    rules: parseRules(raw.rules),
    presetId: str(raw.presetId, DEFAULT_PRESET_ID),
    deals,
    // History is intentionally not persisted: it is session-scoped, and
    // restoring a stale undo stack across reloads is more confusing than useful.
    past: [],
    future: [],
    settleUnfinished: bool(raw.settleUnfinished, false),
    startedAt: Number.isFinite(Number(raw.startedAt)) ? Number(raw.startedAt) : base.startedAt,
  };
}

export function loadState(): MatchState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = parseState(JSON.parse(raw));
    // A match with no teams named has nothing worth restoring.
    if (parsed && parsed.phase === 'play' && !parsed.teams.A.name && !parsed.teams.B.name) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveState(state: MatchState): void {
  try {
    const { past: _past, future: _future, ...persisted } = state;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted));
  } catch {
    // Private browsing or a full quota. Scoring still works for this session.
  }
}

export function clearState(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
