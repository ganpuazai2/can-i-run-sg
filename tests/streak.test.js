import { test } from "node:test";
import assert from "node:assert/strict";
import { dayKey, streakStats, monthStats, toggleToday } from "../src/streak.js";

const now = new Date("2026-10-16T09:00:00+08:00");

test("dates use Singapore time", () => {
  assert.equal(dayKey(new Date("2026-10-15T17:00:00Z")), "2026-10-16"); // 1am in Singapore
});

test("a streak counts back from today", () => {
  const log = { "2026-10-14": "run", "2026-10-15": "indoor", "2026-10-16": "run" };
  assert.equal(streakStats(log, now).streak, 3);
});

test("a streak survives until the end of the day after the last log", () => {
  assert.equal(streakStats({ "2026-10-15": "run" }, now).streak, 1);
  assert.equal(streakStats({ "2026-10-14": "run" }, now).streak, 0);
});

test("best streak spans month boundaries", () => {
  const log = { "2026-09-29": "run", "2026-09-30": "run", "2026-10-01": "run", "2026-10-05": "run" };
  assert.equal(streakStats(log, now).best, 3);
});

test("month stats only count that month", () => {
  const log = { "2026-09-30": "run", "2026-10-01": "run", "2026-10-02": "haze" };
  assert.deepEqual(monthStats(log, "2026-10"), { active: 2, runs: 1, indoor: 1, haze: 1, best: 2 });
});

test("logging the same thing twice undoes it", () => {
  const once = toggleToday({}, "2026-10-16", "run", false);
  assert.deepEqual(once, { "2026-10-16": "run" });
  assert.deepEqual(toggleToday(once, "2026-10-16", "run", false), {});
});

test("an indoor session on a Nope day counts towards Haze-Proof", () => {
  assert.equal(toggleToday({}, "2026-10-16", "indoor", true)["2026-10-16"], "haze");
  assert.equal(toggleToday({}, "2026-10-16", "indoor", false)["2026-10-16"], "indoor");
});
