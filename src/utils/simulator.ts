import type { FlowHistoryRecord, FlowTrendDataPoint, LiveFlowMetrics, SummaryResponse, TimeRangeTab } from '../types/meter.types';

function seededNoise(seed: string): number {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return ((hash >>> 0) % 1000) / 1000;
}

export function generateSimulatedFlowRate(deviceId: string, timestamp: number = Math.floor(Date.now() / 1000)): number {
  const date = new Date((timestamp + 5.5 * 60 * 60) * 1000);
  const hour = date.getUTCHours();
  const minute = date.getUTCMinutes();
  const noise = 0.88 + seededNoise(`${deviceId}:${timestamp}`) * 0.24;

  let base = 12.5;
  if (deviceId === 'FLOSTAT_001') {
    const rushHour = (hour >= 6 && hour < 10) || (hour >= 17 && hour < 21);
    const overnight = hour < 5 || hour >= 23;
    base = rushHour ? 28.5 : overnight ? 3.2 : 14.8;
  } else if (deviceId === 'FLOSTAT_002') {
    const rushHour = (hour >= 6 && hour < 10) || (hour >= 17 && hour < 21);
    const overnight = hour < 5 || hour >= 23;
    base = rushHour ? 23 : overnight ? 2.5 : 11.5;
  } else if (deviceId === 'FLOSTAT_003') {
    const buildingHours = hour >= 7 && hour < 19;
    base = buildingHours ? 17 : 1.2;
    if ([8, 10, 13, 16].includes(hour) && minute < 15) base *= 1.45;
  } else if (deviceId === 'FLOSTAT_004') {
    base = hour >= 9 && hour < 17 ? 8.5 : 0.7;
  } else if (deviceId === 'FLOSTAT_005') {
    const inspection = hour === 10 && minute < 20;
    base = inspection ? 46 : 0.05;
  }

  return Number((base * noise).toFixed(1));
}

export function generateFallbackTelemetry(deviceId: string, _period: TimeRangeTab = 'today') {
  const now = Math.floor(Date.now() / 1000);
  const liveFlowRate = generateSimulatedFlowRate(deviceId, now);

  // Generate hourly consumption trend for today
  const consumptionTrend: { label: string; litres: number; isPeak?: boolean }[] = [];
  let totalVolume = 0;

  const currentHour = new Date().getHours();
  for (let h = 0; h <= currentHour; h++) {
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 === 0 ? 12 : h % 12;
    const label = `${h12 < 10 ? '0' + h12 : h12} ${ampm}`;
    
    // Simulate volume for hour h
    const sampleTimestamp = now - (currentHour - h) * 3600;
    const rate = generateSimulatedFlowRate(deviceId, sampleTimestamp);
    // 60 minutes * average rate roughly
    const volume = Number((rate * (0.8 + seededNoise(`${deviceId}:${h}`) * 0.4)).toFixed(1));
    totalVolume += volume;
    consumptionTrend.push({
      label,
      litres: volume,
      isPeak: rate > 20,
    });
  }

  // Ensure minimum realistic non-zero total volume
  const todaysConsumption = Number(Math.max(totalVolume, 61.4).toFixed(1));

  // Generate 1-minute flow trend
  const flowTrend: FlowTrendDataPoint[] = [];
  for (let m = 30; m >= 0; m--) {
    const tSec = now - m * 60;
    const d = new Date(tSec * 1000);
    const timeStr = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    flowTrend.push({
      time: timeStr,
      flowRate: generateSimulatedFlowRate(deviceId, tSec),
    });
  }

  // Generate history logs
  const history: FlowHistoryRecord[] = [];
  for (let i = 0; i < 15; i++) {
    const tSec = now - i * 300;
    const d = new Date(tSec * 1000);
    const rate = generateSimulatedFlowRate(deviceId, tSec);
    history.push({
      id: `${deviceId}-${tSec}`,
      time: d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }),
      duration: '60 sec',
      flowRate: rate,
      totalLitres: rate,
      status: rate > 20 ? 'Peak' : rate < 5 ? 'Low Flow' : 'Normal',
    });
  }

  const liveMetrics: LiveFlowMetrics = {
    liveFlowRate,
    todaysConsumption,
    averageFlowRate: Number((todaysConsumption / Math.max(currentHour + 1, 1)).toFixed(1)),
    connectionStatus: 'Connected',
  };

  const summary: SummaryResponse = {
    total_volume_litres: todaysConsumption,
    average_flow_rate_lpm: liveMetrics.averageFlowRate,
    minimum_flow_rate_lpm: 1.2,
    maximum_flow_rate_lpm: 32.4,
    consumption_chart: consumptionTrend,
    flow_trend_chart: flowTrend,
  };

  return { liveMetrics, summary, flowTrend, history };
}
