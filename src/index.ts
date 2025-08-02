import { getStations, getSensors, getSensorActivity, getCurrent } from "./weatherlink.js";

async function main(): Promise<void> {
    const stations = await getStations();
    console.log('Station-Metadata:', stations);

    if (!stations.length) {
        console.error('No Station found');
        return;
    }

    const firstId = stations[0].station_id;

    const [sensors, activity, current] = await Promise.all([
        getSensors(),
        getSensorActivity(),
        getCurrent(firstId)
    ]);

    console.log('\nSensors:', sensors);
    activity.forEach(a => {
        const age = Math.round((Date.now() / 1000 - a.time_received) / 60);
        console.log(`Sensor ${a.lsid} ⇒ last push before ${age} min`);
    });

    if (current) {
        console.log('\nCurrent Dataset:', current);
    } else {
        console.log('\nCurrent Dataset: none available.');
    }
}

main().catch((err: unknown) => {
    console.error('Unhandled error', err instanceof Error ? err.message : err);
}) 