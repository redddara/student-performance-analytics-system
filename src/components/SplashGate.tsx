import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { AppSplashScreen } from './AppSplashScreen';
import {
  INTRO_MIN_DURATION_MS,
  markIntroSeenThisSession,
  shouldPlayIntro,
} from '../lib/introSplash';

type SplashPhase = 'splash' | 'exiting' | 'done';

interface SplashGateProps {
  children: ReactNode;
}

export function SplashGate({ children }: SplashGateProps) {
  const playIntro = shouldPlayIntro();
  const [phase, setPhase] = useState<SplashPhase>(playIntro ? 'splash' : 'done');

  useEffect(() => {
    if (!playIntro) return;
    const t = window.setTimeout(() => setPhase('exiting'), INTRO_MIN_DURATION_MS);
    return () => window.clearTimeout(t);
  }, [playIntro]);

  const handleExitComplete = useCallback(() => {
    markIntroSeenThisSession();
    setPhase('done');
  }, []);

  const showSplash = phase === 'splash' || phase === 'exiting';
  const showApp = phase === 'exiting' || phase === 'done';

  return (
    <>
      {showApp ? children : null}
      {showSplash ? (
        <AppSplashScreen exiting={phase === 'exiting'} onExitComplete={handleExitComplete} />
      ) : null}
    </>
  );
}
