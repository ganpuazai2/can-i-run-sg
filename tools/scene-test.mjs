// Builds tools/scene.html: the hero scene in each weather/verdict state, for screenshot checks.
import { readFileSync, writeFileSync } from "fs";

const h = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const css = h.match(/<style>([\s\S]*?)<\/style>/)[1];
const scene = h
  .match(/<div class="scene" id="scene"[\s\S]*?<div class="flash"><\/div>\s*<\/div>/)[0]
  .replace(/ id="[^"]*"/g, "");

const mk = (cls, haze, runner, orb, cloud) =>
  `<p style="margin:14px 0 2px;font:600 14px Inter">${cls}</p>` +
  scene
    .replace('class="scene"', `class="scene ${cls}" style="--haze:${haze}"`)
    .replace(">🏃<", `>${runner}<`)
    .replace(">☀️<", `>${orb}<`)
    .replaceAll(">☁️<", `>${cloud}<`);

writeFileSync(
  new URL("./scene.html", import.meta.url),
  `<html><head><meta charset="utf-8"><style>${css} .flash{animation-delay:-5.34s!important}</style></head>
<body style="padding:16px;width:440px">
${mk("s-go", 0, "🏃", "☀️", "☁️")}
${mk("s-maybe wx-rain", 0.1, "🏃", "☀️", "🌧️")}
${mk("s-no night", 0.45, "🧘", "🌙", "☁️")}
${mk("s-maybe wx-thunder", 0, "🏃", "☀️", "🌧️")}
</body></html>`
);
console.log("ok");
