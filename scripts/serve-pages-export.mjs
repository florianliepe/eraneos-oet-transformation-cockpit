import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..", "out");
const basePath = "/eraneos-oet-transformation-cockpit";
const contentTypes = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon" };

createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url || "/", "http://localhost").pathname);
  if (pathname !== basePath && !pathname.startsWith(`${basePath}/`)) { response.writeHead(404).end("Not found"); return; }
  const relative = pathname.slice(basePath.length).replace(/^\/+/, "") || "index.html";
  let file = resolve(root, normalize(relative));
  if (!file.startsWith(root) || !existsSync(file)) file = join(root, "404.html");
  else if (statSync(file).isDirectory()) file = join(file, "index.html");
  response.setHeader("Content-Type", contentTypes[extname(file)] || "application/octet-stream");
  createReadStream(file).pipe(response);
}).listen(3108, "127.0.0.1", () => console.log(`Serving Pages export at http://127.0.0.1:3108${basePath}/`));
