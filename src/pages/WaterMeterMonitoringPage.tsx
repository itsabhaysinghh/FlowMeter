import React, { useState } from 'react';
import { 
  Activity, 
  Droplet, 
  BarChart2, 
  LayoutDashboard, 
  Server, 
  ChevronDown, 
  ChevronUp, 
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
} from 'lucide-react';
import { PieChart, PieSlice, PieCenter, Legend, type PieData } from '../components/ui/PieChart';
import type { WaterMeterDataResponse, ModuleState, TimeRangeTab, DeviceOption, DateRange, DeleteFlowMeterDataResult } from '../types/meter.types';
import { useWaterMeterData } from '../hooks/useWaterMeterData';
import { meterService } from '../services/meter.service';
import { MetricCard } from '../components/common/MetricCard';
import { ChartCard } from '../components/common/ChartCard';
import { ConsumptionChart } from '../components/water-meter/ConsumptionChart';
import { FlowTrendChart } from '../components/water-meter/FlowTrendChart';
import { FlowHistoryTable } from '../components/water-meter/FlowHistoryTable';
import { formatNumber } from '../utils/formatters';
import { DeleteDataDialog } from '../components/water-meter/DeleteDataDialog';
import { GlowingBadge } from '../components/ui/glowing-badge';
import { RefreshButton } from '../components/unlumen-ui/primitives/refresh';
import { DatePicker, Calendar as CalendarWidget } from '../components/ui/calendar';
import { InputGroup, InputGroupInput, InputGroupAddon } from '../components/ui/input-group';
import { Alert, AlertTitle, AlertDescription } from '../components/ui/alert';

export interface WaterMeterMonitoringPageProps {
  devStateOverride?: ModuleState;
  connectedDataStream?: WaterMeterDataResponse | null;
  devices: DeviceOption[];
  selectedDevice: DeviceOption | null;
  onDeviceChange?: (device: DeviceOption) => void;
}

