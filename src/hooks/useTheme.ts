import { useCallback, useEffect, useState } from 'react';
import { THEME_KEY } from '../store/persistence';

export type ThemeChoice = 'light' | 'dark' | 'system';
type Resolved = 'light' | 'dark';

function readStored(): ThemeChoice {
  try {
    const value = localStorage.getItem(THEME_KEY);
    if (value === 'light' || value === 'dark' || value === 'system') return value;
  } catch {
    /* private browsing */
  }
  return 'system';
}

function systemPrefersDark(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-color-scheme: dark)').matches
    : false;
}

function resolve(choice: ThemeChoice): Resolved {
  if (choice === 'system') return systemPrefersDark() ? 'dark' : 'light';
  return choice;
}

export function useTheme() {
  const [choice, setChoice] = useState<ThemeChoice>(readStored);
  const [resolved, setResolved] = useState<Resolved>(() => resolve(readStored()));

  useEffect(() => {
    const next = resolve(choice);
    setResolved(next);
    document.documentElement.setAttribute('data-theme', next);
    try {
      localStorage.setItem(THEME_KEY, choice);
    } catch {
      /* private browsing */
    }
  }, [choice]);

  // Follow the OS only while the user has not made an explicit choice.
  useEffect(() => {
    if (choice !== 'system') return;
    if (typeof window.matchMedia !== 'function') return;
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      const next: Resolved = query.matches ? 'dark' : 'light';
      setResolved(next);
      document.documentElement.setAttribute('data-theme', next);
    };
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, [choice]);

  const toggle = useCallback(() => {
    setChoice(resolve(choice) === 'dark' ? 'light' : 'dark');
  }, [choice]);

  return { choice, resolved, setChoice, toggle };
}
