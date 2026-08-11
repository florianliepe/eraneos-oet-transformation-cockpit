import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, resolve } from "node:path";

const budget = JSON.parse(readFileSync(resolve("config/performance-budgets.json"), "utf8"));
const root = resolve(process.argv.includes("--pages") ? "out" : ".next/static");
if (!existsSync(root)) throw new Error(`Build output is missing: ${root}`);
const files = [];
function walk(dir) { for (const name of readdirSync(dir)) { const path = join(dir, name); const stat = statSync(path); if (stat.isDirectory()) walk(path); else files.push({ path, bytes: stat.size, ext: extname(name) }); } }
walk(root);
const pages = process.argv.includes("--pages");
const metrics = {
  assetCount: files.length,
  totalBytes: files.reduce((sum, file) => sum + file.bytes, 0),
  javascriptBytes: files.filter((file) => file.ext === ".js").reduce((sum, file) => sum + file.bytes, 0),
  largestJavascriptBytes: Math.max(0, ...files.filter((file) => file.ext === ".js").map((file) => file.bytes)),
  cssBytes: files.filter((file) => file.ext === ".css").reduce((sum, file) => sum + file.bytes, 0),
  indexHtmlBytes: pages ? statSync(resolve("out/index.html")).size : 0,
};
const thresholds = budget.publicExport;
const checks = pages ? Object.keys(thresholds) : ["javascriptBytes", "largestJavascriptBytes", "cssBytes"];
const failures = checks.filter((key) => metrics[key] > thresholds[key]);
console.log(`Performance budget (${pages ? "Pages export" : "standalone static assets"}): ${JSON.stringify(metrics)}`);
if (failures.length) throw new Error(failures.map((key) => `${key} ${metrics[key]} exceeds ${thresholds[key]}`).join("\n"));
