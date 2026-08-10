import { readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const requiredJson = [
  "data/schemas/pmo-document.schema.json",
  "data/schemas/evidence-record.schema.json",
  "data/schemas/review-record.schema.json",
  "data/schemas/audit-event.schema.json",
  "data/schemas/object-version.schema.json",
  "data/schemas/reporting-module-summary.schema.json",
  "data/schemas/steerco-report.schema.json",
];
for (const path of requiredJson) JSON.parse(readFileSync(join(root, path), "utf8"));
const pmoSchema = JSON.parse(readFileSync(join(root, "data/schemas/pmo-document.schema.json"), "utf8"));
for (const key of ["issues", "actions", "decisions", "dependencies", "assumptions", "changeRequests", "evidence", "reviews", "audit", "objectVersions"]) {
  if (!pmoSchema.required.includes(key)) throw new Error(`PMO schema is missing required contract: ${key}`);
}

const ignored = new Set([".git", ".next", "node_modules", "test-results", "playwright-report"]);
const textExtensions = new Set([".css", ".html", ".js", ".json", ".jsx", ".md", ".mjs", ".ts", ".tsx", ".yaml", ".yml"]);
const forbidden = [
  ["de", "kra"].join(""),
  ["kf", "la"].join(""),
  ["skill", "designer"].join("[\\s_-]*"),
  ["job", "to", "skill"].join("[\\s_-]*"),
  ["skill", "workspace"].join("[\\s_-]*"),
  ["pilot", "readiness"].join("[\\s_-]*"),
].map((source) => new RegExp(source, "i"));

const violations = [];
function scan(directory) {
  for (const entry of readdirSync(directory)) {
    if (ignored.has(entry)) continue;
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) scan(path);
    else if (textExtensions.has(extname(path))) {
      const content = readFileSync(path, "utf8");
      if (forbidden.some((pattern) => pattern.test(content))) violations.push(relative(root, path));
    }
  }
}
scan(root);
if (violations.length) throw new Error(`Product-neutrality check failed: ${[...new Set(violations)].join(", ")}`);
console.log("Governed product contracts and neutrality checks passed.");
