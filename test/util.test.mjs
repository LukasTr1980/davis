import test from 'node:test';
import assert from 'node:assert/strict';

import { flattenCurrent, flattenHistoric } from '../dist/index.js';

test('flattenCurrent picks latest entry of each sensor block and prefixes keys with sensor_type', () => {
  const payload = {
    station_id_uuid: 'uuid-1',
    station_id: 123,
    generated_at: 1700000000,
    sensors: [
      {
        lsid: 1,
        sensor_type: 512,
        data_structure_type: 1,
        data: [
          { ts: 1700000000, wind_speed_last: 12.3, wind_speed_avg_last_1_min: 10.5 },
          { ts: 1699999900, wind_speed_last: 8.1 },
        ],
      },
      {
        lsid: 2,
        sensor_type: 45,
        data_structure_type: 1,
        data: [
          { ts: 1700000000, temp_avg: 21.2 },
        ],
      },
    ],
  };

  const flat = flattenCurrent(payload);
  assert.equal(flat.station_id, 123);
  assert.equal(flat.station_uuid, 'uuid-1');
  assert.equal(flat.generatedAt, 1700000000);
  assert.equal(flat['512_wind_speed_last'], 12.3);
  assert.equal(flat['512_wind_speed_avg_last_1_min'], 10.5);
  assert.equal(flat['45_temp_avg'], 21.2);
});

test('flattenHistoric merges rows by ts across sensor blocks and sorts ascending', () => {
  const payload = {
    station_id_uuid: 'uuid-1',
    station_id: 123,
    generated_at: 1700000010,
    sensors: [
      {
        lsid: 1,
        sensor_type: 512,
        data_structure_type: 1,
        data: [
          { ts: 1700000000, wind_speed_last: 12 },
          { ts: 1700000060, wind_speed_last: 14 },
        ],
      },
      {
        lsid: 2,
        sensor_type: 45,
        data_structure_type: 1,
        data: [
          { ts: 1700000000, temp_avg: 21 },
          { ts: 1700000120, temp_avg: 22 },
        ],
      },
    ],
  };

  const rows = flattenHistoric(payload);
  assert.equal(rows.length, 3);
  assert.deepEqual(rows.map(r => r.ts), [1700000000, 1700000060, 1700000120]);
  const first = rows[0];
  assert.equal(first.station_id, 123);
  assert.equal(first.station_uuid, 'uuid-1');
  assert.equal(first['512_wind_speed_last'], 12);
  assert.equal(first['45_temp_avg'], 21);
});

