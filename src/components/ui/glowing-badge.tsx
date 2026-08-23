import React from 'react';

export type GlowingBadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info';

export interface GlowingBadgeProps {
  variant?: GlowingBadgeVariant;
  pulse?: boolean;
  dot?: boolean;
  children?: React.ReactNode;
  className?: string;
}

const variantStyles: Record<
  GlowingBadgeVariant,
  {
    container: string;
    dotBg: string;
    pulseBg: string;
  }
> = {
  success: {
    container: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200/80 dark:border-emerald-900/60 shadow-emerald-500/10',
    dotBg: 'bg-emerald-500',
    pulseBg: 'bg-emerald-400',
  },
  warning: {
    container: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200/80 dark:border-amber-900/60 shadow-amber-500/10',
    dotBg: 'bg-amber-500',
    pulseBg: 'bg-amber-400',
  },
  error: {
    container: 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200/80 dark:border-rose-900/60 shadow-rose-500/10',
    dotBg: 'bg-rose-500',
    pulseBg: 'bg-rose-400',
  },
  info: {
    container: 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200/80 dark:border-blue-900/60 shadow-blue-500/10',
    dotBg: 'bg-blue-500',
    pulseBg: 'bg-blue-400',
  },
  default: {
    container: 'bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 shadow-slate-500/10',
    dotBg: 'bg-slate-500',
    pulseBg: 'bg-slate-400',
  },
};

export const GlowingBadge: React.FC<GlowingBadgeProps> = ({
  variant = 'default',
  pulse = true,
  dot = true,
  children,
  className = '',
}) => {
  const currentVariant = variantStyles[variant] || variantStyles.default;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border shadow-xs transition-all ${currentVariant.container} ${className}`}
    >
      {dot && (
        <span className="relative flex h-2 w-2 shrink-0">
          {pulse && (
            <span
              className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${currentVariant.pulseBg}`}
            />
          )}
          <span className={`relative inline-flex rounded-full h-2 w-2 ${currentVariant.dotBg}`} />
        </span>
      )}
      {children}
    </span>
  );
};
