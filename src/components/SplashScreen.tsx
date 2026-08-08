import { useEffect, useState } from 'react';
import { AthleteMark } from './AthleteMark';

const HOLD_MS = 1250;
const EXIT_MS = 500;

interface Props {
  onDone: () => void;
}

/**
 * A brief, one-time intro animation shown before the app itself appears.
 * Purely additive: it sits on top of the already-mounted app and unmounts
 * itself, so it can never affect the app's own layout or state.
 */
export function SplashScreen({ onDone }: Props) {
  const [phase, setPhase] = useState<'enter' | 'hold' | 'exit'>('enter');

  useEffect(() => {
    const reduceMotion =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // A user who has asked for less motion shouldn't be held on a splash
    // screen whose whole point is the animation.
    if (reduceMotion) {
      onDone();
      return;
    }

    const toHold = requestAnimationFrame(() => setPhase('hold'));
    const toExit = window.setTimeout(() => setPhase('exit'), HOLD_MS);
    const finish = window.setTimeout(() => onDone(), HOLD_MS + EXIT_MS);
    return () => {
      cancelAnimationFrame(toHold);
      window.clearTimeout(toExit);
      window.clearTimeout(finish);
    };
  }, [onDone]);

  return (
    <div
      role="presentation"
      onClick={onDone}
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-5 transition-opacity ease-out"
      style={{
        backgroundColor: 'var(--paper)',
        opacity: phase === 'exit' ? 0 : 1,
        transitionDuration: `${EXIT_MS}ms`,
      }}
    >
      <div
        className="transition-all ease-out"
        style={{
          opacity: phase === 'enter' ? 0 : 1,
          transform: phase === 'enter' ? 'scale(0.82)' : 'scale(1)',
          transitionDuration: '650ms',
        }}
      >
        <AthleteMark className="h-16 w-16 sm:h-20 sm:w-20" color="var(--ink)" title="Athelite" />
      </div>
      <div
        className="flex flex-col items-center gap-1.5 transition-all ease-out"
        style={{
          opacity: phase === 'enter' ? 0 : 1,
          transform: phase === 'enter' ? 'translateY(6px)' : 'translateY(0)',
          transitionDuration: '550ms',
          transitionDelay: phase === 'enter' ? '0ms' : '120ms',
        }}
      >
        <span className="label" style={{ letterSpacing: '0.28em' }}>
          Athelite
        </span>
        <span className="display text-[22px] font-semibold text-ink">Bridge Scorer</span>
      </div>
    </div>
  );
}
