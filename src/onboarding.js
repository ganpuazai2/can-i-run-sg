// First-visit welcome and the add-to-home-screen flow.
import { $, openModal, closeModal, toast } from "./dom.js";
import { t, tRegion, getLang, langName, LANGS } from "./i18n.js";
import { REGIONS } from "./regions.js";

const isStandalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone;
const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
// In-app browsers (WhatsApp, Telegram, Instagram…) can't add to the home screen, so step 1 is "open in Safari".
const isInAppBrowser = /FBAN|FBAV|Instagram|Line\/|Telegram|WhatsApp|GSA\//i.test(navigator.userAgent);

/** @param {{ onRegion: (r: string) => void, onLocate: (done: () => void) => void, onLanguage: (l: string) => void }} actions */
export function showWelcome({ onRegion, onLocate, onLanguage }) {
  const lang = getLang();
  openModal(`
    <div class="seg welcome-langs">${LANGS.map(l => `<button class="${l === lang ? "on" : ""}" data-lang="${l}" lang="${l}">${langName(l)}</button>`).join("")}</div>
    <h2>${t("welcome.title")}</h2>
    <p>${t("welcome.intro")}</p>
    <p style="color:var(--ink);font-weight:600;margin-top:16px">${t("welcome.where")}</p>
    <div class="pick">
      ${REGIONS.map(r => `<button class="btn" data-region="${r}">${tRegion(r)}</button>`).join("")}
      <button class="btn primary" id="welcomeLocate">${t("btn.locate")}</button>
    </div>
    <p class="fine">${t("welcome.hint")}</p>`, "welcome");

  const finish = () => { closeModal(); localStorage.setItem("welcomed", "1"); };
  const body = $("modalBody");
  body.querySelectorAll("[data-region]").forEach(b => (b.onclick = () => { onRegion(b.dataset.region); finish(); }));
  body.querySelectorAll("[data-lang]").forEach(b => (b.onclick = () => onLanguage(b.dataset.lang)));
  $("welcomeLocate").onclick = () => onLocate(finish);
}

export function showInstallGuide() {
  const step = (n, title, body) => `<div class="step"><span class="stepn">${n}</span><div><b>${title}</b><div>${body}</div></div></div>`;
  openModal(`
    <h2>${t("guide.title")}</h2>
    <p>${t("guide.sub")}</p>
    <div class="steps">
      ${step(1, t("guide.1"), t(isInAppBrowser ? "guide.1.inapp" : "guide.1.maybe"))}
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

// Android/desktop Chrome give us an install event; iPhones need the manual guide.
let installEvent = null;

export function renderInstallBar() {
  if (isStandalone || localStorage.getItem("installDismissed") || (!installEvent && !isIOS)) return;
  $("installBtn").textContent = t(installEvent ? "install.btn" : "install.how");
  $("installBtn").hidden = false;
  $("installBar").hidden = false;
}

export function setUpInstall() {
  addEventListener("beforeinstallprompt", e => { e.preventDefault(); installEvent = e; renderInstallBar(); });
  addEventListener("appinstalled", () => { $("installBar").hidden = true; toast(t("installed")); });
  $("installBtn").onclick = async () => {
    if (!installEvent) return showInstallGuide();
    installEvent.prompt();
    await installEvent.userChoice;
    installEvent = null;
    $("installBar").hidden = true;
  };
  $("installX").onclick = () => { $("installBar").hidden = true; localStorage.setItem("installDismissed", "1"); };
  renderInstallBar();
}
