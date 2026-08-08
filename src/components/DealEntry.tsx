import { useEffect, useMemo, useState } from 'react';
import {
  STRAIN_LABEL,
  STRAIN_NAME,
  STRAIN_ORDER,
  contractTricks,
  scoreDeal,
} from '../engine/scoring';
import type {
  Deal,
  HonoursClaim,
  Level,
  Risk,
  RuleSet,
  Strain,
  TeamId,
  TeamVulnerability,
} from '../engine/types';
import type { TeamConfig } from '../store/matchReducer';
import { cx, isRedSuit, makeDealId, resultDelta, teamName, trickWord } from '../lib/format';
import { ExplainList } from './ExplainList';

const LEVELS: Level[] = [1, 2, 3, 4, 5, 6, 7];

interface Props {
  teams: Record<TeamId, TeamConfig>;
  rules: RuleSet;
  vulnerability: TeamVulnerability;
  dealNumber: number;
  /** When present the form edits this deal instead of creating a new one. */
  editing?: Deal;
  onSubmit: (deal: Deal) => void;
  onCancelEdit?: () => void;
}

export function DealEntry({
  teams,
  rules,
  vulnerability,
  dealNumber,
  editing,
  onSubmit,
  onCancelEdit,
}: Props) {
  const [declarer, setDeclarer] = useState<TeamId | null>(null);
  const [declarerPlayer, setDeclarerPlayer] = useState<string | undefined>();
  const [level, setLevel] = useState<Level | null>(null);
  const [strain, setStrain] = useState<Strain | null>(null);
  const [risk, setRisk] = useState<Risk>('none');
  const [tricksWon, setTricksWon] = useState<number | null>(null);
  const [honours, setHonours] = useState<HonoursClaim | null>(null);
  const [showExplain, setShowExplain] = useState(false);

  // Load the deal being edited, and reset cleanly when editing stops.
  useEffect(() => {
    if (editing) {
      setDeclarer(editing.declarer);
      setDeclarerPlayer(editing.declarerPlayer);
      setLevel(editing.level);
      setStrain(editing.strain);
      setRisk(editing.risk);
      setTricksWon(editing.tricksWon);
      setHonours(editing.honours ?? null);
    } else {
      setDeclarer(null);
      setDeclarerPlayer(undefined);
      setLevel(null);
      setStrain(null);
      setRisk('none');
      setTricksWon(null);
      setHonours(null);
    }
    setShowExplain(false);
  }, [editing]);

  const needed = level ? contractTricks(level) : null;
  const complete = declarer !== null && level !== null && strain !== null && tricksWon !== null;

  const draft: Deal | null = useMemo(() => {
    if (declarer === null || level === null || strain === null || tricksWon === null) {
      return null;
    }
    return {
      id: editing?.id ?? 'preview',
      passedOut: false,
      declarer,
      declarerPlayer,
      level,
      strain,
      risk: rules.doubles ? risk : 'none',
      tricksWon,
      honours: rules.honours && rules.mode === 'rubber' ? honours : null,
      vulnerabilityOverride: editing?.vulnerabilityOverride,
      createdAt: editing?.createdAt ?? Date.now(),
    };
  }, [declarer, declarerPlayer, level, strain, risk, tricksWon, honours, rules, editing]);

  const preview = useMemo(
    () => (draft ? scoreDeal(draft, rules, vulnerability) : null),
    [draft, rules, vulnerability],
  );

  const winner: TeamId | null = preview
    ? preview.A.total > preview.B.total
      ? 'A'
      : preview.B.total > preview.A.total
        ? 'B'
        : null
    : null;

  const submit = () => {
    if (!draft) return;
    onSubmit({ ...draft, id: editing?.id ?? makeDealId() });
    if (!editing) {
      setDeclarer(null);
      setDeclarerPlayer(undefined);
      setLevel(null);
      setStrain(null);
      setRisk('none');
      setTricksWon(null);
      setHonours(null);
      setShowExplain(false);
    }
  };

  const passOut = () => {
    onSubmit({
      id: editing?.id ?? makeDealId(),
      passedOut: true,
      declarer: declarer ?? 'A',
      level: 1,
      strain: 'NT',
      risk: 'none',
      tricksWon: 0,
      honours: null,
      createdAt: editing?.createdAt ?? Date.now(),
    });
  };

  const ctaLabel = editing
    ? 'Save changes'
    : declarer === null
      ? 'Who declared?'
      : level === null || strain === null
        ? 'What was the contract?'
        : tricksWon === null
          ? `How many tricks did ${teamName(teams, declarer)} win?`
          : 'Score this deal';

  const playersOf = (team: TeamId) => teams[team].players.filter(Boolean);
  const anyPlayers = playersOf('A').length > 0 || playersOf('B').length > 0;

  return (
    <section className="card overflow-hidden" aria-label={editing ? 'Edit deal' : 'New deal'}>
      <header
        className="flex items-center justify-between border-b px-4 py-2.5"
        style={{ borderColor: 'var(--rule)', backgroundColor: 'var(--surface-2)' }}
      >
        <span className="label">
          {editing ? `Editing deal ${dealNumber}` : `Deal ${dealNumber}`}
        </span>
        <span className="text-[11px] font-semibold tracking-wide text-ink-3">
          {!rules.vulnerability
            ? 'No vulnerability'
            : vulnerability.A && vulnerability.B
              ? 'Both vulnerable'
              : vulnerability.A
                ? `${teamName(teams, 'A')} vulnerable`
                : vulnerability.B
                  ? `${teamName(teams, 'B')} vulnerable`
                  : 'Nobody vulnerable'}
        </span>
      </header>

      <div className="space-y-4 p-4">
        {/* Declarer */}
        <div>
          <span className="label mb-2 block">Declared by</span>
          <div className="grid grid-cols-2 gap-2">
            {(['A', 'B'] as TeamId[]).map((team) => {
              const active = declarer === team;
              return (
                <button
                  key={team}
                  type="button"
                  aria-pressed={active}
                  onClick={() => {
                    setDeclarer(team);
                    setDeclarerPlayer(undefined);
                  }}
                  className={cx(
                    'min-h-[48px] truncate rounded-lg border px-3 py-2.5 text-[15px] font-semibold transition-all duration-150 active:scale-[0.98]',
                  )}
                  style={{
                    borderColor: active ? 'var(--ink)' : 'var(--rule)',
                    backgroundColor: active ? 'var(--ink)' : 'var(--surface-2)',
                    color: active ? 'var(--paper)' : 'var(--ink-2)',
                  }}
                >
                  {teamName(teams, team)}
                </button>
              );
            })}
          </div>

          {anyPlayers && declarer && playersOf(declarer).length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className="self-center text-[11.5px] text-ink-3">Declarer:</span>
              {playersOf(declarer).map((player) => {
                const active = declarerPlayer === player;
                return (
                  <button
                    key={player}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setDeclarerPlayer(active ? undefined : player)}
                    className="rounded-full border px-2.5 py-1 text-[12px] font-medium transition-colors"
                    style={{
                      borderColor: active ? 'var(--brass)' : 'var(--rule)',
                      backgroundColor: active ? 'var(--brass-soft)' : 'transparent',
                      color: active ? 'var(--brass-ink)' : 'var(--ink-2)',
                    }}
                  >
                    {player}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Contract */}
        <div>
          <span className="label mb-2 block">Contract</span>
          <div className="grid grid-cols-7 gap-1.5" role="group" aria-label="Contract level">
            {LEVELS.map((l) => {
              const active = level === l;
              return (
                <button
                  key={l}
                  type="button"
                  aria-pressed={active}
                  aria-label={`Level ${l}`}
                  onClick={() => setLevel(l)}
                  className="display min-h-[44px] rounded-lg border text-[17px] font-semibold transition-all duration-150 active:scale-[0.96]"
                  style={{
                    borderColor: active ? 'var(--ink)' : 'var(--rule)',
                    backgroundColor: active ? 'var(--ink)' : 'var(--surface-2)',
                    color: active ? 'var(--paper)' : 'var(--ink-2)',
                  }}
                >
                  {l}
                </button>
              );
            })}
          </div>

          <div className="mt-1.5 grid grid-cols-5 gap-1.5" role="group" aria-label="Trump suit">
            {STRAIN_ORDER.map((s) => {
              const active = strain === s;
              const red = isRedSuit(s);
              return (
                <button
                  key={s}
                  type="button"
                  aria-pressed={active}
                  aria-label={STRAIN_NAME[s]}
                  onClick={() => setStrain(s)}
                  className={cx(
                    'min-h-[46px] rounded-lg border transition-all duration-150 active:scale-[0.96]',
                    s === 'NT' ? 'text-[15px] font-bold' : 'text-[21px] leading-none',
                  )}
                  style={{
                    borderColor: active ? 'var(--ink)' : 'var(--rule)',
                    backgroundColor: active ? 'var(--ink)' : 'var(--surface-2)',
                    color: active
                      ? red
                        ? 'var(--red)'
                        : 'var(--paper)'
                      : red
                        ? 'var(--red)'
                        : 'var(--ink-2)',
                  }}
                >
                  {STRAIN_LABEL[s]}
                </button>
              );
            })}
          </div>

          {rules.doubles && (
            <div className="mt-1.5 grid grid-cols-2 gap-1.5" role="group" aria-label="Doubling">
              {(
                [
                  ['doubled', 'Doubled', 'X'],
                  ['redoubled', 'Redoubled', 'XX'],
                ] as [Risk, string, string][]
              ).map(([value, label, short]) => {
                const active = risk === value;
                return (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={active}
                    aria-label={label}
                    onClick={() => setRisk(active ? 'none' : value)}
                    className="min-h-[40px] rounded-lg border text-[13px] font-bold tracking-wide transition-all duration-150 active:scale-[0.98]"
                    style={{
                      borderColor: active ? 'var(--red)' : 'var(--rule)',
                      backgroundColor: active ? 'var(--red)' : 'var(--surface-2)',
                      color: active ? '#fff' : 'var(--ink-3)',
                    }}
                  >
                    {short} <span className="font-medium">{label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Tricks */}
        <div>
          <div className="mb-2 flex items-baseline justify-between gap-2">
            <span className="label">
              Tricks won{declarer ? ` by ${teamName(teams, declarer)}` : ''}
            </span>
            {needed !== null && (
              <span className="tnum text-[11.5px] text-ink-3">needs {needed}</span>
            )}
          </div>
          <div className="grid grid-cols-7 gap-1.5" role="group" aria-label="Tricks won">
            {Array.from({ length: 14 }, (_, t) => {
              const active = tricksWon === t;
              const delta = needed === null ? null : resultDelta(t, needed);
              const made = needed !== null && t >= needed;
              const deltaColor =
                needed === null
                  ? 'var(--ink-3)'
                  : made
                    ? 'var(--green)'
                    : 'var(--red)';
              return (
                <button
                  key={t}
                  type="button"
                  aria-pressed={active}
                  aria-label={
                    delta
                      ? `${trickWord(t)}, ${
                          delta === '='
                            ? 'contract made exactly'
                            : made
                              ? `${delta} overtricks`
                              : `down ${Math.abs(t - (needed ?? 0))}`
                        }`
                      : trickWord(t)
                  }
                  onClick={() => setTricksWon(t)}
                  className="flex min-h-[46px] flex-col items-center justify-center rounded-lg border transition-all duration-150 active:scale-[0.96]"
                  style={{
                    borderColor: active ? 'var(--ink)' : 'var(--rule)',
                    backgroundColor: active ? 'var(--ink)' : 'var(--surface-2)',
                    color: active ? 'var(--paper)' : 'var(--ink-2)',
                  }}
                >
                  <span className="display tnum text-[16px] font-semibold leading-none">{t}</span>
                  <span
                    className="tnum mt-[3px] text-[9.5px] font-bold leading-none"
                    style={{ color: active ? 'var(--paper)' : deltaColor }}
                  >
                    {delta ?? ' '}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Honours */}
        {rules.honours && rules.mode === 'rubber' && (
          <div>
            <span className="label mb-2 block">Honours held in one hand</span>
            <div className="flex flex-wrap gap-1.5">
              <HonourChip
                label="None"
                active={honours === null}
                onClick={() => setHonours(null)}
              />
              {(['A', 'B'] as TeamId[]).map((team) =>
                ([100, 150] as const).map((value) => (
                  <HonourChip
                    key={`${team}-${value}`}
                    label={`${teamName(teams, team)} ${value}`}
                    active={honours?.team === team && honours.value === value}
                    onClick={() => setHonours({ team, value })}
                  />
                )),
              )}
            </div>
            <p className="mt-1.5 text-[11.5px] leading-relaxed text-ink-3">
              100 for four of the five trump honours, 150 for all five — or for all four
              aces in a No Trump contract.
            </p>
          </div>
        )}
      </div>

      {/* Preview + commit */}
      <div className="border-t" style={{ borderColor: 'var(--rule)' }}>
        {preview && winner && (
          <div
            className="flex items-center justify-between gap-3 px-4 py-3"
            style={{ backgroundColor: 'var(--surface-2)' }}
            aria-live="polite"
          >
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold text-ink">
                {preview.headline}
              </p>
              <button
                type="button"
                onClick={() => setShowExplain((v) => !v)}
                className="mt-0.5 text-[11.5px] font-medium underline decoration-dotted underline-offset-2 text-ink-3 transition-colors hover:text-ink-2"
                aria-expanded={showExplain}
              >
                {showExplain ? 'Hide the maths' : 'Show how this scores'}
              </button>
            </div>
            <div className="shrink-0 text-right">
              <div
                className="display tnum text-[24px] font-semibold leading-none"
                style={{ color: preview.outcome === 'set' ? 'var(--red)' : 'var(--green)' }}
              >
                +{Math.max(preview.A.total, preview.B.total)}
              </div>
              <div className="mt-0.5 truncate text-[11px] font-semibold text-ink-3">
                {teamName(teams, winner)}
              </div>
            </div>
          </div>
        )}

        {preview && showExplain && (
          <div className="border-t px-4 py-3" style={{ borderColor: 'var(--rule)' }}>
            <ExplainList score={preview} teams={teams} showLine={rules.mode === 'rubber'} />
          </div>
        )}

        <div className="flex items-center gap-2 p-3">
          {editing && onCancelEdit && (
            <button
              type="button"
              onClick={onCancelEdit}
              className="min-h-[48px] rounded-xl border px-4 text-[14px] font-semibold text-ink-2 transition-colors"
              style={{ borderColor: 'var(--rule)' }}
            >
              Cancel
            </button>
          )}
          <button
            type="button"
            onClick={submit}
            disabled={!complete}
            className="min-h-[48px] flex-1 rounded-xl px-4 text-[15px] font-semibold tracking-tight transition-all duration-150 active:scale-[0.99] disabled:cursor-not-allowed"
            style={{
              backgroundColor: complete ? 'var(--ink)' : 'var(--surface-3)',
              color: complete ? 'var(--paper)' : 'var(--ink-3)',
            }}
          >
            {ctaLabel}
          </button>
        </div>

        {!editing && (
          <div className="px-3 pb-3">
            <button
              type="button"
              onClick={passOut}
              className="w-full rounded-lg py-2 text-[12.5px] font-medium text-ink-3 underline decoration-dotted underline-offset-4 transition-colors hover:text-ink-2"
            >
              All four passed — record a passed-out deal
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

function HonourChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className="rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors"
      style={{
        borderColor: active ? 'var(--brass)' : 'var(--rule)',
        backgroundColor: active ? 'var(--brass-soft)' : 'transparent',
        color: active ? 'var(--brass-ink)' : 'var(--ink-2)',
      }}
    >
      {label}
    </button>
  );
}
