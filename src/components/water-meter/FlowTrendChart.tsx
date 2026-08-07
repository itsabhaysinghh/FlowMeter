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
import { ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import type { FlowTrendDataPoint } from '../../types/meter.types';
import { formatNumber } from '../../utils/formatters';

interface FlowTrendChartProps {
  data?: FlowTrendDataPoint[] | null;
}

const CustomTrendTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const val = payload[0].value;
    return (
      <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl text-xs">
        <span className="font-semibold text-slate-500 dark:text-slate-400 block mb-1">
          Timestamp (1-min diff): {label}
        </span>
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
          <span className="text-slate-700 dark:text-slate-200">Flow Rate:</span>
          <span className="font-bold text-emerald-600 dark:text-emerald-400">
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
      <div className="flex flex-col items-center justify-center h-[300px] text-slate-400 dark:text-slate-500 text-xs">
        <p>No real-time flow rate trend telemetry received.</p>
      </div>
    );
  }

  // Filter or slice data based on zoom level
  const displayedData = zoomLevel > 1 
    ? data.slice(Math.floor(data.length / (zoomLevel * 1.5))) 
    : data;

  return (
    <div className="flex flex-col h-full">
      {/* Zoom Action Controls */}
      <div className="flex items-center justify-end gap-1.5 mb-3 text-xs">
        <span className="text-slate-400 text-[11px] font-medium mr-2">1-MIN RESOLUTION | ZOOM:</span>
        <button
          onClick={() => setZoomLevel((prev) => Math.min(prev + 0.5, 3))}
          className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
          title="Zoom In"
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => setZoomLevel((prev) => Math.max(prev - 0.5, 1))}
          className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
          title="Zoom Out"
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </button>
        {zoomLevel > 1 && (
          <button
            onClick={() => setZoomLevel(1)}
            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
            title="Reset Zoom"
          >
            <RotateCcw className="w-3.5 h-3.5 text-blue-500" />
          </button>
        )}
      </div>

      <div className="w-full h-[290px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={displayedData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
            <defs>
              <linearGradient id="flowTrendGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#22C55E" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#22C55E" stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" opacity={0.6} />
            <XAxis
              dataKey="time"
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#64748B', fontSize: 11 }}
              dy={8}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#64748B', fontSize: 11 }}
              unit=" L/m"
            />
            <Tooltip content={<CustomTrendTooltip />} />
            <Area
              type="monotone"
              dataKey="flowRate"
              stroke="#22C55E"
              strokeWidth={2.5}
              fillOpacity={1}
              fill="url(#flowTrendGradient)"
              activeDot={{ r: 6, stroke: '#22C55E', strokeWidth: 2, fill: '#FFFFFF' }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
