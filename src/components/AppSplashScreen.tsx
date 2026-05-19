import { useCallback, useEffect, useMemo, useState } from 'react';
import { BarChart3, GraduationCap, TrendingUp } from 'lucide-react';
import logoSpas from '../assets/LOGO SPAS.png';
import { INTRO_EXIT_DURATION_MS, INTRO_MIN_DURATION_MS } from '../lib/introSplash';

interface AppSplashScreenProps {
  exiting: boolean;
  onExitComplete: () => void;
}

const LOADING_STEPS = [
  { at: 0, label: 'Initializing analytics engine…' },
  { at: 26, label: 'Syncing academic records…' },
  { at: 52, label: 'Loading grade insights…' },
  { at: 78, label: 'Preparing dashboards…' },
  { at: 96, label: 'Ready — welcome to SPAS' },
] as const;

const CHART_PATH_LENGTH = 520;

const PARTICLES = Array.from({ length: 28 }, (_, i) => ({
  id: i,
  left: `${(i * 19 + 5) % 94 + 3}%`,
  top: `${(i * 27 + 13) % 88 + 6}%`,
  size: 2 + (i % 5),
  delay: `${(i % 9) * 0.28}s`,
  duration: `${2.8 + (i % 6) * 0.45}s`,
  gold: i % 5 === 0,
}));

export function AppSplashScreen({ exiting, onExitComplete }: AppSplashScreenProps) {
  const [progress, setProgress] = useState(0);

  const statusLine = useMemo(() => {
    let label = LOADING_STEPS[0].label;
    for (const step of LOADING_STEPS) {
      if (progress >= step.at) label = step.label;
    }
    return label;
  }, [progress]);

  const finish = useCallback(() => {
    onExitComplete();
  }, [onExitComplete]);

  useEffect(() => {
    if (!exiting) return;
    const t = window.setTimeout(finish, INTRO_EXIT_DURATION_MS);
    return () => window.clearTimeout(t);
  }, [exiting, finish]);

  useEffect(() => {
    const start = performance.now();
    let raf = 0;

    const tick = (now: number) => {
      const elapsed = now - start;
      const linear = Math.min(100, (elapsed / INTRO_MIN_DURATION_MS) * 100);
      const eased = linear < 100 ? 100 * (1 - Math.pow(1 - linear / 100, 2.1)) : 100;
      setProgress(eased);

      if (elapsed < INTRO_MIN_DURATION_MS) {
        raf = requestAnimationFrame(tick);
      }
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const displayPercent = Math.round(progress);
  const isReady = progress >= 96;
  const chartOffset = CHART_PATH_LENGTH - (progress / 100) * CHART_PATH_LENGTH;

  return (
    <div
      className={`spas-intro ${exiting ? 'spas-intro--exit' : ''} ${isReady ? 'spas-intro--ready' : ''}`}
      style={{ backgroundColor: '#1a0202' }}
      role="dialog"
      aria-modal="true"
      aria-label="Loading Student Performance Analytics System"
      aria-busy={!exiting}
    >
      <div className="spas-intro__bg" aria-hidden />
      <div className="spas-intro__mesh" aria-hidden />
      <div className="spas-intro__grid" aria-hidden />
      <div className="spas-intro__vignette" aria-hidden />
      <div className="spas-intro__grain" aria-hidden />
      <div className="spas-intro__scan-beam" aria-hidden />
      <div className="spas-intro__scanline" aria-hidden />

      <div className="spas-intro__particles" aria-hidden>
        {PARTICLES.map((p) => (
          <span
            key={p.id}
            className={`spas-intro__particle${p.gold ? ' spas-intro__particle--gold' : ''}`}
            style={
              {
                left: p.left,
                top: p.top,
                width: p.size,
                height: p.size,
                '--p-delay': p.delay,
                '--p-duration': p.duration,
              } as React.CSSProperties
            }
          />
        ))}
      </div>

      <div className="spas-intro__orb spas-intro__orb--a" aria-hidden />
      <div className="spas-intro__orb spas-intro__orb--b" aria-hidden />
      <div className="spas-intro__orb spas-intro__orb--gold" aria-hidden />

      <div className="spas-intro__ambient" aria-hidden>
        <svg className="spas-intro__chart-wide" viewBox="0 0 400 120" preserveAspectRatio="none">
          <defs>
            <linearGradient id="spasChartFillWide" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#d4a54a" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#c44d4d" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="spasChartStrokeWide" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#8b2828" />
              <stop offset="50%" stopColor="#d4a54a" />
              <stop offset="100%" stopColor="#f5e6c8" />
            </linearGradient>
          </defs>
          <path
            className="spas-intro__chart-area"
            d="M0 95 L40 78 L80 82 L120 58 L160 64 L200 42 L240 48 L280 32 L320 38 L360 22 L400 28 L400 120 L0 120 Z"
            fill="url(#spasChartFillWide)"
          />
          <path
            className="spas-intro__chart-line"
            d="M0 95 L40 78 L80 82 L120 58 L160 64 L200 42 L240 48 L280 32 L320 38 L360 22 L400 28"
            fill="none"
            stroke="url(#spasChartStrokeWide)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              strokeDasharray: CHART_PATH_LENGTH,
              strokeDashoffset: chartOffset,
            }}
          />
        </svg>
      </div>

      <div className="spas-intro__stage">
        <span
          className="spas-intro__watermark"
          aria-hidden
          style={{ '--wm-opacity': 0.04 + (progress / 100) * 0.04 } as React.CSSProperties}
        >
          {displayPercent}
        </span>

        <div className="spas-intro__hero">
          <p className="spas-intro__eyebrow">Philtech</p>

          <div className="spas-intro__logo-stage">
            <div className="spas-intro__ring spas-intro__ring--outer" aria-hidden />
            <div className="spas-intro__ring spas-intro__ring--mid" aria-hidden />
            <div className="spas-intro__ring spas-intro__ring--inner" aria-hidden />
            <div className="spas-intro__logo-glow" aria-hidden />
            <img src={logoSpas} alt="" className="spas-intro__logo" width={220} height={220} />
            <div className="spas-intro__logo-sweep" aria-hidden />
            <div className="spas-intro__logo-pulse" aria-hidden />
          </div>

          <h1 className="spas-intro__title" aria-label="SPAS">
            {'SPAS'.split('').map((char, i) => (
              <span
                key={i}
                className="spas-intro__letter"
                style={{ '--letter-i': i } as React.CSSProperties}
              >
                {char}
              </span>
            ))}
          </h1>

          <p className="spas-intro__subtitle">Student Performance Analytics System</p>

          <div className="spas-intro__icons" aria-hidden>
            <span className="spas-intro__icon-float spas-intro__icon-float--1">
              <GraduationCap strokeWidth={1.75} />
            </span>
            <span className="spas-intro__icon-float spas-intro__icon-float--2">
              <BarChart3 strokeWidth={1.75} />
            </span>
            <span className="spas-intro__icon-float spas-intro__icon-float--3">
              <TrendingUp strokeWidth={1.75} />
            </span>
          </div>
        </div>
      </div>

      <div className="spas-intro__dock">
        <p key={statusLine} className="spas-intro__status" aria-live="polite">
          {statusLine}
        </p>
        <div
          className="spas-intro__progress-track"
          role="progressbar"
          aria-valuenow={displayPercent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Loading progress"
        >
          <div className="spas-intro__progress-fill" style={{ width: `${progress}%` }}>
            <span className="spas-intro__progress-shine" aria-hidden />
          </div>
        </div>
      </div>
    </div>
  );
}
