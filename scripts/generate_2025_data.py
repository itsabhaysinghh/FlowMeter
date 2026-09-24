#!/usr/bin/env python3
"""
FLOSTAT Calendar Year 2025 Historical Water-Flow Data Ingestion & Testing Suite

Generates 1-minute interval water meter telemetry for the entire calendar year 2025
(365 days * 24 hours * 60 minutes = 525,600 readings per device, 6,832,800 readings total)
across 13 devices (FLOSTAT_002 through FLOSTAT_014) using deterministic, controlled
time-of-day flow rate patterns.

Target API:
    POST /v1/flow/readings

Strict Safety & Compliance Guarantees:
- FLOSTAT_001 is PROTECTED and strictly blocked from ingestion/modification.
- Purely uses the public HTTP API; does NOT bypass API or write directly to DynamoDB.
- Fully deterministic, controlled flow rates with zero uncontrolled random noise.
- Resumable checkpointing using interval-based state tracking (.flowmeter_2025_checkpoint.json).
- Adaptive rate limiting with exponential backoff on HTTP 429, 500, 502, 503, 504.
- Explicit pre-flight confirmation required before starting upload.
"""

import argparse
import asyncio
import json
import os
import random
import sys
import time
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Set, Tuple, Optional

# ---------------------------------------------------------------------------
# Constants & Configuration
# ---------------------------------------------------------------------------

DEFAULT_API_BASE = os.getenv("API_BASE_URL", "https://wbeuxrg5l0.execute-api.ap-south-1.amazonaws.com")
READINGS_ENDPOINT = "/v1/flow/readings"

PROTECTED_DEVICE = "FLOSTAT_001"

TARGET_DEVICES = [
    "FLOSTAT_002",
    "FLOSTAT_003",
    "FLOSTAT_004",
    "FLOSTAT_005",
    "FLOSTAT_006",
    "FLOSTAT_007",
    "FLOSTAT_008",
    "FLOSTAT_009",
    "FLOSTAT_010",
    "FLOSTAT_011",
    "FLOSTAT_012",
    "FLOSTAT_013",
    "FLOSTAT_014",
]

# Base flow rates per device in Liters/min (Sensible, distinct industrial/commercial rates)
DEVICE_BASE_FLOWS: Dict[str, float] = {
    "FLOSTAT_002": 20.0,
    "FLOSTAT_003": 22.0,
    "FLOSTAT_004": 24.0,
    "FLOSTAT_005": 26.0,
    "FLOSTAT_006": 28.0,
    "FLOSTAT_007": 30.0,
    "FLOSTAT_008": 32.0,
    "FLOSTAT_009": 34.0,
    "FLOSTAT_010": 36.0,
    "FLOSTAT_011": 38.0,
    "FLOSTAT_012": 40.0,
    "FLOSTAT_013": 42.0,
    "FLOSTAT_014": 44.0,
}

# Indian Standard Time (Asia/Kolkata, UTC+5:30)
IST_OFFSET_HOURS = 5.5
IST_OFFSET_SECONDS = int(IST_OFFSET_HOURS * 3600)
TZ_IST = timezone(timedelta(hours=5, minutes=30))

# Calendar Year 2025 IST boundaries (365 days, non-leap year)
START_DT_IST = datetime(2025, 1, 1, 0, 0, 0, tzinfo=TZ_IST)
END_DT_IST = datetime(2025, 12, 31, 23, 59, 0, tzinfo=TZ_IST)

START_TIMESTAMP = int(START_DT_IST.timestamp())  # 1735669800
END_TIMESTAMP = int(END_DT_IST.timestamp())      # 1767205740
STEP_SECONDS = 60

READINGS_PER_DEVICE = (END_TIMESTAMP - START_TIMESTAMP) // STEP_SECONDS + 1  # 525,600
TOTAL_READINGS = READINGS_PER_DEVICE * len(TARGET_DEVICES)                   # 6,832,800

