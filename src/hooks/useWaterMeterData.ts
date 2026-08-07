import { useState, useEffect, useCallback } from 'react';
import type { 
  WaterMeterDataResponse, 
  ModuleState, 
  TimeRangeTab,
  DeviceOption,
  DateRange,
  ConsumptionDataPoint,
  FlowTrendDataPoint,
  FlowHistoryRecord
} from '../types/meter.types';
import { meterService } from '../services/meter.service';
import { formatLastSeen } from '../utils/formatters';

export interface UseWaterMeterDataOptions {
  activeTab?: TimeRangeTab;
  customDateRange?: DateRange;
  selectedDevice?: DeviceOption | null;
  devStateOverride?: ModuleState;
  connectedStreamData?: WaterMeterDataResponse | null;
}

export function getSeedNoise(seedStr: string): number {
  let hash = 0;
  for (let i = 0; i < seedStr.length; i++) {
    hash = seedStr.charCodeAt(i) + ((hash << 5) - hash);
  }
  const val = Math.abs(Math.sin(hash)) * 1000;
  return val - Math.floor(val);
}

export function getDeviceDailyConsumption(deviceId: string, date: Date): number {
  const isOffline = deviceId === 'FLOSTAT_004';
  
  const year = date.getFullYear();
  const month = date.getMonth(); // 0-indexed
  const day = date.getDate(); // 1-indexed
  
  // 1. Check maintenance/offline periods
  if (deviceId === 'FLOSTAT_004') {
    // Block B tank seasonal maintenance shutoff: June 1-14 and Dec 1-14
    if ((month === 5 && day >= 1 && day <= 14) || (month === 11 && day >= 1 && day <= 14)) {
      return 0; // zero flow and consumption
    }
    // Monthly maintenance days
    if (day === 5 || day === 20) {
      return 0;
    }
  }
  
  // Ground tank maintenance: 12th of every month
  if (deviceId === 'FLOSTAT_002' && day === 12) {
    return 300; // partial day maintenance
  }
  
  // Block A tank maintenance: 3rd and 17th of every month
  if (deviceId === 'FLOSTAT_003' && (day === 3 || day === 17)) {
    return 150;
  }
  
  let baseVal = 1000;
  let weekendScale = 1.0;
  if (deviceId === 'FLOSTAT_002') { baseVal = 1820; weekendScale = 0.75; }
  else if (deviceId === 'FLOSTAT_003') { baseVal = 1540; weekendScale = 0.3; }
  else if (deviceId === 'FLOSTAT_004') { baseVal = 980; weekendScale = 0.2; }
  else if (deviceId === 'FLOSTAT_005') { 
    baseVal = 12; 
    // Fire tank testing on first Sunday of the month
    const isSunday = date.getDay() === 0;
    if (isSunday && day <= 7) {
      return 1512;
    }
    return baseVal;
  }
  
  // 2. Seasonality factor (sine wave peaking in June)
  const seasonFactor = 1.0 + 0.25 * Math.sin((month - 5) * Math.PI / 6);
  
  // 3. Weekday vs Weekend scale
  const isWeekend = date.getDay() === 0 || date.getDay() === 6;
  const dayFactor = isWeekend ? weekendScale : 1.0;
  
  // 4. Deterministic noise/fluctuation based on date hash
  const dateStr = `${deviceId}-${year}-${month + 1}-${day}`;
  const noise = 0.8 + 0.4 * getSeedNoise(dateStr); // 0.8 to 1.2
  
  return isOffline ? 0 : Math.round(baseVal * seasonFactor * dayFactor * noise);
}

export function getPeriodBoundaries(tab: TimeRangeTab, customRange?: DateRange): { start: Date; end: Date } {
  const start = new Date();
  const end = new Date();
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);
  
  if (tab === 'week') {
    start.setDate(start.getDate() - 6);
  } else if (tab === 'month') {
    start.setDate(start.getDate() - 29);
  } else if (tab === 'year') {
    start.setDate(start.getDate() - 365);
  } else if (tab === 'custom' && customRange) {
    const s = new Date(customRange.startDate);
    s.setHours(0, 0, 0, 0);
    const e = new Date(customRange.endDate);
    e.setHours(23, 59, 59, 999);
    return { start: s, end: e };
  }
  return { start, end };
}

