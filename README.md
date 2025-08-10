 # Davis Weatherlink API Client

 A TypeScript client for interacting with the Weatherlink Davis API, with helpers to flatten and retrieve current or historic observation data.

 ## Features
 - Lightweight, promise-based client using axios
 - Typed interfaces with full TypeScript support
 - Helper functions to normalize current and historic data
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
 import { WeatherlinkClient, flattenCurrent, flattenHistoric } from "@lukastr1980/davis";

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
     console.log("Current (flattened):", flattenCurrent(current));
   }

   // Iterate over the last 24h of historic data in daily chunks
   const end = Date.now();
   const start = end - 24 * 3600 * 1000;
   for await (const chunk of client.iterateHistoric(stations[0].station_id, start, end)) {
     console.log("Historic chunk:", flattenHistoric(chunk));
   }
 })();
 ```

 ## API
 | Class/Function | Description |
 | -- | -- |
 | `WeatherlinkClient` | Main client class. Construct with `{apiKey, apiSecret}`. |
 | `getStations()` | Returns an array of available stations. |
 | `getNodes()` | Returns an array of node metadata. |
 | `getSensors()` | Returns an array of sensor metadata. |
 | `getSensorActivity()` | Returns recent sensor activity metadata. |
 | `getCurrent(stationId)` | Returns latest observations for a station. |
 | `getHistoric(stationId, start, end)` | Returns historic observations for a station. |
 | `iterateHistoric(stationId, start, end, windowSeconds?)` | Async iterator yielding historic data in time windows. |
 | `flattenCurrent` | Flatten nested current observation payload to flat object. |
 | `flattenHistoric` | Flatten nested historic payload to list of flat objects sorted by timestamp. |

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
