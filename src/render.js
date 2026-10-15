// Draws the page from `state`. Nothing in here changes state or talks to the network.
import { state, reportFor } from "./state.js";
import { $, ICONS } from "./dom.js";
import { t, tRegion, twx, fmtTime, fmtDate, getLang } from "./i18n.js";
import { psiBand, pmBand } from "./verdict.js";
import { REGIONS } from "./regions.js";
import { bestPeriod, periodKey, weatherSeverity } from "./forecast.js";
import { BADGES, dayKey, streakStats } from "./streak.js";

// Popular runs and the NEA region each falls in. Names live in strings.js under route.<id>.
export const ROUTES = [
  { id: "ecp", region: "east" }, { id: "mac", region: "central" }, { id: "sr", region: "south" },
  { id: "mb", region: "south" }, { id: "bamk", region: "central" }, { id: "pgl", region: "east" },
  { id: "jlg", region: "west" }, { id: "rc", region: "west" }, { id: "wdl", region: "north" },
];

const bandLabel = (key, severity) => `<span class="band b${severity}">${t(key)}</span>`;
const time = d => fmtTime(d, { hour: "numeric", minute: "2-digit" });

/** Text that doesn't depend on data: labels, headings, the language switcher. */
export function renderStatic() {
  const lang = getLang();
  document.documentElement.lang = lang;
  document.title = `${t("app.plain")} · ${t("app.place")}`;
  document.querySelectorAll("[data-i18n]").forEach(el => (el.textContent = t(el.dataset.i18n)));
  document.querySelectorAll("[data-i18n-html]").forEach(el => (el.innerHTML = t(el.dataset.i18nHtml)));
  document.querySelectorAll("[data-i18n-aria]").forEach(el => el.setAttribute("aria-label", t(el.dataset.i18nAria)));
  document.querySelectorAll(".top [data-lang]").forEach(b => b.classList.toggle("on", b.dataset.lang === lang));
  $("regionName").textContent = t("region.label", { r: tRegion(state.region) });
  renderRegionRow();
}

export function render() {
  const c = state.conditions;
  if (!c) return renderRegionRow();
  document.body.classList.remove("loading");
  const report = reportFor(state.region);

  renderVerdict(report, c.demo);
  renderScene(report, c.demo);
  renderRegionRow();
  renderDetails(report);
  renderHazeBanner(c);
  renderChart(c.pmHistory, state.region);
  renderPlan(c, state.region);
  renderRoutes();
  renderTips(report.score);
  renderUpdated(c);
}

function renderVerdict(r, demo) {
  $("verdict").className = "card verdict" + (demo ? "" : ` s${r.score}`);
  $("regionName").textContent = t("region.label", { r: tRegion(state.region) });
  if (demo) {
    $("vIcon").innerHTML = ICONS.verdict[1];
    $("vText").textContent = t("demo.text");
    $("vSub").textContent = t("demo.sub");
    $("reasons").innerHTML = "";
  } else {
    $("vIcon").innerHTML = ICONS.verdict[r.score];
    $("vText").textContent = t("verdict." + r.score);
    $("vSub").textContent = t("lead." + r.lead) + (state.stale ? t("stale") : "");
    $("reasons").innerHTML = r.reasons.slice(0, 3).map(k => `<li>${t("r." + k)}</li>`).join("");
  }
  const psi = r.psi != null ? psiBand(r.psi) : null, pm = r.pm != null ? pmBand(r.pm) : null;
  $("sPsi").textContent = r.psi ?? "–";
  $("sPsiBand").innerHTML = psi ? bandLabel(psi.key, psi.severity) : "&nbsp;";
  $("sPm").textContent = r.pm ?? "–";
  $("sPmBand").innerHTML = pm ? bandLabel(pm.key, pm.severity) : "&nbsp;";
}

// The animated strip: pace follows the verdict, sky follows the time and live weather.
function renderScene(r, demo) {
  const weather = r.lightning || /thunder/i.test(r.forecast) ? "wx-thunder" : /rain|shower/i.test(r.forecast) ? "wx-rain" : "";
  const hour = (new Date().getUTCHours() + 8) % 24;
  const night = hour >= 19 || hour < 7;
  const scene = $("scene");
  scene.className = `scene s${demo ? 0 : r.score} ${weather} ${night ? "night" : ""}`;
  // Haze tint thickens with PSI and PM2.5.
  const haze = Math.max(((r.psi ?? 0) - 60) / 450, ((r.pm ?? 0) - 40) / 450, 0);
  scene.style.setProperty("--haze", Math.min(haze, 0.45).toFixed(2));
}

