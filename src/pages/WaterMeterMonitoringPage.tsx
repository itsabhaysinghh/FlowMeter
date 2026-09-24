import React, { useState } from 'react';
import { 
  Activity, 
  Droplet, 
  BarChart2, 
  LayoutDashboard, 
  Server, 
  ChevronDown, 
  ChevronUp, 
  ChevronLeft,
  ChevronRight,
  Calendar, 
  Star, 
  Pin, 
  Search,
  Download,
  Clock,
  Zap,
  Trash2,
  CheckCircle2,
  Info,
  Layers,
} from 'lucide-react';
import { PieChart, PieSlice, PieCenter, Legend, type PieData } from '../components/ui/PieChart';
import type { WaterMeterDataResponse, ModuleState, TimeRangeTab, DeviceOption, DateRange, DeleteFlowMeterDataResult, SummaryResponse, LiveFlowMetrics } from '../types/meter.types';
import { useWaterMeterData } from '../hooks/useWaterMeterData';
import { meterService } from '../services/meter.service';
import { MetricCard } from '../components/common/MetricCard';
import { ChartCard } from '../components/common/ChartCard';
import { ConsumptionChart } from '../components/water-meter/ConsumptionChart';
import { FlowTrendChart } from '../components/water-meter/FlowTrendChart';
import { FlowHistoryTable } from '../components/water-meter/FlowHistoryTable';
import { TimeRangeAnalysisView } from '../components/water-meter/TimeRangeAnalysisView';
import { HistoricalDrillDownView } from '../components/water-meter/HistoricalDrillDownView';
import { ComparisonModeView } from '../components/water-meter/ComparisonModeView';
import { formatNumber } from '../utils/formatters';
import { formatIstMonthYear, shiftIstMonth, getIstDateInputValue } from '../utils/ist';
import { DeleteDataDialog } from '../components/water-meter/DeleteDataDialog';
import { GlowingBadge } from '../components/ui/glowing-badge';
import { RefreshButton } from '../components/unlumen-ui/primitives/refresh';
import { DatePicker, Calendar as CalendarWidget } from '../components/ui/calendar';
import { InputGroup, InputGroupInput, InputGroupAddon } from '../components/ui/input-group';
import { Alert, AlertTitle, AlertDescription } from '../components/ui/alert';
import {
  Command,
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
  CommandShortcut,
} from '../components/ui/command';

const DEVICE_COLOR_PALETTE = [
  '#00B4D8', // 01 Aqua Flow
  '#0A1F44', // 02 Deep Navy
  '#0284C7', // 03 Sky Blue
  '#4B5563', // 04 Slate Grey
  '#0891B2', // 05 Cyan Dark
  '#1E3A8A', // 06 Navy Slate
  '#06B6D4', // 07 Cyan Bright
  '#334155', // 08 Charcoal Slate
  '#2563EB', // 09 Royal Blue
  '#0F766E', // 10 Deep Teal
  '#3B82F6', // 11 Electric Blue
  '#64748B', // 12 Cool Slate
  '#0369A1', // 13 Ocean Blue
  '#1D4ED8', // 14 Deep Blue
];

export interface WaterMeterMonitoringPageProps {
  devStateOverride?: ModuleState;
  connectedDataStream?: WaterMeterDataResponse | null;
  devices: DeviceOption[];
  selectedDevice: DeviceOption | null;
  onDeviceChange?: (device: DeviceOption) => void;
}

const formatMonthLabel = (monthStr?: string, full = false) => {
  return formatIstMonthYear(monthStr, full);
};

const formatDateString = (dateStr?: string) => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = Number(parts[2]);
  const d = new Date(Date.UTC(year, month - 1, day));
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
};

// Inline details dashboard inside expandable table rows
interface DeviceInlineDashboardProps {
  device: DeviceOption;
  activeTab: TimeRangeTab;
  customDateRange: DateRange;
  specificDate?: string;
  selectedMonth?: string;
  selectedYear?: string;
  dataRefreshToken?: number;
  devStateOverride?: ModuleState;
  connectedStreamData?: WaterMeterDataResponse | null;
}

const DeviceInlineDashboard: React.FC<DeviceInlineDashboardProps> = ({
  device,
  activeTab,
  customDateRange,
  specificDate,
  selectedMonth,
  selectedYear,
  dataRefreshToken,
  devStateOverride,
  connectedStreamData,
}) => {
  const { state, data, lastRefreshed, refetch, refreshInterval, setRefreshInterval, apiError } = useWaterMeterData({
    activeTab,
    customDateRange,
    specificDate,
    selectedMonth,
    selectedYear,
    selectedDevice: device,
    dataRefreshToken,
    devStateOverride,
    connectedStreamData,
  });

  if (state === 'empty' || !data) {
    return (
      <div className="flex items-center justify-center py-16 bg-slate-50/10 dark:bg-slate-900/20 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
        <div className="flex flex-col items-center gap-3">
          <Activity className="w-6 h-6 text-[#00B4D8] animate-pulse" />
          <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold">
            {apiError ? 'AWS Telemetry Idle (Awaiting dynamic stream...)' : 'Connecting and streaming real-time telemetry graphs...'}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-white border border-slate-200 rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.05)] space-y-6">
      
      {/* Inline Dashboard Header with Refresh and Connection Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-flostat-border/60 dark:border-slate-800/40">
        <div className="flex items-center gap-3">
          <GlowingBadge
            variant={data.metadata.deviceStatus === 'online' ? 'success' : 'error'}
            pulse={data.metadata.deviceStatus === 'online'}
          >
            {data.metadata.deviceStatus === 'online' ? 'Online' : 'Offline'}
          </GlowingBadge>
          <span className="text-[11px] text-slate-400 dark:text-slate-400">
            Last seen: {data.metadata.lastUpdated} | Refreshed: {lastRefreshed}
          </span>
        </div>

        {/* Auto Refresh and Manual Refresh Selector */}
        <div className="flex items-center gap-2 self-end sm:self-auto">
          <div className="relative inline-block text-left">
            <select
              value={refreshInterval}
              onChange={(e) => setRefreshInterval(parseInt(e.target.value, 10))}
              className="appearance-none pr-8 pl-3 py-1.5 rounded-xl border border-flostat-border dark:border-slate-800 bg-white dark:bg-dark-card hover:bg-slate-50 dark:hover:bg-slate-800/80 text-slate-700 dark:text-slate-200 text-[11px] font-bold transition-all shadow-sm focus:outline-none cursor-pointer"
              title="Auto Refresh Settings"
            >
              <option value={5000} className="bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200">5s Refresh</option>
              <option value={10000} className="bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200">10s Refresh</option>
              <option value={30000} className="bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200">30s Refresh</option>
              <option value={60000} className="bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200">1m Refresh</option>
              <option value={300000} className="bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200">5m Refresh</option>
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-400">
              <ChevronDown className="w-3 h-3" />
            </div>
          </div>

          <RefreshButton
            variant="outline"
            size="icon-sm"
            onClick={() => refetch()}
            title="Refresh Telemetry Now"
          />
        </div>
      </div>

      {/* KPI Cards inside Expanded Area */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <MetricCard
          title="Live Flow Rate"
          value={formatNumber(data.metrics.liveFlowRate, 1)}
          unit="L/min"
          subtitle={`Connection: ${data.metrics.connectionStatus}`}
          icon={<Activity className="w-5 h-5" />}
          iconBgColor="bg-emerald-50 dark:bg-emerald-950/50"
          iconTextColor="text-emerald-600 dark:text-emerald-400"
          isLive={true}
          connectionStatus={data.metrics.connectionStatus}
        />

        <MetricCard
          title={`${
            activeTab === 'today'
              ? "Single Day's"
              : activeTab === 'week'
              ? "Last 7 Days'"
              : activeTab === 'specific'
              ? `Specific Date (${formatDateString(specificDate)})`
              : activeTab === 'month'
              ? `Month (${formatMonthLabel(selectedMonth)})`
              : activeTab === 'year'
              ? `Year (${selectedYear})`
              : "Custom Period"
          } Total Consumption`}
          value={formatNumber(data.metrics.todaysConsumption, 1)}
          unit="Litres"
          subtitle={`Aggregated volume for ${device.name}`}
          icon={<Droplet className="w-5 h-5" />}
          iconBgColor="bg-[#00B4D8]/10 dark:bg-[#00B4D8]/20"
          iconTextColor="text-[#00B4D8] dark:text-[#00B4D8]"
        />

        <MetricCard
          title="Average Flow Rate"
          value={formatNumber(data.metrics.averageFlowRate, 1)}
          unit="L/min"
          subtitle="Mean operational flow rate"
          icon={<BarChart2 className="w-5 h-5" />}
          iconBgColor="bg-[#0A1F44]/10 dark:bg-[#0A1F44]/20"
          iconTextColor="text-[#0A1F44] dark:text-slate-300"
        />
      </div>

      {/* Charts inside Expanded Area */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard
          title={`${device.name} Water Consumption`}
          description={
            activeTab === 'custom'
              ? `Custom date range (${customDateRange.startDate} to ${customDateRange.endDate})`
              : activeTab === 'specific'
              ? `Specific date (${formatDateString(specificDate)})`
              : activeTab === 'month'
              ? `Specific month (${formatMonthLabel(selectedMonth, true)})`
              : activeTab === 'year'
              ? `Specific year (${selectedYear})`
              : 'Interval consumption breakdown across selected timeframe'
          }
          icon={<Droplet className="w-5 h-5" />}
        >
          <ConsumptionChart
            data={data.consumptionTrend}
            activeTab={activeTab}
            customDateRange={customDateRange}
            selectedMonth={selectedMonth}
            selectedYear={selectedYear}
          />
        </ChartCard>

        <ChartCard
          title={`${device.name} Flow Rate Trend`}
          description="High-resolution 1-minute telemetry stream"
          icon={<Activity className="w-5 h-5" />}
        >
          <FlowTrendChart data={data.flowTrend} />
        </ChartCard>
      </div>

      {/* Flow History Log Table */}
      <FlowHistoryTable data={data.history} />
    </div>
  );
};

const TABS: { id: TimeRangeTab; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'Week' },
  { id: 'specific', label: 'Specific Date' },
  { id: 'month', label: 'Month' },
  { id: 'year', label: 'Year' },
  { id: 'custom', label: 'Custom' },
];

