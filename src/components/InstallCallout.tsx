import { useEffect, useState } from 'react';
import { useInstallPrompt } from '../hooks/useInstallPrompt';
import { AthleteMark } from './AthleteMark';
import { CloseIcon } from './Icons';
import { InstallSheet } from './InstallSheet';

const DISMISSED_KEY = 'bridge-scorer:install-dismissed';

/**
 * The visible, unmissable install prompt on the setup screen — this is the
 * thing to point someone at when telling them to install the app, as opposed
 * to the small header icon which is there for people who already know to
 * look for it.
 */
export function InstallCallout() {
  const install = useInstallPrompt();
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(DISMISSED_KEY) === '1';
    } catch {
      return false;
    }
  });

  // If the sheet reports a successful install mid-session, stop showing the banner.
  useEffect(() => {
    if (install.isStandalone) setDismissed(true);
  }, [install.isStandalone]);

  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISSED_KEY, '1');
    } catch {
      /* private browsing */
    }
  };

  // The banner itself hides once dismissed or no longer installable, but the
  // sheet stays mounted while `open` regardless — otherwise a just-completed
  // install's confirmation message would vanish the instant the browser
  // withdraws the (now one-time-used) install prompt.
  const showBanner = install.isInstallable && !dismissed;

  return (
    <>
      {showBanner && (
        <div
          className="card mb-6 flex items-center gap-3 px-4 py-3.5"
          style={{ borderColor: 'var(--brass)' }}
        >
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
            style={{ backgroundColor: 'var(--brass-soft)' }}
          >
            <AthleteMark className="h-6 w-6" color="var(--brass-ink)" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[13.5px] font-semibold text-ink">Install this app</p>
            <p className="text-[12px] leading-snug text-ink-3">
              One tap from your home screen — no browser bar, works offline.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="shrink-0 rounded-lg px-3 py-2 text-[13px] font-semibold"
            style={{ backgroundColor: 'var(--ink)', color: 'var(--paper)' }}
          >
            Install
          </button>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Dismiss"
            className="shrink-0 rounded-lg p-1.5 text-ink-3 transition-colors hover:text-ink"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>
      )}
      <InstallSheet open={open} onClose={() => setOpen(false)} install={install} />
    </>
  );
}
