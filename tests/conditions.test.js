import { test } from "node:test";
import assert from "node:assert/strict";
import { parseConditions, demoConditions, signalsFor } from "../src/conditions.js";
import { nearestRegion } from "../src/regions.js";

const raw = {
  psi: { items: [
    { timestamp: "2026-10-16T08:00:00+08:00", readings: { psi_twenty_four_hourly: { north: 60, south: 70, east: 80, west: 90, central: 99 } } },
    { timestamp: "2026-10-16T07:00:00+08:00", readings: { psi_twenty_four_hourly: { north: 1, south: 1, east: 1, west: 1, central: 1 } } },
  ] },
  pm25: { items: [{ timestamp: "2026-10-16T08:00:00+08:00", readings: { pm25_one_hourly: { north: 12, south: 13, east: 14, west: 15, central: 16 } } }] },
  temp: { readings: [{ data: [{ value: 30 }, { value: 32 }] }] },
  forecast: {
    area_metadata: [
      { name: "Bedok", label_location: { latitude: 1.32, longitude: 103.92 } },
      { name: "Woodlands", label_location: { latitude: 1.43, longitude: 103.79 } },
    ],
    items: [{ forecasts: [{ area: "Bedok", forecast: "Thundery Showers" }, { area: "Woodlands", forecast: "Fair" }] }],
  },
  lightning: { records: [{ item: { readings: [{ location: { latitude: "1.33", longtitude: "103.93" } }] } }] },
};

test("uses the newest PSI reading, whatever order NEA sends them in", () => {
  assert.equal(parseConditions(raw).psi.central, 99);
});

test("averages air temperature across stations", () => {
  assert.equal(parseConditions(raw).temp, 31);
});

test("returns null without PSI so the app can fall back", () => {
  assert.equal(parseConditions({}), null);
});

test("matches each region to its nearest forecast area and lightning", () => {
  const c = parseConditions(raw);
  assert.equal(signalsFor(c, "east").forecast, "Thundery Showers");
  assert.equal(signalsFor(c, "east").lightning, 1); // NEA's "longtitude" spelling is handled
  assert.equal(signalsFor(c, "north").forecast, "Fair");
  assert.equal(signalsFor(c, "north").lightning, 0);
});

test("demo data is flagged so it's never shown as real", () => {
  assert.equal(demoConditions().demo, true);
});

test("picks the nearest NEA region for a location", () => {
  assert.equal(nearestRegion(1.3911, 103.8955), "east"); // Sengkang
  assert.equal(nearestRegion(1.4382, 103.789), "north"); // Woodlands
  assert.equal(nearestRegion(1.284, 103.851), "south"); // Raffles Place
});
