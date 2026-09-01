import { getBackendConfig } from './config.js';
import { DynamoFlowRepository } from './flow-repository.js';
import { FlowService } from './flow-service.js';
import { HttpError } from './validation.js';

let serviceInstance = null;
let currentConfig = null;

function getService() {
  if (!serviceInstance) {
    currentConfig = getBackendConfig();
    const repository = new DynamoFlowRepository(currentConfig);
    serviceInstance = new FlowService(repository);
  }
  return { service: serviceInstance, config: currentConfig };
}

function extractRecordDetails(result) {
  if (!result) return [];
  if (Array.isArray(result.records)) {
    return result.records.slice(0, 10).map((r) => ({ id: r.id || r.device_id, timestamp: r.timestamp }));
  }
  if (Array.isArray(result.devices)) {
    return result.devices.map((d) => ({ id: d.device_id }));
  }
  if (result.data && typeof result.data === 'object') {
    return [{ id: result.data.device_id || result.data.id, timestamp: result.data.timestamp }];
  }
  return [];
}

function countRecords(result) {
  if (!result) return 0;
  if (Array.isArray(result.records)) return result.records.length;
  if (Array.isArray(result.devices)) return result.devices.length;
  if (result.data) return 1;
  if (result.deleted_count !== undefined) return result.deleted_count;
  return 0;
}

export async function handler(event, context = {}) {
  const startTime = Date.now();
  const { service, config } = getService();
  const path = event.rawPath || event.path || '/';
  const httpMethod = event.requestContext?.http?.method || event.httpMethod || 'GET';
  const query = event.queryStringParameters || {};
  const reqHeaders = event.headers || {};
  const origin = reqHeaders.origin || reqHeaders.Origin || '*';

  const requestId = event.requestContext?.requestId || reqHeaders['x-amzn-trace-id'] || `req-${Math.random().toString(36).substring(2, 9)}`;
  const invocationId = context.awsRequestId || `inv-${Date.now()}`;

  // Standard web security headers & strict Cache-Control to prevent stale GET responses
  const headers = {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': origin,
    'access-control-allow-headers': 'content-type, x-api-key, cache-control, pragma',
    'access-control-allow-methods': 'GET, POST, DELETE, OPTIONS',
    'cache-control': 'no-cache, no-store, must-revalidate, proxy-revalidate',
    'pragma': 'no-cache',
    'expires': '0',
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'DENY',
    'strict-transport-security': 'max-age=31536000; includeSubDomains',
    'x-xss-protection': '1; mode=block',
    'referrer-policy': 'no-referrer',
  };

  if (httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  let body = {};
  if (event.body) {
    body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
  }

  let targetTable = config?.readingsTableName || 'DynamoDB_Readings';
  if (path.includes('summary')) {
    targetTable = `${config?.readingsTableName || 'DynamoDB_Readings'} + ${config?.rollupsTableName || 'DynamoDB_Rollups'}`;
  }

  try {
    let result;
    if (httpMethod === 'GET' && path === '/health') {
      result = { success: true };
    } else if (httpMethod === 'GET' && (path === '/v1/devices' || path === '/devices')) {
      result = service.getDevices();
    } else if (httpMethod === 'GET' && (path === '/v1/flow' || path === '/flow')) {
      result = await service.getReadings(query);
    } else if (httpMethod === 'GET' && (path === '/v1/flow/live' || path === '/flow/live')) {
      result = await service.getLive(query);
    } else if (httpMethod === 'GET' && (path === '/v1/flow/history' || path === '/flow/history')) {
      result = await service.getHistory(query);
    } else if (httpMethod === 'GET' && (path === '/v1/flow/summary' || path === '/flow/summary')) {
      result = await service.getSummary(query);
    } else if (httpMethod === 'POST' && (path === '/v1/flow/readings' || path === '/flow/readings')) {
      const readingResult = await service.createReading(body);
      result = { success: true, ...readingResult };
      console.log(JSON.stringify({
        type: 'LAMBDA_TRACE',
        requestId,
        invocationId,
        timestamp: new Date().toISOString(),
        endpoint: `${httpMethod} ${path}`,
        params: { ...query, ...body },
        databaseTable: targetTable,
        recordsReturned: 1,
        recordDetails: extractRecordDetails(result),
        durationMs: Date.now() - startTime,
      }));
      return { statusCode: 201, headers, body: JSON.stringify(result) };
    } else if ((httpMethod === 'DELETE' && (path === '/v1/flow/data' || path === '/flow/data')) ||
               (httpMethod === 'POST' && (path === '/v1/flow/data/delete' || path === '/flow/data/delete' || path === '/v1/flow/delete' || path === '/flow/delete'))) {
      result = await service.deleteReadings({ ...query, ...body });
    } else {
      return { statusCode: 404, headers, body: JSON.stringify({ success: false, message: 'Route not found.' }) };
    }

    console.log(JSON.stringify({
      type: 'LAMBDA_TRACE',
      requestId,
      invocationId,
      timestamp: new Date().toISOString(),
      endpoint: `${httpMethod} ${path}`,
      params: { ...query, ...body },
      databaseTable: targetTable,
      recordsReturned: countRecords(result),
      recordDetails: extractRecordDetails(result),
      durationMs: Date.now() - startTime,
    }));

    return { statusCode: 200, headers, body: JSON.stringify(result) };
  } catch (error) {
    const statusCode = error instanceof HttpError ? error.statusCode : 500;
    if (statusCode === 500) console.error(error);
    console.log(JSON.stringify({
      type: 'LAMBDA_TRACE_ERROR',
      requestId,
      invocationId,
      timestamp: new Date().toISOString(),
      endpoint: `${httpMethod} ${path}`,
      params: { ...query, ...body },
      databaseTable: targetTable,
      error: error.message,
      durationMs: Date.now() - startTime,
    }));
    return {
      statusCode,
      headers,
      body: JSON.stringify({ success: false, message: error.message || 'Internal server error.' }),
    };
  }
}

