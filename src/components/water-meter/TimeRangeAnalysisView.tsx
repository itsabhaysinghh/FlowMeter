import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Calendar,
  Clock,
  Search,
  RotateCcw,
  Download,
  Printer,
  TrendingUp,
  Droplets,
  Activity,
  Gauge,
  CheckCircle2,
  AlertCircle,
  ZoomIn,
  ZoomOut,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  Layers,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import type {
  DeviceOption,
  HistoricalTimeRangeFilter,
  TimeRangeAnalysisSummary,
} from '../../types/meter.types';
import { meterService } from '../../services/meter.service';
import {
  getIstTimeShifted,
} from '../../utils/ist';
import { formatNumber, formatVolume, formatFlowRate } from '../../utils/formatters';
import { StatusBadge } from '../common/StatusBadge';
import { GlowingBadge } from '../ui/glowing-badge';
import { MetricCard } from '../common/MetricCard';

interface TimeRangeAnalysisViewProps {
  devices: DeviceOption[];
  initialDeviceId?: string;
}

type SortField = 'time' | 'flowRate' | 'totalLitres' | 'status';
type SortOrder = 'asc' | 'desc';

export const TimeRangeAnalysisView: React.FC<TimeRangeAnalysisViewProps> = ({
  devices,
  initialDeviceId,
}) => {
  const initialEnd = useMemo(() => getIstTimeShifted(0), []);
  const initialStart = useMemo(() => getIstTimeShifted(-60), []);

  // Filter state
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>(() => {
    if (initialDeviceId && devices.some((d) => d.id === initialDeviceId)) {
      return initialDeviceId;
    }
    return devices[0]?.id || 'FLOSTAT_001';
  });
  const [startDate, setStartDate] = useState<string>(initialStart.date);
  const [startTime, setStartTime] = useState<string>(initialStart.time);
  const [endDate, setEndDate] = useState<string>(initialEnd.date);
  const [endTime, setEndTime] = useState<string>(initialEnd.time);

  // Execution & data state
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<TimeRangeAnalysisSummary | null>(null);

  // Table state
  const [tableSearch, setTableSearch] = useState<string>('');
  const [sortField, setSortField] = useState<SortField>('time');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  // Chart zoom
  const [zoomLevel, setZoomLevel] = useState<number>(1);

  // Notification / export status
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  // Only synchronize when devices list first becomes available if not yet initialized
  const initializedRef = useRef(false);
  useEffect(() => {
    if (!initializedRef.current && devices.length > 0) {
      if (initialDeviceId && devices.some((d) => d.id === initialDeviceId)) {
        setSelectedDeviceId(initialDeviceId);
      } else if (!devices.some((d) => d.id === selectedDeviceId)) {
        setSelectedDeviceId(devices[0].id);
      }
      initializedRef.current = true;
    }
  }, [devices, initialDeviceId, selectedDeviceId]);

  // Execute time-range analysis query against backend API
  const handleExecuteAnalysis = useCallback(
    async (overrideFilter?: Partial<HistoricalTimeRangeFilter>) => {
      const devId = overrideFilter?.deviceId || selectedDeviceId;
      const sDate = overrideFilter?.startDate || startDate;
      const sTime = overrideFilter?.startTime || startTime;
      const eDate = overrideFilter?.endDate || endDate;
      const eTime = overrideFilter?.endTime || endTime;

      if (!devId) {
        setError('Please select a valid device.');
        return;
      }
      if (!sDate || !sTime || !eDate || !eTime) {
        setError('Please provide complete start and end date/time values.');
        return;
      }

      setError(null);
      setLoading(true);
      setExportNotice(null);

      try {
        const filter: HistoricalTimeRangeFilter = {
          deviceId: devId,
          startDate: sDate,
          startTime: sTime,
          endDate: eDate,
          endTime: eTime,
        };

        const result = await meterService.getHistoricalTimeRangeData(filter);
        setSummary(result);
        setCurrentPage(1);
      } catch (err: any) {
        console.error('[TimeRangeAnalysisView] Error loading data:', err);
        setError(
          err.message || 'Failed to fetch telemetry for the selected time range. Please verify your parameters.'
        );
        setSummary(null);
      } finally {
        setLoading(false);
      }
    },
    [selectedDeviceId, startDate, startTime, endDate, endTime]
  );

  // Run initial query on mount
  useEffect(() => {
    handleExecuteAnalysis();
  }, [handleExecuteAnalysis]);

  const handleReset = () => {
    const defaultDevId = initialDeviceId || devices[0]?.id || 'FLOSTAT_001';
    const start = getIstTimeShifted(-60);
    const end = getIstTimeShifted(0);
    setSelectedDeviceId(defaultDevId);
    setStartDate(start.date);
    setStartTime(start.time);
    setEndDate(end.date);
    setEndTime(end.time);
    setError(null);
    setTableSearch('');
    setCurrentPage(1);
    setZoomLevel(1);
    handleExecuteAnalysis({
      deviceId: defaultDevId,
      startDate: start.date,
      startTime: start.time,
      endDate: end.date,
      endTime: end.time,
    });
  };

  // CSV Export handler
  const handleExportCSV = () => {
    if (!summary || summary.readings.length === 0) return;
    const success = meterService.exportTimeRangeCSV(
      summary.readings,
      summary.deviceId,
      startDate,
      endDate
    );
    if (success) {
      setExportNotice('CSV export downloaded successfully.');
      setTimeout(() => setExportNotice(null), 4000);
    }
  };

  // PDF / Print Export handler
  const handleExportPDF = () => {
    if (!summary || summary.readings.length === 0) return;
    const success = meterService.exportTimeRangePDF(summary);
    if (success) {
      setExportNotice('Printable report opened in new tab.');
      setTimeout(() => setExportNotice(null), 4000);
    }
  };

  // Table filtering and sorting
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const filteredRecords = useMemo(() => {
    if (!summary || !summary.readings) return [];
    const search = tableSearch.toLowerCase().trim();
    if (!search) return summary.readings;

    return summary.readings.filter((item) => {
      return (
        item.time.toLowerCase().includes(search) ||
        item.status.toLowerCase().includes(search) ||
        String(item.flowRate).includes(search) ||
        String(item.totalLitres).includes(search) ||
        item.duration.toLowerCase().includes(search)
      );
    });
  }, [summary, tableSearch]);

  const sortedRecords = useMemo(() => {
    return [...filteredRecords].sort((a, b) => {
      if (sortField === 'time') {
        // IDs contain timestamp (e.g. FLOSTAT_002-1788165000)
        const tsA = Number(a.id.split('-')[1]) || 0;
        const tsB = Number(b.id.split('-')[1]) || 0;
        return sortOrder === 'asc' ? tsA - tsB : tsB - tsA;
      }
      const valA = a[sortField];
      const valB = b[sortField];
      if (typeof valA === 'string') {
        return sortOrder === 'asc'
          ? (valA as string).localeCompare(valB as string)
          : (valB as string).localeCompare(valA as string);
      }
      return sortOrder === 'asc'
        ? (valA as number) - (valB as number)
        : (valB as number) - (valA as number);
    });
  }, [filteredRecords, sortField, sortOrder]);

  const totalPages = Math.max(1, Math.ceil(sortedRecords.length / pageSize));
  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedRecords.slice(start, start + pageSize);
  }, [sortedRecords, currentPage, pageSize]);

  // Chart data sliced by zoom
  const chartData = useMemo(() => {
    if (!summary || !summary.flowTrend || summary.flowTrend.length === 0) return [];
    if (zoomLevel <= 1) return summary.flowTrend;
    const sliceCount = Math.max(5, Math.floor(summary.flowTrend.length / zoomLevel));
    return summary.flowTrend.slice(summary.flowTrend.length - sliceCount);
  }, [summary, zoomLevel]);

  // Custom Chart Tooltip
  const CustomChartTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const val = payload[0].value;
      return (
        <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl backdrop-blur-md text-xs text-white max-w-[240px]">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2">
            <span className="text-[11px] font-semibold text-slate-400">Time (IST)</span>
            <span className="font-bold text-slate-200">{label}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
              </span>
              <span className="text-slate-400">Flow Rate:</span>
            </div>
            <span className="font-extrabold text-blue-400 text-sm tracking-tight">
              {formatNumber(val, 2)} L/min
            </span>
          </div>
          <div className="flex items-center justify-between gap-4 mt-1.5 pt-1.5 border-t border-slate-800/60">
            <span className="text-slate-400">1-Min Volume:</span>
            <span className="font-bold text-slate-200 text-xs">
              {formatNumber(val, 2)} L
            </span>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="p-6 bg-white border border-slate-200 rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-blue-50 border border-blue-100 text-blue-600">
                <Clock className="w-5 h-5" />
              </div>
              <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
                Historical Time-Range Flow Analysis
              </h2>
              <GlowingBadge variant="info">IST (UTC+5:30)</GlowingBadge>
            </div>
            <p className="text-xs text-slate-500 font-medium">
              Extract precision unaggregated flow telemetry for any custom historical window directly from DynamoDB.
            </p>
          </div>

          {/* Action Export Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCSV}
              disabled={loading || !summary || summary.readingsCount === 0}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all shadow-xs disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              title="Download CSV report of current window"
            >
              <Download className="w-4 h-4 text-slate-500" />
              <span>Export CSV</span>
            </button>

            <button
              onClick={handleExportPDF}
              disabled={loading || !summary || summary.readingsCount === 0}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all shadow-xs disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              title="Open printable report for this window"
            >
              <Printer className="w-4 h-4 text-slate-500" />
              <span>Print / PDF</span>
            </button>
          </div>
        </div>

        {exportNotice && (
          <div className="mt-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{exportNotice}</span>
          </div>
        )}
      </div>

      {/* Filter Parameters Form Card */}
      <div className="p-6 bg-white border border-slate-200 rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.05)] space-y-5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-blue-600" />
            <h3 className="text-sm font-bold text-slate-900">Query Parameters</h3>
          </div>
          <span className="text-[11px] text-slate-400 font-medium">
            Inclusive DynamoDB Query Window
          </span>
        </div>

        {/* Inputs Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Device Selector */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
              Flow Meter Device
            </label>
            <select
              value={selectedDeviceId}
              onChange={(e) => setSelectedDeviceId(e.target.value)}
              className="w-full px-3 py-2 text-xs font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              {devices.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name || d.id} {d.id === 'FLOSTAT_001' ? '(Primary)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Start Date */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <Calendar className="w-3 h-3 text-blue-500" />
              Start Date (IST)
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 text-xs font-semibold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Start Time */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <Clock className="w-3 h-3 text-blue-500" />
              Start Time (IST)
            </label>
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-full px-3 py-2 text-xs font-semibold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* End Date */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <Calendar className="w-3 h-3 text-blue-500" />
              End Date (IST)
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 text-xs font-semibold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* End Time */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <Clock className="w-3 h-3 text-blue-500" />
              End Time (IST)
            </label>
            <input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="w-full px-3 py-2 text-xs font-semibold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Form Action Controls */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={handleReset}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>

          <button
            type="button"
            onClick={() => handleExecuteAnalysis()}
            disabled={loading}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-500/20 transition-all active:scale-95 disabled:opacity-60 cursor-pointer"
          >
            {loading ? (
              <>
                <Activity className="w-4 h-4 animate-spin" />
                <span>Querying DynamoDB...</span>
              </>
            ) : (
              <>
                <Search className="w-4 h-4" />
                <span>Analyze Window</span>
              </>
            )}
          </button>
        </div>

        {/* Error / Alert banner */}
        {error && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
            <button
              onClick={() => handleExecuteAnalysis()}
              className="underline text-rose-900 hover:text-rose-700 font-bold"
            >
              Retry
            </button>
          </div>
        )}
      </div>

      {/* Query Target Window Metadata Sub-Header */}
      {summary && (
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 rounded-xl bg-slate-100/80 border border-slate-200 text-xs text-slate-600 font-medium">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-800">Active Window:</span>
            <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200 font-semibold text-slate-700">
              {summary.startFormatted}
            </span>
            <span>&rarr;</span>
            <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200 font-semibold text-slate-700">
              {summary.endFormatted}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span>
              Device: <strong className="text-slate-800">{summary.deviceId}</strong>
            </span>
            <span className="text-slate-300">|</span>
            <span>
              Samples: <strong className="text-slate-800">{summary.readingsCount} records</strong>
            </span>
          </div>
        </div>
      )}

      {/* KPI Metric Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Total Water Volume"
            value={summary.totalConsumptionLitres}
            unit="Litres"
            subtitle={`${summary.readingsCount} interval samples aggregated`}
            icon={<Droplets className="w-5 h-5 text-blue-500" />}
          />

          <MetricCard
            title="Average Flow Rate"
            value={summary.averageFlowRateLpm}
            unit="L/min"
            subtitle="Mean telemetry velocity"
            icon={<Activity className="w-5 h-5 text-emerald-500" />}
          />

          <MetricCard
            title="Peak Flow Velocity"
            value={summary.maximumFlowRateLpm}
            unit="L/min"
            subtitle={`Min rate: ${summary.minimumFlowRateLpm} L/min`}
            icon={<Gauge className="w-5 h-5 text-amber-500" />}
          />

          <MetricCard
            title="Telemetry Window"
            value={summary.readingsCount}
            unit="Samples"
            subtitle={
              summary.firstReading
                ? `First: ${summary.firstReading.flowRate} L/min | Last: ${summary.lastReading?.flowRate} L/min`
                : 'No telemetry in range'
            }
            icon={<TrendingUp className="w-5 h-5 text-indigo-500" />}
          />
        </div>
      )}

      {/* Unaggregated Flow Trend Area Chart */}
      <div className="p-6 bg-white border border-slate-200 rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.05)] space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-base font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
              <Activity className="w-4 h-4 text-blue-600" />
              High-Resolution Flow Rate Curve
            </h3>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Unaggregated 1-minute discrete telemetry samples during selected window
            </p>
          </div>

          {/* Tactile Zoom Control Pill */}
          <div className="flex items-center gap-1 p-0.5 rounded-xl bg-slate-100 border border-slate-200 shadow-inner">
            <span className="text-slate-400 text-[10px] font-bold px-2 uppercase tracking-wider">
              ZOOM
            </span>
            <button
              onClick={() => setZoomLevel((prev) => Math.min(prev + 0.5, 3))}
              className="p-1.5 rounded-lg bg-white text-slate-700 hover:text-blue-600 shadow-xs border border-slate-200/50 transition-all cursor-pointer"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setZoomLevel((prev) => Math.max(prev - 0.5, 1))}
              className="p-1.5 rounded-lg bg-white text-slate-700 hover:text-blue-600 shadow-xs border border-slate-200/50 transition-all cursor-pointer"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            {zoomLevel > 1 && (
              <button
                onClick={() => setZoomLevel(1)}
                className="p-1.5 rounded-lg bg-white text-slate-700 hover:text-blue-600 shadow-xs border border-slate-200/50 transition-all cursor-pointer"
                title="Reset Zoom"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Chart Rendering */}
        {!summary || summary.readingsCount === 0 ? (
          <div className="flex flex-col items-center justify-center h-[280px] border border-dashed border-slate-200 rounded-2xl bg-slate-50/50 p-6 text-center">
            <div className="p-3 rounded-full bg-slate-100 text-blue-500 mb-2">
              <Activity className="w-5 h-5 animate-pulse" />
            </div>
            <p className="text-xs font-bold text-slate-700">
              No flow telemetry records found for this time range.
            </p>
            <p className="text-[11px] text-slate-400 mt-1 max-w-sm">
              Try adjusting the date, start time, or end time parameters above and click &quot;Analyze Window&quot;.
            </p>
          </div>
        ) : (
          <div className="h-[320px] w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 15, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="timeRangeFlowGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis
                  dataKey="time"
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  tickLine={false}
                  axisLine={{ stroke: '#cbd5e1' }}
                  dy={6}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(val) => `${val} L/m`}
                  dx={-4}
                />
                <Tooltip content={<CustomChartTooltip />} />
                <Area
                  type="monotone"
                  dataKey="flowRate"
                  stroke="#2563eb"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#timeRangeFlowGradient)"
                  dot={{ r: 3, fill: '#2563eb', strokeWidth: 1, stroke: '#ffffff' }}
                  activeDot={{ r: 6, fill: '#2563eb', stroke: '#ffffff', strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Detailed Telemetry Table */}
      <div className="p-6 bg-white border border-slate-200 rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.05)] space-y-4">
        {/* Table Header Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-base font-extrabold text-slate-900 tracking-tight">
              Window Telemetry Logs
            </h3>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Exact timestamped flow rate records returned by DynamoDB
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Search filter input */}
            <div className="relative">
              <input
                type="text"
                placeholder="Search logs..."
                value={tableSearch}
                onChange={(e) => {
                  setTableSearch(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 w-44 sm:w-56"
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            </div>

            {/* Page Size dropdown */}
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="px-2.5 py-1.5 text-xs font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none cursor-pointer"
            >
              <option value={10}>10 / page</option>
              <option value={25}>25 / page</option>
              <option value={50}>50 / page</option>
            </select>
          </div>
        </div>

        {/* Table Content */}
        {!summary || paginatedRecords.length === 0 ? (
          <div className="text-center py-12 text-slate-400 text-xs font-medium">
            {tableSearch ? 'No readings match your search query.' : 'No readings in this window.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider bg-slate-50/50">
                  <th
                    onClick={() => handleSort('time')}
                    className="py-3 px-4 cursor-pointer hover:text-slate-900 transition-colors"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Timestamp (IST)</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('flowRate')}
                    className="py-3 px-4 text-right cursor-pointer hover:text-slate-900 transition-colors"
                  >
                    <div className="flex items-center justify-end gap-1.5">
                      <span>Flow Rate</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('totalLitres')}
                    className="py-3 px-4 text-right cursor-pointer hover:text-slate-900 transition-colors"
                  >
                    <div className="flex items-center justify-end gap-1.5">
                      <span>Interval Volume</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                  <th className="py-3 px-4 text-center">Duration</th>
                  <th
                    onClick={() => handleSort('status')}
                    className="py-3 px-4 text-center cursor-pointer hover:text-slate-900 transition-colors"
                  >
                    <div className="flex items-center justify-center gap-1.5">
                      <span>Status</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                {paginatedRecords.map((record) => (
                  <tr key={record.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-semibold text-slate-900">
                      {record.time}
                    </td>
                    <td className="py-3 px-4 text-right font-extrabold text-blue-600">
                      {formatFlowRate(record.flowRate)}
                    </td>
                    <td className="py-3 px-4 text-right font-medium text-slate-800">
                      {formatVolume(record.totalLitres)}
                    </td>
                    <td className="py-3 px-4 text-center text-slate-500 font-medium">
                      {record.duration}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <StatusBadge status={record.status as any} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {summary && sortedRecords.length > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-100 text-xs text-slate-500">
            <span>
              Showing {(currentPage - 1) * pageSize + 1} to{' '}
              {Math.min(currentPage * pageSize, sortedRecords.length)} of {sortedRecords.length} records
            </span>

            <div className="flex items-center gap-1 self-end sm:self-auto">
              <button
                onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                title="Previous Page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <span className="px-3 py-1 font-bold text-slate-700">
                Page {currentPage} of {totalPages}
              </span>

              <button
                onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                disabled={currentPage >= totalPages}
                className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                title="Next Page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
