import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { STRINGS } from "../src/strings.js";

const LANGS = ["zh", "ms", "ta"];
// Place names are signposted in English, so Malay and Tamil fall back to it on purpose.
const optional = key => /^route\.\w+$/.test(key);

test("every language has every string", () => {
  for (const lang of LANGS) {
    const missing = Object.keys(STRINGS.en).filter(k => !(k in STRINGS[lang]) && !optional(k));
    assert.deepEqual(missing, [], `${lang} is missing strings`);
  }
});

test("translations keep the same placeholders", () => {
  const vars = s => (s.match(/\{\w+\}/g) ?? []).sort().join();
  for (const lang of LANGS) {
    for (const [key, en] of Object.entries(STRINGS.en)) {
      const translated = STRINGS[lang][key];
      if (typeof en !== "string" || typeof translated !== "string") continue; // lists like weekday letters
      assert.equal(vars(translated), vars(en), `${lang}: ${key}`);
    }
  }
});

test("every string the app asks for exists", () => {
  const dir = new URL("../src/", import.meta.url);
  const code = readdirSync(dir).map(f => readFileSync(new URL(f, dir), "utf8")).join("")
    + readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const used = [...code.matchAll(/\bt\("([\w.]+)"|data-i18n(?:-html|-aria)?="([\w.]+)"/g)]
    .map(m => m[1] ?? m[2])
    .filter(k => !k.endsWith(".")); // keys built at runtime, e.g. t("lead." + reason)
  const missing = [...new Set(used)].filter(k => !(k in STRINGS.en));
  assert.deepEqual(missing, []);
});
