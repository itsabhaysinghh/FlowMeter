import { useState, useEffect, useCallback } from 'react';
import type { WaterMeterDataResponse, ModuleState, TimeRangeTab, DeviceOption, DateRange } from '../types/meter.types';
import { meterService } from '../services/meter.service';
import { formatLastSeen } from '../utils/formatters';
import { generateFallbackTelemetry } from '../utils/simulator';

export interface UseWaterMeterDataOptions {
  activeTab?: TimeRangeTab;
  customDateRange?: DateRange;
  specificDate?: string;
  selectedMonth?: string;
  selectedYear?: string;
  selectedDevice?: DeviceOption | null;
  /** Increment after a confirmed server-side mutation to refresh telemetry views. */
  dataRefreshToken?: number;
  devStateOverride?: ModuleState;
  connectedStreamData?: WaterMeterDataResponse | null;
}

export function useWaterMeterData(options: UseWaterMeterDataOptions = {}) {
  const { activeTab = 'today', customDateRange, specificDate, selectedMonth, selectedYear, selectedDevice, dataRefreshToken, devStateOverride, connectedStreamData } = options;
  const [state, setState] = useState<ModuleState>(devStateOverride || 'empty');
  const [data, setData] = useState<WaterMeterDataResponse | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<string>('');
  const [apiError, setApiError] = useState<string | null>(null);

  const [refreshInterval, setRefreshIntervalState] = useState<number>(() => {
    const saved = sessionStorage.getItem('flostat_refresh_interval');
    return saved ? parseInt(saved, 10) : 60000;
  });

  const setRefreshInterval = useCallback((intervalMs: number) => {
    setRefreshIntervalState(intervalMs);
    sessionStorage.setItem('flostat_refresh_interval', intervalMs.toString());
  }, []);

  const fetchData = useCallback(async () => {
    // This token intentionally invalidates the callback after a confirmed delete.
    void dataRefreshToken;
    setApiError(null);

    if (devStateOverride === 'connected' && connectedStreamData) {
      setState('connected');
      setData(connectedStreamData);
      setLastRefreshed(new Date().toLocaleTimeString());
      return;
    }
    if (devStateOverride === 'empty') {
      setState('empty');
      setData(null);
      return;
    }

    if (!selectedDevice) {
      setState('empty');
      setData(null);
      return;
    }

    const meterId = selectedDevice.id;

    try {
      const [metadata, metrics, summary, trend, history] =
      await Promise.all([
          meterService.getMeterMetadata(meterId),
          meterService.getLiveFlowRate(meterId),
          meterService.getConsumption(activeTab, meterId, customDateRange, specificDate, selectedMonth, selectedYear),
          meterService.getFlowTrend(meterId, activeTab, customDateRange, specificDate, selectedMonth, selectedYear),
          meterService.getFlowHistory(undefined, meterId, activeTab, customDateRange, specificDate, selectedMonth, selectedYear),
      ]);

      const fallback = generateFallbackTelemetry(meterId, activeTab);

      const effectiveMetrics = metrics || fallback.liveMetrics;
      const effectiveSummary = (summary && summary.total_volume_litres > 0) ? summary : fallback.summary;
      const effectiveHistory = (history && history.length > 0) ? history : fallback.history;
      const effectiveTrend = (trend && trend.length > 0) ? trend : fallback.flowTrend;

      const calcConsumption = (summary && summary.total_volume_litres > 0)
        ? summary.total_volume_litres
        : (history && history.length > 0)
        ? history.reduce((sum, item) => sum + item.totalLitres, 0)
        : fallback.summary.total_volume_litres;

      setData({
        metadata: metadata || {
          meterId: selectedDevice.id,
          facilityName: selectedDevice.facility,
          meterName: selectedDevice.name,
          deviceStatus: selectedDevice.status,
          lastUpdated: selectedDevice.lastSeen ? formatLastSeen(selectedDevice.lastSeen) : 'Just now (1 sec ago)',
          currentDate: new Date().toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
          }),
        },
        metrics: {
          ...effectiveMetrics,
          todaysConsumption: calcConsumption,
          averageFlowRate:
            effectiveHistory.length > 0
              ? effectiveHistory.reduce((sum, item) => sum + item.flowRate, 0) / effectiveHistory.length
              : effectiveMetrics.averageFlowRate,
        },
        consumptionTrend: effectiveSummary.consumption_chart || fallback.summary.consumption_chart,
        flowTrend: effectiveSummary.flow_trend_chart || effectiveTrend || fallback.flowTrend,
        history: effectiveHistory,
      });
      setState('connected');
      setLastRefreshed(new Date().toLocaleTimeString());
    } catch (err: any) {
      console.error('Error fetching water meter data:', err);
      const statusText = err.response ? `HTTP ${err.response.status} (${err.response.statusText || 'Not Found'})` : err.message || 'Connection Error';
      setApiError(`Axios Request Failed: ${statusText}`);
      setState('empty');
      setData(null);
    }
  }, [activeTab, customDateRange, specificDate, selectedMonth, selectedYear, dataRefreshToken, devStateOverride, connectedStreamData, selectedDevice]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (refreshInterval <= 0) return;
    const timer = setInterval(() => {
      fetchData();
    }, refreshInterval);
    return () => clearInterval(timer);
  }, [fetchData, refreshInterval]);

  return {
    state,
    data,
    lastRefreshed,
    apiError,
    isLiveMode: devStateOverride === undefined,
    refetch: fetchData,
    refreshInterval,
    setRefreshInterval,
  };
}
