import axios from 'axios';
import type { 
  LiveFlowMetrics, 
  FlowTrendDataPoint, 
  FlowHistoryRecord,
  TimeRangeTab,
  MeterMetadata,
  DeviceOption,
  SummaryResponse,
  DeviceStatus
} from '../types/meter.types';
import { formatLastSeen } from '../utils/formatters';

// Retrieve base URL from environment variable
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://zohk43tmnj.execute-api.ap-south-1.amazonaws.com/dev-flow';

export class MeterService {
  private devicesCache: DeviceOption[] | null = null;
  private cacheTimestamp: number = 0;
  private readonly CACHE_TTL = 10000; // 10 seconds cache TTL

  /**
   * Fetches available device list for facility dropdown selection
   */
  async getAvailableDevices(forceRefresh = false): Promise<DeviceOption[] | null> {
    const now = Date.now();
    if (!forceRefresh && this.devicesCache && (now - this.cacheTimestamp < this.CACHE_TTL)) {
      return this.devicesCache;
    }

    try {
      const response = await axios.get(`${API_BASE_URL}/v1/devices`, {
        params: { organization_id: 'ORG_0001' },
        timeout: 5000,
      });

      const data = response.data;
      if (!data || !data.success || !Array.isArray(data.devices)) {
        return null;
      }

      const devices: DeviceOption[] = data.devices.map((device: any) => {
        let mappedStatus: DeviceStatus = 'warning';
        if (device.status === 'ACTIVE') {
          mappedStatus = 'online';
        } else if (device.status === 'OFFLINE') {
          mappedStatus = 'offline';
        }

        return {
          id: device.device_id,
          name: device.device_name,
          facility: device.site_name,
          location: `${device.building_name} • ${device.tank_name}`,
          status: mappedStatus,
          lastSeen: device.last_seen,
        };
      });

      this.devicesCache = devices;
      this.cacheTimestamp = now;
      return devices;
    } catch (error) {
      console.error('Error fetching devices from AWS API:', error);
      return null;
    }
  }

  /**
   * Fetches metadata for the specified water meter device
   */
  async getMeterMetadata(meterId?: string): Promise<MeterMetadata | null> {
    if (!meterId) return null;
    try {
      const devices = await this.getAvailableDevices();
      if (!devices) return null;
      const device = devices.find((d) => d.id === meterId);
      if (!device) return null;

      return {
        meterId: device.id,
        facilityName: device.facility,
        meterName: device.name,
        deviceStatus: device.status,
        lastUpdated: device.lastSeen ? formatLastSeen(device.lastSeen) : 'Just now (1 sec ago)',
        currentDate: new Date().toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        }),
      };
    } catch (error) {
      console.error('Error fetching meter metadata:', error);
      return null;
    }
  }

  /**
   * Fetches real-time live flow metrics using Axios client connecting to AWS API Gateway
   */
  async getLiveFlowRate(
    meterId?: string
  ): Promise<LiveFlowMetrics | null> {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/v1/flow/live`,
        {
          params: meterId ? { device_id: meterId } : undefined,
          timeout: 5000,
        }
      );

      const record = response.data?.data;

      if (!record) {
        return null;
      }

      return {
        liveFlowRate: Number(record.flow_rate_lpm) || 0,
        todaysConsumption: 0,
        averageFlowRate: 0,
        connectionStatus: "Connected",
      };
    } catch (error) {
      console.error(error);
      return null;
    }
  }

  /**
   * Fetches aggregated water consumption data over specified timeframe
   */
  async getConsumption(
    period: TimeRangeTab = "today",
    meterId?: string,
    customDateRange?: {
        startDate: string;
        endDate: string;
    }
  ): Promise<SummaryResponse | null> {
    try {
      let now = new Date(); 
      let startDate = new Date(now);
      let interval = "hour";
      switch (period) {
        case "today":
          startDate = new Date(now);
          startDate.setHours(0, 0, 0, 0);
          interval = "hour";
          break;
        case "week":
          startDate = new Date();
          startDate.setHours(0, 0, 0, 0);
          startDate.setDate(startDate.getDate() - 6);
          interval = "day";
          break;

        case "month":
          startDate = new Date();
          startDate.setHours(0, 0, 0, 0);
          startDate.setMonth(startDate.getMonth() - 1);
          interval = "day";
          break;

        case "year":
          startDate = new Date();
          startDate.setHours(0, 0, 0, 0);
          startDate.setFullYear(startDate.getFullYear() - 1);
          interval = "month";
          break;

        case "custom":
          if (customDateRange) {
              startDate = new Date(customDateRange.startDate);
              startDate.setHours(0, 0, 0, 0);
              now = new Date(customDateRange.endDate);
              now.setHours(23, 59, 59, 999);
              interval = "day";
          }
          break;
      default:
          startDate.setHours(0,0,0,0);
          interval = "hour";
      }

      const response = await axios.get(
        `${API_BASE_URL}/v1/flow/summary`,
        {
          params: {
            device_id: meterId,
            start: Math.floor(startDate.getTime() / 1000),
            end: Math.floor(now.getTime() / 1000),
            interval
          },
          timeout: 5000,
        }
      );
      return response.data?.data?? null;
    } catch (err) {
      console.error(err);
      return null;
    }
  }

  /**
   * Fetches 1-minute interval flow rate trend data points for smooth line visualization
   */
  async getFlowTrend(
    meterId?: string
  ): Promise<FlowTrendDataPoint[] | null> {

    try {

      const now = new Date();

      const start = new Date(now);
      start.setHours(0,0,0,0);

      const response = await axios.get(
        `${API_BASE_URL}/v1/flow/summary`,
        {
          params:{
            device_id: meterId,
            start: Math.floor(start.getTime()/1000),
            end: Math.floor(now.getTime()/1000),
            interval:"hour"
          }
        }
      );

      return response.data.data.flow_trend_chart ?? [];
    } catch(err){
      console.error(err);
      return null;
    }
  }

  /**
   * Fetches historical flow logs table with pagination & sorting parameters
   */
  async getFlowHistory(
    _params?: { page?: number; limit?: number; search?: string; sortBy?: string },
    meterId?: string
  ): Promise<FlowHistoryRecord[] | null> {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/v1/flow/history`,
        {
          params: meterId ? { device_id: meterId } : undefined,
          timeout: 5000,
        }
      );

      const records = response.data?.records || [];
      return records.map((record: any): FlowHistoryRecord => ({
        id: `${record.device_id}-${record.timestamp}`,
        time: new Date(record.timestamp * 1000).toLocaleString(),
        duration: `${record.interval_seconds} sec`,
        flowRate: record.avg_flow_rate_lpm,
        totalLitres: record.volume_litres,
        status: record.avg_flow_rate_lpm > 20
          ? "Peak"
          : record.avg_flow_rate_lpm < 5
          ? "Low Flow"
          : "Normal",
      }));
    } catch (err) {
      console.error(err);
      return null;
    }
  }

  /**
   * Triggers export of flow history data in CSV format
   */
  async exportCSV(_meterId?: string): Promise<boolean | null> {
    return Promise.resolve(null);
  }

  /**
   * Triggers export of flow history & analytics report in PDF format
   */
  async exportPDF(_meterId?: string): Promise<boolean | null> {
    return Promise.resolve(null);
  }
}

export const meterService = new MeterService();
