import assert from 'node:assert/strict';
import { createServer } from '../backend/server.js';
import { createReading } from '../simulator/flow-meter-simulator.js';

class MemoryFlowRepository {
  constructor() {
    this.records = [];
  }

  async putReading(reading) {
    const timestampVal = String(reading.device_timestamp).padStart(10, '0');
    const exists = this.records.some((r) => r.device_id === reading.device_id && r.timestamp === timestampVal);
    if (exists) return { inserted: false };
    this.records.push({ ...reading, timestamp: timestampVal });
    return { inserted: true };
  }

  async getLatest(deviceId) {
    return [...this.records]
      .filter((r) => r.device_id === deviceId)
      .sort((a, b) => Number(b.timestamp) - Number(a.timestamp))[0] || null;
  }

  async getReadingsPage({ deviceId, startTime, endTime, limit, scanIndexForward = true }) {
    const startStr = String(startTime).padStart(10, '0');
    const endStr = String(endTime).padStart(10, '0');
    let filtered = this.records.filter((r) => r.device_id === deviceId && r.timestamp >= startStr && r.timestamp <= endStr);
    
    if (scanIndexForward) {
      filtered.sort((a, b) => Number(a.timestamp) - Number(b.timestamp));
    } else {
      filtered.sort((a, b) => Number(b.timestamp) - Number(a.timestamp));
    }

    return { records: filtered.slice(0, limit) };
  }

  async forEachReading(range, onPage) {
    const page = await this.getReadingsPage({ ...range, limit: 1000, scanIndexForward: true });
    await onPage(page.records);
  }

  async getRollups() {
    return []; // Return empty array to test rollups fallback
  }

  async deleteRange({ deviceId, startTime, endTime }) {
    const before = this.records.length;
    const startStr = String(startTime).padStart(10, '0');
    const endStr = String(endTime).padStart(10, '0');
    this.records = this.records.filter((r) => r.device_id !== deviceId || r.timestamp < startStr || r.timestamp > endStr);
    return before - this.records.length;
  }
}

