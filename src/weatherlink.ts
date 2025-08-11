import axios, { type AxiosInstance, type AxiosRequestConfig } from 'axios';
import type {
    StationResponse,
    StationInfo,
    NodeInfo,
    SensorInfo,
    SensorActivity,
    CurrentResponse,
    JsonObject
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

    public async getStationsByIds(ids: number | number[] | string): Promise<StationInfo[]> {
        const idsCsv = toIdsCsv(ids);
        const { data } = await this.axios.get<StationResponse>(`/stations/${idsCsv}`);
        return data.stations;
    }

    public async getNodes(): Promise<NodeInfo[]> {
        const { data } = await this.axios.get<{ nodes: NodeInfo[] }>('/nodes');
        return data.nodes;
    }

    public async getNodesByIds(ids: number | number[] | string): Promise<NodeInfo[]> {
        const idsCsv = toIdsCsv(ids);
        const { data } = await this.axios.get<{ nodes: NodeInfo[] }>(`/nodes/${idsCsv}`);
        return data.nodes;
    }

    public async getSensors(): Promise<SensorInfo[]> {
        const { data } = await this.axios.get<{ sensors: SensorInfo[] }>('/sensors');
        return data.sensors;
    }

    public async getSensorsByIds(ids: number | number[] | string): Promise<SensorInfo[]> {
        const idsCsv = toIdsCsv(ids);
        const { data } = await this.axios.get<{ sensors: SensorInfo[] }>(`/sensors/${idsCsv}`);
        return data.sensors;
    }

    public async getSensorActivity(): Promise<SensorActivity[]> {
        const { data } = await this.axios.get<{ sensor_activity: SensorActivity[] }>(
            '/sensor-activity'
        );
        return data.sensor_activity;
    }

    public async getSensorActivityByIds(
        ids: number | number[] | string
    ): Promise<SensorActivity[]> {
        const idsCsv = toIdsCsv(ids);
        const { data } = await this.axios.get<{ sensor_activity: SensorActivity[] }>(
            `/sensor-activity/${idsCsv}`
        );
        return data.sensor_activity;
    }

    public async getSensorCatalog(): Promise<unknown> {
        const { data } = await this.axios.get<unknown>('/sensor-catalog');
        return data;
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

    public async getReportET<T extends object = JsonObject>(
        stationId: number | string,
        start?: number | Date,
        end?: number | Date
    ): Promise<T | null> {
        const uuid =
            typeof stationId === 'number'
                ? (await this.getStations()).find(s => s.station_id === stationId)?.station_id_uuid
                : stationId;

        if (!uuid) {
            console.warn('No UUID found for station – cannot query /report/et');
            return null;
        }

        const params: Record<string, number> = {};
        if (typeof start !== 'undefined') params['start-timestamp'] = toSeconds(start);
        if (typeof end !== 'undefined') params['end-timestamp'] = toSeconds(end);

        try {
            const { data } = await this.axios.get<T>(`/report/et/${uuid}`, {
                params: Object.keys(params).length ? params : undefined,
            });
            return data;
        } catch (err) {
            if (axios.isAxiosError(err) && err.response?.status === 403) {
                console.warn('Report/ET not available for this plan or station.');
                return null;
            }
            throw err;
        }
    }
}

function toSeconds(ts: number | Date): number {
    if (ts instanceof Date) return Math.floor(ts.getTime() / 1000);
    return ts > 1e11 ? Math.floor(ts / 1000) : Math.floor(ts);
}

function toIdsCsv(ids: number | number[] | string): string {
    if (Array.isArray(ids)) return ids.join(',');
    if (typeof ids === 'number') return String(ids);
    return ids;
}