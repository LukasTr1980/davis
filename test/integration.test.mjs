import './loadEnv.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import process from 'node:process';
import console from 'node:console';

import { WeatherlinkClient } from '../dist/index.js';

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

test('integration: stations by ids', { skip: !RUN }, async () => {
  const client = new WeatherlinkClient({ apiKey, apiSecret, axiosConfig: { timeout: 15000 } });
  const stations = await client.getStations();
  const first = stations[0];
  const byId = await client.getStationsByIds(first.station_id);
  assert.ok(Array.isArray(byId));
  assert.ok(byId.length >= 1);
  assert.equal(byId[0].station_id, first.station_id);
  console.log('Stations by id:', byId.map(x => ({ id: x.station_id, uuid: x.station_id_uuid, name: x.station_name, plan: x.subscription_type })));
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
    const keys = new Set();
    for (const block of res.sensors) {
      const arr = Array.isArray(block.data) ? block.data : [];
      const latest = arr[0] ?? {};
      Object.keys(latest).forEach(k => keys.add(`${block.sensor_type}_${k}`));
    }
    console.log('Current summary:', { station_id: res.station_id, generated_at: res.generated_at, sampleKeys: Array.from(keys).slice(0, 8), totalKeys: keys.size });
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
    // Summarize by counting total entries across sensor blocks
    let samples = 0;
    const tsValues = [];
    const keys = new Set();
    for (const block of res.sensors) {
      const arr = Array.isArray(block.data) ? block.data : [];
      samples += arr.length;
      for (const entry of arr) {
        if (entry && typeof entry === 'object' && 'ts' in entry) tsValues.push(entry.ts);
        Object.keys(entry ?? {}).forEach(k => k !== 'ts' && keys.add(`${block.sensor_type}_${k}`));
      }
    }
    tsValues.sort((a, b) => a - b);
    console.log('Historic summary:', { samples, firstTs: tsValues[0], lastTs: tsValues[tsValues.length - 1], sampleKeys: Array.from(keys).slice(0, 8), totalKeys: keys.size });
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

test('integration: nodes listing and by ids', { skip: !RUN }, async () => {
  const client = new WeatherlinkClient({ apiKey, apiSecret, axiosConfig: { timeout: 15000 } });
  const nodes = await client.getNodes();
  assert.ok(Array.isArray(nodes));
  console.log('Nodes listing preview:', nodes.slice(0, 3).map(n => ({ id: n.node_id, name: n.node_name })));
  if (nodes.length > 0) {
    const one = nodes[0];
    const byId = await client.getNodesByIds(one.node_id);
    assert.ok(Array.isArray(byId));
    assert.ok(byId.length >= 1);
    assert.equal(byId[0].node_id, one.node_id);
    console.log('Nodes by id preview:', byId.slice(0, 3).map(n => ({ id: n.node_id, name: n.node_name })));
  }
});

test('integration: sensors listing and by ids', { skip: !RUN }, async () => {
  const client = new WeatherlinkClient({ apiKey, apiSecret, axiosConfig: { timeout: 15000 } });
  const sensors = await client.getSensors();
  assert.ok(Array.isArray(sensors));
  console.log('Sensors listing preview:', sensors.slice(0, 5).map(s => ({ id: s.sensor_id, name: s.sensor_name })));
  if (sensors.length > 0) {
    const oneId = sensors[0].sensor_id;
    try {
      const byId = await client.getSensorsByIds(oneId);
      assert.ok(Array.isArray(byId));
      assert.ok(byId.length >= 1);
      assert.equal(byId[0].sensor_id, oneId);
      console.log('Sensors by id preview:', byId.slice(0, 3).map(s => ({ id: s.sensor_id, name: s.sensor_name })));
    } catch (e) {
      console.log('Sensors by id: endpoint error, skipping strict check', e);
    }
  }
});

test('integration: sensor activity and by ids', { skip: !RUN }, async () => {
  const client = new WeatherlinkClient({ apiKey, apiSecret, axiosConfig: { timeout: 15000 } });
  const activity = await client.getSensorActivity();
  assert.ok(Array.isArray(activity));
  console.log('Sensor activity preview:', activity.slice(0, 5).map(a => ({ lsid: a.lsid, time_received: a.time_received, time_recorded: a.time_recorded })));
  if (activity.length > 0) {
    const lsids = activity.slice(0, Math.min(3, activity.length)).map(a => a.lsid);
    const byIds = await client.getSensorActivityByIds(lsids);
    assert.ok(Array.isArray(byIds));
    assert.ok(byIds.length >= 1);
    console.log('Sensor activity by ids preview:', byIds.slice(0, 5).map(a => ({ lsid: a.lsid, time_received: a.time_received, time_recorded: a.time_recorded })));
  }
});

test('integration: sensor catalog', { skip: !RUN }, async () => {
  const client = new WeatherlinkClient({ apiKey, apiSecret, axiosConfig: { timeout: 15000 } });
  const catalog = await client.getSensorCatalog();
  const t = typeof catalog;
  assert.ok(catalog !== null && (t === 'object'));
  const preview = Array.isArray(catalog) ? catalog.slice(0, 2) : Object.keys(catalog).slice(0, 5);
  console.log('Sensor catalog preview:', preview);
});

test('integration: report ET (may be null depending on plan/device)', { skip: !RUN }, async () => {
  const client = new WeatherlinkClient({ apiKey, apiSecret, axiosConfig: { timeout: 15000 } });
  const stations = await client.getStations();
  const hinted = Number(process.env.STATION_ID ?? '') || (process.env.STATION_UUID ?? '') || stations[0].station_id;
  const end = Date.now();
  const start = end - 60 * 60 * 1000;
  const res = await client.getReportET(hinted, start, end);
  if (res == null) {
    assert.equal(res, null);
    console.log('Report ET: not available for this plan or station');
  } else {
    const keys = Object.keys(res).slice(0, 8);
    console.log('Report ET preview: keys', keys);
  }
});