async function runE2ETests() {
  console.log('=== STARTING LOCAL E2E VERIFICATION ===\n');

  const repository = new MemoryFlowRepository();
  const apiKey = 'test-key';
  const server = createServer({
    config: { port: 3005, readingsTableName: 'local-readings', rollupsTableName: 'local-rollups', awsRegion: 'ap-south-1', apiKey, frontendOrigin: '*' },
    repository,
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;
  console.log(`[1] Local backend server running on ${baseUrl}`);

  try {
    const baseTs = Math.floor(Date.now() / 1000) - 3600;
    const devices = ['FLOSTAT_002', 'FLOSTAT_003', 'FLOSTAT_004', 'FLOSTAT_005'];

    // 2. Insert single record & test 20 rapid refreshes
    console.log('[2] Testing single insert followed by 20 rapid GET refreshes...');
    const reading1 = createReading('FLOSTAT_002', baseTs);
    const postRes1 = await fetch(`${baseUrl}/v1/flow/readings`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': apiKey },
      body: JSON.stringify(reading1),
    });
    assert.equal(postRes1.status, 201);
    console.log('    ✓ POST reading succeeded (HTTP 201)');

    for (let i = 1; i <= 20; i++) {
      const getRes = await fetch(`${baseUrl}/v1/flow/history?device_id=FLOSTAT_002&start_time=${baseTs - 10}&end_time=${baseTs + 10}`);
      assert.equal(getRes.headers.get('cache-control'), 'no-cache, no-store, must-revalidate, proxy-revalidate');
      const body = await getRes.json();
      assert.equal(body.records.length, 1, `Refresh #${i} returned wrong record count`);
      assert.equal(body.records[0].avg_flow_rate_lpm, reading1.flow_rate_lpm, `Refresh #${i} returned wrong flow rate`);
    }
    console.log('    ✓ 20/20 rapid GET refreshes returned consistent, up-to-date record with no cache staleness.');

    // 3. Perform multiple rapid inserts followed by 20 rapid refreshes
    console.log('\n[3] Testing multiple rapid inserts followed by repeated refreshes across devices...');
    for (let i = 1; i <= 10; i++) {
      const ts = baseTs + i * 60;
      for (const dev of devices) {
        const r = createReading(dev, ts);
        const postRes = await fetch(`${baseUrl}/v1/flow/readings`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-api-key': apiKey },
          body: JSON.stringify(r),
        });
        assert.equal(postRes.status, 201);
      }
    }
    console.log('    ✓ Inserted 40 new readings (10 per device) successfully.');

    // Verify 20 rapid refreshes after multi-inserts
    for (let i = 1; i <= 20; i++) {
      const histRes = await fetch(`${baseUrl}/v1/flow/history?device_id=FLOSTAT_002&start_time=${baseTs}&end_time=${baseTs + 1000}`);
      const histBody = await histRes.json();
      assert.equal(histBody.records.length, 11);
      // Verify strict descending order (latest timestamp first)
      for (let j = 0; j < histBody.records.length - 1; j++) {
        assert(histBody.records[j].timestamp >= histBody.records[j + 1].timestamp, `Sort error at index ${j}`);
      }
    }
    console.log('    ✓ 20/20 rapid refreshes returned 11 strictly ordered records.');

    // 4. Edge Cases:
    console.log('\n[4] Testing Edge Cases...');

    // Edge Case A: Same timestamp / close timestamps
    console.log('    - Subcase: Close timestamps (1s apart)...');
    const closeTs1 = baseTs + 500;
    const closeTs2 = baseTs + 501;
    await fetch(`${baseUrl}/v1/flow/readings`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': apiKey },
      body: JSON.stringify(createReading('FLOSTAT_003', closeTs1)),
    });
    await fetch(`${baseUrl}/v1/flow/readings`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': apiKey },
      body: JSON.stringify(createReading('FLOSTAT_003', closeTs2)),
    });
    const closeHist = await (await fetch(`${baseUrl}/v1/flow/history?device_id=FLOSTAT_003&start_time=${closeTs1 - 10}&end_time=${closeTs2 + 10}`)).json();
    assert.equal(closeHist.records[0].timestamp, closeTs2);
    assert.equal(closeHist.records[1].timestamp, closeTs1);
    console.log('      ✓ Close timestamps correctly ordered descending.');

    // Edge Case B: Empty rollups fallback in summary
    console.log('    - Subcase: Empty rollups fallback in /v1/flow/summary...');
    const summaryRes = await fetch(`${baseUrl}/v1/flow/summary?device_id=FLOSTAT_002&start_time=${baseTs}&end_time=${baseTs + 1000}&interval=hour`);
    const summaryBody = await summaryRes.json();
    assert.equal(summaryRes.status, 200);
    assert(summaryBody.data.total_volume_litres > 0, 'Summary should fall back to raw readings when rollups is empty array');
    console.log(`      ✓ Empty rollups correctly fell back to raw readings (total volume: ${summaryBody.data.total_volume_litres} L).`);

    // Edge Case C: Simultaneous concurrent GET requests (50 parallel requests)
    console.log('    - Subcase: 50 concurrent GET requests...');
    const concurrentRequests = Array.from({ length: 50 }, (_, idx) => 
      fetch(`${baseUrl}/v1/flow/history?device_id=FLOSTAT_002&start_time=${baseTs}&end_time=${baseTs + 1000}`)
        .then((r) => r.json())
        .then((b) => assert.equal(b.records.length, 11))
    );
    await Promise.all(concurrentRequests);
    console.log('      ✓ 50 concurrent GET requests all returned consistent results.');

    // Edge Case D: Pagination & limit behavior
    console.log('    - Subcase: Pagination limit behavior (Limit = 5)...');
    const limitRes = await fetch(`${baseUrl}/v1/flow/history?device_id=FLOSTAT_002&start_time=${baseTs}&end_time=${baseTs + 1000}&limit=5`);
    const limitBody = await limitRes.json();
    assert.equal(limitBody.records.length, 5);
    // Highest timestamp should be the very latest inserted timestamp (baseTs + 600)
    assert.equal(limitBody.records[0].timestamp, baseTs + 600);
    console.log('      ✓ Limit=5 returned the top 5 newest records with highest timestamp first.');

    // Edge Case E: Error handling (invalid device, bad timestamps)
    console.log('    - Subcase: Invalid request parameters & error responses...');
    const errRes1 = await fetch(`${baseUrl}/v1/flow/history?device_id=INVALID!!!`);
    assert.equal(errRes1.status, 400);
    const errRes2 = await fetch(`${baseUrl}/v1/flow/readings`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': apiKey },
      body: JSON.stringify({ device_id: 'FLOSTAT_001', flow_rate_lpm: 10, device_timestamp: baseTs }),
    });
    assert.equal(errRes2.status, 403);
    console.log('      ✓ Error cases (HTTP 400, 403) correctly handled with structured error responses.');

    console.log('\n=== ALL E2E VERIFICATION CHECKS PASSED SUCCESSFULLY ===');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

runE2ETests().catch((err) => {
  console.error('E2E TEST FAILURE:', err);
  process.exit(1);
});
