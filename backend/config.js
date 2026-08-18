export const SIMULATED_DEVICES = Object.freeze([
  'FLOSTAT_002',
  'FLOSTAT_003',
  'FLOSTAT_004',
  'FLOSTAT_005',
]);

export const PROTECTED_DEVICE = 'FLOSTAT_001';

export function getBackendConfig(environment = process.env) {
  return {
    port: Number(environment.PORT || 3001),
    awsRegion: environment.AWS_REGION || 'ap-south-1',
    readingsTableName: environment.FLOW_READINGS_TABLE || '',
    rollupsTableName: environment.FLOW_ROLLUPS_TABLE || '',
    apiKey: environment.API_KEY || '',
    frontendOrigin: environment.FRONTEND_ORIGIN || 'http://127.0.0.1:5173',
  };
}

export function assertBackendConfig(config) {
  if (!config.readingsTableName) {
    throw new Error('FLOW_READINGS_TABLE is required. The backend will not start without a DynamoDB readings table.');
  }
  if (!Number.isInteger(config.port) || config.port <= 0 || config.port > 65535) {
    throw new Error('PORT must be a valid TCP port.');
  }
}
