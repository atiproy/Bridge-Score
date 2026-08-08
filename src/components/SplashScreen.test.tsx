import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SplashScreen } from './SplashScreen';

describe('SplashScreen', () => {
  it('shows the Athelite mark immediately and calls onDone after the hold and exit', () => {
    vi.useFakeTimers();
    const onDone = vi.fn();
    render(<SplashScreen onDone={onDone} />);

    expect(screen.getByText('Athelite')).toBeInTheDocument();
    expect(screen.getByText('Bridge Scorer')).toBeInTheDocument();
    expect(onDone).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1250);
    expect(onDone).not.toHaveBeenCalled();

    vi.advanceTimersByTime(500);
    expect(onDone).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });

  it('skips the animation entirely when the user prefers reduced motion', () => {
    const original = window.matchMedia;
    window.matchMedia = ((query: string) => ({
      matches: query.includes('reduced-motion'),
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    })) as unknown as typeof window.matchMedia;

    const onDone = vi.fn();
    render(<SplashScreen onDone={onDone} />);
    expect(onDone).toHaveBeenCalledTimes(1);

    window.matchMedia = original;
  });
});
