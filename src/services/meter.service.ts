import axios from 'axios';
import type { 
  LiveFlowMetrics, 
  FlowTrendDataPoint, 
  FlowHistoryRecord,
  TimeRangeTab,
  MeterMetadata,
  DeviceOption,
  SummaryResponse,
  DeviceStatus,
  DeleteFlowMeterDataRequest,
  DeleteFlowMeterDataResult,
} from '../types/meter.types';
import { formatLastSeen } from '../utils/formatters';
import { getIstPeriodRange } from '../utils/ist';

// Retrieve base URL from environment variable
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://wbeuxrg5l0.execute-api.ap-south-1.amazonaws.com';
// An override supports a separately deployed delete route; the local backend uses this API base path.
const DELETE_FLOW_DATA_API_URL = import.meta.env.VITE_DELETE_FLOW_DATA_API_URL || `${API_BASE_URL}/v1/flow/data`;

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
    },
    specificDate?: string
  ): Promise<SummaryResponse | null> {
    try {
      const { start, end, interval } = getIstPeriodRange(period, customDateRange, specificDate);

      const response = await axios.get(
        `${API_BASE_URL}/v1/flow/summary`,
        {
          params: {
            device_id: meterId,
            start,
            end,
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
    meterId?: string,
    period: TimeRangeTab = 'today',
    customDateRange?: { startDate: string; endDate: string },
    specificDate?: string,
  ): Promise<FlowTrendDataPoint[] | null> {

    try {
      const { start, end, interval } = getIstPeriodRange(period, customDateRange, specificDate);

      const response = await axios.get(
        `${API_BASE_URL}/v1/flow/summary`,
        {
          params:{
            device_id: meterId,
            start,
            end,
            interval,
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
    params?: { page?: number; limit?: number; search?: string; sortBy?: string },
    meterId?: string,
    period: TimeRangeTab = 'today',
    customDateRange?: { startDate: string; endDate: string },
    specificDate?: string,
  ): Promise<FlowHistoryRecord[] | null> {
    try {
      const { start, end } = getIstPeriodRange(period, customDateRange, specificDate);
      const response = await axios.get(
        `${API_BASE_URL}/v1/flow/history`,
        {
          params: meterId ? { device_id: meterId, start_time: start, end_time: end, limit: params?.limit ?? 100 } : undefined,
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
   * Permanently removes server-side readings for one device and an inclusive
   * Unix-second range. DynamoDB access remains exclusively in the backend.
   */
  async deleteFlowMeterData(
    request: DeleteFlowMeterDataRequest,
  ): Promise<DeleteFlowMeterDataResult> {
    if (!request.device_id || !Number.isFinite(request.start_time) || !Number.isFinite(request.end_time)) {
      throw new Error('A device and valid deletion timestamps are required.');
    }
    if (request.start_time > request.end_time) {
      throw new Error('The deletion start time must be before the end time.');
    }

    try {
      const response = await axios.delete(DELETE_FLOW_DATA_API_URL, {
        data: request,
        params: request,
        timeout: 30000,
      });
      const body = response.data?.data ?? response.data;
      const isConfirmed = body?.success === true || response.data?.success === true;

      if (!isConfirmed) {
        throw new Error(body?.message || response.data?.message || 'The delete API did not confirm the deletion.');
      }

      const rawDeletedCount = body?.deleted_count ?? body?.deletedCount ?? response.data?.deleted_count ?? response.data?.deletedCount;
      const deletedCount = Number(rawDeletedCount);
      return {
        success: true,
        deletedCount: Number.isFinite(deletedCount) ? deletedCount : undefined,
        message: body?.message || response.data?.message,
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const backendMsg = error.response?.data?.message || error.response?.data?.error;
        if (backendMsg) throw new Error(backendMsg);

        if (error.message === 'Network Error' || error.code === 'ERR_NETWORK') {
          throw new Error('Unable to connect to backend server. Please check your network connection.');
        }
        throw new Error(error.message || 'Unable to delete data. Please try again.');
      }
      throw error;
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
