import type { ReactNode } from 'react';
import { clsx } from 'clsx';

interface PageIntroProps {
  title: string;
  subtitle?: string;
  className?: string;
  children?: ReactNode;
}

/** Shared heading block for admin / teacher / student pages (readability + hierarchy). */
export function PageIntro({ title, subtitle, className, children }: PageIntroProps) {
  return (
    <div className={clsx('mb-6 max-w-3xl', className)}>
      <h2 className="text-xl font-semibold text-[#800000] sm:text-2xl">{title}</h2>
      {subtitle && (
        <p className="mt-1.5 text-sm leading-relaxed text-gray-600 sm:text-base">{subtitle}</p>
      )}
      {children}
    </div>
  );
}
