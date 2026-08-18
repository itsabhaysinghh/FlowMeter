import type { DateRange, DeleteDataMode, DeleteFlowMeterDataRequest, TimeRangeTab } from '../types/meter.types';

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

interface DeleteRangeInput {
  mode: DeleteDataMode;
  date: string;
  startDate: string;
  endDate: string;
  fromTime: string;
  toTime: string;
}

const DATE_INPUT_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_INPUT_PATTERN = /^(\d{2}):(\d{2})$/;

function parseDateInput(value: string): [number, number, number] | null {
  const match = DATE_INPUT_PATTERN.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const verificationDate = new Date(Date.UTC(year, month - 1, day));

  if (
    verificationDate.getUTCFullYear() !== year ||
    verificationDate.getUTCMonth() !== month - 1 ||
    verificationDate.getUTCDate() !== day
  ) {
    return null;
  }

  return [year, month, day];
}

function parseTimeInput(value: string): [number, number] | null {
  const match = TIME_INPUT_PATTERN.exec(value);
  if (!match) return null;

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return hour <= 23 && minute <= 59 ? [hour, minute] : null;
}

/**
 * Converts an IST date/time supplied by a native input into Unix epoch seconds.
 * It deliberately does not use the browser's local timezone, so the API payload
 * remains correct when the dashboard is opened outside India.
 */
export function istDateTimeToEpochSeconds(dateInput: string, timeInput: string, seconds = 0): number | null {
  const date = parseDateInput(dateInput);
  const time = parseTimeInput(timeInput);
  if (!date || !time || seconds < 0 || seconds > 59 || !Number.isInteger(seconds)) return null;

  const [year, month, day] = date;
  const [hour, minute] = time;
  return Math.floor((Date.UTC(year, month - 1, day, hour, minute, seconds) - IST_OFFSET_MS) / 1000);
}

export function getIstDateInputValue(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value;

  return `${part('year')}-${part('month')}-${part('day')}`;
}

export function createIstDeletionRequest(
  deviceId: string,
  input: DeleteRangeInput,
): DeleteFlowMeterDataRequest | null {
  const isTimeRange = input.mode === 'time-range';
  const startDate = input.mode === 'date-range' ? input.startDate : input.date;
  const endDate = input.mode === 'date-range' ? input.endDate : input.date;
  const startTime = isTimeRange ? input.fromTime : '00:00';
  const endTime = isTimeRange ? input.toTime : '23:59';
  const startTimeEpoch = istDateTimeToEpochSeconds(startDate, startTime);
  // Native time fields select to the minute. Including its final second avoids
  // leaving readings behind at the end of a day or requested final minute.
  const endTimeEpoch = istDateTimeToEpochSeconds(endDate, endTime, 59);

  if (!deviceId || startTimeEpoch === null || endTimeEpoch === null || startTimeEpoch > endTimeEpoch) {
    return null;
  }

  return { device_id: deviceId, start_time: startTimeEpoch, end_time: endTimeEpoch };
}

export function formatIstDateInput(dateInput: string): string {
  const date = parseDateInput(dateInput);
  if (!date) return dateInput;

  const [year, month, day] = date;
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'UTC',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

export function formatIstTimeInput(timeInput: string): string {
  const time = parseTimeInput(timeInput);
  if (!time) return timeInput;

  const [hour, minute] = time;
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${String(minute).padStart(2, '0')} ${suffix}`;
}

function addIstDays(dateInput: string, days: number): string {
  const date = parseDateInput(dateInput);
  if (!date) throw new Error('Invalid IST date.');
  const [year, month, day] = date;
  const nextDate = new Date(Date.UTC(year, month - 1, day + days));
  return `${nextDate.getUTCFullYear()}-${String(nextDate.getUTCMonth() + 1).padStart(2, '0')}-${String(nextDate.getUTCDate()).padStart(2, '0')}`;
}

function addIstYears(dateInput: string, years: number): string {
  const date = parseDateInput(dateInput);
  if (!date) throw new Error('Invalid IST date.');
  const [year, month, day] = date;
  const nextDate = new Date(Date.UTC(year + years, month - 1, day));
  return `${nextDate.getUTCFullYear()}-${String(nextDate.getUTCMonth() + 1).padStart(2, '0')}-${String(nextDate.getUTCDate()).padStart(2, '0')}`;
}

/** Produces the API's inclusive Unix-second range for a dashboard period in IST. */
export function getIstPeriodRange(
  period: TimeRangeTab,
  customDateRange?: DateRange,
  specificDate?: string,
  now = new Date(),
): { start: number; end: number; interval: 'hour' | 'day' | 'month' } {
  const today = getIstDateInputValue(now);
  let startDate = today;
  let endDate = today;
  let end = Math.floor(now.getTime() / 1000);
  let interval: 'hour' | 'day' | 'month' = 'hour';

  if (period === 'week') {
    startDate = addIstDays(today, -6);
    interval = 'day';
  } else if (period === 'month') {
    startDate = addIstDays(today, -29);
    interval = 'day';
  } else if (period === 'year') {
    startDate = addIstYears(today, -1);
    interval = 'month';
  } else if (period === 'specific' && specificDate) {
    startDate = specificDate;
    endDate = specificDate;
    end = istDateTimeToEpochSeconds(endDate, '23:59', 59) ?? end;
  } else if (period === 'custom' && customDateRange) {
    startDate = customDateRange.startDate;
    endDate = customDateRange.endDate;
    end = istDateTimeToEpochSeconds(endDate, '23:59', 59) ?? end;
    interval = 'day';
  }

  const start = istDateTimeToEpochSeconds(startDate, '00:00');
  if (start === null || start > end) throw new Error('Invalid IST date range.');
  return { start, end, interval };
}
