// Local dev server: serves the site and forwards /api/conditions to the live deployment,
// so you can work on the front end without a Vercel login or NEA API key.
// Usage: npm run dev   (or: node tools/serve.mjs [port])
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const PORT = Number(process.argv[2]) || 5173;
const LIVE_API = "https://can-i-run-sg.vercel.app/api/conditions";
const TYPES = {
  ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json",
  ".png": "image/png", ".svg": "image/svg+xml",
};

createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
  try {
    if (path === "/api/conditions") {
      const live = await fetch(LIVE_API);
      res.writeHead(live.status, { "content-type": "application/json" });
      return res.end(await live.text());
    }
    // "/" and "/app" (the home-screen start URL) both serve the page.
    const file = path === "/" || path === "/app" ? "index.html" : normalize(path).replace(/^[\\/]+/, "");
    if (file.startsWith("..")) throw new Error("outside root");
    const body = await readFile(join(ROOT, file));
    res.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404).end("Not found");
  }
}).listen(PORT, () => console.log(`Can I Run? → http://localhost:${PORT}`));
