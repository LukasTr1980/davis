import { type CurrentResponse } from "./types.js";

export function flattenCurrent(payload: CurrentResponse) {
    const out: Record<string, unknown> = {
        station_id: payload.station_id,
        station_uuid: payload.station_id_uuid,
        generatedAt: payload.generated_at,
    };

    for (const block of payload.sensors) {
        const arr = block.data as Record<string, unknown>[] | undefined;
        const latest = Array.isArray(arr) ? arr[0] : undefined;
        if (!latest) continue;

        for (const [k, v] of Object.entries(latest)) {
            out[`${block.sensor_type}_${k}`] = v;
        }
    }
    return out;
}

export function flattenHistoric(payload: CurrentResponse) {
    type Row = Record<string, unknown> & {
        ts: number;
        station_id: number;
        station_uuid: string;
    }

    type HistoricEntry = Record<string, unknown>;
    const rows = new Map<number, Row>();

    for (const block of payload.sensors) {
        for (const entry of (block.data as HistoricEntry[])) {
            const ts = entry.ts as number | undefined;
            if (typeof ts !== 'number') continue;

            const row = rows.get(ts) ?? {
                station_id: payload.station_id,
                station_uuid: payload.station_id_uuid,
                ts
            };

            for (const [k, v] of Object.entries(entry)) {
                if (k === 'ts') continue;
                row[`${block.sensor_type}_${k}`] = v;
            }
            rows.set(ts, row);
        }
    }
    return [...rows.values()].sort((a, b) => a.ts - b.ts);
}