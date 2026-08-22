const IST_OFFSET_SECONDS = 5.5 * 60 * 60;

export function epochSeconds() {
  return Math.floor(Date.now() / 1000);
}

function toEpochSeconds(value) {
  if (typeof value === 'number') return Math.floor(value);
  const parsed = Number(value);
  if (Number.isFinite(parsed)) return Math.floor(parsed);
  const date = new Date(value);
  return isNaN(date.getTime()) ? 0 : Math.floor(date.getTime() / 1000);
}

export function bucketStart(timestamp, granularity) {
  const ts = toEpochSeconds(timestamp);
  const istTimestamp = ts + IST_OFFSET_SECONDS;
  const istDate = new Date(istTimestamp * 1000);

  if (granularity === 'hour') {
    return Math.floor(istTimestamp / 3600) * 3600 - IST_OFFSET_SECONDS;
  }
  if (granularity === 'day') {
    return Date.UTC(istDate.getUTCFullYear(), istDate.getUTCMonth(), istDate.getUTCDate()) / 1000 - IST_OFFSET_SECONDS;
  }
  if (granularity === 'month') {
    return Date.UTC(istDate.getUTCFullYear(), istDate.getUTCMonth(), 1) / 1000 - IST_OFFSET_SECONDS;
  }
  throw new Error(`Unsupported rollup granularity: ${granularity}`);
}

export function bucketEnd(timestamp, granularity) {
  const start = bucketStart(timestamp, granularity);
  const istStart = new Date((start + IST_OFFSET_SECONDS) * 1000);
  if (granularity === 'hour') return start + 3599;
  if (granularity === 'day') return start + 86399;
  return Date.UTC(istStart.getUTCFullYear(), istStart.getUTCMonth() + 1, 1) / 1000 - IST_OFFSET_SECONDS - 1;
}

export function formatIstLabel(timestamp, granularity) {
  const ts = toEpochSeconds(timestamp);
  const dateObj = new Date(ts * 1000);
  if (isNaN(dateObj.getTime())) return String(timestamp);

  if (granularity === 'hour') {
    return new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true }).format(dateObj);
  }
  if (granularity === 'month') {
    return new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', month: 'short', year: 'numeric' }).format(dateObj);
  }

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(dateObj);
  const part = (type) => parts.find((item) => item.type === type)?.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}
