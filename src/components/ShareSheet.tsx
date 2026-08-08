import { useMemo, useState } from 'react';
import type { GameState, RuleSet, TeamId } from '../engine/types';
import type { TeamConfig } from '../store/matchReducer';
import { buildTextScorecard, canWebShare, copyText, downloadText } from '../lib/exportCard';
import { teamName } from '../lib/format';
import { CheckIcon } from './Icons';
import { Sheet } from './Sheet';

interface Props {
  open: boolean;
  onClose: () => void;
  game: GameState;
  teams: Record<TeamId, TeamConfig>;
  rules: RuleSet;
  settleUnfinished: boolean;
}

export function ShareSheet({ open, onClose, game, teams, rules, settleUnfinished }: Props) {
  const [copied, setCopied] = useState(false);

  const text = useMemo(
    () => buildTextScorecard(game, teams, rules, { settleUnfinished }),
    [game, teams, rules, settleUnfinished],
  );

  const filename = `bridge-${teamName(teams, 'A')}-v-${teamName(teams, 'B')}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .concat('.txt');

  const doCopy = async () => {
    const ok = await copyText(text);
    setCopied(ok);
    if (ok) setTimeout(() => setCopied(false), 2200);
  };

  const doShare = async () => {
    try {
      await navigator.share({ title: 'Bridge scorecard', text });
    } catch {
      // The user dismissed the share sheet, or sharing is unavailable.
    }
  };

  return (
    <Sheet open={open} title="Share the scorecard" onClose={onClose}>
      <p className="mb-3 text-[13px] leading-relaxed text-ink-2">
        A plain-text card that anyone can read — paste it into any chat, no app needed.
      </p>

      <pre
        className="tnum overflow-x-auto rounded-lg border p-3 text-[11.5px] leading-[1.55]"
        style={{
          borderColor: 'var(--rule)',
          backgroundColor: 'var(--surface-2)',
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
        }}
      >
        {text}
      </pre>

      <div className="mt-4 grid gap-2">
        <button
          type="button"
          onClick={doCopy}
          className="flex min-h-[48px] items-center justify-center gap-2 rounded-xl text-[15px] font-semibold"
          style={{ backgroundColor: 'var(--ink)', color: 'var(--paper)' }}
        >
          {copied ? (
            <>
              <CheckIcon /> Copied
            </>
          ) : (
            'Copy to clipboard'
          )}
        </button>

        {canWebShare() && (
          <button
            type="button"
            onClick={doShare}
            className="min-h-[48px] rounded-xl border text-[15px] font-semibold text-ink"
            style={{ borderColor: 'var(--rule-strong)' }}
          >
            Share…
          </button>
        )}

        <button
          type="button"
          onClick={() => downloadText(text, filename)}
          className="min-h-[48px] rounded-xl border text-[15px] font-semibold text-ink-2"
          style={{ borderColor: 'var(--rule)' }}
        >
          Download as a text file
        </button>
      </div>
    </Sheet>
  );
}