export function getDevicePeriodConsumption(deviceId: string, tab: TimeRangeTab, customRange?: DateRange): number {
  const { start, end } = getPeriodBoundaries(tab, customRange);
  let total = 0;
  const loopDate = new Date(start);
  while (loopDate <= end) {
    total += getDeviceDailyConsumption(deviceId, loopDate);
    loopDate.setDate(loopDate.getDate() + 1);
  }
  return total;
}

export function getAggregatedConsumption(deviceId: string, start: Date, end: Date): ConsumptionDataPoint[] {
  const diffTime = Math.abs(end.getTime() - start.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  
  if (diffDays <= 1) {
    // Return hourly data (24 points)
    const hours = [
      '12 AM', '01 AM', '02 AM', '03 AM', '04 AM', '05 AM', '06 AM', '07 AM', '08 AM', '09 AM', '10 AM', '11 AM',
      '12 PM', '01 PM', '02 PM', '03 PM', '04 PM', '05 PM', '06 PM', '07 PM', '08 PM', '09 PM', '10 PM', '11 PM'
    ];
    const dailyTotal = getDeviceDailyConsumption(deviceId, start);
    
    return hours.map((hour, idx) => {
      let multiplier = 0.5;
      
      if (deviceId === 'FLOSTAT_002') {
        if ((idx >= 8 && idx <= 10) || (idx >= 17 && idx <= 19)) multiplier = 1.8;
        else if (idx >= 23 || idx <= 5) multiplier = 0.2;
      } else if (deviceId === 'FLOSTAT_003') {
        if ((idx >= 7 && idx <= 9) || (idx >= 16 && idx <= 18)) multiplier = 2.2;
        else if (idx >= 22 || idx <= 4) multiplier = 0.1;
      } else if (deviceId === 'FLOSTAT_004') {
        if ((idx >= 9 && idx <= 11) || (idx >= 14 && idx <= 16)) multiplier = 1.9;
        else if (idx >= 21 || idx <= 5) multiplier = 0.1;
      } else if (deviceId === 'FLOSTAT_005') {
        const isSunday = start.getDay() === 0;
        const day = start.getDate();
        if (isSunday && day <= 7) {
          if (idx === 10) multiplier = 25.0; // test hour
          else multiplier = 0.1;
        } else {
          multiplier = 1.0;
        }
      }
      
      const seed = `${deviceId}-${start.getFullYear()}-${start.getMonth()}-${start.getDate()}-H-${idx}`;
      const noise = 0.9 + 0.2 * getSeedNoise(seed);
      
      return {
        label: hour,
        litres: dailyTotal === 0 ? 0 : Math.round((dailyTotal / 24) * multiplier * noise),
        isPeak: multiplier > 1.5
      };
    });
  }
  
  if (diffDays <= 31) {
    // Return daily points
    const points: ConsumptionDataPoint[] = [];
    const current = new Date(start);
    while (current <= end) {
      const litres = getDeviceDailyConsumption(deviceId, current);
      const mLabel = current.toLocaleDateString('en-US', { month: 'short' });
      const dLabel = current.getDate();
      points.push({
        label: `${mLabel} ${dLabel < 10 ? '0' + dLabel : dLabel}`,
        litres,
        isPeak: litres > 1500 && Math.random() > 0.8
      });
      current.setDate(current.getDate() + 1);
    }
    return points;
  }
  
  if (diffDays <= 180) {
    // Return weekly points
    const points: ConsumptionDataPoint[] = [];
    const current = new Date(start);
    let weekSum = 0;
    let weekStart = new Date(current);
    let count = 0;
    
    while (current <= end) {
      weekSum += getDeviceDailyConsumption(deviceId, current);
      count++;
      if (current.getDay() === 0 || current.getTime() >= end.getTime() || count === 7) {
        const dateStr = weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        points.push({
          label: `Wk of ${dateStr}`,
          litres: weekSum,
          isPeak: false
        });
        weekSum = 0;
        count = 0;
        weekStart = new Date(current);
        weekStart.setDate(weekStart.getDate() + 1);
      }
      current.setDate(current.getDate() + 1);
    }
    return points;
  }
  
  // Year or 5 Years: Return monthly points
  const points: ConsumptionDataPoint[] = [];
  const current = new Date(start);
  
  while (current <= end) {
    const year = current.getFullYear();
    const month = current.getMonth();
    
    const startOfMonth = new Date(year, month, 1);
    const endOfMonth = new Date(year, month + 1, 0);
    
    const loopStart = startOfMonth < start ? start : startOfMonth;
    const loopEnd = endOfMonth > end ? end : endOfMonth;
    
    let monthSum = 0;
    const loopDate = new Date(loopStart);
    while (loopDate <= loopEnd) {
      monthSum += getDeviceDailyConsumption(deviceId, loopDate);
      loopDate.setDate(loopDate.getDate() + 1);
    }
    
    const mLabel = startOfMonth.toLocaleDateString('en-US', { month: 'short' });
    points.push({
      label: `${mLabel} ${year}`,
      litres: monthSum,
      isPeak: false
    });
    
    current.setMonth(current.getMonth() + 1);
    current.setDate(1);
  }
  return points;
}

function generateMockDeviceData(deviceId: string, activeTab: TimeRangeTab, customDateRange?: DateRange): WaterMeterDataResponse {
  const isOffline = deviceId === 'FLOSTAT_004';
  const status = isOffline ? 'offline' : 'online';
  
  const { start, end } = getPeriodBoundaries(activeTab, customDateRange);
  const now = new Date();
  
  let baseFlow = 12.5;
  if (deviceId === 'FLOSTAT_002') baseFlow = 14.2;
  else if (deviceId === 'FLOSTAT_003') baseFlow = 18.6;
  else if (deviceId === 'FLOSTAT_005') baseFlow = 0.1;
  
  const liveFlowRate = isOffline ? 0 : Number((baseFlow + (Math.sin(now.getTime() / 60000) * 1.5) + (Math.random() - 0.5)).toFixed(1));
  
  const todaysConsumption = getDevicePeriodConsumption(deviceId, activeTab, customDateRange);
  const consumptionTrend = getAggregatedConsumption(deviceId, start, end);
  
  const flowTrend: FlowTrendDataPoint[] = [];
  for (let i = 60; i >= 0; i--) {
    const time = new Date(now.getTime() - i * 60000);
    const hour = time.getHours();
    
    let mult = 0.8;
    if (deviceId === 'FLOSTAT_002') {
      if ((hour >= 8 && hour <= 10) || (hour >= 17 && hour <= 19)) mult = 1.8;
      else if (hour >= 23 || hour <= 5) mult = 0.2;
    } else if (deviceId === 'FLOSTAT_003') {
      if ((hour >= 7 && hour <= 9) || (hour >= 16 && hour <= 18)) mult = 2.2;
      else if (hour >= 22 || hour <= 4) mult = 0.1;
    } else if (deviceId === 'FLOSTAT_004') {
      if ((hour >= 9 && hour <= 11) || (hour >= 14 && hour <= 16)) mult = 1.9;
      else if (hour >= 21 || hour <= 5) mult = 0.1;
    } else if (deviceId === 'FLOSTAT_005') {
      const isSunday = time.getDay() === 0;
      const day = time.getDate();
      if (isSunday && day <= 7 && hour === 10) mult = 250.0;
      else mult = 1.0;
    }
    
    const dailyCons = getDeviceDailyConsumption(deviceId, time);
    const isMaintenanceDay = dailyCons === 0;
    
    const noise = 0.9 + 0.2 * getSeedNoise(`${deviceId}-flow-${time.getTime()}`);
    const finalFlow = isOffline || isMaintenanceDay ? 0 : Math.max(0, Number((baseFlow * mult * noise).toFixed(1)));
    
    flowTrend.push({
      time: time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      flowRate: finalFlow
    });
  }
  
  const history: FlowHistoryRecord[] = [];
  const historyStart = new Date(end);
  const historyEnd = historyStart > now ? now : historyStart;
  
  for (let i = 1; i <= 20; i++) {
    const time = new Date(historyEnd.getTime() - i * 3600000);
    const hour = time.getHours();
    
    let mult = 0.8;
    if (deviceId === 'FLOSTAT_002') {
      if ((hour >= 8 && hour <= 10) || (hour >= 17 && hour <= 19)) mult = 1.8;
      else if (hour >= 23 || hour <= 5) mult = 0.2;
    } else if (deviceId === 'FLOSTAT_003') {
      if ((hour >= 7 && hour <= 9) || (hour >= 16 && hour <= 18)) mult = 2.2;
      else if (hour >= 22 || hour <= 4) mult = 0.1;
    } else if (deviceId === 'FLOSTAT_004') {
      if ((hour >= 9 && hour <= 11) || (hour >= 14 && hour <= 16)) mult = 1.9;
      else if (hour >= 21 || hour <= 5) mult = 0.1;
    } else if (deviceId === 'FLOSTAT_005') {
      const isSunday = time.getDay() === 0;
      const day = time.getDate();
      if (isSunday && day <= 7 && hour === 10) mult = 250.0;
      else mult = 1.0;
    }
    
    const dailyCons = getDeviceDailyConsumption(deviceId, time);
    const isMaintenanceDay = dailyCons === 0;
    
    const noise = 0.9 + 0.2 * getSeedNoise(`${deviceId}-hist-${time.getTime()}`);
    const flowVal = isOffline || isMaintenanceDay ? 0 : Number((baseFlow * mult * noise).toFixed(1));
    const totalVal = Math.round(flowVal * 60);
    
    history.push({
      id: `${deviceId}-history-${time.getTime()}`,
      time: time.toLocaleString(),
      duration: '3600 sec',
      flowRate: flowVal,
      totalLitres: totalVal,
      status: isOffline || isMaintenanceDay ? 'Offline' : flowVal > baseFlow * 1.5 ? 'Peak' : flowVal < baseFlow * 0.3 ? 'Low Flow' : 'Normal',
    });
  }

  return {
    metadata: {
      meterId: deviceId,
      facilityName: 'Default Site',
      meterName: deviceId === 'FLOSTAT_002' ? 'Ground Tank' : deviceId === 'FLOSTAT_003' ? 'Block A Tank' : deviceId === 'FLOSTAT_004' ? 'Block B Tank' : deviceId === 'FLOSTAT_005' ? 'Fire Tank' : 'System Meter',
      deviceStatus: status,
      lastUpdated: isOffline ? 'Offline' : 'Just now (1 sec ago)',
      currentDate: new Date().toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      }),
    },
    metrics: {
      liveFlowRate: liveFlowRate,
      todaysConsumption: todaysConsumption,
      averageFlowRate: isOffline ? 0 : Number((baseFlow * 0.95).toFixed(1)),
      connectionStatus: isOffline ? 'Disconnected' : 'Connected',
    },
    consumptionTrend,
    flowTrend,
    history,
  };
}

export function useWaterMeterData(options: UseWaterMeterDataOptions = {}) {
  const { activeTab = 'today', customDateRange, selectedDevice, devStateOverride, connectedStreamData } = options;
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

    if (meterId !== 'FLOSTAT_001') {
      const mockData = generateMockDeviceData(meterId, activeTab, customDateRange);
      setData(mockData);
      setState('connected');
      setLastRefreshed(new Date().toLocaleTimeString());
      setApiError(null);
      return;
    }

    try {
      const [metadata, metrics, summary, trend, history] =
      await Promise.all([
          meterService.getMeterMetadata(meterId),
          meterService.getLiveFlowRate(meterId),
          meterService.getConsumption(activeTab, meterId, customDateRange),
          meterService.getFlowTrend(meterId),
          meterService.getFlowHistory(undefined, meterId),
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
    }
  }, [activeTab, customDateRange, devStateOverride, connectedStreamData, selectedDevice]);

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
