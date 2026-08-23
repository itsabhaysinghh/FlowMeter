import React, { useState } from 'react';
import { RotateCcw } from 'lucide-react';

export type RefreshButtonVariant = 'neutral' | 'primary' | 'outline' | 'ghost';
export type RefreshButtonSize = 'sm' | 'md' | 'lg' | 'icon-sm' | 'icon-md';

export interface RefreshButtonProps {
  variant?: RefreshButtonVariant;
  size?: RefreshButtonSize;
  label?: string;
  isLoading?: boolean;
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  className?: string;
  title?: string;
  disabled?: boolean;
}

const variantStyles: Record<RefreshButtonVariant, string> = {
  neutral: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200/80 dark:border-slate-700/60 shadow-xs',
  primary: 'bg-blue-600 text-white hover:bg-blue-700 border border-blue-600 shadow-sm',
  outline: 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 shadow-xs',
  ghost: 'bg-transparent text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white',
};

const sizeStyles: Record<RefreshButtonSize, { button: string; icon: string }> = {
  sm: { button: 'px-2.5 py-1 text-xs font-semibold gap-1.5 rounded-lg', icon: 'w-3 h-3' },
  md: { button: 'px-3 py-1.5 text-xs font-bold gap-2 rounded-xl', icon: 'w-3.5 h-3.5' },
  lg: { button: 'px-4 py-2 text-sm font-bold gap-2 rounded-xl', icon: 'w-4 h-4' },
  'icon-sm': { button: 'p-1.5 rounded-lg text-xs', icon: 'w-3.5 h-3.5' },
  'icon-md': { button: 'p-2 rounded-xl text-xs', icon: 'w-4 h-4' },
};

export const RefreshButton: React.FC<RefreshButtonProps> = ({
  variant = 'neutral',
  size = 'icon-sm',
  label,
  isLoading = false,
  onClick,
  className = '',
  title = 'Refresh telemetry data',
  disabled = false,
}) => {
  const [internalSpin, setInternalSpin] = useState(false);

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled || isLoading) return;
    setInternalSpin(true);
    onClick?.(e);
    setTimeout(() => setInternalSpin(false), 750);
  };

  const isSpinning = isLoading || internalSpin;
  const currentVariant = variantStyles[variant] || variantStyles.neutral;
  const currentSize = sizeStyles[size] || sizeStyles['icon-sm'];

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled || isLoading}
      title={title}
      className={`inline-flex items-center justify-center font-medium transition-all cursor-pointer active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${currentVariant} ${currentSize.button} ${className}`}
    >
      <RotateCcw
        className={`transition-transform duration-500 ${currentSize.icon} ${
          isSpinning ? 'animate-spin text-blue-500 dark:text-blue-400' : ''
        }`}
      />
      {label && <span>{label}</span>}
    </button>
  );
};
