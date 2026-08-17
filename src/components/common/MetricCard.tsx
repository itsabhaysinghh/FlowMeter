import React from 'react';
import { motion } from 'framer-motion';

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
  trend,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15 }}
      className="p-5 bg-white border border-slate-200 rounded-xl shadow-[0_1px_3px_0_rgba(0,0,0,0.05)] flex flex-col justify-between"
    >
      {/* Top Row: Title & Icon */}
      <div className="flex items-start justify-between gap-3">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
          {title}
        </span>
        <div className="text-slate-400">
          {icon}
        </div>
      </div>

      {/* Middle Row: Big Number Value */}
      <div className="mt-2 flex items-baseline gap-1">
        <span className="text-2xl font-black text-slate-900 tracking-tight">
          {typeof value === 'number' ? value.toLocaleString() : value}
        </span>
        {unit && (
          <span className="text-xs font-bold text-slate-400 ml-0.5">
            {unit}
          </span>
        )}
      </div>

      {/* Bottom Row: Supporting Subtext / Trend */}
      {(subtitle || trend) && (
        <div className="mt-3 text-[11px] text-slate-400 font-medium flex items-center justify-between">
          {trend ? (
            <span className={trend.isUpward ? 'text-amber-500 font-bold' : 'text-emerald-500 font-bold'}>
              {trend.isUpward ? '↑' : '↓'} {trend.value}% <span className="text-slate-400 font-normal">{trend.label}</span>
            </span>
          ) : (
            <span className="truncate">{subtitle}</span>
          )}
        </div>
      )}
    </motion.div>
  );
};
