import {
    getStations,
    getSensors,
    getSensorActivity,
    getCurrent
} from './weatherlink.js';

async function main(): Promise<void> {
    // ---- Station wählen -------------------------------------------------
    const stations = await getStations();
    console.log('Station-Metadata:', stations);

    if (!stations.length) {
        console.error('No station found – check API key.');
        return;
    }
    const station = stations[0];

    // ---- Daten parallel abrufen ----------------------------------------
    const [sensors, activity, current] = await Promise.all([
        getSensors(),
        getSensorActivity(),
        getCurrent(station.station_id_uuid)   // UUID verwenden!
    ]);

    // ---- Ausgabe --------------------------------------------------------
    console.log('\nSensors:', sensors);

    activity.forEach(a => {
        const age = Math.round((Date.now() / 1000 - a.time_received) / 60);
        console.log(`Sensor ${a.lsid} ⇒ last push before ${age} min`);
    });

    if (current) {
        console.log('\nCurrent Dataset (raw):', current);

        // Beispiel: Barometer-Wert (sensor_type 242) herausfiltern
        const baro = current.sensors.find(s => s.sensor_type === 242);
        const last = baro?.data[0] as
            | { bar_absolute: number; bar_sea_level: number }
            | undefined;

        if (last) {
            console.log(
                `Barometer abs: ${last.bar_absolute} - Meereshöhe: ${last.bar_sea_level}`
            );
        }
    } else {
        console.log('\nCurrent Dataset: none available.');
    }
}

main().catch(err =>
    console.error('Unhandled error:', err instanceof Error ? err.message : err)
);
