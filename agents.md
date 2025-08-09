# Agents: building practical weather automations with Davis

This repository provides a tiny, typed client for Davis Weatherlink. On top of it you can build "agents" — small, reliable background processes that fetch, monitor, and act on your weather data.

This guide shows patterns and copy‑pasteable examples for:
- Scheduling work and authenticating
- Reading current and historic observations
- Alerting on thresholds
- Ingesting data for long‑term storage
- Producing daily summaries
- Handling plans, retries, and idempotency


## Prerequisites
- Weatherlink API credentials: set environment variables `API_KEY` and `API_SECRET`.
- Node.js 18+.

Install the package:

```bash
npm install davis
```


## Agent skeleton
Create a small script and run it with node or tsx. This skeleton wires up the client, basic retry, and a simple schedule.

```ts
// agent.ts
import { WeatherlinkClient } from 'davis';

const client = new WeatherlinkClient({
  apiKey: process.env.API_KEY!,
  apiSecret: process.env.API_SECRET!,
  axiosConfig: { timeout: 15_000 },
});

// Replace with your station numeric id or UUID
const STATION: number | string = Number(process.env.STATION_ID ?? '') || (process.env.STATION_UUID ?? '');

async function withRetry<T>(fn: () => Promise<T>, retries = 3): Promise<T> {
  let attempt = 0; let lastErr: unknown;
  while (attempt++ < retries) {
    try { return await fn(); } catch (e) {
      lastErr = e; const backoff = 250 * attempt; await new Promise(r => setTimeout(r, backoff));
    }
  }
  throw lastErr;
}

async function tick() {
  const stations = await withRetry(() => client.getStations());
  if (!stations.length) return console.warn('No stations available');
  console.log('Stations:', stations.map(s => ({ id: s.station_id, name: s.station_name })));
}

// Run every 60s
tick().catch(console.error);
setInterval(() => { tick().catch(console.error); }, 60_000);
```

Run it:

```bash
npx tsx agent.ts
```


## Pattern 1: Alerting agent (thresholds on current conditions)
Sends an alert when a signal crosses a threshold (e.g., high wind, heavy rain). Uses `getCurrent` and `flattenCurrent`.

```ts
// alert-agent.ts
import { WeatherlinkClient, flattenCurrent } from 'davis';

const client = new WeatherlinkClient({
  apiKey: process.env.API_KEY!,
  apiSecret: process.env.API_SECRET!,
});

const STATION: number | string = Number(process.env.STATION_ID ?? '') || (process.env.STATION_UUID ?? '');
const WIND_ALERT = Number(process.env.WIND_ALERT_KPH ?? 50); // trigger at >= 50 kph by default

// ephemeral dedupe to avoid spamming (per 10 minutes)
const lastNotified: Record<string, number> = {};

async function check() {
  const current = await client.getCurrent(STATION);
  if (!current) {
    console.warn('Current endpoint unavailable (plan or permissions).');
    return;
  }
  const flat = flattenCurrent(current);
  // Example: sensor_type 512 may map to wind; adjust keys to your hardware
  const wind = Number(flat['512_wind_speed_last'] ?? flat['512_wind_speed_avg_last_1_min'] ?? 0);

  if (wind >= WIND_ALERT) {
    const bucket = Math.floor(Date.now() / 600_000); // 10-minute window
    if (lastNotified['wind'] !== bucket) {
      lastNotified['wind'] = bucket;
      await sendAlert(`High wind: ${wind.toFixed(1)} kph`);
    }
  }
}

async function sendAlert(message: string) {
  console.log('[ALERT]', new Date().toISOString(), message);
  // Hook up your transport: email, Slack, SMS, webhook, etc.
}

setInterval(() => { check().catch(console.error); }, 60_000);
check().catch(console.error);
```

Notes:
- Sensor type ids and keys depend on your hardware. Inspect `flattenCurrent(current)` to learn the available fields.
- If you only have Basic plan, `getCurrent` can return null; consider using the historic fallback shown below.


