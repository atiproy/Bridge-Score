import { useState } from 'react';
import { useTheme } from './hooks/useTheme';
import { MatchProvider, useMatch } from './store/MatchContext';
import { PlayScreen } from './components/PlayScreen';
import { SetupScreen } from './components/SetupScreen';
import { SplashScreen } from './components/SplashScreen';

function Shell() {
  const { state } = useMatch();
  const theme = useTheme();
  const [showSplash, setShowSplash] = useState(true);

  return (
    <div className="grain relative min-h-dvh">
      <div className="relative z-[1]">
        {state.phase === 'setup' ? (
          <SetupScreen theme={theme} />
        ) : (
          <PlayScreen theme={theme} />
        )}
      </div>
      {showSplash && <SplashScreen onDone={() => setShowSplash(false)} />}
    </div>
  );
}

export default function App() {
  return (
    <MatchProvider>
      <Shell />
    </MatchProvider>
  );
}
