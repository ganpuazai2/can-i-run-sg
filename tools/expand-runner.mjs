// Inlines the runner's <use> limb references (Safari won't reliably animate <use> clones)
// and swaps stroke="var(--skin)" (invalid as an SVG attribute) for a CSS class.
import { readFileSync, writeFileSync } from "fs";

const file = new URL("../index.html", import.meta.url);
let h = readFileSync(file, "utf8");
const defs = h.match(/\s*<defs>[\s\S]*?<\/defs>/)[0];
const part = id => defs.match(new RegExp(`<g id="${id}">([\\s\\S]*?)\\n\\s{14}<\\/g>`))[1];
const leg = part("leg"), arm = part("arm");
h = h.replace(defs, "")
  .replaceAll('<use href="#leg"/><use href="#arm"/>', leg + arm)
  .replaceAll('stroke="var(--skin)"', 'class="sk"');
writeFileSync(file, h);
console.log("expanded", (h.match(/class="thigh"/g) || []).length, "legs");
