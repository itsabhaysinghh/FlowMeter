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
  private inFlightRequests = new Map<string, Promise<any>>();

  /**
   * Safe GET request executor with in-flight deduplication and exponential backoff retry
   * for transient 503/502/504/network throttling errors.
   */
  private async safeGet<T>(url: string, params?: Record<string, any>, timeout = 8000, maxRetries = 2): Promise<T | null> {
    const sortedParams = params
      ? Object.keys(params)
          .sort()
          .filter((k) => params[k] !== undefined && params[k] !== null)
          .map((k) => `${k}=${encodeURIComponent(params[k])}`)
          .join('&')
      : '';
    const requestKey = `${url}?${sortedParams}`;

    // Deduplicate simultaneous identical in-flight requests
    if (this.inFlightRequests.has(requestKey)) {
      return this.inFlightRequests.get(requestKey) as Promise<T | null>;
    }

    const executeRequest = async (): Promise<T | null> => {
      let attempt = 0;
      while (attempt <= maxRetries) {
        try {
          const response = await axios.get(url, { params, timeout });
          return response.data;
        } catch (err: any) {
          attempt++;
          const status = err.response?.status;
          const isTransient =
            status === 503 ||
            status === 502 ||
            status === 504 ||
            status === 429 ||
            !err.response ||
            err.code === 'ECONNABORTED' ||
            err.code === 'ERR_NETWORK';

          if (isTransient && attempt <= maxRetries) {
            const backoffMs = attempt * 250 + Math.floor(Math.random() * 100);
            console.warn(
              `[meterService] Transient error (HTTP ${status || err.code || 'Network'}) on ${url}. Retrying attempt ${attempt}/${maxRetries} in ${backoffMs}ms...`
            );
            await new Promise((res) => setTimeout(res, backoffMs));
            continue;
          }

          console.error(`[meterService] Request failed for ${url}:`, err.message);
          return null;
        }
      }
      return null;
    };

    const promise = executeRequest().finally(() => {
      this.inFlightRequests.delete(requestKey);
    });

    this.inFlightRequests.set(requestKey, promise);
    return promise;
  }

  clearCache() {
    this.devicesCache = null;
    this.cacheTimestamp = 0;
  }

  /**
   * Fetches available device list for facility dropdown selection
   */
  async getAvailableDevices(forceRefresh = false): Promise<DeviceOption[] | null> {
    const now = Date.now();
    if (forceRefresh) {
      this.clearCache();
    } else if (this.devicesCache && (now - this.cacheTimestamp < this.CACHE_TTL)) {
      return this.devicesCache;
    }

    try {
      const data: any = await this.safeGet(`${API_BASE_URL}/v1/devices`, { organization_id: 'ORG_0001' });

      if (!data || !data.success || !Array.isArray(data.devices)) {
        return this.devicesCache || null;
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
      return this.devicesCache || null;
    }
  }

  /**
   * Fetches metadata for the specified water meter device
   */
  async getMeterMetadata(meterId?: string, forceRefresh = false): Promise<MeterMetadata | null> {
    if (!meterId) return null;
    try {
      const devices = await this.getAvailableDevices(forceRefresh);
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
      const data: any = await this.safeGet(
        `${API_BASE_URL}/v1/flow/live`,
        meterId ? { device_id: meterId } : undefined
      );

      const record = data?.data;

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
    specificDate?: string,
    selectedMonth?: string,
    selectedYear?: string,
  ): Promise<SummaryResponse | null> {
    try {
      const { start, end, interval } = getIstPeriodRange(period, customDateRange, specificDate, selectedMonth, selectedYear);

      const data: any = await this.safeGet(
        `${API_BASE_URL}/v1/flow/summary`,
        {
          device_id: meterId,
          start,
          end,
          interval
        }
      );
      return data?.data ?? null;
    } catch (err) {
      console.error(err);
      return null;
    }
  }

  /**
   * Fetches 1-minute interval flow rate trend data points for smooth line visualization.
   * Reuses the deduplicated /v1/flow/summary query to prevent duplicate network roundtrips.
   */
  async getFlowTrend(
    meterId?: string,
    period: TimeRangeTab = 'today',
    customDateRange?: { startDate: string; endDate: string },
    specificDate?: string,
    selectedMonth?: string,
    selectedYear?: string,
  ): Promise<FlowTrendDataPoint[] | null> {
    try {
      const summary = await this.getConsumption(period, meterId, customDateRange, specificDate, selectedMonth, selectedYear);
      return summary?.flow_trend_chart ?? [];
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
    selectedMonth?: string,
    selectedYear?: string,
  ): Promise<FlowHistoryRecord[] | null> {
    try {
      const { start, end } = getIstPeriodRange(period, customDateRange, specificDate, selectedMonth, selectedYear);
      const data: any = await this.safeGet(
        `${API_BASE_URL}/v1/flow/history`,
        {
          ...(meterId ? { device_id: meterId } : {}),
          start_time: start,
          end_time: end,
          limit: params?.limit ?? 100,
        }
      );

      const records = data?.records || [];
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

  private parseDeleteResponse(response: any): DeleteFlowMeterDataResult {
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

    // Try standard DELETE request first
    try {
      const response = await axios.delete(DELETE_FLOW_DATA_API_URL, {
        data: request,
        params: request,
        timeout: 30000,
      });
      return this.parseDeleteResponse(response);
    } catch (deleteError) {
      if (axios.isAxiosError(deleteError)) {
        const backendMsg = deleteError.response?.data?.message || deleteError.response?.data?.error;
        if (backendMsg) throw new Error(backendMsg);

        // If DELETE is blocked by browser CORS preflight (ERR_NETWORK or no response),
        // fallback to POST delete route alias.
        try {
          const postUrl = DELETE_FLOW_DATA_API_URL.endsWith('/data')
            ? `${DELETE_FLOW_DATA_API_URL}/delete`
            : `${DELETE_FLOW_DATA_API_URL}`;
          const postResponse = await axios.post(postUrl, request, { timeout: 30000 });
          return this.parseDeleteResponse(postResponse);
        } catch (postError) {
          if (axios.isAxiosError(postError)) {
            const postMsg = postError.response?.data?.message || postError.response?.data?.error;
            if (postMsg) throw new Error(postMsg);
          }
        }

        if (deleteError.message === 'Network Error' || deleteError.code === 'ERR_NETWORK') {
          throw new Error('Unable to connect to backend server. Please check your network connection.');
        }
        throw new Error(deleteError.message || 'Unable to delete data. Please try again.');
      }
      throw deleteError;
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
