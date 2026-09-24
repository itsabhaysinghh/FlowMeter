#!/usr/bin/env python3
"""
FLOSTAT August 2026 Historical Telemetry Verification Suite (Constant Value Mode)

Performs comprehensive audits and stress-test benchmarks against:
    GET /v1/flow/history

Verifies:
1. Exact reading count per device (44,640 per device, 178,560 total across all 4 devices).
2. Constant flow rate values:
   - FLOSTAT_002 == 50.0 L/min
   - FLOSTAT_003 == 60.0 L/min
   - FLOSTAT_004 == 70.0 L/min
   - FLOSTAT_005 == 80.0 L/min
3. Total monthly consumption volume equals (44,640 * rate).
4. Exact boundary timestamps:
   - First: 2026-08-01 00:00:00 IST (1785522600)
   - Last:  2026-08-31 23:59:00 IST (1788200940)
5. Zero duplicate timestamps.
6. Zero missing minutes (continuous 60-second intervals).
7. DynamoDB pagination tokens (next_token) handling.
8. Multi-range historical retrieval performance:
   - 10 minutes (10 readings)
   - 1 hour (60 readings)
   - 1 day (1,440 readings)
   - 2 days (2,880 readings)
   - 5 days (7,200 readings)
   - 10 days (14,400 readings)
   - Complete August 2026 (44,640 readings)
"""

import argparse
import asyncio
import json
import os
import sys
import time
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional, Set, Tuple

DEFAULT_API_BASE = os.getenv("API_BASE_URL", "https://wbeuxrg5l0.execute-api.ap-south-1.amazonaws.com")
HISTORY_ENDPOINT = "/v1/flow/history"

TARGET_DEVICES = ["FLOSTAT_002", "FLOSTAT_003", "FLOSTAT_004", "FLOSTAT_005"]

EXPECTED_CONSTANT_FLOWS: Dict[str, float] = {
    "FLOSTAT_002": 50.0,
    "FLOSTAT_003": 60.0,
    "FLOSTAT_004": 70.0,
    "FLOSTAT_005": 80.0,
}

# August 2026 IST bounds
IST_OFFSET_HOURS = 5.5
IST_OFFSET_SECONDS = int(IST_OFFSET_HOURS * 3600)
TZ_IST = timezone(timedelta(hours=5, minutes=30))

START_DT_IST = datetime(2026, 8, 1, 0, 0, 0, tzinfo=TZ_IST)
END_DT_IST = datetime(2026, 8, 31, 23, 59, 0, tzinfo=TZ_IST)

START_TIMESTAMP = int(START_DT_IST.timestamp())  # 1785522600
END_TIMESTAMP = int(END_DT_IST.timestamp())      # 1788200940
STEP_SECONDS = 60
EXPECTED_READINGS_PER_DEVICE = 44640
EXPECTED_TOTAL_READINGS = 178560


def format_epoch_ist(epoch: int) -> str:
    dt = datetime.fromtimestamp(epoch + IST_OFFSET_SECONDS, tz=timezone.utc)
    return dt.strftime("%Y-%m-%d %H:%M:%S IST")


async def fetch_history_range(
    session,
    api_url: str,
    device_id: str,
    start_time: int,
    end_time: int,
    page_limit: int = 1000,
) -> Tuple[List[dict], int, float]:
    records = []
    next_token = None
    page_count = 0
    t0 = time.time()

    while True:
        params = {
            "device_id": device_id,
            "start_time": str(start_time),
            "end_time": str(end_time),
            "limit": str(page_limit),
        }
        if next_token:
            params["next_token"] = next_token

        async with session.get(api_url, params=params, timeout=30.0) as resp:
            if resp.status != 200:
                body = await resp.text()
                raise RuntimeError(f"API Error {resp.status} on {device_id}: {body}")
            
            data = await resp.json()
            page_records = data.get("records", [])
            records.extend(page_records)
            page_count += 1
            next_token = data.get("next_token")
            if not next_token:
                break

    duration = time.time() - t0
    return records, page_count, duration


