/**
 * Match state as a pure reducer.
 *
 * Undo/redo works on snapshots of the deal list rather than on inverse
 * operations, because the scoring engine re-derives everything downstream from
 * that list. Restoring a snapshot therefore restores the whole match exactly.
 */

import type { Deal, RuleSet, TeamId } from '../engine/types';
import { defaultRules, DEFAULT_PRESET_ID } from '../engine/presets';

export interface TeamConfig {
  name: string;
  players: string[];
}

export interface MatchState {
  phase: 'setup' | 'play';
  teams: Record<TeamId, TeamConfig>;
  rules: RuleSet;
  presetId: string;
  deals: Deal[];
  /** Snapshots of `deals` before each mutation, oldest first. */
  past: Deal[][];
  /** Snapshots undone but not yet superseded, newest first. */
  future: Deal[][];
  /** Adds the unfinished-rubber settlement to the displayed totals. */
  settleUnfinished: boolean;
  startedAt: number;
}

export type MatchAction =
  | { type: 'start'; teams: Record<TeamId, TeamConfig>; rules: RuleSet; presetId: string }
  | { type: 'add-deal'; deal: Deal }
  | { type: 'update-deal'; id: string; patch: Partial<Deal> }
  | { type: 'delete-deal'; id: string }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'set-rules'; rules: RuleSet; presetId: string }
  | { type: 'rename-team'; team: TeamId; name: string }
  | { type: 'set-players'; team: TeamId; players: string[] }
  | { type: 'toggle-settle' }
  | { type: 'clear-deals' }
  | { type: 'new-match' }
  | { type: 'edit-setup' }
  | { type: 'hydrate'; state: MatchState };

/** Kept small so undo stays snappy and localStorage stays well under quota. */
export const MAX_HISTORY = 60;

export function initialState(): MatchState {
  return {
    phase: 'setup',
    teams: {
      A: { name: '', players: [] },
      B: { name: '', players: [] },
    },
    rules: defaultRules(),
    presetId: DEFAULT_PRESET_ID,
    deals: [],
    past: [],
    future: [],
    settleUnfinished: false,
    startedAt: Date.now(),
  };
}

/** Applies a change to `deals` while recording the previous list for undo. */
function withDeals(state: MatchState, deals: Deal[]): MatchState {
  const past = [...state.past, state.deals].slice(-MAX_HISTORY);
  return { ...state, deals, past, future: [] };
}

export function matchReducer(state: MatchState, action: MatchAction): MatchState {
  switch (action.type) {
    case 'start':
      return {
        ...state,
        phase: 'play',
        teams: action.teams,
        rules: action.rules,
        presetId: action.presetId,
        startedAt: state.deals.length > 0 ? state.startedAt : Date.now(),
      };

    case 'add-deal':
      return withDeals(state, [...state.deals, action.deal]);

    case 'update-deal': {
      const index = state.deals.findIndex((d) => d.id === action.id);
      if (index === -1) return state;
      const next = [...state.deals];
      next[index] = { ...next[index], ...action.patch, id: next[index].id };
      return withDeals(state, next);
    }

    case 'delete-deal': {
      if (!state.deals.some((d) => d.id === action.id)) return state;
      return withDeals(state, state.deals.filter((d) => d.id !== action.id));
    }

    case 'undo': {
      if (state.past.length === 0) return state;
      const previous = state.past[state.past.length - 1];
      return {
        ...state,
        deals: previous,
        past: state.past.slice(0, -1),
        future: [state.deals, ...state.future].slice(0, MAX_HISTORY),
      };
    }

    case 'redo': {
      if (state.future.length === 0) return state;
      const [next, ...rest] = state.future;
      return {
        ...state,
        deals: next,
        past: [...state.past, state.deals].slice(-MAX_HISTORY),
        future: rest,
      };
    }

    case 'set-rules':
      // Rules are not part of the undo stack: they re-derive the whole card
      // anyway, and mixing them in would make undo confusing.
      return { ...state, rules: action.rules, presetId: action.presetId };

    case 'rename-team':
      return {
        ...state,
        teams: {
          ...state.teams,
          [action.team]: { ...state.teams[action.team], name: action.name },
        },
      };

    case 'set-players':
      return {
        ...state,
        teams: {
          ...state.teams,
          [action.team]: { ...state.teams[action.team], players: action.players },
        },
      };

    case 'toggle-settle':
      return { ...state, settleUnfinished: !state.settleUnfinished };

    case 'clear-deals':
      return state.deals.length === 0 ? state : withDeals(state, []);

    case 'new-match':
      return initialState();

    case 'edit-setup':
      return { ...state, phase: 'setup' };

    case 'hydrate':
      return action.state;

    default:
      return state;
  }
}

export function canUndo(state: MatchState): boolean {
  return state.past.length > 0;
}

export function canRedo(state: MatchState): boolean {
  return state.future.length > 0;
}
