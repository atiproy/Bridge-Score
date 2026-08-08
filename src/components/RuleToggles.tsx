import type { RuleSet, ScoringMode } from '../engine/types';
import { cx } from '../lib/format';

const MODES: { id: ScoringMode; name: string; blurb: string }[] = [
  { id: 'duplicate', name: 'Per deal', blurb: 'Settle each deal on its own' },
  { id: 'chicago', name: 'Chicago', blurb: 'Four-deal rounds' },
  { id: 'rubber', name: 'Rubber', blurb: 'Play to two games' },
];

interface ToggleDef {
  key: keyof Omit<RuleSet, 'mode'>;
  label: string;
  help: string;
  /** Only meaningful in these modes. */
  modes?: ScoringMode[];
}

const TOGGLES: ToggleDef[] = [
  {
    key: 'vulnerability',
    label: 'Vulnerability',
    help: 'Raises bonuses and penalties for a side that has already won a game.',
  },
  {
    key: 'doubles',
    label: 'Doubles and redoubles',
    help: 'Adds the X and XX buttons, multiplying trick scores and penalties.',
  },
  {
    key: 'slamBonuses',
    label: 'Slam bonuses',
    help: 'Extra points for bidding and making twelve or all thirteen tricks.',
  },
  {
    key: 'insultBonus',
    label: 'Bonus for making a doubled contract',
    help: 'The traditional 50 or 100 points “for the insult”.',
  },
  {
    key: 'honours',
    label: 'Honours',
    help: 'Rubber only. 100 or 150 for holding the top trumps in one hand.',
    modes: ['rubber'],
  },
];

interface Props {
  rules: RuleSet;
  onChange: (rules: RuleSet) => void;
}

export function RuleToggles({ rules, onChange }: Props) {
  return (
    <div className="card overflow-hidden">
      <div className="border-b p-4" style={{ borderColor: 'var(--rule)' }}>
        <span className="label mb-2.5 block">Scoring style</span>
        <div
          className="grid grid-cols-3 gap-1 rounded-lg p-1"
          style={{ backgroundColor: 'var(--surface-2)' }}
          role="radiogroup"
          aria-label="Scoring style"
        >
          {MODES.map((mode) => {
            const active = rules.mode === mode.id;
            return (
              <button
                key={mode.id}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => onChange({ ...rules, mode: mode.id })}
                className={cx(
                  'rounded-md px-2 py-2 text-[13px] font-semibold transition-colors',
                  active ? 'shadow-sm' : 'text-ink-2 hover:text-ink',
                )}
                style={
                  active
                    ? { backgroundColor: 'var(--surface)', color: 'var(--ink)' }
                    : undefined
                }
              >
                {mode.name}
                <span className="mt-0.5 block text-[10px] font-normal leading-tight text-ink-3">
                  {mode.blurb}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <ul className="divide-y" style={{ borderColor: 'var(--rule)' }}>
        {TOGGLES.map((toggle) => {
          const applicable = !toggle.modes || toggle.modes.includes(rules.mode);
          const checked = rules[toggle.key] && applicable;
          return (
            <li
              key={toggle.key}
              className={cx('flex items-start gap-3 p-4', !applicable && 'opacity-45')}
              style={{ borderColor: 'var(--rule)' }}
            >
              <div className="min-w-0 flex-1">
                <label
                  htmlFor={`rule-${toggle.key}`}
                  className="block text-[14px] font-semibold text-ink"
                >
                  {toggle.label}
                </label>
                <p className="mt-0.5 text-[12.5px] leading-relaxed text-ink-3">
                  {applicable ? toggle.help : 'Not used by the current scoring style.'}
                </p>
              </div>
              <button
                id={`rule-${toggle.key}`}
                type="button"
                role="switch"
                aria-checked={Boolean(checked)}
                disabled={!applicable}
                onClick={() => onChange({ ...rules, [toggle.key]: !rules[toggle.key] })}
                className="relative mt-0.5 h-[26px] w-[46px] shrink-0 rounded-full transition-colors duration-200 disabled:cursor-not-allowed"
                style={{
                  backgroundColor: checked ? 'var(--brass)' : 'var(--surface-3)',
                }}
              >
                <span
                  className="absolute top-[3px] h-5 w-5 rounded-full transition-all duration-200"
                  style={{
                    left: checked ? '23px' : '3px',
                    backgroundColor: checked ? 'var(--surface)' : 'var(--ink-3)',
                  }}
                />
                <span className="sr-only">{toggle.label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
