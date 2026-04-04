import { clsx } from 'clsx';
import { ReactNode, ButtonHTMLAttributes } from 'react';

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
  /** `plain` = light neutral shell for auth alerts etc. (no maroon glass or inverted text). */
  variant?: 'maroon' | 'plain';
}

export function GlassCard({ children, className, style, onClick, variant = 'maroon' }: GlassCardProps) {
  const isMaroon = variant === 'maroon';

  return (
    <div
      onClick={onClick}
      className={clsx(
        'relative isolate overflow-hidden rounded-3xl transition-all duration-300',
        isMaroon && [
          'p-8 lg:p-10',
          // Opaque maroon — no transparency/blur so the white page doesn’t wash it to pink
          'border border-maroon-600 bg-gradient-to-b from-maroon-600 to-maroon-900',
          'shadow-2xl',
          '[box-shadow:0_0_0_1px_rgba(212,165,0,0.22),0_16px_40px_rgba(51,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.06)]',
          onClick &&
            'cursor-pointer hover:border-maroon-400 hover:[box-shadow:0_0_0_1px_rgba(212,165,0,0.35),0_20px_48px_rgba(51,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.1)] active:scale-[0.98]',
        ],
        !isMaroon && 'border border-gray-200/80 bg-white/95 shadow-md',
        !isMaroon && onClick && 'cursor-pointer hover:shadow-lg active:scale-[0.99]',
        className
      )}
      style={style}
    >
      {isMaroon && (
        <>
          <div
            className="pointer-events-none absolute inset-0 rounded-3xl bg-gradient-to-br from-white/[0.05] via-transparent to-transparent"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-0 rounded-3xl bg-gradient-to-t from-maroon-950/60 via-transparent to-transparent"
            aria-hidden
          />
        </>
      )}
      <div className={clsx('relative z-10', isMaroon && 'glass-card-content')}>{children}</div>
    </div>
  );
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  children: ReactNode;
}

export function Button({ 
  variant = 'primary', 
  size = 'md', 
  children, 
  className,
  ...props 
}: ButtonProps) {
  const baseStyles = 'font-medium rounded-xl transition-all duration-300 flex items-center justify-center gap-2 touch-manipulation';
  
  const variants = {
primary:
      'bg-gradient-to-r from-maroon-600 to-maroon-700 text-white hover:from-maroon-500 hover:to-maroon-600 shadow-lg hover:shadow-xl backdrop-blur-md [box-shadow:0_0_24px_rgba(212,165,0,0.22)]',
secondary: 'bg-white/90 text-maroon-700 border border-maroon-200/80 hover:bg-white shadow-md backdrop-blur-md',
    danger: 'bg-red-600 text-white hover:bg-red-700 backdrop-blur-md',
ghost:
      'bg-white/10 text-gold-100 border border-gold-400/35 hover:bg-white/18 hover:border-gold-400/50 backdrop-blur-md',
  };
  
  const sizes = {
    sm: 'px-3 py-2 text-sm sm:py-1.5',
    md: 'px-4 py-2.5 text-base min-h-[44px] sm:min-h-0',
    lg: 'px-6 py-3 text-lg min-h-[44px] sm:min-h-0',
  };
  
  return (
    <button 
      className={clsx(baseStyles, variants[variant], sizes[size], className)}
      {...props}
    >
      {children}
    </button>
  );
}

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({ label, error, className, ...props }: InputProps) {
  return (
    <div className="space-y-1">
      {label && (
        <label className="block text-sm font-medium text-gray-700 ml-1">
          {label}
        </label>
      )}
      <input
        className={clsx(
          'w-full px-4 py-2.5 rounded-xl border border-gray-300/70 dark:border-gray-600/70 bg-white/90 dark:bg-gray-900/90 backdrop-blur-md',
          'text-base text-gray-800',
          'focus:outline-none focus:ring-2 focus:ring-maroon-500/50 focus:border-maroon-500 hover:border-gray-400/80 dark:hover:border-gray-500/80',
          'placeholder:text-gray-400',
          error && 'border-red-500 focus:ring-red-500/50 bg-red-50/50',
          className
        )}
        {...props}
      />
      {error && <p className="text-sm text-red-500 ml-1">{error}</p>}
    </div>
  );
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: { value: string; label: string }[];
}

