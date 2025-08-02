import axios from 'axios';
import { API_KEY, API_SECRET } from './env.js';
import { type StationResponse } from './types.js';

export async function getStations(): Promise<StationResponse> {
    const url = 'https://api.weatherlink.com/v2/stations';
    const { data } = await axios.get<StationResponse>(url, {
        headers: { 'X-Api-Secret': API_SECRET },
        params: { 'api-key': API_KEY }
    });
    return data;
}
