import React from 'react';
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
import type { ConsumptionDataPoint, TimeRangeTab, DateRange } from '../../types/meter.types';
import { formatNumber } from '../../utils/formatters';

interface ConsumptionChartProps {
  data?: ConsumptionDataPoint[] | null;
  activeTab?: TimeRangeTab;
  customDateRange?: DateRange;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const val = payload[0].value;
    return (
      <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl text-xs">
        <span className="font-semibold text-slate-500 dark:text-slate-400 block mb-1">
          Time Slot: {label}
        </span>
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-sm bg-flostat-secondary" />
          <span className="text-slate-700 dark:text-slate-200">Consumption:</span>
          <span className="font-bold text-slate-900 dark:text-white">
            {formatNumber(val, 0)} Litres
          </span>
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
  // 1. Try YYYY-MM-DD
  const yyyyMmDdRegex = /^(\d{4})-(\d{2})-(\d{2})$/;
  const match = label.match(yyyyMmDdRegex);
  if (match) {
    const year = parseInt(match[1], 10);
    const month = parseInt(match[2], 10) - 1;
    const day = parseInt(match[3], 10);
    return new Date(year, month, day);
  }

  // 2. Try MMM DD (e.g., "Aug 05" or "Aug 5")
  const mmmDdRegex = /^([a-zA-Z]{3})\s+(\d{1,2})$/;
  const mmmDdMatch = label.match(mmmDdRegex);
  if (mmmDdMatch) {
    const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    const monthStr = mmmDdMatch[1].toLowerCase();
    const day = parseInt(mmmDdMatch[2], 10);
    const monthIndex = monthNames.indexOf(monthStr);
    if (monthIndex !== -1) {
      const today = new Date();
      const currentYear = today.getFullYear();
      const d = new Date(currentYear, monthIndex, day);
      if (d > today) {
        d.setFullYear(currentYear - 1);
      }
      return d;
    }
  }

  // 3. Fallback to standard new Date()
  const d = new Date(label);
  if (!isNaN(d.getTime())) {
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
  start.setDate(start.getDate() - 29); // 30 days including today
  
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
  const chartData = React.useMemo(() => {
    const inputData = data || [];
    
    if (activeTab === 'year' || activeTab === 'custom') {
      return inputData;
    }
    
    let targetLabels: string[] = [];
    let matchFn: (backendLabel: string, genLabel: string) => boolean;

    if (activeTab === 'today') {
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

  return (
    <div className="w-full h-[320px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" opacity={0.6} />
          <XAxis
            dataKey="label"
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#64748B', fontSize: 11 }}
            dy={8}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#64748B', fontSize: 11 }}
            tickFormatter={(val) => `${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(241, 245, 249, 0.4)' }} />
          <Bar dataKey="litres" radius={[4, 4, 0, 0]} fill="#2563EB">
            {chartData.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.isPeak ? '#F59E0B' : '#2563EB'}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
