import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';

export type Ui = ReturnType<typeof userEvent.setup>;

export function renderApp() {
  const user = userEvent.setup();
  render(<App />);
  return user;
}

/** Fills the two team names, picks a preset, and enters the scoring screen. */
export async function startMatch(
  user: Ui,
  options: { a?: string; b?: string; preset?: string } = {},
) {
  const { a = 'Sharks', b = 'Owls', preset } = options;

  await user.clear(screen.getByLabelText('Side one'));
  await user.type(screen.getByLabelText('Side one'), a);
  await user.clear(screen.getByLabelText('Side two'));
  await user.type(screen.getByLabelText('Side two'), b);

  if (preset) {
    const label = screen.getByText(preset, { selector: 'span' });
    const button = label.closest('button');
    if (!button) throw new Error(`No preset button found for "${preset}"`);
    await user.click(button);
  }

  await user.click(screen.getByRole('button', { name: /start scoring/i }));
}

interface DealInput {
  by: string;
  level: number;
  strain: 'Clubs' | 'Diamonds' | 'Hearts' | 'Spades' | 'No Trump';
  tricks: number;
  risk?: 'Doubled' | 'Redoubled';
}

/** Enters and commits one deal through the real controls. */
export async function scoreDeal(user: Ui, input: DealInput) {
  const entry = screen.getByRole('region', { name: /new deal|edit deal/i });
  await user.click(within(entry).getByRole('button', { name: input.by }));
  await user.click(within(entry).getByRole('button', { name: `Level ${input.level}` }));
  await user.click(within(entry).getByRole('button', { name: input.strain }));
  if (input.risk) {
    await user.click(within(entry).getByRole('button', { name: input.risk }));
  }
  await user.click(
    within(entry).getByRole('button', { name: new RegExp(`^${input.tricks} tricks?,`) }),
  );
  await user.click(
    within(entry).getByRole('button', { name: /score this deal|save changes/i }),
  );
}

/** Reads a team's running total off the scoreboard. */
export function totalFor(team: string): number {
  const node = screen.getByLabelText(new RegExp(`^${team} total \\d`));
  const match = node.getAttribute('aria-label')?.match(/total ([\d,]+) points/);
  return match ? Number(match[1].replace(/,/g, '')) : Number.NaN;
}

export function scorecardRows() {
  const list = screen.getByRole('list', { name: '' });
  return within(list).queryAllByRole('listitem');
}
