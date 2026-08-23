import React, { useState } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { ZoomIn, ZoomOut, RotateCcw, Activity } from 'lucide-react';
import type { FlowTrendDataPoint } from '../../types/meter.types';
import { formatNumber } from '../../utils/formatters';
import { GlowingBadge } from '../ui/glowing-badge';

interface FlowTrendChartProps {
  data?: FlowTrendDataPoint[] | null;
}

const CustomTrendTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const val = payload[0].value;
    return (
      <div className="p-3.5 bg-slate-900/95 dark:bg-slate-950/95 border border-slate-800 rounded-xl shadow-2xl backdrop-blur-md text-xs text-white max-w-[220px]">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-2 mb-2">
          <span className="text-[11px] font-semibold text-slate-400">Timestamp</span>
          <span className="font-bold text-slate-200">{label}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span className="text-slate-400">Flow Rate:</span>
          </div>
          <span className="font-extrabold text-emerald-400 text-sm tracking-tight">
            {formatNumber(val, 1)} L/min
          </span>
        </div>
      </div>
    );
  }
  return null;
};

export const FlowTrendChart: React.FC<FlowTrendChartProps> = ({ data }) => {
  const [zoomLevel, setZoomLevel] = useState<number>(1);

  if (!data || data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[300px] border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50/50 dark:bg-slate-900/30 p-6 text-center">
        <div className="p-3 rounded-full bg-slate-100 dark:bg-slate-800 text-emerald-500 mb-2">
          <Activity className="w-5 h-5 animate-pulse" />
        </div>
        <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
          No real-time flow rate trend telemetry received.
        </p>
        <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
          Sensor telemetry will stream automatically upon device transmission.
        </p>
      </div>
    );
  }

  // Filter or slice data based on zoom level
  const displayedData = zoomLevel > 1 
    ? data.slice(Math.floor(data.length / (zoomLevel * 1.5))) 
    : data;

  return (
    <div className="flex flex-col h-full">
      {/* Header Bar: Live Stream Status & Redesigned Zoom Controls */}
      <div className="flex items-center justify-between gap-3 mb-3 text-xs">
        {/* Live Stream Telemetry Indicator */}
        <GlowingBadge variant="success" pulse={true}>
          LIVE TELEMETRY STREAM
        </GlowingBadge>

        {/* Tactile Zoom Control Pill */}
        <div className="flex items-center gap-1 p-0.5 rounded-xl bg-slate-100/90 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/60 shadow-inner">
          <span className="text-slate-400 text-[10px] font-bold px-2 uppercase tracking-wider">
            1-MIN
          </span>

          <button
            onClick={() => setZoomLevel((prev) => Math.min(prev + 0.5, 3))}
            className="p-1.5 rounded-lg bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:text-emerald-600 dark:hover:text-emerald-400 shadow-xs border border-slate-200/50 dark:border-slate-700 transition-all active:scale-95 cursor-pointer"
            title="Zoom In (High Detail)"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setZoomLevel((prev) => Math.max(prev - 0.5, 1))}
            className="p-1.5 rounded-lg bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:text-emerald-600 dark:hover:text-emerald-400 shadow-xs border border-slate-200/50 dark:border-slate-700 transition-all active:scale-95 cursor-pointer"
            title="Zoom Out (Full View)"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          {zoomLevel > 1 && (
            <button
              onClick={() => setZoomLevel(1)}
              className="p-1.5 rounded-lg bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/50 shadow-xs border border-blue-200 dark:border-blue-800 transition-all active:scale-95 cursor-pointer"
              title="Reset Zoom"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Chart Canvas */}
      <div className="w-full h-[280px] flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={displayedData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
            <defs>
              <linearGradient id="flowTrendGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10B981" stopOpacity={0.25} />
                <stop offset="100%" stopColor="#10B981" stopOpacity={0.00} />
              </linearGradient>
            </defs>

            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke="#E2E8F0"
              opacity={0.5}
            />
            <XAxis
              dataKey="time"
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#64748B', fontSize: 11, fontWeight: 500 }}
              dy={8}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#64748B', fontSize: 11, fontWeight: 500 }}
              unit=" L/m"
            />
            <Tooltip content={<CustomTrendTooltip />} />
            <Area
              type="monotone"
              dataKey="flowRate"
              stroke="#10B981"
              strokeWidth={2.5}
              fill="url(#flowTrendGradient)"
              isAnimationActive={true}
              animationDuration={800}
              animationEasing="ease-in-out"
              activeDot={{
                r: 6,
                stroke: '#10B981',
                strokeWidth: 3,
                fill: '#FFFFFF',
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
