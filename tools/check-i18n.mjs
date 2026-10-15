// Checks that every translation key used in index.html exists, and lists keys missing per language.
import { readFileSync } from "fs";

const src = readFileSync(new URL("../i18n.js", import.meta.url), "utf8");
const I18N = new Function("localStorage", "navigator", "location", src + "; return I18N;")({ getItem: () => null, setItem() {} }, { language: "en" }, { search: "" });
const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");

const used = new Set();
for (const m of html.matchAll(/\bt\("([\w.]+)"/g)) used.add(m[1]);
for (const m of html.matchAll(/data-i18n(?:-html)?="([\w.]+)"/g)) used.add(m[1]);
// keys built dynamically
["verdict.", "subs.", "tips.", "tips.title.", "recap.vibe."].forEach(p => [0, 1, 2, 3, 4].forEach(i => I18N.en[p + i] && used.add(p + i)));
["Low", "Moderate", "High"].forEach(s => used.add("heat." + s));
["west", "north", "central", "east", "south"].forEach(r => used.add("region." + r));

const missingEn = [...used].filter(k => !(k in I18N.en));
console.log("keys used:", used.size, "| missing in en:", missingEn.length ? missingEn : "none");
// place names intentionally fall back to English in BM and Tamil
const optional = k => /^route\.\w+$/.test(k);
for (const l of ["zh", "ms", "ta"]) {
  const miss = Object.keys(I18N.en).filter(k => !(k in I18N[l]) && !optional(k));
  const arrBad = Object.keys(I18N.en).filter(k => Array.isArray(I18N.en[k]) && k in I18N[l] && !Array.isArray(I18N[l][k]) && k !== "runs.weekdays");
  console.log(l, "missing:", miss.length ? miss : "none", arrBad.length ? "| not arrays: " + arrBad : "");
}
