import { describe, expect, it, vi, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useInstallPrompt } from './useInstallPrompt';

function mockMatchMedia(standalone: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: query.includes('display-mode: standalone') && standalone,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
}

function fireBeforeInstallPrompt(promptImpl: () => Promise<void>, outcome: 'accepted' | 'dismissed') {
  const event = new Event('beforeinstallprompt', { cancelable: true }) as Event & {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
  };
  event.prompt = promptImpl;
  event.userChoice = Promise.resolve({ outcome });
  window.dispatchEvent(event);
  return event;
}

const ORIGINAL_USER_AGENT = window.navigator.userAgent;

describe('useInstallPrompt', () => {
  afterEach(() => {
    mockMatchMedia(false);
    Object.defineProperty(window.navigator, 'standalone', { value: undefined, configurable: true });
    Object.defineProperty(window.navigator, 'userAgent', {
      value: ORIGINAL_USER_AGENT,
      configurable: true,
    });
  });

  it('is not installable by default in a plain jsdom environment', () => {
    mockMatchMedia(false);
    const { result } = renderHook(() => useInstallPrompt());
    expect(result.current.isInstallable).toBe(false);
    expect(result.current.canPromptInstall).toBe(false);
  });

  it('reports standalone when the display-mode media query matches', () => {
    mockMatchMedia(true);
    const { result } = renderHook(() => useInstallPrompt());
    expect(result.current.isStandalone).toBe(true);
    expect(result.current.isInstallable).toBe(false);
  });

  it('reports standalone on iOS via navigator.standalone', () => {
    mockMatchMedia(false);
    Object.defineProperty(window.navigator, 'standalone', { value: true, configurable: true });
    const { result } = renderHook(() => useInstallPrompt());
    expect(result.current.isStandalone).toBe(true);
  });

  it('becomes installable once beforeinstallprompt fires, and can drive the native prompt', async () => {
    mockMatchMedia(false);
    const { result } = renderHook(() => useInstallPrompt());
    expect(result.current.canPromptInstall).toBe(false);

    const promptImpl = vi.fn().mockResolvedValue(undefined);
    act(() => {
      fireBeforeInstallPrompt(promptImpl, 'accepted');
    });

    expect(result.current.canPromptInstall).toBe(true);
    expect(result.current.isInstallable).toBe(true);

    let outcome: string | undefined;
    await act(async () => {
      outcome = await result.current.promptInstall();
    });

    expect(promptImpl).toHaveBeenCalledTimes(1);
    expect(outcome).toBe('accepted');
    // The deferred prompt is single-use; it clears after being consumed.
    expect(result.current.canPromptInstall).toBe(false);
  });

  it('marks itself standalone and drops the prompt when appinstalled fires', () => {
    mockMatchMedia(false);
    const { result } = renderHook(() => useInstallPrompt());

    act(() => {
      fireBeforeInstallPrompt(vi.fn(), 'accepted');
    });
    expect(result.current.canPromptInstall).toBe(true);

    act(() => {
      window.dispatchEvent(new Event('appinstalled'));
    });

    expect(result.current.isStandalone).toBe(true);
    expect(result.current.canPromptInstall).toBe(false);
    expect(result.current.isInstallable).toBe(false);
  });

  it('detects iOS from the user agent and treats it as installable without a native prompt', () => {
    mockMatchMedia(false);
    Object.defineProperty(window.navigator, 'userAgent', {
      value:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      configurable: true,
    });

    const { result } = renderHook(() => useInstallPrompt());
    expect(result.current.isIOS).toBe(true);
    expect(result.current.isInstallable).toBe(true);
    expect(result.current.canPromptInstall).toBe(false);
  });

  it('promptInstall resolves "unavailable" when there is nothing to prompt', async () => {
    mockMatchMedia(false);
    const { result } = renderHook(() => useInstallPrompt());
    const outcome = await result.current.promptInstall();
    expect(outcome).toBe('unavailable');
  });
});
