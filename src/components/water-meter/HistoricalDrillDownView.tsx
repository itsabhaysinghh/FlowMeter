import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Calendar,
  Clock,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Download,
  Activity,
  Droplets,
  Layers,
  ArrowRight,
  ArrowUpDown,
  Search,
  CheckCircle2,
  Gauge,
  TrendingUp,
  AlertCircle,
  BarChart2,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from 'recharts';
import type {
  DeviceOption,
  DrillDownLevel,
  DrillDownState,
  DrillDownSummary,
  DrillDownDataPoint,
} from '../../types/meter.types';
import { meterService } from '../../services/meter.service';
import {
  getIstDateInputValue,
  formatIstMonthYear,
  formatIstDayLabel,
  formatIstHourLabel,
  shiftIstMonth,
  shiftIstDay,
  shiftIstHour,
} from '../../utils/ist';
import { formatNumber, formatVolume, formatFlowRate } from '../../utils/formatters';
import { StatusBadge } from '../common/StatusBadge';
import { MetricCard } from '../common/MetricCard';
import { ChartCard } from '../common/ChartCard';
import { DatePicker } from '../ui/calendar';

interface HistoricalDrillDownViewProps {
  devices: DeviceOption[];
  initialDeviceId?: string;
}

type SortField = 'time' | 'flowRate' | 'totalLitres' | 'status';
type SortOrder = 'asc' | 'desc';

