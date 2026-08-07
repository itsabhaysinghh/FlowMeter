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
  TrendingUp,
  Search,
  Download
} from 'lucide-react';
import { 
  PieChart, 
  Pie, 
  Cell, 
  Tooltip as RechartsTooltip, 
  ResponsiveContainer,
  XAxis,
  YAxis,
  CartesianGrid,
  LineChart,
  Line,
  Legend
} from 'recharts';
import type { WaterMeterDataResponse, ModuleState, TimeRangeTab, DeviceOption, DateRange } from '../types/meter.types';
import { useWaterMeterData, getDevicePeriodConsumption } from '../hooks/useWaterMeterData';
import { MetricCard } from '../components/common/MetricCard';
import { ChartCard } from '../components/common/ChartCard';
import { ConsumptionChart } from '../components/water-meter/ConsumptionChart';
import { FlowTrendChart } from '../components/water-meter/FlowTrendChart';
import { FlowHistoryTable } from '../components/water-meter/FlowHistoryTable';
import { formatNumber } from '../utils/formatters';

export interface WaterMeterMonitoringPageProps {
  devStateOverride?: ModuleState;
  connectedDataStream?: WaterMeterDataResponse | null;
  devices: DeviceOption[];
  selectedDevice: DeviceOption | null;
  onDeviceChange?: (device: DeviceOption) => void;
}

// Deterministic consumption simulation for mock devices
const getDeviceConsumption = (deviceId: string, tab: TimeRangeTab, customRange?: DateRange): number => {
  return getDevicePeriodConsumption(deviceId, tab, customRange);
};