interface TimeFrameSelectorProps {
  activeTab: TimeRangeTab;
  setActiveTab: (tab: TimeRangeTab) => void;
  specificDate: string;
  setSpecificDate: (date: string) => void;
  selectedMonth: string;
  setSelectedMonth: (month: string) => void;
  selectedYear: string;
  setSelectedYear: (year: string) => void;
  customDateRange: DateRange;
  startDate: string;
  setStartDate: (date: string) => void;
  endDate: string;
  setEndDate: (date: string) => void;
  isDatePickerOpen: boolean;
  setIsDatePickerOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
  handlePreset: (days: number) => void;
  handleApplyRange: () => void;
  popoverRef: React.RefObject<HTMLDivElement | null>;
}

const TimeFrameSelector: React.FC<TimeFrameSelectorProps> = ({
  activeTab,
  setActiveTab,
  specificDate,
  setSpecificDate,
  selectedMonth,
  setSelectedMonth,
  selectedYear,
  setSelectedYear,
  customDateRange,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  isDatePickerOpen,
  setIsDatePickerOpen,
  handlePreset,
  handleApplyRange,
  popoverRef,
}) => {
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 7 }, (_, i) => currentYear - 3 + i);

  const formatDateLabel = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const [isSpecificPopoverOpen, setIsSpecificPopoverOpen] = useState(false);
  const specificPopoverRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (specificPopoverRef.current && !specificPopoverRef.current.contains(e.target as Node)) {
        setIsSpecificPopoverOpen(false);
      }
    };
    if (isSpecificPopoverOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isSpecificPopoverOpen]);

  const handleTabClick = (tabId: TimeRangeTab) => {
    setActiveTab(tabId);
    if (tabId === 'custom') {
      setIsDatePickerOpen(true);
      setIsSpecificPopoverOpen(false);
    } else if (tabId === 'specific') {
      setIsSpecificPopoverOpen(true);
      setIsDatePickerOpen(false);
    } else {
      setIsDatePickerOpen(false);
      setIsSpecificPopoverOpen(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Tab Segment Controls */}
      <div className="flex items-center p-1 bg-slate-100/85 dark:bg-slate-800/85 rounded-lg border border-slate-200 dark:border-slate-700">
        {TABS.map((tab) => {
          if (tab.id === 'specific') {
            const formattedDate = specificDate
              ? new Date(specificDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
              : '';

            return (
              <div className="relative inline-block" key={tab.id} ref={specificPopoverRef}>
                <button
                  type="button"
                  onClick={() => {
                    if (activeTab !== 'specific') {
                      handleTabClick('specific');
                    } else {
                      setIsSpecificPopoverOpen((prev) => !prev);
                    }
                  }}
                  className={`px-3 py-1 text-xs font-bold rounded transition-all capitalize cursor-pointer flex items-center gap-1.5 ${
                    activeTab === 'specific'
                      ? 'bg-white dark:bg-slate-700 text-[#00B4D8] shadow-sm border border-slate-200/50 dark:border-slate-600/50'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
                  }`}
                >
                  <span>{activeTab === 'specific' && formattedDate ? `Specific Date (${formattedDate})` : 'Specific Date'}</span>
                  {activeTab === 'specific' && (
                    <ChevronDown className={`w-3 h-3 transition-transform ${isSpecificPopoverOpen ? 'rotate-180' : ''}`} />
                  )}
                </button>

                {isSpecificPopoverOpen && activeTab === 'specific' && (
                  <div className="absolute left-0 top-full mt-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                    <CalendarWidget
                      captionLayout="dropdown"
                      selected={specificDate}
                      onSelect={(date: Date) => {
                        const yyyy = date.getFullYear();
                        const mm = String(date.getMonth() + 1).padStart(2, '0');
                        const dd = String(date.getDate()).padStart(2, '0');
                        setSpecificDate(`${yyyy}-${mm}-${dd}`);
                        setIsSpecificPopoverOpen(false);
                      }}
                    />
                  </div>
                )}
              </div>
            );
          }

          if (tab.id === 'month') {
            const formattedMonth = selectedMonth ? formatMonthLabel(selectedMonth) : '';
            return (
              <button
                key={tab.id}
                onClick={() => handleTabClick('month')}
                className={`px-3 py-1 text-xs font-bold rounded transition-all capitalize cursor-pointer ${
                  activeTab === 'month'
                    ? 'bg-white dark:bg-slate-700 text-[#00B4D8] shadow-sm border border-slate-200/50 dark:border-slate-600/50'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
                }`}
              >
                {activeTab === 'month' && formattedMonth ? `Month (${formattedMonth})` : 'Month'}
              </button>
            );
          }

          return (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab.id)}
              className={`px-3 py-1 text-xs font-bold rounded transition-all capitalize cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-white dark:bg-slate-700 text-[#00B4D8] shadow-sm border border-slate-200/50 dark:border-slate-600/50'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Month Picker */}
      {activeTab === 'month' && (
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-[#00B4D8]/30 bg-[#00B4D8]/5 text-xs font-semibold shadow-sm">
          <Calendar className="w-3.5 h-3.5 text-[#00B4D8] shrink-0" />
          <span className="text-slate-500 font-medium text-[11px] mr-0.5">Month:</span>

          <button
            type="button"
            onClick={() => setSelectedMonth(shiftIstMonth(selectedMonth, -1))}
            className="p-1 rounded-md hover:bg-[#00B4D8]/10 text-slate-600 hover:text-[#00B4D8] transition-colors cursor-pointer"
            title="Previous Month"
            aria-label="Previous Month"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>

          <select
            value={selectedMonth.split('-')[1] || '01'}
            onChange={(e) => {
              const currentYear = selectedMonth.split('-')[0] || new Date().getFullYear().toString();
              setSelectedMonth(`${currentYear}-${e.target.value}`);
            }}
            aria-label="Select month"
            className="bg-transparent text-slate-800 dark:text-white font-bold text-xs focus:outline-none cursor-pointer border-none py-0.5 px-1 rounded hover:bg-[#00B4D8]/10"
          >
            {[
              { value: '01', label: 'Jan' },
              { value: '02', label: 'Feb' },
              { value: '03', label: 'Mar' },
              { value: '04', label: 'Apr' },
              { value: '05', label: 'May' },
              { value: '06', label: 'Jun' },
              { value: '07', label: 'Jul' },
              { value: '08', label: 'Aug' },
              { value: '09', label: 'Sep' },
              { value: '10', label: 'Oct' },
              { value: '11', label: 'Nov' },
              { value: '12', label: 'Dec' },
            ].map((m) => (
              <option key={m.value} value={m.value} className="dark:bg-slate-900 text-slate-800 dark:text-white">
                {m.label}
              </option>
            ))}
          </select>

          <select
            value={selectedMonth.split('-')[0] || new Date().getFullYear().toString()}
            onChange={(e) => {
              const currentMonth = selectedMonth.split('-')[1] || '01';
              setSelectedMonth(`${e.target.value}-${currentMonth}`);
            }}
            aria-label="Select year"
            className="bg-transparent text-slate-800 dark:text-white font-bold text-xs focus:outline-none cursor-pointer border-none py-0.5 px-1 rounded hover:bg-[#00B4D8]/10"
          >
            {years.map((y) => (
              <option key={y} value={y.toString()} className="dark:bg-slate-900 text-slate-800 dark:text-white">
                {y}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => setSelectedMonth(shiftIstMonth(selectedMonth, 1))}
            className="p-1 rounded-md hover:bg-[#00B4D8]/10 text-slate-600 hover:text-[#00B4D8] transition-colors cursor-pointer"
            title="Next Month"
            aria-label="Next Month"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Year Picker */}
      {activeTab === 'year' && (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-[#00B4D8]/30 bg-[#00B4D8]/5 text-xs font-semibold shadow-sm">
          <Calendar className="w-3.5 h-3.5 text-[#00B4D8]" />
          <span className="text-slate-500 font-medium">Select Year:</span>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="bg-transparent text-slate-800 dark:text-white font-bold text-xs focus:outline-none cursor-pointer border-none"
          >
            {years.map((y) => (
              <option key={y} value={y.toString()} className="dark:bg-slate-900 text-slate-800 dark:text-white">
                {y}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Custom Date Range Picker */}
      {activeTab === 'custom' && (
        <div className="relative inline-block text-left shadow-sm" ref={popoverRef}>
          <button
            onClick={() => setIsDatePickerOpen(!isDatePickerOpen)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#00B4D8]/30 bg-[#00B4D8]/5 text-[#0A1F44] dark:text-[#00B4D8] text-xs font-semibold hover:bg-[#00B4D8]/10 transition-all shadow-sm cursor-pointer"
          >
            <Calendar className="w-3.5 h-3.5 text-[#00B4D8]" />
            <span>
              {formatDateLabel(customDateRange.startDate)} - {formatDateLabel(customDateRange.endDate)}
            </span>
            <ChevronDown className={`w-3.5 h-3.5 text-[#00B4D8] transition-transform ${isDatePickerOpen ? 'rotate-180' : ''}`} />
          </button>

          {isDatePickerOpen && (
            <div className="absolute left-1/2 -translate-x-1/2 md:left-auto md:translate-x-0 md:right-0 top-full mt-2 w-80 p-4 bg-white dark:bg-dark-card border border-flostat-border dark:border-slate-800 rounded-2xl shadow-2xl z-50 space-y-4">
              <div className="space-y-3">
                <h4 className="font-bold text-xs text-slate-800 dark:text-white">Custom Date Range</h4>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className="block text-[10px] text-slate-400 font-bold mb-1 uppercase">Start Date</label>
                    <DatePicker
                      value={startDate}
                      onChange={setStartDate}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 font-bold mb-1 uppercase">End Date</label>
                    <DatePicker
                      value={endDate}
                      onChange={setEndDate}
                    />
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-3">
                <div className="flex gap-1.5">
                  <button
                    onClick={() => handlePreset(7)}
                    className="px-2 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg text-[10px] font-bold cursor-pointer"
                  >
                    7 Days
                  </button>
                  <button
                    onClick={() => handlePreset(14)}
                    className="px-2 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg text-[10px] font-bold cursor-pointer"
                  >
                    14 Days
                  </button>
                </div>
                <button
                  onClick={handleApplyRange}
                  className="px-3.5 py-1.5 bg-[#00B4D8] hover:bg-[#0096B4] text-white rounded-lg text-[10px] font-bold flex items-center gap-1 shadow-sm cursor-pointer"
                >
                  Apply
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export const WaterMeterMonitoringPage: React.FC<WaterMeterMonitoringPageProps> = ({
  devStateOverride,
  connectedDataStream,
  devices,
  selectedDevice,
  onDeviceChange,
}) => {
  const [activeNav, setActiveNav] = useState<'overview' | 'devices' | 'compare' | 'timerange' | 'drilldown'>('overview');
  const [activeTab, setActiveTab] = useState<TimeRangeTab>(() => (localStorage.getItem('flostat_active_tab') as TimeRangeTab) || 'today');
  const [specificDate, setSpecificDate] = useState<string>(() => localStorage.getItem('flostat_specific_date') || new Date().toISOString().split('T')[0]);
  const [selectedMonth, setSelectedMonth] = useState<string>(() => localStorage.getItem('flostat_selected_month') || getIstDateInputValue().slice(0, 7));
  const [selectedYear, setSelectedYear] = useState<string>(() => localStorage.getItem('flostat_selected_year') || new Date().getFullYear().toString());
  const [customDateRange, setCustomDateRange] = useState<DateRange>(() => {
    const saved = localStorage.getItem('flostat_custom_date_range');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return { startDate: '2026-07-01', endDate: '2026-07-20' };
  });

  const [expandedDeviceId, setExpandedDeviceId] = useState<string | null>(null);
  const [showAllOverviewMeters, setShowAllOverviewMeters] = useState<boolean>(false);

  // Search, Filters & Pinning State for Devices Page
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filterPill, setFilterPill] = useState<'all' | 'online' | 'offline' | 'highest' | 'lowest'>('all');
  const [pinnedDevices, setPinnedDevices] = useState<string[]>(() => {
    const saved = localStorage.getItem('flostat_pinned_devices');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return ['FLOSTAT_001'];
  });
  const [favoriteDevices, setFavoriteDevices] = useState<string[]>(() => {
    const saved = localStorage.getItem('flostat_favorite_devices');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return [];
  });
  const [exportNotification, setExportNotification] = useState<string | null>(null);
  const [isDeleteDataOpen, setIsDeleteDataOpen] = useState(false);
  const [deletionNotification, setDeletionNotification] = useState<string | null>(null);
  const [dataRefreshToken, setDataRefreshToken] = useState(0);

  // Alert Cards Dismiss State
  const [showUpdateAlert, setShowUpdateAlert] = useState<boolean>(() => localStorage.getItem('flostat_update_alert_dismissed') !== 'true');
  const [showMeterStatusAlert, setShowMeterStatusAlert] = useState<boolean>(() => localStorage.getItem('flostat_meter_status_alert_dismissed') !== 'true');

  // Command Dialog State & ⌘K Shortcut
  const [isCommandOpen, setIsCommandOpen] = useState(false);
  const [commandSearch, setCommandSearch] = useState('');

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsCommandOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const filteredCommandDevices = React.useMemo(() => {
    if (!commandSearch.trim()) return devices;
    const q = commandSearch.toLowerCase();
    return devices.filter(
      (d) =>
        d.name.toLowerCase().includes(q) ||
        d.id.toLowerCase().includes(q) ||
        d.location.toLowerCase().includes(q) ||
        d.facility.toLowerCase().includes(q)
    );
  }, [devices, commandSearch]);

  // Sync states to localStorage
  React.useEffect(() => {
    localStorage.setItem('flostat_active_tab', activeTab);
  }, [activeTab]);

  React.useEffect(() => {
    localStorage.setItem('flostat_specific_date', specificDate);
  }, [specificDate]);

  React.useEffect(() => {
    localStorage.setItem('flostat_selected_month', selectedMonth);
  }, [selectedMonth]);

  React.useEffect(() => {
    localStorage.setItem('flostat_selected_year', selectedYear);
  }, [selectedYear]);

  React.useEffect(() => {
    localStorage.setItem('flostat_custom_date_range', JSON.stringify(customDateRange));
  }, [customDateRange]);

  React.useEffect(() => {
    localStorage.setItem('flostat_pinned_devices', JSON.stringify(pinnedDevices));
  }, [pinnedDevices]);

  React.useEffect(() => {
    localStorage.setItem('flostat_favorite_devices', JSON.stringify(favoriteDevices));
  }, [favoriteDevices]);


  // Date Range Popover States
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [startDate, setStartDate] = useState(customDateRange.startDate);
  const [endDate, setEndDate] = useState(customDateRange.endDate);
  const popoverRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsDatePickerOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handlePreset = (days: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - days);
    const startStr = start.toISOString().split('T')[0];
    const endStr = end.toISOString().split('T')[0];

    setStartDate(startStr);
    setEndDate(endStr);
    setCustomDateRange({ startDate: startStr, endDate: endStr });
    setIsDatePickerOpen(false);
  };

  const handleApplyRange = () => {
    setCustomDateRange({ startDate, endDate });
    setIsDatePickerOpen(false);
  };



  // Fetch telemetry data for the currently selected device
  const { data, refreshInterval, setRefreshInterval, refetch } = useWaterMeterData({
    activeTab,
    customDateRange,
    specificDate,
    selectedMonth,
    selectedYear,
    selectedDevice: selectedDevice || devices[0] || null,
    dataRefreshToken,
    devStateOverride,
    connectedStreamData: connectedDataStream,
  });

  const [deviceSnapshots, setDeviceSnapshots] = useState<Record<string, { consumption: number; flowRate: number }>>({});
  const snapshotSeqRef = React.useRef(0);

  React.useEffect(() => {
    let active = true;
    const currentSeq = ++snapshotSeqRef.current;

    async function loadDeviceSnapshots() {
      if (devices.length === 0) return;
      const targetDevices = devices;
      const results: Array<readonly [string, SummaryResponse | null, LiveFlowMetrics | null]> = [];
      const concurrency = 3;

      // Process devices in controlled chunks of 3 to keep all device metrics live and accurate
      for (let i = 0; i < targetDevices.length; i += concurrency) {
        if (!active || currentSeq !== snapshotSeqRef.current) break;
        const chunk = targetDevices.slice(i, i + concurrency);
        const chunkResults = await Promise.all(
          chunk.map(async (device) => {
            const isOffline = device.status === 'offline';
            const [summary, live] = await Promise.all([
              meterService.getConsumption(activeTab, device.id, customDateRange, specificDate, selectedMonth, selectedYear),
              isOffline
                ? Promise.resolve({ liveFlowRate: 0, todaysConsumption: 0, averageFlowRate: 0, connectionStatus: 'Disconnected' as const })
                : meterService.getLiveFlowRate(device.id),
            ]);

            return [device.id, summary, live] as const;
          })
        );
        results.push(...chunkResults);
      }

      if (active && currentSeq === snapshotSeqRef.current) {
        setDeviceSnapshots((prev) => {
          const next = { ...prev };

          for (const [deviceId, summary, live] of results) {
            const prevSnapshot = prev[deviceId];
            const summaryFailed = summary === null;
            const liveFailed = live === null;

            // If the query failed, preserve the previous valid snapshot rather than converting to 0
            const consumption = !summaryFailed
              ? (summary?.total_volume_litres ?? 0)
              : (prevSnapshot?.consumption ?? 0);

            const flowRate = !liveFailed
              ? (live?.liveFlowRate ?? 0)
              : (prevSnapshot?.flowRate ?? 0);

            // Only update if we received a response or already have a valid record
            if (!summaryFailed || !liveFailed || prevSnapshot) {
              next[deviceId] = { consumption, flowRate };
            }
          }
          return next;
        });
      }
    }
    void loadDeviceSnapshots();
    return () => {
      active = false;
    };
  }, [activeTab, customDateRange, dataRefreshToken, devices, specificDate, selectedMonth, selectedYear]);

  const getDeviceConsumption = React.useCallback((deviceId: string) => {
    return deviceSnapshots[deviceId]?.consumption ?? 0;
  }, [deviceSnapshots]);

  const getDeviceFlowRate = React.useCallback((deviceId: string) => {
    return deviceSnapshots[deviceId]?.flowRate ?? 0;
  }, [deviceSnapshots]);

  const rawPieData = React.useMemo(() => {
    return devices.map((d, index) => {
      const isSelected = selectedDevice?.id === d.id;
      const snapshotConsumption = getDeviceConsumption(d.id);
      const snapshotFlowRate = getDeviceFlowRate(d.id);

      const val = isSelected && data?.metrics.todaysConsumption !== undefined && data.metrics.todaysConsumption > 0
        ? data.metrics.todaysConsumption
        : snapshotConsumption;
      const flow = isSelected && data?.metrics.liveFlowRate !== undefined
        ? data.metrics.liveFlowRate
        : snapshotFlowRate;

      return {
        name: d.name || d.id,
        location: d.location || 'Site Tank',
        value: val,
        flowRate: flow,
        status: d.status || 'online',
        color: DEVICE_COLOR_PALETTE[index % DEVICE_COLOR_PALETTE.length],
      };
    });
  }, [devices, selectedDevice, data, getDeviceConsumption, getDeviceFlowRate]);

  const totalConsumption = rawPieData.reduce((sum, item) => sum + item.value, 0);

  const pieData = rawPieData.map((item) => ({
    ...item,
    percentage: totalConsumption > 0 ? (item.value / totalConsumption) * 100 : 0,
  }));

  const renderPieData = React.useMemo(() => {
    if (totalConsumption === 0) {
      return pieData.map((item) => ({
        ...item,
        value: 0,
        actualValue: 0,
      }));
    }
    
    return pieData.map((item) => ({
      ...item,
      value: item.value,
      actualValue: item.value,
    }));
  }, [pieData, totalConsumption]);

  const pieChartData: PieData[] = React.useMemo(() => {
    return renderPieData.map((item) => ({
      label: item.name,
      value: item.actualValue !== undefined ? item.actualValue : item.value,
      color: item.color,
      percentage: item.percentage,
    }));
  }, [renderPieData]);



  const toggleDeviceExpand = (deviceId: string, devOpt?: DeviceOption) => {
    if (devOpt) {
      onDeviceChange?.(devOpt);
    }
    setExpandedDeviceId((prev) => (prev === deviceId ? null : deviceId));
  };

  const togglePin = (deviceId: string) => {
    setPinnedDevices(prev => 
      prev.includes(deviceId) ? prev.filter(id => id !== deviceId) : [...prev, deviceId]
    );
  };

  const toggleFavorite = (deviceId: string) => {
    setFavoriteDevices(prev => 
      prev.includes(deviceId) ? prev.filter(id => id !== deviceId) : [...prev, deviceId]
    );
  };

  const handleExport = (format: string) => {
    setExportNotification(`Generating system analytical report in ${format} format...`);
    setTimeout(() => {
      setExportNotification(null);
      // Trigger mock file download
      const element = document.createElement("a");
      const file = new Blob([`Flostat Analytical Report - ${new Date().toLocaleDateString()}\nTotal Consumption: ${totalConsumption} L\n`], {type: 'text/plain'});
      element.href = URL.createObjectURL(file);
      element.download = `flostat-report-${activeTab}-${new Date().toISOString().slice(0,10)}.${format.toLowerCase()}`;
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
    }, 2000);
  };

  // Device sorting, searching and pinning filter pipeline
  const filteredAndSortedDevices = React.useMemo(() => {
    let result = devices.filter(d => 
      d.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      d.location.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (filterPill === 'online') {
      result = result.filter(d => d.status === 'online');
    } else if (filterPill === 'offline') {
      result = result.filter(d => d.status === 'offline');
    } else if (filterPill === 'highest') {
      result = [...result].sort((a, b) => {
        const consA = getDeviceConsumption(a.id);
        const consB = getDeviceConsumption(b.id);
        return consB - consA;
      });
    } else if (filterPill === 'lowest') {
      result = [...result].sort((a, b) => {
        const consA = getDeviceConsumption(a.id);
        const consB = getDeviceConsumption(b.id);
        return consA - consB;
      });
    }

    // Secondary bubble: Pinned devices always float to the top
    result = [...result].sort((a, b) => {
      const isAPinned = pinnedDevices.includes(a.id);
      const isBPinned = pinnedDevices.includes(b.id);
      if (isAPinned && !isBPinned) return -1;
      if (!isAPinned && isBPinned) return 1;
      return 0;
    });

    return result;
  }, [devices, searchTerm, filterPill, pinnedDevices, getDeviceConsumption]);
  const handleDataDeleted = (result: DeleteFlowMeterDataResult, deviceId: string) => {
    // Instantly reset local snapshot for the deleted device
    setDeviceSnapshots((prev) => ({
      ...prev,
      [deviceId]: { consumption: 0, flowRate: 0 },
    }));
    setDataRefreshToken((token) => token + 1);
    refetch();

    let countMessage = 'Data deletion request processed.';
    if (result.deletedCount === 0) {
      countMessage = `0 records found for ${deviceId} in the selected date range. If your data is from a different time period, select that date range or 'Delete full records'.`;
    } else if (result.deletedCount !== undefined && result.deletedCount > 0) {
      countMessage = `Successfully deleted ${new Intl.NumberFormat('en-IN').format(result.deletedCount)} record${result.deletedCount === 1 ? '' : 's'} from ${deviceId}. Device logs updated.`;
    } else if (result.message) {
      countMessage = result.message;
    }

    setDeletionNotification(countMessage);
    window.setTimeout(() => setDeletionNotification(null), 7000);
  };

  return (
    <div className="w-full max-w-[1600px] mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
      
      {/* Top Global SaaS Status & Health Ticker */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-3 px-5 bg-white border border-slate-200 rounded-xl text-[11px] font-semibold text-slate-500 shadow-[0_1px_3px_0_rgba(0,0,0,0.05)] font-sans">
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="text-slate-500">System Health:</span>
            <GlowingBadge variant="success" pulse={true}>
              98.2% Optimal
            </GlowingBadge>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-500">Meters Status:</span>
            <GlowingBadge variant="info" pulse={false}>
              {devices.filter(d => d.status === 'online').length} Online{devices.filter(d => d.status === 'offline').length > 0 ? ` | ${devices.filter(d => d.status === 'offline').length} Standby` : ''}
            </GlowingBadge>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-slate-500">
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-700 font-medium">
              {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
            </span>
          </div>
          <span className="hidden sm:inline h-4 w-px bg-slate-200" />
          <span>Last Sync: <span className="text-slate-700 font-semibold">{data ? data.metadata.lastUpdated : 'Just now'}</span></span>
          {data && (
            <>
              <span className="hidden sm:inline h-4 w-px bg-slate-200" />
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Refresh:</span>
                <div className="relative inline-block text-left">
                  <select
                    value={refreshInterval}
                    onChange={(e) => setRefreshInterval(parseInt(e.target.value, 10))}
                    className="appearance-none pr-7 pl-2 py-1 rounded border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-[10px] font-bold transition-all focus:outline-none cursor-pointer"
                    title="Auto Refresh Settings"
                  >
                    <option value={5000}>5s</option>
                    <option value={10000}>10s</option>
                    <option value={30000}>30s</option>
                    <option value={60000}>1m</option>
                    <option value={300000}>5m</option>
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-1.5 text-slate-400">
                    <ChevronDown className="w-3 h-3" />
                  </div>
                </div>
                <RefreshButton
                  variant="outline"
                  size="icon-sm"
                  onClick={() => refetch()}
                  title="Refresh Now"
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Dynamic Dashboard Alerts */}
      {(showUpdateAlert || showMeterStatusAlert) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {showUpdateAlert && (
            <Alert
              variant="info"
              onClose={() => {
                setShowUpdateAlert(false);
                localStorage.setItem('flostat_update_alert_dismissed', 'true');
              }}
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <AlertTitle>New update available</AlertTitle>
                <AlertDescription>
                  A new update has been pushed to GitHub.
                  <br />
                  <strong>Latest update:</strong> Data consistency, Shadcn calendar & input-group search features.
                </AlertDescription>
              </div>
            </Alert>
          )}

          {showMeterStatusAlert && (
            <Alert
              variant="default"
              onClose={() => {
                setShowMeterStatusAlert(false);
                localStorage.setItem('flostat_meter_status_alert_dismissed', 'true');
              }}
            >
              <Info className="w-4 h-4 text-[#00B4D8] shrink-0 mt-0.5" />
              <div>
                <AlertTitle>Meter status</AlertTitle>
                <AlertDescription>
                  <strong>{devices.filter(d => d.status === 'online').length}</strong> meters are currently active out of{" "}
                  <strong>{devices.length}</strong> total meters.
                </AlertDescription>
              </div>
            </Alert>
          )}
        </div>
      )}

      {deletionNotification && (
        <div role="status" className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-700 shadow-sm dark:border-emerald-900/60 dark:bg-emerald-950/25 dark:text-emerald-300">
          <span>{deletionNotification}</span>
          <button type="button" onClick={() => setDeletionNotification(null)} className="text-emerald-600 hover:text-emerald-900 dark:text-emerald-400 dark:hover:text-emerald-100" aria-label="Dismiss success message">×</button>
        </div>
      )}

      {/* Main Two-Column Sidebar Layout */}
      <div className="flex flex-col lg:flex-row gap-6 min-h-[calc(100vh-140px)]">
        {/* Left Compact Sidebar */}
        <aside className="w-full lg:w-56 shrink-0 self-start space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-[0_1px_3px_0_rgba(0,0,0,0.05)] space-y-1.5 font-sans">
            <div className="flex items-center gap-2.5 px-2 pb-3 border-b border-slate-100 mb-1">
              <img src="/flostat-logo.png" alt="Flostat Logo" className="w-8 h-8 rounded-lg object-contain border border-slate-100 shadow-sm" />
              <div>
                <span className="font-black text-xs text-slate-900 tracking-tight block">FLOSTAT</span>
                <span className="text-[9px] font-semibold text-slate-400 block -mt-0.5">Water Monitoring</span>
              </div>
            </div>

            <div className="px-3 pb-2 text-[10px] font-bold tracking-wider uppercase text-slate-400">
              Operations
            </div>
            
            <button
              onClick={() => setActiveNav('overview')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${
                activeNav === 'overview'
                  ? 'bg-[#00B4D8] text-white shadow-md shadow-[#00B4D8]/20'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>Overview Dashboard</span>
            </button>

            <button
              onClick={() => setActiveNav('devices')}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${
                activeNav === 'devices'
                  ? 'bg-[#00B4D8] text-white shadow-md shadow-[#00B4D8]/20'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <div className="flex items-center gap-3">
                <Server className="w-4 h-4" />
                <span>Meters Catalog</span>
              </div>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold transition-all ${
                activeNav === 'devices'
                  ? 'bg-[#0096B4] text-white'
                  : 'bg-slate-100 text-slate-650'
              }`}>
                {devices.length}
              </span>
            </button>

            <button
              onClick={() => setActiveNav('compare')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${
                activeNav === 'compare'
                  ? 'bg-[#00B4D8] text-white shadow-md shadow-[#00B4D8]/20'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Zap className="w-4 h-4" />
              <span>Comparison Mode</span>
            </button>

            <button
              onClick={() => setActiveNav('timerange')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${
                activeNav === 'timerange'
                  ? 'bg-[#00B4D8] text-white shadow-md shadow-[#00B4D8]/20'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Clock className="w-4 h-4" />
              <span>Time-Range Analysis</span>
            </button>

            <button
              onClick={() => setActiveNav('drilldown')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${
                activeNav === 'drilldown'
                  ? 'bg-[#00B4D8] text-white shadow-md shadow-[#00B4D8]/20'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>Historical Drill-Down</span>
            </button>

          </div>
        </aside>

        {/* Right Main Content Pane */}
        <div className="flex-1 min-w-0 space-y-6">

          {/* VIEW 1: Overview Executive Page */}
          {activeNav === 'overview' && (
            <div className="space-y-8">
              
              {/* Overview Executive Header */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-flostat-border/60 dark:border-slate-800/80">
                <div>
                  <h2 className="text-base font-bold text-slate-800 tracking-tight">
                    Overall Facility Overview
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Real-time facility diagnostics, water consumption distributions, and device rankings
                  </p>
                </div>

                {/* Period Select Button Tabs */}
                <TimeFrameSelector
                  activeTab={activeTab}
                  setActiveTab={setActiveTab}
                  specificDate={specificDate}
                  setSpecificDate={setSpecificDate}
                  selectedMonth={selectedMonth}
                  setSelectedMonth={setSelectedMonth}
                  selectedYear={selectedYear}
                  setSelectedYear={setSelectedYear}
                  customDateRange={customDateRange}
                  startDate={startDate}
                  setStartDate={setStartDate}
                  endDate={endDate}
                  setEndDate={setEndDate}
                  isDatePickerOpen={isDatePickerOpen}
                  setIsDatePickerOpen={setIsDatePickerOpen}
                  handlePreset={handlePreset}
                  handleApplyRange={handleApplyRange}
                  popoverRef={popoverRef}
                />
              </div>



              {/* TIER 2: Distribution Donut Chart & Device Table (2 columns) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
                
                {/* Left Column: Donut Chart */}
                <div className="lg:col-span-5 bg-white border border-slate-200 p-5 rounded-xl shadow-[0_1px_3px_0_rgba(0,0,0,0.05)] flex flex-col">
                  <div>
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Consumption Allocation</h3>
                    <p className="text-[10px] text-slate-500 dark:text-dark-muted mt-0.5">Device percentage share of aggregate volume</p>
                  </div>
                  
                  <div className="flex flex-col items-center justify-center pt-2 pb-1 flex-1">
                    <PieChart data={pieChartData} size={230} innerRadius={60} padAngle={0.04}>
                      {pieChartData.map((_, index) => (
                        <PieSlice
                          key={index}
                          index={index}
                          showGlow={true}
                          hoverEffect="translate"
                          hoverOffset={8}
                        />
                      ))}
                      <PieCenter>
                        {({ hoveredData, totalValue }) => (
                          <div className="flex flex-col items-center justify-center text-center">
                            <span className="text-[10px] font-bold tracking-wider text-slate-400 dark:text-slate-500 uppercase">
                              {hoveredData ? hoveredData.label : 'Total'}
                            </span>
                            <span className="text-lg font-extrabold text-slate-900 dark:text-white mt-0.5">
                              {formatNumber(hoveredData ? hoveredData.value : totalValue, 0)} L
                            </span>
                            {hoveredData ? (
                              <span className="text-[9px] font-bold text-emerald-500 uppercase mt-0.5">
                                {hoveredData.percentage.toFixed(1)}% Share
                              </span>
                            ) : (
                              <span className="text-[9px] font-semibold text-slate-400 dark:text-slate-500 uppercase mt-0.5">
                                {activeTab === 'today'
                                  ? 'Today'
                                  : activeTab === 'week'
                                  ? 'Last 7 Days'
                                  : activeTab === 'specific'
                                  ? formatDateString(specificDate)
                                  : activeTab === 'month'
                                  ? formatMonthLabel(selectedMonth)
                                  : activeTab === 'year'
                                  ? selectedYear
                                  : `${formatDateString(customDateRange.startDate)} - ${formatDateString(customDateRange.endDate)}`}
                              </span>
                            )}
                          </div>
                        )}
                      </PieCenter>
                    </PieChart>

                    <Legend className="mt-3" />
                  </div>
                </div>

                {/* Right Column: Device Summary Table */}
                <div className="lg:col-span-7 bg-white border border-slate-200 p-5 rounded-xl shadow-[0_1px_3px_0_rgba(0,0,0,0.05)] flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Meters Inventory Breakdown</h3>
                        <p className="text-[10px] text-slate-500 dark:text-dark-muted mt-0.5">Real-time status metrics and total flow volume</p>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                        {pieData.length} Meters
                      </span>
                    </div>
                  </div>

                  <div className="overflow-x-auto w-full flex-1 mt-3">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-100 dark:border-slate-800 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                          <th className="pb-2.5 pl-2">Device Name</th>
                          <th className="pb-2.5 text-right">Consumption</th>
                          <th className="pb-2.5 pr-2 text-right">Percentage Share</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
                        {(showAllOverviewMeters ? pieData : pieData.slice(0, 5)).map((device) => (
                          <tr 
                            key={device.name} 
                            onClick={() => {
                              const devOpt = devices.find((d) => d.id === device.name);
                              if (devOpt) {
                                toggleDeviceExpand(devOpt.id, devOpt);
                                setActiveNav('devices');
                              }
                            }}
                            className="hover:bg-slate-100/50 dark:hover:bg-slate-800/30 transition-colors cursor-pointer"
                          >
                            <td className="py-2.5 pl-2 flex items-center gap-2.5">
                              <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: device.color }} />
                              <div className="flex flex-col">
                                <span className="font-bold text-slate-800 dark:text-slate-200">{device.name}</span>
                                <span className="text-[10px] text-slate-400 dark:text-slate-500">{device.location}</span>
                              </div>
                            </td>
                            <td className="py-2.5 text-right font-semibold text-slate-800 dark:text-slate-200">
                              {formatNumber(device.value, 0)} L
                            </td>
                            <td className="py-2.5 pr-2 text-right font-semibold text-slate-600 dark:text-slate-400">
                              {device.percentage.toFixed(1)}%
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Expand / View All Meters Action Bar */}
                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between mt-2">
                    {pieData.length > 5 ? (
                      <button
                        type="button"
                        onClick={() => setShowAllOverviewMeters(!showAllOverviewMeters)}
                        className="text-xs font-bold text-[#00B4D8] hover:text-[#0096B4] transition cursor-pointer flex items-center gap-1 py-1 px-2 rounded-lg hover:bg-[#00B4D8]/10"
                      >
                        {showAllOverviewMeters ? 'Show Top 5 Meters' : `View All Meters (${pieData.length})`}
                      </button>
                    ) : (
                      <span className="text-xs text-slate-400">Showing all {pieData.length} meters</span>
                    )}
                    <button
                      type="button"
                      onClick={() => setActiveNav('devices')}
                      className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 transition cursor-pointer"
                    >
                      Open Meters Catalog →
                    </button>
                  </div>
                </div>

              </div>

              {/* TIER 3: Rankings & SaaS Smart Insights (2 columns) */}
              {/* TIER 3: Rankings (Full Width) */}
              <div className="w-full">
                
                {/* Top Consumers Progress Grid */}
                <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-[0_1px_3px_0_rgba(0,0,0,0.05)] space-y-4">
                  <div>
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Device Consumption Rankings</h3>
                    <p className="text-[10px] text-slate-500 dark:text-dark-muted mt-0.5">Contribution percentages and actual volume sorted</p>
                  </div>

                  <div className="space-y-4">
                    {pieData
                      .slice()
                      .sort((a, b) => b.value - a.value)
                      .map((device, idx) => (
                        <div key={device.name} className="space-y-1.5">
                          <div className="flex items-center justify-between text-xs font-semibold">
                            <div className="flex items-center gap-2">
                              <span className="text-slate-400 text-[10px]">#0{idx + 1}</span>
                              <span className="font-bold text-slate-800 dark:text-slate-200">{device.name}</span>
                              <span className="text-[10px] text-slate-400 font-normal">({device.location})</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-slate-900 dark:text-white font-extrabold">{formatNumber(device.value, 0)} L</span>
                              <span className="text-slate-400 text-[10px] font-normal">({device.percentage.toFixed(1)}%)</span>
                            </div>
                          </div>
                          {/* Progress Bar Container */}
                          <div className="w-full bg-slate-100 dark:bg-slate-800/60 h-2 rounded-full overflow-hidden">
                            <div 
                              className="h-full rounded-full transition-all duration-500" 
                              style={{ 
                                width: `${device.percentage}%`,
                                backgroundColor: device.color
                              }} 
                            />
                          </div>
                        </div>
                      ))}
                  </div>
                </div>

              </div>

            </div>
          )}

          {/* VIEW 2: Interactive Devices Page */}
          {activeNav === 'devices' && (
            <div className="space-y-6">
              
              {/* Devices header, Filter pills, and Search */}
              <div className="pb-4 border-b border-flostat-border dark:border-slate-850 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white">Meters Catalog</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Select a device row or click the downward arrow to expand detailed analytical widgets inline.
                  </p>
                </div>
                
                {/* Search box & Export controls */}
                <div className="flex flex-wrap items-center gap-3 shrink-0">
                  
                  {/* Search Bar */}
                  <InputGroup className="w-56 sm:w-72">
                    <InputGroupAddon>
                      <Search className="w-4 h-4 text-slate-400" />
                    </InputGroupAddon>
                    <InputGroupInput
                      placeholder="Search ID or Location..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    {filteredAndSortedDevices.length > 0 && (
                      <InputGroupAddon align="inline-end" className="text-[10px] font-bold text-[#00B4D8]">
                        {filteredAndSortedDevices.length} results
                      </InputGroupAddon>
                    )}
                  </InputGroup>

                  {/* Export Dropdown */}
                  <div className="relative">
                    <button
                      onClick={() => handleExport('CSV')}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-dark-card hover:bg-slate-50 dark:hover:bg-slate-800/80 text-slate-700 dark:text-slate-200 text-xs font-semibold shadow-sm transition-all cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Export CSV</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsDeleteDataOpen(true)}
                    className="flex items-center gap-1.5 rounded-xl border border-rose-200 bg-white px-3.5 py-2 text-xs font-semibold text-rose-600 shadow-sm transition-all hover:bg-rose-50 dark:border-rose-900/60 dark:bg-dark-card dark:text-rose-400 dark:hover:bg-rose-950/25"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Delete Data</span>
                  </button>

                  {/* Date range filter picker */}
                  <TimeFrameSelector
                    activeTab={activeTab}
                    setActiveTab={setActiveTab}
                    specificDate={specificDate}
                    setSpecificDate={setSpecificDate}
                    selectedMonth={selectedMonth}
                    setSelectedMonth={setSelectedMonth}
                    selectedYear={selectedYear}
                    setSelectedYear={setSelectedYear}
                    customDateRange={customDateRange}
                    startDate={startDate}
                    setStartDate={setStartDate}
                    endDate={endDate}
                    setEndDate={setEndDate}
                    isDatePickerOpen={isDatePickerOpen}
                    setIsDatePickerOpen={setIsDatePickerOpen}
                    handlePreset={handlePreset}
                    handleApplyRange={handleApplyRange}
                    popoverRef={popoverRef}
                  />
                </div>
              </div>

              {/* Export Status Notification */}
              {exportNotification && (
                <div className="p-3 px-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-semibold rounded-xl animate-pulse">
                  {exportNotification}
                </div>
              )}

              {/* Filter Pills list bar */}
              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500 dark:text-dark-muted">
                <span>Filter by:</span>
                {(['all', 'online', 'offline', 'highest', 'lowest'] as const).map((pill) => (
                  <button
                    key={pill}
                    onClick={() => setFilterPill(pill)}
                    className={`px-3 py-1 rounded-full border transition-all cursor-pointer capitalize ${
                      filterPill === pill
                        ? 'bg-[#0A1F44] border-[#0A1F44] text-white shadow-xs'
                        : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-dark-card dark:hover:bg-slate-800/80 dark:text-slate-400'
                    }`}
                  >
                    {pill === 'all' ? 'All Meters' : pill === 'highest' ? 'Highest Consumers' : pill === 'lowest' ? 'Lowest Consumers' : pill}
                  </button>
                ))}
              </div>

              {/* Side-by-Side Detailed Table */}
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-[0_1px_3px_0_rgba(0,0,0,0.05)]">
                <div className="overflow-x-auto w-full">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100 dark:border-slate-800 text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 font-sans">
                        <th className="py-4 pl-6 text-center w-12">Pin</th>
                        <th className="py-4 px-4 w-12 text-center">Fav</th>
                        <th className="py-4 px-4">Device</th>
                        <th className="py-4 px-4">Location</th>
                        <th className="py-4 px-4 text-right">Consumption</th>
                        <th className="py-4 px-4 text-right">Flow Rate</th>
                        <th className="py-4 px-4 text-center">Status</th>
                        <th className="py-4 pr-6 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-sm">
                      {filteredAndSortedDevices.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="py-12 text-center text-slate-400 font-semibold">
                            No devices matched search queries or active filters.
                          </td>
                        </tr>
                      ) : (
                        filteredAndSortedDevices.map((device) => {
                          const deviceCons = getDeviceConsumption(device.id);
                          const deviceFlow = getDeviceFlowRate(device.id);
                          const isExpanded = expandedDeviceId === device.id;
                          const isPinned = pinnedDevices.includes(device.id);
                          const isFavorite = favoriteDevices.includes(device.id);
                          
                          return (
                            <React.Fragment key={device.id}>
                              <tr 
                                className={`hover:bg-slate-100/50 dark:hover:bg-slate-800/30 transition-colors group cursor-pointer ${
                                  isExpanded ? 'bg-slate-100/30 dark:bg-slate-800/20' : ''
                                }`}
                              >
                                {/* Pin Toggle Column */}
                                <td className="py-4 pl-6 text-center">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      togglePin(device.id);
                                    }}
                                    className="p-1 rounded text-slate-400 hover:text-[#00B4D8] transition-colors cursor-pointer"
                                    title={isPinned ? 'Unpin Device' : 'Pin Device'}
                                  >
                                    <Pin className={`w-3.5 h-3.5 ${isPinned ? 'text-[#00B4D8] rotate-45 fill-current' : 'opacity-40 group-hover:opacity-100'}`} />
                                  </button>
                                </td>

                                {/* Star Favorite Column */}
                                <td className="py-4 px-4 text-center">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleFavorite(device.id);
                                    }}
                                    className="p-1 rounded text-slate-400 hover:text-amber-500 transition-colors cursor-pointer"
                                    title={isFavorite ? 'Remove Favorite' : 'Mark Favorite'}
                                  >
                                    <Star className={`w-3.5 h-3.5 ${isFavorite ? 'text-amber-500 fill-current' : 'opacity-40 group-hover:opacity-100'}`} />
                                  </button>
                                </td>

                                {/* Device ID */}
                                <td 
                                  onClick={() => toggleDeviceExpand(device.id, device)}
                                  className="py-4 px-4 font-bold text-slate-900 dark:text-white group-hover:text-[#00B4D8] transition-colors"
                                >
                                  {device.name}
                                </td>

                                {/* Tank Location */}
                                <td 
                                  onClick={() => toggleDeviceExpand(device.id, device)}
                                  className="py-4 px-4 text-slate-555 dark:text-slate-400"
                                >
                                  {device.location}
                                </td>

                                {/* Consumed Volume */}
                                <td 
                                  onClick={() => toggleDeviceExpand(device.id, device)}
                                  className="py-4 px-4 text-right font-semibold text-slate-800 dark:text-slate-200"
                                >
                                  {formatNumber(deviceCons, 0)} L
                                </td>

                                {/* Flow Rate */}
                                <td 
                                  onClick={() => toggleDeviceExpand(device.id, device)}
                                  className="py-4 px-4 text-right font-semibold text-slate-600 dark:text-slate-400"
                                >
                                  {deviceFlow > 0 ? `${deviceFlow.toFixed(1)} L/min` : '0.0 L/min'}
                                </td>

                                {/* Status Badge */}
                                <td 
                                  onClick={() => toggleDeviceExpand(device.id, device)}
                                  className="py-4 px-4 text-center"
                                >
                                  <GlowingBadge
                                    variant={device.status === 'online' ? 'success' : 'error'}
                                    pulse={device.status === 'online'}
                                  >
                                    {device.status === 'online' ? 'Online' : 'Offline'}
                                  </GlowingBadge>
                                </td>

                                {/* Actions trigger arrow */}
                                <td className="py-4 pr-6 text-right">
                                  <button 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleDeviceExpand(device.id, device);
                                    }}
                                    className={`p-1.5 rounded-xl text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-all inline-flex items-center cursor-pointer ${
                                      isExpanded ? 'bg-slate-100 dark:bg-slate-800 text-slate-950 dark:text-white' : ''
                                    }`}
                                    title={isExpanded ? "Collapse Telemetry" : "Expand Telemetry"}
                                  >
                                    {isExpanded ? (
                                      <ChevronUp className="w-5 h-5" />
                                    ) : (
                                      <ChevronDown className="w-5 h-5" />
                                    )}
                                  </button>
                                </td>
                              </tr>
                              
                              {/* Inline Collapsible Row for Graphs, Metrics & Logs */}
                              {isExpanded && (
                                <tr className="bg-slate-50/20 dark:bg-slate-900/5 hover:bg-transparent">
                                  <td colSpan={8} className="py-4 px-6" onClick={(e) => e.stopPropagation()}>
                                    <DeviceInlineDashboard 
                                      device={device}
                                      activeTab={activeTab}
                                      customDateRange={customDateRange}
                                      specificDate={specificDate}
                                      selectedMonth={selectedMonth}
                                      selectedYear={selectedYear}
                                      dataRefreshToken={dataRefreshToken}
                                      devStateOverride={devStateOverride}
                                      connectedStreamData={connectedDataStream}
                                    />
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

          {/* VIEW 3: Enterprise Comparison Engine View */}
          {activeNav === 'compare' && (
            <ComparisonModeView
              devices={devices}
              initialDeviceId={selectedDevice?.id}
            />
          )}

          {/* VIEW 4: Custom Historical Time-Range Flow Analysis */}
          {activeNav === 'timerange' && (
            <TimeRangeAnalysisView
              devices={devices}
              initialDeviceId={selectedDevice?.id}
            />
          )}

          {/* VIEW 5: Hierarchical Historical Data Drill-Down */}
          {activeNav === 'drilldown' && (
            <HistoricalDrillDownView
              devices={devices}
              initialDeviceId={selectedDevice?.id}
            />
          )}

        </div>
      </div>

      <DeleteDataDialog
        isOpen={isDeleteDataOpen}
        devices={devices}
        initialDeviceId={selectedDevice?.id}
        onClose={() => setIsDeleteDataOpen(false)}
        onDeleted={handleDataDeleted}
      />

      {/* Command Dialog for Selecting Meter Device & Navigation */}
      <CommandDialog open={isCommandOpen} onOpenChange={setIsCommandOpen}>
        <Command>
          <CommandInput
            placeholder="Type a command or search meters..."
            value={commandSearch}
            onValueChange={setCommandSearch}
          />
          <CommandList>
            {filteredCommandDevices.length === 0 ? (
              <CommandEmpty>No matching meter devices found.</CommandEmpty>
            ) : (
              <>
                <CommandGroup heading="Meter Catalog Devices">
                  {filteredCommandDevices.map((d) => (
                    <CommandItem
                      key={d.id}
                      onSelect={() => {
                        onDeviceChange?.(d);
                        setIsCommandOpen(false);
                      }}
                      className={selectedDevice?.id === d.id ? 'bg-[#00B4D8]/10 text-[#0A1F44] font-bold' : ''}
                    >
                      <Server className={`w-4 h-4 shrink-0 ${d.status === 'online' ? 'text-emerald-500' : 'text-slate-400'}`} />
                      <div className="flex flex-col min-w-0 flex-1">
                        <span className="font-bold truncate">{d.name}</span>
                        <span className="text-[10px] text-slate-400 truncate">{d.location} • {d.facility}</span>
                      </div>
                      <CommandShortcut>{d.id}</CommandShortcut>
                    </CommandItem>
                  ))}
                </CommandGroup>
                <CommandSeparator />
                <CommandGroup heading="Quick Dashboard Navigation">
                  <CommandItem onSelect={() => { setActiveNav('overview'); setIsCommandOpen(false); }}>
                    <LayoutDashboard className="w-4 h-4 text-[#00B4D8] shrink-0" />
                    <span>Overview Dashboard</span>
                    <CommandShortcut>⌘1</CommandShortcut>
                  </CommandItem>
                  <CommandItem onSelect={() => { setActiveNav('devices'); setIsCommandOpen(false); }}>
                    <Server className="w-4 h-4 text-[#0A1F44] dark:text-slate-300 shrink-0" />
                    <span>Meters Catalog</span>
                    <CommandShortcut>⌘2</CommandShortcut>
                  </CommandItem>
                  <CommandItem onSelect={() => { setActiveNav('compare'); setIsCommandOpen(false); }}>
                    <Zap className="w-4 h-4 text-amber-500 shrink-0" />
                    <span>Comparison Mode</span>
                    <CommandShortcut>⌘3</CommandShortcut>
                  </CommandItem>
                  <CommandItem onSelect={() => { setActiveNav('timerange'); setIsCommandOpen(false); }}>
                    <Clock className="w-4 h-4 text-[#00B4D8] shrink-0" />
                    <span>Time-Range Analysis</span>
                    <CommandShortcut>⌘4</CommandShortcut>
                  </CommandItem>
                  <CommandItem onSelect={() => { setActiveNav('drilldown'); setIsCommandOpen(false); }}>
                    <Layers className="w-4 h-4 text-[#0A1F44] dark:text-slate-300 shrink-0" />
                    <span>Historical Drill-Down</span>
                    <CommandShortcut>⌘5</CommandShortcut>
                  </CommandItem>
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </CommandDialog>
    </div>
  );
};
