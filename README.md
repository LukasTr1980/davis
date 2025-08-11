 # Davis Weatherlink API Client

 A minimal TypeScript client for interacting with the Weatherlink Davis API.

 ## Features
 - Lightweight, promise-based client using axios
 - Typed interfaces with full TypeScript support
 - Full coverage of WeatherLink v2 API endpoints listed in the public docs
 - Async iterator for chunked historic data retrieval

 ## Installation
 ```bash
 npm install @lukastr1980/davis
 ```


## Running tests

- Unit tests (no network):
  - `npm test`
  - Uses Node's built-in test runner and fakes HTTP calls. Fast and deterministic.
- Integration tests (real Weatherlink API):
  - Create a `.env` file in the project root with:
    - `RUN_INTEGRATION=1`
    - `API_KEY=...`
    - `API_SECRET=...`
    - Optionally `STATION_ID=...` or `STATION_UUID=...`
  - Then run `npm test`. The tests will read `.env` automatically and print a short summary of live responses.
  - Alternatively, set these environment variables in your shell instead of using `.env`.

 ## Usage
 ```ts
 import { WeatherlinkClient } from "@lukastr1980/davis";

 (async () => {
   const client = new WeatherlinkClient({
     apiKey: process.env.API_KEY!,
     apiSecret: process.env.API_SECRET!,
   });

   // Get station list
   const stations = await client.getStations();
   console.log("Stations:", stations);

   // Retrieve current data for the first station
   const current = await client.getCurrent(stations[0].station_id);
   if (current) {
     console.log("Current:", current);
   }

   // Iterate over the last 24h of historic data in daily chunks
   const end = Date.now();
   const start = end - 24 * 3600 * 1000;
   for await (const chunk of client.iterateHistoric(stations[0].station_id, start, end)) {
     console.log("Historic chunk:", chunk);
   }
 })();
 ```

 ## API surface
 - WeatherlinkClient: construct with `{ apiKey, apiSecret, axiosConfig?, axiosInstance? }`.
 - Metadata
   - getStations(): StationInfo[]
   - getStationsByIds(ids): StationInfo[]
   - getNodes(): NodeInfo[]
   - getNodesByIds(ids): NodeInfo[]
   - getSensors(): SensorInfo[]
   - getSensorsByIds(ids): SensorInfo[]
   - getSensorActivity(): SensorActivity[]
   - getSensorActivityByIds(ids): SensorActivity[]
   - getSensorCatalog(): unknown
 - Weather Data
   - getCurrent(stationId): CurrentResponse | null
   - getHistoric(stationId, start, end): CurrentResponse | null
   - iterateHistoric(stationId, start, end, windowSeconds?): AsyncGenerator<CurrentResponse>
 - Reports
   - getReportET(stationId, start?, end?): unknown | null


### WeatherlinkClient options

```ts
new WeatherlinkClient({
  apiKey: '...',
  apiSecret: '...',
  axiosConfig: { timeout: 15000 }, // optional axios request config
  axiosInstance,                    // optional custom axios instance (useful for tests)
});
```

The `axiosInstance` option lets you inject a preconfigured axios client (or a stub) for unit testing without real HTTP requests.
