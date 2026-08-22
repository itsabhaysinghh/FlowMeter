import { useState, useEffect, useCallback, useRef } from 'react';
import type { WaterMeterDataResponse, ModuleState, TimeRangeTab, DeviceOption, DateRange } from '../types/meter.types';
import { meterService } from '../services/meter.service';
import { formatLastSeen } from '../utils/formatters';

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
  const isFetchingRef = useRef<boolean>(false);

  const [refreshInterval, setRefreshIntervalState] = useState<number>(() => {
    const saved = sessionStorage.getItem('flostat_refresh_interval');
    return saved ? parseInt(saved, 10) : 1000;
  });

  const setRefreshInterval = useCallback((intervalMs: number) => {
    setRefreshIntervalState(intervalMs);
    sessionStorage.setItem('flostat_refresh_interval', intervalMs.toString());
  }, []);

  const fetchData = useCallback(async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    // This token intentionally invalidates the callback after a confirmed delete.
    void dataRefreshToken;
    setApiError(null);

    if (devStateOverride === 'connected' && connectedStreamData) {
      setState('connected');
      setData(connectedStreamData);
      setLastRefreshed(new Date().toLocaleTimeString());
      isFetchingRef.current = false;
      return;
    }
    if (devStateOverride === 'empty') {
      setState('empty');
      setData(null);
      isFetchingRef.current = false;
      return;
    }

    if (!selectedDevice) {
      setState('empty');
      setData(null);
      isFetchingRef.current = false;
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

      if (!metrics) {
        setData(null);
        setState('empty');
        setApiError('AWS API Gateway returned 404 (Not Found) or empty payload.');
      } else {
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
          metrics: metrics
            ? {
                ...metrics,
                todaysConsumption:
                  summary?.total_volume_litres ?? metrics.todaysConsumption,
                averageFlowRate:
                  history && history.length > 0
                    ? history.reduce((sum, item) => sum + item.flowRate, 0) /
                      history.length
                    : metrics.averageFlowRate,
              }
            : metrics,
          consumptionTrend: summary?.consumption_chart || [],
          flowTrend: summary?.flow_trend_chart || trend || [],
          history: history || [],
        });
        setState('connected');
      }
      setLastRefreshed(new Date().toLocaleTimeString());
    } catch (err: any) {
      console.error('Error fetching water meter data:', err);
      const statusText = err.response ? `HTTP ${err.response.status} (${err.response.statusText || 'Not Found'})` : err.message || 'Connection Error';
      setApiError(`Axios Request Failed: ${statusText}`);
      setState('empty');
      setData(null);
    } finally {
      isFetchingRef.current = false;
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
