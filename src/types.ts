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