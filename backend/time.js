const IST_OFFSET_SECONDS = 5.5 * 60 * 60;

export function epochSeconds() {
  return Math.floor(Date.now() / 1000);
}

export function bucketStart(timestamp, granularity) {
  const istTimestamp = timestamp + IST_OFFSET_SECONDS;
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
  const options = granularity === 'hour'
    ? { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true }
    : granularity === 'month'
      ? { timeZone: 'Asia/Kolkata', month: 'short', year: 'numeric' }
      : { timeZone: 'Asia/Kolkata', month: 'short', day: '2-digit' };
  return new Intl.DateTimeFormat('en-IN', options).format(new Date(timestamp * 1000));
}
