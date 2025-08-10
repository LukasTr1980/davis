import './loadEnv.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import process from 'node:process';
import console from 'node:console';

import { WeatherlinkClient, flattenHistoric, flattenCurrent } from '../dist/index.js';

const RUN = process.env.RUN_INTEGRATION === '1';

const apiKey = process.env.API_KEY;
const apiSecret = process.env.API_SECRET;

test('integration: environment present', { skip: !RUN }, () => {
  assert.ok(apiKey && apiSecret, 'API_KEY and API_SECRET must be set');
});

test('integration: stations listing', { skip: !RUN }, async () => {
  const client = new WeatherlinkClient({ apiKey, apiSecret, axiosConfig: { timeout: 15000 } });
  const stations = await client.getStations();
  assert.ok(Array.isArray(stations));
  assert.ok(stations.length >= 1, 'expected at least one station');
  const s = stations[0];
  assert.ok(typeof s.station_id === 'number');
  assert.ok(typeof s.station_id_uuid === 'string');
  console.log('Stations:', stations.map(x => ({ id: x.station_id, uuid: x.station_id_uuid, name: x.station_name, plan: x.subscription_type })));
});

test('integration: current endpoint (may be null on Basic)', { skip: !RUN }, async () => {
  const client = new WeatherlinkClient({ apiKey, apiSecret, axiosConfig: { timeout: 15000 } });
  const stations = await client.getStations();
  const hinted = Number(process.env.STATION_ID ?? '') || (process.env.STATION_UUID ?? '') || stations[0].station_id;
  const res = await client.getCurrent(hinted);
  if (res === null) {
    assert.equal(res, null);
    console.log('Current: not available for this plan or station');
  } else {
    assert.equal(typeof res.station_id, 'number');
    assert.equal(typeof res.station_id_uuid, 'string');
    assert.ok(Array.isArray(res.sensors));
    const flat = flattenCurrent(res);
    const keys = Object.keys(flat).filter(k => k !== 'station_id' && k !== 'station_uuid' && k !== 'generatedAt');
    console.log('Current summary:', { station_id: res.station_id, generated_at: res.generated_at, keys: keys.slice(0, 8), totalKeys: keys.length });
  }
});

test('integration: historic endpoint for a small window (may be null without Pro)', { skip: !RUN }, async () => {
  const client = new WeatherlinkClient({ apiKey, apiSecret, axiosConfig: { timeout: 15000 } });
  const stations = await client.getStations();
  const hinted = Number(process.env.STATION_ID ?? '') || (process.env.STATION_UUID ?? '') || stations[0].station_id;
  const end = Date.now();
  const start = end - 10 * 60 * 1000;
  const res = await client.getHistoric(hinted, start, end);
  if (res === null) {
    assert.equal(res, null);
    console.log('Historic: not available for this plan or station');
  } else {
    assert.equal(typeof res.station_id, 'number');
    const rows = flattenHistoric(res);
    assert.ok(Array.isArray(rows));
    if (rows.length > 0) {
      for (let i = 1; i < rows.length; i++) {
        assert.ok(rows[i].ts >= rows[i - 1].ts);
      }
      const keys = Object.keys(rows[0]).filter(k => k !== 'ts' && k !== 'station_id' && k !== 'station_uuid');
      console.log('Historic summary:', { samples: rows.length, firstTs: rows[0].ts, lastTs: rows[rows.length - 1].ts, keys: keys.slice(0, 8), totalKeys: keys.length });
    } else {
      console.log('Historic summary: no samples in window');
    }
  }
});

test('integration: iterateHistoric completes over a short range', { skip: !RUN }, async () => {
  const client = new WeatherlinkClient({ apiKey, apiSecret, axiosConfig: { timeout: 15000 } });
  const stations = await client.getStations();
  const hinted = Number(process.env.STATION_ID ?? '') || (process.env.STATION_UUID ?? '') || stations[0].station_id;
  const end = Date.now();
  const start = end - 15 * 60 * 1000;
  const chunks = [];
  for await (const chunk of client.iterateHistoric(hinted, start, end, 5 * 60)) {
    chunks.push(chunk);
  }
  assert.ok(chunks.length >= 0);
  console.log('iterateHistoric summary:', { chunks: chunks.length });
});

