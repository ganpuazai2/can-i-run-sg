// Entry point: loads data, wires up controls, and keeps the page in sync.
import { state, reportFor } from "./state.js";
import { $, ICONS, toast, openModal, openModalView, confetti } from "./dom.js";
import { t, tRegion, fmtDate, fmtTime, getLang, setLanguage, LANGS } from "./i18n.js";
import { REGIONS, nearestRegion } from "./regions.js";
import { parseConditions, demoConditions } from "./conditions.js";
import { psiBand, pmBand } from "./verdict.js";
import { BADGES, dayKey, loadLog, saveLog, monthStats, streakStats, toggleToday } from "./streak.js";
import { drawShareCard, shareImage, VERDICT_COLORS, RECAP_COLOR } from "./share.js";
import { render, renderStatic, renderRegionRow, renderRuns, ROUTES } from "./render.js";
import { showWelcome, showInstallGuide, renderInstallBar, setUpInstall } from "./onboarding.js";

const REFRESH_MS = 15 * 60 * 1000;

// ---------- Startup preferences: link parameters win over saved settings ----------
const params = new URLSearchParams(location.search);
if (REGIONS.includes(params.get("region"))) {
  localStorage.setItem("region", params.get("region"));
  localStorage.setItem("welcomed", "1");
}
const preferredLang = [params.get("lang"), localStorage.getItem("lang"), navigator.language?.slice(0, 2)].find(l => LANGS.includes(l));
setLanguage(preferredLang ?? "en");
if (params.get("lang") === getLang()) localStorage.setItem("lang", getLang());
state.region = REGIONS.includes(localStorage.getItem("region")) ? localStorage.getItem("region") : "central";

// ---------- Data ----------
// One request to our edge-cached proxy (api/conditions.js), which combines six NEA APIs.
let loading = false;
async function load() {
  if (loading) return;
  loading = true;
  $("refresh").disabled = true;
  try {
    const res = await fetch("/api/conditions");
    if (!res.ok) throw new Error(res.status);
    const raw = await res.json();
    localStorage.setItem("conditions", JSON.stringify(raw));
    show(raw, false);
  } catch {
    // Offline or NEA down: fall back to the last good response, then to sample data.
    show(JSON.parse(localStorage.getItem("conditions") || "{}"), true);
  } finally {
    loading = false;
    $("refresh").disabled = false;
  }
}

function show(raw, stale) {
  state.conditions = parseConditions(raw) ?? demoConditions();
  state.stale = stale;
  render();
}

// ---------- Region, language, theme ----------
function setRegion(region) {
  state.region = region;
  localStorage.setItem("region", region);
  if (state.conditions) render(); else renderRegionRow();
}

function locate(done) {
  if (!navigator.geolocation) return toast(t("geo.none"));
  navigator.geolocation.getCurrentPosition(
    ({ coords }) => {
      setRegion(nearestRegion(coords.latitude, coords.longitude));
      toast(t("geo.found", { r: tRegion(state.region) }));
      done?.();
    },
    () => toast(t("geo.fail")),
  );
}

function changeLanguage(lang) {
  if (lang === getLang()) return;
  setLanguage(lang);
  localStorage.setItem("lang", lang);
  renderStatic();
  renderRuns(loadLog());
  renderInstallBar();
  render();
  // Re-open dialogs that can be redrawn; close the rest, as they hold text in the old language.
  const view = openModalView();
  if (view === "welcome") welcome();
  else if (view === "guide") showInstallGuide();
  else $("modal").hidden = true;
}

function setTheme(dark) {
  document.body.classList.toggle("dark", dark);
  localStorage.setItem("dark", dark ? "1" : "0");
  $("theme").innerHTML = dark ? ICONS.sun : ICONS.moon;
  $("themeColor").content = dark ? "#0c1622" : "#f5f9fc";
}

const welcome = () => showWelcome({ onRegion: setRegion, onLocate: locate, onLanguage: changeLanguage });

// ---------- Run log ----------
function logToday(type) {
  const before = loadLog(), today = dayKey(new Date());
  const nopeDay = state.conditions && !state.conditions.demo && reportFor(state.region).score === 2;
  const after = toggleToday(before, today, type, nopeDay);
  saveLog(after);
  renderRuns(after);

  if (after[today] && after[today] !== before[today]) confetti();
  const had = BADGES.filter(b => b.earned(streakStats(before)));
  const fresh = BADGES.filter(b => b.earned(streakStats(after)) && !had.includes(b));
  if (fresh.length) toast(t("badge.unlocked", { list: fresh.map(b => t("badge." + b.id)).join(", ") }));
}

// ---------- Sharing ----------
async function shareVerdict() {
  const c = state.conditions;
  if (!c || c.demo) return;
  await document.fonts?.ready;
  const r = reportFor(state.region), { streak } = streakStats(loadLog());
  const heat = r.wbgt ? `${t("share.heat")}: ${t("heat." + r.wbgt.heatStress)} (WBGT ${(+r.wbgt.wbgt).toFixed(1)}°)` : "";
  const canvas = drawShareCard({
    color: VERDICT_COLORS[r.score],
    brand: `${t("app.name")} · ${t("app.place")}`,
    kicker: [t("region.label", { r: tRegion(state.region) }), fmtDate(Date.now(), { day: "numeric", month: "short", year: "numeric" }), fmtTime(c.fetchedAt, { hour: "numeric", minute: "2-digit" })].join(" · "),
    big: t("verdict." + r.score),
    lead: t("lead." + r.lead),
    stats: [
      { label: t("key.psi"), value: r.psi ?? "–", note: r.psi != null ? t(psiBand(r.psi).key) : "" },
      { label: t("key.pm"), value: r.pm ?? "–", note: r.pm != null ? `${t(pmBand(r.pm).key)} · µg/m³` : "" },
    ],
    foot: [heat, streak ? t("share.streak", { n: streak }) : ""].filter(Boolean).join(" · "),
  });
  previewShare(canvas, t("share.text", { v: t("verdict." + r.score) }), `can-i-run-${state.region}-${dayKey(new Date())}.png`);
}

