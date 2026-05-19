import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import type { OnboardingTourStep } from '../../lib/onboardingTourSteps';

type Rect = { top: number; left: number; width: number; height: number };

const PADDING = 8;
const TOOLTIP_GAP = 12;

function measureTarget(selector: string): Rect | null {
  const el = document.querySelector(`[data-tour="${selector}"]`);
  if (!el) return null;
  const box = el.getBoundingClientRect();
  return {
    top: box.top,
    left: box.left,
    width: box.width,
    height: box.height,
  };
}

function clampTooltipPosition(
  left: number,
  top: number,
  width: number,
  height: number
): { left: number; top: number } {
  const margin = 12;
  const maxLeft = window.innerWidth - width - margin;
  const maxTop = window.innerHeight - height - margin;
  return {
    left: Math.max(margin, Math.min(left, maxLeft)),
    top: Math.max(margin, Math.min(top, maxTop)),
  };
}

interface OnboardingTourProps {
  steps: OnboardingTourStep[];
  onComplete: () => void;
  onOpenSidebar?: () => void;
}

export function OnboardingTour({ steps, onComplete, onOpenSidebar }: OnboardingTourProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<Rect | null>(null);
  const [tooltipStyle, setTooltipStyle] = useState<{ left: number; top: number }>({
    left: 16,
    top: 16,
  });
  const tooltipRef = useRef<HTMLDivElement>(null);

  const step = steps[stepIndex];
  const isLast = stepIndex >= steps.length - 1;

  const updatePositions = useCallback(() => {
    if (!step) return;
    const rect = measureTarget(step.target);
    setTargetRect(rect);

    const tooltipEl = tooltipRef.current;
    const tooltipW = tooltipEl?.offsetWidth ?? 320;
    const tooltipH = tooltipEl?.offsetHeight ?? 200;

    if (!rect) {
      const centered = clampTooltipPosition(
        (window.innerWidth - tooltipW) / 2,
        (window.innerHeight - tooltipH) / 2,
        tooltipW,
        tooltipH
      );
      setTooltipStyle(centered);
      return;
    }

    const spotlightBottom = rect.top + rect.height + PADDING;
    let left = rect.left;
    let top = spotlightBottom + TOOLTIP_GAP;

    if (top + tooltipH > window.innerHeight - 12) {
      top = rect.top - tooltipH - TOOLTIP_GAP;
    }
    if (left + tooltipW > window.innerWidth - 12) {
      left = window.innerWidth - tooltipW - 12;
    }

    setTooltipStyle(clampTooltipPosition(left, top, tooltipW, tooltipH));
  }, [step]);

  useLayoutEffect(() => {
    if (!step) return;
    if (step.openSidebar) onOpenSidebar?.();
    const raf = window.requestAnimationFrame(() => {
      updatePositions();
    });
    return () => window.cancelAnimationFrame(raf);
  }, [step, stepIndex, onOpenSidebar, updatePositions]);

  useEffect(() => {
    const onResize = () => updatePositions();
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onResize, true);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onResize, true);
    };
  }, [updatePositions]);

  useEffect(() => {
    const t = window.setTimeout(updatePositions, 350);
    return () => window.clearTimeout(t);
  }, [stepIndex, updatePositions]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const handleNext = () => {
    if (isLast) {
      onComplete();
      return;
    }
    setStepIndex((i) => i + 1);
  };

  if (!step) return null;

  const spotlight = targetRect
    ? {
        top: targetRect.top - PADDING,
        left: targetRect.left - PADDING,
        width: targetRect.width + PADDING * 2,
        height: targetRect.height + PADDING * 2,
      }
    : null;

  return (
    <div
      className="fixed inset-0 z-[100] print:hidden"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-tour-title"
      aria-describedby="onboarding-tour-body"
    >
      <svg className="absolute inset-0 h-full w-full" aria-hidden>
        <defs>
          <mask id="sapas-tour-spotlight-mask">
            <rect width="100%" height="100%" fill="white" />
            {spotlight && (
              <rect
                x={spotlight.left}
                y={spotlight.top}
                width={spotlight.width}
                height={spotlight.height}
                rx={12}
                ry={12}
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          width="100%"
          height="100%"
          fill="rgba(15, 5, 8, 0.72)"
          mask="url(#sapas-tour-spotlight-mask)"
        />
      </svg>

      {spotlight && (
        <div
          className="pointer-events-none fixed rounded-xl ring-2 ring-gold-400/90 shadow-[0_0_24px_rgba(212,175,55,0.35)]"
          style={{
            top: spotlight.top,
            left: spotlight.left,
            width: spotlight.width,
            height: spotlight.height,
          }}
          aria-hidden
        />
      )}

      <div
        ref={tooltipRef}
        className="fixed z-[101] w-[min(100vw-2rem,22rem)] rounded-2xl border border-maroon-200/60 bg-white p-5 shadow-2xl"
        style={{ left: tooltipStyle.left, top: tooltipStyle.top }}
      >
          <button
            type="button"
            className="absolute right-3 top-3 rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
            aria-label="Skip tour"
            onClick={onComplete}
          >
            <X className="h-4 w-4" aria-hidden />
          </button>

          <p className="text-xs font-semibold uppercase tracking-wide text-maroon-600">
            Step {stepIndex + 1} of {steps.length}
          </p>
          <h2 id="onboarding-tour-title" className="mt-1 pr-8 text-lg font-bold text-gray-900">
            {step.title}
          </h2>
          <p id="onboarding-tour-body" className="mt-2 text-sm leading-relaxed text-gray-600">
            {step.body}
          </p>

          <div className="mt-5 flex items-center justify-between gap-3">
            <button
              type="button"
              className="text-sm font-medium text-gray-500 hover:text-maroon-700"
              onClick={onComplete}
            >
              Skip tour
            </button>
            <button
              type="button"
              className="rounded-xl bg-gradient-to-r from-maroon-600 to-maroon-700 px-4 py-2 text-sm font-semibold text-white shadow-md transition-all hover:from-maroon-500 hover:shadow-lg"
              onClick={handleNext}
            >
              {isLast ? 'Got it' : 'Next'}
            </button>
          </div>
      </div>
    </div>
  );
}
