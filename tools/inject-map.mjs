// Replaces the map <svg> in index.html with the paths from tools/map.json.
import { readFileSync, writeFileSync } from "fs";

const m = JSON.parse(readFileSync(new URL("./map.json", import.meta.url), "utf8"));
const file = new URL("../index.html", import.meta.url);
const html = readFileSync(file, "utf8");
const name = k => k[0].toUpperCase() + k.slice(1);
const svg = `<svg viewBox="0 0 495 315" aria-label="Singapore regions map">
${Object.entries(m.paths).map(([k, d]) => `        <path class="region" data-r="${k}" d="${d}"/>`).join("\n")}
${Object.entries(m.labels).map(([k, [x, y]]) => `        <text class="rlabel" x="${x}" y="${y}" id="lbl-${k}">${name(k)}</text>`).join("\n")}
      </svg>`;
const out = html.replace(/<svg viewBox="[^"]*" aria-label="Singapore regions map">[\s\S]*?<\/svg>/, svg);
if (out === html) throw new Error("map svg not found");
writeFileSync(file, out);
console.log("map injected");
