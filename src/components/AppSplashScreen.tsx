import { useCallback, useEffect, useMemo, useState } from 'react';
import { BarChart3, GraduationCap, TrendingUp } from 'lucide-react';
import logoSpas from '../assets/LOGO SPAS.png';
import { INTRO_EXIT_DURATION_MS, INTRO_MIN_DURATION_MS } from '../lib/introSplash';

interface AppSplashScreenProps {
  exiting: boolean;
  onExitComplete: () => void;
}

const STAT_BARS = [38, 62, 48, 78, 55, 70, 44, 86, 58, 74];

const LOADING_STEPS = [
  { at: 0, label: 'Initializing analytics engine…' },
  { at: 26, label: 'Syncing academic records…' },
  { at: 52, label: 'Loading grade insights…' },
  { at: 78, label: 'Preparing dashboards…' },
  { at: 96, label: 'Ready — welcome to SPAS' },
] as const;

const PARTICLES = Array.from({ length: 22 }, (_, i) => ({
  id: i,
  left: `${(i * 19 + 5) % 94 + 3}%`,
  top: `${(i * 27 + 13) % 88 + 6}%`,
  size: 3 + (i % 4),
  delay: `${(i % 9) * 0.28}s`,
  duration: `${2.8 + (i % 6) * 0.45}s`,
}));

const CHART_PATH =
  'M8 52 L28 44 L48 48 L68 28 L88 34 L108 18 L128 24 L148 10';

export function AppSplashScreen({ exiting, onExitComplete }: AppSplashScreenProps) {
  const [progress, setProgress] = useState(0);

  const statusLine = useMemo(() => {
    let label = LOADING_STEPS[0].label;
    for (const step of LOADING_STEPS) {
      if (progress >= step.at) label = step.label;
    }
    return label;
  }, [progress]);

  const activeStep = useMemo(() => {
    let step = 0;
    for (let i = 0; i < LOADING_STEPS.length; i++) {
      if (progress >= LOADING_STEPS[i].at) step = i;
    }
    return step;
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

  return (
    <div
      className={`spas-intro ${exiting ? 'spas-intro--exit' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label="Loading Student Performance Analytics System"
      aria-busy={!exiting}
    >
      <div className="spas-intro__bg" aria-hidden />
      <div className="spas-intro__mesh" aria-hidden />
      <div className="spas-intro__grid" aria-hidden />
      <div className="spas-intro__scan-beam" aria-hidden />

      <div className="spas-intro__particles" aria-hidden>
        {PARTICLES.map((p) => (
          <span
            key={p.id}
            className="spas-intro__particle"
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

      <div className="spas-intro__frame">
        <span className="spas-intro__corner spas-intro__corner--tl" aria-hidden />
        <span className="spas-intro__corner spas-intro__corner--tr" aria-hidden />
        <span className="spas-intro__corner spas-intro__corner--bl" aria-hidden />
        <span className="spas-intro__corner spas-intro__corner--br" aria-hidden />
        <div className="spas-intro__scanline" aria-hidden />

        <p className="spas-intro__badge">PHILTECH · SPAS</p>

        <div className="spas-intro__logo-stage">
          <div className="spas-intro__ring spas-intro__ring--outer" aria-hidden />
          <div className="spas-intro__ring spas-intro__ring--mid" aria-hidden />
          <div className="spas-intro__ring spas-intro__ring--inner" aria-hidden />
          <div className="spas-intro__logo-glow" aria-hidden />
          <img src={logoSpas} alt="" className="spas-intro__logo" width={112} height={112} />
          <div className="spas-intro__logo-sweep" aria-hidden />
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

        <div className="spas-intro__viz" aria-hidden>
          <svg className="spas-intro__chart-svg" viewBox="0 0 156 60" preserveAspectRatio="none">
            <defs>
              <linearGradient id="spasChartFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#800000" stopOpacity="0.22" />
                <stop offset="100%" stopColor="#800000" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path className="spas-intro__chart-area" d={`${CHART_PATH} L148 60 L8 60 Z`} fill="url(#spasChartFill)" />
            <path className="spas-intro__chart-line" d={CHART_PATH} fill="none" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            <circle className="spas-intro__chart-dot" cx="148" cy="10" r="4" />
          </svg>

          <div className="spas-intro__bars">
            {STAT_BARS.map((h, i) => (
              <div
                key={i}
                className="spas-intro__bar"
                style={{ '--bar-h': `${h}%`, '--bar-i': i } as React.CSSProperties}
              />
            ))}
          </div>
        </div>

        <div className="spas-intro__orbit" aria-hidden>
          <div className="spas-intro__orbit-track" />
          <span className="spas-intro__orbit-icon spas-intro__orbit-icon--1">
            <GraduationCap strokeWidth={1.75} />
          </span>
          <span className="spas-intro__orbit-icon spas-intro__orbit-icon--2">
            <BarChart3 strokeWidth={1.75} />
          </span>
          <span className="spas-intro__orbit-icon spas-intro__orbit-icon--3">
            <TrendingUp strokeWidth={1.75} />
          </span>
        </div>

        <div className="spas-intro__steps" aria-hidden>
          {LOADING_STEPS.map((step, i) => (
            <span
              key={step.at}
              className={`spas-intro__step ${i <= activeStep ? 'spas-intro__step--active' : ''} ${
                i === activeStep ? 'spas-intro__step--current' : ''
              }`}
            />
          ))}
        </div>

        <div className="spas-intro__progress-block">
          <div className="spas-intro__progress-meta">
            <span className="spas-intro__progress-label">System load</span>
            <span className="spas-intro__progress-pct">{displayPercent}%</span>
          </div>
          <div className="spas-intro__progress-track">
            <div className="spas-intro__progress-fill" style={{ width: `${progress}%` }}>
              <span className="spas-intro__progress-shine" aria-hidden />
            </div>
          </div>
          <p key={statusLine} className="spas-intro__status">
            {statusLine}
          </p>
        </div>
      </div>
    </div>
  );
}
