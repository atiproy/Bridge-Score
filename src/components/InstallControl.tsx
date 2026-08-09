import { useState } from 'react';
import { useInstallPrompt } from '../hooks/useInstallPrompt';
import { InstallIcon } from './Icons';
import { InstallSheet } from './InstallSheet';

/**
 * The header icon button that opens the install sheet.
 *
 * The trigger button hides once the app is no longer installable (already
 * installed, or the browser withdrew the prompt) — but the sheet itself stays
 * mounted while `open`, independent of that, so a just-completed install's
 * confirmation message isn't yanked away the instant `deferredEvent` clears.
 */
export function InstallControl() {
  const install = useInstallPrompt();
  const [open, setOpen] = useState(false);

  return (
    <>
      {install.isInstallable && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Install this app"
          title="Install this app"
          className="rounded-lg p-2.5 text-ink-2 transition-colors hover:text-ink"
        >
          <InstallIcon />
        </button>
      )}
      <InstallSheet open={open} onClose={() => setOpen(false)} install={install} />
    </>
  );
}
