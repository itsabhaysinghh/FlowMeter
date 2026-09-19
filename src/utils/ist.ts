import type { DateRange, DeleteDataMode, DeleteFlowMeterDataRequest, HistoricalTimeRangeFilter, TimeRangeTab } from '../types/meter.types';

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

function parseTimeInput(value: string): [number, number, number] | null {
  const match = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value);
  if (!match) return null;

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  const seconds = match[3] !== undefined ? Number(match[3]) : 0;
  return hour <= 23 && minute <= 59 && seconds <= 59 ? [hour, minute, seconds] : null;
}

/**
 * Converts an IST date/time supplied by a native input into Unix epoch seconds.
 * It deliberately does not use the browser's local timezone, so the API payload
 * remains correct when the dashboard is opened outside India.
 */
export function istDateTimeToEpochSeconds(dateInput: string, timeInput: string, defaultSeconds = 0): number | null {
  const date = parseDateInput(dateInput);
  const time = parseTimeInput(timeInput);
  if (!date || !time) return null;

  const [year, month, day] = date;
  const [hour, minute, explicitSec] = time;
  const sec = timeInput.includes(':') && timeInput.split(':').length === 3 ? explicitSec : defaultSeconds;
  if (sec < 0 || sec > 59 || !Number.isInteger(sec)) return null;

  return Math.floor((Date.UTC(year, month - 1, day, hour, minute, sec) - IST_OFFSET_MS) / 1000);
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
  if (input.mode === 'all') {
    if (!deviceId) return null;
    const endSec = Math.floor(Date.now() / 1000) + 3600;
    const startSec = Math.max(946684800, endSec - Math.floor(4.95 * 365.25 * 24 * 60 * 60));
    return { device_id: deviceId, start_time: startSec, end_time: endSec };
  }

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

/** Returns the number of days in a given year and month (1-indexed month: 1=Jan, 12=Dec). Correctly accounts for leap years. */
export function getDaysInIstMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Formats a YYYY-MM string into a human-readable Month & Year (e.g. "2026-09" -> "September 2026" or "Sep 2026"). */
export function formatIstMonthYear(monthStr?: string, full = true): string {
  if (!monthStr) return '';
  const parts = monthStr.split('-');
  if (parts.length < 2) return monthStr;
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  if (!year || !month || month < 1 || month > 12) return monthStr;
  const d = new Date(Date.UTC(year, month - 1, 1));
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    month: full ? 'long' : 'short',
    year: 'numeric',
  }).format(d);
}

/** Shifts a YYYY-MM string by delta months (e.g. delta = -1 shifts to previous month, +1 to next month). */
export function shiftIstMonth(monthStr: string, delta: number): string {
  const parts = monthStr.split('-');
  if (parts.length < 2) return monthStr;
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  if (!year || !month || month < 1 || month > 12) return monthStr;
  const targetDate = new Date(Date.UTC(year, month - 1 + delta, 1));
  const newYear = targetDate.getUTCFullYear();
  const newMonth = String(targetDate.getUTCMonth() + 1).padStart(2, '0');
  return `${newYear}-${newMonth}`;
}

/** Produces the API's inclusive Unix-second range for a dashboard period in IST. */
export function getIstPeriodRange(
  period: TimeRangeTab,
  customDateRange?: DateRange,
  specificDate?: string,
  selectedMonth?: string,
  selectedYear?: string,
  now = new Date(),
): { start: number; end: number; interval: 'hour' | 'day' | 'month' } {
  const today = getIstDateInputValue(now);
  let startDate = today;
  let endDate = today;
  let end = istDateTimeToEpochSeconds(endDate, '23:59', 59) ?? Math.floor(now.getTime() / 1000);
  let interval: 'hour' | 'day' | 'month' = 'hour';

  if (period === 'week') {
    startDate = addIstDays(today, -6);
    interval = 'day';
  } else if (period === 'month') {
    const targetMonth = selectedMonth || today.slice(0, 7);
    const parts = targetMonth.split('-');
    const year = Number(parts[0]);
    const month = Number(parts[1]);
    const lastDay = getDaysInIstMonth(year, month);
    startDate = `${targetMonth}-01`;
    endDate = `${targetMonth}-${String(lastDay).padStart(2, '0')}`;
    end = istDateTimeToEpochSeconds(endDate, '23:59', 59) ?? end;
    interval = 'day';
  } else if (period === 'year') {
    const targetYear = selectedYear || today.slice(0, 4);
    startDate = `${targetYear}-01-01`;
    endDate = `${targetYear}-12-31`;
    end = istDateTimeToEpochSeconds(endDate, '23:59', 59) ?? end;
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

/**
 * Validates and converts a historical time range filter into Unix epoch seconds for API requests.
 */
export function createHistoricalTimeRangeRequest(
  filter: HistoricalTimeRangeFilter,
): { deviceId: string; startTime: number; endTime: number } | null {
  if (!filter.deviceId || !filter.startDate || !filter.startTime || !filter.endDate || !filter.endTime) {
    return null;
  }

  const startTimeEpoch = istDateTimeToEpochSeconds(filter.startDate, filter.startTime, 0);
  // Using 59 seconds to ensure the full end minute is inclusively fetched
  const endTimeEpoch = istDateTimeToEpochSeconds(filter.endDate, filter.endTime, 59);

  if (startTimeEpoch === null || endTimeEpoch === null || startTimeEpoch > endTimeEpoch) {
    return null;
  }

  return {
    deviceId: filter.deviceId,
    startTime: startTimeEpoch,
    endTime: endTimeEpoch,
  };
}

/**
 * Formats a Unix epoch timestamp (seconds) into human-readable IST Date & Time.
 * Example: "01 Sep 2026, 02:00:00 PM"
 */
export function formatIstFullDateTime(epochSeconds: number, includeSeconds = true): string {
  if (!Number.isFinite(epochSeconds)) return '';
  const date = new Date(epochSeconds * 1000);
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    ...(includeSeconds ? { second: '2-digit' } : {}),
    hour12: true,
  }).format(date);
}

