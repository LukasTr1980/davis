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

export interface SensorActivity {
    lsid: number;
    time_received: number;
    time_recorded: number;
}

export interface CurrentSensorBlock {
    lsid: number;
    sensor_type: number;
    data_structure_type: number;
    data: unknown[];
}

export interface CurrentResponse {
    station_id_uuid: string;
    station_id: number;
    generated_at: number;
    sensors: CurrentSensorBlock[];
}