import axios from 'axios';
import { API_KEY, API_SECRET } from './env.js';
import {
    type StationResponse,
    type NodeInfo,
    type SensorActivity,
    type SensorInfo,
    type CurrentResponse,
} from './types.js';

const BASE = 'https://api.weatherlink.com/v2';

function cfg() {
    return {
        headers: { 'X-Api-Secret': API_SECRET },
        params: { 'api-key': API_KEY }
    };
}

function toSeconds(ts: number | Date): number {
    if (ts instanceof Date) return Math.floor(ts.getTime() / 1000);
    return ts > 1e11 ? Math.floor(ts / 1000) : Math.floor(ts);
}

export async function getStations() {
    const { data } = await axios.get<StationResponse>(`${BASE}/stations`, cfg());
    return data.stations;
}

export async function getNodes() {
    const { data } = await axios.get<{ nodes: NodeInfo[] }>(`${BASE}/nodes`, cfg());
    return data.nodes;
}

export async function getSensors() {
    const { data } = await axios.get<{ sensors: SensorInfo[] }>(`${BASE}/sensors`, cfg());
    return data.sensors;
}

export async function getSensorActivity() {
    const { data } = await axios.get<{ sensor_activity: SensorActivity[] }>(
        `${BASE}/sensor-activity`,
        cfg()
    );
    return data.sensor_activity;
}

export async function getCurrent(
    stationId: number | string
): Promise<CurrentResponse | null> {
    const uuid =
        typeof stationId === 'number'
            ? (await getStations()).find(s => s.station_id === stationId)?.station_id_uuid
            : stationId;

    if (!uuid) {
        console.warn('No UUID found for station – cannot query /current');
        return null;
    }

    try {
        const { data } = await axios.get<CurrentResponse>(`${BASE}/current/${uuid}`, cfg());
        return data;
    } catch (err: unknown) {
        if (axios.isAxiosError(err) && err.response?.status === 403) {
            console.warn('Basic plan: no permission for current endpoint.');
            return null;
        }
        throw err;
    }
}

export async function getHistoric(
    stationId: number | string,
    start: number | Date,
    end: number | Date
): Promise<CurrentResponse | null> {
    const startTs = toSeconds(start);
    const endTs = toSeconds(end);
    if (endTs <= startTs) throw new Error('historic: end must be > start');

    const uuid =
        typeof stationId === 'number'
            ? (await getStations()).find(s => s.station_id === stationId)?.station_id_uuid
            : stationId;

    if (!uuid) {
        console.warn('No UUID found for station - cannot query /historic');
        return null;
    }

    try {
        const base = cfg();
        const { data } = await axios.get<CurrentResponse>(`${BASE}/historic/${uuid}`, {
            ...base,
            params: {
                ...base.params,
                'start-timestamp': startTs,
                'end-timestamp': endTs,
            },
        });
        return data;
    } catch (err: unknown) {
        if (axios.isAxiosError(err) && err.response?.status === 403) {
            console.warn('Historic requires Pro/Pro+ for this station.');
            return null;
        }
        throw err;
    }
}

export async function* iterateHistoric(
    stationId: number | string,
    start: number | Date,
    end: number | Date,
    windowSeconds = 86_400
):AsyncGenerator<CurrentResponse, void, unknown> {
    const startTs = toSeconds(start);
    const endTs = toSeconds(end);
    if (endTs <= startTs) throw new Error('historic: end must be > start');

    let cursor = startTs;
    while(cursor < endTs) {
        const next = Math.min(cursor + windowSeconds, endTs);
        const chunk = await getHistoric(stationId, cursor, next);
        if (chunk) yield chunk;
        cursor = next;
    }
}