const formatMonthLabel = (monthStr?: string) => {
  if (!monthStr) return '';
  const [year, month] = monthStr.split('-');
  const d = new Date(Number(year), Number(month) - 1, 1);
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
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
          <Activity className="w-6 h-6 text-blue-500 animate-pulse" />
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
          iconBgColor="bg-blue-50 dark:bg-blue-950/50"
          iconTextColor="text-flostat-primary dark:text-blue-400"
        />

        <MetricCard
          title="Average Flow Rate"
          value={formatNumber(data.metrics.averageFlowRate, 1)}
          unit="L/min"
          subtitle="Mean operational flow rate"
          icon={<BarChart2 className="w-5 h-5" />}
          iconBgColor="bg-indigo-50 dark:bg-indigo-950/50"
          iconTextColor="text-indigo-600 dark:text-indigo-400"
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
              ? `Specific month (${formatMonthLabel(selectedMonth)})`
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
                      ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm border border-slate-200/50 dark:border-slate-600/50'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-350'
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

          return (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab.id)}
              className={`px-3 py-1 text-xs font-bold rounded transition-all capitalize cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm border border-slate-200/50 dark:border-slate-600/50'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-350'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Month Picker */}
      {activeTab === 'month' && (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/80 dark:bg-blue-950/40 text-xs font-semibold shadow-sm">
          <Calendar className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
          <span className="text-slate-500 dark:text-slate-400 font-medium">Select Month:</span>
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="bg-transparent text-slate-800 dark:text-white font-bold text-xs focus:outline-none cursor-pointer"
          />
        </div>
      )}

      {/* Year Picker */}
      {activeTab === 'year' && (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-blue-200 dark:border-blue-805 bg-blue-50/80 dark:bg-blue-950/40 text-xs font-semibold shadow-sm">
          <Calendar className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
          <span className="text-slate-500 dark:text-slate-400 font-medium">Select Year:</span>
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
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/80 dark:bg-blue-950/40 text-flostat-primary dark:text-blue-300 text-xs font-semibold hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-all shadow-sm cursor-pointer"
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>
              {formatDateLabel(customDateRange.startDate)} - {formatDateLabel(customDateRange.endDate)}
            </span>
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isDatePickerOpen ? 'rotate-180' : ''}`} />
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
                  className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[10px] font-bold flex items-center gap-1 shadow-sm cursor-pointer"
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
  const [activeNav, setActiveNav] = useState<'overview' | 'devices' | 'compare'>('overview');
  const [activeTab, setActiveTab] = useState<TimeRangeTab>(() => (localStorage.getItem('flostat_active_tab') as TimeRangeTab) || 'today');
  const [specificDate, setSpecificDate] = useState<string>(() => localStorage.getItem('flostat_specific_date') || new Date().toISOString().split('T')[0]);
  const [selectedMonth, setSelectedMonth] = useState<string>(() => localStorage.getItem('flostat_selected_month') || new Date().toISOString().split('T')[0].slice(0, 7));
  const [selectedYear, setSelectedYear] = useState<string>(() => localStorage.getItem('flostat_selected_year') || new Date().getFullYear().toString());
  const [customDateRange, setCustomDateRange] = useState<DateRange>(() => {
    const saved = localStorage.getItem('flostat_custom_date_range');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return { startDate: '2026-07-01', endDate: '2026-07-20' };
  });

  const [expandedDeviceId, setExpandedDeviceId] = useState<string | null>(null);

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

  // Comparison mode selections
  const [compareDevice, setCompareDevice] = useState<string>('FLOSTAT_001');
  const [compareActiveTab, setCompareActiveTab] = useState<TimeRangeTab>('today');
  
  // Day Mode Inputs
  const [compareDayA, setCompareDayA] = useState<string>(new Date().toISOString().split('T')[0]);
  const [compareDayB, setCompareDayB] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0];
  });

  // Week Mode Inputs (Select dates inside target weeks)
  const [compareWeekA, setCompareWeekA] = useState<string>(new Date().toISOString().split('T')[0]);
  const [compareWeekB, setCompareWeekB] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
  });

  // Month Mode Inputs (YYYY-MM format)
  const [compareMonthA, setCompareMonthA] = useState<string>('2026-08');
  const [compareMonthB, setCompareMonthB] = useState<string>('2026-07');

  // Year Mode Inputs
  const [compareYearA, setCompareYearA] = useState<number>(2026);
  const [compareYearB, setCompareYearB] = useState<number>(2025);

  // Custom Mode Inputs
  const [compareCustomStartA, setCompareCustomStartA] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    return d.toISOString().split('T')[0];
  });
  const [compareCustomEndA, setCompareCustomEndA] = useState<string>(new Date().toISOString().split('T')[0]);
  
  const [compareCustomStartB, setCompareCustomStartB] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 13);
    return d.toISOString().split('T')[0];
  });
  const [compareCustomEndB, setCompareCustomEndB] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
  });

  const [compareCurrentVal, setCompareCurrentVal] = useState<number>(0);
  const [comparePrevVal, setComparePrevVal] = useState<number>(0);
  const [isCompareLoading, setIsCompareLoading] = useState<boolean>(false);

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


  const formatDateLabel = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  // Fetch telemetry data for FLOSTAT_001
  const { data, refreshInterval, setRefreshInterval, refetch } = useWaterMeterData({
    activeTab,
    customDateRange,
    specificDate,
    selectedMonth,
    selectedYear,
    selectedDevice: devices.find((d) => d.id === 'FLOSTAT_001') || selectedDevice,
    dataRefreshToken,
    devStateOverride,
    connectedStreamData: connectedDataStream,
  });

  const [deviceSnapshots, setDeviceSnapshots] = useState<Record<string, { consumption: number; flowRate: number }>>({});

  React.useEffect(() => {
    let active = true;
    async function loadDeviceSnapshots() {
      const snapshots = await Promise.all(devices.map(async (device) => {
        const [summary, live, history] = await Promise.all([
          meterService.getConsumption(activeTab, device.id, customDateRange, specificDate, selectedMonth, selectedYear),
          meterService.getLiveFlowRate(device.id),
          meterService.getFlowHistory(undefined, device.id, activeTab, customDateRange, specificDate, selectedMonth, selectedYear),
        ]);

        const calcConsumption = (summary && summary.total_volume_litres > 0)
          ? summary.total_volume_litres
          : (history && history.length > 0)
          ? history.reduce((sum, item) => sum + item.totalLitres, 0)
          : 0;

        const calcFlowRate = (live && live.liveFlowRate > 0)
          ? live.liveFlowRate
          : 0;

        return [device.id, {
          consumption: calcConsumption,
          flowRate: calcFlowRate,
        }] as const;
      }));
      if (active) setDeviceSnapshots(Object.fromEntries(snapshots));
    }
    void loadDeviceSnapshots();
    return () => { active = false; };
  }, [activeTab, customDateRange, dataRefreshToken, devices, specificDate, selectedMonth, selectedYear]);

  const getDeviceConsumption = React.useCallback((deviceId: string) => {
    return deviceSnapshots[deviceId]?.consumption ?? 0;
  }, [deviceSnapshots]);

  const getDeviceFlowRate = React.useCallback((deviceId: string) => {
    return deviceSnapshots[deviceId]?.flowRate ?? 0;
  }, [deviceSnapshots]);

  const flostat001Val = data?.metrics.todaysConsumption ?? getDeviceConsumption('FLOSTAT_001');
  const flostat001Flow = data?.metrics.liveFlowRate ?? getDeviceFlowRate('FLOSTAT_001');

  const flostat001Status = data ? data.metadata.deviceStatus : 'online';

  const deviceColors: Record<string, string> = {
    FLOSTAT_001: '#2563EB', // Blue
    FLOSTAT_002: '#10B981', // Green
    FLOSTAT_003: '#F59E0B', // Orange
    FLOSTAT_004: '#8B5CF6', // Purple (standby/offline color overlay)
    FLOSTAT_005: '#EF4444', // Red
  };

  const rawPieData = [
    {
      name: 'FLOSTAT_001',
      location: 'Main Overhead Tank',
      value: flostat001Val,
      flowRate: flostat001Flow,
      status: flostat001Status,
      color: deviceColors.FLOSTAT_001,
    },
    {
      name: 'FLOSTAT_002',
      location: 'Ground Tank',
      value: getDeviceConsumption('FLOSTAT_002'),
      flowRate: getDeviceFlowRate('FLOSTAT_002'),
      status: 'online',
      color: deviceColors.FLOSTAT_002,
    },
    {
      name: 'FLOSTAT_003',
      location: 'Block A Tank',
      value: getDeviceConsumption('FLOSTAT_003'),
      flowRate: getDeviceFlowRate('FLOSTAT_003'),
      status: 'online',
      color: deviceColors.FLOSTAT_003,
    },
    {
      name: 'FLOSTAT_004',
      location: 'Block B Tank',
      value: getDeviceConsumption('FLOSTAT_004'),
      flowRate: 0,
      status: 'offline',
      color: deviceColors.FLOSTAT_004,
    },
    {
      name: 'FLOSTAT_005',
      location: 'Fire Tank',
      value: getDeviceConsumption('FLOSTAT_005'),
      flowRate: getDeviceFlowRate('FLOSTAT_005'),
      status: 'online',
      color: deviceColors.FLOSTAT_005,
    },
  ];

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



  // Helper to calculate custom period boundaries for Period A and Period B
  const getComparisonBoundaries = React.useCallback(() => {
    let startA = new Date();
    let endA = new Date();
    let startB = new Date();
    let endB = new Date();

    if (compareActiveTab === 'today') {
      startA = new Date(compareDayA);
      startA.setHours(0, 0, 0, 0);
      endA = new Date(compareDayA);
      endA.setHours(23, 59, 59, 999);

      startB = new Date(compareDayB);
      startB.setHours(0, 0, 0, 0);
      endB = new Date(compareDayB);
      endB.setHours(23, 59, 59, 999);
    } else if (compareActiveTab === 'week') {
      const dateA = new Date(compareWeekA);
      const dayA = dateA.getDay();
      const diffA = dateA.getDate() - dayA + (dayA === 0 ? -6 : 1);
      startA = new Date(dateA.setDate(diffA));
      startA.setHours(0, 0, 0, 0);
      endA = new Date(startA);
      endA.setDate(endA.getDate() + 6);
      endA.setHours(23, 59, 59, 999);

      const dateB = new Date(compareWeekB);
      const dayB = dateB.getDay();
      const diffB = dateB.getDate() - dayB + (dayB === 0 ? -6 : 1);
      startB = new Date(dateB.setDate(diffB));
      startB.setHours(0, 0, 0, 0);
      endB = new Date(startB);
      endB.setDate(endB.getDate() + 6);
      endB.setHours(23, 59, 59, 999);
    } else if (compareActiveTab === 'month') {
      const [yA, mA] = compareMonthA.split('-').map(Number);
      startA = new Date(yA, mA - 1, 1);
      endA = new Date(yA, mA, 0, 23, 59, 59, 999);

      const [yB, mB] = compareMonthB.split('-').map(Number);
      startB = new Date(yB, mB - 1, 1);
      endB = new Date(yB, mB, 0, 23, 59, 59, 999);
    } else if (compareActiveTab === 'year') {
      startA = new Date(compareYearA, 0, 1);
      endA = new Date(compareYearA, 11, 31, 23, 59, 59, 999);

      startB = new Date(compareYearB, 0, 1);
      endB = new Date(compareYearB, 11, 31, 23, 59, 59, 999);
    } else if (compareActiveTab === 'custom') {
      startA = new Date(compareCustomStartA);
      startA.setHours(0, 0, 0, 0);
      endA = new Date(compareCustomEndA);
      endA.setHours(23, 59, 59, 999);

      startB = new Date(compareCustomStartB);
      startB.setHours(0, 0, 0, 0);
      endB = new Date(compareCustomEndB);
      endB.setHours(23, 59, 59, 999);
    }

    return {
      current: {
        start: startA,
        end: endA,
        startStr: startA.toISOString().split('T')[0],
        endStr: endA.toISOString().split('T')[0],
      },
      previous: {
        start: startB,
        end: endB,
        startStr: startB.toISOString().split('T')[0],
        endStr: endB.toISOString().split('T')[0],
      }
    };
  }, [
    compareActiveTab,
    compareDayA,
    compareDayB,
    compareWeekA,
    compareWeekB,
    compareMonthA,
    compareMonthB,
    compareYearA,
    compareYearB,
    compareCustomStartA,
    compareCustomEndA,
    compareCustomStartB,
    compareCustomEndB
  ]);

  // Fetch comparison data dynamically
  React.useEffect(() => {
    let active = true;
    async function fetchCompareData() {
      const dates = getComparisonBoundaries();
      
      try {
        setIsCompareLoading(true);
        const [curRes, prevRes] = await Promise.all([
          meterService.getConsumption('custom', compareDevice, {
            startDate: dates.current.startStr,
            endDate: dates.current.endStr,
          }),
          meterService.getConsumption('custom', compareDevice, {
            startDate: dates.previous.startStr,
            endDate: dates.previous.endStr,
          })
        ]);
        
        if (active) {
          setCompareCurrentVal(curRes ? curRes.total_volume_litres : 0);
          setComparePrevVal(prevRes ? prevRes.total_volume_litres : 0);
        }
      } catch (err) {
        console.error("Failed to fetch backend comparison data:", err);
      } finally {
        if (active) {
          setIsCompareLoading(false);
        }
      }
    }
    
    fetchCompareData();
    return () => {
      active = false;
    };
  }, [compareDevice, data, getComparisonBoundaries]);

  const compareDelta = compareCurrentVal - comparePrevVal;
  const comparePct = comparePrevVal > 0 ? (compareDelta / comparePrevVal) * 100 : 0;

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
              4 Online | 1 Standby
            </GlowingBadge>
          </div>
        </div>

        <div className="flex items-center gap-4 text-slate-500">
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-700">
              {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
            </span>
          </div>
          <span className="h-3 w-px bg-slate-200" />
          <span>Last Sync: <span className="text-slate-700 font-semibold">{data ? data.metadata.lastUpdated : 'Just now'}</span></span>
          <span className="h-3 w-px bg-slate-200" />
          {data && (
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
          )}
        </div>
      </div>

      {/* Dynamic Dashboard Alerts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Alert variant="info">
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

        <Alert variant="default">
          <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
          <div>
            <AlertTitle>Meter status</AlertTitle>
            <AlertDescription>
              <strong>{devices.filter(d => d.status === 'online').length}</strong> meters are currently active out of{" "}
              <strong>{devices.length}</strong> total meters.
            </AlertDescription>
          </div>
        </Alert>
      </div>

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
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/10'
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
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/10'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <div className="flex items-center gap-3">
                <Server className="w-4 h-4" />
                <span>Meters Catalog</span>
              </div>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold transition-all ${
                activeNav === 'devices'
                  ? 'bg-blue-700 text-blue-100'
                  : 'bg-slate-100 text-slate-650'
              }`}>
                {devices.length}
              </span>
            </button>

            <button
              onClick={() => setActiveNav('compare')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${
                activeNav === 'compare'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/10'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Zap className="w-4 h-4" />
              <span>Comparison Mode</span>
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
                <div className="lg:col-span-5 bg-white border border-slate-200 p-5 rounded-xl shadow-[0_1px_3px_0_rgba(0,0,0,0.05)] flex flex-col justify-between">
                  <div>
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Consumption Allocation</h3>
                    <p className="text-[10px] text-slate-500 dark:text-dark-muted mt-0.5">Device percentage share of aggregate volume</p>
                  </div>
                  
                  <div className="flex flex-col items-center justify-center py-4">
                    <PieChart data={pieChartData} size={250} innerRadius={65} padAngle={0.04}>
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

                    <Legend className="mt-4" />
                  </div>
                </div>

                {/* Right Column: Device Summary Table */}
                <div className="lg:col-span-7 bg-white border border-slate-200 p-5 rounded-xl shadow-[0_1px_3px_0_rgba(0,0,0,0.05)] flex flex-col justify-between">
                  <div>
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Meters Inventory Breakdown</h3>
                    <p className="text-[10px] text-slate-500 dark:text-dark-muted mt-0.5">Real-time status metrics and total flow volume</p>
                  </div>

                  <div className="overflow-x-auto w-full flex-1 mt-4">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-100 dark:border-slate-800 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                          <th className="pb-3 pl-2">Device Name</th>
                          <th className="pb-3 text-right">Consumption</th>
                          <th className="pb-3 pr-2 text-right">Percentage Share</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
                        {pieData.map((device) => (
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
                            <td className="py-3.5 pl-2 flex items-center gap-2.5">
                              <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: device.color }} />
                              <div className="flex flex-col">
                                <span className="font-bold text-slate-800 dark:text-slate-200">{device.name}</span>
                                <span className="text-[10px] text-slate-400 dark:text-slate-500">{device.location}</span>
                              </div>
                            </td>
                            <td className="py-3.5 text-right font-semibold text-slate-800 dark:text-slate-200">
                              {formatNumber(device.value, 0)} L
                            </td>
                            <td className="py-3.5 pr-2 text-right font-semibold text-slate-600 dark:text-slate-400">
                              {device.percentage.toFixed(1)}%
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
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
                      <InputGroupAddon align="inline-end" className="text-[10px] font-bold text-blue-600 dark:text-blue-400">
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
                        ? 'bg-slate-900 border-slate-800 text-white dark:bg-slate-800 dark:border-slate-700'
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
                                    className="p-1 rounded text-slate-400 hover:text-blue-500 dark:hover:text-blue-400 transition-colors cursor-pointer"
                                    title={isPinned ? 'Unpin Device' : 'Pin Device'}
                                  >
                                    <Pin className={`w-3.5 h-3.5 ${isPinned ? 'text-blue-600 dark:text-blue-400 rotate-45 fill-current' : 'opacity-40 group-hover:opacity-100'}`} />
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
                                  className="py-4 px-4 font-bold text-slate-900 dark:text-white group-hover:text-flostat-primary dark:group-hover:text-blue-400 transition-colors"
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

          {/* VIEW 3: Comparison Mode View */}
          {activeNav === 'compare' && (
            <div className="space-y-6">
              
              {/* Header */}
              <div className="pb-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-base font-bold text-slate-800 tracking-tight">Enterprise Comparison Engine</h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Analyze single device water consumption trends compared to any other past time period.
                  </p>
                </div>
                
                {/* Active Period Tab Switcher */}
                <div className="flex items-center p-1 bg-slate-100/85 rounded-lg border border-slate-200 shrink-0">
                  {TABS.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setCompareActiveTab(tab.id)}
                      className={`px-3 py-1 text-xs font-bold rounded transition-all capitalize cursor-pointer ${
                        compareActiveTab === tab.id
                          ? 'bg-white text-blue-600 shadow-sm border border-slate-200/50'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {(() => {
                const selectedDevObj = devices.find((d) => d.id === compareDevice) || devices[0];
                
                const curPeriodLabel = 
                  compareActiveTab === 'today' ? `Day A: ${formatDateLabel(compareDayA)}` :
                  compareActiveTab === 'week' ? `Week A: w/c ${formatDateLabel(compareWeekA)}` :
                  compareActiveTab === 'month' ? `Month A: ${compareMonthA}` :
                  compareActiveTab === 'year' ? `Year A: ${compareYearA}` : 
                  `Range A: ${formatDateLabel(compareCustomStartA)} - ${formatDateLabel(compareCustomEndA)}`;
                  
                const prevPeriodLabel = 
                  compareActiveTab === 'today' ? `Day B: ${formatDateLabel(compareDayB)}` :
                  compareActiveTab === 'week' ? `Week B: w/c ${formatDateLabel(compareWeekB)}` :
                  compareActiveTab === 'month' ? `Month B: ${compareMonthB}` :
                  compareActiveTab === 'year' ? `Year B: ${compareYearB}` : 
                  `Range B: ${formatDateLabel(compareCustomStartB)} - ${formatDateLabel(compareCustomEndB)}`;
                  
                return (
                  <>
                    {/* Selector Panels: Device & Comparison Parameters */}
                    <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 grid grid-cols-1 md:grid-cols-3 gap-6">
                      
                      {/* Device Selection */}
                      <div className="space-y-2">
                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">Select Meter Device</label>
                        <select
                          value={compareDevice}
                          onChange={(e) => setCompareDevice(e.target.value)}
                          className="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-white text-slate-800 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/25 cursor-pointer"
                        >
                          {devices.map((d) => (
                            <option key={d.id} value={d.id}>{d.name} — {d.location}</option>
                          ))}
                        </select>
                      </div>

                      {/* Period A Selector */}
                      <div className="space-y-2">
                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">Reference Period (A)</label>
                        {compareActiveTab === 'today' && (
                          <DatePicker
                            value={compareDayA}
                            onChange={setCompareDayA}
                          />
                        )}
                        {compareActiveTab === 'week' && (
                          <div className="space-y-1">
                            <DatePicker
                              value={compareWeekA}
                              onChange={setCompareWeekA}
                            />
                            <p className="text-[9px] text-slate-400">Week containing selected date</p>
                          </div>
                        )}
                        {compareActiveTab === 'month' && (
                          <input
                            type="month"
                            value={compareMonthA}
                            onChange={(e) => setCompareMonthA(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-800 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/25 cursor-pointer"
                          />
                        )}
                        {compareActiveTab === 'year' && (
                          <select
                            value={compareYearA}
                            onChange={(e) => setCompareYearA(Number(e.target.value))}
                            className="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-white text-slate-800 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/25 cursor-pointer"
                          >
                            {[2026, 2025, 2024, 2023, 2022].map(y => (
                              <option key={y} value={y}>{y}</option>
                            ))}
                          </select>
                        )}
                        {compareActiveTab === 'custom' && (
                          <div className="grid grid-cols-2 gap-2">
                            <DatePicker
                              value={compareCustomStartA}
                              onChange={setCompareCustomStartA}
                            />
                            <DatePicker
                              value={compareCustomEndA}
                              onChange={setCompareCustomEndA}
                            />
                          </div>
                        )}
                      </div>

                      {/* Period B Selector */}
                      <div className="space-y-2">
                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">Comparison Period (B)</label>
                        {compareActiveTab === 'today' && (
                          <DatePicker
                            value={compareDayB}
                            onChange={setCompareDayB}
                          />
                        )}
                        {compareActiveTab === 'week' && (
                          <div className="space-y-1">
                            <DatePicker
                              value={compareWeekB}
                              onChange={setCompareWeekB}
                            />
                            <p className="text-[9px] text-slate-400">Week containing selected date</p>
                          </div>
                        )}
                        {compareActiveTab === 'month' && (
                          <input
                            type="month"
                            value={compareMonthB}
                            onChange={(e) => setCompareMonthB(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-800 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/25 cursor-pointer"
                          />
                        )}
                        {compareActiveTab === 'year' && (
                          <select
                            value={compareYearB}
                            onChange={(e) => setCompareYearB(Number(e.target.value))}
                            className="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-white text-slate-800 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/25 cursor-pointer"
                          >
                            {[2026, 2025, 2024, 2023, 2022].map(y => (
                              <option key={y} value={y}>{y}</option>
                            ))}
                          </select>
                        )}
                        {compareActiveTab === 'custom' && (
                          <div className="grid grid-cols-2 gap-2">
                            <DatePicker
                              value={compareCustomStartB}
                              onChange={setCompareCustomStartB}
                            />
                            <DatePicker
                              value={compareCustomEndB}
                              onChange={setCompareCustomEndB}
                            />
                          </div>
                        )}
                      </div>

                    </div>

                    {/* Loader overlay or status */}
                    {isCompareLoading && (
                      <div className="py-2 text-center text-xs text-blue-600 font-bold animate-pulse">
                        Querying AWS database for historical telemetry log volumes...
                      </div>
                    )}

                    {/* delta & Variance Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                      
                      {/* Current Period Card */}
                      <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.05)] space-y-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{curPeriodLabel}</span>
                        <div className="text-2xl font-black text-slate-900">{formatNumber(compareCurrentVal, 0)} L</div>
                        <span className="text-[10px] text-slate-400">Location: {selectedDevObj.location}</span>
                      </div>

                      {/* Previous Period Card */}
                      <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.05)] space-y-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{prevPeriodLabel}</span>
                        <div className="text-2xl font-black text-slate-900">{formatNumber(comparePrevVal, 0)} L</div>
                        <span className="text-[10px] text-slate-400">Location: {selectedDevObj.location}</span>
                      </div>

                      {/* Variance Card */}
                      <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.05)] space-y-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Variance Comparison</span>
                        <div className={`text-2xl font-black ${compareDelta >= 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                          {compareDelta >= 0 ? '+' : ''}{formatNumber(compareDelta, 0)} L
                        </div>
                        <span className={`text-[10px] font-bold ${compareDelta >= 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                          {compareDelta >= 0 ? '▲' : '▼'} {comparePct.toFixed(1)}% delta variance
                        </span>
                      </div>

                    </div>


                  </>
                );
              })()}

            </div>
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
    </div>
  );
};
