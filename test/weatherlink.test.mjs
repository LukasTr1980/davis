import test from 'node:test';
import assert from 'node:assert/strict';

import { WeatherlinkClient } from '../dist/index.js';

function makeFakeAxios(handlers = {}) {
  const calls = [];
  const get = async (url, config = {}) => {
    calls.push({ url, config });
    const handler = handlers[url];
    if (!handler) throw new Error(`No handler for ${url}`);
    const res = await handler(config);
    if (res && res.throw) throw res.throw;
    return { data: res.data };
  };
  return {
    get,
    __calls: calls,
  };
}

function axiosError(status) {
  return { isAxiosError: true, response: { status } };
}

const baseConfig = { apiKey: 'k', apiSecret: 's' };

test('getStations returns stations', async () => {
  const fake = makeFakeAxios({
    '/stations': async () => ({ data: { stations: [{ station_id: 1, station_id_uuid: 'u1', station_name: 'A', latitude: 0, longitude: 0, elevation: 0, time_zone: 'UTC', subscription_type: 'Basic' }] } }),
  });
  const client = new WeatherlinkClient({ ...baseConfig, axiosInstance: fake });
  const stations = await client.getStations();
  assert.equal(stations.length, 1);
  assert.equal(stations[0].station_id_uuid, 'u1');
});

test('getCurrent resolves numeric station id to UUID via stations and returns data', async () => {
  const currentPayload = { station_id_uuid: 'u1', station_id: 1, generated_at: 170, sensors: [] };
  const fake = makeFakeAxios({
    '/stations': async () => ({ data: { stations: [{ station_id: 1, station_id_uuid: 'u1', station_name: 'A', latitude: 0, longitude: 0, elevation: 0, time_zone: 'UTC', subscription_type: 'Basic' }] } }),
    '/current/u1': async () => ({ data: currentPayload }),
  });
  const client = new WeatherlinkClient({ ...baseConfig, axiosInstance: fake });
  const res = await client.getCurrent(1);
  assert.deepEqual(res, currentPayload);
});

test('getCurrent returns null on 403 (Basic plan)', async () => {
  const fake = makeFakeAxios({
    '/stations': async () => ({ data: { stations: [{ station_id: 1, station_id_uuid: 'u1', station_name: 'A', latitude: 0, longitude: 0, elevation: 0, time_zone: 'UTC', subscription_type: 'Basic' }] } }),
    '/current/u1': async () => ({ throw: axiosError(403) }),
  });
  const client = new WeatherlinkClient({ ...baseConfig, axiosInstance: fake });
  const res = await client.getCurrent(1);
  assert.equal(res, null);
});

test('getHistoric converts Date/ms to seconds and passes params', async () => {
  let captured;
  const fake = makeFakeAxios({
    '/historic/u1': async (config) => {
      captured = config.params;
      const payload = { station_id_uuid: 'u1', station_id: 1, generated_at: 170, sensors: [] };
      return { data: payload };
    },
  });
  const client = new WeatherlinkClient({ ...baseConfig, axiosInstance: fake });
  // monkeypatch getStations used to resolve UUID
  client.getStations = async () => [{ station_id: 1, station_id_uuid: 'u1', station_name: 'A', latitude: 0, longitude: 0, elevation: 0, time_zone: 'UTC', subscription_type: 'Pro' }];

  const startDate = new Date(1700000000000); // ms
  const endDate = new Date(1700000060000);
  const res = await client.getHistoric(1, startDate, endDate);
  assert.equal(res.station_id, 1);
  assert.equal(captured['start-timestamp'], Math.floor(startDate.getTime() / 1000));
  assert.equal(captured['end-timestamp'], Math.floor(endDate.getTime() / 1000));
});

test('getHistoric returns null on 403', async () => {
  const fake = makeFakeAxios({
    '/historic/u1': async () => ({ throw: axiosError(403) }),
  });
  const client = new WeatherlinkClient({ ...baseConfig, axiosInstance: fake });
  client.getStations = async () => [{ station_id: 1, station_id_uuid: 'u1', station_name: 'A', latitude: 0, longitude: 0, elevation: 0, time_zone: 'UTC', subscription_type: 'Pro' }];
  const res = await client.getHistoric(1, 1700000000000, 1700000060000);
  assert.equal(res, null);
});

async function collect(gen) {
  const out = [];
  for await (const v of gen) out.push(v);
  return out;
}

test('iterateHistoric windows correctly and yields chunks', async () => {
  const client = new WeatherlinkClient({ ...baseConfig, axiosInstance: makeFakeAxios({}) });
  const calls = [];
  const payload = (i) => ({ station_id_uuid: 'u1', station_id: 1, generated_at: 170 + i, sensors: [] });
  client.getHistoric = async (_, start, end) => {
    calls.push([start, end]);
    return payload(calls.length);
  };

  const start = 1700000000; // seconds
  const end = 1700000300; // seconds
  const chunks = await collect(client.iterateHistoric('u1', start, end, 120));
  assert.equal(chunks.length, 3);
  assert.deepEqual(calls, [
    [start, start + 120],
    [start + 120, start + 240],
    [start + 240, end],
  ]);
});

