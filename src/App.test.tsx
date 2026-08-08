import { describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderApp, scoreDeal, startMatch, totalFor } from './test/helpers';

describe('starting a match', () => {
  it('asks for two names and moves to the scorecard', async () => {
    const user = renderApp();
    expect(screen.getByRole('heading', { name: 'Bridge Scorer' })).toBeInTheDocument();

    await startMatch(user);

    expect(screen.getByRole('heading', { name: 'Sharks' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Owls' })).toBeInTheDocument();
    expect(totalFor('Sharks')).toBe(0);
    expect(totalFor('Owls')).toBe(0);
  });

  it('falls back to We and They when no names are given', async () => {
    const user = renderApp();
    await user.click(screen.getByRole('button', { name: /start scoring/i }));
    expect(screen.getByRole('heading', { name: 'We' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'They' })).toBeInTheDocument();
  });

  it('guides the user through the entry order', async () => {
    const user = renderApp();
    await startMatch(user);
    const entry = screen.getByRole('region', { name: /new deal/i });

    expect(within(entry).getByRole('button', { name: 'Who declared?' })).toBeDisabled();
    await user.click(within(entry).getByRole('button', { name: 'Sharks' }));
    expect(
      within(entry).getByRole('button', { name: 'What was the contract?' }),
    ).toBeInTheDocument();

    await user.click(within(entry).getByRole('button', { name: 'Level 4' }));
    await user.click(within(entry).getByRole('button', { name: 'Hearts' }));
    expect(
      within(entry).getByRole('button', {
        name: 'How many tricks did Sharks win?',
      }),
    ).toBeInTheDocument();

    await user.click(within(entry).getByRole('button', { name: /^10 tricks, contract made/ }));
    expect(within(entry).getByRole('button', { name: 'Score this deal' })).toBeEnabled();
  });
});

describe('scoring deals', () => {
  it('scores a made game to the declaring side', async () => {
    const user = renderApp();
    await startMatch(user);
    await scoreDeal(user, { by: 'Sharks', level: 4, strain: 'Hearts', tricks: 10 });

    expect(totalFor('Sharks')).toBe(420);
    expect(totalFor('Owls')).toBe(0);
  });

  it('pays a failed contract to the defenders', async () => {
    const user = renderApp();
    await startMatch(user);
    await scoreDeal(user, { by: 'Sharks', level: 4, strain: 'Hearts', tricks: 8 });

    expect(totalFor('Sharks')).toBe(0);
    expect(totalFor('Owls')).toBe(100);
  });

  it('applies doubling', async () => {
    const user = renderApp();
    await startMatch(user);
    await scoreDeal(user, {
      by: 'Sharks',
      level: 2,
      strain: 'Spades',
      tricks: 8,
      risk: 'Doubled',
    });
    // 60 doubled = 120, which is game: 120 + 300 + 50 insult.
    expect(totalFor('Sharks')).toBe(470);
  });

  it('accumulates across several deals', async () => {
    const user = renderApp();
    await startMatch(user);
    await scoreDeal(user, { by: 'Sharks', level: 4, strain: 'Hearts', tricks: 10 });
    await scoreDeal(user, { by: 'Owls', level: 3, strain: 'No Trump', tricks: 9 });
    await scoreDeal(user, { by: 'Sharks', level: 2, strain: 'Clubs', tricks: 6 });

    // Deal 2 is board 2, where side A is vulnerable — Owls are not, so 400.
    // Deal 3: Sharks vulnerable on board 3? Board 3 is B only, so Sharks pay 50 x 2.
    expect(totalFor('Sharks')).toBe(420);
    expect(totalFor('Owls')).toBe(500);
  });

  it('resets the form after each deal', async () => {
    const user = renderApp();
    await startMatch(user);
    await scoreDeal(user, { by: 'Sharks', level: 4, strain: 'Hearts', tricks: 10 });

    const entry = screen.getByRole('region', { name: /new deal/i });
    expect(within(entry).getByText('Deal 2')).toBeInTheDocument();
    expect(within(entry).getByRole('button', { name: 'Who declared?' })).toBeDisabled();
    expect(within(entry).getByRole('button', { name: 'Sharks' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('records a passed-out deal', async () => {
    const user = renderApp();
    await startMatch(user);
    await user.click(screen.getByRole('button', { name: /all four passed/i }));

    expect(totalFor('Sharks')).toBe(0);
    expect(screen.getByText('Passed out')).toBeInTheDocument();
  });
});

describe('the explanation', () => {
  it('breaks the points down before the deal is committed', async () => {
    const user = renderApp();
    await startMatch(user);
    const entry = screen.getByRole('region', { name: /new deal/i });

    await user.click(within(entry).getByRole('button', { name: 'Sharks' }));
    await user.click(within(entry).getByRole('button', { name: 'Level 4' }));
    await user.click(within(entry).getByRole('button', { name: 'Hearts' }));
    await user.click(within(entry).getByRole('button', { name: /^11 tricks/ }));
    await user.click(within(entry).getByRole('button', { name: /show how this scores/i }));

    expect(within(entry).getByText(/Contract made: 4♥/)).toBeInTheDocument();
    expect(within(entry).getByText('4 x 30 = 120')).toBeInTheDocument();
    expect(within(entry).getByText(/Overtrick \(\+1\)/)).toBeInTheDocument();
    expect(within(entry).getByText(/Game bonus/)).toBeInTheDocument();
  });

  it('explains a past deal when its row is opened', async () => {
    const user = renderApp();
    await startMatch(user);
    await scoreDeal(user, {
      by: 'Sharks',
      level: 4,
      strain: 'Hearts',
      tricks: 8,
      risk: 'Doubled',
    });

    await user.click(screen.getByRole('button', { expanded: false, name: /4♥/ }));
    expect(screen.getByText(/Contract failed: 4♥ X down 2/)).toBeInTheDocument();
    expect(screen.getByText(/100 \+ 200 = 300/)).toBeInTheDocument();
  });
});

describe('editing history', () => {
  it('undoes and redoes a deal', async () => {
    const user = renderApp();
    await startMatch(user);
    await scoreDeal(user, { by: 'Sharks', level: 4, strain: 'Hearts', tricks: 10 });
    expect(totalFor('Sharks')).toBe(420);

    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(totalFor('Sharks')).toBe(0);

    await user.click(screen.getByRole('button', { name: 'Redo' }));
    expect(totalFor('Sharks')).toBe(420);
  });

  it('disables undo when there is nothing to undo', async () => {
    const user = renderApp();
    await startMatch(user);
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Redo' })).toBeDisabled();
  });

  it('edits a past deal and re-scores the match', async () => {
    const user = renderApp();
    await startMatch(user);
    await scoreDeal(user, { by: 'Sharks', level: 4, strain: 'Hearts', tricks: 10 });

    await user.click(screen.getByRole('button', { expanded: false, name: /4♥/ }));
    await user.click(screen.getByRole('button', { name: /^edit$/i }));

    const entry = screen.getByRole('region', { name: /edit deal/i });
    await user.click(within(entry).getByRole('button', { name: /^9 tricks/ }));
    await user.click(within(entry).getByRole('button', { name: /save changes/i }));

    expect(totalFor('Sharks')).toBe(0);
    expect(totalFor('Owls')).toBe(50);
  });

  it('deletes a deal behind a confirmation', async () => {
    const user = renderApp();
    await startMatch(user);
    await scoreDeal(user, { by: 'Sharks', level: 4, strain: 'Hearts', tricks: 10 });

    await user.click(screen.getByRole('button', { expanded: false, name: /4♥/ }));
    await user.click(screen.getByRole('button', { name: /^delete$/i }));
    // Nothing is gone until the second, explicit confirmation.
    expect(totalFor('Sharks')).toBe(420);

    await user.click(screen.getByRole('button', { name: /delete this deal/i }));
    expect(totalFor('Sharks')).toBe(0);
    expect(screen.getByText('No deals yet')).toBeInTheDocument();
  });

  it('can back out of a delete', async () => {
    const user = renderApp();
    await startMatch(user);
    await scoreDeal(user, { by: 'Sharks', level: 4, strain: 'Hearts', tricks: 10 });

    await user.click(screen.getByRole('button', { expanded: false, name: /4♥/ }));
    await user.click(screen.getByRole('button', { name: /^delete$/i }));
    await user.click(screen.getByRole('button', { name: /^keep$/i }));
    expect(totalFor('Sharks')).toBe(420);
  });

  it('cancels an edit without changing anything', async () => {
    const user = renderApp();
    await startMatch(user);
    await scoreDeal(user, { by: 'Sharks', level: 4, strain: 'Hearts', tricks: 10 });

    await user.click(screen.getByRole('button', { expanded: false, name: /4♥/ }));
    await user.click(screen.getByRole('button', { name: /^edit$/i }));
    await user.click(screen.getByRole('button', { name: /^cancel$/i }));

    expect(totalFor('Sharks')).toBe(420);
    expect(screen.getByRole('region', { name: /new deal/i })).toBeInTheDocument();
  });

  it('supports the keyboard undo shortcut', async () => {
    const user = renderApp();
    await startMatch(user);
    await scoreDeal(user, { by: 'Sharks', level: 4, strain: 'Hearts', tricks: 10 });

    await user.keyboard('{Control>}z{/Control}');
    expect(totalFor('Sharks')).toBe(0);

    await user.keyboard('{Control>}{Shift>}z{/Shift}{/Control}');
    expect(totalFor('Sharks')).toBe(420);
  });
});

describe('rule presets', () => {
  it('hides doubling in the Casual preset', async () => {
    const user = renderApp();
    await startMatch(user, { preset: 'Casual' });
    expect(screen.queryByRole('button', { name: 'Doubled' })).not.toBeInTheDocument();
    expect(screen.getByText('No vulnerability')).toBeInTheDocument();
  });

  it('shows honours only in the full Rubber laws', async () => {
    const user = renderApp();
    await startMatch(user, { preset: 'Rubber — full laws' });
    expect(screen.getByText(/honours held in one hand/i)).toBeInTheDocument();
  });

  it('omits honours from plain Rubber', async () => {
    const user = renderApp();
    await startMatch(user, { preset: 'Rubber' });
    expect(screen.queryByText(/honours held in one hand/i)).not.toBeInTheDocument();
  });

  it('plays out a full two-nil rubber', async () => {
    const user = renderApp();
    await startMatch(user, { preset: 'Rubber' });

    await scoreDeal(user, { by: 'Sharks', level: 4, strain: 'Hearts', tricks: 10 });
    expect(totalFor('Sharks')).toBe(120);
    expect(screen.getByText('Sharks vulnerable')).toBeInTheDocument();

    await scoreDeal(user, { by: 'Sharks', level: 4, strain: 'Hearts', tricks: 10 });
    expect(totalFor('Sharks')).toBe(940);
    expect(screen.getByText('Sharks take the rubber')).toBeInTheDocument();
  });

  it('tracks a part score toward game in Rubber', async () => {
    const user = renderApp();
    await startMatch(user, { preset: 'Rubber' });
    await scoreDeal(user, { by: 'Sharks', level: 2, strain: 'Spades', tricks: 8 });
    expect(screen.getByText('60 toward game')).toBeInTheDocument();
  });

  it('re-scores the whole card when the rules change mid-match', async () => {
    const user = renderApp();
    await startMatch(user);
    await scoreDeal(user, { by: 'Sharks', level: 4, strain: 'Hearts', tricks: 10 });
    expect(totalFor('Sharks')).toBe(420);

    await user.click(screen.getByRole('button', { name: /rules and match settings/i }));
    await user.click(within(screen.getByRole('dialog')).getByRole('radio', { name: /Rubber/ }));
    await user.click(screen.getByRole('button', { name: /close/i }));

    // Rubber pays no per-deal game bonus, so the same deal is worth 120.
    expect(totalFor('Sharks')).toBe(120);
  });
});

describe('persistence', () => {
  it('restores the match after a reload', async () => {
    const user = renderApp();
    await startMatch(user);
    await scoreDeal(user, { by: 'Sharks', level: 4, strain: 'Hearts', tricks: 10 });

    // Remount from scratch, as a page reload would.
    const fresh = renderApp();
    expect(fresh).toBeDefined();
    const totals = screen.getAllByLabelText(/^Sharks total \d/);
    expect(totals.length).toBeGreaterThan(0);
    expect(
      Number(
        totals[totals.length - 1]
          .getAttribute('aria-label')!
          .match(/total ([\d,]+)/)![1]
          .replace(/,/g, ''),
      ),
    ).toBe(420);
  });

  it('survives a corrupt saved match', async () => {
    localStorage.setItem('bridge-scorer:match:v1', '{ not json at all');
    const user = renderApp();
    expect(screen.getByRole('heading', { name: 'Bridge Scorer' })).toBeInTheDocument();
    await startMatch(user);
    expect(totalFor('Sharks')).toBe(0);
  });
});

describe('sharing', () => {
  it('builds a text scorecard', async () => {
    const user = renderApp();
    await startMatch(user);
    await scoreDeal(user, { by: 'Sharks', level: 4, strain: 'Hearts', tricks: 10 });

    await user.click(screen.getByRole('button', { name: /share the scorecard/i }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText(/BRIDGE SCORECARD/)).toBeInTheDocument();
    expect(within(dialog).getByText(/Sharks 420 — Owls 0/)).toBeInTheDocument();
    expect(within(dialog).getByText(/Sharks ahead by 420\./)).toBeInTheDocument();
  });

  it('closes the sheet on Escape', async () => {
    const user = renderApp();
    await startMatch(user);
    await user.click(screen.getByRole('button', { name: /share the scorecard/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('theme', () => {
  it('toggles between light and dark and remembers the choice', async () => {
    const user = renderApp();
    await user.click(screen.getByRole('button', { name: /switch to dark theme/i }));
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(localStorage.getItem('bridge-scorer:theme:v1')).toBe('dark');

    await user.click(screen.getByRole('button', { name: /switch to light theme/i }));
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });
});

describe('match management', () => {
  it('clears the scorecard but keeps the teams', async () => {
    const user = renderApp();
    await startMatch(user);
    await scoreDeal(user, { by: 'Sharks', level: 4, strain: 'Hearts', tricks: 10 });

    await user.click(screen.getByRole('button', { name: /rules and match settings/i }));
    await user.click(screen.getByRole('button', { name: /clear the scorecard/i }));

    expect(totalFor('Sharks')).toBe(0);
    expect(screen.getByRole('heading', { name: 'Sharks' })).toBeInTheDocument();
  });

  it('starts a completely new match', async () => {
    const user = renderApp();
    await startMatch(user);
    await scoreDeal(user, { by: 'Sharks', level: 4, strain: 'Hearts', tricks: 10 });

    await user.click(screen.getByRole('button', { name: /rules and match settings/i }));
    await user.click(screen.getByRole('button', { name: /start a completely new match/i }));

    expect(screen.getByRole('heading', { name: 'Bridge Scorer' })).toBeInTheDocument();
    expect(screen.getByLabelText('Side one')).toHaveValue('');
  });

  it('returns to setup to rename the teams, keeping the deals', async () => {
    const user = renderApp();
    await startMatch(user);
    await scoreDeal(user, { by: 'Sharks', level: 4, strain: 'Hearts', tricks: 10 });

    await user.click(screen.getByRole('button', { name: /edit names and rules/i }));
    const nameField = screen.getByLabelText('Side one');
    await userEvent.setup().clear(nameField);
    await user.type(nameField, 'Kestrels');
    await user.click(screen.getByRole('button', { name: /save and return/i }));

    expect(screen.getByRole('heading', { name: 'Kestrels' })).toBeInTheDocument();
    expect(totalFor('Kestrels')).toBe(420);
  });
});
