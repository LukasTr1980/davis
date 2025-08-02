import { getStations, getNodes, getSensors, getCurrent } from "./weatherlink.js";

async function main(): Promise<void> {
    const stations = await getStations();
    console.log('Station-Metadata:', stations);

    if (!stations.length) {
        console.error('No Station found');
        return;
    }

    const firstId = stations[0].station_id;

    const [nodes, sensors, current] = await Promise.all([
        getNodes(),
        getSensors(),
        getCurrent(firstId)
    ]);

    console.log('\nNodes:', nodes);
    console.log('Sensors:', sensors);

    if (current) {
        console.log('\nCurrent Dataset:', current);
    } else {
        console.log('\nCurrent Dataset: none available.');
    }
}

main().catch((err: unknown) => {
    console.error('Unhandled error', err instanceof Error ? err.message : err);
}) 