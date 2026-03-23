import React from 'react';
import { clsx } from 'clsx';

// ============ CARD COMPONENT ============
interface CardProps {
  children: React.ReactNode;
  className?: string;
  glass?: boolean;
  onClick?: () => void;
}

export const Card: React.FC<CardProps> = ({ children, className, glass = true, onClick }) => {
  return (
    <div
      onClick={onClick}
      className={clsx(
'rounded-3xl p-10 lg:p-12 transition-all duration-500 hover:scale-[1.02] shadow-card',
        glass ? 'bg-black/25 backdrop-blur-xl border border-gold-400/40 shadow-gold-glow hover:shadow-card-hover hover:border-gold-500/50' : 'bg-white/90 shadow-2xl',
        className,
        onClick && 'cursor-pointer active:scale-[0.98] hover:gold-glow-strong'
      )}
    >
      {children}
    </div>
  );
};

// ============ BUTTON COMPONENT ============
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'gold';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  className,
  loading = false,
  disabled = false,
  ...props
}) => {
  const baseStyles = 'inline-flex items-center justify-center rounded-xl font-bold transition-all duration-200 focus:outline-none focus:ring-3 focus:ring-gold-400 focus:ring-offset-2 focus:ring-offset-maroon-950 disabled:opacity-60 disabled:cursor-not-allowed disabled:scale-100';
  
  const variants = {
    primary: 'bg-gradient-to-r from-maroon-600 to-maroon-700 text-white hover:from-maroon-500 hover:to-maroon-600 hover:shadow-lg hover:shadow-maroon-900/50 active:scale-95',
    secondary: 'bg-black/30 backdrop-blur-sm border-2 border-maroon-600/70 text-white hover:bg-maroon-900/40 hover:border-maroon-500 active:scale-95',
    gold: 'bg-gradient-to-r from-gold-500 to-gold-600 text-black hover:from-gold-400 hover:to-gold-500 hover:shadow-lg hover:shadow-gold-500/40 active:scale-95 font-bold',
    danger: 'bg-red-600 text-white hover:bg-red-700 hover:shadow-lg hover:shadow-red-900/50 active:scale-95',
    success: 'bg-green-600 text-white hover:bg-green-700 hover:shadow-lg hover:shadow-green-900/50 active:scale-95'
  };

  const sizes = {
    sm: 'px-8 py-4 text-lg gap-3 font-semibold',
    md: 'px-10 py-5 text-xl gap-3 font-semibold',
    lg: 'px-12 py-6 text-2xl gap-4 font-bold'
  };

  return (
    <button
      className={clsx(baseStyles, variants[variant], sizes[size], className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <svg className="animate-spin -ml-1 mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      )}
      {children}
    </button>
  );
};

// ============ INPUT COMPONENT ============
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
  helperText?: string;
}

export const Input: React.FC<InputProps> = ({ label, error, icon, helperText, className, ...props }) => {
  return (
    <div className="space-y-2">
      {label && (
        <label className="block text-base font-bold text-white mb-3">
          {label}
          {props.required && <span className="text-red-400 ml-1">*</span>}
        </label>
      )}
      <div className="relative">
        {icon && (
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400">
            {icon}
          </div>
        )}
        <input
          className={clsx(
            'w-full px-5 py-4 text-base rounded-xl bg-black/25 backdrop-blur-sm border-2 border-maroon-600/60 text-white placeholder-gray-500 transition-all',
            'focus:outline-none focus:ring-3 focus:ring-gold-400 focus:ring-offset-2 focus:ring-offset-maroon-950 focus:border-gold-500',
            'hover:border-maroon-500/80',
            icon && 'pl-12',
            error && 'border-red-500 focus:ring-red-400',
            className
          )}
          {...props}
        />
      </div>
      {error && <p className="text-red-300 text-base font-medium mt-2">{error}</p>}
      {helperText && !error && <p className="text-gray-400 text-sm mt-1">{helperText}</p>}
    </div>
  );
};

// ============ SELECT COMPONENT ============
interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: { value: string; label: string }[];
  helperText?: string;
}

export const Select: React.FC<SelectProps> = ({ label, options, helperText, className, ...props }) => {
  return (
    <div className="space-y-2">
      {label && (
        <label className="block text-base font-bold text-white mb-3">
          {label}
          {props.required && <span className="text-red-400 ml-1">*</span>}
        </label>
      )}
      <select
        className={clsx(
          'w-full px-5 py-4 text-base rounded-xl bg-black/25 backdrop-blur-sm border-2 border-maroon-600/60 text-white transition-all',
          'focus:outline-none focus:ring-3 focus:ring-gold-400 focus:ring-offset-2 focus:ring-offset-maroon-950 focus:border-gold-500',
          'hover:border-maroon-500/80',
          'appearance-none cursor-pointer',
          className
        )}
        {...props}
      >
        {options.map(opt => (
          <option key={opt.value} value={opt.value} className="bg-maroon-950 text-white">
            {opt.label}
          </option>
        ))}
      </select>
      {helperText && <p className="text-gray-400 text-sm mt-1">{helperText}</p>}
    </div>
  );
};

