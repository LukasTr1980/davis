import {
    getStations,
    getSensors,
    getSensorActivity,
    getCurrent,
    iterateHistoric
} from './weatherlink.js';
import { flattenCurrent } from './util.js';
import { flattenHistoric } from './util.js';

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
    } else {
        console.warn('Current Dataset: none available.');
    }

    const end = Math.floor(Date.now() / 1000);
    const start = end - 86_400;

    let totalRows = 0;
    for await (const hist of iterateHistoric(uuid, start, end)) {
        const rows = flattenHistoric(hist);
        totalRows += rows.length;

        if (rows.length) {
            const firstTs = rows[0].ts;
            const lastTs = rows[rows.length - 1].ts;
            console.log(
                `Historic chunk ${new Date(firstTs * 1000).toISOString()} -> ${new Date(
                    lastTs * 1000
                ).toISOString()} (${rows.length} rows)`
            );
            console.log(" sample:", rows[0], rows[rows.length - 1]);
        } else {
            console.log('Historic chunk: 0 rows');
        }
    }
    if (totalRows === 0) {
        console.warn(
            'Historic: no Data or no permissions (Pro/Pro+ benötigt).'
        );
    } else {
        console.log(`Historic total rows: ${totalRows}`);
    }
}

main().catch(err =>
    console.error('Unhandled error:', err instanceof Error ? err.message : err)
);
