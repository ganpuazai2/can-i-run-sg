// App state shared by the renderer and the controllers.
import { signalsFor } from "./conditions.js";
import { verdict } from "./verdict.js";

export const state = {
  region: "central",
  conditions: null, // parsed NEA data, see conditions.js
  stale: false,     // true when the latest fetch failed and we're showing saved data
};

/** Verdict plus the raw signals behind it, for one region. */
export function reportFor(region) {
  const signals = signalsFor(state.conditions, region);
  return { ...signals, ...verdict(signals) };
}
