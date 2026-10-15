const REGIONS = ["west", "north", "central", "east", "south"];
const REGION_ORDER = ["north", "south", "east", "west", "central"]; // display order for the region row
// NEA's own PSI region label locations
const REGION_CENTERS = { west: [1.35735, 103.7], north: [1.41803, 103.82], central: [1.35735, 103.82], east: [1.35735, 103.94], south: [1.29587, 103.82] };
// ?region=east in a link picks the region (handy for sharing a specific area)
const urlRegion = new URLSearchParams(location.search).get("region");
if (REGIONS.includes(urlRegion)) { localStorage.setItem("region", urlRegion); localStorage.setItem("welcomed", "1"); }
const state = { region: localStorage.getItem("region") || "central", psi: {}, pm: {}, items: [], temp: null, hum: null, uv: null, forecasts: [], areas: [], wbgt: [], lightning: [], f24: null, outlook: [], demo: false };
const $ = id => document.getElementById(id);

const ICONS = {
  0: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  1: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M12 6v8"/><path d="M12 18h.01"/></svg>',
  2: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M7 7l10 10M17 7L7 17"/></svg>',
  moon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/></svg>',
  sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
};

// ---------- Bands (sev: 0 fine, 1 caution, 2 bad; drives the dot colour) ----------
function psiBand(v) {
  if (v <= 50) return { name: t("psi.good"), sev: 0 };
  if (v <= 100) return { name: t("psi.moderate"), sev: 1 };
  if (v <= 200) return { name: t("psi.unhealthy"), sev: 2 };
  if (v <= 300) return { name: t("psi.veryUnhealthy"), sev: 2 };
  return { name: t("psi.hazardous"), sev: 2 };
}
function pmBand(v) { // NEA 1-hr PM2.5 bands
  if (v <= 55) return { name: t("pm.normal"), sev: 0, lvl: 0 };
  if (v <= 150) return { name: t("pm.elevated"), sev: 1, lvl: 1 };
  if (v <= 250) return { name: t("pm.high"), sev: 2, lvl: 2 };
  return { name: t("pm.veryHigh"), sev: 2, lvl: 3 };
}
const heatBand = s => ({ name: t("heat." + s), sev: { Low: 0, Moderate: 1, High: 2 }[s] ?? null });
const bandHTML = b => (b ? `<span class="band b${b.sev}">${b.name}</span>` : "");
const fmtTime = (d, opts) => new Date(d).toLocaleTimeString(t("locale"), opts);
const fmtDate = (d, opts) => new Date(d).toLocaleDateString(t("locale"), opts);

// ---------- Fetch ----------
// All NEA data comes from our edge-cached /api/conditions proxy in one request.
const avgReadings = d => {
  const vals = d?.readings?.[0]?.data?.map(x => x.value).filter(v => typeof v === "number") || [];
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
};

let loading = false;
async function load() {
  if (loading) return;
  loading = true; $("refresh").disabled = true;
  try { await loadData(); } finally { loading = false; $("refresh").disabled = false; }
}
async function loadData() {
  let data = null;
  try {
    const r = await fetch("/api/conditions");
    if (r.ok) { data = await r.json(); localStorage.setItem("conditions", JSON.stringify(data)); }
  } catch {}
  state.stale = !data;
  if (!data) data = JSON.parse(localStorage.getItem("conditions") || "null");
  apply(data || {});
}
// Paint last saved data straight away so repeat visits are instant.
function paintCached() {
  const c = localStorage.getItem("conditions");
  if (c) apply(JSON.parse(c));
}
function apply({ psi, pm25: pm, forecast: fc, temp, hum, uv, wbgt, lightning, forecast24, outlook, fetchedAt }) {
  state.loaded = true; document.body.classList.remove("loading");
  state.wbgt = wbgt?.records?.[0]?.item?.readings || [];
  state.lightning = lightning?.records?.[0]?.item?.readings || [];
  state.f24 = forecast24?.records?.[0] || null;
  state.outlook = outlook?.records?.[0]?.forecasts || [];
  if (psi?.items?.length) {
    const byTime = (a, b) => a.timestamp.localeCompare(b.timestamp);
    const psiItems = psi.items.slice().sort(byTime);
    state.psi = psiItems[psiItems.length - 1].readings.psi_twenty_four_hourly || {};
    state.items = (pm?.items || []).slice().sort(byTime);
    state.pm = state.items.length ? state.items[state.items.length - 1].readings.pm25_one_hourly || {} : {};
    state.demo = false;
  } else {
    useDemo();
  }
  state.temp = avgReadings(temp);
  state.hum = avgReadings(hum);
  const uvIdx = uv?.records?.[0]?.index;
  state.uv = Array.isArray(uvIdx) && uvIdx.length ? uvIdx[0].value : null;
  state.forecasts = fc?.items?.[0]?.forecasts || [];
  state.areas = fc?.area_metadata || [];
  state.fetchedAt = fetchedAt || Date.now();
  render();
}
function useDemo() {
  state.demo = true;
  state.items = Array.from({ length: 12 }, (_, i) => {
    const pm = {}, psi = {};
    REGIONS.forEach((r, k) => { pm[r] = Math.round(12 + 8 * Math.sin(i / 2 + k) + Math.random() * 5); psi[r] = 40 + k * 5; });
    return { timestamp: new Date(Date.now() - (11 - i) * 3600e3).toISOString(), readings: { pm25_one_hourly: pm, psi_twenty_four_hourly: psi } };
  });
  const last = state.items[state.items.length - 1].readings;
  state.psi = last.psi_twenty_four_hourly; state.pm = last.pm25_one_hourly;
}