/**
 * Formats a Unix epoch timestamp (seconds) into IST time string.
 * Example: "02:00 PM"
 */
export function formatIstTimeOnly(epochSeconds: number, includeSeconds = false): string {
  if (!Number.isFinite(epochSeconds)) return '';
  const date = new Date(epochSeconds * 1000);
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    ...(includeSeconds ? { second: '2-digit' } : {}),
    hour12: true,
  }).format(date);
}

/**
 * Gets the current time in IST as HH:mm 24-hour string for input elements.
 */
export function getIstCurrentTimeInputValue(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value;
  return `${part('hour') || '00'}:${part('minute') || '00'}`;
}

/**
 * Calculates a dynamic IST date and time shifted by minutesOffset from now (or a base date).
 */
export function getIstTimeShifted(minutesOffset: number, baseDate = new Date()): { date: string; time: string } {
  const shiftedDate = new Date(baseDate.getTime() + minutesOffset * 60 * 1000);
  return {
    date: getIstDateInputValue(shiftedDate),
    time: getIstCurrentTimeInputValue(shiftedDate),
  };
}

/** Returns exact start and end epoch seconds for an entire calendar year in IST. */
export function getIstYearRange(year: number): { start: number; end: number; interval: 'month' } {
  const start = istDateTimeToEpochSeconds(`${year}-01-01`, '00:00', 0);
  const end = istDateTimeToEpochSeconds(`${year}-12-31`, '23:59', 59);
  if (start === null || end === null) throw new Error(`Invalid year: ${year}`);
  return { start, end, interval: 'month' };
}

/** Returns exact start and end epoch seconds for an entire calendar month in IST (1-indexed month: 1=Jan, 12=Dec). */
export function getIstMonthRange(year: number, month: number): { start: number; end: number; interval: 'day'; lastDay: number } {
  const lastDay = getDaysInIstMonth(year, month);
  const monthStr = String(month).padStart(2, '0');
  const start = istDateTimeToEpochSeconds(`${year}-${monthStr}-01`, '00:00', 0);
  const end = istDateTimeToEpochSeconds(`${year}-${monthStr}-${String(lastDay).padStart(2, '0')}`, '23:59', 59);
  if (start === null || end === null) throw new Error(`Invalid year/month: ${year}-${month}`);
  return { start, end, interval: 'day', lastDay };
}

/** Returns exact start and end epoch seconds for a single calendar day in IST (YYYY-MM-DD). */
export function getIstDayRange(dateStr: string): { start: number; end: number; interval: 'hour' } {
  const start = istDateTimeToEpochSeconds(dateStr, '00:00', 0);
  const end = istDateTimeToEpochSeconds(dateStr, '23:59', 59);
  if (start === null || end === null) throw new Error(`Invalid date: ${dateStr}`);
  return { start, end, interval: 'hour' };
}

/** Returns exact start and end epoch seconds for a single hour in IST (hour: 0..23). */
export function getIstHourRange(dateStr: string, hour: number): { start: number; end: number } {
  const h = Math.max(0, Math.min(23, hour));
  const hourStr = String(h).padStart(2, '0');
  const start = istDateTimeToEpochSeconds(dateStr, `${hourStr}:00`, 0);
  const end = istDateTimeToEpochSeconds(dateStr, `${hourStr}:59`, 59);
  if (start === null || end === null) throw new Error(`Invalid date/hour: ${dateStr} ${hour}`);
  return { start, end };
}

/** Formats an hour index (0..23) into human-readable range (e.g. 14 -> "02:00 PM - 03:00 PM"). */
export function formatIstHourLabel(hour: number, compact = false): string {
  const h = Math.max(0, Math.min(23, hour));
  const nextH = (h + 1) % 24;
  const suffix1 = h >= 12 ? 'PM' : 'AM';
  const display1 = h % 12 || 12;
  const suffix2 = nextH >= 12 ? 'PM' : 'AM';
  const display2 = nextH % 12 || 12;

  if (compact) {
    return `${display1} ${suffix1}`;
  }
  return `${String(display1).padStart(2, '0')}:00 ${suffix1} - ${String(display2).padStart(2, '0')}:00 ${suffix2}`;
}

/** Formats a date string (YYYY-MM-DD) into human-readable IST day format (e.g. "15 Sep 2026"). */
export function formatIstDayLabel(dateStr: string, includeWeekday = false): string {
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = Number(parts[2]);
  const d = new Date(Date.UTC(year, month - 1, day));
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    ...(includeWeekday ? { weekday: 'short' } : {}),
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(d);
}

/** Shifts an IST date string (YYYY-MM-DD) by delta days. */
export function shiftIstDay(dateStr: string, deltaDays: number): string {
  return addIstDays(dateStr, deltaDays);
}

/** Shifts an IST date and hour by delta hours, crossing date boundaries if needed. */
export function shiftIstHour(dateStr: string, hour: number, deltaHours: number): { date: string; hour: number } {
  const totalHours = hour + deltaHours;
  if (totalHours >= 0 && totalHours <= 23) {
    return { date: dateStr, hour: totalHours };
  }
  const dayShift = Math.floor(totalHours / 24);
  const normalizedHour = ((totalHours % 24) + 24) % 24;
  return {
    date: shiftIstDay(dateStr, dayShift),
    hour: normalizedHour,
  };
}


