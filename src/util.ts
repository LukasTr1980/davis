import { type CurrentResponse } from "./types.js";

export function flattenCurrent(payload: CurrentResponse) {
    const out: Record<string, unknown> = {
        station_id: payload.station_id,
        station_uuid: payload.station_id_uuid,
        generatedAt: payload.generated_at
    };

    for (const block of payload.sensors) {
        const latest = block.data[0] as Record<string, unknown>;
        Object.entries(latest).forEach(([k, v]) => {
            out[`${block.sensor_type}_${k}`] = v;
        });
    }
    return out;
}