export function renderRegionRow() {
  const c = state.conditions;
  $("regionRow").innerHTML = REGIONS.map(region => {
    const score = c && !c.demo ? reportFor(region).score : "x";
    const selected = region === state.region;
    return `<button class="rg ${selected ? "on" : ""}" data-region="${region}" aria-pressed="${selected}">
      <span class="rg-name">${tRegion(region)}</span><span class="rg-val">${c?.psi[region] ?? "–"}</span><i class="s${score}"></i></button>`;
  }).join("");
}

function renderDetails(r) {
  const c = state.conditions;
  const heat = r.wbgt;
  const temp = c.temp != null ? c.temp.toFixed(1) + "°C" : "–";
  const weather = twx(r.forecast);
  $("moreTeaser").textContent = t("more.teaser", { heat: heat ? t("heat." + heat.heatStress) : "–", temp, wx: weather });
  const row = (label, value, note = "") => `<div><dt>${label}</dt><dd>${value}${note ? `<small>${note}</small>` : ""}</dd></div>`;
  $("moreRows").innerHTML = [
    row(t("more.heat"),
      heat ? `${(+heat.wbgt).toFixed(1)}° · ${t("heat." + heat.heatStress)}` : "–",
      heat ? t("more.station", { s: heat.station?.townCenter || heat.station?.name || "" }) : ""),
    row(t("more.temp"), temp),
    row(t("more.hum"), c.humidity != null ? Math.round(c.humidity) + "%" : "–"),
    row(t("more.uv"), c.uv ?? "–"),
    row(t("more.next2h"), weather, r.nowcast?.area ?? ""),
  ].join("");
}

function renderHazeBanner(c) {
  const worst = Math.max(0, ...Object.values(c.psi).filter(Number.isFinite));
  $("banner").hidden = c.demo || worst <= 100;
  $("banner").textContent = t("banner.haze", { n: worst });
}

