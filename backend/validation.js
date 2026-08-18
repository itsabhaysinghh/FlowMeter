import { PROTECTED_DEVICE, SIMULATED_DEVICES } from './config.js';
import { epochSeconds } from './time.js';

const DEVICE_ID_PATTERN = /^[A-Z0-9_]{3,80}$/;

export class HttpError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

export function assertValidDeviceId(deviceId) {
  if (typeof deviceId !== 'string' || !DEVICE_ID_PATTERN.test(deviceId)) {
    throw new HttpError(400, 'device_id is required and must contain only uppercase letters, numbers, or underscores.');
  }
  return deviceId;
}

export function assertSimulatedDevice(deviceId) {
  if (!SIMULATED_DEVICES.includes(deviceId)) {
    throw new HttpError(403, 'Protected or invalid device. Simulation blocked.');
  }
  return deviceId;
}

export function assertDeletionAllowed(deviceId) {
  if (deviceId === PROTECTED_DEVICE) {
    throw new HttpError(403, 'FLOSTAT_001 is protected and cannot be deleted by this development API.');
  }
}

export function parseEpoch(value, fieldName) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 946684800 || parsed > 4102444800) {
    throw new HttpError(400, `${fieldName} must be a Unix epoch timestamp in seconds.`);
  }
  return parsed;
}

export function parseRange(source, { defaultStart, defaultEnd } = {}) {
  const deviceId = assertValidDeviceId(source.device_id);
  const startValue = source.start_time ?? source.start ?? defaultStart;
  const endValue = source.end_time ?? source.end ?? defaultEnd;
  const startTime = parseEpoch(startValue, 'start_time');
  const endTime = parseEpoch(endValue, 'end_time');

  if (startTime > endTime) {
    throw new HttpError(400, 'start_time must be before or equal to end_time.');
  }
  if (endTime - startTime > 5 * 366 * 24 * 60 * 60) {
    throw new HttpError(400, 'Requested range exceeds the five-year maximum.');
  }
  return { deviceId, startTime, endTime };
}

export function parseReading(payload) {
  const deviceId = assertValidDeviceId(payload.device_id);
  const deviceTimestamp = parseEpoch(payload.device_timestamp, 'device_timestamp');
  const receivedAt = payload.received_at === undefined ? epochSeconds() : parseEpoch(payload.received_at, 'received_at');
  const flowRate = Number(payload.flow_rate_lpm);

  if (!Number.isFinite(flowRate) || flowRate < 0 || flowRate > 10000) {
    throw new HttpError(400, 'flow_rate_lpm must be a number between 0 and 10,000.');
  }
  if (deviceTimestamp > receivedAt + 5 * 60) {
    throw new HttpError(400, 'device_timestamp cannot be more than five minutes in the future.');
  }
  return {
    device_id: deviceId,
    flow_rate_lpm: Number(flowRate.toFixed(3)),
    device_timestamp: deviceTimestamp,
    received_at: receivedAt,
  };
}

export function parseLimit(value, fallback = 100) {
  if (value === undefined) return fallback;
  const limit = Number(value);
  if (!Number.isInteger(limit) || limit < 1 || limit > 1000) {
    throw new HttpError(400, 'limit must be an integer between 1 and 1,000.');
  }
  return limit;
}
