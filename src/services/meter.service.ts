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
  HistoricalTimeRangeFilter,
  TimeRangeAnalysisSummary,
  DrillDownState,
  DrillDownSummary,
  DrillDownDataPoint,
  ComparisonModeType,
  MeterComparisonMetric,
  ComparisonSideAggregate,
  ComparisonEngineResult,
} from '../types/meter.types';
import { formatLastSeen } from '../utils/formatters';
import { 
  getIstPeriodRange, 
  createHistoricalTimeRangeRequest, 
  formatIstFullDateTime,
  getIstYearRange,
  getIstMonthRange,
  getIstDayRange,
  getIstHourRange,
  formatIstMonthYear,
  formatIstDayLabel,
  formatIstHourLabel,
  formatIstTimeOnly,
  formatIstDateInput,
  getIstDateInputValue,
} from '../utils/ist';

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
          start_time: start,
          end_time: end,
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
   * Fetches unaggregated 1-minute historical flow records and computes statistical metrics
   * for a precise time window in IST from DynamoDB via /v1/flow/history API.
   */
  async getHistoricalTimeRangeData(
    filter: HistoricalTimeRangeFilter
  ): Promise<TimeRangeAnalysisSummary | null> {
    const request = createHistoricalTimeRangeRequest(filter);
    if (!request) {
      throw new Error('Invalid device or time range parameters specified.');
    }

    try {
      const allRecords: any[] = [];
      let nextToken: string | undefined = undefined;
      let pageCount = 0;
      const MAX_PAGES = 10; // Safety guard: up to 10,000 records

      do {
        const queryParams: Record<string, any> = {
          device_id: request.deviceId,
          start_time: request.startTime,
          end_time: request.endTime,
          limit: 1000,
        };
        if (nextToken) {
          queryParams.next_token = nextToken;
        }

        const data: any = await this.safeGet(
          `${API_BASE_URL}/v1/flow/history`,
          queryParams
        );

        if (!data || !data.records) {
          break;
        }

        allRecords.push(...data.records);
        nextToken = data.next_token;
        pageCount++;
      } while (nextToken && pageCount < MAX_PAGES);

      // Sort strictly in chronological order (ascending timestamp)
      const sorted = [...allRecords]
        .filter((r) => {
          const ts = Number(r.timestamp);
          return Number.isFinite(ts) && ts >= request.startTime && ts <= request.endTime;
        })
        .sort((a, b) => Number(a.timestamp) - Number(b.timestamp));

      const count = sorted.length;

      if (count === 0) {
        return {
          deviceId: request.deviceId,
          startEpoch: request.startTime,
          endEpoch: request.endTime,
          startFormatted: formatIstFullDateTime(request.startTime),
          endFormatted: formatIstFullDateTime(request.endTime),
          readingsCount: 0,
          totalConsumptionLitres: 0,
          averageFlowRateLpm: 0,
          minimumFlowRateLpm: 0,
          maximumFlowRateLpm: 0,
          firstReading: null,
          lastReading: null,
          readings: [],
          flowTrend: [],
        };
      }

      // Compute volume for each reading using authentic volume or actual interval delta
      const calculatedReadings: Array<{
        record: any;
        flowRate: number;
        volumeLitres: number;
        intervalSeconds: number;
      }> = [];

      for (let i = 0; i < sorted.length; i++) {
        const rec = sorted[i];
        const flowRate = Number(rec.avg_flow_rate_lpm ?? rec.flow_rate_lpm ?? 0);
        const currentTs = Number(rec.timestamp);

        let intervalSec: number;
        if (rec.interval_seconds !== undefined && Number.isFinite(Number(rec.interval_seconds)) && Number(rec.interval_seconds) > 0) {
          intervalSec = Number(rec.interval_seconds);
        } else if (i > 0) {
          const prevTs = Number(sorted[i - 1].timestamp);
          intervalSec = Math.max(1, currentTs - prevTs);
        } else {
          intervalSec = 60; // Default nominal sample duration for isolated initial point
        }

        let volumeLitres: number;
        if (rec.volume_litres !== undefined && Number.isFinite(Number(rec.volume_litres))) {
          volumeLitres = Number(rec.volume_litres);
        } else if (rec.volume !== undefined && Number.isFinite(Number(rec.volume))) {
          volumeLitres = Number(rec.volume);
        } else {
          // Volume = Flow Rate (L/min) * (Interval in seconds / 60)
          volumeLitres = flowRate * (intervalSec / 60);
        }

        calculatedReadings.push({
          record: rec,
          flowRate,
          volumeLitres,
          intervalSeconds: intervalSec,
        });
      }

      const totalVolume = calculatedReadings.reduce((sum, item) => sum + item.volumeLitres, 0);
      const flowRates = calculatedReadings.map((item) => item.flowRate);
      const totalConsumptionLitres = Number(totalVolume.toFixed(2));
      const averageFlowRateLpm = Number((flowRates.reduce((a, b) => a + b, 0) / count).toFixed(2));
      const minimumFlowRateLpm = Number(Math.min(...flowRates).toFixed(2));
      const maximumFlowRateLpm = Number(Math.max(...flowRates).toFixed(2));

      const firstRecord = sorted[0];
      const lastRecord = sorted[sorted.length - 1];

      const firstReading = {
        timestamp: Number(firstRecord.timestamp),
        flowRate: Number((firstRecord.avg_flow_rate_lpm ?? firstRecord.flow_rate_lpm ?? 0).toFixed(2)),
        timeFormatted: formatIstFullDateTime(Number(firstRecord.timestamp)),
      };

      const lastReading = {
        timestamp: Number(lastRecord.timestamp),
        flowRate: Number((lastRecord.avg_flow_rate_lpm ?? lastRecord.flow_rate_lpm ?? 0).toFixed(2)),
        timeFormatted: formatIstFullDateTime(Number(lastRecord.timestamp)),
      };

      // Unaggregated trend curve showing true device timestamps without synthetic interpolation
      const flowTrend: FlowTrendDataPoint[] = calculatedReadings.map((item) => ({
        time: formatIstFullDateTime(Number(item.record.timestamp), true),
        flowRate: Number(item.flowRate.toFixed(2)),
      }));

      // Detailed reading list (reversed for latest-first in table)
      const readings: FlowHistoryRecord[] = [...calculatedReadings].reverse().map((item) => {
        const rate = item.flowRate;
        return {
          id: `${item.record.device_id}-${item.record.timestamp}`,
          time: formatIstFullDateTime(Number(item.record.timestamp)),
          duration: `${Math.round(item.intervalSeconds)} sec`,
          flowRate: Number(rate.toFixed(2)),
          totalLitres: Number(item.volumeLitres.toFixed(2)),
          status: rate > 20 ? 'Peak' : rate < 5 ? 'Low Flow' : 'Normal',
        };
      });

      return {
        deviceId: request.deviceId,
        startEpoch: request.startTime,
        endEpoch: request.endTime,
        startFormatted: formatIstFullDateTime(request.startTime),
        endFormatted: formatIstFullDateTime(request.endTime),
        readingsCount: count,
        totalConsumptionLitres,
        averageFlowRateLpm,
        minimumFlowRateLpm,
        maximumFlowRateLpm,
        firstReading,
        lastReading,
        readings,
        flowTrend,
      };
    } catch (err) {
      console.error('[meterService] Failed to load historical time range data:', err);
      throw err;
    }
  }

  /**
   * Exports time-range flow readings as a downloadable CSV file.
   */
  exportTimeRangeCSV(records: FlowHistoryRecord[], deviceId: string, startDate: string, endDate: string): boolean {
    if (!records || records.length === 0) return false;
    const headers = ['Timestamp (IST)', 'Device ID', 'Flow Rate (L/min)', 'Interval Volume (Litres)', 'Interval', 'Status', 'Record ID'];
    const rows = records.map((r) => [
      `"${r.time}"`,
      `"${deviceId}"`,
      r.flowRate.toFixed(2),
      r.totalLitres.toFixed(2),
      `"${r.duration}"`,
      `"${r.status}"`,
      `"${r.id}"`,
    ]);
    const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `flowmeter_${deviceId}_${startDate}_to_${endDate}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    return true;
  }

  /**
   * Generates a printable report for the analyzed time range.
   * Renders full detailed logs when sample count is reasonably small (<= 50),
   * and an executive summary table with sample overview when dataset is large.
   */
  exportTimeRangePDF(summary: TimeRangeAnalysisSummary): boolean {
    if (!summary) return false;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return false;

    const isLarge = summary.readingsCount > 50;
    const displayReadings = isLarge ? summary.readings.slice(0, 50) : summary.readings;

    const rowsHtml = displayReadings.map((r) => `
      <tr>
        <td style="padding: 6px 12px; border-bottom: 1px solid #e2e8f0;">${r.time}</td>
        <td style="padding: 6px 12px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: bold;">${r.flowRate.toFixed(2)}</td>
        <td style="padding: 6px 12px; border-bottom: 1px solid #e2e8f0; text-align: right;">${r.totalLitres.toFixed(2)}</td>
        <td style="padding: 6px 12px; border-bottom: 1px solid #e2e8f0; text-align: center;">${r.duration}</td>
        <td style="padding: 6px 12px; border-bottom: 1px solid #e2e8f0; text-align: center;">${r.status}</td>
      </tr>
    `).join('');

    const largeDataNotice = isLarge ? `
      <div style="margin-top: 12px; padding: 10px 14px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; font-size: 11px; color: #166534;">
        <strong>Summary View Notice:</strong> Showing the first 50 of ${summary.readingsCount} total records for print efficiency. The complete raw unaggregated telemetry dataset is available via CSV Export.
      </div>
    ` : '';

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Flow Analysis Report - ${summary.deviceId}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #1e293b; padding: 24px; margin: 0; }
            .header { border-bottom: 2px solid #2563eb; padding-bottom: 12px; margin-bottom: 20px; }
            .title { font-size: 20px; font-weight: bold; color: #0f172a; margin: 0; }
            .subtitle { font-size: 12px; color: #64748b; margin-top: 4px; }
            .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px; }
            .kpi-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; }
            .kpi-label { font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: bold; }
            .kpi-value { font-size: 18px; font-weight: bold; color: #0f172a; margin-top: 4px; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 16px; }
            th { background: #f1f5f9; padding: 8px 12px; text-align: left; font-weight: bold; color: #475569; border-bottom: 2px solid #cbd5e1; }
            @media print {
              body { padding: 0; }
              @page { margin: 1.5cm; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1 class="title">FLOSTAT Water Meter Analysis Report</h1>
            <div class="subtitle">Device: <strong>${summary.deviceId}</strong> | Window (IST): <strong>${summary.startFormatted}</strong> &mdash; <strong>${summary.endFormatted}</strong></div>
          </div>
          <div class="kpi-grid">
            <div class="kpi-card">
              <div class="kpi-label">Total Volume</div>
              <div class="kpi-value">${summary.totalConsumptionLitres.toLocaleString()} L</div>
            </div>
            <div class="kpi-card">
              <div class="kpi-label">Avg Flow Rate</div>
              <div class="kpi-value">${summary.averageFlowRateLpm} L/min</div>
            </div>
            <div class="kpi-card">
              <div class="kpi-label">Peak Flow Rate</div>
              <div class="kpi-value">${summary.maximumFlowRateLpm} L/min</div>
            </div>
            <div class="kpi-card">
              <div class="kpi-label">Readings Count</div>
              <div class="kpi-value">${summary.readingsCount}</div>
            </div>
          </div>
          <h3 style="font-size: 14px; margin-bottom: 8px;">Detailed Reading Log (${isLarge ? `50 of ${summary.readingsCount}` : summary.readingsCount} samples)</h3>
          <table>
            <thead>
              <tr>
                <th>Timestamp (IST)</th>
                <th style="text-align: right;">Flow Rate (L/min)</th>
                <th style="text-align: right;">Volume (Litres)</th>
                <th style="text-align: center;">Interval</th>
                <th style="text-align: center;">Status</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
          ${largeDataNotice}
        </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 250);
    return true;
  }

  /**
   * Fetches hierarchical historical drill-down data according to the active level:
   * YEAR: /v1/flow/summary?interval=month
   * MONTH: /v1/flow/summary?interval=day
   * DAY: /v1/flow/summary?interval=hour
   * HOUR: /v1/flow/history
   */
  async getDrillDownData(
    deviceId: string,
    state: DrillDownState
  ): Promise<DrillDownSummary | null> {
    if (!deviceId) return null;

    try {
      if (state.level === 'year') {
        const { start, end, interval } = getIstYearRange(state.year);
        const data: any = await this.safeGet(`${API_BASE_URL}/v1/flow/summary`, {
          device_id: deviceId,
          start_time: start,
          end_time: end,
          start,
          end,
          interval,
        });

        const summary: SummaryResponse | null = data?.data ?? null;
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const chartPoints = summary?.consumption_chart ?? [];

        const dataPoints: DrillDownDataPoint[] = monthNames.map((name, idx) => {
          const monthNum = idx + 1;
          const monthId = String(monthNum).padStart(2, '0');
          // Match against backend labels (e.g. "Jan 2026", "Jan", "2026-01")
          const match = chartPoints.find((p) => {
            const lbl = (p.label || '').toLowerCase();
            return lbl.includes(name.toLowerCase()) || lbl.includes(`${state.year}-${monthId}`);
          });

          return {
            id: monthId,
            label: name,
            value: match ? match.litres : 0,
            litres: match ? match.litres : 0,
            isPeak: match?.isPeak ?? false,
            subLabel: `${name} ${state.year}`,
          };
        });

        const totalVol = summary?.total_volume_litres ?? dataPoints.reduce((sum, p) => sum + p.value, 0);
        const avgFlow = summary?.average_flow_rate_lpm ?? 0;
        const minFlow = summary?.minimum_flow_rate_lpm ?? 0;
        const maxFlow = summary?.maximum_flow_rate_lpm ?? 0;

        return {
          level: 'year',
          deviceId,
          title: `Year ${state.year} Overview`,
          subtitle: `12 Calendar Months Aggregated Flow & Consumption Analysis`,
          timeframeLabel: `${state.year}`,
          startEpoch: start,
          endEpoch: end,
          totalVolumeLitres: Number(totalVol.toFixed(2)),
          averageFlowRateLpm: Number(avgFlow.toFixed(2)),
          minimumFlowRateLpm: Number(minFlow.toFixed(2)),
          maximumFlowRateLpm: Number(maxFlow.toFixed(2)),
          readingCount: 12,
          dataPoints,
        };
      }

      if (state.level === 'month') {
        const { start, end, interval, lastDay } = getIstMonthRange(state.year, state.month);
        const data: any = await this.safeGet(`${API_BASE_URL}/v1/flow/summary`, {
          device_id: deviceId,
          start_time: start,
          end_time: end,
          start,
          end,
          interval,
        });

        const summary: SummaryResponse | null = data?.data ?? null;
        const monthStr = String(state.month).padStart(2, '0');
        const monthFullTitle = formatIstMonthYear(`${state.year}-${monthStr}`, true);
        const monthShort = formatIstMonthYear(`${state.year}-${monthStr}`, false).split(' ')[0];
        const chartPoints = summary?.consumption_chart ?? [];

        const dataPoints: DrillDownDataPoint[] = [];
        for (let day = 1; day <= lastDay; day++) {
          const dayStr = String(day).padStart(2, '0');
          const fullDateStr = `${state.year}-${monthStr}-${dayStr}`;
          const targetDayLabel = `${monthShort} ${dayStr}`;

          const match = chartPoints.find((p) => {
            const lbl = p.label || '';
            return lbl === fullDateStr || lbl.toLowerCase().includes(targetDayLabel.toLowerCase()) || lbl.endsWith(`-${dayStr}`);
          });

          dataPoints.push({
            id: fullDateStr,
            label: `${day}`,
            value: match ? match.litres : 0,
            litres: match ? match.litres : 0,
            isPeak: match?.isPeak ?? false,
            subLabel: `${day} ${monthShort}`,
          });
        }

        const totalVol = summary?.total_volume_litres ?? dataPoints.reduce((sum, p) => sum + p.value, 0);
        const avgFlow = summary?.average_flow_rate_lpm ?? 0;
        const minFlow = summary?.minimum_flow_rate_lpm ?? 0;
        const maxFlow = summary?.maximum_flow_rate_lpm ?? 0;

        return {
          level: 'month',
          deviceId,
          title: `${monthFullTitle} Overview`,
          subtitle: `Daily Consumption Breakdown across ${lastDay} calendar days`,
          timeframeLabel: `${monthFullTitle}`,
          startEpoch: start,
          endEpoch: end,
          totalVolumeLitres: Number(totalVol.toFixed(2)),
          averageFlowRateLpm: Number(avgFlow.toFixed(2)),
          minimumFlowRateLpm: Number(minFlow.toFixed(2)),
          maximumFlowRateLpm: Number(maxFlow.toFixed(2)),
          readingCount: lastDay,
          dataPoints,
        };
      }

      if (state.level === 'day') {
        const { start, end, interval } = getIstDayRange(state.date);
        const data: any = await this.safeGet(`${API_BASE_URL}/v1/flow/summary`, {
          device_id: deviceId,
          start_time: start,
          end_time: end,
          start,
          end,
          interval,
        });

        const summary: SummaryResponse | null = data?.data ?? null;
        const dayTitle = formatIstDayLabel(state.date, true);
        const chartPoints = summary?.consumption_chart ?? [];

        const dataPoints: DrillDownDataPoint[] = [];
        for (let hour = 0; hour < 24; hour++) {
          const hourLabel = formatIstHourLabel(hour, true);
          const fullHourLabel = formatIstHourLabel(hour, false);

          const match = chartPoints.find((p) => {
            const lbl = (p.label || '').toUpperCase();
            const h12 = hour % 12 || 12;
            const ampm = hour >= 12 ? 'PM' : 'AM';
            const pattern = `${String(h12).padStart(2, '0')}:00 ${ampm}`;
            const patternShort = `${h12} ${ampm}`;
            return lbl.includes(pattern) || lbl.includes(patternShort) || lbl.includes(hourLabel.toUpperCase());
          });

          dataPoints.push({
            id: String(hour),
            label: hourLabel,
            value: match ? match.litres : 0,
            litres: match ? match.litres : 0,
            isPeak: match?.isPeak ?? false,
            subLabel: fullHourLabel,
          });
        }

        const totalVol = summary?.total_volume_litres ?? dataPoints.reduce((sum, p) => sum + p.value, 0);
        const avgFlow = summary?.average_flow_rate_lpm ?? 0;
        const minFlow = summary?.minimum_flow_rate_lpm ?? 0;
        const maxFlow = summary?.maximum_flow_rate_lpm ?? 0;

        return {
          level: 'day',
          deviceId,
          title: `${dayTitle} Hourly Breakdown`,
          subtitle: `24-Hour Continuous Hourly Consumption & Flow Rate Summary`,
          timeframeLabel: `${formatIstDayLabel(state.date)}`,
          startEpoch: start,
          endEpoch: end,
          totalVolumeLitres: Number(totalVol.toFixed(2)),
          averageFlowRateLpm: Number(avgFlow.toFixed(2)),
          minimumFlowRateLpm: Number(minFlow.toFixed(2)),
          maximumFlowRateLpm: Number(maxFlow.toFixed(2)),
          readingCount: 24,
          dataPoints,
        };
      }

      if (state.level === 'hour') {
        const { start, end } = getIstHourRange(state.date, state.hour);
        const data: any = await this.safeGet(`${API_BASE_URL}/v1/flow/history`, {
          device_id: deviceId,
          start_time: start,
          end_time: end,
          limit: 1000,
        });

        const rawList: any[] = data?.records || [];
        // Filter strictly within requested hour and sort chronologically
        const sorted = [...rawList]
          .filter((r) => {
            const ts = Number(r.timestamp);
            return Number.isFinite(ts) && ts >= start && ts <= end;
          })
          .sort((a, b) => Number(a.timestamp) - Number(b.timestamp));

        const rawRecords: FlowHistoryRecord[] = [];
        const dataPoints: DrillDownDataPoint[] = [];

        for (let i = 0; i < sorted.length; i++) {
          const rec = sorted[i];
          const currentTs = Number(rec.timestamp);
          const rate = Number(rec.avg_flow_rate_lpm ?? rec.flow_rate_lpm ?? 0);

          let intervalSec = 60;
          if (rec.interval_seconds && Number.isFinite(Number(rec.interval_seconds))) {
            intervalSec = Number(rec.interval_seconds);
          } else if (i > 0) {
            intervalSec = Math.max(1, currentTs - Number(sorted[i - 1].timestamp));
          }

          let volume = rate * (intervalSec / 60);
          if (rec.volume_litres !== undefined && Number.isFinite(Number(rec.volume_litres))) {
            volume = Number(rec.volume_litres);
          }

          const timeFormatted = formatIstFullDateTime(currentTs);
          const timeOnly = formatIstTimeOnly(currentTs, true);

          const status = rate > 20 ? 'Peak' : rate < 5 ? 'Low Flow' : 'Normal';

          const historyItem: FlowHistoryRecord = {
            id: `${rec.device_id || deviceId}-${currentTs}`,
            time: timeFormatted,
            duration: `${Math.round(intervalSec)} sec`,
            flowRate: Number(rate.toFixed(2)),
            totalLitres: Number(volume.toFixed(2)),
            status,
          };

          rawRecords.push(historyItem);

          dataPoints.push({
            id: String(currentTs),
            label: timeOnly,
            value: Number(rate.toFixed(2)),
            flowRate: Number(rate.toFixed(2)),
            litres: Number(volume.toFixed(2)),
            isPeak: status === 'Peak',
            subLabel: timeFormatted,
            timestamp: currentTs,
            rawRecord: historyItem,
          });
        }

        const totalVol = dataPoints.reduce((sum, p) => sum + (p.litres ?? 0), 0);
        const flowRates = dataPoints.map((p) => p.flowRate ?? 0);
        const count = dataPoints.length;
        const avgFlow = count > 0 ? flowRates.reduce((a, b) => a + b, 0) / count : 0;
        const minFlow = count > 0 ? Math.min(...flowRates) : 0;
        const maxFlow = count > 0 ? Math.max(...flowRates) : 0;

        const dayFormatted = formatIstDayLabel(state.date);
        const hourFormatted = formatIstHourLabel(state.hour);

        return {
          level: 'hour',
          deviceId,
          title: `${dayFormatted} • ${hourFormatted}`,
          subtitle: `Authentic Minute-Level Telemetry Log (${count} readings recorded)`,
          timeframeLabel: `${dayFormatted} ${hourFormatted}`,
          startEpoch: start,
          endEpoch: end,
          totalVolumeLitres: Number(totalVol.toFixed(2)),
          averageFlowRateLpm: Number(avgFlow.toFixed(2)),
          minimumFlowRateLpm: Number(minFlow.toFixed(2)),
          maximumFlowRateLpm: Number(maxFlow.toFixed(2)),
          readingCount: count,
          dataPoints,
          rawRecords,
        };
      }

      return null;
    } catch (err) {
      console.error('[meterService] Error in getDrillDownData:', err);
      throw err;
    }
  }

  /**
   * Exports minute-level historical records as a CSV file.
   */
  exportDrillDownCSV(records: FlowHistoryRecord[], deviceId: string, timeframeLabel: string): boolean {
    if (!records || records.length === 0) return false;
    const cleanLabel = timeframeLabel.replace(/[^a-zA-Z0-9_-]/g, '_');
    const headers = ['Timestamp (IST)', 'Device ID', 'Flow Rate (L/min)', 'Volume (Litres)', 'Interval', 'Status', 'Record ID'];
    const rows = records.map((r) => [
      `"${r.time}"`,
      `"${deviceId}"`,
      r.flowRate.toFixed(2),
      r.totalLitres.toFixed(2),
      `"${r.duration}"`,
      `"${r.status}"`,
      `"${r.id}"`,
    ]);
    const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `flowmeter_${deviceId}_drilldown_${cleanLabel}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    return true;
  }

  /**
   * Performs aggregated comparison analysis between two sides (individual devices, multiple devices, or device blocks)
   * over an identical operator-selected timeframe.
   */
  async getComparisonData(params: {
    mode: ComparisonModeType;
    sideALabel: string;
    deviceIdsA: string[];
    sideBLabel: string;
    deviceIdsB: string[];
    period: TimeRangeTab;
    customDateRange?: { startDate: string; endDate: string };
    specificDate?: string;
    selectedMonth?: string;
    selectedYear?: string;
    allDevices?: DeviceOption[];
  }): Promise<ComparisonEngineResult | null> {
    const {
      mode,
      sideALabel,
      deviceIdsA,
      sideBLabel,
      deviceIdsB,
      period,
      customDateRange,
      specificDate,
      selectedMonth,
      selectedYear,
      allDevices = [],
    } = params;

    const uniqueDeviceIds = Array.from(new Set([...deviceIdsA, ...deviceIdsB])).filter(Boolean);
    if (uniqueDeviceIds.length === 0) {
      return null;
    }

    // Determine timeframe label
    let timeframeLabel = '';
    if (period === 'today') {
      timeframeLabel = `Today (${formatIstDateInput(getIstDateInputValue())})`;
    } else if (period === 'specific' && specificDate) {
      timeframeLabel = `Date: ${formatIstDateInput(specificDate)}`;
    } else if (period === 'week') {
      timeframeLabel = 'Past 7 Days';
    } else if (period === 'month') {
      timeframeLabel = formatIstMonthYear(selectedMonth || getIstDateInputValue().slice(0, 7), true);
    } else if (period === 'year') {
      timeframeLabel = `Year ${selectedYear || getIstDateInputValue().slice(0, 4)}`;
    } else if (period === 'custom' && customDateRange) {
      timeframeLabel = `${formatIstDateInput(customDateRange.startDate)} – ${formatIstDateInput(customDateRange.endDate)}`;
    } else {
      timeframeLabel = period;
    }

    // Fetch summaries concurrently for each unique device
    const summariesMap = new Map<string, SummaryResponse | null>();
    await Promise.all(
      uniqueDeviceIds.map(async (devId) => {
        try {
          const res = await this.getConsumption(
            period,
            devId,
            customDateRange,
            specificDate,
            selectedMonth,
            selectedYear
          );
          summariesMap.set(devId, res);
        } catch (e) {
          console.error(`[getComparisonData] Error fetching for ${devId}:`, e);
          summariesMap.set(devId, null);
        }
      })
    );

    // Build metric object for each device
    const buildMeterMetric = (devId: string): MeterComparisonMetric => {
      const devObj = allDevices.find((d) => d.id === devId);
      const summary = summariesMap.get(devId);
      return {
        deviceId: devId,
        deviceName: devObj?.name || devId,
        facility: devObj?.facility || 'Main Facility',
        location: devObj?.location || 'General',
        status: devObj?.status || 'online',
        totalVolumeLitres: summary?.total_volume_litres || 0,
        averageFlowRateLpm: summary?.average_flow_rate_lpm || 0,
        minimumFlowRateLpm: summary?.minimum_flow_rate_lpm || 0,
        maximumFlowRateLpm: summary?.maximum_flow_rate_lpm || 0,
        consumptionChart: summary?.consumption_chart || [],
        flowTrendChart: summary?.flow_trend_chart || [],
      };
    };

    const sideAMetrics = deviceIdsA.map(buildMeterMetric);
    const sideBMetrics = deviceIdsB.map(buildMeterMetric);

    // Aggregate side metrics
    const aggregateSide = (
      label: string,
      deviceIds: string[],
      metrics: MeterComparisonMetric[]
    ): ComparisonSideAggregate => {
      const totalVolumeLitres = metrics.reduce((sum, m) => sum + m.totalVolumeLitres, 0);
      const averageFlowRateLpm = metrics.reduce((sum, m) => sum + m.averageFlowRateLpm, 0);
      const maximumFlowRateLpm = metrics.length > 0 ? Math.max(...metrics.map((m) => m.maximumFlowRateLpm)) : 0;
      const minimumFlowRateLpm = metrics.length > 0 ? Math.min(...metrics.map((m) => m.minimumFlowRateLpm)) : 0;

      // Group interval consumption by label
      const intervalMap = new Map<string, { litres: number; count: number }>();
      metrics.forEach((m) => {
        m.consumptionChart.forEach((pt) => {
          const existing = intervalMap.get(pt.label) || { litres: 0, count: 0 };
          existing.litres += pt.litres || 0;
          existing.count += 1;
          intervalMap.set(pt.label, existing);
        });
      });

      const intervalDataPoints = Array.from(intervalMap.entries()).map(([intervalLabel, val]) => ({
        label: intervalLabel,
        litres: Math.round(val.litres * 100) / 100,
      }));

      return {
        label,
        deviceIds,
        totalVolumeLitres: Math.round(totalVolumeLitres * 100) / 100,
        averageFlowRateLpm: Math.round(averageFlowRateLpm * 100) / 100,
        minimumFlowRateLpm: Math.round(minimumFlowRateLpm * 100) / 100,
        maximumFlowRateLpm: Math.round(maximumFlowRateLpm * 100) / 100,
        meterMetrics: metrics,
        intervalDataPoints,
      };
    };

    const sideA = aggregateSide(sideALabel, deviceIdsA, sideAMetrics);
    const sideB = aggregateSide(sideBLabel, deviceIdsB, sideBMetrics);

    // Build unified, aligned interval chart dataset
    // Collect unique interval labels preserving chronological order
    const allLabels: string[] = [];
    const seenLabels = new Set<string>();

    sideA.intervalDataPoints.forEach((pt) => {
      if (!seenLabels.has(pt.label)) {
        seenLabels.add(pt.label);
        allLabels.push(pt.label);
      }
    });
    sideB.intervalDataPoints.forEach((pt) => {
      if (!seenLabels.has(pt.label)) {
        seenLabels.add(pt.label);
        allLabels.push(pt.label);
      }
    });

    const sideAMap = new Map(sideA.intervalDataPoints.map((p) => [p.label, p.litres]));
    const sideBMap = new Map(sideB.intervalDataPoints.map((p) => [p.label, p.litres]));

    const combinedChartData = allLabels.map((label) => {
      const aLitres = sideAMap.get(label) || 0;
      const bLitres = sideBMap.get(label) || 0;
      return {
        label,
        sideALitres: Math.round(aLitres * 100) / 100,
        sideBLitres: Math.round(bLitres * 100) / 100,
      };
    });

    // Delta & Percent calculations
    const deltaVolumeLitres = Math.round((sideA.totalVolumeLitres - sideB.totalVolumeLitres) * 100) / 100;
    let deltaVolumePercent = 0;
    if (sideB.totalVolumeLitres > 0) {
      deltaVolumePercent = ((sideA.totalVolumeLitres - sideB.totalVolumeLitres) / sideB.totalVolumeLitres) * 100;
    } else if (sideA.totalVolumeLitres > 0) {
      deltaVolumePercent = 100;
    }
    deltaVolumePercent = Math.round(deltaVolumePercent * 10) / 10;

    const deltaAvgFlowLpm = Math.round((sideA.averageFlowRateLpm - sideB.averageFlowRateLpm) * 100) / 100;

    return {
      mode,
      timeframe: period,
      timeframeLabel,
      sideA,
      sideB,
      deltaVolumeLitres,
      deltaVolumePercent,
      deltaAvgFlowLpm,
      combinedChartData,
    };
  }

  /**
   * Generates and downloads a CSV report of the comparison result.
   */
  exportComparisonCSV(result: ComparisonEngineResult): boolean {
    if (!result) return false;
    const { sideA, sideB, deltaVolumeLitres, deltaVolumePercent, timeframeLabel, mode, combinedChartData } = result;

    const lines: string[] = [];
    lines.push('FLOSTAT FlowMeter Enterprise Comparison Report');
    lines.push(`Exported At (IST),"${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}"`);
    lines.push(`Comparison Mode,"${mode}"`);
    lines.push(`Selected Timeframe,"${timeframeLabel}"`);
    lines.push('');

    // Summary Section
    lines.push('SUMMARY COMPARISON');
    lines.push('Metric,Side A,Side B,Variance (Delta),Percentage Difference');
    lines.push(`Group/Entity Name,"${sideA.label}","${sideB.label}",-,`);
    lines.push(`Total Volume (Litres),${sideA.totalVolumeLitres},${sideB.totalVolumeLitres},${deltaVolumeLitres >= 0 ? '+' : ''}${deltaVolumeLitres},${deltaVolumePercent >= 0 ? '+' : ''}${deltaVolumePercent}%`);
    lines.push(`Average Flow Rate (L/min),${sideA.averageFlowRateLpm},${sideB.averageFlowRateLpm},${result.deltaAvgFlowLpm >= 0 ? '+' : ''}${result.deltaAvgFlowLpm},-`);
    lines.push(`Peak Flow Rate (L/min),${sideA.maximumFlowRateLpm},${sideB.maximumFlowRateLpm},-,`);
    lines.push(`Device Count,${sideA.deviceIds.length},${sideB.deviceIds.length},-,`);
    lines.push('');

    // Interval Breakdown Section
    lines.push('INTERVAL CONSUMPTION BREAKDOWN');
    lines.push(`Interval,"${sideA.label} Volume (L)","${sideB.label} Volume (L)","Interval Variance (L)"`);
    combinedChartData.forEach((row) => {
      const intervalDelta = Math.round((row.sideALitres - row.sideBLitres) * 100) / 100;
      lines.push(`"${row.label}",${row.sideALitres},${row.sideBLitres},${intervalDelta >= 0 ? '+' : ''}${intervalDelta}`);
    });
    lines.push('');

    // Side A Meters Breakdown
    lines.push(`SIDE A METERS BREAKDOWN (${sideA.label})`);
    lines.push('Device ID,Device Name,Facility,Location,Status,Total Volume (L),Avg Flow (L/min),Peak Flow (L/min),Group Contribution %');
    sideA.meterMetrics.forEach((m) => {
      const contrib = sideA.totalVolumeLitres > 0 ? ((m.totalVolumeLitres / sideA.totalVolumeLitres) * 100).toFixed(1) : '0.0';
      lines.push(`"${m.deviceId}","${m.deviceName}","${m.facility}","${m.location}","${m.status}",${m.totalVolumeLitres},${m.averageFlowRateLpm},${m.maximumFlowRateLpm},${contrib}%`);
    });
    lines.push('');

    // Side B Meters Breakdown
    lines.push(`SIDE B METERS BREAKDOWN (${sideB.label})`);
    lines.push('Device ID,Device Name,Facility,Location,Status,Total Volume (L),Avg Flow (L/min),Peak Flow (L/min),Group Contribution %');
    sideB.meterMetrics.forEach((m) => {
      const contrib = sideB.totalVolumeLitres > 0 ? ((m.totalVolumeLitres / sideB.totalVolumeLitres) * 100).toFixed(1) : '0.0';
      lines.push(`"${m.deviceId}","${m.deviceName}","${m.facility}","${m.location}","${m.status}",${m.totalVolumeLitres},${m.averageFlowRateLpm},${m.maximumFlowRateLpm},${contrib}%`);
    });

    const csvContent = lines.join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const cleanLabel = timeframeLabel.replace(/[^a-zA-Z0-9_-]/g, '_');
    link.download = `flostat_comparison_${cleanLabel}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    return true;
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