// ---------- Verdict logic ----------
function nearestForecast(region) {
  if (!state.forecasts.length) return null;
  const [lat, lng] = REGION_CENTERS[region];
  let best = null, bestD = Infinity;
  state.areas.forEach(a => {
    const d = (a.label_location.latitude - lat) ** 2 + (a.label_location.longitude - lng) ** 2;
    if (d < bestD) { bestD = d; best = a.name; }
  });
  return state.forecasts.find(f => f.area === best) || state.forecasts[0];
}

// Takes the worst signal. `lead` is the first signal that reached the final score; it drives the one-line advice.
function verdict(region) {
  const psi = state.psi[region], pm = state.pm[region];
  let score = 0, lead = "go"; const reasons = [];
  const bump = (n, key) => { if (n > score) { score = n; lead = key; } reasons.push(key); };
  if (pm != null) {
    const b = pmBand(pm);
    if (b.lvl >= 2) bump(2, "pmHigh"); else if (b.lvl === 1) bump(1, "pmElev");
  }
  if (psi != null) {
    if (psi > 300) bump(2, "psiHaz"); else if (psi > 200) bump(2, "psiVU"); else if (psi > 100) bump(1, "psiU");
  }
  if (lightningNear(region)) bump(2, "lightning");
  const f = nearestForecast(region);
  const w = (f?.forecast || "").toLowerCase();
  if (w.includes("thunder")) bump(2, "thunder");
  const heat = nearestWbgt(region);
  if (heat) {
    if (heat.heatStress === "High") bump(2, "heatHigh"); else if (heat.heatStress === "Moderate") bump(1, "heatMod");
  } else if (state.temp != null && state.temp >= 33) bump(1, "hot");
  if (!w.includes("thunder")) {
    if (w.includes("heavy")) bump(1, "heavy"); else if (w.includes("rain") || w.includes("shower")) bump(1, "rain");
  }
  if (state.uv != null && state.uv >= 8) bump(1, "uv");
  return { score, lead, reasons, psi, pm, forecast: f, heat };
}

// distance in km between two lat/lng points (equirectangular is fine at Singapore's scale)
function km(lat1, lng1, lat2, lng2) {
  const x = (lng2 - lng1) * 111.32 * Math.cos((lat1 * Math.PI) / 180), y = (lat2 - lat1) * 110.57;
  return Math.hypot(x, y);
}
function nearestWbgt(region) {
  const [lat, lng] = REGION_CENTERS[region];
  let best = null, bestD = Infinity;
  state.wbgt.forEach(r => {
    const d = km(lat, lng, +r.location.latitude, +r.location.longitude);
    if (d < bestD && r.wbgt != null) { bestD = d; best = r; }
  });
  return best;
}
function lightningNear(region) {
  const [lat, lng] = REGION_CENTERS[region];
  return state.lightning.filter(r => {
    const loc = r.location || r;
    const la = +loc.latitude, lo = +(loc.longitude ?? loc.longtitude);
    return !isNaN(la) && !isNaN(lo) && km(lat, lng, la, lo) <= 10;
  }).length;
}
const verdictText = score => t("verdict." + score);