export const HistoricalDrillDownView: React.FC<HistoricalDrillDownViewProps> = ({
  devices,
  initialDeviceId,
}) => {
  // Device Selection
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>(() => {
    if (initialDeviceId && devices.some((d) => d.id === initialDeviceId)) {
      return initialDeviceId;
    }
    return devices[0]?.id || 'FLOSTAT_001';
  });

  // Keep device in sync if external initialDeviceId changes
  useEffect(() => {
    if (initialDeviceId && devices.some((d) => d.id === initialDeviceId)) {
      setSelectedDeviceId(initialDeviceId);
    }
  }, [initialDeviceId, devices]);

  // Hierarchical Navigation State (defaults dynamically to current IST year/month/date/hour)
  const [drillState, setDrillState] = useState<DrillDownState>(() => {
    const todayStr = getIstDateInputValue();
    const parts = todayStr.split('-');
    const currentYear = Number(parts[0]) || new Date().getFullYear();
    const currentMonth = Number(parts[1]) || (new Date().getMonth() + 1);
    const currentHour = new Date().getHours();

    return {
      level: 'year',
      year: currentYear,
      month: currentMonth,
      date: todayStr,
      hour: currentHour,
    };
  });

  // Data & Loading state
  const [summary, setSummary] = useState<DrillDownSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  // Table sorting & pagination (for Hour/Minute view)
  const [tableSearch, setTableSearch] = useState<string>('');
  const [sortField, setSortField] = useState<SortField>('time');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 10;
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  const selectedDeviceObj = useMemo(() => {
    return devices.find((d) => d.id === selectedDeviceId) || devices[0] || null;
  }, [devices, selectedDeviceId]);

  // Fetch drill-down data
  const fetchData = useCallback(async () => {
    if (!selectedDeviceId) return;
    setLoading(true);
    setError(null);

    try {
      const res = await meterService.getDrillDownData(selectedDeviceId, drillState);
      setSummary(res);
      setCurrentPage(1);
    } catch (err: any) {
      console.error('[HistoricalDrillDownView] Fetch error:', err);
      setError(err?.message || 'Failed to retrieve telemetry data for the selected period.');
    } finally {
      setLoading(false);
    }
  }, [selectedDeviceId, drillState]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Navigation handlers
  const navigateToLevel = (level: DrillDownLevel) => {
    setDrillState((prev) => ({ ...prev, level }));
  };

  const handleSelectYear = (year: number) => {
    setDrillState((prev) => ({ ...prev, year }));
  };

  const handleDrillIntoMonth = (monthNum: number) => {
    const mStr = String(monthNum).padStart(2, '0');
    const newDate = `${drillState.year}-${mStr}-01`;
    setDrillState((prev) => ({
      ...prev,
      month: monthNum,
      date: newDate,
      level: 'month',
    }));
  };

  const handleDrillIntoDay = (dateStr: string) => {
    const parts = dateStr.split('-');
    const m = Number(parts[1]) || drillState.month;
    const y = Number(parts[0]) || drillState.year;
    setDrillState((prev) => ({
      ...prev,
      year: y,
      month: m,
      date: dateStr,
      level: 'day',
    }));
  };

  const handleDrillIntoHour = (hourNum: number) => {
    setDrillState((prev) => ({
      ...prev,
      hour: hourNum,
      level: 'hour',
    }));
  };

  const handleStepBack = () => {
    if (drillState.level === 'hour') {
      navigateToLevel('day');
    } else if (drillState.level === 'day') {
      navigateToLevel('month');
    } else if (drillState.level === 'month') {
      navigateToLevel('year');
    }
  };

  // Stepping controls at each level
  const handleShiftPeriod = (delta: number) => {
    if (drillState.level === 'year') {
      setDrillState((prev) => ({ ...prev, year: prev.year + delta }));
    } else if (drillState.level === 'month') {
      const currentMonthStr = `${drillState.year}-${String(drillState.month).padStart(2, '0')}`;
      const newMonthStr = shiftIstMonth(currentMonthStr, delta);
      const [newY, newM] = newMonthStr.split('-').map(Number);
      setDrillState((prev) => ({
        ...prev,
        year: newY,
        month: newM,
        date: `${newY}-${String(newM).padStart(2, '0')}-01`,
      }));
    } else if (drillState.level === 'day') {
      const newDate = shiftIstDay(drillState.date, delta);
      const [newY, newM] = newDate.split('-').map(Number);
      setDrillState((prev) => ({
        ...prev,
        year: newY,
        month: newM,
        date: newDate,
      }));
    } else if (drillState.level === 'hour') {
      const shifted = shiftIstHour(drillState.date, drillState.hour, delta);
      const [newY, newM] = shifted.date.split('-').map(Number);
      setDrillState((prev) => ({
        ...prev,
        year: newY,
        month: newM,
        date: shifted.date,
        hour: shifted.hour,
      }));
    }
  };

  // CSV Export for Hour View
  const handleExportCSV = () => {
    if (!summary?.rawRecords || summary.rawRecords.length === 0) return;
    const success = meterService.exportDrillDownCSV(
      summary.rawRecords,
      selectedDeviceId,
      `${drillState.date}_hour_${drillState.hour}`
    );
    if (success) {
      setExportNotice(`Exported ${summary.rawRecords.length} minute records to CSV`);
      setTimeout(() => setExportNotice(null), 4000);
    }
  };

  // Table filtering & sorting for Hour/Minute level
  const filteredRecords = useMemo(() => {
    if (!summary?.rawRecords) return [];
    return summary.rawRecords.filter((r) => {
      const q = tableSearch.toLowerCase();
      return (
        r.time.toLowerCase().includes(q) ||
        r.duration.toLowerCase().includes(q) ||
        r.status.toLowerCase().includes(q) ||
        String(r.flowRate).includes(q) ||
        String(r.totalLitres).includes(q)
      );
    });
  }, [summary?.rawRecords, tableSearch]);

  const sortedRecords = useMemo(() => {
    return [...filteredRecords].sort((a, b) => {
      let aVal: any = a[sortField];
      let bVal: any = b[sortField];
      if (typeof aVal === 'string') {
        return sortOrder === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
    });
  }, [filteredRecords, sortField, sortOrder]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const totalPages = Math.ceil(sortedRecords.length / pageSize) || 1;
  const paginatedRecords = useMemo(() => {
    return sortedRecords.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  }, [sortedRecords, currentPage, pageSize]);

  const yearsList = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 9 }, (_, i) => currentYear - 5 + i);
  }, []);

  const monthNames = useMemo(() => [
    { value: 1, label: 'January', short: 'Jan' },
    { value: 2, label: 'February', short: 'Feb' },
    { value: 3, label: 'March', short: 'Mar' },
    { value: 4, label: 'April', short: 'Apr' },
    { value: 5, label: 'May', short: 'May' },
    { value: 6, label: 'June', short: 'Jun' },
    { value: 7, label: 'July', short: 'Jul' },
    { value: 8, label: 'August', short: 'Aug' },
    { value: 9, label: 'September', short: 'Sep' },
    { value: 10, label: 'October', short: 'Oct' },
    { value: 11, label: 'November', short: 'Nov' },
    { value: 12, label: 'December', short: 'Dec' },
  ], []);

  // Custom Chart Tooltip
  const CustomDrillTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const pt: DrillDownDataPoint = payload[0].payload;
      const val = payload[0].value;
      const isHourLevel = drillState.level === 'hour';

      return (
        <div className="p-3.5 bg-slate-900/95 dark:bg-slate-950/95 border border-slate-800 rounded-xl shadow-2xl backdrop-blur-md text-xs text-white max-w-[240px]">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-2 mb-2">
            <span className="text-[11px] font-semibold text-slate-400">
              {isHourLevel ? 'Reading Time' : 'Time Interval'}
            </span>
            <span className="font-bold text-slate-200">{pt.subLabel || label}</span>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-4">
              <span className="text-slate-400">
                {isHourLevel ? 'Flow Rate:' : 'Consumption:'}
              </span>
              <span className="font-extrabold text-blue-400 text-sm tracking-tight">
                {isHourLevel ? `${formatNumber(val, 2)} L/min` : `${formatNumber(val, 1)} L`}
              </span>
            </div>

            {!isHourLevel && pt.isPeak && (
              <div className="flex items-center justify-between gap-4">
                <span className="text-slate-400">Status:</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-950/60 text-amber-400 border border-amber-800/60">
                  Peak Usage
                </span>
              </div>
            )}

            {!isHourLevel && (
              <div className="pt-1.5 border-t border-slate-800/60 text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
                <span>Click bar to drill down</span>
                <ArrowRight className="w-3 h-3" />
              </div>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      
      {/* Top Banner & Dynamic Breadcrumb Navigation Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.05)] space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          
          {/* Header Title & Level Indicator */}
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600 border border-blue-100">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                  Hierarchical Historical Flow Analysis
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider bg-blue-100 text-blue-700">
                  {drillState.level === 'year' && 'Level 1: Year'}
                  {drillState.level === 'month' && 'Level 2: Month'}
                  {drillState.level === 'day' && 'Level 3: Day'}
                  {drillState.level === 'hour' && 'Level 4: Hour'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Dynamic time-hierarchy drill-down: Year &rarr; Month &rarr; Day &rarr; Hour &rarr; 1-Min Readings
              </p>
            </div>
          </div>

          {/* Device Selector Pill */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-400">Device:</span>
              <select
                value={selectedDeviceId}
                onChange={(e) => setSelectedDeviceId(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
              >
                {devices.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.id})
                  </option>
                ))}
              </select>
            </div>
            {selectedDeviceObj && (
              <span className="text-[11px] text-slate-400 hidden sm:inline">
                {selectedDeviceObj.facility} &bull; {selectedDeviceObj.location}
              </span>
            )}
          </div>
        </div>

        {/* Dynamic Breadcrumbs Chain */}
        <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={() => navigateToLevel('year')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              drillState.level === 'year'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
            }`}
          >
            <span>Year {drillState.year}</span>
          </button>

          <ChevronRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />

          <button
            type="button"
            onClick={() => navigateToLevel('month')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              drillState.level === 'month'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
            }`}
          >
            <span>{formatIstMonthYear(`${drillState.year}-${String(drillState.month).padStart(2, '0')}`, true)}</span>
          </button>

          {(drillState.level === 'day' || drillState.level === 'hour') && (
            <>
              <ChevronRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />
              <button
                type="button"
                onClick={() => navigateToLevel('day')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  drillState.level === 'day'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                }`}
              >
                <span>{formatIstDayLabel(drillState.date)}</span>
              </button>
            </>
          )}

          {drillState.level === 'hour' && (
            <>
              <ChevronRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-blue-600 text-white shadow-sm">
                <Clock className="w-3.5 h-3.5" />
                <span>{formatIstHourLabel(drillState.hour)}</span>
              </div>
            </>
          )}

          {/* Quick Step Back Button */}
          {drillState.level !== 'year' && (
            <button
              type="button"
              onClick={handleStepBack}
              className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all shadow-xs cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>
                Back to {drillState.level === 'hour' ? 'Day' : drillState.level === 'day' ? 'Month' : 'Year'}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Level-Specific Parameter Stepper Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-slate-200 p-4 rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
        
        {/* Left: Interactive Navigation & Step Selectors */}
        <div className="flex flex-wrap items-center gap-2">
          
          {/* Previous / Next Stepper buttons */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => handleShiftPeriod(-1)}
              className="p-1.5 rounded-lg hover:bg-white text-slate-600 hover:text-blue-600 transition-all cursor-pointer"
              title="Previous Period"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => handleShiftPeriod(1)}
              className="p-1.5 rounded-lg hover:bg-white text-slate-600 hover:text-blue-600 transition-all cursor-pointer"
              title="Next Period"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Level 1: Year Selector */}
          {drillState.level === 'year' && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-blue-200 bg-blue-50/70 text-xs font-bold text-slate-800">
              <Calendar className="w-3.5 h-3.5 text-blue-600" />
              <span className="text-slate-500 font-medium">Select Year:</span>
              <select
                value={drillState.year}
                onChange={(e) => handleSelectYear(Number(e.target.value))}
                className="bg-transparent font-extrabold text-blue-700 text-xs focus:outline-none cursor-pointer"
              >
                {yearsList.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Level 2: Month & Year Selector */}
          {drillState.level === 'month' && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-blue-200 bg-blue-50/70 text-xs font-bold text-slate-800">
              <Calendar className="w-3.5 h-3.5 text-blue-600" />
              <span className="text-slate-500 font-medium">Month:</span>
              <select
                value={drillState.month}
                onChange={(e) => handleDrillIntoMonth(Number(e.target.value))}
                className="bg-transparent font-extrabold text-blue-700 text-xs focus:outline-none cursor-pointer"
              >
                {monthNames.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
              <span className="text-slate-300">/</span>
              <select
                value={drillState.year}
                onChange={(e) => handleSelectYear(Number(e.target.value))}
                className="bg-transparent font-extrabold text-blue-700 text-xs focus:outline-none cursor-pointer"
              >
                {yearsList.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Level 3: Day DatePicker */}
          {drillState.level === 'day' && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-blue-200 bg-blue-50/70 text-xs font-bold text-slate-800">
              <Calendar className="w-3.5 h-3.5 text-blue-600" />
              <span className="text-slate-500 font-medium">Date:</span>
              <DatePicker
                value={drillState.date}
                onChange={handleDrillIntoDay}
              />
            </div>
          )}

          {/* Level 4: Hour Selector & Date */}
          {drillState.level === 'hour' && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-blue-200 bg-blue-50/70 text-xs font-bold text-slate-800">
              <Clock className="w-3.5 h-3.5 text-blue-600" />
              <span className="text-slate-500 font-medium">Hour:</span>
              <select
                value={drillState.hour}
                onChange={(e) => handleDrillIntoHour(Number(e.target.value))}
                className="bg-transparent font-extrabold text-blue-700 text-xs focus:outline-none cursor-pointer"
              >
                {Array.from({ length: 24 }, (_, i) => (
                  <option key={i} value={i}>
                    {formatIstHourLabel(i)}
                  </option>
                ))}
              </select>
              <span className="text-slate-300">|</span>
              <DatePicker
                value={drillState.date}
                onChange={handleDrillIntoDay}
              />
            </div>
          )}
        </div>

        {/* Right: Refresh & CSV Export Actions */}
        <div className="flex items-center gap-2">
          {drillState.level === 'hour' && (
            <button
              type="button"
              onClick={handleExportCSV}
              disabled={loading || !summary?.rawRecords || summary.rawRecords.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="w-3.5 h-3.5 text-blue-600" />
              <span>Export Hour CSV</span>
            </button>
          )}

          <button
            type="button"
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? 'Fetching...' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {exportNotice && (
        <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-semibold text-emerald-800">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{exportNotice}</span>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-xl text-xs font-semibold text-red-800">
          <AlertCircle className="w-4 h-4 text-red-600" />
          <span>{error}</span>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Period Consumption"
          value={summary ? formatNumber(summary.totalVolumeLitres, 1) : '—'}
          unit="Litres"
          subtitle={summary?.subtitle || 'Aggregated flow volume'}
          icon={<Droplets className="w-5 h-5" />}
          iconBgColor="bg-blue-50"
          iconTextColor="text-blue-600"
        />

        <MetricCard
          title="Average Flow Rate"
          value={summary ? formatNumber(summary.averageFlowRateLpm, 2) : '—'}
          unit="L/min"
          subtitle="Mean telemetry discharge rate"
          icon={<Gauge className="w-5 h-5" />}
          iconBgColor="bg-emerald-50"
          iconTextColor="text-emerald-600"
        />

        <MetricCard
          title="Peak Discharge Rate"
          value={summary ? formatNumber(summary.maximumFlowRateLpm, 2) : '—'}
          unit="L/min"
          subtitle="Highest reading during this period"
          icon={<TrendingUp className="w-5 h-5" />}
          iconBgColor="bg-amber-50"
          iconTextColor="text-amber-600"
        />

        <MetricCard
          title={drillState.level === 'hour' ? 'Sample Count' : 'Interval Segments'}
          value={summary ? formatNumber(summary.readingCount, 0) : '—'}
          unit={drillState.level === 'hour' ? 'Readings' : 'Bins'}
          subtitle={
            drillState.level === 'year'
              ? '12 calendar months'
              : drillState.level === 'month'
              ? 'Days in selected month'
              : drillState.level === 'day'
              ? '24 hourly intervals'
              : 'Authentic 1-minute samples'
          }
          icon={<Activity className="w-5 h-5" />}
          iconBgColor="bg-purple-50"
          iconTextColor="text-purple-600"
        />
      </div>

      {/* Interactive Main Chart Card */}
      <ChartCard
        title={summary?.title || 'Historical Flow Telemetry'}
        description={
          drillState.level === 'hour'
            ? 'Authentic 1-minute flow rate telemetry without interpolation'
            : 'Click any interval bar to drill down into higher resolution'
        }
        icon={<BarChart2 className="w-5 h-5" />}
      >
        {loading ? (
          <div className="flex flex-col items-center justify-center h-[320px] bg-slate-50/50 rounded-2xl">
            <Activity className="w-8 h-8 text-blue-500 animate-pulse mb-2" />
            <span className="text-xs font-semibold text-slate-500">Querying DynamoDB telemetry summary...</span>
          </div>
        ) : !summary || summary.dataPoints.length === 0 || summary.dataPoints.every((p) => p.value === 0) ? (
          <div className="flex flex-col items-center justify-center h-[320px] border border-dashed border-slate-200 rounded-2xl bg-slate-50/50 p-6 text-center">
            <div className="p-3 rounded-full bg-slate-100 text-slate-400 mb-2">
              <Droplets className="w-5 h-5" />
            </div>
            <p className="text-xs font-semibold text-slate-700">No telemetry recorded for this period</p>
            <p className="text-[11px] text-slate-400 mt-1">
              Navigate to a different month, day, or year using the controls above.
            </p>
          </div>
        ) : drillState.level === 'hour' ? (
          /* Hour / Minute-Level Continuous Area Chart */
          <div className="w-full h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={summary.dataPoints}
                margin={{ top: 15, right: 15, left: -10, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="hourFlowGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.6} />
                    <stop offset="100%" stopColor="#3B82F6" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" opacity={0.6} />
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
                  tickFormatter={(val) => `${val} L/m`}
                />
                <Tooltip content={<CustomDrillTooltip />} />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="#2563EB"
                  strokeWidth={2.5}
                  fill="url(#hourFlowGradient)"
                  dot={{ r: 3, fill: '#2563EB', stroke: '#FFFFFF', strokeWidth: 1.5 }}
                  activeDot={{ r: 6, fill: '#1D4ED8', stroke: '#FFFFFF', strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          /* Year / Month / Day Clickable Bar Chart */
          <div className="w-full h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={summary.dataPoints}
                margin={{ top: 15, right: 15, left: -10, bottom: 0 }}
                onMouseLeave={() => setActiveIndex(null)}
              >
                <defs>
                  <linearGradient id="drillBarGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3B82F6" stopOpacity={1} />
                    <stop offset="100%" stopColor="#1D4ED8" stopOpacity={0.9} />
                  </linearGradient>
                  <linearGradient id="drillPeakGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#F97316" stopOpacity={1} />
                    <stop offset="100%" stopColor="#D97706" stopOpacity={0.9} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" opacity={0.6} />
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
                <Tooltip content={<CustomDrillTooltip />} cursor={{ fill: 'rgba(241, 245, 249, 0.7)', rx: 6 }} />
                <Bar
                  dataKey="value"
                  radius={[6, 6, 0, 0]}
                  isAnimationActive={true}
                  animationDuration={500}
                  onClick={(entry: any) => {
                    const pointId = entry?.id || entry?.payload?.id;
                    if (!pointId) return;
                    if (drillState.level === 'year') {
                      handleDrillIntoMonth(Number(pointId));
                    } else if (drillState.level === 'month') {
                      handleDrillIntoDay(String(pointId));
                    } else if (drillState.level === 'day') {
                      handleDrillIntoHour(Number(pointId));
                    }
                  }}
                  onMouseEnter={(_, index) => setActiveIndex(index)}
                  className="cursor-pointer"
                >
                  {summary.dataPoints.map((entry, index) => {
                    const isHovered = activeIndex === index;
                    const isAnyHovered = activeIndex !== null;
                    const opacity = isAnyHovered ? (isHovered ? 1 : 0.5) : 1;
                    const fill = entry.isPeak ? 'url(#drillPeakGradient)' : 'url(#drillBarGradient)';
                    return (
                      <Cell
                        key={`cell-${index}`}
                        fill={fill}
                        opacity={opacity}
                        className="transition-all duration-150 cursor-pointer"
                      />
                    );
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </ChartCard>

      {/* Breakdown Grid / Telemetry Table */}
      {drillState.level === 'hour' ? (
        /* Level 4: Granular Raw Telemetry Table */
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.05)] space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Minute-Level Telemetry Log ({filteredRecords.length} records)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Authentic sensor records for {formatIstDayLabel(drillState.date)} {formatIstHourLabel(drillState.hour)}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search log..."
                  value={tableSearch}
                  onChange={(e) => {
                    setTableSearch(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 w-48"
                />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto w-full">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  <th
                    className="pb-3 pl-2 cursor-pointer select-none hover:text-slate-600"
                    onClick={() => handleSort('time')}
                  >
                    <div className="flex items-center gap-1">
                      <span>Timestamp (IST)</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th
                    className="pb-3 text-right cursor-pointer select-none hover:text-slate-600"
                    onClick={() => handleSort('flowRate')}
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>Flow Rate</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th
                    className="pb-3 text-right cursor-pointer select-none hover:text-slate-600"
                    onClick={() => handleSort('totalLitres')}
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>Interval Volume</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th className="pb-3 text-center">Duration</th>
                  <th
                    className="pb-3 pr-2 text-right cursor-pointer select-none hover:text-slate-600"
                    onClick={() => handleSort('status')}
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>Status</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {paginatedRecords.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-xs text-slate-400">
                      No raw readings found matching the current search criteria.
                    </td>
                  </tr>
                ) : (
                  paginatedRecords.map((r, i) => (
                    <tr key={r.id || i} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-2.5 pl-2 font-mono text-slate-700">{r.time}</td>
                      <td className="py-2.5 text-right font-bold text-slate-900">
                        {formatFlowRate(r.flowRate)}
                      </td>
                      <td className="py-2.5 text-right text-slate-700">
                        {formatVolume(r.totalLitres)}
                      </td>
                      <td className="py-2.5 text-center text-slate-500 font-mono text-[11px]">
                        {r.duration}
                      </td>
                      <td className="py-2.5 pr-2 text-right">
                        <StatusBadge status={r.status} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Table Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs text-slate-500">
              <span>
                Showing {(currentPage - 1) * pageSize + 1} to{' '}
                {Math.min(currentPage * pageSize, filteredRecords.length)} of {filteredRecords.length}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="p-1 rounded-md border border-slate-200 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="px-2 font-bold text-slate-800">
                  {currentPage} / {totalPages}
                </span>
                <button
                  type="button"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="p-1 rounded-md border border-slate-200 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Levels 1–3: Interval Summary Breakdown Grid & Drill-Down Actions */
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.05)] space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                {drillState.level === 'year'
                  ? 'Monthly Breakdown'
                  : drillState.level === 'month'
                  ? 'Daily Breakdown'
                  : 'Hourly Breakdown'}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Click any row or button below to drill down into higher resolution
              </p>
            </div>
          </div>

          <div className="overflow-x-auto w-full">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  <th className="pb-3 pl-2">
                    {drillState.level === 'year' ? 'Month' : drillState.level === 'month' ? 'Calendar Day' : 'Hour Window'}
                  </th>
                  <th className="pb-3 text-right">Consumption</th>
                  <th className="pb-3 text-right">Share</th>
                  <th className="pb-3 pr-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {summary?.dataPoints.map((pt) => {
                  const share =
                    summary.totalVolumeLitres > 0
                      ? ((pt.value / summary.totalVolumeLitres) * 100).toFixed(1)
                      : '0.0';

                  return (
                    <tr
                      key={pt.id}
                      onClick={() => {
                        if (drillState.level === 'year') {
                          handleDrillIntoMonth(Number(pt.id));
                        } else if (drillState.level === 'month') {
                          handleDrillIntoDay(pt.id);
                        } else if (drillState.level === 'day') {
                          handleDrillIntoHour(Number(pt.id));
                        }
                      }}
                      className="hover:bg-blue-50/50 transition-colors cursor-pointer group"
                    >
                      <td className="py-2.5 pl-2 font-semibold text-slate-800 flex items-center gap-2">
                        <span>{pt.subLabel || pt.label}</span>
                        {pt.isPeak && (
                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-700">
                            Peak
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 text-right font-extrabold text-slate-900">
                        {formatNumber(pt.value, 1)} L
                      </td>
                      <td className="py-2.5 text-right font-mono text-slate-500">
                        {share}%
                      </td>
                      <td className="py-2.5 pr-2 text-right">
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 group-hover:text-blue-700 group-hover:translate-x-0.5 transition-all"
                        >
                          <span>
                            {drillState.level === 'year'
                              ? 'View Month'
                              : drillState.level === 'month'
                              ? 'View Day'
                              : 'View Hour'}
                          </span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
};
