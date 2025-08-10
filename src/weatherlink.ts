import axios, { type AxiosInstance, type AxiosRequestConfig } from 'axios';
import type {
    StationResponse,
    StationInfo,
    NodeInfo,
    SensorInfo,
    SensorActivity,
    CurrentResponse,
} from './types.js';

const BASE_URL = 'https://api.weatherlink.com/v2';

export interface WeatherlinkClientConfig {
    apiKey: string;
    apiSecret: string;
    axiosConfig?: AxiosRequestConfig;
    axiosInstance?: AxiosInstance;
}

export class WeatherlinkClient {
    private readonly axios: AxiosInstance;

    constructor(config: WeatherlinkClientConfig) {
        this.axios = config.axiosInstance ?? axios.create({
            baseURL: BASE_URL,
            headers: { 'X-Api-Secret': config.apiSecret },
            params: { 'api-key': config.apiKey },
            ...config.axiosConfig,
        });
    }

    public async getStations(): Promise<StationInfo[]> {
        const { data } = await this.axios.get<StationResponse>('/stations');
        return data.stations;
    }

    public async getNodes(): Promise<NodeInfo[]> {
        const { data } = await this.axios.get<{ nodes: NodeInfo[] }>('/nodes');
        return data.nodes;
    }

    public async getSensors(): Promise<SensorInfo[]> {
        const { data } = await this.axios.get<{ sensors: SensorInfo[] }>('/sensors');
        return data.sensors;
    }

    public async getSensorActivity(): Promise<SensorActivity[]> {
        const { data } = await this.axios.get<{ sensor_activity: SensorActivity[] }>(
            '/sensor-activity'
        );
        return data.sensor_activity;
    }

    public async getCurrent(stationId: number | string): Promise<CurrentResponse | null> {
        const uuid =
            typeof stationId === 'number'
                ? (await this.getStations()).find(s => s.station_id === stationId)?.station_id_uuid
                : stationId;

        if (!uuid) {
            console.warn('No UUID found for station – cannot query /current');
            return null;
        }

        try {
            const { data } = await this.axios.get<CurrentResponse>(`/current/${uuid}`);
            return data;
        } catch (err: unknown) {
            if (axios.isAxiosError(err) && err.response?.status === 403) {
                console.warn('Basic plan: no permission for current endpoint.');
                return null;
            }
            throw err;
        }
    }

    public async getHistoric(
        stationId: number | string,
        start: number | Date,
        end: number | Date
    ): Promise<CurrentResponse | null> {
        const startTs = toSeconds(start);
        const endTs = toSeconds(end);
        if (endTs <= startTs) throw new Error('historic: end must be > start');

        const uuid =
            typeof stationId === 'number'
                ? (await this.getStations()).find(s => s.station_id === stationId)?.station_id_uuid
                : stationId;

        if (!uuid) {
            console.warn('No UUID found for station - cannot query /historic');
            return null;
        }

        try {
            const { data } = await this.axios.get<CurrentResponse>(`/historic/${uuid}`, {
                params: {
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

    public async *iterateHistoric(
        stationId: number | string,
        start: number | Date,
        end: number | Date,
        windowSeconds = 86_400
    ): AsyncGenerator<CurrentResponse, void, unknown> {
        const startTs = toSeconds(start);
        const endTs = toSeconds(end);
        if (endTs <= startTs) throw new Error('historic: end must be > start');

        let cursor = startTs;
        while (cursor < endTs) {
            const next = Math.min(cursor + windowSeconds, endTs);
            const chunk = await this.getHistoric(stationId, cursor, next);
            if (chunk) yield chunk;
            cursor = next;
        }
    }
}

function toSeconds(ts: number | Date): number {
    if (ts instanceof Date) return Math.floor(ts.getTime() / 1000);
    return ts > 1e11 ? Math.floor(ts / 1000) : Math.floor(ts);
}