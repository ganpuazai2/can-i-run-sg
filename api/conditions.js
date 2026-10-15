// Combines the NEA real-time APIs into one response, cached at Vercel's edge.
// Set DATA_GOV_SG_API_KEY in Vercel env vars for higher rate limits.
const API = "https://api-open.data.gov.sg/v2/real-time/api/";
const sleep = ms => new Promise(r => setTimeout(r, ms));

function sgDate() {
  return new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10);
}

async function get(path, key) {
  const headers = key ? { "x-api-key": key } : {};
  for (let i = 0; i < 3; i++) {
    const r = await fetch(API + path, { headers });
    if (r.ok) return (await r.json()).data;
    if (r.status !== 429) return null;
    await sleep(key ? 1000 : 5000);
  }
  return null;
}

export default async function handler(req, res) {
  const key = process.env.DATA_GOV_SG_API_KEY;
  const d = sgDate();
  const paths = {
    psi: "psi?date=" + d,
    pm25: "pm25?date=" + d,
    forecast: "two-hr-forecast",
    temp: "air-temperature",
    hum: "relative-humidity",
    uv: "uv",
    wbgt: "weather?api=wbgt",
    lightning: "weather?api=lightning",
    forecast24: "twenty-four-hr-forecast",
    outlook: "four-day-outlook",
  };
  const out = {};
  if (key) {
    const entries = await Promise.all(Object.entries(paths).map(async ([k, p]) => [k, await get(p, key)]));
    entries.forEach(([k, v]) => (out[k] = v));
  } else {
    for (const [k, p] of Object.entries(paths)) {
      out[k] = await get(p);
      await sleep(400);
    }
  }
  out.fetchedAt = new Date().toISOString();

  const ok = out.psi && out.pm25;
  // Serve from the edge cache for 5 min, then refresh in the background.
  res.setHeader("Cache-Control", ok ? "public, s-maxage=300, stale-while-revalidate=3600" : "no-store");
  res.status(ok ? 200 : 502).json(out);
}
