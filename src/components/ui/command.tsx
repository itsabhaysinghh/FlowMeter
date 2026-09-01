import React, { useEffect } from 'react';
import { Search } from 'lucide-react';

export interface CommandProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
  children: React.ReactNode;
}

export function Command({ className = '', children, ...props }: CommandProps) {
  return (
    <div
      className={`flex flex-col w-full bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export interface CommandDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

export function CommandDialog({ open, onOpenChange, children }: CommandDialogProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) {
        onOpenChange(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onOpenChange]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="fixed inset-0"
        onClick={() => onOpenChange(false)}
        aria-hidden="true"
      />
      <div className="relative w-full max-w-lg z-10 animate-in zoom-in-95 duration-150">
        {children}
      </div>
    </div>
  );
}

export interface CommandInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  className?: string;
  value?: string;
  onValueChange?: (val: string) => void;
}

export function CommandInput({
  className = '',
  value,
  onValueChange,
  onChange,
  placeholder = 'Type a command or search...',
  ...props
}: CommandInputProps) {
  return (
    <div className="flex items-center px-3.5 py-3 border-b border-slate-100 dark:border-slate-800/80 gap-2.5">
      <Search className="w-4 h-4 text-slate-400 shrink-0" />
      <input
        type="text"
        value={value}
        onChange={(e) => {
          onChange?.(e);
          onValueChange?.(e.target.value);
        }}
        placeholder={placeholder}
        className={`w-full bg-transparent text-xs font-bold text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none ${className}`}
        {...props}
      />
    </div>
  );
}

export interface CommandListProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
  children: React.ReactNode;
}

export function CommandList({ className = '', children, ...props }: CommandListProps) {
  return (
    <div
      className={`max-h-[300px] overflow-y-auto p-2 space-y-2 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export interface CommandEmptyProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
  children: React.ReactNode;
}

export function CommandEmpty({ className = '', children, ...props }: CommandEmptyProps) {
  return (
    <div
      className={`py-6 text-center text-xs font-semibold text-slate-400 dark:text-slate-500 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export interface CommandGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  heading?: string;
  className?: string;
  children: React.ReactNode;
}

export function CommandGroup({ heading, className = '', children, ...props }: CommandGroupProps) {
  return (
    <div className={`space-y-1 ${className}`} {...props}>
      {heading && (
        <div className="px-2 py-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          {heading}
        </div>
      )}
      {children}
    </div>
  );
}

export interface CommandItemProps extends React.HTMLAttributes<HTMLDivElement> {
  disabled?: boolean;
  onSelect?: () => void;
  className?: string;
  children: React.ReactNode;
}

export function CommandItem({
  disabled = false,
  onSelect,
  onClick,
  className = '',
  children,
  ...props
}: CommandItemProps) {
  return (
    <div
      onClick={(e) => {
        if (disabled) return;
        onClick?.(e);
        onSelect?.();
      }}
      className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer select-none ${
        disabled ? 'opacity-50 cursor-not-allowed' : ''
      } ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function CommandSeparator({ className = '' }: { className?: string }) {
  return <div className={`h-px bg-slate-100 dark:bg-slate-800 my-1 ${className}`} />;
}

export function CommandShortcut({ className = '', children }: { className?: string; children: React.ReactNode }) {
  return (
    <span className={`ml-auto text-[10px] font-mono tracking-widest text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded-md ${className}`}>
      {children}
    </span>
  );
}