## Pattern 2: Historic fallback for Basic plan
If `getCurrent` is not available, query small historic windows and treat the most recent sample as “current”.

```ts
// basic-current.ts
import { WeatherlinkClient, flattenHistoric } from 'davis';

const client = new WeatherlinkClient({ apiKey: process.env.API_KEY!, apiSecret: process.env.API_SECRET! });
const STATION: number | string = Number(process.env.STATION_ID ?? '') || (process.env.STATION_UUID ?? '');

async function latestApproximate() {
  const end = Date.now();
  const start = end - 10 * 60 * 1000; // last 10 minutes
  const hist = await client.getHistoric(STATION, start, end);
  if (!hist) return null;
  const rows = flattenHistoric(hist);
  return rows.at(-1) ?? null;
}

latestApproximate().then(r => console.log(r)).catch(console.error);
```


## Pattern 3: Ingestion agent (append to CSV)
Continuously ingest historic data into a local CSV file. The agent tracks the last processed timestamp to resume on restart.

```ts
// ingest-csv.ts
import { WeatherlinkClient, flattenHistoric } from 'davis';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const client = new WeatherlinkClient({ apiKey: process.env.API_KEY!, apiSecret: process.env.API_SECRET! });
const STATION: number | string = Number(process.env.STATION_ID ?? '') || (process.env.STATION_UUID ?? '');
const DATA_DIR = process.env.DATA_DIR || './data';

const STATE = path.join(DATA_DIR, 'cursor.json');
const OUT = path.join(DATA_DIR, 'observations.csv');

type Row = Record<string, unknown> & { ts: number };

async function ensureDir(p: string) { await fs.mkdir(p, { recursive: true }); }

async function loadCursor(): Promise<number> {
  try { const s = JSON.parse(await fs.readFile(STATE, 'utf8')); return Number(s.ts) || 0; } catch { return 0; }
}
async function saveCursor(ts: number) { await fs.writeFile(STATE, JSON.stringify({ ts }), 'utf8'); }

async function appendCsv(rows: Row[]) {
  const header = Object.keys(rows[0]).join(',');
  const lines = rows.map(r => Object.values(r).map(v => JSON.stringify(v ?? '')).join(','));
  try { await fs.access(OUT); }
  catch { await fs.writeFile(OUT, header + '\n', 'utf8'); }
  await fs.appendFile(OUT, lines.join('\n') + '\n', 'utf8');
}

async function run() {
  await ensureDir(DATA_DIR);
  const end = Date.now();
  const start = (await loadCursor()) || (end - 60 * 60 * 1000); // default to last hour on first run

  let maxTs = start;
  for await (const chunk of client.iterateHistoric(STATION, start, end, /* windowSeconds */ 3600)) {
    const rows = flattenHistoric(chunk) as Row[];
    if (!rows.length) continue;
    await appendCsv(rows);
    maxTs = Math.max(maxTs, ...rows.map(r => r.ts * 1000));
    await saveCursor(maxTs);
  }
}

run().catch(console.error);
```

Tips:
- The CSV header is derived from the first chunk; schema can evolve as sensors change. For robust storage, use a database with a schema migration path.
- De‑duplication: `flattenHistoric` returns rows keyed by timestamp; if you resume with the same start time, you may re‑append the last partial batch. Track the last processed ts and start strictly after it.


## Pattern 4: Daily summary agent
Compute a daily report (min/max/avg) and post it to a webhook.

