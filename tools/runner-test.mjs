// Builds tools/runner.html: the runner frozen at N points of one stride, to check the gait.
import { readFileSync, writeFileSync } from "fs";

const h = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const css = h.match(/<style>([\s\S]*?)<\/style>/)[1];
const svg = h.match(/<svg class="runner"[\s\S]*?<\/svg>/)[0];
const T = 1, N = 10, parts = [".thigh", ".shin", ".uarm", ".farm", ".tail"];
let frames = "", rules = "";
for (let i = 0; i < N; i++) {
  const d = (i / N) * T;
  rules += parts.map(p => `.f${i} ${p}`).join(",") + `{animation-delay:-${d}s!important}\n`;
  rules += parts.map(p => `.f${i} .far ${p}`).join(",") + `{animation-delay:-${d + T / 2}s!important}\n`;
  rules += `.f${i} .bob{animation-delay:-${d % (T / 2)}s!important}\n`;
  frames += `<div class="f${i}" style="display:inline-block;margin:4px 2px;border-bottom:2px solid #c9b79c;padding-bottom:2px">${svg}</div>`;
}
writeFileSync(
  new URL("./runner.html", import.meta.url),
  `<html><head><meta charset="utf-8"><style>${css}
.runner-wrap{--t:${T}s} .runner *{animation-play-state:paused!important} .runner{width:92px;height:120px}
${rules}</style></head><body style="padding:8px;margin:0;background:#e6f6ff"><div class="runner-wrap" style="position:static;width:auto;height:auto">${frames}</div></body></html>`
);
console.log("ok");