// ---------- Render ----------
function render() {
  const r = state.region, v = verdict(r);
  const card = $("verdict");
  card.className = "card verdict" + (state.demo ? "" : " s" + v.score);
  $("regionName").textContent = t("region.label", { r: tRegion(r) });
  if (state.demo) {
    $("vIcon").innerHTML = ICONS[1]; $("vText").textContent = t("demo.text"); $("vSub").textContent = t("demo.sub"); $("reasons").innerHTML = "";
  } else {
    $("vIcon").innerHTML = ICONS[v.score];
    $("vText").textContent = verdictText(v.score);
    $("vSub").textContent = t("lead." + v.lead) + (state.stale ? t("stale") : "");
    $("reasons").innerHTML = v.reasons.slice(0, 3).map(k => `<li>${t("r." + k)}</li>`).join("");
  }
  $("sPsi").textContent = v.psi ?? "–"; $("sPsiBand").innerHTML = v.psi != null ? bandHTML(psiBand(v.psi)) : "&nbsp;";
  $("sPm").textContent = v.pm ?? "–"; $("sPmBand").innerHTML = v.pm != null ? bandHTML(pmBand(v.pm)) : "&nbsp;";

  renderScene(r, v);
  renderRegionRow();
  renderMore(v);

  const maxPsi = Math.max(...Object.values(state.psi).filter(x => typeof x === "number"), 0);
  $("banner").hidden = !(maxPsi > 100) || state.demo;
  $("banner").textContent = t("banner.haze", { n: maxPsi });

  renderChart(r);
  renderTips(v.score);
  renderPlan(r);
  renderRoutes();
  renderStatus();
}
function renderStatus() {
  const time = state.fetchedAt ? t("updated", { t: fmtTime(state.fetchedAt, { hour: "numeric", minute: "2-digit" }) }) : "";
  $("updatedTop").textContent = state.demo ? "" : time;
  $("updated").textContent = state.demo ? t("demo.footer") : time;
}
function renderRegionRow() {
  $("regionRow").innerHTML = REGION_ORDER.map(k => {
    const psi = state.psi[k], s = state.loaded && !state.demo ? verdict(k).score : "x";
    return `<button class="rg ${k === state.region ? "on" : ""}" data-r="${k}" aria-pressed="${k === state.region}"><span class="rg-name">${tRegion(k)}</span><span class="rg-val">${psi ?? "–"}</span><i class="s${s}"></i></button>`;
  }).join("");
}
function renderMore(v) {
  const heat = v.heat, wx = twx(v.forecast?.forecast);
  const temp = state.temp != null ? state.temp.toFixed(1) + "°C" : "–";
  $("moreTeaser").textContent = t("more.teaser", { heat: heat ? t("heat." + heat.heatStress) : "–", temp, wx });
  const row = (label, value, sub = "") => `<div><dt>${label}</dt><dd>${value}${sub ? `<small>${sub}</small>` : ""}</dd></div>`;
  $("moreRows").innerHTML = [
    row(t("more.heat"), heat ? `${(+heat.wbgt).toFixed(1)}° · ${t("heat." + heat.heatStress)}` : "–", heat ? t("more.station", { s: heat.station?.townCenter || heat.station?.name || "" }) : ""),
    row(t("more.temp"), temp),
    row(t("more.hum"), state.hum != null ? Math.round(state.hum) + "%" : "–"),
    row(t("more.uv"), state.uv ?? "–"),
    row(t("more.next2h"), wx, v.forecast?.area || ""),
  ].join("");
}

// Animated scene: pace follows the verdict, sky follows the time and live weather.
function renderScene(r, v) {
  const fc = v.forecast?.forecast || "";
  const wx = /thunder/i.test(fc) || lightningNear(r) ? "wx-thunder" : /rain|shower/i.test(fc) ? "wx-rain" : "";
  const hour = (new Date().getUTCHours() + 8) % 24;
  const night = hour >= 19 || hour < 7;
  $("scene").className = `scene s${state.demo ? 0 : v.score} ${wx} ${night ? "night" : ""}`;
  // haze tint thickens with PSI and PM2.5
  const haze = Math.max(((v.psi ?? 0) - 60) / 450, ((v.pm ?? 0) - 40) / 450, 0);
  $("scene").style.setProperty("--haze", Math.min(haze, 0.45).toFixed(2));
}

