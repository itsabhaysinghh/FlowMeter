import React from 'react';

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'destructive' | 'info' | 'success';
  className?: string;
  children: React.ReactNode;
}

export function Alert({
  variant = 'default',
  className = '',
  children,
  ...props
}: AlertProps) {
  let variantStyles = 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-800';

  if (variant === 'destructive') {
    variantStyles = 'bg-rose-50 dark:bg-rose-950/40 text-rose-900 dark:text-rose-200 border-rose-200 dark:border-rose-800/60';
  } else if (variant === 'info') {
    variantStyles = 'bg-blue-50/80 dark:bg-blue-950/40 text-blue-900 dark:text-blue-200 border-blue-200 dark:border-blue-800/60';
  } else if (variant === 'success') {
    variantStyles = 'bg-emerald-50/80 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800/60';
  }

  return (
    <div
      role="alert"
      className={`relative w-full rounded-2xl border p-4 shadow-sm flex items-start gap-3.5 text-xs transition-all ${variantStyles} ${className}`}
      {...props}
    >
      {children}
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
