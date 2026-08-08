import type { DealScore, TeamId } from '../engine/types';
import type { TeamConfig } from '../store/matchReducer';
import { formatPoints, teamName } from '../lib/format';

interface Props {
  score: DealScore;
  teams: Record<TeamId, TeamConfig>;
  /** Rubber shows which side of the line each entry falls on. */
  showLine?: boolean;
}

/** The point-by-point breakdown: what was earned, from which rule, and why. */
export function ExplainList({ score, teams, showLine = false }: Props) {
  if (score.lines.length === 0) {
    return (
      <p className="text-[13px] text-ink-3">
        Nobody scored on this deal.
      </p>
    );
  }

  return (
    <div>
      <ul className="space-y-2.5">
        {score.lines.map((line, i) => (
          <li key={`${line.label}-${i}`} className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-x-1.5">
                <span
                  className="text-[13px] font-semibold leading-snug"
                  style={{ color: line.emphasis ? 'var(--ink)' : 'var(--ink-2)' }}
                >
                  {line.label}
                </span>
                <span className="text-[11px] font-medium text-ink-3">
                  → {teamName(teams, line.team)}
                  {showLine && (
                    <span style={{ color: 'var(--brass)' }}>
                      {' '}
                      · {line.line === 'below' ? 'below the line' : 'above the line'}
                    </span>
                  )}
                </span>
              </div>
              {line.formula && (
                <p className="tnum mt-0.5 text-[12px] leading-relaxed text-ink-3">
                  {line.formula}
                </p>
              )}
            </div>
            <span
              className="tnum shrink-0 text-[14px] font-semibold tabular-nums"
              style={{ color: line.emphasis ? 'var(--ink)' : 'var(--ink-2)' }}
            >
              {formatPoints(line.points)}
            </span>
          </li>
        ))}
      </ul>

      <div
        className="mt-3 flex items-center justify-between border-t pt-2.5"
        style={{ borderColor: 'var(--rule)' }}
      >
        <span className="label">Deal total</span>
        <div className="flex items-center gap-4">
          {(['A', 'B'] as TeamId[]).map((team) => (
            <span key={team} className="text-[12.5px] text-ink-2">
              {teamName(teams, team)}{' '}
              <span
                className="tnum font-semibold"
                style={{ color: score[team].total > 0 ? 'var(--ink)' : 'var(--ink-3)' }}
              >
                {formatPoints(score[team].total)}
              </span>
            </span>
          ))}
        </div>
      </div>

      {score.warnings.length > 0 && (
        <ul className="mt-2.5 space-y-1">
          {score.warnings.map((w) => (
            <li key={w} className="text-[11.5px] leading-relaxed" style={{ color: 'var(--red)' }}>
              {w}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
