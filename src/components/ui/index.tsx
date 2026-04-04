import { clsx } from 'clsx';
import { ReactNode, ButtonHTMLAttributes } from 'react';

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
}

export function GlassCard({ children, className, style, onClick }: GlassCardProps) {
  return (
    <div 
      className={clsx(
        'backdrop-blur-2xl bg-[#800000]/20 border border-[#800000]/30 rounded-2xl shadow-xl',
        onClick && 'cursor-pointer hover:bg-[#800000]/30 hover:shadow-2xl transition-all duration-300',
        className
      )}
      style={style}
      onClick={onClick}
    >
      {children}
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
  const baseStyles = 'font-medium rounded-xl transition-all duration-300 flex items-center justify-center gap-2';
  
  const variants = {
    primary: 'bg-gradient-to-r from-[#800000] to-[#a52a2a] text-white hover:from-[#600000] hover:to-[#800000] shadow-lg hover:shadow-xl backdrop-blur-md',
    secondary: 'bg-white/40 text-[#800000] border border-white/50 hover:bg-white/60 backdrop-blur-md',
    danger: 'bg-red-600 text-white hover:bg-red-700 backdrop-blur-md',
    ghost: 'bg-white/20 text-[#800000] hover:bg-white/40 backdrop-blur-md',
  };
  
  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg',
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
          'w-full px-4 py-2.5 rounded-xl border border-white/50 bg-white/40 backdrop-blur-md',
          'focus:outline-none focus:ring-2 focus:ring-[#800000]/50 focus:border-[#800000]',
          'placeholder:text-gray-400 text-gray-800',
          error && 'border-red-500 focus:ring-red-500/50',
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
          'w-full px-4 py-2.5 rounded-xl border border-white/50 bg-white/40 backdrop-blur-md',
          'focus:outline-none focus:ring-2 focus:ring-[#800000]/50 focus:border-[#800000]',
          'text-gray-800',
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
    success: 'bg-maroon-500/20 text-maroon-700 border-maroon-400/50 backdrop-blur-sm',
    warning: 'bg-gold-400/30 text-gold-800 border-gold-400/40 backdrop-blur-sm', 
    danger: 'bg-maroon-600/30 text-maroon-800 border-maroon-500/40 backdrop-blur-sm',
    info: 'bg-maroon-500/25 text-maroon-700 border-maroon-400/50 backdrop-blur-sm',
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
}

export function Table({ headers, children }: TableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-white/40 bg-white/20">
            {headers.map((h, i) => (
              <th key={i} className="px-4 py-3 text-left text-sm font-semibold text-[#800000] backdrop-blur-sm">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-white/20">
          {children}
        </tbody>
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-black/30 backdrop-blur-md"
        onClick={onClose}
      />
      <div className={clsx(
        'relative w-full bg-white/60 backdrop-blur-2xl rounded-2xl shadow-2xl border border-white/50',
        sizes[size]
      )}>
        <div className="flex items-center justify-between p-5 border-b border-white/40 bg-white/20 backdrop-blur-sm">
          <h2 className="text-xl font-semibold text-[#800000]">{title}</h2>
          <button 
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/50 text-[#800000] transition-colors"
          >
            <i className="hgi-stroke hgi-close-circle"></i>
          </button>
        </div>
        <div className="p-4">{children}</div>
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
    <div className="flex gap-2 p-1 bg-white/20 rounded-xl">
      {tabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={clsx(
            'px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300',
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-md"
        onClick={onClose}
      />
      <div className="relative w-full max-w-sm bg-white/80 backdrop-blur-2xl rounded-2xl shadow-2xl border border-white/50 overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className={`p-6 ${v.bg} border-b border-white/30`}>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full flex items-center justify-center bg-maroon-500/20 border-2 border-maroon-400/50 backdrop-blur-sm">
              <i className="hgi-stroke hgi-warning-02 text-maroon-600 text-xl"></i>
            </div>
            <h2 className={`text-xl font-semibold ${v.text}`}>{title}</h2>
          </div>
        </div>
        <div className="p-6">
          <p className="text-gray-600 mb-6">{message}</p>
          <div className="flex gap-3 justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-gray-300 text-gray-700 hover:bg-gray-100 transition-all duration-300"
            >
              {cancelText}
            </button>
            <button
              onClick={() => { onConfirm(); onClose(); }}
              className={`px-4 py-2 rounded-xl text-white ${v.button} transition-all duration-300 shadow-lg hover:shadow-xl`}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}