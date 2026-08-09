import { useState } from 'react';
import { PRESETS, matchPreset } from '../engine/presets';
import type { RuleSet, TeamId } from '../engine/types';
import { useMatch } from '../store/MatchContext';
import { cx } from '../lib/format';
import { ChevronIcon, MoonIcon, SunIcon } from './Icons';
import { RuleToggles } from './RuleToggles';
import { AthleteMark } from './AthleteMark';
import { InstallCallout } from './InstallCallout';
import { InstallControl } from './InstallControl';
import type { useTheme } from '../hooks/useTheme';

const TEAM_PLACEHOLDER: Record<TeamId, string> = { A: 'We', B: 'They' };

export function SetupScreen({ theme }: { theme: ReturnType<typeof useTheme> }) {
  const { state, dispatch } = useMatch();
  const [teams, setTeams] = useState(state.teams);
  const [rules, setRules] = useState<RuleSet>(state.rules);
  const [presetId, setPresetId] = useState(state.presetId);
  const [showPlayers, setShowPlayers] = useState(
    state.teams.A.players.length > 0 || state.teams.B.players.length > 0,
  );
  const [showRules, setShowRules] = useState(false);

  const isEditing = state.deals.length > 0;
  const matched = matchPreset(rules);

  const setName = (team: TeamId, name: string) => {
    setTeams((prev) => ({ ...prev, [team]: { ...prev[team], name } }));
  };

  const setPlayer = (team: TeamId, index: number, value: string) => {
    setTeams((prev) => {
      const players = [...prev[team].players];
      players[index] = value;
      return { ...prev, [team]: { ...prev[team], players } };
    });
  };

  const choosePreset = (id: string) => {
    const preset = PRESETS.find((p) => p.id === id);
    if (!preset) return;
    setPresetId(id);
    setRules({ ...preset.rules });
  };

  const start = () => {
    const cleaned: typeof teams = {
      A: {
        name: teams.A.name.trim(),
        players: teams.A.players.map((p) => p.trim()).filter(Boolean),
      },
      B: {
        name: teams.B.name.trim(),
        players: teams.B.players.map((p) => p.trim()).filter(Boolean),
      },
    };
    dispatch({ type: 'start', teams: cleaned, rules, presetId: matched?.id ?? presetId });
  };

  return (
    <div className="mx-auto w-full max-w-lg px-5 pb-28 pt-6 sm:pt-10">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5 opacity-70">
          <AthleteMark className="h-4 w-4" />
          <span className="label" style={{ letterSpacing: '0.14em' }}>
            Athelite
          </span>
        </div>
        <div className="flex items-center gap-0.5">
          <InstallControl />
          <button
            type="button"
            onClick={theme.toggle}
            aria-label={
              theme.resolved === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'
            }
            title={theme.resolved === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            className="rounded-lg p-2.5 text-ink-3 transition-colors hover:text-ink"
          >
            {theme.resolved === 'dark' ? <SunIcon /> : <MoonIcon />}
          </button>
        </div>
      </div>

      <header className="mb-8 text-center">
        <div
          className="mb-3 flex items-center justify-center gap-2 text-[15px]"
          aria-hidden="true"
        >
          <span style={{ color: 'var(--ink)' }}>♠</span>
          <span style={{ color: 'var(--red)' }}>♥</span>
          <span style={{ color: 'var(--red)' }}>♦</span>
          <span style={{ color: 'var(--ink)' }}>♣</span>
        </div>
        <h1 className="display text-[40px] leading-[1.05] font-semibold sm:text-[46px]">
          Bridge Scorer
        </h1>
        <p className="mt-2 text-[14px] leading-relaxed text-ink-2">
          {isEditing
            ? 'Change the names or the rules. Your scorecard is kept and re-scored.'
            : 'Name the two sides, pick how you score, and start dealing.'}
        </p>
      </header>

      <InstallCallout />

      <section className="mb-6">
        <h2 className="label mb-3">The two sides</h2>
        <div className="card divide-y" style={{ borderColor: 'var(--rule)' }}>
          {(['A', 'B'] as TeamId[]).map((team) => (
            <div key={team} className="p-4" style={{ borderColor: 'var(--rule)' }}>
              <label
                className="label mb-2 block"
                htmlFor={`team-${team}`}
                style={{ color: 'var(--brass)' }}
              >
                {team === 'A' ? 'Side one' : 'Side two'}
              </label>
              <input
                id={`team-${team}`}
                type="text"
                value={teams[team].name}
                onChange={(e) => setName(team, e.target.value)}
                placeholder={TEAM_PLACEHOLDER[team]}
                maxLength={24}
                autoComplete="off"
                spellCheck={false}
                className="display w-full bg-transparent text-[26px] font-semibold leading-tight text-ink outline-none placeholder:text-ink-3/60"
              />

              {showPlayers && (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {[0, 1].map((i) => (
                    <input
                      key={i}
                      type="text"
                      value={teams[team].players[i] ?? ''}
                      onChange={(e) => setPlayer(team, i, e.target.value)}
                      placeholder={`Player ${i + 1}`}
                      maxLength={18}
                      autoComplete="off"
                      className="rounded-lg border px-3 py-2 text-[14px] text-ink outline-none placeholder:text-ink-3/70"
                      style={{
                        borderColor: 'var(--rule)',
                        backgroundColor: 'var(--surface-2)',
                      }}
                      aria-label={`${teams[team].name || TEAM_PLACEHOLDER[team]} player ${i + 1}`}
                    />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setShowPlayers((v) => !v)}
          className="mt-3 text-[13px] font-medium underline decoration-dotted underline-offset-4 text-ink-2 transition-colors hover:text-ink"
        >
          {showPlayers ? 'Hide player names' : 'Add player names (optional)'}
        </button>
      </section>

      <section className="mb-6">
        <h2 className="label mb-3">How you score</h2>
        <div className="space-y-2">
          {PRESETS.map((preset) => {
            const selected = matched?.id === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => choosePreset(preset.id)}
                aria-pressed={selected}
                className={cx(
                  'card w-full px-4 py-3.5 text-left transition-all duration-150',
                  selected ? 'shadow-sm' : 'hover:border-rule-strong',
                )}
                style={
                  selected
                    ? {
                        borderColor: 'var(--brass)',
                        boxShadow: '0 0 0 1px var(--brass)',
                        backgroundColor: 'var(--surface)',
                      }
                    : undefined
                }
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="display text-[19px] font-semibold">{preset.name}</span>
                  {selected && (
                    <span className="label" style={{ color: 'var(--brass)' }}>
                      Selected
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-[13px] text-ink-2">{preset.tagline}</p>
                {selected && (
                  <p className="mt-2 text-[13px] leading-relaxed text-ink-3">
                    {preset.detail}
                  </p>
                )}
              </button>
            );
          })}
          {!matched && (
            <div
              className="card px-4 py-3.5"
              style={{ borderColor: 'var(--brass)', boxShadow: '0 0 0 1px var(--brass)' }}
            >
              <span className="display text-[19px] font-semibold">Custom rules</span>
              <p className="mt-0.5 text-[13px] text-ink-2">
                You have adjusted the rules below.
              </p>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => setShowRules((v) => !v)}
          className="mt-3 flex w-full items-center justify-between rounded-lg px-1 py-2 text-[13px] font-medium text-ink-2 transition-colors hover:text-ink"
          aria-expanded={showRules}
        >
          <span className="underline decoration-dotted underline-offset-4">
            Fine-tune individual rules
          </span>
          <ChevronIcon
            className={cx('transition-transform duration-200', showRules && 'rotate-90')}
          />
        </button>

        {showRules && (
          <div className="mt-2">
            <RuleToggles rules={rules} onChange={setRules} />
          </div>
        )}
      </section>

      <div
        className="fixed inset-x-0 bottom-0 z-20 border-t px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3"
        style={{
          borderColor: 'var(--rule)',
          backgroundColor: 'color-mix(in srgb, var(--paper) 92%, transparent)',
          backdropFilter: 'blur(10px)',
        }}
      >
        <div className="mx-auto max-w-lg">
          <button
            type="button"
            onClick={start}
            className="w-full rounded-xl px-6 py-4 text-[16px] font-semibold tracking-tight transition-transform active:scale-[0.985]"
            style={{ backgroundColor: 'var(--ink)', color: 'var(--paper)' }}
          >
            {isEditing ? 'Save and return to the scorecard' : 'Start scoring'}
          </button>
        </div>
      </div>
    </div>
  );
}
