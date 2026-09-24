import https from 'node:https';

const API_BASE_URL = 'https://wbeuxrg5l0.execute-api.ap-south-1.amazonaws.com';

const devices = ['FLOSTAT_001', 'FLOSTAT_002', 'FLOSTAT_003', 'FLOSTAT_004', 'FLOSTAT_005'];

async function inspect() {
  for (const id of devices) {
    await new Promise((resolve) => {
      https.get(`${API_BASE_URL}/v1/flow/live?device_id=${id}`, (res) => {
        let raw = '';
        res.on('data', chunk => raw += chunk);
        res.on('end', () => {
          console.log(`LIVE ${id}:`, res.statusCode, raw);
          resolve();
        });
      });
    });
  }

  for (const id of devices) {
    await new Promise((resolve) => {
      https.get(`${API_BASE_URL}/v1/flow/history?device_id=${id}&limit=5`, (res) => {
        let raw = '';
        res.on('data', chunk => raw += chunk);
        res.on('end', () => {
          console.log(`HISTORY ${id}:`, res.statusCode, raw);
          resolve();
        });
      });
    });
  }
}

inspect();
