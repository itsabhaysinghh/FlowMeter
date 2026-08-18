#!/usr/bin/env node
import { pathToFileURL } from 'node:url';
import { SIMULATED_DEVICES } from '../backend/config.js';

const MINUTE_SECONDS = 60;

function parseArguments(argv) {
  const options = { interval: MINUTE_SECONDS, device: 'all', historical: false, once: false, dryRun: false, concurrency: 5 };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--historical') options.historical = true;
    else if (argument === '--once') options.once = true;
    else if (argument === '--dry-run') options.dryRun = true;
    else if (argument === '--device') options.device = argv[++index];
    else if (argument === '--start') options.start = argv[++index];
    else if (argument === '--end') options.end = argv[++index];
    else if (argument === '--interval') options.interval = Number(argv[++index]);
    else if (argument === '--concurrency') options.concurrency = Number(argv[++index]);
    else throw new Error(`Unknown argument: ${argument}`);
  }
  return options;
}

function assertSimulatedDevice(deviceId) {
  if (!SIMULATED_DEVICES.includes(deviceId)) {
    throw new Error('Protected or invalid device. Simulation blocked.');
  }
}

function parseIstDate(value, endOfDay = false) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || '');
  if (!match) throw new Error('Historical --start and --end must use YYYY-MM-DD in IST.');
  const [year, month, day] = match.slice(1).map(Number);
  const utcTimestamp = Date.UTC(year, month - 1, day, endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 0 : 0);
  const verification = new Date(utcTimestamp);
  if (verification.getUTCFullYear() !== year || verification.getUTCMonth() !== month - 1 || verification.getUTCDate() !== day) {
    throw new Error('Historical date is invalid.');
  }
  return Math.floor(utcTimestamp / 1000) - 5.5 * 60 * 60;
}

function seededNoise(seed) {
  let hash = 2166136261;
  for (const character of seed) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return ((hash >>> 0) % 1000) / 1000;
}

/** Generates deterministic, realistic readings so historical runs are repeatable. */
export function generateFlowRate(deviceId, timestamp) {
  assertSimulatedDevice(deviceId);
  const date = new Date((timestamp + 5.5 * 60 * 60) * 1000);
  const hour = date.getUTCHours();
  const minute = date.getUTCMinutes();
  const day = date.getUTCDate();
  const month = date.getUTCMonth();
  const weekday = date.getUTCDay();
  const isWeekend = weekday === 0 || weekday === 6;
  const noise = 0.88 + seededNoise(`${deviceId}:${timestamp}`) * 0.24;
  const seasonal = 0.88 + 0.18 * Math.sin((month - 2) * Math.PI / 6);

  if (deviceId === 'FLOSTAT_002') {
    const rushHour = (hour >= 6 && hour < 10) || (hour >= 17 && hour < 21);
    const overnight = hour < 5 || hour >= 23;
    const base = rushHour ? 23 : overnight ? 2.5 : 11.5;
    return Number((base * (isWeekend ? 0.78 : 1) * seasonal * noise).toFixed(2));
  }
  if (deviceId === 'FLOSTAT_003') {
    const buildingHours = hour >= 7 && hour < 19;
    const base = buildingHours ? 17 : 1.2;
    const classChange = [8, 10, 13, 16].includes(hour) && minute < 15 ? 1.45 : 1;
    return Number((base * classChange * (isWeekend ? 0.35 : 1) * seasonal * noise).toFixed(2));
  }
  if (deviceId === 'FLOSTAT_004') {
    const maintenance = day === 5 || day === 20 || (month === 5 && day <= 14) || (month === 11 && day <= 14);
    if (maintenance) return 0;
    const base = hour >= 9 && hour < 17 ? 8.5 : 0.7;
    return Number((base * (isWeekend ? 0.45 : 1) * seasonal * noise).toFixed(2));
  }

  // FLOSTAT_005: almost idle fire tank, with its monthly inspection pulse.
  const firstSunday = weekday === 0 && day <= 7;
  const inspection = firstSunday && hour === 10 && minute < 20;
  return Number(((inspection ? 46 : 0.05) * noise).toFixed(2));
}

