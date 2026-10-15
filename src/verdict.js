// The running verdict: pure functions, no DOM, no network, so they can be tested directly.
//
// Scores: 0 = Yes, 1 = Maybe, 2 = Nope. The worst signal wins.

// NEA 24-hour PSI bands. `severity` drives the dot colour next to the number.
export function psiBand(psi) {
  if (psi <= 50) return { key: "psi.good", severity: 0 };
  if (psi <= 100) return { key: "psi.moderate", severity: 1 };
  if (psi <= 200) return { key: "psi.unhealthy", severity: 2 };
  if (psi <= 300) return { key: "psi.veryUnhealthy", severity: 2 };
  return { key: "psi.hazardous", severity: 2 };
}

// NEA 1-hour PM2.5 bands (µg/m³).
export function pmBand(pm) {
  if (pm <= 55) return { key: "pm.normal", severity: 0, level: 0 };
  if (pm <= 150) return { key: "pm.elevated", severity: 1, level: 1 };
  if (pm <= 250) return { key: "pm.high", severity: 2, level: 2 };
  return { key: "pm.veryHigh", severity: 2, level: 3 };
}

export const HEAT_SEVERITY = { Low: 0, Moderate: 1, High: 2 };

// Air temperature that counts as "hot" when no WBGT station reading is available.
const HOT_AIR_TEMP = 33;
const VERY_HIGH_UV = 8;

/**
 * @param {object} s Signals for one region. Any field may be null when NEA has no reading.
 * @param {number} [s.psi] 24-hour PSI
 * @param {number} [s.pm] 1-hour PM2.5
 * @param {string} [s.forecast] NEA 2-hour forecast text, e.g. "Thundery Showers"
 * @param {string} [s.heatStress] NEA WBGT rating: "Low" | "Moderate" | "High"
 * @param {number} [s.temp] average air temperature, used only without a WBGT reading
 * @param {number} [s.uv] UV index
 * @param {number} [s.lightning] lightning strikes within 10 km
 * @returns {{ score: number, lead: string, reasons: string[] }}
 *   `lead` is the first signal that reached the final score; it picks the one-line advice.
 *   `reasons` lists every signal that raised a warning, in order of importance.
 */
export function verdict({ psi = null, pm = null, forecast = "", heatStress = null, temp = null, uv = null, lightning = 0 } = {}) {
  let score = 0, lead = "go";
  const reasons = [];
  const flag = (level, reason) => {
    if (level > score) { score = level; lead = reason; }
    reasons.push(reason);
  };

  // Air quality first: it's what this app is for.
  if (pm != null) {
    const { level } = pmBand(pm);
    if (level >= 2) flag(2, "pmHigh");
    else if (level === 1) flag(1, "pmElev");
  }
  if (psi != null) {
    if (psi > 300) flag(2, "psiHaz");
    else if (psi > 200) flag(2, "psiVU");
    else if (psi > 100) flag(1, "psiU");
  }

  const weather = (forecast || "").toLowerCase();
  const thunder = weather.includes("thunder");
  if (lightning > 0) flag(2, "lightning");
  if (thunder) flag(2, "thunder");

  if (heatStress) {
    const level = HEAT_SEVERITY[heatStress] ?? 0;
    if (level === 2) flag(2, "heatHigh");
    else if (level === 1) flag(1, "heatMod");
  } else if (temp != null && temp >= HOT_AIR_TEMP) {
    flag(1, "hot");
  }

  if (!thunder) {
    if (weather.includes("heavy")) flag(1, "heavy");
    else if (weather.includes("rain") || weather.includes("shower")) flag(1, "rain");
  }
  if (uv != null && uv >= VERY_HIGH_UV) flag(1, "uv");

  return { score, lead, reasons };
}
