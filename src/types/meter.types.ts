export type DeviceStatus = 'online' | 'warning' | 'offline';
export type ConnectionStatus = 'Connected' | 'Reconnecting' | 'Disconnected';
export type FlowStatus = 'Normal' | 'Peak' | 'Low Flow' | 'Warning' | 'Offline';
export type TimeRangeTab = 'today' | 'week' | 'specific' | 'month' | 'year' | 'custom';
export type ModuleState = 'empty' | 'connected';

export interface DeviceOption {
  id: string;
  name: string;
  facility: string;
  status: DeviceStatus;
  location: string;
  lastSeen?: number;
}

export interface DateRange {
  startDate: string;
  endDate: string;
}

export interface MeterMetadata {
  meterId: string;
  facilityName: string;
  meterName: string;
  deviceStatus: DeviceStatus;
  lastUpdated: string;
  currentDate: string;
}

export interface LiveFlowMetrics {
  liveFlowRate: number;
  todaysConsumption: number;
  averageFlowRate: number;
  connectionStatus: ConnectionStatus;
}

export interface ConsumptionDataPoint {
  label: string;
  litres: number;
  isPeak?: boolean;
}

export interface FlowTrendDataPoint {
  time: string;
  flowRate: number;
}

export interface FlowHistoryRecord {
  id: string;
  time: string;
  duration: string;
  flowRate: number;
  totalLitres: number;
  status: FlowStatus;
}

export interface WaterMeterDataResponse {
  metadata: MeterMetadata;
  metrics: LiveFlowMetrics;
  consumptionTrend: ConsumptionDataPoint[];
  flowTrend: FlowTrendDataPoint[];
  history: FlowHistoryRecord[];
}

export interface SummaryResponse {
  total_volume_litres: number;
  average_flow_rate_lpm: number;
  minimum_flow_rate_lpm: number;
  maximum_flow_rate_lpm: number;

  consumption_chart: ConsumptionDataPoint[];
  flow_trend_chart: FlowTrendDataPoint[];
}

export interface LiveFlowRateApiResponse {
  device_id: string;
  flow_rate_lpm: number;
  device_timestamp: string;
}

export type DeleteDataMode = 'day' | 'date-range' | 'time-range' | 'all';

export interface DeleteFlowMeterDataRequest {
  device_id: string;
  /** Unix epoch seconds, converted from the IST value selected in the UI. */
  start_time: number;
  /** Unix epoch seconds, converted from the IST value selected in the UI. */
  end_time: number;
}

export interface DeleteFlowMeterDataResult {
  success: true;
  deletedCount?: number;
  message?: string;
}