// ============ MODAL COMPONENT ============
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  subtitle?: string;
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, subtitle, children }) => {
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        role="button"
        aria-label="Close modal"
      />
      <div className="relative bg-maroon-950/70 backdrop-blur-sm rounded-2xl p-8 w-full max-w-md border-2 border-gold-500/60 shadow-2xl shadow-maroon-900/40 animate-fadeIn">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/10"
          aria-label="Close dialog"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <div className="mb-6 pr-8">
          <h2 className="text-2xl font-bold text-white">{title}</h2>
          {subtitle && <p className="text-gray-300 text-base mt-2">{subtitle}</p>}
        </div>
        <div className="space-y-4">
          {children}
        </div>
      </div>
    </div>
  );
};

// ============ BADGE COMPONENT ============
interface BadgeProps {
  children: React.ReactNode;
  variant?: 'success' | 'warning' | 'danger' | 'info' | 'gold';
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const Badge: React.FC<BadgeProps> = ({ children, variant = 'info', className, size = 'md' }) => {
  const variants = {
    success: 'bg-green-500/30 text-green-200 border-green-500/70 font-semibold',
    warning: 'bg-yellow-500/30 text-yellow-200 border-yellow-500/70 font-semibold',
    danger: 'bg-red-500/30 text-red-200 border-red-500/70 font-semibold',
    info: 'bg-maroon-500/30 text-maroon-100 border-maroon-500/70 font-semibold',
    gold: 'bg-gold-500/30 text-gold-100 border-gold-500/70 font-semibold'
  };

  const sizes = {
    sm: 'px-3 py-2 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-5 py-3 text-lg'
  };

  return (
    <span className={clsx(
      'inline-flex items-center rounded-full border-2 transition-all',
      variants[variant],
      sizes[size],
      className
    )}>
      {children}
    </span>
  );
};

// ============ STAT CARD COMPONENT ============
interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: { value: number; isPositive: boolean };
  subtitle?: string;
}

export const StatCard: React.FC<StatCardProps> = ({ title, value, icon, trend, subtitle }) => {
  return (
    <Card className="relative overflow-hidden">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <p className="text-gray-300 text-base font-bold mb-2">{title}</p>
          <p className="text-4xl font-bold text-white mb-2">{value}</p>
          {subtitle && <p className="text-gray-400 text-sm mb-3">{subtitle}</p>}
          {trend && (
            <p className={clsx(
              'text-base font-semibold flex items-center gap-2',
              trend.isPositive ? 'text-green-300' : 'text-red-300'
            )}>
              <span className="text-xl">{trend.isPositive ? '↑' : '↓'}</span>
              <span>{Math.abs(trend.value)}%</span>
            </p>
          )}
        </div>
        <div className="p-4 bg-gold-500/25 rounded-xl text-gold-300 flex-shrink-0">
          {icon}
        </div>
      </div>
    </Card>
  );
};

// ============ TABLE COMPONENT ============
interface TableProps {
  headers: string[];
  children: React.ReactNode;
}

export const Table: React.FC<TableProps> = ({ headers, children }) => {
  return (
    <div className="overflow-x-auto rounded-xl border border-maroon-600/50">
      <table className="w-full">
        <thead>
          <tr className="bg-black/30 border-b border-maroon-600/50">
            {headers.map((h, i) => (
              <th key={i} className="px-6 py-4 text-left text-base font-bold text-white">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-maroon-600/30">
          {children}
        </tbody>
      </table>
    </div>
  );
};

// ============ LOADING SPINNER COMPONENT ============
interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  text?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ size = 'md', text }) => {
  const sizeClasses = {
    sm: 'h-8 w-8',
    md: 'h-12 w-12',
    lg: 'h-16 w-16'
  };

  const textSizes = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg'
  };

  return (
    <div className="flex flex-col items-center justify-center gap-4">
      <svg className={clsx('animate-spin', sizeClasses[size])} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
      {text && <p className={clsx('text-gray-300 font-medium', textSizes[size])}>{text}</p>}
    </div>
  );
};

// ============ ALERT COMPONENT ============
interface AlertProps {
  variant?: 'success' | 'error' | 'warning' | 'info';
  title?: string;
  message: string;
  onClose?: () => void;
}

export const Alert: React.FC<AlertProps> = ({ variant = 'info', title, message, onClose }) => {
  const variants = {
    success: {
      bg: 'bg-green-500/20',
      border: 'border-green-500/60',
      text: 'text-green-100',
      icon: '✓'
    },
    error: {
      bg: 'bg-red-500/20',
      border: 'border-red-500/60',
      text: 'text-red-100',
      icon: '✕'
    },
    warning: {
      bg: 'bg-yellow-500/20',
      border: 'border-yellow-500/60',
      text: 'text-yellow-100',
      icon: '⚠'
    },
    info: {
      bg: 'bg-maroon-500/20',
      border: 'border-maroon-500/60',
      text: 'text-maroon-100',
      icon: 'ⓘ'
    }
  };

  const style = variants[variant];

  return (
    <div className={clsx('rounded-xl border-2 p-4 animate-slideInFromLeft', style.bg, style.border, style.text)}>
      <div className="flex items-start gap-4">
        <div className="text-2xl flex-shrink-0 mt-1">{style.icon}</div>
        <div className="flex-1">
          {title && <h3 className="font-bold text-base mb-1">{title}</h3>}
          <p className="text-base">{message}</p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="ml-4 p-2 rounded-lg hover:bg-white/10 transition-colors flex-shrink-0"
            aria-label="Close alert"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
};

