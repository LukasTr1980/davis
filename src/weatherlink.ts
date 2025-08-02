import axios, { type AxiosError } from 'axios';
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
): Promise<CurrentResponse['stations'][number] | null> {
    const idPath =
        typeof stationId === 'number'
            ? (await getStations()).find(s => s.station_id === stationId)?.station_id_uuid
            : stationId;
    
    if (!idPath) {
        console.warn('No UUID found for station - cannot query /(current');
        return null;
    }

    try {
        const { data } = await axios.get<CurrentResponse>(
            `${BASE}/current/${idPath}`,
            cfg()
        );

        return data.stations?.[0] ?? null;
    } catch (err: unknown) {
        if (axios.isAxiosError(err)) {
            const ax = err as AxiosError<{ error?: { message: string } }>;

            if (ax.response?.status === 403) {
                console.warn('Basic plan: no permission for current endpoint.');
                return null;
            }
        }
        throw err;
    }
}