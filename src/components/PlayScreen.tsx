import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { unfinishedRubberSettlement } from '../engine/gameState';
import { matchPreset } from '../engine/presets';
import type { Deal, RuleSet, ScoredDeal, TeamId } from '../engine/types';
import { useMatch } from '../store/MatchContext';
import { cx, formatPoints, teamName } from '../lib/format';
import { DealEntry } from './DealEntry';
import { RuleToggles } from './RuleToggles';
import { Scorecard } from './Scorecard';
import { ScoreHeader } from './ScoreHeader';
import { ShareSheet } from './ShareSheet';
import { Sheet } from './Sheet';
import {
  MoonIcon,
  RedoIcon,
  ShareIcon,
  SlidersIcon,
  SunIcon,
  UndoIcon,
} from './Icons';
import type { useTheme } from '../hooks/useTheme';

interface Props {
  theme: ReturnType<typeof useTheme>;
}

export function PlayScreen({ theme }: Props) {
  const { state, dispatch, game, canUndo, canRedo } = useMatch();
  const [editing, setEditing] = useState<ScoredDeal | null>(null);
  const [showRules, setShowRules] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const entryRef = useRef<HTMLDivElement>(null);

  const flash = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast((current) => (current === message ? null : current)), 2400);
  }, []);

  // Vulnerability for the form: the next deal's, or the edited deal's own.
  const entryVulnerability = editing
    ? editing.vulnerability
    : state.rules.vulnerability
      ? game.vulnerability
      : { A: false, B: false };

  const addDeal = (deal: Deal) => {
    if (editing) {
      dispatch({ type: 'update-deal', id: editing.deal.id, patch: deal });
      setEditing(null);
      flash(`Deal ${editing.displayNumber} updated`);
    } else {
      dispatch({ type: 'add-deal', deal });
      flash(deal.passedOut ? 'Passed-out deal recorded' : 'Deal scored');
    }
  };

  const startEdit = (row: ScoredDeal) => {
    setEditing(row);
    entryRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  };

  const setRules = (rules: RuleSet) => {
    dispatch({ type: 'set-rules', rules, presetId: matchPreset(rules)?.id ?? 'custom' });
  };

  // Ctrl/Cmd+Z and Shift+Ctrl/Cmd+Z, ignored while typing in a field.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'z') return;
      const target = e.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA)$/.test(target.tagName)) return;
      e.preventDefault();
      if (e.shiftKey) {
        if (canRedo) {
          dispatch({ type: 'redo' });
          flash('Redone');
        }
      } else if (canUndo) {
        dispatch({ type: 'undo' });
        flash('Undone');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [canUndo, canRedo, dispatch, flash]);

  const pendingSettlement = useMemo(
    () =>
      state.rules.mode === 'rubber'
        ? unfinishedRubberSettlement(game.gamesWon, game.currentLeg)
        : [],
    [state.rules.mode, game.gamesWon, game.currentLeg],
  );

  const lastRubber = [...game.rubbers].reverse().find((r) => r.complete);
  const justWonRubber =
    game.deals[game.deals.length - 1]?.events.some((e) => e.kind === 'rubber-won') ?? false;

  const margin = Math.abs(game.totals.A - game.totals.B);
  const leader: TeamId | null =
    game.totals.A === game.totals.B ? null : game.totals.A > game.totals.B ? 'A' : 'B';

  return (
    <div className="mx-auto w-full max-w-lg px-4 pb-16 pt-4 lg:max-w-5xl">
      <header className="mb-3 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => dispatch({ type: 'edit-setup' })}
          className="display truncate text-[19px] font-semibold tracking-tight transition-opacity hover:opacity-70"
          title="Edit names and rules"
          aria-label="Bridge Scorer — edit names and rules"
        >
          Bridge Scorer
        </button>

        <div className="flex items-center gap-0.5">
          <IconButton
            label="Undo"
            disabled={!canUndo}
            onClick={() => {
              dispatch({ type: 'undo' });
              flash('Undone');
            }}
          >
            <UndoIcon />
          </IconButton>
          <IconButton
            label="Redo"
            disabled={!canRedo}
            onClick={() => {
              dispatch({ type: 'redo' });
              flash('Redone');
            }}
          >
            <RedoIcon />
          </IconButton>
          <IconButton label="Rules and match settings" onClick={() => setShowRules(true)}>
            <SlidersIcon />
          </IconButton>
          <IconButton label="Share the scorecard" onClick={() => setShowShare(true)}>
            <ShareIcon />
          </IconButton>
          <IconButton
            label={theme.resolved === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            onClick={theme.toggle}
          >
            {theme.resolved === 'dark' ? <SunIcon /> : <MoonIcon />}
          </IconButton>
        </div>
      </header>

      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:items-start lg:gap-5">
        <div className="space-y-3 lg:sticky lg:top-4">
          <ScoreHeader teams={state.teams} game={game} rules={state.rules} />

          {justWonRubber && lastRubber?.winner && (
            <div
              className="card flex items-center gap-3 px-4 py-3"
              style={{ borderColor: 'var(--brass)', backgroundColor: 'var(--brass-soft)' }}
            >
              <span className="text-[20px]" aria-hidden="true">
                ♠
              </span>
              <div>
                <p
                  className="display text-[16px] font-semibold"
                  style={{ color: 'var(--brass-ink)' }}
                >
                  {teamName(state.teams, lastRubber.winner)} take the rubber
                </p>
                <p className="text-[12px]" style={{ color: 'var(--brass-ink)' }}>
                  {formatPoints(lastRubber.bonus)} bonus added. A new rubber starts on the
                  next deal.
                </p>
              </div>
            </div>
          )}

          <div ref={entryRef} className="scroll-mt-4">
            <DealEntry
              teams={state.teams}
              rules={state.rules}
              vulnerability={entryVulnerability}
              dealNumber={editing ? editing.displayNumber : game.deals.length + 1}
              editing={editing?.deal}
              onSubmit={addDeal}
              onCancelEdit={() => setEditing(null)}
            />
          </div>
        </div>

        <div className="mt-3 space-y-3 lg:mt-0">
          {pendingSettlement.length > 0 && (
            <label
              className="card flex cursor-pointer items-start gap-3 px-4 py-3"
              style={{ borderColor: 'var(--rule)' }}
            >
              <input
                type="checkbox"
                checked={state.settleUnfinished}
                onChange={() => dispatch({ type: 'toggle-settle' })}
                className="mt-0.5 h-[18px] w-[18px] shrink-0 accent-[var(--brass)]"
              />
              <span className="min-w-0">
                <span className="block text-[13.5px] font-semibold text-ink">
                  Settle the unfinished rubber
                </span>
                <span className="mt-0.5 block text-[12px] leading-relaxed text-ink-3">
                  If you stop now:{' '}
                  {pendingSettlement
                    .map(
                      (s) =>
                        `${teamName(state.teams, s.team)} +${s.amount} (${s.reason.toLowerCase()})`,
                    )
                    .join(', ')}
                  .
                </span>
              </span>
            </label>
          )}

          {game.deals.length > 0 && leader && (
            <p className="px-1 text-[12.5px] text-ink-3">
              <span className="font-semibold text-ink-2">{teamName(state.teams, leader)}</span>{' '}
              ahead by <span className="tnum font-semibold">{formatPoints(margin)}</span> after{' '}
              {game.deals.length} {game.deals.length === 1 ? 'deal' : 'deals'}.
            </p>
          )}

          <Scorecard
            deals={game.deals}
            teams={state.teams}
            rules={state.rules}
            onEdit={startEdit}
            onDelete={(id) => {
              dispatch({ type: 'delete-deal', id });
              if (editing?.deal.id === id) setEditing(null);
              flash('Deal deleted — undo is available');
            }}
          />
        </div>
      </div>

      <Sheet open={showRules} title="Rules and match" onClose={() => setShowRules(false)}>
        <p className="mb-3 text-[13px] leading-relaxed text-ink-2">
          Change these at any time. The whole scorecard is re-scored under the new rules, so
          nothing is lost.
        </p>
        <RuleToggles rules={state.rules} onChange={setRules} />

        <div className="mt-5 space-y-2">
          <button
            type="button"
            onClick={() => {
              setShowRules(false);
              dispatch({ type: 'edit-setup' });
            }}
            className="min-h-[46px] w-full rounded-xl border text-[14px] font-semibold text-ink"
            style={{ borderColor: 'var(--rule-strong)' }}
          >
            Edit team and player names
          </button>
          <button
            type="button"
            onClick={() => {
              if (game.deals.length > 0) {
                dispatch({ type: 'clear-deals' });
                flash('Scorecard cleared — undo is available');
              }
              setShowRules(false);
            }}
            disabled={game.deals.length === 0}
            className="min-h-[46px] w-full rounded-xl border text-[14px] font-semibold disabled:opacity-40"
            style={{ borderColor: 'var(--rule)', color: 'var(--red)' }}
          >
            Clear the scorecard, keep the teams
          </button>
          <button
            type="button"
            onClick={() => {
              dispatch({ type: 'new-match' });
              setShowRules(false);
            }}
            className="min-h-[46px] w-full rounded-xl text-[14px] font-semibold"
            style={{ backgroundColor: 'var(--surface-2)', color: 'var(--ink-2)' }}
          >
            Start a completely new match
          </button>
        </div>
      </Sheet>

      <ShareSheet
        open={showShare}
        onClose={() => setShowShare(false)}
        game={game}
        teams={state.teams}
        rules={state.rules}
        settleUnfinished={state.settleUnfinished}
      />

      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-center px-4"
      >
        {toast && (
          <div
            className="rounded-full px-4 py-2 text-[13px] font-medium shadow-lg"
            style={{ backgroundColor: 'var(--ink)', color: 'var(--paper)' }}
          >
            {toast}
          </div>
        )}
      </div>
    </div>
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cx(
        'rounded-lg p-2.5 transition-colors',
        disabled ? 'opacity-30' : 'text-ink-2 hover:text-ink',
      )}
    >
      {children}
    </button>
  );
}
