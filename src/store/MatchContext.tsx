import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type ReactNode,
} from 'react';
import { computeGame } from '../engine/gameState';
import type { GameState } from '../engine/types';
import {
  canRedo,
  canUndo,
  initialState,
  matchReducer,
  type MatchAction,
  type MatchState,
} from './matchReducer';
import { loadState, saveState } from './persistence';

interface MatchContextValue {
  state: MatchState;
  dispatch: React.Dispatch<MatchAction>;
  /** Fully derived scorecard for the current deals and rules. */
  game: GameState;
  canUndo: boolean;
  canRedo: boolean;
}

const MatchContext = createContext<MatchContextValue | null>(null);

/** Reads persisted state once, on first render, rather than in an effect. */
function init(): MatchState {
  return loadState() ?? initialState();
}

export function MatchProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(matchReducer, undefined, init);

  useEffect(() => {
    saveState(state);
  }, [state]);

  const game = useMemo(
    () =>
      computeGame(state.deals, state.rules, {
        settleUnfinishedRubber: state.settleUnfinished,
      }),
    [state.deals, state.rules, state.settleUnfinished],
  );

  const value = useMemo<MatchContextValue>(
    () => ({
      state,
      dispatch,
      game,
      canUndo: canUndo(state),
      canRedo: canRedo(state),
    }),
    [state, game],
  );

  return <MatchContext.Provider value={value}>{children}</MatchContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useMatch(): MatchContextValue {
  const ctx = useContext(MatchContext);
  if (!ctx) throw new Error('useMatch must be used inside a MatchProvider');
  return ctx;
}
