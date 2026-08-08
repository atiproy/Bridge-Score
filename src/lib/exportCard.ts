import { RISK_SUFFIX, STRAIN_LABEL } from '../engine/scoring';
import { unfinishedRubberSettlement } from '../engine/gameState';
import type { GameState, RuleSet, TeamId } from '../engine/types';
import type { TeamConfig } from '../store/matchReducer';
import { formatPoints, resultDelta, teamName } from './format';
import { MODE_LABEL } from '../engine/presets';

function padEnd(value: string, width: number): string {
  return value.length >= width ? value.slice(0, width) : value + ' '.repeat(width - value.length);
}

function padStart(value: string, width: number): string {
  return value.length >= width ? value.slice(-width) : ' '.repeat(width - value.length) + value;
}

/**
 * A plain-text scorecard. Text travels everywhere — WhatsApp, Messages, email —
 * without the recipient needing the app, which is what actually gets used.
 */
export function buildTextScorecard(
  game: GameState,
  teams: Record<TeamId, TeamConfig>,
  rules: RuleSet,
  options: { settleUnfinished?: boolean } = {},
): string {
  const nameA = teamName(teams, 'A');
  const nameB = teamName(teams, 'B');
  const colA = Math.max(nameA.length, 6);
  const colB = Math.max(nameB.length, 6);

  const lines: string[] = [];
  lines.push(`BRIDGE SCORECARD`);
  lines.push(
    `${nameA} ${formatPoints(game.totals.A)} — ${nameB} ${formatPoints(game.totals.B)}`,
  );
  lines.push(
    `${MODE_LABEL[rules.mode]} scoring · ${new Date().toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })}`,
  );
  lines.push('');

  const header =
    padEnd('#', 3) +
    padEnd('Contract', 10) +
    padEnd('By', 10) +
    padEnd('Result', 8) +
    padStart(nameA, colA) +
    '  ' +
    padStart(nameB, colB);
  lines.push(header);
  lines.push('-'.repeat(header.length));

  game.deals.forEach((row) => {
    const { deal, score } = row;
    const contract = deal.passedOut
      ? 'passed'
      : `${deal.level}${STRAIN_LABEL[deal.strain]}${rules.doubles ? RISK_SUFFIX[deal.risk] : ''}`;
    const by = deal.passedOut
      ? '—'
      : deal.declarerPlayer || teamName(teams, deal.declarer);
    const result = deal.passedOut
      ? '—'
      : resultDelta(deal.tricksWon, score.contractTricks);

    lines.push(
      padEnd(String(row.displayNumber), 3) +
        padEnd(contract, 10) +
        padEnd(by, 10) +
        padEnd(result, 8) +
        padStart(score.A.total > 0 ? formatPoints(score.A.total) : '—', colA) +
        '  ' +
        padStart(score.B.total > 0 ? formatPoints(score.B.total) : '—', colB),
    );
  });

  if (rules.mode === 'rubber') {
    game.rubbers
      .filter((r) => r.complete && r.bonusTeam)
      .forEach((r) => {
        lines.push(
          padEnd('', 3) +
            padEnd('rubber', 10) +
            padEnd(teamName(teams, r.bonusTeam as TeamId), 10) +
            padEnd('bonus', 8) +
            padStart(r.bonusTeam === 'A' ? formatPoints(r.bonus) : '—', colA) +
            '  ' +
            padStart(r.bonusTeam === 'B' ? formatPoints(r.bonus) : '—', colB),
        );
      });

    if (options.settleUnfinished) {
      unfinishedRubberSettlement(game.gamesWon, game.currentLeg).forEach((s) => {
        lines.push(
          padEnd('', 3) +
            padEnd('unfinished', 10) +
            padEnd(teamName(teams, s.team), 10) +
            padEnd('bonus', 8) +
            padStart(s.team === 'A' ? formatPoints(s.amount) : '—', colA) +
            '  ' +
            padStart(s.team === 'B' ? formatPoints(s.amount) : '—', colB),
        );
      });
    }
  }

  lines.push('-'.repeat(header.length));
  lines.push(
    padEnd('', 3) +
      padEnd('', 10) +
      padEnd('', 10) +
      padEnd('TOTAL', 8) +
      padStart(formatPoints(game.totals.A), colA) +
      '  ' +
      padStart(formatPoints(game.totals.B), colB),
  );
  lines.push('');

  const margin = Math.abs(game.totals.A - game.totals.B);
  if (margin === 0) {
    lines.push('Level pegging.');
  } else {
    const leader = game.totals.A > game.totals.B ? nameA : nameB;
    lines.push(`${leader} ahead by ${formatPoints(margin)}.`);
  }

  return lines.join('\n');
}

export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to the manual path */
  }
  try {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
}

export function downloadText(text: string, filename: string): void {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  // Give the browser a tick to start the download before revoking.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function canWebShare(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function';
}
