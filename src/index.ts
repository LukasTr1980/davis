import {
    getStations,
    getSensors,
    getSensorActivity,
    getCurrent
} from './weatherlink.js';
import { flattenCurrent, appendJsonLine, initLog } from './util.js';

initLog('current.log');

async function main(): Promise<void> {
    const stations = await getStations();
    if (!stations.length) return;

    const uuid = stations[0].station_id_uuid;

    const [sensors, activity, current] = await Promise.all([
        getSensors(),
        getSensorActivity(),
        getCurrent(uuid)
    ]);

    console.log('Sensors:', sensors);
    activity.forEach(a => {
        const age = Math.round((Date.now() / 1000 - a.time_received) / 60);
        console.log(`Sensor ${a.lsid} ⇒ last push before ${age} min`);
    });

    if (current) {
        const flat = flattenCurrent(current);
        console.log('Current (flat):', flat);

        appendJsonLine('current.log', flat);
    } else {
        console.warn('Current Dataset: none available.');
    }
}

main().catch(err =>
    console.error('Unhandled error:', err instanceof Error ? err.message : err)
);
