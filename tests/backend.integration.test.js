import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from '../backend/server.js';
import { createReading, generateFlowRate } from '../simulator/flow-meter-simulator.js';

class MemoryFlowRepository {
  constructor() {
    this.records = [];
  }

  async putReading(reading) {
    const exists = this.records.some((record) => record.device_id === reading.device_id && record.timestamp === reading.device_timestamp);
    if (exists) return { inserted: false };
    this.records.push({ ...reading, timestamp: reading.device_timestamp });
    return { inserted: true };
  }

  async getLatest(deviceId) {
    return this.records.filter((record) => record.device_id === deviceId).sort((left, right) => right.timestamp - left.timestamp)[0] || null;
  }

  async getReadingsPage({ deviceId, startTime, endTime, limit }) {
    return { records: this.records.filter((record) => record.device_id === deviceId && record.timestamp >= startTime && record.timestamp <= endTime).sort((left, right) => left.timestamp - right.timestamp).slice(0, limit) };
  }

  async forEachReading(range, onPage) {
    const page = await this.getReadingsPage({ ...range, limit: 1000 });
    await onPage(page.records);
  }

  async getRollups() {
    return null;
  }

  async deleteRange({ deviceId, startTime, endTime }) {
    const before = this.records.length;
    this.records = this.records.filter((record) => record.device_id !== deviceId || record.timestamp < startTime || record.timestamp > endTime);
    return before - this.records.length;
  }
}

test('simulated device pipeline stores, fetches, summarizes, and deletes FLOSTAT_002, 003, 004, 005', async () => {
  const repository = new MemoryFlowRepository();
  const apiKey = 'test-api-key';
  const server = createServer({
    config: { port: 3001, readingsTableName: 'test-readings', rollupsTableName: '', awsRegion: 'ap-south-1', apiKey, frontendOrigin: 'http://127.0.0.1:5173' },
    repository,
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;
  const timestamp = Math.floor(Date.now() / 60000) * 60;
  const devices = ['FLOSTAT_002', 'FLOSTAT_003', 'FLOSTAT_004', 'FLOSTAT_005'];

  try {
    for (const deviceId of devices) {
      const reading = createReading(deviceId, timestamp, timestamp + 1);
      const postResponse = await fetch(`${baseUrl}/v1/flow/readings`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': apiKey },
        body: JSON.stringify(reading),
      });
      assert.equal(postResponse.status, 201);
      assert.equal((await postResponse.json()).inserted, true);

      // Verify route aliases work for both /flow and /v1/flow
      const range = `device_id=${deviceId}&start_time=${timestamp}&end_time=${timestamp}`;
      const getResponse = await fetch(`${baseUrl}/flow?${range}`);
      const getBody = await getResponse.json();
      assert.equal(getResponse.status, 200);
      assert.equal(getBody.records.length, 1);
      assert.equal(getBody.records[0].device_id, deviceId);
      assert.equal(getBody.records[0].flow_rate_lpm, reading.flow_rate_lpm);

      const liveResponse = await fetch(`${baseUrl}/flow/live?device_id=${deviceId}`);
      const liveBody = await liveResponse.json();
      assert.equal(liveResponse.status, 200);
      assert.equal(liveBody.data.device_id, deviceId);

      const summaryResponse = await fetch(`${baseUrl}/flow/summary?${range}&interval=hour`);
      const summaryBody = await summaryResponse.json();
      assert.equal(summaryResponse.status, 200);
      assert.equal(summaryBody.data.total_volume_litres, reading.flow_rate_lpm);

      const historyResponse = await fetch(`${baseUrl}/flow/history?${range}`);
      const historyBody = await historyResponse.json();
      assert.equal(historyResponse.status, 200);
      assert.equal(historyBody.records.length, 1);

      const deleteResponse = await fetch(`${baseUrl}/flow/data`, {
        method: 'DELETE',
        headers: { 'content-type': 'application/json', 'x-api-key': apiKey },
        body: JSON.stringify({ device_id: deviceId, start_time: timestamp, end_time: timestamp }),
      });
      assert.equal(deleteResponse.status, 200);
      assert.equal((await deleteResponse.json()).deleted_count, 1);
      assert.equal((await (await fetch(`${baseUrl}/flow?${range}`)).json()).records.length, 0);
    }
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test('FLOSTAT_001 is protected from simulation, POST ingress, and DELETE APIs', async () => {
  assert.throws(() => generateFlowRate('FLOSTAT_001', Math.floor(Date.now() / 1000)), /Protected or invalid device/);

  const repository = new MemoryFlowRepository();
  const server = createServer({
    config: { port: 3001, readingsTableName: 'test-readings', rollupsTableName: '', awsRegion: 'ap-south-1', apiKey: 'test-key', frontendOrigin: 'http://127.0.0.1:5173' },
    repository,
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    const postResponse = await fetch(`${baseUrl}/v1/flow/readings`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': 'test-key' },
      body: JSON.stringify({ device_id: 'FLOSTAT_001', flow_rate_lpm: 15, device_timestamp: 1752870000 }),
    });
    assert.equal(postResponse.status, 403);

    const deleteResponse = await fetch(`${baseUrl}/v1/flow/data`, {
      method: 'DELETE',
      headers: { 'content-type': 'application/json', 'x-api-key': 'test-key' },
      body: JSON.stringify({ device_id: 'FLOSTAT_001', start_time: 1752870000, end_time: 1752870060 }),
    });
    assert.equal(deleteResponse.status, 403);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