export function Select({ label, options, className, ...props }: SelectProps) {
  return (
    <div className="space-y-1">
      {label && (
        <label className="block text-sm font-medium text-gray-700 ml-1">
          {label}
        </label>
      )}
      <select
        className={clsx(
          'w-full px-4 py-2.5 rounded-xl border border-gray-300/70 dark:border-gray-600/70 bg-white/90 dark:bg-gray-900/90 backdrop-blur-md',
          'text-base text-gray-800',
          'focus:outline-none focus:ring-2 focus:ring-maroon-500/50 focus:border-maroon-500 hover:border-gray-400/80 dark:hover:border-gray-500/80',
          className
        )}
        {...props}
      >
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
}

interface BadgeProps {
  children: ReactNode;
  variant?: 'success' | 'warning' | 'danger' | 'info';
  className?: string;
}

export function Badge({ children, variant = 'info', className }: BadgeProps) {
  const variants = {
    success: 'bg-green-500/15 text-green-300 border-green-400/40 backdrop-blur-sm',
    warning: 'bg-gold-500/20 text-gold-200 border-gold-400/45 backdrop-blur-sm',
    danger: 'bg-red-500/20 text-red-300 border-red-400/40 backdrop-blur-sm',
    info: 'bg-white/10 text-gold-100 border-gold-400/40 backdrop-blur-sm',
  };
  
  return (
    <span className={clsx(
      'px-3 py-1 rounded-full text-xs font-medium border backdrop-blur-sm',
      variants[variant],
      className
    )}>
      {children}
    </span>
  );
}

interface TableProps {
  headers: string[];
  children: ReactNode;
  className?: string;
}

export function Table({ headers, children, className }: TableProps) {
  return (
    <div
      className={clsx(
        '-mx-1 overflow-x-auto overscroll-x-contain rounded-xl sm:mx-0 sm:rounded-none',
        '[scrollbar-width:thin]',
        className
      )}
    >
      <table className="w-full min-w-max text-left text-xs sm:text-sm">
        <thead>
          <tr className="border-b border-gold-400/35 bg-black/20">
            {headers.map((h, i) => (
              <th
                key={i}
                className="whitespace-nowrap px-2 py-2.5 text-left text-xs font-semibold text-gold-200/95 backdrop-blur-sm sm:px-4 sm:py-3 sm:text-sm"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gold-400/15">{children}</tbody>
      </table>
    </div>
  );
}

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

export function Modal({ isOpen, onClose, title, children, size = 'md' }: ModalProps) {
  if (!isOpen) return null;
  
  const sizes = {
    sm: 'max-w-sm',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
  };
  
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-md touch-manipulation"
        onClick={onClose}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className={clsx(
          'relative flex max-h-[min(92dvh,100vh-1rem)] w-full flex-col bg-white/60 backdrop-blur-2xl shadow-2xl border border-white/50',
          'rounded-t-2xl sm:rounded-2xl',
          sizes[size]
        )}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/40 bg-white/20 p-4 backdrop-blur-sm sm:p-5">
          <h2 id="modal-title" className="text-lg font-semibold text-[#800000] sm:text-xl pr-2 break-words">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg p-2 min-h-[44px] min-w-[44px] hover:bg-white/50 text-[#800000] transition-colors touch-manipulation flex items-center justify-center"
            aria-label="Close"
          >
            <i className="hgi-stroke hgi-close-circle text-xl" aria-hidden />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain p-4">{children}</div>
      </div>
    </div>
  );
}

interface TabsProps {
  tabs: { id: string; label: string }[];
  activeTab: string;
  onChange: (id: string) => void;
}

export function Tabs({ tabs, activeTab, onChange }: TabsProps) {
  return (
    <div className="flex flex-wrap gap-1.5 p-1 bg-white/20 rounded-xl sm:gap-2">
      {tabs.map(tab => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={clsx(
            'min-h-[44px] touch-manipulation rounded-lg px-3 py-2 text-xs font-medium transition-all duration-300 sm:min-h-0 sm:px-4 sm:text-sm',
            activeTab === tab.id
              ? 'bg-[#800000] text-white shadow-lg'
              : 'text-gray-600 hover:bg-white/30'
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

export function Spinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizes = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
  };
  
  return (
    <div className={clsx('animate-spin rounded-full border-2 border-[#800000]/30 border-t-[#800000]', sizes[size])} />
  );
}

interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="w-16 h-16 mb-4 rounded-full bg-white/30 flex items-center justify-center">
  <i className="hgi-stroke hgi-mail text-3xl text-gray-400"/>
      </div>
      <h3 className="text-lg font-semibold text-gray-700">{title}</h3>
      {description && <p className="text-sm text-gray-500 mt-1">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
}

export function ConfirmModal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title, 
  message, 
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger'
}: ConfirmModalProps) {
  if (!isOpen) return null;
  
  const variants = {
    danger: {
      bg: 'bg-red-500/20 border-red-500/40',
      text: 'text-red-700',
      button: 'bg-red-600 hover:bg-red-700',
    },
    warning: {
      bg: 'bg-yellow-500/20 border-yellow-500/40',
      text: 'text-yellow-700',
      button: 'bg-yellow-600 hover:bg-yellow-700',
    },
    info: {
      bg: 'bg-blue-500/20 border-blue-500/40',
      text: 'text-blue-700',
      button: 'bg-[#800000] hover:bg-[#600000]',
    },
  };
  
  const v = variants[variant];
  
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-md touch-manipulation"
        onClick={onClose}
        aria-hidden
      />
      <div className="relative m-0 max-h-[min(90dvh,100vh)] w-full max-w-sm overflow-y-auto overscroll-y-contain rounded-t-2xl bg-white/80 backdrop-blur-2xl shadow-2xl border border-white/50 sm:m-4 sm:rounded-2xl animate-in fade-in zoom-in duration-200">
        <div className={`p-4 sm:p-6 ${v.bg} border-b border-white/30`}>
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="w-10 h-10 sm:w-12 sm:h-12 shrink-0 rounded-full flex items-center justify-center bg-maroon-500/20 border-2 border-maroon-400/50 backdrop-blur-sm">
              <i className="hgi-stroke hgi-warning-02 text-maroon-600 text-lg sm:text-xl" aria-hidden />
            </div>
            <h2 className={`text-lg sm:text-xl font-semibold ${v.text} break-words`}>{title}</h2>
          </div>
        </div>
        <div className="p-4 sm:p-6">
          <p className="text-gray-600 mb-6 text-sm sm:text-base">{message}</p>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] w-full touch-manipulation rounded-xl border border-gray-300 px-4 py-2.5 text-gray-700 hover:bg-gray-100 transition-all duration-300 sm:w-auto sm:min-h-0"
            >
              {cancelText}
            </button>
            <button
              type="button"
              onClick={() => { onConfirm(); onClose(); }}
              className={`min-h-[44px] w-full touch-manipulation rounded-xl px-4 py-2.5 text-white ${v.button} transition-all duration-300 shadow-lg hover:shadow-xl sm:w-auto sm:min-h-0`}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}