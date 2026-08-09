import { useState } from 'react';
import { Sheet } from './Sheet';
import { AthleteMark } from './AthleteMark';
import { CheckIcon, PlusSquareIcon, ShareIcon } from './Icons';
import type { useInstallPrompt } from '../hooks/useInstallPrompt';

interface Props {
  open: boolean;
  onClose: () => void;
  install: ReturnType<typeof useInstallPrompt>;
}

/**
 * Walks the user through installing the app. Chrome/Edge/Android get a real
 * "Install" button that drives the native prompt; iOS Safari has no such API,
 * so it gets the manual Share → Add to Home Screen steps instead.
 */
export function InstallSheet({ open, onClose, install }: Props) {
  const [result, setResult] = useState<'accepted' | 'dismissed' | null>(null);

  const handleInstall = async () => {
    const outcome = await install.promptInstall();
    if (outcome === 'accepted' || outcome === 'dismissed') {
      setResult(outcome);
      if (outcome === 'accepted') {
        window.setTimeout(onClose, 1400);
      }
    }
  };

  return (
    <Sheet open={open} title="Install Bridge Scorer" onClose={onClose}>
      <div className="flex flex-col items-center pb-1 pt-2 text-center">
        <div
          className="flex h-16 w-16 items-center justify-center rounded-[18px] border"
          style={{ borderColor: 'var(--rule)', backgroundColor: 'var(--surface-2)' }}
        >
          <AthleteMark className="h-9 w-9" color="var(--brass)" />
        </div>
        <p className="mt-3 text-[13.5px] leading-relaxed text-ink-2">
          Add it to your home screen for one tap access at the table — it opens straight
          to the scorecard, no browser bar, and keeps working without a connection.
        </p>
      </div>

      {result === 'accepted' ? (
        <div
          className="mt-4 flex items-center gap-2.5 rounded-xl px-4 py-3.5"
          style={{ backgroundColor: 'var(--green-soft)', color: 'var(--green)' }}
        >
          <CheckIcon />
          <span className="text-[13.5px] font-semibold">
            Installed — look for it on your home screen.
          </span>
        </div>
      ) : install.canPromptInstall ? (
        <button
          type="button"
          onClick={handleInstall}
          className="mt-4 min-h-[48px] w-full rounded-xl text-[15px] font-semibold"
          style={{ backgroundColor: 'var(--ink)', color: 'var(--paper)' }}
        >
          Install app
        </button>
      ) : install.isIOS ? (
        <ol className="mt-4 space-y-3">
          <Step
            icon={<ShareIcon />}
            text={
              <>
                Tap the <strong>Share</strong> icon in Safari's toolbar
              </>
            }
          />
          <Step
            icon={<PlusSquareIcon />}
            text={
              <>
                Scroll down and choose <strong>Add to Home Screen</strong>
              </>
            }
          />
          <Step icon={<CheckIcon />} text="Tap Add — the icon will appear on your home screen" />
        </ol>
      ) : (
        <div
          className="mt-4 rounded-xl px-4 py-3.5 text-[13px] leading-relaxed text-ink-2"
          style={{ backgroundColor: 'var(--surface-2)' }}
        >
          Open your browser's menu and look for <strong>Install app</strong> or{' '}
          <strong>Add to Home screen</strong>.
        </div>
      )}
    </Sheet>
  );
}

function Step({ icon, text }: { icon: React.ReactNode; text: React.ReactNode }) {
  return (
    <li className="flex items-center gap-3">
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
        style={{ backgroundColor: 'var(--brass-soft)', color: 'var(--brass-ink)' }}
      >
        {icon}
      </span>
      <span className="text-[13.5px] leading-snug text-ink-2">{text}</span>
    </li>
  );
}
