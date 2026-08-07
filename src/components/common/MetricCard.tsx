import React from 'react';
import { motion } from 'framer-motion';
import { StatusBadge } from './StatusBadge';

interface MetricCardProps {
  title: string;
  value: string | number;
  unit?: string;
  subtitle?: string;
  icon: React.ReactNode;
  iconBgColor?: string;
  iconTextColor?: string;
  isLive?: boolean;
  connectionStatus?: string;
  trend?: {
    value: number;
    label: string;
    isUpward?: boolean;
  };
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  unit,
  subtitle,
  icon,
  iconBgColor = 'bg-blue-50 dark:bg-blue-950/40',
  iconTextColor = 'text-flostat-primary dark:text-blue-400',
  isLive = false,
  connectionStatus,
  trend,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="relative flex flex-col justify-between p-5 bg-white dark:bg-dark-card border border-flostat-border dark:border-dark-border rounded-2xl shadow-flostat hover:shadow-flostat-hover transition-all duration-300 group overflow-hidden"
    >
      {/* Subtle Accent Glow for Live Card */}
      {isLive && (
        <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />
      )}

      {/* Card Header: Icon + Title + Live/Status Indicator */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-xl ${iconBgColor} ${iconTextColor} transition-transform group-hover:scale-105`}>
            {icon}
          </div>
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {title}
            </span>
            {connectionStatus && (
              <div className="mt-0.5">
                <StatusBadge status={connectionStatus} type="connection" size="sm" />
              </div>
            )}
          </div>
        </div>

        {/* Animated Pulse Badge for Live Telemetry */}
        {isLive && (
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 text-[11px] font-semibold">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            LIVE
          </div>
        )}
      </div>

      {/* Main Metric Value & Unit Display */}
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-3xl lg:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">
          {typeof value === 'number' ? value.toLocaleString() : value}
        </span>
        {unit && (
          <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">
            {unit}
          </span>
        )}
      </div>

      {/* Subtitle / Timestamp Footer */}
      {(subtitle || trend) && (
        <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          {subtitle && <span>{subtitle}</span>}
          {trend && (
            <span
              className={`font-semibold flex items-center gap-0.5 ${
                trend.isUpward ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'
              }`}
            >
              {trend.isUpward ? '▲' : '▼'} {trend.value}% {trend.label}
            </span>
          )}
        </div>
      )}
    </motion.div>
  );
};
