# Flostat backend and simulator

## Data path

```text
Node simulator / ESP device -> Node backend -> DynamoDB -> Node backend API -> Flostat frontend
```

The simulator has an explicit whitelist for `FLOSTAT_002` through `FLOSTAT_005`. It rejects `FLOSTAT_001`; the backend also rejects simulator-ingress writes and development deletes for that production device.

## DynamoDB schema

`FLOW_READINGS_TABLE` must use `device_id` (String) as its partition key and `timestamp` (Number, Unix seconds) as its sort key. The backend uses DynamoDB `Query` with this key pair for every normal range read—never `Scan`.

For fast multi-month and multi-year dashboard summaries, create `FLOW_ROLLUPS_TABLE` with `device_bucket` (String) as its partition key and `bucket_start` (Number, Unix seconds) as its sort key. The backend maintains hourly, daily, and monthly rollups after each accepted reading. Leave it unset only for small development datasets; the backend will then stream-query and aggregate raw records server-side without sending them all to the browser.

## Local setup

1. Copy `.env.backend.example` to a private environment file and supply the DynamoDB table names, AWS credentials/profile, and a long `API_KEY`.
2. Set `VITE_API_BASE_URL=http://127.0.0.1:3001` in a private frontend `.env` when using the local backend. Do not change the production URL unless the local backend is configured to use the same approved data source.
3. Start the services in separate terminals:

```powershell
npm run backend
npm run dev
```

4. Send one safe simulated minute (all four non-production devices):

```powershell
$env:API_URL = 'http://127.0.0.1:3001/v1/flow/readings'
$env:API_KEY = 'your-api-key'
npm run simulator -- --once
```

Historical data is deliberately an explicit command and requires one whitelisted device:

```powershell
npm run simulator -- --historical --device FLOSTAT_002 --start 2026-08-01 --end 2026-08-10
```

The simulator posts `{ device_id, flow_rate_lpm, device_timestamp, received_at }`; it never accesses DynamoDB directly. The backend accepts the POST at `/v1/flow/readings`, exposes range reads at `/v1/flow`, and supplies the dashboard endpoints `/v1/flow/live`, `/v1/flow/history`, and `/v1/flow/summary`. Its DELETE endpoint is `/v1/flow/data` and requires a device plus inclusive `start_time` and `end_time` in Unix seconds.

`API_KEY` protects simulator ingress. In production, place the DELETE route behind the existing API Gateway/JWT authorizer so browser users are authenticated without placing an AWS credential or service API key in the frontend bundle.
