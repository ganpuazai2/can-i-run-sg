// Builds tools/preview.html: the app served from disk with live data from the deployed API baked in,
// so headless browsers can screenshot real content without network access.
// Usage: node tools/preview.mjs [light|dark] [en|zh|ms|ta] [region]
import { readFileSync, writeFileSync } from "fs";

const [theme = "light", lang = "en", region = "central"] = process.argv.slice(2);
const data = await (await fetch("https://can-i-run-sg.vercel.app/api/conditions")).text();
const seed = `<script>
localStorage.clear();
Object.entries({ welcomed: "1", installDismissed: "1", dark: "${theme === "dark" ? 1 : 0}", lang: "${lang}", region: "${region}" })
  .forEach(([k, v]) => localStorage.setItem(k, v));
const DATA = ${JSON.stringify(data)};
window.fetch = () => Promise.resolve(new Response(DATA));
</script>`;
const html = readFileSync(new URL("../index.html", import.meta.url), "utf8")
  .replace(/(href|src)="\/(?!\/)/g, '$1="../')
  .replace('<script src="../i18n.js">', seed + '\n<script src="../i18n.js">');
writeFileSync(new URL("./preview.html", import.meta.url), html);
console.log(`tools/preview.html written (${theme}, ${lang}, ${region})`);
