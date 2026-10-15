// Turns the raw /api/conditions payload (six NEA APIs) into a flat, easy-to-use shape,
// and looks up the readings that apply to a single region.
import { REGIONS, REGION_CENTERS, km } from "./regions.js";

const LIGHTNING_RADIUS_KM = 10;

const average = values => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : null);
const stationAverage = api => average((api?.readings?.[0]?.data ?? []).map(d => d.value).filter(v => typeof v === "number"));
const byTime = (a, b) => a.timestamp.localeCompare(b.timestamp);

/** @returns {object|null} null when the payload has no PSI data (NEA unreachable). */
export function parseConditions(raw = {}) {
  if (!raw.psi?.items?.length) return null;
  const psiItems = raw.psi.items.slice().sort(byTime);
  const pmHistory = (raw.pm25?.items ?? []).slice().sort(byTime);
  const uvIndex = raw.uv?.records?.[0]?.index;
  return {
    psi: psiItems.at(-1).readings.psi_twenty_four_hourly ?? {},
    pm: pmHistory.at(-1)?.readings.pm25_one_hourly ?? {},
    pmHistory,
    temp: stationAverage(raw.temp),
    humidity: stationAverage(raw.hum),
    uv: Array.isArray(uvIndex) && uvIndex.length ? uvIndex[0].value : null, // newest hour first
    nowcasts: raw.forecast?.items?.[0]?.forecasts ?? [],
    nowcastAreas: raw.forecast?.area_metadata ?? [],
    wbgt: raw.wbgt?.records?.[0]?.item?.readings ?? [],
    lightning: raw.lightning?.records?.[0]?.item?.readings ?? [],
    forecast24: raw.forecast24?.records?.[0] ?? null,
    outlook: raw.outlook?.records?.[0]?.forecasts ?? [],
    fetchedAt: raw.fetchedAt ?? new Date().toISOString(),
  };
}

/** Plausible sample data, shown (and clearly labelled) when NEA can't be reached at all. */
export function demoConditions(now = Date.now()) {
  const pmHistory = Array.from({ length: 12 }, (_, i) => ({
    timestamp: new Date(now - (11 - i) * 3600e3).toISOString(),
    readings: { pm25_one_hourly: Object.fromEntries(REGIONS.map((r, k) => [r, Math.round(14 + 8 * Math.sin(i / 2 + k))])) },
  }));
  return {
    psi: Object.fromEntries(REGIONS.map((r, k) => [r, 40 + k * 5])),
    pm: pmHistory.at(-1).readings.pm25_one_hourly,
    pmHistory, temp: null, humidity: null, uv: null, nowcasts: [], nowcastAreas: [], wbgt: [], lightning: [],
    forecast24: null, outlook: [], fetchedAt: new Date(now).toISOString(), demo: true,
  };
}

function nearest(items, region, coords) {
  const [lat, lng] = REGION_CENTERS[region];
  let best = null, bestDistance = Infinity;
  for (const item of items) {
    const [la, lo] = coords(item);
    const d = km(lat, lng, la, lo);
    if (d < bestDistance) { best = item; bestDistance = d; }
  }
  return best;
}

// 2-hour nowcast for the NEA area closest to the region centre.
export function nowcastFor(c, region) {
  const area = nearest(c.nowcastAreas, region, a => [a.label_location.latitude, a.label_location.longitude]);
  return c.nowcasts.find(f => f.area === area?.name) ?? c.nowcasts[0] ?? null;
}

// WBGT reading from the closest station.
export function wbgtFor(c, region) {
  return nearest(c.wbgt.filter(r => r.wbgt != null), region, r => [+r.location.latitude, +r.location.longitude]);
}

export function lightningFor(c, region) {
  const [lat, lng] = REGION_CENTERS[region];
  return c.lightning.filter(strike => {
    const loc = strike.location ?? strike;
    const la = +loc.latitude, lo = +(loc.longitude ?? loc.longtitude); // NEA has used both spellings
    return Number.isFinite(la) && Number.isFinite(lo) && km(lat, lng, la, lo) <= LIGHTNING_RADIUS_KM;
  }).length;
}

/** Everything the verdict and the UI need for one region. */
export function signalsFor(c, region) {
  const nowcast = nowcastFor(c, region), wbgt = wbgtFor(c, region);
  return {
    psi: c.psi[region] ?? null,
    pm: c.pm[region] ?? null,
    forecast: nowcast?.forecast ?? "",
    nowcast,
    heatStress: wbgt?.heatStress ?? null,
    wbgt,
    temp: c.temp,
    uv: c.uv,
    lightning: lightningFor(c, region),
  };
}
