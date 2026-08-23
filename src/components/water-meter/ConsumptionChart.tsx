import React, { useState } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from 'recharts';
import { Droplet } from 'lucide-react';
import type { ConsumptionDataPoint, TimeRangeTab, DateRange } from '../../types/meter.types';
import { formatNumber } from '../../utils/formatters';

interface ConsumptionChartProps {
  data?: ConsumptionDataPoint[] | null;
  activeTab?: TimeRangeTab;
  customDateRange?: DateRange;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const dataPoint = payload[0].payload;
    const val = payload[0].value;
    const isPeak = dataPoint?.isPeak;

    return (
      <div className="p-3.5 bg-slate-900/95 dark:bg-slate-950/95 border border-slate-800 rounded-xl shadow-2xl backdrop-blur-md text-xs text-white max-w-[220px]">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-2 mb-2">
          <span className="text-[11px] font-semibold text-slate-400">Time Interval</span>
          <span className="font-bold text-slate-200">{label}</span>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-4">
            <span className="text-slate-400">Consumption:</span>
            <span className="font-extrabold text-blue-400 text-sm tracking-tight">
              {formatNumber(val, 0)} L
            </span>
          </div>

          <div className="flex items-center justify-between gap-4">
            <span className="text-slate-400">Status:</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                isPeak
                  ? 'bg-amber-950/60 text-amber-400 border-amber-800/60'
                  : 'bg-blue-950/60 text-blue-400 border-blue-800/60'
              }`}
            >
              {isPeak ? 'Peak Usage' : 'Normal'}
            </span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

const normalizeTodayLabel = (label: string): string => {
  const hhMmRegex = /^(\d{1,2}):(\d{2})$/;
  const match = label.match(hhMmRegex);
  if (match) {
    const hour = parseInt(match[1], 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 === 0 ? 12 : hour % 12;
    const hourStr = hour12 < 10 ? `0${hour12}` : `${hour12}`;
    return `${hourStr} ${ampm}`;
  }

  const ampmRegex = /^(\d{1,2})(?::\d{2})?\s*(AM|PM)$/i;
  const ampmMatch = label.match(ampmRegex);
  if (ampmMatch) {
    const hour = parseInt(ampmMatch[1], 10);
    const ampm = ampmMatch[2].toUpperCase();
    const hourStr = hour < 10 ? `0${hour}` : `${hour}`;
    return `${hourStr} ${ampm}`;
  }

  return label;
};

const parseFlexibleDate = (label: string): Date | null => {
  if (!label) return null;
  const trimmed = label.trim();

  const yyyyMmDdMatch = trimmed.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (yyyyMmDdMatch) {
    const year = parseInt(yyyyMmDdMatch[1], 10);
    const month = parseInt(yyyyMmDdMatch[2], 10) - 1;
    const day = parseInt(yyyyMmDdMatch[3], 10);
    return new Date(year, month, day);
  }

  const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

  const ddMmmYyyyMatch = trimmed.match(/^(\d{1,2})[\s\-]+([a-zA-Z]{3})[\s\-]+(\d{4})$/);
  if (ddMmmYyyyMatch) {
    const day = parseInt(ddMmmYyyyMatch[1], 10);
    const monthStr = ddMmmYyyyMatch[2].toLowerCase();
    const year = parseInt(ddMmmYyyyMatch[3], 10);
    const monthIndex = monthNames.indexOf(monthStr);
    if (monthIndex !== -1) {
      return new Date(year, monthIndex, day);
    }
  }

  const mmmDdYyyyMatch = trimmed.match(/^([a-zA-Z]{3})[\s\-]+(\d{1,2})[\s\-]+(\d{4})$/);
  if (mmmDdYyyyMatch) {
    const monthStr = mmmDdYyyyMatch[1].toLowerCase();
    const day = parseInt(mmmDdYyyyMatch[2], 10);
    const year = parseInt(mmmDdYyyyMatch[3], 10);
    const monthIndex = monthNames.indexOf(monthStr);
    if (monthIndex !== -1) {
      return new Date(year, monthIndex, day);
    }
  }

  const d = new Date(trimmed);
  if (!isNaN(d.getTime())) {
    if (d.getFullYear() < 2020) {
      d.setFullYear(new Date().getFullYear());
    }
    return d;
  }

  return null;
};

const normalizeWeekLabel = (label: string): string => {
  const lower = label.toLowerCase();
  if (lower.startsWith('mon')) return 'Mon';
  if (lower.startsWith('tue')) return 'Tue';
  if (lower.startsWith('wed')) return 'Wed';
  if (lower.startsWith('thu')) return 'Thu';
  if (lower.startsWith('fri')) return 'Fri';
  if (lower.startsWith('sat')) return 'Sat';
  if (lower.startsWith('sun')) return 'Sun';

  const parsedDate = parseFlexibleDate(label);
  if (parsedDate) {
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return dayNames[parsedDate.getDay()];
  }
  return label;
};

const normalizeDateLabel = (label: string): string => {
  const yyyyMmDdRegex = /^(\d{4})-(\d{2})-(\d{2})$/;
  const match = label.match(yyyyMmDdRegex);
  if (match) {
    const year = parseInt(match[1], 10);
    const month = parseInt(match[2], 10) - 1;
    const day = parseInt(match[3], 10);
    const d = new Date(year, month, day);
    const monthStr = d.toLocaleDateString('en-US', { month: 'short' });
    const dayStr = day < 10 ? `0${day}` : `${day}`;
    return `${monthStr} ${dayStr}`;
  }

  const d = new Date(label);
  if (!isNaN(d.getTime())) {
    const monthStr = d.toLocaleDateString('en-US', { month: 'short' });
    const dayVal = d.getDate();
    const dayStr = dayVal < 10 ? `0${dayVal}` : `${dayVal}`;
    return `${monthStr} ${dayStr}`;
  }

  return label;
};

const generateMonthLabels = (): string[] => {
  const labels: string[] = [];
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - 29);

  const current = new Date(start);
  const end = new Date();
  end.setHours(23, 59, 59, 999);

  while (current <= end) {
    const monthStr = current.toLocaleDateString('en-US', { month: 'short' });
    const dayVal = current.getDate();
    const dayStr = dayVal < 10 ? `0${dayVal}` : `${dayVal}`;
    labels.push(`${monthStr} ${dayStr}`);
    current.setDate(current.getDate() + 1);
  }
  return labels;
};

export const ConsumptionChart: React.FC<ConsumptionChartProps> = ({
  data,
  activeTab = 'today',
}) => {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const chartData = React.useMemo(() => {
    const inputData = data || [];

    if (activeTab === 'custom') {
      return inputData;
    }

    let targetLabels: string[] = [];
    let matchFn: (backendLabel: string, genLabel: string) => boolean;

    if (activeTab === 'today' || activeTab === 'specific') {
      targetLabels = [
        '12 AM', '01 AM', '02 AM', '03 AM', '04 AM', '05 AM', '06 AM', '07 AM', '08 AM', '09 AM', '10 AM', '11 AM',
        '12 PM', '01 PM', '02 PM', '03 PM', '04 PM', '05 PM', '06 PM', '07 PM', '08 PM', '09 PM', '10 PM', '11 PM'
      ];
      matchFn = (backendLabel, genLabel) => {
        return normalizeTodayLabel(backendLabel) === normalizeTodayLabel(genLabel);
      };
    } else if (activeTab === 'week') {
      targetLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      matchFn = (backendLabel, genLabel) => {
        return normalizeWeekLabel(backendLabel) === genLabel;
      };
    } else if (activeTab === 'month') {
      targetLabels = generateMonthLabels();
      matchFn = (backendLabel, genLabel) => {
        return normalizeDateLabel(backendLabel) === normalizeDateLabel(genLabel);
      };
    } else if (activeTab === 'year') {
      targetLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      matchFn = (backendLabel, genLabel) => {
        return backendLabel.toLowerCase().includes(genLabel.toLowerCase());
      };
    } else {
      return inputData;
    }

    return targetLabels.map((label) => {
      const match = inputData.find((d) => matchFn(d.label, label));
      return {
        label,
        litres: match ? match.litres : 0,
        isPeak: match ? match.isPeak : false,
      };
    });
  }, [data, activeTab]);

  const hasData = chartData.some((d) => d.litres > 0);

  if (!hasData && (!data || data.length === 0)) {
    return (
      <div className="flex flex-col items-center justify-center h-[300px] border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50/50 dark:bg-slate-900/30 p-6 text-center">
        <div className="p-3 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 mb-2">
          <Droplet className="w-5 h-5" />
        </div>
        <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
          No telemetry data available for this period
        </p>
        <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
          Select another date or period tab to view consumption metrics.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full h-[320px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          margin={{ top: 15, right: 10, left: -15, bottom: 0 }}
          onMouseLeave={() => setActiveIndex(null)}
        >
          <defs>
            <linearGradient id="barBlueGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3B82F6" stopOpacity={1} />
              <stop offset="100%" stopColor="#1D4ED8" stopOpacity={0.9} />
            </linearGradient>
            <linearGradient id="barOrangeGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#F97316" stopOpacity={1} />
              <stop offset="100%" stopColor="#D97706" stopOpacity={0.9} />
            </linearGradient>
          </defs>

          <CartesianGrid
            strokeDasharray="3 3"
            vertical={false}
            stroke="#E2E8F0"
            opacity={0.5}
          />
          <XAxis
            dataKey="label"
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#64748B', fontSize: 11, fontWeight: 500 }}
            dy={8}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#64748B', fontSize: 11, fontWeight: 500 }}
            tickFormatter={(val) => `${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`}
          />
          <Tooltip
            content={<CustomTooltip />}
            cursor={{ fill: 'rgba(241, 245, 249, 0.7)', rx: 6 }}
          />
          <Bar
            dataKey="litres"
            radius={[6, 6, 0, 0]}
            isAnimationActive={true}
            animationDuration={600}
            animationEasing="ease-out"
            onMouseEnter={(_, index) => setActiveIndex(index)}
          >
            {chartData.map((entry, index) => {
              const isHovered = activeIndex === index;
              const isAnyHovered = activeIndex !== null;
              const opacity = isAnyHovered ? (isHovered ? 1 : 0.45) : 1;
              const fill = entry.isPeak ? 'url(#barOrangeGradient)' : 'url(#barBlueGradient)';

              return (
                <Cell
                  key={`cell-${index}`}
                  fill={fill}
                  opacity={opacity}
                  className="transition-all duration-200 cursor-pointer"
                />
              );
            })}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
