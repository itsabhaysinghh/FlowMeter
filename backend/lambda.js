import { getBackendConfig } from './config.js';
import { DynamoFlowRepository } from './flow-repository.js';
import { FlowService } from './flow-service.js';
import { HttpError } from './validation.js';

let serviceInstance = null;

function getService() {
  if (!serviceInstance) {
    const config = getBackendConfig();
    const repository = new DynamoFlowRepository(config);
    serviceInstance = new FlowService(repository);
  }
  return serviceInstance;
}

export async function handler(event) {
  const service = getService();
  const path = event.rawPath || event.path || '/';
  const httpMethod = event.requestContext?.http?.method || event.httpMethod || 'GET';
  const query = event.queryStringParameters || {};
  const origin = event.headers?.origin || '*';

  const headers = {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': origin,
    'access-control-allow-headers': 'content-type, x-api-key',
    'access-control-allow-methods': 'GET, POST, DELETE, OPTIONS',
  };

  if (httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  try {
    let body = {};
    if (event.body) {
      body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
    }

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
      return { statusCode: 201, headers, body: JSON.stringify({ success: true, ...readingResult }) };
    } else if (httpMethod === 'DELETE' && (path === '/v1/flow/data' || path === '/flow/data')) {
      result = await service.deleteReadings(body);
    } else {
      return { statusCode: 404, headers, body: JSON.stringify({ success: false, message: 'Route not found.' }) };
    }

    return { statusCode: 200, headers, body: JSON.stringify(result) };
  } catch (error) {
    const statusCode = error instanceof HttpError ? error.statusCode : 500;
    if (statusCode === 500) console.error(error);
    return {
      statusCode,
      headers,
      body: JSON.stringify({ success: false, message: error.message || 'Internal server error.' }),
    };
  }
}