CHECKPOINT_FILE = ".flowmeter_2025_checkpoint.json"
FAILURE_LOG_FILE = "failed_readings_2025.json"

# ---------------------------------------------------------------------------
# Controlled Deterministic Time-of-Day Pattern
# ---------------------------------------------------------------------------

def calculate_deterministic_flow_rate(device_id: str, timestamp_epoch: int) -> float:
    """
    Computes a 100% deterministic flow rate for a given device and timestamp.
    Applies a realistic, controlled industrial time-of-day demand curve:
    - 00:00 - 05:59 IST (Night baseline):     0.60x base flow
    - 06:00 - 09:59 IST (Morning Peak):       1.40x base flow
    - 10:00 - 16:59 IST (Daytime Normal):     1.00x base flow
    - 17:00 - 21:59 IST (Evening Peak):       1.30x base flow
    - 22:00 - 23:59 IST (Late Night ramp):    0.70x base flow

    Zero random fluctuations or noise are introduced.
    """
    if device_id == PROTECTED_DEVICE:
        raise ValueError(f"FATAL SECURITY VIOLATION: Ingestion requested for protected device '{PROTECTED_DEVICE}'!")
    if device_id not in DEVICE_BASE_FLOWS:
        raise ValueError(f"Unknown device ID: {device_id}")

    base_flow = DEVICE_BASE_FLOWS[device_id]

    # Convert epoch to IST hour
    ist_time = datetime.fromtimestamp(timestamp_epoch + IST_OFFSET_SECONDS, tz=timezone.utc)
    hour = ist_time.hour
    minute = ist_time.minute

    if 0 <= hour <= 5:
        multiplier = 0.60
    elif 6 <= hour <= 9:
        multiplier = 1.40
    elif 10 <= hour <= 16:
        multiplier = 1.00
    elif 17 <= hour <= 21:
        multiplier = 1.30
    else:  # 22 <= hour <= 23
        multiplier = 0.70

    # Deterministic subtle 15-minute modulation (e.g. slight step within the period)
    sub_step = (minute // 15) * 0.02
    calculated_rate = base_flow * (multiplier + sub_step)
    return round(calculated_rate, 2)


def format_epoch_ist(epoch: int) -> str:
    dt = datetime.fromtimestamp(epoch + IST_OFFSET_SECONDS, tz=timezone.utc)
    return dt.strftime("%Y-%m-%d %H:%M:%S IST")


# ---------------------------------------------------------------------------
# Checkpoint & Interval Management
# ---------------------------------------------------------------------------

def intervals_to_set(intervals: List[List[int]]) -> Set[int]:
    """Expands list of [start_ts, end_ts] intervals into a set of timestamps."""
    res = set()
    for start, end in intervals:
        for ts in range(start, end + 1, STEP_SECONDS):
            res.add(ts)
    return res


def set_to_intervals(ts_set: Set[int]) -> List[List[int]]:
    """Compresses a timestamp set into contiguous [start, end] intervals for compact JSON storage."""
    if not ts_set:
        return []
    sorted_ts = sorted(ts_set)
    intervals = []
    curr_start = sorted_ts[0]
    curr_end = sorted_ts[0]

    for ts in sorted_ts[1:]:
        if ts == curr_end + STEP_SECONDS:
            curr_end = ts
        else:
            intervals.append([curr_start, curr_end])
            curr_start = ts
            curr_end = ts
    intervals.append([curr_start, curr_end])
    return intervals


def load_checkpoint(filepath: str) -> Dict[str, Set[int]]:
    """Loads uploaded timestamps set per device from disk."""
    checkpoint_map: Dict[str, Set[int]] = {d: set() for d in TARGET_DEVICES}
    if not os.path.exists(filepath):
        return checkpoint_map

    try:
        with open(filepath, "r", encoding="utf-8") as f:
            data = json.load(f)
            for d in TARGET_DEVICES:
                if d in data:
                    raw_val = data[d]
                    if raw_val and isinstance(raw_val[0], list):
                        checkpoint_map[d] = intervals_to_set(raw_val)
                    elif raw_val and isinstance(raw_val[0], int):
                        checkpoint_map[d] = set(raw_val)
        return checkpoint_map
    except Exception as e:
        print(f"⚠️ Warning: Could not parse checkpoint file ({e}). Starting fresh.")
        return checkpoint_map


def save_checkpoint(filepath: str, checkpoint_map: Dict[str, Set[int]]):
    """Atomically writes compact interval checkpoint to disk."""
    temp_path = f"{filepath}.tmp"
    data = {d: set_to_intervals(checkpoint_map[d]) for d in TARGET_DEVICES}
    try:
        with open(temp_path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)
        os.replace(temp_path, filepath)
    except Exception as e:
        print(f"⚠️ Warning: Failed to write checkpoint ({e})")


def log_failed_reading(failure_file: str, record: dict):
    """Appends failed reading details to failure log file."""
    try:
        failures = []
        if os.path.exists(failure_file):
            try:
                with open(failure_file, "r", encoding="utf-8") as f:
                    failures = json.load(f)
            except Exception:
                failures = []
        failures.append(record)
        with open(failure_file, "w", encoding="utf-8") as f:
            json.dump(failures, f, indent=2)
    except Exception as e:
        print(f"⚠️ Failed to log failure: {e}")


# ---------------------------------------------------------------------------
# Upload Engine & Statistics
# ---------------------------------------------------------------------------

class UploadStats:
    def __init__(self, total_target: int, already_uploaded: int):
        self.total_target = total_target
        self.already_uploaded = already_uploaded
        self.uploaded_in_run = 0
        self.failed = 0
        self.retries = 0
        self.current_ts = START_TIMESTAMP
        self.current_device = TARGET_DEVICES[0]
        self.device_counts = {d: 0 for d in TARGET_DEVICES}
        self.start_time = time.time()
        self.lock = asyncio.Lock()

    async def record_success(self, device_id: str, ts: int):
        async with self.lock:
            self.uploaded_in_run += 1
            self.device_counts[device_id] += 1
            self.current_ts = ts
            self.current_device = device_id

    async def record_failure(self):
        async with self.lock:
            self.failed += 1

    async def record_retry(self):
        async with self.lock:
            self.retries += 1


async def send_reading_with_retry(
    session,
    url: str,
    api_key: str,
    payload: dict,
    stats: UploadStats,
    max_retries: int = 6,
) -> bool:
    """Sends reading POST request with exponential backoff and jitter."""
    headers = {"content-type": "application/json"}
    if api_key:
        headers["x-api-key"] = api_key

    body_bytes = json.dumps(payload).encode("utf-8")
    device_id = payload["device_id"]
    ts = payload["device_timestamp"]

    for attempt in range(max_retries):
        try:
            async with session.post(url, data=body_bytes, headers=headers, timeout=25.0) as resp:
                status = resp.status
                if status in (200, 201):
                    await stats.record_success(device_id, ts)
                    return True

                # Transient server or throttling errors (429, 500, 502, 503, 504)
                if status in (429, 500, 502, 503, 504):
                    await stats.record_retry()
                    backoff = (2 ** attempt) * 0.3 + random.uniform(0.1, 0.4)
                    await asyncio.sleep(backoff)
                    continue

                # 400 / 403 Client Errors
                resp_text = await resp.text()
                print(f"\n❌ Client Error {status} on {device_id} @ {ts}: {resp_text}")
                await stats.record_failure()
                log_failed_reading(FAILURE_LOG_FILE, {
                    "device_id": device_id,
                    "timestamp": ts,
                    "http_status": status,
                    "error": resp_text,
                    "retry_count": attempt,
                })
                return False

        except Exception as err:
            await stats.record_retry()
            if attempt == max_retries - 1:
                print(f"\n❌ Network error on {device_id} @ {ts} after {max_retries} attempts: {err}")
                await stats.record_failure()
                log_failed_reading(FAILURE_LOG_FILE, {
                    "device_id": device_id,
                    "timestamp": ts,
                    "http_status": "NETWORK_ERROR",
                    "error": str(err),
                    "retry_count": max_retries,
                })
                return False
            backoff = (2 ** attempt) * 0.4 + random.uniform(0.1, 0.5)
            await asyncio.sleep(backoff)

    await stats.record_failure()
    return False


async def progress_reporter(stats: UploadStats, stop_event: asyncio.Event):
    """Compact live progress display."""
    while not stop_event.is_set():
        await asyncio.sleep(1.5)
        async with stats.lock:
            total_done = stats.already_uploaded + stats.uploaded_in_run
            pct = (total_done / stats.total_target) * 100.0 if stats.total_target else 0.0
            elapsed = time.time() - stats.start_time
            rps = stats.uploaded_in_run / elapsed if elapsed > 0 else 0.0
            remaining = stats.total_target - total_done
            eta_sec = remaining / rps if rps > 0 else 0

            eta_str = str(timedelta(seconds=int(eta_sec))) if rps > 0 else "--:--:--"
            elapsed_str = str(timedelta(seconds=int(elapsed)))
            curr_ts_str = format_epoch_ist(stats.current_ts)
            curr_dev = stats.current_device

            bar_len = 25
            filled = int(bar_len * (total_done / stats.total_target)) if stats.total_target else 0
            bar = "█" * filled + "░" * (bar_len - filled)

            sys.stdout.write(
                f"\r[{bar}] {pct:5.2f}% | {total_done:,}/{stats.total_target:,} | "
                f"Device: {curr_dev} | TS: {curr_ts_str} | "
                f"{rps:5.1f} req/s | Elapsed: {elapsed_str} | ETA: {eta_str} | "
                f"Retries: {stats.retries:,} | Fails: {stats.failed}"
            )
            sys.stdout.flush()


async def run_uploader(
    api_url: str,
    api_key: str,
    concurrency: int,
    checkpoint_interval: int,
    devices: List[str],
    max_records: Optional[int] = None,
):
    import aiohttp

    checkpoint_map = load_checkpoint(CHECKPOINT_FILE)
    already_total = sum(len(checkpoint_map[d]) for d in devices)

    print("\n📊 Checking existing checkpoint status across 13 devices:")
    for d in devices:
        cnt = len(checkpoint_map[d])
        print(f"   • {d} (Base {DEVICE_BASE_FLOWS[d]:.1f} L/min): {cnt:,} / {READINGS_PER_DEVICE:,} uploaded")

    # Build work queue for pending timestamps
    work_items: List[Tuple[str, int, float]] = []
    for d in devices:
        done_set = checkpoint_map[d]
        for ts in range(START_TIMESTAMP, END_TIMESTAMP + 1, STEP_SECONDS):
            if ts not in done_set:
                rate = calculate_deterministic_flow_rate(d, ts)
                work_items.append((d, ts, rate))

    if max_records and max_records < len(work_items):
        work_items = work_items[:max_records]

    total_target = len(work_items) + already_total
    remaining_count = len(work_items)

    print(f"\n📦 Pending records to upload: {remaining_count:,} (Total dataset: {total_target:,})")

    if remaining_count == 0:
        print("\n🎉 All 6,832,800 records for Calendar Year 2025 are already uploaded and checkpointed!")
        return

    stats = UploadStats(total_target=total_target, already_uploaded=already_total)
    stop_event = asyncio.Event()
    progress_task = asyncio.create_task(progress_reporter(stats, stop_event))

    connector = aiohttp.TCPConnector(limit=concurrency * 2, limit_per_host=concurrency * 2, ttl_dns_cache=300)
    timeout = aiohttp.ClientTimeout(total=30.0, connect=10.0)

    checkpoint_batch: List[Tuple[str, int]] = []
    checkpoint_lock = asyncio.Lock()

    async with aiohttp.ClientSession(connector=connector, timeout=timeout) as session:
        semaphore = asyncio.Semaphore(concurrency)

        async def worker(device_id: str, ts: int, flow_rate: float):
            payload = {
                "device_id": device_id,
                "flow_rate_lpm": flow_rate,
                "device_timestamp": ts,
                "received_at": ts,
            }
            async with semaphore:
                success = await send_reading_with_retry(session, api_url, api_key, payload, stats)
                if success:
                    async with checkpoint_lock:
                        checkpoint_map[device_id].add(ts)
                        checkpoint_batch.append((device_id, ts))
                        if len(checkpoint_batch) >= checkpoint_interval:
                            save_checkpoint(CHECKPOINT_FILE, checkpoint_map)
                            checkpoint_batch.clear()

        # Ingest in chunks of 5,000 tasks
        chunk_size = 5000
        for i in range(0, len(work_items), chunk_size):
            chunk = work_items[i : i + chunk_size]
            tasks = [asyncio.create_task(worker(d, ts, f)) for (d, ts, f) in chunk]
            await asyncio.gather(*tasks)
            save_checkpoint(CHECKPOINT_FILE, checkpoint_map)

    stop_event.set()
    await progress_task

    save_checkpoint(CHECKPOINT_FILE, checkpoint_map)

    elapsed = time.time() - stats.start_time
    print(f"\n\n=======================================================")
    print(f"🏁 Upload Batch Completed in {timedelta(seconds=int(elapsed))}")
    print(f"=======================================================")
    print(f"   • Successfully sent in this run: {stats.uploaded_in_run:,}")
    print(f"   • Total uploaded to date:        {stats.already_uploaded + stats.uploaded_in_run:,} / {TOTAL_READINGS:,}")
    print(f"   • Retries handled:               {stats.retries:,}")
    print(f"   • Failed requests:               {stats.failed:,}")
    print(f"   • Average upload throughput:     {stats.uploaded_in_run / elapsed if elapsed > 0 else 0:.1f} req/sec")
    print(f"=======================================================\n")


# ---------------------------------------------------------------------------
# Pre-Flight Confirmation & Dry Run
# ---------------------------------------------------------------------------

def display_confirmation_banner(api_url: str):
    """Prints the required explicit confirmation banner."""
    print("=" * 50)
    print("FLOSTAT HISTORICAL DATA GENERATION")
    print("=" * 50)
    print("\nDate range:")
    print(f"{START_DT_IST.strftime('%Y-%m-%d %H:%M')} IST")
    print("→")
    print(f"{END_DT_IST.strftime('%Y-%m-%d %H:%M')} IST")
    print("\nDevices:")
    print(f"{TARGET_DEVICES[0]} → {TARGET_DEVICES[-1]}")
    print("\nNumber of devices:")
    print(f"{len(TARGET_DEVICES)}")
    print("\nReadings per device:")
    print(f"{READINGS_PER_DEVICE:,}")
    print("\nTotal readings:")
    print(f"{TOTAL_READINGS:,}")
    print("\nInterval:")
    print(f"{STEP_SECONDS // 60} minute")
    print("\nTarget API:")
    print(f"{api_url}")
    print("\nFLOSTAT_001:")
    print("PROTECTED / NOT TOUCHED")
    print("\n" + "=" * 50)


def run_dry_run():
    print("\n🔬 Dry Run: Validating payload synthesis across 13 devices...\n")
    sample_timestamps = [
        START_TIMESTAMP,                           # 2025-01-01 00:00:00 IST (Night 0.6x)
        START_TIMESTAMP + 7 * 3600,                # 2025-01-01 07:00:00 IST (Morning Peak 1.4x)
        START_TIMESTAMP + 13 * 3600,               # 2025-01-01 13:00:00 IST (Daytime 1.0x)
        START_TIMESTAMP + 19 * 3600,               # 2025-01-01 19:00:00 IST (Evening Peak 1.3x)
        END_TIMESTAMP,                             # 2025-12-31 23:59:00 IST (Late Night 0.7x)
    ]

    for ts in sample_timestamps:
        dt_str = format_epoch_ist(ts)
        print(f"--- Timestamp: {dt_str} (Epoch: {ts}) ---")
        for d in TARGET_DEVICES:
            flow = calculate_deterministic_flow_rate(d, ts)
            payload = {
                "device_id": d,
                "flow_rate_lpm": flow,
                "device_timestamp": ts,
                "received_at": ts,
            }
            print(f"   [{d}]: Base {DEVICE_BASE_FLOWS[d]:4.1f} L/min -> Rate {flow:5.2f} L/min -> Payload: {json.dumps(payload)}")
        print()

    print("✅ Dry run validation complete. Controlled deterministic patterns verified.")


# ---------------------------------------------------------------------------
# CLI Main Entrypoint
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description="FLOSTAT Calendar Year 2025 Historical Data Ingestion"
    )
    parser.add_argument(
        "--api-url",
        default=f"{DEFAULT_API_BASE}{READINGS_ENDPOINT}",
        help=f"Full URL to POST /v1/flow/readings (default: {DEFAULT_API_BASE}{READINGS_ENDPOINT})",
    )
    parser.add_argument(
        "--api-key",
        default=os.getenv("API_KEY", ""),
        help="Optional API key for authorization",
    )
    parser.add_argument(
        "--concurrency",
        type=int,
        default=int(os.getenv("MAX_CONCURRENCY", "5")),
        help="Maximum concurrent HTTP requests (default: 5)",
    )
    parser.add_argument(
        "--checkpoint-interval",
        type=int,
        default=250,
        help="Save checkpoint every N successfully uploaded records (default: 250)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Synthesize and inspect payloads without making HTTP calls",
    )
    parser.add_argument(
        "--confirm",
        action="store_true",
        help="Bypass interactive confirmation prompt",
    )
    parser.add_argument(
        "--max-records",
        type=int,
        default=None,
        help="Limit number of records to ingest in this run (for testing)",
    )
    parser.add_argument(
        "--reset-checkpoint",
        action="store_true",
        help="Clear existing checkpoint file and restart ingestion from beginning",
    )

    args = parser.parse_args()

    if args.reset_checkpoint and os.path.exists(CHECKPOINT_FILE):
        os.remove(CHECKPOINT_FILE)
        print(f"🗑️ Removed existing checkpoint file '{CHECKPOINT_FILE}'.")

    display_confirmation_banner(args.api_url)

    if args.dry_run:
        run_dry_run()
        return

    # Check explicit confirmation via flag, env var, or interactive prompt
    env_confirm = os.getenv("CONFIRM_UPLOAD", "").lower() in ("true", "1", "yes")
    if not (args.confirm or env_confirm):
        try:
            user_input = input("\nConfirm data upload (CONFIRM_UPLOAD=true / type 'yes' to proceed): ").strip()
            if user_input.lower() not in ("yes", "y", "true"):
                print("❌ Upload cancelled. Explicit confirmation required.")
                sys.exit(0)
        except EOFError:
            print("\n❌ Non-interactive environment detected. Pass --confirm or CONFIRM_UPLOAD=true to proceed.")
            sys.exit(1)

    print("\n🚀 Initializing asynchronous upload engine...")
    asyncio.run(
        run_uploader(
            api_url=args.api_url,
            api_key=args.api_key,
            concurrency=args.concurrency,
            checkpoint_interval=args.checkpoint_interval,
            devices=TARGET_DEVICES,
            max_records=args.max_records,
        )
    )


if __name__ == "__main__":
    main()
