import { useState } from 'react';
import { STRAIN_LABEL } from '../engine/scoring';
import type { RuleSet, ScoredDeal, TeamId } from '../engine/types';
import type { TeamConfig } from '../store/matchReducer';
import { cx, formatPoints, isRedSuit, resultDelta, teamName } from '../lib/format';
import { ExplainList } from './ExplainList';
import { PencilIcon, TrashIcon } from './Icons';

interface Props {
  deals: ScoredDeal[];
  teams: Record<TeamId, TeamConfig>;
  rules: RuleSet;
  onEdit: (deal: ScoredDeal) => void;
  onDelete: (id: string) => void;
}

export function Scorecard({ deals, teams, rules, onEdit, onDelete }: Props) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  if (deals.length === 0) {
    return (
      <div className="card px-5 py-10 text-center">
        <p className="display text-[18px] font-semibold text-ink-2">No deals yet</p>
        <p className="mx-auto mt-1.5 max-w-[34ch] text-[13px] leading-relaxed text-ink-3">
          Score your first deal above and it will appear here. Tap any row later to see
          exactly how its points were worked out.
        </p>
      </div>
    );
  }

  // Newest first: the deal you just entered is the one you want to check.
  const rows = [...deals].reverse();

  return (
    <div className="card overflow-hidden">
      <div
        className="grid grid-cols-[1fr_auto_auto] items-center gap-3 border-b px-4 py-2"
        style={{ borderColor: 'var(--rule)', backgroundColor: 'var(--surface-2)' }}
      >
        <span className="label">Scorecard</span>
        <span className="label w-[62px] text-right">{teamName(teams, 'A')}</span>
        <span className="label w-[62px] text-right">{teamName(teams, 'B')}</span>
      </div>

      <ul className="divide-y" style={{ borderColor: 'var(--rule)' }}>
        {rows.map((row) => {
          const open = openId === row.deal.id;
          const { deal, score } = row;
          const red = isRedSuit(deal.strain);
          const risk = rules.doubles ? deal.risk : 'none';

          return (
            <li key={deal.id} style={{ borderColor: 'var(--rule)' }}>
              <button
                type="button"
                onClick={() => {
                  setOpenId(open ? null : deal.id);
                  setConfirmId(null);
                }}
                aria-expanded={open}
                className="grid w-full grid-cols-[1fr_auto_auto] items-center gap-3 px-4 py-3 text-left transition-colors"
                style={open ? { backgroundColor: 'var(--surface-2)' } : undefined}
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="tnum w-5 shrink-0 text-[11px] font-semibold text-ink-3">
                    {row.displayNumber}
                  </span>

                  {deal.passedOut ? (
                    <span className="truncate text-[14px] font-medium italic text-ink-3">
                      Passed out
                    </span>
                  ) : (
                    <>
                      <span className="display flex shrink-0 items-baseline text-[16px] font-semibold">
                        <span className="tnum">{deal.level}</span>
                        <span style={{ color: red ? 'var(--red)' : 'var(--ink)' }}>
                          {STRAIN_LABEL[deal.strain]}
                        </span>
                        {risk !== 'none' && (
                          <span
                            className="ml-0.5 text-[11px] font-bold"
                            style={{ color: 'var(--red)' }}
                          >
                            {risk === 'doubled' ? 'X' : 'XX'}
                          </span>
                        )}
                      </span>

                      <span
                        className="tnum shrink-0 rounded px-1.5 py-0.5 text-[11px] font-bold"
                        style={{
                          backgroundColor:
                            score.outcome === 'made' ? 'var(--green-soft)' : 'var(--red-soft)',
                          color: score.outcome === 'made' ? 'var(--green)' : 'var(--red)',
                        }}
                      >
                        {resultDelta(deal.tricksWon, score.contractTricks)}
                      </span>

                      <span className="truncate text-[12px] text-ink-3">
                        {deal.declarerPlayer || teamName(teams, deal.declarer)}
                        {rules.vulnerability && row.vulnerability[deal.declarer] && (
                          <span style={{ color: 'var(--red)' }}> · vul</span>
                        )}
                      </span>
                    </>
                  )}
                </div>

                {(['A', 'B'] as TeamId[]).map((team) => (
                  <span
                    key={team}
                    className={cx('tnum w-[62px] text-right text-[15px]')}
                    style={{
                      color: score[team].total > 0 ? 'var(--ink)' : 'var(--ink-3)',
                      fontWeight: score[team].total > 0 ? 600 : 400,
                    }}
                  >
                    {score[team].total > 0 ? formatPoints(score[team].total) : '—'}
                  </span>
                ))}
              </button>

              {row.events.length > 0 && (
                <div className="flex flex-wrap gap-1.5 px-4 pb-2.5 pl-[46px]">
                  {row.events
                    .filter((e) => e.kind !== 'set')
                    .map((event, i) => (
                      <span
                        key={i}
                        className="rounded-full px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.06em]"
                        style={{
                          backgroundColor: 'var(--brass-soft)',
                          color: 'var(--brass-ink)',
                        }}
                      >
                        {teamName(teams, event.team)} · {event.message}
                      </span>
                    ))}
                </div>
              )}

              {open && (
                <div
                  className="border-t px-4 py-3.5"
                  style={{ borderColor: 'var(--rule)', backgroundColor: 'var(--surface-2)' }}
                >
                  <ExplainList
                    score={score}
                    teams={teams}
                    showLine={rules.mode === 'rubber'}
                  />

                  <div className="mt-3.5 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onEdit(row)}
                      className="flex min-h-[38px] items-center gap-1.5 rounded-lg border px-3 text-[13px] font-semibold text-ink-2 transition-colors"
                      style={{ borderColor: 'var(--rule-strong)' }}
                    >
                      <PencilIcon /> Edit
                    </button>

                    {confirmId === deal.id ? (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            onDelete(deal.id);
                            setConfirmId(null);
                            setOpenId(null);
                          }}
                          className="min-h-[38px] rounded-lg px-3 text-[13px] font-semibold text-white"
                          style={{ backgroundColor: 'var(--red)' }}
                        >
                          Delete this deal
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmId(null)}
                          className="min-h-[38px] px-2 text-[13px] font-medium text-ink-3"
                        >
                          Keep
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmId(deal.id)}
                        className="flex min-h-[38px] items-center gap-1.5 rounded-lg border px-3 text-[13px] font-semibold transition-colors"
                        style={{ borderColor: 'var(--rule-strong)', color: 'var(--red)' }}
                      >
                        <TrashIcon /> Delete
                      </button>
                    )}
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
