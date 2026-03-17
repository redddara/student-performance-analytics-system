import { PropsWithChildren, useEffect, useRef, useState } from "react";

type FadeContentProps = PropsWithChildren<{
  blur?: boolean;
  duration?: number;
  easing?: string;
  delay?: number;
  threshold?: number;
  initialOpacity?: number;
  className?: string;
}>;

export function FadeContent({
  children,
  blur = false,
  duration = 900,
  easing = "ease-out",
  delay = 0,
  threshold = 0.1,
  initialOpacity = 0,
  className = "",
}: FadeContentProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    if (!ref.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          observer.unobserve(entry.target);
          const timer = window.setTimeout(() => setInView(true), delay);
          return () => window.clearTimeout(timer);
        }
        return undefined;
      },
      { threshold }
    );

    observer.observe(ref.current);

    return () => observer.disconnect();
  }, [threshold, delay]);

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: inView ? 1 : initialOpacity,
        transition: `opacity ${duration}ms ${easing}, filter ${duration}ms ${easing}, transform ${duration}ms ${easing}`,
        filter: blur ? (inView ? "blur(0px)" : "blur(12px)") : "none",
        transform: inView ? "translateY(0px)" : "translateY(24px)",
      }}
    >
      {children}
    </div>
  );
}
