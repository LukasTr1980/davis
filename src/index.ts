import { getStations } from './weatherlink.js';
import { type StationInfo, type StationResponse } from './types.js';

async function main(): Promise<void> {
    try {
        const res: StationResponse = await getStations();
        const stations: StationInfo[] = res.stations;

        console.log(JSON.stringify(stations, null, 2));
    } catch (err: unknown) {
        if (err instanceof Error) {
            console.error('Error:', err.message);
        } else {
            console.error('Unknown Error:', err);
        }
    }
}

void main();