```ts
// daily-summary.ts
import { WeatherlinkClient, flattenHistoric } from 'davis';
import axios from 'axios';

const client = new WeatherlinkClient({ apiKey: process.env.API_KEY!, apiSecret: process.env.API_SECRET! });
const STATION: number | string = Number(process.env.STATION_ID ?? '') || (process.env.STATION_UUID ?? '');
const HOOK = process.env.WEBHOOK_URL!;

type Row = Record<string, unknown> & { ts: number };

function stats(values: number[]) {
  const v = values.filter(Number.isFinite) as number[];
  if (!v.length) return { min: null, max: null, avg: null };
  const min = Math.min(...v), max = Math.max(...v), avg = v.reduce((a, b) => a + b, 0) / v.length;
  return { min, max, avg: Number(avg.toFixed(2)) };
}

async function run() {
  const now = new Date();
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0));
  const start = new Date(end.getTime() - 24 * 3600 * 1000);
  const hist = await client.getHistoric(STATION, start, end);
  if (!hist) return;
  const rows = flattenHistoric(hist) as Row[];

  // Heuristics: pick the first key that exists across rows for each metric
  function pickKey(candidates: string[]): string | null {
    for (const k of candidates) {
      if (rows.some(r => Number.isFinite(Number(r[k])))) return k;
    }
    return null;
  }

  const tempKey = pickKey([
    // Common outdoor temperature keys (adjust to your hardware)
    '45_temp_avg', '45_temp_out', '45_temp', 'temp_out', 'temperature',
  ]);
  const windKey = pickKey([
    // Common wind speed keys
    '512_wind_speed_avg_last_10_min', '512_wind_speed_last', 'wind_speed',
  ]);
  const rainIncrementKey = pickKey([
    // Per-archive rain increment (mm)
    '45_rainfall_mm', '45_rainfall', 'rainfall_mm', 'rain',
  ]);
  const rainDailyKey = pickKey([
    // Rolling daily total if available (mm)
    '45_rainfall_daily', 'rainfall_daily',
  ]);

  const temps = tempKey ? rows.map(r => Number(r[tempKey])) : [];
  const winds = windKey ? rows.map(r => Number(r[windKey])) : [];

  // Daily rain total: prefer rolling daily, otherwise sum increments
  let rainTotal = 0;
  if (rainDailyKey) {
    const vals = rows.map(r => Number(r[rainDailyKey!])).filter(Number.isFinite) as number[];
    if (vals.length) rainTotal = Math.max(...vals) - Math.min(...vals);
  } else if (rainIncrementKey) {
    const vals = rows.map(r => Number(r[rainIncrementKey!])).filter(Number.isFinite) as number[];
    rainTotal = vals.reduce((a, b) => a + b, 0);
  }

  const summary = {
    date: new Date(start).toISOString().slice(0, 10),
    temperature_c: stats(temps),
    wind_kph: stats(winds),
    rain_mm: Number(rainTotal.toFixed(2)),
    samples: rows.length,
    keys: { tempKey, windKey, rainIncrementKey, rainDailyKey },
  };

  await axios.post(HOOK, summary);
}

run().catch(console.error);
```

Notes:
- Keys differ across devices and firmware. Log Object.keys(rows[0]) or inspect a few rows to decide which candidates to use for your station.
- The webhook can be any HTTP endpoint you control (e.g., a serverless function). Many chat tools accept JSON webhooks.
- Consider running this once a day shortly after midnight local time via your scheduler of choice.


## Operational tips: plans, retries, idempotency

- Plans and endpoints
  - Basic plan: /current and /historic may be limited. In this repo, getCurrent can return null on 403; use the historic fallback pattern to approximate “current”.
  - Pro/Pro+: /historic is available and supports windowed iteration via iterateHistoric.
- Retries and rate limits
  - Wrap network calls with simple retry and backoff (see Agent skeleton). Keep timeouts reasonable (10–15s) and plan for occasional 5xx from the API.
- Idempotency
  - When exporting or alerting, make actions idempotent. For example, track the last processed timestamp in a small state file (see Ingestion agent) and resume strictly after it.
  - For alerting, bucket notifications in time windows to avoid spamming when a threshold remains breached.
- Scheduling
  - For simple setups, use setInterval in a long‑running Node process. In production, prefer a system scheduler (cron, systemd timers, container orchestrators) to control cadence and restarts.
- Observability
  - Log successes and failures with timestamps. Consider emitting metrics (counts, latencies) and wiring alerts for persistent failures.


That’s it — with these patterns you can stitch together reliable, low‑maintenance automations on top of Davis Weatherlink.