async def verify_device_complete_month(
    session,
    api_url: str,
    device_id: str,
) -> dict:
    expected_rate = EXPECTED_CONSTANT_FLOWS[device_id]
    expected_volume = expected_rate * EXPECTED_READINGS_PER_DEVICE

    print(f"\n🔍 Auditing {device_id} (Expected constant {expected_rate:.1f} L/min) for August 2026...")
    records, page_count, duration = await fetch_history_range(
        session, api_url, device_id, START_TIMESTAMP, END_TIMESTAMP, page_limit=1000
    )

    count = len(records)
    timestamps = [int(r["timestamp"]) for r in records]
    unique_timestamps = set(timestamps)
    has_duplicates = len(timestamps) != len(unique_timestamps)

    min_ts = min(timestamps) if timestamps else None
    max_ts = max(timestamps) if timestamps else None

    expected_set = set(range(START_TIMESTAMP, END_TIMESTAMP + 1, STEP_SECONDS))
    missing_timestamps = expected_set - unique_timestamps
    missing_count = len(missing_timestamps)

    # Check constant values
    flow_rates = [float(r.get("avg_flow_rate_lpm", r.get("flow_rate_lpm", 0.0))) for r in records]
    all_constant = all(abs(f - expected_rate) < 0.001 for f in flow_rates) if flow_rates else False
    non_matching_count = sum(1 for f in flow_rates if abs(f - expected_rate) >= 0.001)

    total_volume = sum(flow_rates)
    avg_flow = total_volume / count if count else 0.0
    max_flow = max(flow_rates) if flow_rates else 0.0
    min_flow = min(flow_rates) if flow_rates else 0.0

    is_count_valid = (count == EXPECTED_READINGS_PER_DEVICE)
    is_first_valid = (min_ts == START_TIMESTAMP)
    is_last_valid = (max_ts == END_TIMESTAMP)
    is_continuous = (missing_count == 0) and not has_duplicates

    result = {
        "device_id": device_id,
        "record_count": count,
        "expected_count": EXPECTED_READINGS_PER_DEVICE,
        "is_count_valid": is_count_valid,
        "first_timestamp": min_ts,
        "expected_first": START_TIMESTAMP,
        "is_first_valid": is_first_valid,
        "last_timestamp": max_ts,
        "expected_last": END_TIMESTAMP,
        "is_last_valid": is_last_valid,
        "has_duplicates": has_duplicates,
        "duplicate_count": len(timestamps) - len(unique_timestamps),
        "missing_minutes": missing_count,
        "is_continuous": is_continuous,
        "expected_rate": expected_rate,
        "all_constant": all_constant,
        "non_matching_count": non_matching_count,
        "pages_fetched": page_count,
        "fetch_duration_sec": duration,
        "throughput_rps": count / duration if duration > 0 else 0,
        "total_volume_litres": round(total_volume, 1),
        "expected_volume_litres": round(expected_volume, 1),
        "avg_flow_rate_lpm": round(avg_flow, 2),
        "max_flow_rate_lpm": round(max_flow, 2),
        "min_flow_rate_lpm": round(min_flow, 2),
    }

    status_icon = "✅" if (is_count_valid and is_first_valid and is_last_valid and is_continuous and all_constant) else "❌"
    print(f"{status_icon} {device_id}: {count:,}/{EXPECTED_READINGS_PER_DEVICE:,} records in {duration:.2f}s ({page_count} pages)")
    print(f"   • First TS: {format_epoch_ist(min_ts) if min_ts else 'N/A'} (expected: {format_epoch_ist(START_TIMESTAMP)})")
    print(f"   • Last TS:  {format_epoch_ist(max_ts) if max_ts else 'N/A'} (expected: {format_epoch_ist(END_TIMESTAMP)})")
    print(f"   • Constant Value: {expected_rate:.1f} L/min (Non-matching: {non_matching_count})")
    print(f"   • Total Volume: {total_volume:,.1f} L (Expected: {expected_volume:,.1f} L)")
    print(f"   • Duplicates: {result['duplicate_count']} | Missing Minutes: {missing_count}")

    return result


async def benchmark_range_queries(
    session,
    api_url: str,
    device_id: str = "FLOSTAT_002",
) -> List[dict]:
    test_ranges = [
        ("10 Minutes", 10 * 60, 10),
        ("1 Hour", 1 * 3600, 60),
        ("1 Day (24h)", 1 * 86400, 1440),
        ("2 Days", 2 * 86400, 2880),
        ("5 Days", 5 * 86400, 7200),
        ("10 Days", 10 * 86400, 14400),
        ("Full August 2026", 31 * 86400, 44640),
    ]

    print(f"\n⚡ Benchmarking variable range queries for {device_id}...")
    results = []

    for name, duration_sec, expected_count in test_ranges:
        start_ts = START_TIMESTAMP
        end_ts = start_ts + duration_sec - STEP_SECONDS
        if name == "Full August 2026":
            end_ts = END_TIMESTAMP

        records, page_count, fetch_time = await fetch_history_range(
            session, api_url, device_id, start_ts, end_ts, page_limit=1000
        )
        actual_count = len(records)
        passed = (actual_count == expected_count)
        rps = actual_count / fetch_time if fetch_time > 0 else 0

        res = {
            "range_name": name,
            "expected_records": expected_count,
            "actual_records": actual_count,
            "pages": page_count,
            "latency_sec": round(fetch_time, 3),
            "throughput_rps": round(rps, 1),
            "passed": passed,
        }
        results.append(res)
        icon = "✅" if passed else "❌"
        print(f"   {icon} {name:<18} | Expected: {expected_count:5,} | Actual: {actual_count:5,} | Pages: {page_count:2} | Latency: {fetch_time:6.3f}s | Throughput: {rps:7.1f} rec/s")

    return results