export function createReading(deviceId, timestamp, receivedAt = Math.floor(Date.now() / 1000)) {
  assertSimulatedDevice(deviceId);
  return {
    device_id: deviceId,
    flow_rate_lpm: generateFlowRate(deviceId, timestamp),
    device_timestamp: timestamp,
    received_at: receivedAt,
  };
}

async function postReading(reading, { apiUrl, apiKey, dryRun }) {
  if (dryRun) {
    console.log(JSON.stringify(reading));
    return;
  }
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': apiKey },
    body: JSON.stringify(reading),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.success !== true) {
    throw new Error(body.message || `Backend rejected reading (HTTP ${response.status}).`);
  }
}

async function runWithConcurrency(readings, concurrency, send) {
  const pending = new Set();
  for (const reading of readings) {
    const task = send(reading).finally(() => pending.delete(task));
    pending.add(task);
    if (pending.size >= concurrency) await Promise.race(pending);
  }
  await Promise.all(pending);
}

function* historicalReadings(deviceId, startTimestamp, endTimestamp) {
  for (let timestamp = startTimestamp; timestamp <= endTimestamp; timestamp += MINUTE_SECONDS) {
    yield createReading(deviceId, timestamp);
  }
}

async function runHistorical(options, connection) {
  if (!options.start || !options.end) throw new Error('Historical mode requires --start and --end.');
  const deviceId = options.device;
  assertSimulatedDevice(deviceId);
  const startTimestamp = parseIstDate(options.start);
  const endTimestamp = parseIstDate(options.end, true);
  if (startTimestamp > endTimestamp) throw new Error('--start must be before or equal to --end.');

  const total = Math.floor((endTimestamp - startTimestamp) / MINUTE_SECONDS) + 1;
  console.log(`Sending ${total.toLocaleString('en-IN')} historical readings for ${deviceId}.`);
  let sent = 0;
  await runWithConcurrency(historicalReadings(deviceId, startTimestamp, endTimestamp), options.concurrency, async (reading) => {
    await postReading(reading, connection);
    sent += 1;
    if (sent % 1000 === 0 || sent === total) console.log(`Sent ${sent.toLocaleString('en-IN')} / ${total.toLocaleString('en-IN')}`);
  });
}

async function runLive(options, connection) {
  const deviceIds = options.device === 'all' ? SIMULATED_DEVICES : [options.device];
  deviceIds.forEach(assertSimulatedDevice);
  const sendTick = async () => {
    const timestamp = Math.floor(Date.now() / 1000 / MINUTE_SECONDS) * MINUTE_SECONDS;
    await Promise.all(deviceIds.map((deviceId) => postReading(createReading(deviceId, timestamp), connection)));
    console.log(`Sent ${deviceIds.join(', ')} at ${new Date(timestamp * 1000).toISOString()}`);
  };

  await sendTick();
  if (!options.once) setInterval(() => void sendTick().catch((error) => console.error(error.message)), options.interval * 1000);
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  if (!Number.isInteger(options.interval) || options.interval < MINUTE_SECONDS) throw new Error('--interval must be at least 60 seconds.');
  if (!Number.isInteger(options.concurrency) || options.concurrency < 1 || options.concurrency > 25) throw new Error('--concurrency must be between 1 and 25.');

  const connection = { apiUrl: process.env.API_URL, apiKey: process.env.API_KEY || '', dryRun: options.dryRun };
  if (!connection.apiUrl && !connection.dryRun) throw new Error('API_URL is required and must point to the backend POST /v1/flow/readings endpoint.');
  if (!connection.apiKey && !connection.dryRun) throw new Error('API_KEY is required.');

  if (options.historical) await runHistorical(options, connection);
  else await runLive(options, connection);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(`Simulator failed: ${error.message}`);
    process.exitCode = 1;
  });
}
