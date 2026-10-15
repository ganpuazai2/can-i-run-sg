// Builds tools/preview-*.html: index.html pre-loaded with live data from the deployed API,
// so headless screenshots show real content. Usage: node tools/preview.mjs
import { readFileSync, writeFileSync } from "fs";

const data = await (await fetch("https://can-i-run-sg.vercel.app/api/conditions")).text();
const html = readFileSync(new URL("../index.html", import.meta.url), "utf8")
  .replace('src="/i18n.js"', 'src="../i18n.js"')
  .replaceAll('src="/icon-192.png"', 'src="../icon-192.png"');
const variants = {
  light: { dark: "0", lang: "en", region: "central", open: false },
  dark: { dark: "1", lang: "en", region: "north", open: true },
  ms: { dark: "0", lang: "ms", region: "east", open: false },
};
for (const [name, v] of Object.entries(variants)) {
  const seed = `<script>localStorage.clear();localStorage.setItem("conditions", ${JSON.stringify(data)});localStorage.setItem("welcomed","1");localStorage.setItem("installDismissed","1");
localStorage.setItem("dark","${v.dark}");localStorage.setItem("lang","${v.lang}");localStorage.setItem("region","${v.region}");
${v.open ? 'localStorage.setItem("runs", JSON.stringify({["2026-10-13"]:"run",["2026-10-14"]:"indoor"}));' : ""}</script>`;
  let out = html.replace('<script src="../i18n.js"></script>', seed + '<script src="../i18n.js"></script>');
  if (v.open) out = out.replace('<details class="card fold" id="more">', '<details class="card fold" id="more" open>');
  writeFileSync(new URL(`./preview-${name}.html`, import.meta.url), out);
}
console.log("previews written");