function renderChart(r) {
  const pts = state.items.map(it => ({ t: new Date(it.timestamp), v: it.readings.pm25_one_hourly?.[r] })).filter(p => typeof p.v === "number");
  if (pts.length < 2) { $("chartBody").innerHTML = `<p class="fine" style="margin:0">${t("chart.notEnough")}</p>`; $("bestTime").textContent = ""; return; }
  const W = 520, H = 200, P = 28;
  const max = Math.max(70, ...pts.map(p => p.v)) * 1.12;
  const x = i => P + (i / (pts.length - 1)) * (W - P * 2);
  const y = v => H - P - (v / max) * (H - P * 2);
  const line = pts.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join("");
  const area = line + `L${x(pts.length - 1)},${H - P}L${x(0)},${H - P}Z`;
  const fmt = d => fmtTime(d, { hour: "numeric" });
  $("chartBody").innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${t("chart.title")}">
    <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--sky)" stop-opacity=".25"/><stop offset="1" stop-color="var(--sky)" stop-opacity="0"/></linearGradient></defs>
    <line x1="${P}" x2="${W - P}" y1="${H - P}" y2="${H - P}" stroke="var(--line)"/>
    <line x1="${P}" x2="${W - P}" y1="${y(55)}" y2="${y(55)}" stroke="var(--muted)" stroke-dasharray="4 4" stroke-opacity=".6"/>
    <text x="${W - P}" y="${y(55) - 6}" text-anchor="end" font-size="11" fill="var(--muted)">${t("chart.threshold")}</text>
    <path d="${area}" fill="url(#g)"/>
    <path d="${line}" fill="none" stroke="var(--sky)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
    ${pts.map((p, i) => `<circle cx="${x(i)}" cy="${y(p.v)}" r="${i === pts.length - 1 ? 4.5 : 3}" fill="${i === pts.length - 1 ? "var(--sky)" : "var(--surface)"}" stroke="var(--sky)" stroke-width="1.5" data-tip="${fmt(p.t)}: ${p.v} µg/m³"/>`).join("")}
    <text x="${P}" y="${H - 8}" font-size="11" fill="var(--muted)">${fmt(pts[0].t)}</text>
    <text x="${W - P}" y="${H - 8}" font-size="11" fill="var(--muted)" text-anchor="end">${fmt(pts[pts.length - 1].t)}</text>
  </svg>`;
  const best = pts.reduce((a, b) => (b.v < a.v ? b : a));
  const trend = pts[pts.length - 1].v - pts[Math.max(0, pts.length - 4)].v;
  $("bestTime").textContent = t("chart.cleanest", { t: fmt(best.t), v: best.v, trend: t(trend > 3 ? "trend.up" : trend < -3 ? "trend.down" : "trend.flat") });
}

function renderTips(score) {
  $("tipsTitle").textContent = t("tips.title." + score);
  $("tips").innerHTML = t("tips." + score).map(x => `<li>${x}</li>`).join("");
}

// ---------- Plan ahead ----------
const wxScore = w => /thunder/i.test(w) ? 2 : /rain|shower/i.test(w) ? 1 : 0;
function renderPlan(r) {
  const periods = state.f24?.periods || [];
  if (!periods.length) { $("tomorrow").innerHTML = `<p class="fine" style="margin:0">${t("plan.none")}</p>`; $("bestTomorrow").textContent = ""; }
  else {
    // NEA periods start at 06:00, 12:00 or 18:00 SGT
    const today = dayKey(new Date());
    const label = p => {
      const isToday = p.timePeriod.start.slice(0, 10) === today, h = p.timePeriod.start.slice(11, 13);
      if (h === "18") return t(isToday ? "when.tonight" : "when.tomorrowNight");
      if (h === "06") return t(isToday ? "when.todayMorning" : "when.tomorrowMorning");
      if (h === "12") return t(isToday ? "when.todayAfternoon" : "when.tomorrowAfternoon");
      return t(isToday ? "when.today" : "when.tomorrow");
    };
    // when the weather ties, prefer cool mornings, then evenings, and avoid midday heat
    const pref = { "06": 0, "18": 0.2, "12": 0.5 };
    const rank = p => wxScore(p.regions?.[r]?.text || "") + (pref[p.timePeriod.start.slice(11, 13)] ?? 0.3);
    const best = periods.reduce((a, b) => (rank(b) < rank(a) ? b : a));
    $("tomorrow").innerHTML = `<div class="periods">${periods.map(p => `<div class="period ${p === best ? "best" : ""}"><b>${label(p)}</b>${twx(p.regions?.[r]?.text)}</div>`).join("")}</div>`;
    const bw = best.regions?.[r]?.text || "";
    $("bestTomorrow").textContent = wxScore(bw) === 2 ? t("plan.storms") : t("plan.best", { w: label(best), wx: twx(bw) });
  }
  // NEA's outlook summary is free text, so only show it in English; other languages get the translated forecast term
  $("outlook").innerHTML = state.outlook.map(d => `<div class="oday"><b>${fmtDate(d.timestamp, { weekday: "short" })}</b>${d.temperature.low}–${d.temperature.high}°<br/><span>${LANG === "en" ? d.forecast.summary || d.forecast.text : twx(d.forecast.text)}</span></div>`).join("");
}

// ---------- Routes ----------
// names and descriptions live in i18n.js under route.<id> / route.<id>.d
const ROUTES = [
  { id: "ecp", r: "east" }, { id: "mac", r: "central" }, { id: "sr", r: "south" },
  { id: "mb", r: "south" }, { id: "bamk", r: "central" }, { id: "pgl", r: "east" },
  { id: "jlg", r: "west" }, { id: "rc", r: "west" }, { id: "wdl", r: "north" },
];
function renderRoutes() {
  const good = ROUTES.filter(rt => verdict(rt.r).score === 0).length;
  $("routesTeaser").textContent = t("routes.teaser", { n: good, total: ROUTES.length });
  $("routes").innerHTML = ROUTES.map((rt, i) => {
    const v = verdict(rt.r), psi = state.psi[rt.r];
    return `<button class="route" data-i="${i}"><span class="rn"><b>${t("route." + rt.id)}</b><small>${t("route." + rt.id + ".d")} · ${tRegion(rt.r)}${psi != null ? " · PSI " + psi : ""}</small></span><span class="band b${v.score}">${verdictText(v.score)}</span></button>`;
  }).join("");
}
$("routes").onclick = e => {
  const b = e.target.closest(".route"); if (!b) return;
  const rt = ROUTES[b.dataset.i];
  setRegion(rt.r); window.scrollTo({ top: 0, behavior: "smooth" });
  toast(t("routes.showing", { r: tRegion(rt.r), route: t("route." + rt.id) }));
};

// ---------- Modal ----------
function openModal(html, view = "") { $("modalBody").innerHTML = html; $("modalBody").dataset.view = view; $("modal").hidden = false; }
$("modalClose").onclick = () => ($("modal").hidden = true);
$("modal").onclick = e => { if (e.target.id === "modal") $("modal").hidden = true; };

// ---------- Share image: clean summary card ----------
const SHARE_COLORS = { 0: "#1e9e5a", 1: "#c98a00", 2: "#d64545" };
function wrapText(g, text, maxW) {
  const words = /\s/.test(text) ? text.split(" ") : [...text]; // CJK has no spaces: wrap by character
  const sep = /\s/.test(text) ? " " : "";
  const lines = []; let cur = "";
  words.forEach(w => { const next = cur ? cur + sep + w : w; if (g.measureText(next).width > maxW && cur) { lines.push(cur); cur = w; } else cur = next; });
  if (cur) lines.push(cur);
  return lines;
}
function drawShareCard({ color, kicker, big, lead, stats, foot }) {
  const W = 1080, H = 1080, c = document.createElement("canvas"); c.width = W; c.height = H;
  const g = c.getContext("2d"), ink = "#0f2a44", muted = "#5b7085", F = "Inter, 'Noto Sans Tamil', sans-serif";
  g.fillStyle = "#f5f9fc"; g.fillRect(0, 0, W, H);
  g.fillStyle = "#ffffff"; g.beginPath(); g.roundRect(60, 60, W - 120, H - 120, 40); g.fill();
  g.fillStyle = color; g.beginPath(); g.roundRect(60, 60, W - 120, 16, [40, 40, 0, 0]); g.fill();
  g.textAlign = "left";
  g.fillStyle = muted; g.font = `600 36px ${F}`; g.fillText(t("app.name") + " · " + t("app.place"), 120, 170);
  g.font = `500 34px ${F}`; g.fillText(kicker, 120, 222);
  let size = 170;
  do { g.font = `800 ${size}px ${F}`; size -= 10; } while (g.measureText(big).width > W - 240 && size > 60);
  g.fillStyle = color; g.fillText(big, 112, 420);
  g.fillStyle = ink; g.font = `500 44px ${F}`;
  wrapText(g, lead, W - 240).slice(0, 2).forEach((l, i) => g.fillText(l, 120, 510 + i * 60));
  const boxW = (W - 240 - 30) / 2;
  stats.slice(0, 2).forEach((s, i) => {
    const x = 120 + i * (boxW + 30);
    g.fillStyle = "#eef4f9"; g.beginPath(); g.roundRect(x, 650, boxW, 200, 24); g.fill();
    g.fillStyle = muted; g.font = `600 32px ${F}`; g.fillText(s.label, x + 32, 705);
    g.fillStyle = ink; g.font = `700 84px ${F}`; g.fillText(String(s.value), x + 32, 800);
    if (s.note) { g.fillStyle = muted; g.font = `500 28px ${F}`; g.fillText(s.note, x + 32, 838); }
  });
  g.fillStyle = muted; g.font = `500 32px ${F}`;
  if (foot) g.fillText(foot, 120, 920);
  g.fillStyle = "#1b6fa3"; g.font = `600 32px ${F}`; g.fillText(location.host, 120, 975);
  return c;
}
async function shareCanvas(c, text, filename) {
  const blob = await new Promise(res => c.toBlob(res, "image/png"));
  const file = new File([blob], filename, { type: "image/png" });
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], text: text + " " + location.origin }); return; } catch (e) { if (e.name === "AbortError") return; }
  }
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = filename; a.click();
  toast(t("share.saved"));
}
function previewAndShare(c, text, filename) {
  openModal(`<h2>${t("share.title")}</h2><div id="cardSlot" style="margin:12px 0"></div><button class="btn primary" id="doShare" style="width:100%">${t("share.save")}</button>`);
  $("cardSlot").appendChild(c);
  $("doShare").onclick = () => shareCanvas(c, text, filename);
}
$("shareBtn").onclick = async () => {
  if (!state.loaded || state.demo) return;
  await document.fonts?.ready;
  const r = state.region, v = verdict(r), s = streakStats(loadRuns()), today = dayKey(new Date());
  const heat = v.heat ? `${t("share.heat")}: ${t("heat." + v.heat.heatStress)} (WBGT ${(+v.heat.wbgt).toFixed(1)}°)` : "";
  const c = drawShareCard({
    color: SHARE_COLORS[v.score],
    kicker: `${t("region.label", { r: tRegion(r) })} · ${fmtDate(Date.now(), { day: "numeric", month: "short", year: "numeric" })} · ${fmtTime(state.fetchedAt, { hour: "numeric", minute: "2-digit" })}`,
    big: verdictText(v.score), lead: t("lead." + v.lead),
    stats: [{ label: t("key.psi"), value: v.psi ?? "–", note: v.psi != null ? psiBand(v.psi).name : "" }, { label: t("key.pm"), value: v.pm ?? "–", note: v.pm != null ? pmBand(v.pm).name + " · µg/m³" : "" }],
    foot: [heat, s.streak ? t("share.streak", { n: s.streak }) : ""].filter(Boolean).join(" · "),
  });
  previewAndShare(c, t("share.text", { v: verdictText(v.score) }), `can-i-run-${r}-${today}.png`);
};

// ---------- Monthly recap ----------
function monthStats(runs, month) {
  const days = Object.keys(runs).filter(k => k.startsWith(month)).sort();
  let best = 0, cur = 0, prev = null;
  days.forEach(k => { cur = prev && Date.parse(k) - Date.parse(prev) === 864e5 ? cur + 1 : 1; best = Math.max(best, cur); prev = k; });
  return { active: days.length, runs: days.filter(k => runs[k] === "run").length, indoor: days.filter(k => runs[k] !== "run").length, haze: days.filter(k => runs[k] === "haze").length, best };
}
$("recapBtn").onclick = () => {
  const runs = loadRuns(), today = dayKey(new Date()), month = today.slice(0, 7);
  const [y, m] = month.split("-").map(Number);
  const lastMonth = new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 7);
  const s = monthStats(runs, month), p = monthStats(runs, lastMonth);
  const name = fmtDate(Date.UTC(y, m - 1, 1), { month: "long", timeZone: "UTC" });
  const diff = s.active - p.active;
  const vibe = t("recap.vibe." + (s.active === 0 ? 0 : s.active >= 20 ? 4 : s.active >= 12 ? 3 : s.active >= 5 ? 2 : 1));
  openModal(`<h2>${t("recap.title", { m: name })}</h2>
    <div class="recap-grid">
      <div><b>${s.active}</b>${t("recap.active")}</div><div><b>${s.runs}</b>${t("recap.outdoor")}</div>
      <div><b>${s.indoor}</b>${t("recap.indoor")}</div><div><b>${s.best}</b>${t("recap.best")}</div>
    </div>
    ${s.haze ? `<p>${t("recap.haze", { n: s.haze })}</p>` : ""}
    <p>${p.active ? (diff > 0 ? t("recap.more", { n: diff }) : diff < 0 ? t("recap.fewer", { n: -diff }) : t("recap.same")) : ""}</p>
    <p style="color:var(--ink);font-weight:600">${vibe}</p>
    <button class="btn primary" id="shareRecap" style="width:100%;margin-top:8px">${t("recap.share")}</button>`);
  $("shareRecap").onclick = async () => {
    await document.fonts?.ready;
    const c = drawShareCard({ color: "#2d9cdb", kicker: t("recap.kicker", { m: name }), big: t("recap.days", { n: s.active }), lead: vibe,
      stats: [{ label: t("recap.outdoor"), value: s.runs }, { label: t("recap.best"), value: s.best }], foot: t("recap.line1", { r: s.runs, i: s.indoor }) });
    shareCanvas(c, t("recap.shareText", { m: name }), `can-i-run-recap-${month}.png`);
  };
};

// ---------- Streak ----------
function dayKey(d) { return new Date(d.getTime() + 8 * 3600e3).toISOString().slice(0, 10); }
// runs = { "2026-10-15": "run" | "indoor" | "haze" }  ("haze" = indoor workout on a Nope day)
function loadRuns() {
  let r = JSON.parse(localStorage.getItem("runs") || "{}");
  if (Array.isArray(r)) r = Object.fromEntries(r.map(k => [k, "run"])); // migrate old format
  return r;
}
function streakStats(runs) {
  const days = Object.keys(runs).sort();
  let streak = 0, d = new Date();
  if (!runs[dayKey(d)]) d = new Date(d - 864e5); // streak still alive if you logged yesterday
  while (runs[dayKey(d)]) { streak++; d = new Date(d - 864e5); }
  let best = 0, cur = 0, prev = null;
  days.forEach(k => {
    cur = prev && Date.parse(k) - Date.parse(prev) === 864e5 ? cur + 1 : 1;
    best = Math.max(best, cur); prev = k;
  });
  const vals = Object.values(runs);
  return { streak, best, total: days.length, outdoor: vals.filter(v => v === "run").length, haze: vals.filter(v => v === "haze").length };
}
// names and descriptions live in i18n.js under badge.<id> / badge.<id>.d
const BADGES = [
  { id: "first", icon: "👟", ok: s => s.total >= 1 },
  { id: "s3", icon: "🔥", ok: s => s.best >= 3 },
  { id: "s7", icon: "⚡", ok: s => s.best >= 7 },
  { id: "s30", icon: "👑", ok: s => s.best >= 30 },
  { id: "r10", icon: "🏃", ok: s => s.outdoor >= 10 },
  { id: "r50", icon: "🥇", ok: s => s.outdoor >= 50 },
  { id: "haze", icon: "🛡️", ok: s => s.haze >= 1 },
];
const badgeName = b => t("badge." + b.id);
function renderStreak(celebrate) {
  const runs = loadRuns(), s = streakStats(runs), today = dayKey(new Date()), month = today.slice(0, 7);
  const monthCount = Object.keys(runs).filter(k => k.startsWith(month)).length;
  $("runsLine").textContent = s.total ? t("runs.line", { n: s.streak, b: s.best, m: monthCount }) : t("runs.empty");
  $("calFold").hidden = !s.total;

  // month calendar, Monday first
  const [y, m] = month.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1)), daysIn = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const pad = (first.getUTCDay() + 6) % 7;
  let cells = [...t("runs.weekdays")].map(c => `<div class="dow">${c}</div>`).join("") + "<div></div>".repeat(pad);
  for (let i = 1; i <= daysIn; i++) {
    const k = `${month}-${String(i).padStart(2, "0")}`, v = runs[k];
    cells += `<div class="cday ${v ? (v === "run" ? "done" : "indoor") : ""} ${k === today ? "today" : ""}" data-tip="${k}${v ? ": " + t(v === "run" ? "runs.tipRun" : "runs.tipIndoor") : ""}">${i}</div>`;
  }
  $("cal").innerHTML = cells;
  $("calTitle").textContent = fmtDate(first, { month: "long", year: "numeric", timeZone: "UTC" });

  // badges
  const had = JSON.parse(localStorage.getItem("badges") || "[]");
  const earned = BADGES.filter(b => b.ok(s)).map(b => b.id);
  $("badges").innerHTML = BADGES.map(b => `<div class="badge ${earned.includes(b.id) ? "got" : ""}" data-tip="${badgeName(b)}: ${t("badge." + b.id + ".d")}">${b.icon}</div>`).join("");
  $("badgeTeaser").textContent = t("fold.badges", { n: earned.length, total: BADGES.length });
  const fresh = BADGES.filter(b => earned.includes(b.id) && !had.includes(b.id));
  localStorage.setItem("badges", JSON.stringify(earned));
  if (celebrate && fresh.length) toast(t("badge.unlocked", { list: fresh.map(badgeName).join(", ") }));

  const v = runs[today];
  $("ranBtn").textContent = t(v === "run" ? "runs.ranUndo" : "runs.ran");
  $("indoorBtn").textContent = t(v && v !== "run" ? "runs.indoorUndo" : "runs.indoor");
}
function logToday(type) {
  const runs = loadRuns(), today = dayKey(new Date());
  const isSame = type === "run" ? runs[today] === "run" : runs[today] && runs[today] !== "run";
  if (isSame) delete runs[today];
  else {
    runs[today] = type === "run" ? "run" : verdict(state.region).score === 2 && !state.demo ? "haze" : "indoor";
    confetti();
  }
  localStorage.setItem("runs", JSON.stringify(runs));
  renderStreak(true);
}
$("ranBtn").onclick = () => logToday("run");
$("indoorBtn").onclick = () => logToday("indoor");
function toast(msg) {
  const el = $("toast");
  el.textContent = msg; el.classList.add("show");
  clearTimeout(toast.timer); toast.timer = setTimeout(() => el.classList.remove("show"), 3200);
}
function confetti() {
  const colors = ["#2d9cdb", "#ff7a59", "#1e9e5a", "#0f2a44"];
  for (let i = 0; i < 28; i++) {
    const s = document.createElement("span");
    s.className = "confetti"; s.style.background = colors[i % colors.length];
    s.style.left = Math.random() * 100 + "vw";
    s.style.animationDuration = 1.4 + Math.random() * 1.6 + "s";
    document.body.appendChild(s); setTimeout(() => s.remove(), 3200);
  }
}

// ---------- Interactions ----------
$("regionRow").onclick = e => { const b = e.target.closest("[data-r]"); if (b) setRegion(b.dataset.r); };
$("refresh").onclick = load;
function setTheme(dark) {
  document.body.classList.toggle("dark", dark);
  localStorage.setItem("dark", dark ? "1" : "0");
  $("theme").innerHTML = dark ? ICONS.sun : ICONS.moon;
  $("themeColor").content = dark ? "#0c1622" : "#f5f9fc";
}
$("theme").onclick = () => setTheme(!document.body.classList.contains("dark"));
setTheme(localStorage.getItem("dark") === "1");
function setRegion(r) {
  state.region = r; localStorage.setItem("region", r);
  if (state.loaded) render(); else renderRegionRow();
}
function locateMe(done) {
  if (!navigator.geolocation) { toast(t("geo.none")); return; }
  navigator.geolocation.getCurrentPosition(pos => {
    const { latitude: la, longitude: lo } = pos.coords;
    setRegion(REGIONS.reduce((a, b) => (km(la, lo, ...REGION_CENTERS[b]) < km(la, lo, ...REGION_CENTERS[a]) ? b : a)));
    toast(t("geo.found", { r: tRegion(state.region) }));
    done?.();
  }, () => toast(t("geo.fail")));
}
$("locate").onclick = () => locateMe();

// ---------- Language ----------
const langButtons = () => `<div class="seg welcome-langs">${LANGS.map(l => `<button class="${l === LANG ? "on" : ""}" data-setlang="${l}" lang="${l}">${I18N[l]["lang.name"]}</button>`).join("")}</div>`;
function applyStatic() {
  document.documentElement.lang = LANG;
  document.title = t("app.plain") + " · " + t("app.place");
  document.querySelectorAll("[data-i18n]").forEach(el => (el.textContent = t(el.dataset.i18n)));
  document.querySelectorAll("[data-i18n-html]").forEach(el => (el.innerHTML = t(el.dataset.i18nHtml)));
  document.querySelectorAll("[data-i18n-aria]").forEach(el => el.setAttribute("aria-label", t(el.dataset.i18nAria)));
  document.querySelectorAll(".top [data-lang]").forEach(b => b.classList.toggle("on", b.dataset.lang === LANG));
  $("regionName").textContent = t("region.label", { r: tRegion(state.region) });
  renderRegionRow();
}
function setLang(l) {
  if (!LANGS.includes(l) || l === LANG) return;
  LANG = l; localStorage.setItem("lang", l);
  applyStatic();
  renderStreak();
  showInstall();
  if (state.loaded) render();
  const view = $("modal").hidden ? "" : $("modalBody").dataset.view;
  if (view === "welcome") welcome(); else if (view === "guide") iosGuide(); else $("modal").hidden = true; // other dialogs hold text in the old language
}
document.querySelector(".top .seg").onclick = e => { const b = e.target.closest("[data-lang]"); if (b) setLang(b.dataset.lang); };

// ---------- First visit ----------
function welcome() {
  openModal(`${langButtons()}
    <h2>${t("welcome.title")}</h2>
    <p>${t("welcome.intro")}</p>
    <p style="color:var(--ink);font-weight:600;margin-top:16px">${t("welcome.where")}</p>
    <div class="pick">${REGION_ORDER.map(r => `<button class="btn" data-r="${r}">${tRegion(r)}</button>`).join("")}
      <button class="btn primary" id="wLocate">${t("btn.locate")}</button></div>
    <p class="fine">${t("welcome.hint")}</p>`, "welcome");
  const close = () => { $("modal").hidden = true; localStorage.setItem("welcomed", "1"); };
  $("wLocate").onclick = () => locateMe(close);
  $("modalBody").querySelectorAll("[data-r]").forEach(b => b.onclick = () => { setRegion(b.dataset.r); close(); });
  $("modalBody").querySelectorAll("[data-setlang]").forEach(b => b.onclick = () => setLang(b.dataset.setlang));
}

// ---------- Install prompt ----------
const isStandalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone;
const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
let installEvent = null;
function showInstall() {
  if (isStandalone || localStorage.getItem("installDismissed")) return;
  if (installEvent) $("installBtn").textContent = t("install.btn");
  else if (isIOS) $("installBtn").textContent = t("install.how");
  else return;
  $("installBtn").hidden = false;
  $("installBar").hidden = false;
}
// Most in-app browsers (WhatsApp, Telegram, Instagram…) can't add to home screen, so step 1 is "open in Safari"
const isInApp = /FBAN|FBAV|Instagram|Line\/|Telegram|WhatsApp|GSA\//i.test(navigator.userAgent);
function iosGuide() {
  const step = (n, title, body) => `<div class="step"><span class="stepn">${n}</span><div><b>${title}</b><div>${body}</div></div></div>`;
  openModal(`<h2>${t("guide.title")}</h2>
    <p>${t("guide.sub")}</p>
    <div class="steps">
      ${step(1, t("guide.1"), t(isInApp ? "guide.1.inapp" : "guide.1.maybe"))}
      ${step(2, t("guide.2"), t("guide.2.d"))}
      ${step(3, t("guide.3"), t("guide.3.d"))}
      ${step(4, t("guide.4"), t("guide.4.d"))}
    </div>
    <button class="btn" id="copyLink" style="width:100%">${t("guide.copy")}</button>`, "guide");
  $("copyLink").onclick = async () => {
    try { await navigator.clipboard.writeText(location.origin); toast(t("guide.copied")); }
    catch { toast(location.host); }
  };
}
addEventListener("beforeinstallprompt", e => { e.preventDefault(); installEvent = e; showInstall(); });
addEventListener("appinstalled", () => { $("installBar").hidden = true; toast(t("installed")); });
$("installBtn").onclick = async () => { if (!installEvent) return iosGuide(); installEvent.prompt(); await installEvent.userChoice; installEvent = null; $("installBar").hidden = true; };
$("installX").onclick = () => { $("installBar").hidden = true; localStorage.setItem("installDismissed", "1"); };

const tip = $("tip");
document.addEventListener("mousemove", e => {
  const el = e.target.closest?.("[data-tip]");
  if (el) { tip.textContent = el.dataset.tip; tip.style.left = e.clientX + 12 + "px"; tip.style.top = e.clientY + 12 + "px"; tip.style.opacity = 1; }
  else tip.style.opacity = 0;
});
$("excuse").onclick = () => { const ex = t("excuses"); $("excuseText").textContent = t("excuse.wrap", { e: ex[Math.floor(Math.random() * ex.length)] }); };

applyStatic();
showInstall();
renderStreak();
paintCached();
load();
if (!localStorage.getItem("welcomed") && !localStorage.getItem("region")) welcome();
setInterval(load, 15 * 60 * 1000);
if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js");
