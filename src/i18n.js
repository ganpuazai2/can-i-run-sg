// Language state and string lookup. The text itself lives in strings.js.
import { STRINGS } from "./strings.js";

export const LANGS = ["en", "zh", "ms", "ta"];

let lang = "en";
export const getLang = () => lang;
export const setLanguage = l => { if (LANGS.includes(l)) lang = l; };
export const langName = l => STRINGS[l]["lang.name"];

export function t(key, vars) {
  let s = STRINGS[lang][key] ?? STRINGS.en[key] ?? key;
  if (vars && typeof s === "string") s = s.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");
  return s;
}

// NEA weather wording, e.g. "Thundery Showers" → 雷阵雨. Unknown phrases are shown as-is.
export const twx = s => (s ? STRINGS[lang]["wx." + s] ?? STRINGS.en["wx." + s] ?? s : "–");

export const tRegion = r => t("region." + r);

export const fmtTime = (d, opts) => new Date(d).toLocaleTimeString(t("locale"), opts);
export const fmtDate = (d, opts) => new Date(d).toLocaleDateString(t("locale"), opts);