function previewShare(canvas, text, filename) {
  openModal(`<h2>${t("share.title")}</h2><div id="cardSlot" style="margin:12px 0"></div><button class="btn primary" id="doShare" style="width:100%">${t("share.save")}</button>`);
  $("cardSlot").appendChild(canvas);
  $("doShare").onclick = async () => { if ((await shareImage(canvas, text, filename)) === "saved") toast(t("share.saved")); };
}

function showRecap() {
  const log = loadLog(), month = dayKey(new Date()).slice(0, 7);
  const [y, m] = month.split("-").map(Number);
  const lastMonth = new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 7);
  const s = monthStats(log, month), prev = monthStats(log, lastMonth);
  const name = fmtDate(Date.UTC(y, m - 1, 1), { month: "long", timeZone: "UTC" });
  const diff = s.active - prev.active;
  const vibe = t("recap.vibe." + (s.active === 0 ? 0 : s.active >= 20 ? 4 : s.active >= 12 ? 3 : s.active >= 5 ? 2 : 1));
  const comparison = !prev.active ? "" : diff > 0 ? t("recap.more", { n: diff }) : diff < 0 ? t("recap.fewer", { n: -diff }) : t("recap.same");
  openModal(`<h2>${t("recap.title", { m: name })}</h2>
    <div class="recap-grid">
      <div><b>${s.active}</b>${t("recap.active")}</div><div><b>${s.runs}</b>${t("recap.outdoor")}</div>
      <div><b>${s.indoor}</b>${t("recap.indoor")}</div><div><b>${s.best}</b>${t("recap.best")}</div>
    </div>
    ${s.haze ? `<p>${t("recap.haze", { n: s.haze })}</p>` : ""}
    <p>${comparison}</p>
    <p style="color:var(--ink);font-weight:600">${vibe}</p>
    <button class="btn primary" id="shareRecap" style="width:100%;margin-top:8px">${t("recap.share")}</button>`);
  $("shareRecap").onclick = async () => {
    await document.fonts?.ready;
    const canvas = drawShareCard({
      color: RECAP_COLOR, brand: `${t("app.name")} · ${t("app.place")}`, kicker: t("recap.kicker", { m: name }),
      big: t("recap.days", { n: s.active }), lead: vibe,
      stats: [{ label: t("recap.outdoor"), value: s.runs }, { label: t("recap.best"), value: s.best }],
      foot: t("recap.line1", { r: s.runs, i: s.indoor }),
    });
    if ((await shareImage(canvas, t("recap.shareText", { m: name }), `can-i-run-recap-${month}.png`)) === "saved") toast(t("share.saved"));
  };
}

// ---------- Wiring ----------
$("regionRow").onclick = e => { const b = e.target.closest("[data-region]"); if (b) setRegion(b.dataset.region); };
$("routes").onclick = e => {
  const b = e.target.closest("[data-route]");
  if (!b) return;
  const route = ROUTES[b.dataset.route];
  setRegion(route.region);
  scrollTo({ top: 0, behavior: "smooth" });
  toast(t("routes.showing", { r: tRegion(route.region), route: t("route." + route.id) }));
};
document.querySelector(".top .seg").onclick = e => { const b = e.target.closest("[data-lang]"); if (b) changeLanguage(b.dataset.lang); };
$("refresh").onclick = load;
$("locate").onclick = () => locate();
$("shareBtn").onclick = shareVerdict;
$("theme").onclick = () => setTheme(!document.body.classList.contains("dark"));
$("ranBtn").onclick = () => logToday("run");
$("indoorBtn").onclick = () => logToday("indoor");
$("recapBtn").onclick = showRecap;
$("excuse").onclick = () => {
  const excuses = t("excuses");
  $("excuseText").textContent = t("excuse.wrap", { e: excuses[Math.floor(Math.random() * excuses.length)] });
};
$("modalClose").onclick = () => ($("modal").hidden = true);
$("modal").onclick = e => { if (e.target.id === "modal") $("modal").hidden = true; };

// Desktop tooltips for chart points, calendar days and badges.
const tip = $("tip");
document.addEventListener("mousemove", e => {
  const el = e.target.closest?.("[data-tip]");
  tip.style.opacity = el ? 1 : 0;
  if (!el) return;
  tip.textContent = el.dataset.tip;
  tip.style.left = e.clientX + 12 + "px";
  tip.style.top = e.clientY + 12 + "px";
});

// ---------- Start ----------
setTheme(localStorage.getItem("dark") === "1");
renderStatic();
setUpInstall();
renderRuns(loadLog());
// Show the last saved data instantly, then refresh from the network.
if (localStorage.getItem("conditions")) show(JSON.parse(localStorage.getItem("conditions")), false);
load();
setInterval(load, REFRESH_MS);
if (!localStorage.getItem("welcomed") && !localStorage.getItem("region")) welcome();
if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js");
