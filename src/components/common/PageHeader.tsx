import React, { useState, useEffect } from 'react';
import { ChevronRight, Building2, Gauge, Clock, Calendar, RefreshCw, ChevronDown } from 'lucide-react';
import type { MeterMetadata, DeviceOption } from '../../types/meter.types';
import { StatusBadge } from './StatusBadge';
import { ExportButtons } from './ExportButtons';
import { getCurrentFormattedDate, getCurrentTimestamp } from '../../utils/formatters';

interface PageHeaderProps {
  metadata?: MeterMetadata | null;
  lastRefreshed?: string;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  onDeviceChange?: (device: DeviceOption) => void;
  devices?: DeviceOption[];
  selectedDevice?: DeviceOption | null;
  refreshInterval?: number;
  onRefreshIntervalChange?: (intervalMs: number) => void;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  metadata,
  lastRefreshed,
  onRefresh,
  isRefreshing = false,
  selectedDevice,
  refreshInterval = 60000,
  onRefreshIntervalChange,
}) => {
  const [liveTime, setLiveTime] = useState<string>(getCurrentTimestamp());
  const currentDate = metadata?.currentDate || getCurrentFormattedDate();

  useEffect(() => {
    const timer = setInterval(() => {
      setLiveTime(getCurrentTimestamp());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex flex-col gap-4 mb-6">
      {/* Breadcrumb Navigation & Top Action Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <nav className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
          <span className="hover:text-flostat-primary dark:hover:text-blue-400 transition-colors cursor-pointer">
            Flostat
          </span>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          <span className="hover:text-flostat-primary dark:hover:text-blue-400 transition-colors cursor-pointer">
            Water Meter
          </span>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-slate-800 dark:text-slate-200 font-semibold">
            {metadata?.meterName || selectedDevice?.name || 'No registered devices found.'}
          </span>
        </nav>

        {/* Top Right Header Export Controls */}
        <div className="flex items-center gap-2 self-end sm:self-auto">
          <div className="relative inline-block text-left">
            <select
              value={refreshInterval}
              onChange={(e) => onRefreshIntervalChange?.(parseInt(e.target.value, 10))}
              className="appearance-none pr-8 pl-3 py-2 rounded-xl border border-flostat-border dark:border-dark-border bg-white dark:bg-dark-card hover:bg-slate-50 dark:hover:bg-slate-800/80 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-all shadow-sm focus:outline-none cursor-pointer"
              title="Auto Refresh Settings"
            >
              <option value={5000} className="bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200">5 Seconds</option>
              <option value={10000} className="bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200">10 Seconds</option>
              <option value={30000} className="bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200">30 Seconds</option>
              <option value={60000} className="bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200">1 Minute</option>
              <option value={300000} className="bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200">5 Minutes</option>
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-400">
              <ChevronDown className="w-3.5 h-3.5" />
            </div>
          </div>
          <ExportButtons variant="compact" />
        </div>
      </div>

      {/* Title & Device Selector Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-flostat-border dark:border-dark-border">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 dark:text-white flex flex-wrap items-center gap-3">
            Water Meter Monitoring
            {metadata?.deviceStatus && (
              <StatusBadge status={metadata.deviceStatus} type="device" size="md" />
            )}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Real-time flow rates, consumption telemetry, and historical diagnostics
          </p>
        </div>

        {/* Device Selection Block & Live Time Controls */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-col text-right">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 flex items-center justify-end gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              {currentDate}
            </span>
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-end gap-1.5 mt-0.5">
              <Clock className="w-3.5 h-3.5 text-flostat-secondary" />
              {liveTime}
            </span>
          </div>

          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={isRefreshing}
              className="p-2.5 rounded-xl border border-flostat-border dark:border-dark-border bg-white dark:bg-dark-card text-slate-600 dark:text-slate-300 hover:text-flostat-primary dark:hover:text-blue-400 hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-all shadow-sm active:scale-95 disabled:opacity-50"
              title="Refresh Telemetry"
              aria-label="Refresh Telemetry"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-flostat-secondary' : ''}`} />
            </button>
          )}
        </div>
      </div>

      {/* Facility & Device Metadata Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-white dark:bg-dark-card p-3.5 rounded-2xl border border-flostat-border dark:border-dark-border shadow-flostat text-xs">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-flostat-primary dark:text-blue-400">
            <Building2 className="w-4 h-4" />
          </div>
          <div>
            <span className="text-slate-400 dark:text-slate-500 block text-[11px] font-medium">FACILITY</span>
            <span className="font-semibold text-slate-800 dark:text-slate-200">
              {metadata?.facilityName || selectedDevice?.facility || '-'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-flostat-primary dark:text-blue-400">
            <Gauge className="w-4 h-4" />
          </div>
          <div>
            <span className="text-slate-400 dark:text-slate-500 block text-[11px] font-medium">METER NAME</span>
            <span className="font-semibold text-slate-800 dark:text-slate-200">
              {metadata?.meterName || selectedDevice?.name || '-'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <span className="text-slate-400 dark:text-slate-500 block text-[11px] font-medium">LAST UPDATED</span>
            <span className="font-semibold text-slate-800 dark:text-slate-200">
              {metadata?.lastUpdated || lastRefreshed || 'Waiting for stream...'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400">
            <Calendar className="w-4 h-4" />
          </div>
          <div>
            <span className="text-slate-400 dark:text-slate-500 block text-[11px] font-medium">CURRENT DATE & TIME</span>
            <span className="font-semibold text-slate-800 dark:text-slate-200">
              {currentDate} {liveTime}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
