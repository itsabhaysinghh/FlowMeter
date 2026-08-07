import React from 'react';
import type { DeviceStatus, ConnectionStatus, FlowStatus } from '../../types/meter.types';

interface StatusBadgeProps {
  status: DeviceStatus | ConnectionStatus | FlowStatus | string;
  type?: 'device' | 'connection' | 'flow';
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'md' }) => {
  const getStyle = () => {
    const s = String(status).toLowerCase();

    if (s === 'online' || s === 'connected' || s === 'normal') {
      return {
        bg: 'bg-emerald-50 dark:bg-emerald-950/40',
        text: 'text-emerald-700 dark:text-emerald-400',
        border: 'border-emerald-200 dark:border-emerald-800/60',
        dot: 'bg-emerald-500 animate-pulse',
      };
    }

    if (s === 'warning' || s === 'reconnecting' || s === 'peak') {
      return {
        bg: 'bg-amber-50 dark:bg-amber-950/40',
        text: 'text-amber-700 dark:text-amber-400',
        border: 'border-amber-200 dark:border-amber-800/60',
        dot: 'bg-amber-500 animate-pulse',
      };
    }

    if (s === 'offline' || s === 'disconnected' || s === 'low flow') {
      return {
        bg: 'bg-slate-100 dark:bg-slate-800/60',
        text: 'text-slate-600 dark:text-slate-400',
        border: 'border-slate-300 dark:border-slate-700',
        dot: 'bg-slate-400',
      };
    }

    return {
      bg: 'bg-blue-50 dark:bg-blue-950/40',
      text: 'text-blue-700 dark:text-blue-400',
      border: 'border-blue-200 dark:border-blue-800/60',
      dot: 'bg-blue-500',
    };
  };

  const style = getStyle();
  const px = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs font-medium';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border ${style.bg} ${style.text} ${style.border} ${px} capitalize tracking-wide transition-colors`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
      <span>{status}</span>
    </span>
  );
};
