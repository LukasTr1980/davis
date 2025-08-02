export interface StationInfo {
    station_id: number,
    station_id_uuid: string;
    station_name: string;
    latitude: number;
    longitude: number;
    elevation: number;
    time_zone: string;
    subscription_type: 'Basic' | 'Pro' | 'Pro+';
}

export interface StationResponse {
    stations: StationInfo[];
}

export interface NodeInfo {
    node_id: number;
    node_name: string;
}

export interface SensorInfo {
    sensor_id: number;
    sensor_name: string;
}

export interface CurrentResponse {
    stations: {
        station_id: number;
        last_report_time: number;
        temp?: { temp: number };
        humidity?: { rh: number };
        barometer?: { bar_sea_level: number };
        wind?: { wind_speed_last: number; wind_dir_last: number };
        rain?: { rain_rate_last_mm: number };
    }[];
}