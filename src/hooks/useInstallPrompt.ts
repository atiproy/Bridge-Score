import { useEffect, useState } from 'react';

/** The event Chrome/Edge/Android fire when the page qualifies as installable. */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function isStandaloneNow(): boolean {
  if (typeof window === 'undefined') return false;
  const displayModeStandalone =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(display-mode: standalone)').matches;
  // iOS Safari has no display-mode media query; it exposes this instead.
  const iosStandalone = (window.navigator as { standalone?: boolean }).standalone === true;
  return displayModeStandalone || iosStandalone;
}

function detectIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) return true;
  // iPadOS 13+ reports as "Macintosh" but is touch-capable, unlike a real Mac.
  return navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
}

/**
 * Surfaces whether this visit can be installed as an app, and how.
 *
 * Chrome/Edge/Android fire `beforeinstallprompt`, which lets us drive the
 * native install dialog directly. iOS Safari never fires it — there is no
 * programmatic install API there, only the manual Share → Add to Home Screen
 * flow — so callers need `isIOS` to show instructions instead of a button.
 */
export function useInstallPrompt() {
  const [deferredEvent, setDeferredEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(isStandaloneNow);
  const [isIOS] = useState(detectIOS);

  useEffect(() => {
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredEvent(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setDeferredEvent(null);
      setIsStandalone(true);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const canPromptInstall = deferredEvent !== null && !isStandalone;
  // iOS is always a manual install, so "installable" as far as the UI cares
  // covers both the native-prompt case and the instructions-only case.
  const isInstallable = !isStandalone && (canPromptInstall || isIOS);

  const promptInstall = async (): Promise<'accepted' | 'dismissed' | 'unavailable'> => {
    if (!deferredEvent) return 'unavailable';
    await deferredEvent.prompt();
    const choice = await deferredEvent.userChoice;
    setDeferredEvent(null);
    return choice.outcome;
  };

  return { isInstallable, canPromptInstall, isIOS, isStandalone, promptInstall };
}
