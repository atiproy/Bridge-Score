import type { GameState, RuleSet, TeamId } from '../engine/types';
import type { TeamConfig } from '../store/matchReducer';
import { cx, formatPoints, teamName } from '../lib/format';

interface Props {
  teams: Record<TeamId, TeamConfig>;
  game: GameState;
  rules: RuleSet;
}

/**
 * The scorepad head: two columns split by a rule down the middle, the way a
 * paper bridge card is laid out.
 */
export function ScoreHeader({ teams, game, rules }: Props) {
  const leader: TeamId | null =
    game.totals.A === game.totals.B ? null : game.totals.A > game.totals.B ? 'A' : 'B';

  return (
    <div className="card overflow-hidden">
      <div className="grid grid-cols-2">
        {(['A', 'B'] as TeamId[]).map((team, i) => {
          const vulnerable = rules.vulnerability && game.vulnerability[team];
          const isLeader = leader === team;
          return (
            <div
              key={team}
              className={cx('relative px-4 py-4', i === 1 && 'border-l')}
              style={{ borderColor: 'var(--rule-strong)' }}
            >
              <div className="flex min-h-[18px] items-center gap-1.5">
                <h2
                  className="truncate text-[12px] font-bold uppercase tracking-[0.09em] text-ink-2"
                  title={teamName(teams, team)}
                >
                  {teamName(teams, team)}
                </h2>
                {vulnerable && (
                  <span
                    className="shrink-0 rounded-[3px] px-1.5 py-[2px] text-[9px] font-bold uppercase tracking-[0.08em]"
                    style={{ backgroundColor: 'var(--red-soft)', color: 'var(--red)' }}
                    title="Vulnerable: bonuses and penalties are higher"
                  >
                    Vul
                  </span>
                )}
              </div>

              <div
                className="display tnum mt-1 text-[38px] font-semibold leading-none"
                style={{ color: isLeader ? 'var(--ink)' : 'var(--ink-2)' }}
                aria-label={`${teamName(teams, team)} total ${game.totals[team]} points`}
              >
                {formatPoints(game.totals[team])}
              </div>

              {teams[team].players.filter(Boolean).length > 0 && (
                <p className="mt-1 truncate text-[11.5px] text-ink-3">
                  {teams[team].players.filter(Boolean).join(' & ')}
                </p>
              )}

              {rules.mode === 'rubber' && (
                <div className="mt-2.5 flex items-center gap-2">
                  <div className="flex gap-1" title="Games won in this rubber">
                    {[0, 1].map((slot) => (
                      <span
                        key={slot}
                        className="h-[9px] w-[9px] rounded-full border"
                        style={{
                          borderColor:
                            game.gamesWon[team] > slot ? 'var(--brass)' : 'var(--rule-strong)',
                          backgroundColor:
                            game.gamesWon[team] > slot ? 'var(--brass)' : 'transparent',
                        }}
                      />
                    ))}
                  </div>
                  <span className="tnum text-[11px] text-ink-3">
                    {game.currentLeg[team] > 0
                      ? `${game.currentLeg[team]} toward game`
                      : `${game.gamesWon[team]} game${game.gamesWon[team] === 1 ? '' : 's'}`}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
