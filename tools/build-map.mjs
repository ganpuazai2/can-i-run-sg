// Builds simplified SVG paths for NEA's 5 PSI regions from URA planning-area boundaries.
// Each planning area is assigned to the nearest NEA region label location.
// Usage: node tools/build-map.mjs > tools/map.json
import { readFileSync } from "fs";

const CENTERS = { north: [1.41803, 103.82], south: [1.29587, 103.82], east: [1.35735, 103.94], west: [1.35735, 103.7], central: [1.35735, 103.82] };
const LNG0 = 103.6, LAT0 = 1.475, SCALE = 1000; // px per degree
const proj = ([lng, lat]) => [(lng - LNG0) * SCALE, (LAT0 - lat) * SCALE];

function dp(pts, tol) { // Douglas-Peucker
  if (pts.length < 3) return pts;
  const [a, b] = [pts[0], pts[pts.length - 1]];
  let idx = 0, max = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const [x, y] = pts[i], dx = b[0] - a[0], dy = b[1] - a[1];
    const d = Math.abs(dy * x - dx * y + b[0] * a[1] - b[1] * a[0]) / (Math.hypot(dx, dy) || 1);
    if (d > max) { max = d; idx = i; }
  }
  if (max <= tol) return [a, b];
  return [...dp(pts.slice(0, idx + 1), tol).slice(0, -1), ...dp(pts.slice(idx), tol)];
}

const geo = JSON.parse(readFileSync(new URL("./pa.geojson", import.meta.url)));
const paths = { north: [], south: [], east: [], west: [], central: [] };
for (const f of geo.features) {
  const polys = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
  const outer = polys.flatMap(p => p[0]);
  const c = outer.reduce((s, p) => [s[0] + p[0] / outer.length, s[1] + p[1] / outer.length], [0, 0]);
  let region = null, best = Infinity;
  for (const [k, [la, lo]] of Object.entries(CENTERS)) {
    const d = (la - c[1]) ** 2 + (lo - c[0]) ** 2;
    if (d < best) { best = d; region = k; }
  }
  if (c[0] < 103.76) region = "west"; // Jurong Island & Western Islands sit closer to "south"'s label but are west
  for (const poly of polys) {
    // closed rings start and end on the same point, so simplify each half separately
    const pts = poly[0].map(proj), mid = Math.floor(pts.length / 2);
    const ring = [...dp(pts.slice(0, mid + 1), 0.6).slice(0, -1), ...dp(pts.slice(mid), 0.6)];
    if (ring.length < 4) continue;
    paths[region].push("M" + ring.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join("L") + "Z");
  }
}
const labels = Object.fromEntries(Object.entries(CENTERS).map(([k, [la, lo]]) => [k, proj([lo, la]).map(v => +v.toFixed(1))]));
console.log(JSON.stringify({ paths: Object.fromEntries(Object.entries(paths).map(([k, v]) => [k, v.join("")])), labels }));
