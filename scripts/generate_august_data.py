#!/usr/bin/env python3
"""
FLOSTAT August 2026 Historical Water-Flow Data Ingestion & Stress-Testing Script

Generates 1-minute interval water meter telemetry for the entire month of August 2026
(31 days * 24 hours * 60 minutes = 44,640 readings per device, 178,560 readings total)
with CONSTANT flow-rate values for each device:
- FLOSTAT_002 -> 50.0 L/min
- FLOSTAT_003 -> 60.0 L/min
- FLOSTAT_004 -> 70.0 L/min
- FLOSTAT_005 -> 80.0 L/min

Uses the existing production API endpoint:
    POST /v1/flow/readings

Strict Safety Guarantees:
- FLOSTAT_001 is PROTECTED and strictly forbidden from writes.
- Only uses the public HTTP API; does not access DynamoDB directly.
- Does not modify existing backend architecture.
- Includes confirmation guards, exponential backoff, rate limiting, and resumability.
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
TARGET_DEVICES = ["FLOSTAT_002", "FLOSTAT_003", "FLOSTAT_004", "FLOSTAT_005"]

# Fixed constant flow-rate values per device
CONSTANT_FLOW_RATES: Dict[str, float] = {
    "FLOSTAT_002": 50.0,
    "FLOSTAT_003": 60.0,
    "FLOSTAT_004": 70.0,
    "FLOSTAT_005": 80.0,
}

# August 2026 in IST (Asia/Kolkata, UTC+5:30)
# Start: 2026-08-01 00:00:00 IST -> 1785522600
# End:   2026-08-31 23:59:00 IST -> 1788200940
IST_OFFSET_HOURS = 5.5
IST_OFFSET_SECONDS = int(IST_OFFSET_HOURS * 3600)
TZ_IST = timezone(timedelta(hours=5, minutes=30))

START_DT_IST = datetime(2026, 8, 1, 0, 0, 0, tzinfo=TZ_IST)
END_DT_IST = datetime(2026, 8, 31, 23, 59, 0, tzinfo=TZ_IST)

START_TIMESTAMP = int(START_DT_IST.timestamp())
END_TIMESTAMP = int(END_DT_IST.timestamp())
STEP_SECONDS = 60

READINGS_PER_DEVICE = (END_TIMESTAMP - START_TIMESTAMP) // STEP_SECONDS + 1  # 44,640
TOTAL_READINGS = READINGS_PER_DEVICE * len(TARGET_DEVICES)                   # 178,560

CHECKPOINT_FILE = ".august_upload_checkpoint.json"

# ---------------------------------------------------------------------------
# Flow Rate Generation
# ---------------------------------------------------------------------------

def get_constant_flow_rate(device_id: str) -> float:
    """Returns the fixed, constant flow rate for the given device."""
    if device_id == PROTECTED_DEVICE:
        raise ValueError(f"CRITICAL SAFETY VIOLATION: Write requested for {PROTECTED_DEVICE}!")
    if device_id not in CONSTANT_FLOW_RATES:
        raise ValueError(f"Unknown device ID: {device_id}")
    return CONSTANT_FLOW_RATES[device_id]


# ---------------------------------------------------------------------------
# Checkpoint Management
# ---------------------------------------------------------------------------

def load_checkpoint(filepath: str) -> Dict[str, Set[int]]:
    """Loads uploaded timestamps set per device from checkpoint file."""
    if not os.path.exists(filepath):
        return {d: set() for d in TARGET_DEVICES}
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            raw = json.load(f)
            return {d: set(raw.get(d, [])) for d in TARGET_DEVICES}
    except Exception as e:
        print(f"⚠️ Warning: Failed to parse checkpoint file ({e}). Starting fresh.")
        return {d: set() for d in TARGET_DEVICES}


def save_checkpoint(filepath: str, uploaded_map: Dict[str, Set[int]]):
    """Atomically saves uploaded timestamps set to disk."""
    temp_path = f"{filepath}.tmp"
    data = {d: sorted(list(uploaded_map[d])) for d in TARGET_DEVICES}
    try:
        with open(temp_path, "w", encoding="utf-8") as f:
            json.dump(data, f)
        os.replace(temp_path, filepath)
    except Exception as e:
        print(f"⚠️ Warning: Failed to write checkpoint ({e})")


# ---------------------------------------------------------------------------
# Asynchronous Ingestion Engine
# ---------------------------------------------------------------------------

class UploadStats:
    def __init__(self, total_target: int, already_uploaded: int):
        self.total_target = total_target
        self.already_uploaded = already_uploaded
        self.uploaded_in_run = 0
        self.failed = 0
        self.retries = 0
        self.device_counts = {d: 0 for d in TARGET_DEVICES}
        self.start_time = time.time()
        self.lock = asyncio.Lock()

    async def record_success(self, device_id: str):
        async with self.lock:
            self.uploaded_in_run += 1
            self.device_counts[device_id] += 1

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
    """
    Sends a single reading POST request with exponential backoff and jitter.
    """
    headers = {"content-type": "application/json"}
    if api_key:
        headers["x-api-key"] = api_key

    body_bytes = json.dumps(payload).encode("utf-8")
    device_id = payload["device_id"]

    for attempt in range(max_retries):
        try:
            async with session.post(url, data=body_bytes, headers=headers, timeout=20.0) as resp:
                status = resp.status
                if status in (200, 201):
                    await stats.record_success(device_id)
                    return True

                # Transient server / throttling errors -> Retry
                if status in (429, 500, 502, 503, 504):
                    await stats.record_retry()
                    backoff = (2 ** attempt) * 0.25 + random.uniform(0.05, 0.3)
                    await asyncio.sleep(backoff)
                    continue

                # 403 / 400 Client error
                resp_text = await resp.text()
                print(f"\n❌ Client Error {status} for {device_id}: {resp_text}")
                await stats.record_failure()
                return False

        except Exception as err:
            await stats.record_retry()
            if attempt == max_retries - 1:
                print(f"\n❌ Network error for {device_id} after {max_retries} attempts: {err}")
                await stats.record_failure()
                return False
            backoff = (2 ** attempt) * 0.3 + random.uniform(0.1, 0.4)
            await asyncio.sleep(backoff)

    await stats.record_failure()
    return False


async def progress_reporter(stats: UploadStats, stop_event: asyncio.Event):
    """Prints a clean live progress bar and telemetry metrics every 2 seconds."""
    while not stop_event.is_set():
        await asyncio.sleep(2.0)
        async with stats.lock:
            total_done = stats.already_uploaded + stats.uploaded_in_run
            pct = (total_done / stats.total_target) * 100.0 if stats.total_target else 0.0
            elapsed = time.time() - stats.start_time
            rps = stats.uploaded_in_run / elapsed if elapsed > 0 else 0.0
            remaining = stats.total_target - total_done
            eta_sec = remaining / rps if rps > 0 else 0

            eta_str = str(timedelta(seconds=int(eta_sec))) if rps > 0 else "--:--:--"
            elapsed_str = str(timedelta(seconds=int(elapsed)))

            bar_len = 30
            filled = int(bar_len * (total_done / stats.total_target)) if stats.total_target else 0
            bar = "█" * filled + "░" * (bar_len - filled)

            sys.stdout.write(
                f"\r[{bar}] {pct:5.1f}% | {total_done:,}/{stats.total_target:,} | "
                f"{rps:5.1f} req/s | Elapsed: {elapsed_str} | ETA: {eta_str} | "
                f"Retries: {stats.retries} | Fails: {stats.failed}"
            )
            sys.stdout.flush()


async def run_uploader(
    api_url: str,
    api_key: str,
    concurrency: int,
    checkpoint_interval: int,
    devices: List[str],
):
    import aiohttp

    checkpoint_map = load_checkpoint(CHECKPOINT_FILE)
    already_total = sum(len(checkpoint_map[d]) for d in devices)

    work_items = []
    for d in devices:
        done_set = checkpoint_map[d]
        flow_val = get_constant_flow_rate(d)
        for ts in range(START_TIMESTAMP, END_TIMESTAMP + 1, STEP_SECONDS):
            if ts not in done_set:
                work_items.append((d, ts, flow_val))

    random.seed(42)
    random.shuffle(work_items)

    total_target = TOTAL_READINGS
    remaining_count = len(work_items)

    print(f"\n📦 Ingestion queue status:")
    for d in devices:
        print(f"   • {d} (fixed {CONSTANT_FLOW_RATES[d]:.1f} L/min): {len(checkpoint_map[d]):,}/44,640 uploaded")
    print(f"   • Remaining to upload: {remaining_count:,} readings")

    if remaining_count == 0:
        print("\n🎉 All 178,560 constant-value readings for August 2026 are already uploaded!")
        return

    stats = UploadStats(total_target=total_target, already_uploaded=already_total)
    stop_event = asyncio.Event()
    progress_task = asyncio.create_task(progress_reporter(stats, stop_event))

    connector = aiohttp.TCPConnector(limit=concurrency * 2, limit_per_host=concurrency * 2, ttl_dns_cache=300)
    timeout = aiohttp.ClientTimeout(total=30.0, connect=10.0)

    checkpoint_batch = []
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

        batch_size = 5000
        for i in range(0, len(work_items), batch_size):
            chunk = work_items[i : i + batch_size]
            tasks = [asyncio.create_task(worker(d, ts, f)) for (d, ts, f) in chunk]
            await asyncio.gather(*tasks)
            save_checkpoint(CHECKPOINT_FILE, checkpoint_map)

    stop_event.set()
    await progress_task

    save_checkpoint(CHECKPOINT_FILE, checkpoint_map)

    elapsed = time.time() - stats.start_time
    print(f"\n\n=======================================================")
    print(f"🏁 Upload Run Finished in {timedelta(seconds=int(elapsed))}")
    print(f"=======================================================")
    print(f"   • Successfully sent in this run: {stats.uploaded_in_run:,}")
    print(f"   • Retries handled:               {stats.retries:,}")
    print(f"   • Failed requests:               {stats.failed:,}")
    print(f"   • Average upload throughput:     {stats.uploaded_in_run / elapsed if elapsed > 0 else 0:.1f} req/sec")
    print(f"=======================================================\n")


# ---------------------------------------------------------------------------
# CLI & Pre-flight Summary
# ---------------------------------------------------------------------------

def display_summary_banner(api_url: str, concurrency: int, dry_run: bool):
    print("\n" + "=" * 70)
    print("🌊 FLOSTAT AUGUST 2026 CONSTANT-VALUE TELEMETRY INGESTION")
    print("=" * 70)
    print(f" 📅 Date Range (IST):      {START_DT_IST.strftime('%Y-%m-%d %H:%M:%S')} to {END_DT_IST.strftime('%Y-%m-%d %H:%M:%S')}")
    print(f" ⏱️  Unix Timestamps:       {START_TIMESTAMP} to {END_TIMESTAMP} (step: 60s)")
    print(f" 📱 Devices & Constant Flow Rates:")
    for d, rate in CONSTANT_FLOW_RATES.items():
        print(f"    • {d}: {rate:.1f} L/min (fixed for all 44,640 readings)")
    print(f" 🛡️  Protected Device:     {PROTECTED_DEVICE} (STRICTLY BLOCKED & EXCLUDED)")
    print(f" 📊 Total Readings:        {TOTAL_READINGS:,} ({READINGS_PER_DEVICE:,} per device)")
    print(f" 🌐 Target API Endpoint:   {api_url}")
    print(f" ⚡ Concurrency:           {concurrency} workers")
    print(f" 🧪 Dry Run Mode:          {'ENABLED (No HTTP requests)' if dry_run else 'DISABLED (Production Ingestion)'}")
    print("=" * 70)


def run_dry_run():
    print("\n🔬 Dry Run: Verifying constant payloads across all 4 devices...\n")
    sample_timestamps = [
        START_TIMESTAMP,                           # 2026-08-01 00:00:00 IST
        START_TIMESTAMP + 3600,                    # 2026-08-01 01:00:00 IST
        START_TIMESTAMP + 12 * 3600,               # 2026-08-01 12:00:00 IST
        END_TIMESTAMP,                             # 2026-08-31 23:59:00 IST
    ]

    for ts in sample_timestamps:
        dt = datetime.fromtimestamp(ts + IST_OFFSET_SECONDS, tz=timezone.utc)
        dt_str = dt.strftime("%Y-%m-%d %H:%M:%S IST")
        print(f"--- Timestamp: {dt_str} (Epoch: {ts}) ---")
        for d in TARGET_DEVICES:
            flow = get_constant_flow_rate(d)
            payload = {
                "device_id": d,
                "flow_rate_lpm": flow,
                "device_timestamp": ts,
                "received_at": ts,
            }
            print(f"   [{d}]: {flow:5.1f} L/min  ->  Payload: {json.dumps(payload)}")
        print()

    print("✅ Dry run sample validation complete. All devices have exact constant values.")


def main():
    parser = argparse.ArgumentParser(
        description="FLOSTAT August 2026 Constant-Value Water-Flow Data Ingestion"
    )
    parser.add_argument(
        "--api-url",
        default=f"{DEFAULT_API_BASE}{READINGS_ENDPOINT}",
        help="Full URL to POST /v1/flow/readings",
    )
    parser.add_argument(
        "--api-key",
        default=os.getenv("API_KEY", ""),
        help="API Key for Authorization (if required)",
    )
    parser.add_argument(
        "--concurrency",
        type=int,
        default=35,
        help="Number of concurrent asynchronous workers (default: 35)",
    )
    parser.add_argument(
        "--checkpoint-interval",
        type=int,
        default=200,
        help="Save checkpoint every N successfully uploaded records (default: 200)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Run without making network calls to verify payload synthesis",
    )
    parser.add_argument(
        "--confirm",
        action="store_true",
        help="Bypass interactive confirmation prompt",
    )
    parser.add_argument(
        "--reset-checkpoint",
        action="store_true",
        help="Delete existing checkpoint file and restart from beginning",
    )

    args = parser.parse_args()

    if args.reset_checkpoint and os.path.exists(CHECKPOINT_FILE):
        os.remove(CHECKPOINT_FILE)
        print(f"🗑️ Checkpoint file '{CHECKPOINT_FILE}' removed.")

    display_summary_banner(args.api_url, args.concurrency, args.dry_run)

    if args.dry_run:
        run_dry_run()
        return

    env_confirm = os.getenv("CONFIRM_UPLOAD", "").lower() in ("true", "1", "yes")
    if not (args.confirm or env_confirm):
        try:
            user_input = input("\n❓ Ready to ingest 178,560 constant-value readings to the production API? (type 'yes' to proceed): ").strip()
            if user_input.lower() not in ("yes", "y"):
                print("❌ Upload aborted by user.")
                sys.exit(0)
        except EOFError:
            print("\n❌ Non-interactive environment detected. Pass --confirm or CONFIRM_UPLOAD=true to proceed.")
            sys.exit(1)

    print("\n🚀 Starting asynchronous upload pipeline...")
    asyncio.run(
        run_uploader(
            api_url=args.api_url,
            api_key=args.api_key,
            concurrency=args.concurrency,
            checkpoint_interval=args.checkpoint_interval,
            devices=TARGET_DEVICES,
        )
    )


if __name__ == "__main__":
    main()
