import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InstallControl } from './InstallControl';
import { InstallCallout } from './InstallCallout';

function mockMatchMedia(standalone: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: query.includes('display-mode: standalone') && standalone,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
}

function fireBeforeInstallPrompt(outcome: 'accepted' | 'dismissed' = 'accepted') {
  const promptImpl = vi.fn().mockResolvedValue(undefined);
  const event = new Event('beforeinstallprompt', { cancelable: true }) as Event & {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
  };
  event.prompt = promptImpl;
  event.userChoice = Promise.resolve({ outcome });
  act(() => {
    window.dispatchEvent(event);
  });
  return promptImpl;
}

const ORIGINAL_USER_AGENT = window.navigator.userAgent;

function setIOSUserAgent() {
  Object.defineProperty(window.navigator, 'userAgent', {
    value:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    configurable: true,
  });
}

describe('InstallControl', () => {
  afterEach(() => {
    mockMatchMedia(false);
    Object.defineProperty(window.navigator, 'userAgent', {
      value: ORIGINAL_USER_AGENT,
      configurable: true,
    });
  });

  it('renders nothing when the browser has not signalled installability', () => {
    mockMatchMedia(false);
    render(<InstallControl />);
    expect(screen.queryByRole('button', { name: /install this app/i })).not.toBeInTheDocument();
  });

  it('appears once beforeinstallprompt fires, and installs on click', async () => {
    mockMatchMedia(false);
    const user = userEvent.setup();
    render(<InstallControl />);

    const promptImpl = fireBeforeInstallPrompt('accepted');
    const button = await screen.findByRole('button', { name: /install this app/i });
    await user.click(button);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^install app$/i }));

    expect(promptImpl).toHaveBeenCalledTimes(1);
    expect(await screen.findByText(/installed — look for it/i)).toBeInTheDocument();
  });

  it('shows manual Share instructions on iOS instead of an install button', async () => {
    mockMatchMedia(false);
    setIOSUserAgent();
    const user = userEvent.setup();
    render(<InstallControl />);

    const button = await screen.findByRole('button', { name: /install this app/i });
    await user.click(button);

    expect(screen.getByText(/Add to Home Screen/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^install app$/i })).not.toBeInTheDocument();
  });
});

describe('InstallCallout', () => {
  afterEach(() => {
    mockMatchMedia(false);
    localStorage.clear();
  });

  it('stays hidden until the app is installable', () => {
    mockMatchMedia(false);
    render(<InstallCallout />);
    expect(screen.queryByText('Install this app')).not.toBeInTheDocument();
  });

  it('appears once installable and can be dismissed permanently', async () => {
    mockMatchMedia(false);
    const user = userEvent.setup();
    render(<InstallCallout />);
    fireBeforeInstallPrompt('dismissed');

    expect(await screen.findByText('Install this app')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /dismiss/i }));
    expect(screen.queryByText('Install this app')).not.toBeInTheDocument();
    expect(localStorage.getItem('bridge-scorer:install-dismissed')).toBe('1');
  });

  it('does not reappear on remount after being dismissed', () => {
    localStorage.setItem('bridge-scorer:install-dismissed', '1');
    mockMatchMedia(false);
    render(<InstallCallout />);
    fireBeforeInstallPrompt('dismissed');
    expect(screen.queryByText('Install this app')).not.toBeInTheDocument();
  });
});
