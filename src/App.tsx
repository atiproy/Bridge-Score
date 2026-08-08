import { useTheme } from './hooks/useTheme';
import { MatchProvider, useMatch } from './store/MatchContext';
import { PlayScreen } from './components/PlayScreen';
import { SetupScreen } from './components/SetupScreen';

function Shell() {
  const { state } = useMatch();
  const theme = useTheme();

  return (
    <div className="grain relative min-h-dvh">
      <div className="relative z-[1]">
        {state.phase === 'setup' ? (
          <SetupScreen theme={theme} />
        ) : (
          <PlayScreen theme={theme} />
        )}
      </div>
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
