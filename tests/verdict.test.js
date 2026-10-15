import { test } from "node:test";
import assert from "node:assert/strict";
import { verdict, psiBand, pmBand } from "../src/verdict.js";

const YES = 0, MAYBE = 1, NOPE = 2;
const clear = { psi: 40, pm: 15, forecast: "Fair", heatStress: "Low", temp: 29, uv: 3, lightning: 0 };

test("clear air and fair weather is a Yes", () => {
  assert.deepEqual(verdict(clear), { score: YES, lead: "go", reasons: [] });
});

test("missing readings don't block a verdict", () => {
  assert.equal(verdict({}).score, YES);
});

test("PM2.5 bands follow NEA's 1-hour thresholds", () => {
  assert.equal(verdict({ ...clear, pm: 55 }).score, YES);
  assert.equal(verdict({ ...clear, pm: 56 }).score, MAYBE);
  assert.equal(verdict({ ...clear, pm: 150 }).score, MAYBE);
  assert.equal(verdict({ ...clear, pm: 151 }).score, NOPE);
});

test("PSI bands follow NEA's 24-hour thresholds", () => {
  assert.equal(verdict({ ...clear, psi: 100 }).score, YES);
  assert.equal(verdict({ ...clear, psi: 101 }).score, MAYBE);
  assert.equal(verdict({ ...clear, psi: 201 }).lead, "psiVU");
  assert.equal(verdict({ ...clear, psi: 301 }).lead, "psiHaz");
});

test("lightning or thundery showers mean Nope, even on clean air", () => {
  assert.equal(verdict({ ...clear, lightning: 1 }).score, NOPE);
  assert.equal(verdict({ ...clear, forecast: "Thundery Showers" }).score, NOPE);
});

test("thunder is not also counted as plain rain", () => {
  assert.deepEqual(verdict({ ...clear, forecast: "Heavy Thundery Showers" }).reasons, ["thunder"]);
});

test("rain is a Maybe", () => {
  assert.equal(verdict({ ...clear, forecast: "Light Showers" }).lead, "rain");
  assert.equal(verdict({ ...clear, forecast: "Heavy Rain" }).lead, "heavy");
});

test("WBGT heat stress takes priority over air temperature", () => {
  assert.equal(verdict({ ...clear, heatStress: "High" }).score, NOPE);
  assert.equal(verdict({ ...clear, heatStress: "Moderate" }).score, MAYBE);
  assert.equal(verdict({ ...clear, heatStress: "Low", temp: 35 }).score, YES);
  assert.equal(verdict({ ...clear, heatStress: null, temp: 33 }).lead, "hot");
});

test("very high UV is a Maybe", () => {
  assert.equal(verdict({ ...clear, uv: 8 }).lead, "uv");
  assert.equal(verdict({ ...clear, uv: 7 }).score, YES);
});

test("the worst signal wins, and air quality leads the advice on ties", () => {
  const r = verdict({ ...clear, pm: 200, forecast: "Thundery Showers", uv: 10 });
  assert.equal(r.score, NOPE);
  assert.equal(r.lead, "pmHigh");
  assert.deepEqual(r.reasons, ["pmHigh", "thunder", "uv"]);
});

test("band labels match NEA's names", () => {
  assert.equal(psiBand(50).key, "psi.good");
  assert.equal(psiBand(150).key, "psi.unhealthy");
  assert.equal(pmBand(300).key, "pm.veryHigh");
});
