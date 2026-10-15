import { test } from "node:test";
import assert from "node:assert/strict";
import { bestPeriod, periodKey } from "../src/forecast.js";

const period = (start, text) => ({ timePeriod: { start }, regions: { east: { text } } });
const tonight = period("2026-10-16T18:00:00+08:00", "Cloudy");
const morning = period("2026-10-17T06:00:00+08:00", "Cloudy");
const afternoon = period("2026-10-17T12:00:00+08:00", "Thundery Showers");

test("labels periods relative to today", () => {
  assert.equal(periodKey(tonight, "2026-10-16"), "when.tonight");
  assert.equal(periodKey(morning, "2026-10-16"), "when.tomorrowMorning");
});

test("prefers the cool morning when the weather ties", () => {
  assert.equal(bestPeriod([tonight, morning, afternoon], "east"), morning);
});

test("avoids storms even in the morning", () => {
  const stormyMorning = period("2026-10-17T06:00:00+08:00", "Thundery Showers");
  assert.equal(bestPeriod([tonight, stormyMorning], "east"), tonight);
});
