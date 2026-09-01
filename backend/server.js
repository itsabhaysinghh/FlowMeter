import http from 'node:http';
import { pathToFileURL } from 'node:url';
import { assertBackendConfig, getBackendConfig } from './config.js';
import { DynamoFlowRepository } from './flow-repository.js';
import { FlowService } from './flow-service.js';
import { HttpError } from './validation.js';

function sendJson(response, statusCode, body, origin) {
  response.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': origin,
    'access-control-allow-headers': 'content-type, x-api-key, cache-control, pragma',
    'access-control-allow-methods': 'GET, POST, DELETE, OPTIONS',
    'cache-control': 'no-cache, no-store, must-revalidate, proxy-revalidate',
    'pragma': 'no-cache',
    'expires': '0',
  });
  response.end(JSON.stringify(body));
}

async function readJson(request) {
  let rawBody = '';
  for await (const chunk of request) {
    rawBody += chunk;
    if (rawBody.length > 1024 * 1024) throw new HttpError(413, 'Request body exceeds 1 MB.');
  }
  try {
    return rawBody ? JSON.parse(rawBody) : {};
  } catch {
    throw new HttpError(400, 'Request body must be valid JSON.');
  }
}

function authorizeMutation(request, apiKey) {
  if (apiKey && request.headers['x-api-key'] !== apiKey) {
    throw new HttpError(401, 'Invalid API key.');
  }
}

export function createServer({ config = getBackendConfig(), repository } = {}) {
  assertBackendConfig(config);
  const flowRepository = repository || new DynamoFlowRepository(config);
  const flowService = new FlowService(flowRepository);

  return http.createServer(async (request, response) => {
    const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
    const origin = request.headers.origin || config.frontendOrigin || '*';
    try {
      if (request.method === 'OPTIONS') return sendJson(response, 204, {}, origin);
      if (request.method === 'GET' && url.pathname === '/health') return sendJson(response, 200, { success: true }, origin);
      if (request.method === 'GET' && (url.pathname === '/v1/devices' || url.pathname === '/devices')) return sendJson(response, 200, flowService.getDevices(), origin);
      if (request.method === 'GET' && (url.pathname === '/v1/flow' || url.pathname === '/flow')) return sendJson(response, 200, await flowService.getReadings(Object.fromEntries(url.searchParams)), origin);
      if (request.method === 'GET' && (url.pathname === '/v1/flow/live' || url.pathname === '/flow/live')) return sendJson(response, 200, await flowService.getLive(Object.fromEntries(url.searchParams)), origin);
      if (request.method === 'GET' && (url.pathname === '/v1/flow/history' || url.pathname === '/flow/history')) return sendJson(response, 200, await flowService.getHistory(Object.fromEntries(url.searchParams)), origin);
      if (request.method === 'GET' && (url.pathname === '/v1/flow/summary' || url.pathname === '/flow/summary')) return sendJson(response, 200, await flowService.getSummary(Object.fromEntries(url.searchParams)), origin);
      if (request.method === 'POST' && (url.pathname === '/v1/flow/readings' || url.pathname === '/flow/readings')) {
        authorizeMutation(request, config.apiKey);
        return sendJson(response, 201, { success: true, ...(await flowService.createReading(await readJson(request))) }, origin);
      }
      if ((request.method === 'DELETE' && (url.pathname === '/v1/flow/data' || url.pathname === '/flow/data')) ||
          (request.method === 'POST' && (url.pathname === '/v1/flow/data/delete' || url.pathname === '/flow/data/delete' || url.pathname === '/v1/flow/delete' || url.pathname === '/flow/delete'))) {
        const body = await readJson(request).catch(() => ({}));
        const query = Object.fromEntries(url.searchParams);
        const payload = { ...query, ...body };
        return sendJson(response, 200, await flowService.deleteReadings(payload), origin);
      }
      return sendJson(response, 404, { success: false, message: 'Route not found.' }, origin);
    } catch (error) {
      const statusCode = error instanceof HttpError ? error.statusCode : 500;
      if (statusCode === 500) console.error(error);
      return sendJson(response, statusCode, { success: false, message: error.message || 'Internal server error.' }, origin);
    }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const config = getBackendConfig();
  const server = createServer({ config });
  server.listen(config.port, '127.0.0.1', () => {
    console.log(`Flow backend listening at http://127.0.0.1:${config.port}`);
  });
}