// Tooltip customization for donut slices
const CustomPieTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl text-xs text-white max-w-[240px] backdrop-blur-md">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2">
          <span className="font-bold text-slate-400">Device</span>
          <span className="font-extrabold text-white tracking-tight">{data.name}</span>
        </div>
        <div className="space-y-1.5">
          <div className="flex justify-between gap-4">
            <span className="text-slate-400">Consumption:</span>
            <span className="font-bold text-blue-400">{formatNumber(data.value, 0)} L</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-slate-400">Contribution:</span>
            <span className="font-bold text-emerald-400">{data.percentage.toFixed(1)}%</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-slate-400">Current Flow Rate:</span>
            <span className="font-bold text-indigo-400">{data.flowRate} L/min</span>
          </div>
          <div className="flex justify-between gap-4 items-center">
            <span className="text-slate-400">Status:</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
              data.status === 'online'
                ? 'bg-emerald-950/40 text-emerald-400 border-emerald-900/60'
                : 'bg-rose-950/40 text-rose-400 border-rose-900/60'
            }`}>
              {data.status === 'online' ? 'Online' : 'Offline'}
            </span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

// Inline details dashboard inside expandable table rows
interface DeviceInlineDashboardProps {
  device: DeviceOption;
  activeTab: TimeRangeTab;
  customDateRange: DateRange;
  devStateOverride?: ModuleState;
  connectedStreamData?: WaterMeterDataResponse | null;
}

const DeviceInlineDashboard: React.FC<DeviceInlineDashboardProps> = ({
  device,
  activeTab,
  customDateRange,
  devStateOverride,
  connectedStreamData,
}) => {
  const { state, data, lastRefreshed, refetch, refreshInterval, setRefreshInterval, apiError } = useWaterMeterData({
    activeTab,
    customDateRange,
    selectedDevice: device,
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
    <div className="p-6 bg-slate-50/40 dark:bg-slate-900/30 border border-flostat-border dark:border-slate-800/80 rounded-2xl shadow-sm space-y-6">
      
      {/* Inline Dashboard Header with Refresh and Connection Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-flostat-border/60 dark:border-slate-800/40">
        <div className="flex items-center gap-3">
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
            data.metadata.deviceStatus === 'online'
              ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/30'
              : 'bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-900/30'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${data.metadata.deviceStatus === 'online' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
            {data.metadata.deviceStatus === 'online' ? 'Online' : 'Offline'}
          </span>
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

          <button
            onClick={() => refetch()}
            className="p-1.5 rounded-xl border border-flostat-border dark:border-slate-800 bg-white dark:bg-dark-card text-slate-600 dark:text-slate-300 hover:text-flostat-primary dark:hover:text-blue-400 hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-all shadow-sm active:scale-95 cursor-pointer"
            title="Refresh Telemetry Now"
          >
            <Activity className="w-4 h-4" />
          </button>
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
          title={`${activeTab === 'today' ? "Today's" : activeTab === 'week' ? "This Week's" : activeTab === 'month' ? "This Month's" : "Custom Period"} Total Consumption`}
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
  { id: 'month', label: 'Month' },
  { id: 'year', label: 'Year' },
  { id: 'custom', label: 'Custom' },
];

export const WaterMeterMonitoringPage: React.FC<WaterMeterMonitoringPageProps> = ({
  devStateOverride,
  connectedDataStream,
  devices,
  selectedDevice,
  onDeviceChange,
}) => {
  const [activeNav, setActiveNav] = useState<'overview' | 'devices' | 'compare'>('overview');
  const [activeTab, setActiveTab] = useState<TimeRangeTab>('today');
  const [customDateRange, setCustomDateRange] = useState<DateRange>({
    startDate: '2026-07-01',
    endDate: '2026-07-20',
  });

  const [expandedDeviceId, setExpandedDeviceId] = useState<string | null>(null);

  // Search, Filters & Pinning State for Devices Page
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filterPill, setFilterPill] = useState<'all' | 'online' | 'offline' | 'highest' | 'lowest'>('all');
  const [pinnedDevices, setPinnedDevices] = useState<string[]>(['FLOSTAT_001']);
  const [favoriteDevices, setFavoriteDevices] = useState<string[]>([]);
  const [exportNotification, setExportNotification] = useState<string | null>(null);

  // Comparison mode selections
  const [compareDeviceA, setCompareDeviceA] = useState<string>('FLOSTAT_001');
  const [compareDeviceB, setCompareDeviceB] = useState<string>('FLOSTAT_002');

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

  const handleTabClick = (tabId: TimeRangeTab) => {
    setActiveTab(tabId);
    if (tabId === 'custom') {
      setIsDatePickerOpen(true);
    } else {
      setIsDatePickerOpen(false);
    }
  };

  const formatDateLabel = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  // Fetch telemetry data for FLOSTAT_001
  const { data } = useWaterMeterData({
    activeTab,
    customDateRange,
    selectedDevice: devices.find((d) => d.id === 'FLOSTAT_001') || selectedDevice,
    devStateOverride,
    connectedStreamData: connectedDataStream,
  });

  const flostat001Val = data ? data.metrics.todaysConsumption : 2450;
  const flostat001Flow = data ? data.metrics.liveFlowRate : 0;

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
      value: getDeviceConsumption('FLOSTAT_002', activeTab, customDateRange),
      flowRate: 14.2,
      status: 'online',
      color: deviceColors.FLOSTAT_002,
    },
    {
      name: 'FLOSTAT_003',
      location: 'Block A Tank',
      value: getDeviceConsumption('FLOSTAT_003', activeTab, customDateRange),
      flowRate: 18.6,
      status: 'online',
      color: deviceColors.FLOSTAT_003,
    },
    {
      name: 'FLOSTAT_004',
      location: 'Block B Tank',
      value: getDeviceConsumption('FLOSTAT_004', activeTab, customDateRange),
      flowRate: 0,
      status: 'offline',
      color: deviceColors.FLOSTAT_004,
    },
    {
      name: 'FLOSTAT_005',
      location: 'Fire Tank',
      value: getDeviceConsumption('FLOSTAT_005', activeTab, customDateRange),
      flowRate: 8.4,
      status: 'online',
      color: deviceColors.FLOSTAT_005,
    },
  ];

  const totalConsumption = rawPieData.reduce((sum, item) => sum + item.value, 0);

  const pieData = rawPieData.map((item) => ({
    ...item,
    percentage: totalConsumption > 0 ? (item.value / totalConsumption) * 100 : 0,
  }));



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
        const consA = a.id === 'FLOSTAT_001' ? flostat001Val : getDeviceConsumption(a.id, activeTab, customDateRange);
        const consB = b.id === 'FLOSTAT_001' ? flostat001Val : getDeviceConsumption(b.id, activeTab, customDateRange);
        return consB - consA;
      });
    } else if (filterPill === 'lowest') {
      result = [...result].sort((a, b) => {
        const consA = a.id === 'FLOSTAT_001' ? flostat001Val : getDeviceConsumption(a.id, activeTab, customDateRange);
        const consB = b.id === 'FLOSTAT_001' ? flostat001Val : getDeviceConsumption(b.id, activeTab, customDateRange);
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
  }, [devices, searchTerm, filterPill, pinnedDevices, activeTab, customDateRange, flostat001Val]);



  // Compute comparison modes for Device A vs Device B (Dedicated Tab)
  const devAObj = rawPieData.find(d => d.name === compareDeviceA) || rawPieData[0];
  const devBObj = rawPieData.find(d => d.name === compareDeviceB) || rawPieData[1];
  const compareDelta = devAObj.value - devBObj.value;
  const comparePct = devBObj.value > 0 ? (compareDelta / devBObj.value) * 100 : 0;

  const compareTrendData = React.useMemo(() => {
    const ticks = ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00'];
    return ticks.map((tick, idx) => {
      const baseA = devAObj.flowRate || 10;
      const baseB = devBObj.flowRate || 12;
      return {
        label: tick,
        [devAObj.name]: Number((baseA + Math.sin(idx) * 3 + Math.random()).toFixed(1)),
        [devBObj.name]: Number((baseB + Math.cos(idx) * 2 + Math.random()).toFixed(1))
      };
    });
  }, [compareDeviceA, compareDeviceB, devAObj, devBObj]);

  return (
    <div className="w-full max-w-[1600px] mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
      
      {/* Top Global SaaS Status & Health Ticker */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-3 px-5 bg-slate-900/60 dark:bg-slate-900/40 border border-flostat-border/40 dark:border-slate-800 rounded-2xl text-[11px] font-semibold text-slate-500 dark:text-dark-muted shadow-sm backdrop-blur-md">
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span className="text-slate-700 dark:text-slate-200">System Health:</span>
            <span className="text-emerald-500 dark:text-emerald-400 font-bold">98.2% Optimal</span>
          </div>

          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            <span className="text-slate-700 dark:text-slate-200">API Status:</span>
            <span className="text-blue-500 dark:text-blue-400 font-bold">Connected (AWS Live Gateway)</span>
          </div>

          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-slate-400" />
            <span className="text-slate-700 dark:text-slate-200">Meters Status:</span>
            <span className="text-slate-600 dark:text-slate-300 font-bold">4 Online | 1 Standby</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <span>Last Synced: <span className="text-slate-700 dark:text-slate-200">Just now (1s ago)</span></span>
          <span className="h-3 w-px bg-slate-200 dark:bg-slate-800" />
          <span>Refreshes: <span className="text-slate-700 dark:text-slate-200">Every 10s</span></span>
        </div>
      </div>

      {/* Main Two-Column Sidebar Layout */}
      <div className="flex flex-col lg:flex-row gap-6 min-h-[calc(100vh-140px)]">
        {/* Left Compact Sidebar */}
        <aside className="w-full lg:w-56 shrink-0 self-start space-y-4">
          <div className="bg-white dark:bg-dark-card border border-flostat-border dark:border-slate-800/80 rounded-2xl p-3.5 shadow-flostat space-y-1.5">
            <div className="px-3 pb-2 text-[10px] font-bold tracking-wider uppercase text-slate-400 dark:text-slate-500">
              Operations
            </div>
            
            <button
              onClick={() => setActiveNav('overview')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${
                activeNav === 'overview'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/10'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-white'
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
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <Server className="w-4 h-4" />
                <span>Meters Catalog</span>
              </div>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold transition-all ${
                activeNav === 'devices'
                  ? 'bg-blue-700 text-blue-100'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
              }`}>
                {devices.length}
              </span>
            </button>

            <button
              onClick={() => setActiveNav('compare')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${
                activeNav === 'compare'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/10'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <TrendingUp className="w-4 h-4" />
              <span>Comparison Mode</span>
            </button>
          </div>

          {/* Quick Stats sidebar widget */}
          <div className="hidden lg:block bg-slate-900/40 border border-slate-800 rounded-2xl p-4 space-y-3">
            <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Operational Summary</h4>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Total Consumption:</span>
                <span className="font-bold text-slate-200">{formatNumber(totalConsumption, 0)} L</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Active Peak Rate:</span>
                <span className="font-bold text-amber-400">18.6 L/min</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Offline Standby:</span>
                <span className="font-bold text-rose-500">1 Meter</span>
              </div>
            </div>
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
                  <h2 className="text-xl md:text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                    Overall Facility Overview
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    aggregated real-time diagnostics, device contribution shares, and growth charts
                  </p>
                </div>

                {/* Period Select Button Tabs */}
                <div className="flex flex-wrap items-center gap-3 shrink-0">
                  <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700/60">
                    {TABS.map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => handleTabClick(tab.id)}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all capitalize cursor-pointer ${
                          activeTab === tab.id
                            ? 'bg-white dark:bg-dark-card text-flostat-primary dark:text-blue-400 shadow-sm'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {activeTab === 'custom' && (
                    <div className="relative inline-block text-left" ref={popoverRef}>
                      <button
                        onClick={() => setIsDatePickerOpen((prev) => !prev)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-blue-200 dark:border-blue-850 bg-blue-50/80 dark:bg-blue-950/40 text-flostat-primary dark:text-blue-300 text-xs font-semibold hover:bg-blue-100 transition-all shadow-sm cursor-pointer"
                      >
                        <Calendar className="w-3.5 h-3.5" />
                        <span>
                          {formatDateLabel(customDateRange.startDate)} - {formatDateLabel(customDateRange.endDate)}
                        </span>
                        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isDatePickerOpen ? 'rotate-180' : ''}`} />
                      </button>

                      {isDatePickerOpen && (
                        <div className="absolute right-0 top-full mt-2 w-80 p-4 bg-white dark:bg-dark-card border border-flostat-border dark:border-slate-800 rounded-2xl shadow-2xl z-50 space-y-4">
                          <div className="space-y-3">
                            <h4 className="font-bold text-xs text-slate-800 dark:text-white">Custom Date Range</h4>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div>
                                <label className="block text-[10px] text-slate-400 font-bold mb-1 uppercase">Start Date</label>
                                <input
                                  type="date"
                                  value={startDate}
                                  onChange={(e) => setStartDate(e.target.value)}
                                  className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-850 dark:text-white focus:outline-none"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] text-slate-400 font-bold mb-1 uppercase">End Date</label>
                                <input
                                  type="date"
                                  value={endDate}
                                  onChange={(e) => setEndDate(e.target.value)}
                                  className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-850 dark:text-white focus:outline-none"
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
              </div>



              {/* TIER 2: Distribution Donut Chart & Device Table (2 columns) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
                
                {/* Left Column: Donut Chart */}
                <div className="lg:col-span-5 bg-white dark:bg-dark-card border border-flostat-border dark:border-slate-800/80 p-5 rounded-2xl shadow-sm flex flex-col justify-between">
                  <div>
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Consumption Allocation</h3>
                    <p className="text-[10px] text-slate-500 dark:text-dark-muted mt-0.5">Device percentage share of aggregate volume</p>
                  </div>
                  
                  <div className="relative flex items-center justify-center py-6">
                    <div className="relative w-full max-w-[240px] h-[240px]">
                      <ResponsiveContainer width="100%" height="100%" className="relative z-10">
                        <PieChart>
                          <Pie
                            data={pieData}
                            cx="50%"
                            cy="50%"
                            innerRadius={65}
                            outerRadius={95}
                            paddingAngle={3}
                            dataKey="value"
                          >
                            {pieData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <RechartsTooltip content={<CustomPieTooltip />} wrapperStyle={{ zIndex: 50 }} />
                        </PieChart>
                      </ResponsiveContainer>
                      
                      {/* Inner text inside donut */}
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-0">
                        <span className="text-[10px] font-bold tracking-wider text-slate-400 dark:text-slate-500 uppercase">
                          Total
                        </span>
                        <span className="text-xl font-extrabold text-slate-900 dark:text-white mt-0.5">
                          {formatNumber(totalConsumption, 0)} L
                        </span>
                        <span className="text-[9px] font-semibold text-slate-400 dark:text-slate-500 uppercase mt-0.5">
                          {activeTab}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-x-4 gap-y-2 justify-center text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                    {pieData.map((item) => (
                      <div key={item.name} className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                        <span>{item.name} ({item.percentage.toFixed(0)}%)</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Right Column: Device Summary Table */}
                <div className="lg:col-span-7 bg-white dark:bg-dark-card border border-flostat-border dark:border-slate-800/80 p-5 rounded-2xl shadow-sm flex flex-col justify-between">
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
                <div className="bg-white dark:bg-dark-card border border-flostat-border dark:border-slate-800/80 p-5 rounded-2xl shadow-sm space-y-4">
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
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search ID or Location..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9 pr-4 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-dark-card text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/25 w-48 sm:w-56 transition-all"
                    />
                  </div>

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

                  {/* Date range filter picker */}
                  <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700/60">
                    {TABS.map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => handleTabClick(tab.id)}
                        className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all capitalize cursor-pointer ${
                          activeTab === tab.id
                            ? 'bg-white dark:bg-dark-card text-flostat-primary dark:text-blue-400 shadow-sm'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {activeTab === 'custom' && (
                    <div className="relative inline-block text-left" ref={popoverRef}>
                      <button
                        onClick={() => setIsDatePickerOpen((prev) => !prev)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/80 dark:bg-blue-950/50 text-flostat-primary dark:text-blue-300 text-xs font-semibold hover:bg-blue-100 transition-all shadow-sm cursor-pointer"
                      >
                        <Calendar className="w-3.5 h-3.5" />
                        <span>
                          {formatDateLabel(customDateRange.startDate)} - {formatDateLabel(customDateRange.endDate)}
                        </span>
                        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isDatePickerOpen ? 'rotate-180' : ''}`} />
                      </button>

                      {isDatePickerOpen && (
                        <div className="absolute right-0 top-full mt-2 w-80 p-4 bg-white dark:bg-dark-card border border-flostat-border dark:border-dark-border rounded-2xl shadow-2xl z-50 space-y-4">
                          <div className="space-y-3">
                            <h4 className="font-bold text-xs text-slate-800 dark:text-white">Custom Date Range</h4>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div>
                                <label className="block text-[10px] text-slate-400 font-bold mb-1 uppercase">Start Date</label>
                                <input
                                  type="date"
                                  value={startDate}
                                  onChange={(e) => setStartDate(e.target.value)}
                                  className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white focus:outline-none"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] text-slate-400 font-bold mb-1 uppercase">End Date</label>
                                <input
                                  type="date"
                                  value={endDate}
                                  onChange={(e) => setEndDate(e.target.value)}
                                  className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white focus:outline-none"
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
              <div className="bg-white dark:bg-dark-card border border-flostat-border dark:border-slate-800/80 rounded-2xl overflow-hidden shadow-flostat">
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
                          const deviceCons = device.id === 'FLOSTAT_001' ? flostat001Val : getDeviceConsumption(device.id, activeTab, customDateRange);
                          const deviceFlow = device.id === 'FLOSTAT_001' ? flostat001Flow : device.id === 'FLOSTAT_002' ? 14.2 : device.id === 'FLOSTAT_003' ? 18.6 : device.id === 'FLOSTAT_005' ? 8.4 : 0;
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
                                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                                    device.status === 'online'
                                      ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/30'
                                      : 'bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-900/30'
                                  }`}>
                                    <span className={`w-1 h-1 rounded-full mr-1.5 ${device.status === 'online' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                                    {device.status === 'online' ? 'Online' : 'Offline'}
                                  </span>
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
              <div className="pb-4 border-b border-flostat-border dark:border-slate-850 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white">Enterprise Comparison Engine</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Compare flow profile charts and absolute consumption volume parameters between any two devices.
                  </p>
                </div>
                
                {/* Active Period Tab Switcher */}
                <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700/60 shrink-0">
                  {TABS.slice(0, 4).map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all capitalize cursor-pointer ${
                        activeTab === tab.id
                          ? 'bg-white dark:bg-dark-card text-flostat-primary dark:text-blue-400 shadow-sm'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Selector Panels: Device A vs Device B Dropdowns */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50 dark:bg-dark-card/30 p-5 rounded-2xl border border-flostat-border dark:border-slate-800">
                
                {/* Device A Dropdown */}
                <div className="space-y-2">
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">Device A (Reference)</label>
                  <select
                    value={compareDeviceA}
                    onChange={(e) => setCompareDeviceA(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-flostat-border dark:border-slate-800 bg-white dark:bg-dark-card text-slate-800 dark:text-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/25 cursor-pointer"
                  >
                    {rawPieData.map((d) => (
                      <option key={d.name} value={d.name}>{d.name} — {d.location}</option>
                    ))}
                  </select>
                </div>

                {/* Device B Dropdown */}
                <div className="space-y-2">
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">Device B (Target)</label>
                  <select
                    value={compareDeviceB}
                    onChange={(e) => setCompareDeviceB(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-flostat-border dark:border-slate-800 bg-white dark:bg-dark-card text-slate-800 dark:text-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/25 cursor-pointer"
                  >
                    {rawPieData.map((d) => (
                      <option key={d.name} value={d.name}>{d.name} — {d.location}</option>
                    ))}
                  </select>
                </div>

              </div>

              {/* delta & Variance Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                
                {/* Device A Consumption */}
                <div className="p-5 bg-white dark:bg-dark-card border border-flostat-border dark:border-slate-800 rounded-2xl shadow-sm space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{devAObj.name} Consumption</span>
                  <div className="text-2xl font-black text-slate-900 dark:text-white">{formatNumber(devAObj.value, 0)} L</div>
                  <span className="text-[10px] text-slate-400">Location: {devAObj.location}</span>
                </div>

                {/* Device B Consumption */}
                <div className="p-5 bg-white dark:bg-dark-card border border-flostat-border dark:border-slate-800 rounded-2xl shadow-sm space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{devBObj.name} Consumption</span>
                  <div className="text-2xl font-black text-slate-900 dark:text-white">{formatNumber(devBObj.value, 0)} L</div>
                  <span className="text-[10px] text-slate-400">Location: {devBObj.location}</span>
                </div>

                {/* Variance Delta Card */}
                <div className="p-5 bg-white dark:bg-dark-card border border-flostat-border dark:border-slate-800 rounded-2xl shadow-sm space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Variance Comparison</span>
                  <div className={`text-2xl font-black ${compareDelta >= 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                    {compareDelta >= 0 ? '+' : ''}{formatNumber(compareDelta, 0)} L
                  </div>
                  <span className={`text-[10px] font-bold ${compareDelta >= 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                    {compareDelta >= 0 ? '▲' : '▼'} {comparePct.toFixed(1)}% delta variance
                  </span>
                </div>

              </div>

              {/* Side-by-Side overlay telemetry chart */}
              <div className="bg-white dark:bg-dark-card border border-flostat-border dark:border-slate-800 p-5 rounded-2xl shadow-sm space-y-4">
                <div>
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Flow Profiles Overlay Comparison</h3>
                  <p className="text-[10px] text-slate-500 dark:text-dark-muted mt-0.5">Real-time flow rate curves graphed on same axis</p>
                </div>

                <div className="w-full h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={compareTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148, 163, 184, 0.15)" />
                      <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#94A3B8', fontSize: 10 }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94A3B8', fontSize: 10 }} unit=" L/m" />
                      <RechartsTooltip />
                      <Legend wrapperStyle={{ fontSize: '10px', marginTop: '10px' }} />
                      <Line type="monotone" dataKey={devAObj.name} stroke={deviceColors[devAObj.name] || '#2563EB'} strokeWidth={2.5} activeDot={{ r: 5 }} />
                      <Line type="monotone" dataKey={devBObj.name} stroke={deviceColors[devBObj.name] || '#10B981'} strokeWidth={2} strokeDasharray="3 3" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

            </div>
          )}

        </div>
      </div>
    </div>
  );
};
