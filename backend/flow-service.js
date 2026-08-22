import { PROTECTED_DEVICE, SIMULATED_DEVICES } from './config.js';
import { bucketStart, epochSeconds, formatIstLabel } from './time.js';
import {
  assertDeletionAllowed,
  assertValidDeviceId,
  HttpError,
  parseLimit,
  parseRange,
  parseReading,
} from './validation.js';

function rollupGranularity(interval) {
  if (interval === 'hour') return 'hour';
  if (interval === 'month') return 'month';
  return 'day';
}

function newAggregate(timestamp) {
  return { timestamp, volume: 0, flowSum: 0, sampleCount: 0, min: Number.POSITIVE_INFINITY, max: Number.NEGATIVE_INFINITY };
}

function addReading(aggregate, reading) {
  const flowRate = Number(reading.flow_rate_lpm) || 0;
  // Readings are emitted every 60 seconds, so L/min equals the litre volume for one record.
  aggregate.volume += flowRate;
  aggregate.flowSum += flowRate;
  aggregate.sampleCount += 1;
  aggregate.min = Math.min(aggregate.min, flowRate);
  aggregate.max = Math.max(aggregate.max, flowRate);
}

function responseFromAggregates(aggregates, granularity) {
  const ordered = [...aggregates.values()].sort((left, right) => left.timestamp - right.timestamp);
  const totalVolume = ordered.reduce((sum, item) => sum + item.volume, 0);
  const flowSum = ordered.reduce((sum, item) => sum + item.flowSum, 0);
  const sampleCount = ordered.reduce((sum, item) => sum + item.sampleCount, 0);
  const averages = ordered.map((item) => item.sampleCount ? item.flowSum / item.sampleCount : 0);

  return {
    total_volume_litres: Number(totalVolume.toFixed(3)),
    average_flow_rate_lpm: sampleCount ? Number((flowSum / sampleCount).toFixed(3)) : 0,
    minimum_flow_rate_lpm: averages.length ? Number(Math.min(...averages).toFixed(3)) : 0,
    maximum_flow_rate_lpm: averages.length ? Number(Math.max(...averages).toFixed(3)) : 0,
    consumption_chart: ordered.map((item) => ({ label: formatIstLabel(item.timestamp, granularity), litres: Number(item.volume.toFixed(3)) })),
    flow_trend_chart: ordered.map((item) => ({ time: formatIstLabel(item.timestamp, granularity), flowRate: item.sampleCount ? Number((item.flowSum / item.sampleCount).toFixed(3)) : 0 })),
  };
}

export class FlowService {
  constructor(repository) {
    this.repository = repository;
  }

  async createReading(payload) {
    const reading = parseReading(payload);
    if (reading.device_id === PROTECTED_DEVICE) {
      throw new HttpError(403, 'FLOSTAT_001 is protected: this simulator ingress refuses production-device writes.');
    }
    return { reading, ...(await this.repository.putReading(reading)) };
  }

  async getReadings(query) {
    const range = parseRange(query);
    const limit = parseLimit(query.limit);
    const page = await this.repository.getReadingsPage({ ...range, limit, nextToken: query.next_token });
    return {
      success: true,
      records: page.records.map((record) => ({
        device_id: record.device_id,
        flow_rate_lpm: record.flow_rate_lpm,
        timestamp: record.timestamp,
        received_at: record.received_at,
      })),
      next_token: page.nextToken,
    };
  }

  async getLive(query) {
    const deviceId = assertValidDeviceId(query.device_id);
    const record = await this.repository.getLatest(deviceId);
    if (!record) throw new HttpError(404, 'No readings found for this device.');
    return {
      success: true,
      data: { device_id: record.device_id, flow_rate_lpm: record.flow_rate_lpm, timestamp: record.timestamp, received_at: record.received_at },
    };
  }

  async getHistory(query) {
    const range = parseRange(query, { defaultStart: epochSeconds() - 24 * 60 * 60, defaultEnd: epochSeconds() });
    const limit = parseLimit(query.limit, 100);
    const page = await this.repository.getReadingsPage({ ...range, limit, nextToken: query.next_token });
    return {
      success: true,
      records: page.records.reverse().map((record) => ({
        device_id: record.device_id,
        timestamp: record.timestamp,
        interval_seconds: 60,
        avg_flow_rate_lpm: record.flow_rate_lpm,
        volume_litres: record.flow_rate_lpm,
      })),
      next_token: page.nextToken,
    };
  }

  async getSummary(query) {
    const range = parseRange(query);
    const granularity = rollupGranularity(query.interval);
    const aggregates = new Map();
    const rollups = await this.repository.getRollups({ ...range, granularity });

    if (rollups) {
      for (const rollup of rollups) {
        let bucketStartVal = rollup.bucket_start;
        if (bucketStartVal === undefined && typeof rollup.flow_meter_id === 'string') {
          const parts = rollup.flow_meter_id.split('#');
          const lastPart = parts[parts.length - 1];
          const parsed = Number(lastPart);
          if (Number.isFinite(parsed)) {
            bucketStartVal = parsed;
          }
        }
        const aggregate = newAggregate(bucketStartVal);
        aggregate.volume = Number(rollup.volume_litres) || 0;
        aggregate.flowSum = Number(rollup.flow_sum_lpm) || 0;
        aggregate.sampleCount = Number(rollup.sample_count) || 0;
        aggregates.set(aggregate.timestamp, aggregate);
      }
    } else {
      await this.repository.forEachReading(range, async (records) => {
        for (const record of records) {
          const timestamp = bucketStart(record.timestamp, granularity);
          const aggregate = aggregates.get(timestamp) || newAggregate(timestamp);
          addReading(aggregate, record);
          aggregates.set(timestamp, aggregate);
        }
      });
    }
    return { success: true, data: responseFromAggregates(aggregates, granularity) };
  }

  async deleteReadings(payload) {
    const range = parseRange(payload);
    assertDeletionAllowed(range.deviceId);
    const deletedCount = await this.repository.deleteRange(range);
    return { success: true, deleted_count: deletedCount, device_id: range.deviceId };
  }

  getDevices() {
    return {
      success: true,
      devices: [
        { device_id: PROTECTED_DEVICE, device_name: PROTECTED_DEVICE, site_name: 'Default Site', building_name: 'Default Building', tank_name: 'Tank 1', status: 'ACTIVE' },
        ...SIMULATED_DEVICES.map((deviceId) => ({
          device_id: deviceId,
          device_name: deviceId,
          site_name: 'Default Site',
          building_name: 'Default Building',
          tank_name: deviceId === 'FLOSTAT_002' ? 'Ground Tank' : deviceId === 'FLOSTAT_003' ? 'Block A Tank' : deviceId === 'FLOSTAT_004' ? 'Block B Tank' : 'Fire Hydrant Tank',
          status: deviceId === 'FLOSTAT_004' ? 'OFFLINE' : 'ACTIVE',
        })),
      ],
    };
  }
}
