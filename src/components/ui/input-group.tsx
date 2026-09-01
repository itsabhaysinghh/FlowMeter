import React from 'react';

export interface InputGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
  children: React.ReactNode;
}

export function InputGroup({ className = '', children, ...props }: InputGroupProps) {
  return (
    <div
      className={`relative flex items-center w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 transition-all overflow-hidden ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export interface InputGroupInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  className?: string;
}

export const InputGroupInput = React.forwardRef<HTMLInputElement, InputGroupInputProps>(
  ({ className = '', ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={`flex-1 min-w-0 bg-transparent px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none ${className}`}
        {...props}
      />
    );
  }
);

InputGroupInput.displayName = 'InputGroupInput';

export interface InputGroupAddonProps extends React.HTMLAttributes<HTMLDivElement> {
  align?: 'inline-start' | 'inline-end';
  className?: string;
  children: React.ReactNode;
}

export function InputGroupAddon({
  align = 'inline-start',
  className = '',
  children,
  ...props
}: InputGroupAddonProps) {
  return (
    <div
      className={`flex items-center px-3 text-xs font-semibold text-slate-400 dark:text-slate-500 shrink-0 ${
        align === 'inline-end' ? 'border-l border-slate-100 dark:border-slate-800/80' : ''
      } ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