async def run_verification_suite(api_url: str):
    import aiohttp

    print("\n" + "=" * 70)
    print("🔎 FLOSTAT AUGUST 2026 CONSTANT-VALUE VERIFICATION SUITE")
    print("=" * 70)
    print(f" 🌐 Target API:            {api_url}")
    print(f" 📅 Period:                {START_DT_IST.strftime('%Y-%m-%d')} to {END_DT_IST.strftime('%Y-%m-%d')} (31 Days)")
    print(f" 📱 Devices & Constant Flows:")
    for d, rate in EXPECTED_CONSTANT_FLOWS.items():
        print(f"    • {d}: {rate:.1f} L/min")
    print(f" 📊 Expected Total:        {EXPECTED_TOTAL_READINGS:,} ({EXPECTED_READINGS_PER_DEVICE:,} per device)")
    print("=" * 70)

    connector = aiohttp.TCPConnector(limit=20, ttl_dns_cache=300)
    timeout = aiohttp.ClientTimeout(total=60.0)

    async with aiohttp.ClientSession(connector=connector, timeout=timeout) as session:
        device_results = []
        for d in TARGET_DEVICES:
            res = await verify_device_complete_month(session, api_url, d)
            device_results.append(res)

        bench_results = await benchmark_range_queries(session, api_url, "FLOSTAT_002")

    # Summary table
    print("\n" + "=" * 70)
    print("📋 SUMMARY AUDIT REPORT (CONSTANT VALUE INGESTION)")
    print("=" * 70)
    total_found = sum(r["record_count"] for r in device_results)
    all_passed = (
        total_found == EXPECTED_TOTAL_READINGS and
        all(r["is_continuous"] and r["all_constant"] for r in device_results) and
        all(b["passed"] for b in bench_results)
    )

    print(f" Device       | Rate   | Records | Expected | First TS Valid | Last TS Valid | Missing | Dups | Status")
    print(f" -------------+--------+---------+----------+----------------+---------------+---------+------+-------")
    for r in device_results:
        d = r["device_id"]
        rate = r["expected_rate"]
        cnt = r["record_count"]
        exp = r["expected_count"]
        f_ok = "YES" if r["is_first_valid"] else "NO"
        l_ok = "YES" if r["is_last_valid"] else "NO"
        miss = r["missing_minutes"]
        dups = r["duplicate_count"]
        st = "PASSED" if (r["is_count_valid"] and r["is_continuous"] and r["all_constant"]) else "FAILED"
        print(f" {d:<12} | {rate:4.1f} L | {cnt:7,} | {exp:8,} | {f_ok:^14} | {l_ok:^13} | {miss:7} | {dups:4} | {st}")
    print(f" -------------+--------+---------+----------+----------------+---------------+---------+------+-------")
    print(f" TOTAL        |        | {total_found:7,} | {EXPECTED_TOTAL_READINGS:8,} | {'ALL OK' if all_passed else 'MISMATCH'}")
    print("=" * 70)

    if all_passed:
        print("\n🎉 ALL CONSTANT-VALUE VERIFICATION CHECKS PASSED (100% Data Integrity).")
    else:
        print(f"\n⚠️ Verification detected discrepancies.")

    return all_passed, device_results, bench_results


def main():
    parser = argparse.ArgumentParser(
        description="FLOSTAT August 2026 Constant Telemetry Verification"
    )
    parser.add_argument(
        "--api-url",
        default=f"{DEFAULT_API_BASE}{HISTORY_ENDPOINT}",
        help="Full URL to GET /v1/flow/history",
    )
    args = parser.parse_args()

    success, _, _ = asyncio.run(run_verification_suite(args.api_url))
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
