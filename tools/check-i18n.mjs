// Checks that every translation key used by the app exists, and lists keys missing per language.
// Usage: node tools/check-i18n.mjs
import { readFileSync } from "fs";

const read = f => readFileSync(new URL("../" + f, import.meta.url), "utf8");
const I18N = new Function("localStorage", "navigator", "location", read("i18n.js") + "; return I18N;")(
  { getItem: () => null, setItem() {} }, { language: "en" }, { search: "" });
const code = read("index.html") + read("app.js");

const used = new Set();
for (const m of code.matchAll(/\bt\("([\w.]+)"/g)) if (!m[1].endsWith(".")) used.add(m[1]);
for (const m of code.matchAll(/data-i18n(?:-html|-aria)?="([\w.]+)"/g)) used.add(m[1]);
// keys built at runtime, e.g. t("lead." + v.lead)
const leads = ["go", "psiHaz", "psiVU", "psiU", "pmHigh", "pmElev", "heatHigh", "heatMod", "hot", "lightning", "uv", "thunder", "heavy", "rain"];
leads.forEach(k => { used.add("lead." + k); if (k !== "go") used.add("r." + k); });
[0, 1, 2].forEach(i => ["verdict.", "tips.", "tips.title."].forEach(p => used.add(p + i)));
[0, 1, 2, 3, 4].forEach(i => used.add("recap.vibe." + i));
["Low", "Moderate", "High"].forEach(s => used.add("heat." + s));
["west", "north", "central", "east", "south"].forEach(r => used.add("region." + r));

const missingEn = [...used].filter(k => !(k in I18N.en));
console.log("keys used:", used.size, "| missing in en:", missingEn.length ? missingEn : "none");
// place names intentionally fall back to English in BM and Tamil
const optional = k => /^route\.\w+$/.test(k);
for (const l of ["zh", "ms", "ta"]) {
  const miss = Object.keys(I18N.en).filter(k => !(k in I18N[l]) && !optional(k));
  console.log(l, "missing:", miss.length ? miss : "none");
}
