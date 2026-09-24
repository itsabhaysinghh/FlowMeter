import React from 'react';
import { X } from 'lucide-react';

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'destructive' | 'info' | 'success';
  className?: string;
  onClose?: () => void;
  children: React.ReactNode;
}

export function Alert({
  variant = 'default',
  className = '',
  onClose,
  children,
  ...props
}: AlertProps) {
  let variantStyles = 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-800';

  if (variant === 'destructive') {
    variantStyles = 'bg-rose-50 dark:bg-rose-950/40 text-rose-900 dark:text-rose-200 border-rose-200 dark:border-rose-800/60';
  } else if (variant === 'info') {
    variantStyles = 'bg-[#00B4D8]/10 text-[#0A1F44] border-[#00B4D8]/30 dark:bg-[#00B4D8]/10 dark:text-[#00B4D8] dark:border-[#00B4D8]/30';
  } else if (variant === 'success') {
    variantStyles = 'bg-emerald-50/80 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800/60';
  }

  return (
    <div
      role="alert"
      className={`relative w-full rounded-2xl border p-4 shadow-sm flex items-start justify-between gap-3.5 text-xs transition-all ${variantStyles} ${className}`}
      {...props}
    >
      <div className="flex items-start gap-3.5 flex-1 min-w-0">
        {children}
      </div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer shrink-0"
          title="Dismiss alert"
          aria-label="Dismiss alert"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

export interface AlertTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
  className?: string;
  children: React.ReactNode;
}

export function AlertTitle({ className = '', children, ...props }: AlertTitleProps) {
  return (
    <h5 className={`font-extrabold leading-none tracking-tight text-sm mb-1 ${className}`} {...props}>
      {children}
    </h5>
  );
}

export interface AlertDescriptionProps extends React.HTMLAttributes<HTMLParagraphElement> {
  className?: string;
  children: React.ReactNode;
}

export function AlertDescription({ className = '', children, ...props }: AlertDescriptionProps) {
  return (
    <div className={`text-xs opacity-90 leading-relaxed ${className}`} {...props}>
      {children}
    </div>
  );
}