function renderChart(history, region) {
  const points = history
    .map(h => ({ at: new Date(h.timestamp), value: h.readings.pm25_one_hourly?.[region] }))
    .filter(p => Number.isFinite(p.value));
  if (points.length < 2) {
    $("chartBody").innerHTML = `<p class="fine" style="margin:0">${t("chart.notEnough")}</p>`;
    $("bestTime").textContent = "";
    return;
  }
  const W = 520, H = 200, P = 28;
  const max = Math.max(70, ...points.map(p => p.value)) * 1.12;
  const x = i => P + (i / (points.length - 1)) * (W - P * 2);
  const y = v => H - P - (v / max) * (H - P * 2);
  const line = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join("");
  const area = `${line}L${x(points.length - 1)},${H - P}L${x(0)},${H - P}Z`;
  const hour = d => fmtTime(d, { hour: "numeric" });
  const last = points.length - 1;
  $("chartBody").innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${t("chart.title")}">
    <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--sky)" stop-opacity=".25"/><stop offset="1" stop-color="var(--sky)" stop-opacity="0"/></linearGradient></defs>
    <line x1="${P}" x2="${W - P}" y1="${H - P}" y2="${H - P}" stroke="var(--line)"/>
    <line x1="${P}" x2="${W - P}" y1="${y(55)}" y2="${y(55)}" stroke="var(--muted)" stroke-dasharray="4 4" stroke-opacity=".6"/>
    <text x="${W - P}" y="${y(55) - 6}" text-anchor="end" font-size="11" fill="var(--muted)">${t("chart.threshold")}</text>
    <path d="${area}" fill="url(#g)"/>
    <path d="${line}" fill="none" stroke="var(--sky)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
    ${points.map((p, i) => `<circle cx="${x(i)}" cy="${y(p.value)}" r="${i === last ? 4.5 : 3}" fill="${i === last ? "var(--sky)" : "var(--surface)"}" stroke="var(--sky)" stroke-width="1.5" data-tip="${hour(p.at)}: ${p.value} µg/m³"/>`).join("")}
    <text x="${P}" y="${H - 8}" font-size="11" fill="var(--muted)">${hour(points[0].at)}</text>
    <text x="${W - P}" y="${H - 8}" font-size="11" fill="var(--muted)" text-anchor="end">${hour(points[last].at)}</text>
  </svg>`;
  const lowest = points.reduce((a, b) => (b.value < a.value ? b : a));
  const change = points[last].value - points[Math.max(0, last - 3)].value;
  const trend = change > 3 ? "trend.up" : change < -3 ? "trend.down" : "trend.flat";
  $("bestTime").textContent = t("chart.cleanest", { t: hour(lowest.at), v: lowest.value, trend: t(trend) });
}

function renderPlan(c, region) {
  const periods = c.forecast24?.periods ?? [];
  if (!periods.length) {
    $("tomorrow").innerHTML = `<p class="fine" style="margin:0">${t("plan.none")}</p>`;
    $("bestTomorrow").textContent = "";
  } else {
    const today = dayKey(new Date());
    const best = bestPeriod(periods, region);
    $("tomorrow").innerHTML = `<div class="periods">${periods.map(p =>
      `<div class="period ${p === best ? "best" : ""}"><b>${t(periodKey(p, today))}</b>${twx(p.regions?.[region]?.text)}</div>`).join("")}</div>`;
    const bestWeather = best.regions?.[region]?.text ?? "";
    $("bestTomorrow").textContent = weatherSeverity(bestWeather) === 2
      ? t("plan.storms")
      : t("plan.best", { w: t(periodKey(best, today)), wx: twx(bestWeather) });
  }
  // NEA's outlook summary is free English text; other languages get the translated forecast term.
  $("outlook").innerHTML = c.outlook.map(d => `<div class="oday"><b>${fmtDate(d.timestamp, { weekday: "short" })}</b>
    ${d.temperature.low}–${d.temperature.high}°<br/><span>${getLang() === "en" ? d.forecast.summary || d.forecast.text : twx(d.forecast.text)}</span></div>`).join("");
}

function renderRoutes() {
  const reports = Object.fromEntries(REGIONS.map(r => [r, reportFor(r)]));
  const good = ROUTES.filter(route => reports[route.region].score === 0).length;
  $("routesTeaser").textContent = t("routes.teaser", { n: good, total: ROUTES.length });
  $("routes").innerHTML = ROUTES.map((route, i) => {
    const r = reports[route.region];
    return `<button class="route" data-route="${i}"><span class="rn"><b>${t("route." + route.id)}</b>
      <small>${t("route." + route.id + ".d")} · ${tRegion(route.region)}${r.psi != null ? " · PSI " + r.psi : ""}</small></span>
      <span class="band b${r.score}">${t("verdict." + r.score)}</span></button>`;
  }).join("");
}

function renderTips(score) {
  $("tipsTitle").textContent = t("tips.title." + score);
  $("tips").innerHTML = t("tips." + score).map(tip => `<li>${tip}</li>`).join("");
}

function renderUpdated(c) {
  const updated = t("updated", { t: time(c.fetchedAt) });
  $("updatedTop").textContent = c.demo ? "" : updated;
  $("updated").textContent = c.demo ? t("demo.footer") : updated;
}

export function renderRuns(log) {
  const stats = streakStats(log), today = dayKey(new Date()), month = today.slice(0, 7);
  const thisMonth = Object.keys(log).filter(d => d.startsWith(month)).length;
  $("runsLine").textContent = stats.total ? t("runs.line", { n: stats.streak, b: stats.best, m: thisMonth }) : t("runs.empty");
  $("calFold").hidden = !stats.total;

  // Month calendar, Monday first.
  const [y, m] = month.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const blanks = (first.getUTCDay() + 6) % 7;
  let cells = [...t("runs.weekdays")].map(d => `<div class="dow">${d}</div>`).join("") + "<div></div>".repeat(blanks);
  for (let day = 1; day <= daysInMonth; day++) {
    const key = `${month}-${String(day).padStart(2, "0")}`, entry = log[key];
    const kind = entry ? (entry === "run" ? "done" : "indoor") : "";
    const tip = entry ? `${key}: ${t(entry === "run" ? "runs.tipRun" : "runs.tipIndoor")}` : key;
    cells += `<div class="cday ${kind} ${key === today ? "today" : ""}" data-tip="${tip}">${day}</div>`;
  }
  $("cal").innerHTML = cells;
  $("calTitle").textContent = fmtDate(first, { month: "long", year: "numeric", timeZone: "UTC" });

  const earned = BADGES.filter(b => b.earned(stats));
  $("badges").innerHTML = BADGES.map(b =>
    `<div class="badge ${earned.includes(b) ? "got" : ""}" data-tip="${t("badge." + b.id)}: ${t("badge." + b.id + ".d")}">${b.icon}</div>`).join("");
  $("badgeTeaser").textContent = t("fold.badges", { n: earned.length, total: BADGES.length });

  const entry = log[today];
  $("ranBtn").textContent = t(entry === "run" ? "runs.ranUndo" : "runs.ran");
  $("indoorBtn").textContent = t(entry && entry !== "run" ? "runs.indoorUndo" : "runs.indoor");
}

