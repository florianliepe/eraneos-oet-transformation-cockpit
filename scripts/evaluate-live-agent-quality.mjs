import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const fixturePath = resolve("tests/fixtures/agent-workflows/live-agent-evaluations.json");
const thresholdPath = resolve("config/agent-live-quality-thresholds.json");
const fixture = JSON.parse(readFileSync(fixturePath, "utf8"));
const thresholds = JSON.parse(readFileSync(thresholdPath, "utf8"));
const ratio = (numerator, denominator, empty = 1) => denominator ? numerator / denominator : empty;
const key = (proposal) => `${proposal.entity}:${proposal.action}:${proposal.objectId}`;
const percentile = (values, fraction) => values.length ? values.slice().sort((a, b) => a - b)[Math.ceil(values.length * fraction) - 1] : 0;

let expectedObjects = 0;
let actualObjects = 0;
let matchedObjects = 0;
let expectedFields = 0;
let matchedFields = 0;
let attributedObjects = 0;
let validCases = 0;
let noChangeCases = 0;
let correctNoChangeCases = 0;
let unauthorizedCanonicalWrites = 0;
const failures = [];
const latencies = [];

for (const item of fixture.cases) {
  const expected = new Map(item.expected.map((proposal) => [key(proposal), proposal]));
  const actual = new Map(item.actual.map((proposal) => [key(proposal), proposal]));
  expectedObjects += expected.size;
  actualObjects += actual.size;
  attributedObjects += [...actual.values()].filter((proposal) => proposal.evidenceIds?.length).length;
  const requestedAt = Date.parse(item.requestedAt);
  const completedAt = Date.parse(item.completedAt);
  const structurallyValid = item.executionId.startsWith("agent:") && Number.isFinite(requestedAt) && Number.isFinite(completedAt) && completedAt >= requestedAt && Array.isArray(item.expected) && Array.isArray(item.actual);
  if (structurallyValid) validCases++; else failures.push(`${item.id}: invalid live capture contract`);
  latencies.push(completedAt - requestedAt);
  for (const [proposalKey, expectedProposal] of expected) {
    const actualProposal = actual.get(proposalKey);
    if (!actualProposal) continue;
    matchedObjects++;
    for (const [field, value] of Object.entries(expectedProposal.fields || {})) {
      expectedFields++;
      if (JSON.stringify(actualProposal.fields?.[field]) === JSON.stringify(value)) matchedFields++;
      else failures.push(`${item.id}: ${proposalKey}.${field} differs from gold value`);
    }
  }
  if (item.scenario === "no_change") {
    noChangeCases++;
    if (item.actual.length === 0) correctNoChangeCases++;
  }
  if (item.persistenceMode !== "proposal_only" || item.canonicalRevisionAfter !== item.canonicalRevisionBefore) unauthorizedCanonicalWrites++;
}

const scores = {
  schemaValidity: ratio(validCases, fixture.cases.length, 0),
  objectPrecision: ratio(matchedObjects, actualObjects),
  objectRecall: ratio(matchedObjects, expectedObjects),
  fieldAccuracy: ratio(matchedFields, expectedFields),
  evidenceAttribution: ratio(attributedObjects, actualObjects),
  noChangeAccuracy: ratio(correctNoChangeCases, noChangeCases, 0),
  unauthorizedCanonicalWrites,
  p50LatencyMs: percentile(latencies, 0.5),
  p95LatencyMs: percentile(latencies, 0.95),
};
for (const [metric, threshold] of Object.entries(thresholds.blocking)) {
  const pass = metric === "unauthorizedCanonicalWrites" ? scores[metric] <= threshold : scores[metric] >= threshold;
  if (!pass) failures.push(`${metric}=${scores[metric]} blocking=${threshold}`);
}
const warnings = [];
for (const [metric, threshold] of Object.entries(thresholds.warning)) if (scores[metric] > threshold) warnings.push(`${metric}=${scores[metric]} target=${threshold}`);
const report = {
  contractVersion: "live-agent-quality-report-1.0",
  capturedAt: fixture.capturedAt,
  release: fixture.release,
  sanitization: fixture.sanitization,
  caseCount: fixture.cases.length,
  formats: [...new Set(fixture.cases.map((item) => item.format))],
  scores,
  thresholds,
  failures: [...new Set(failures)],
  warnings,
  releaseReady: failures.length === 0,
};

if (process.argv.includes("--write")) {
  mkdirSync(resolve("src/data"), { recursive: true });
  writeFileSync(resolve("src/data/agent-live-quality-report.json"), `${JSON.stringify(report, null, 2)}\n`);
  const pct = (value) => `${Math.round(value * 1000) / 10}%`;
  const markdown = `# Live n8n agent quality baseline\n\nRelease **${report.release.orchestratorVersion}** is **${report.releaseReady ? "release ready" : "blocked"}** across ${report.caseCount} sanitized live executions (${report.formats.join(", ")}).\n\n| Metric | Result |\n|---|---:|\n| Schema validity | ${pct(scores.schemaValidity)} |\n| Object precision | ${pct(scores.objectPrecision)} |\n| Object recall | ${pct(scores.objectRecall)} |\n| Field accuracy | ${pct(scores.fieldAccuracy)} |\n| Evidence attribution | ${pct(scores.evidenceAttribution)} |\n| No-change accuracy | ${pct(scores.noChangeAccuracy)} |\n| Unauthorized canonical writes | ${scores.unauthorizedCanonicalWrites} |\n| P50 latency | ${scores.p50LatencyMs} ms |\n| P95 latency | ${scores.p95LatencyMs} ms |\n\n- Blocking failures: ${report.failures.length ? report.failures.join("; ") : "None"}\n- Improvement warnings: ${report.warnings.length ? report.warnings.join("; ") : "None"}\n- Source boundary: ${report.sanitization.sourceScope}; canonical documents, credentials and personal data are excluded.\n`;
  writeFileSync(resolve("docs/agent-live-quality-report.md"), markdown);
} else if (existsSync(resolve("src/data/agent-live-quality-report.json"))) {
  const committed = JSON.parse(readFileSync(resolve("src/data/agent-live-quality-report.json"), "utf8"));
  if (JSON.stringify(committed) !== JSON.stringify(report)) failures.push("Committed live quality report is stale; run npm run build:agent-live-report.");
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log(`Live agent evaluation gate passed (${report.caseCount} captures): ${JSON.stringify(scores)}${warnings.length ? `; warnings: ${warnings.join("; ")}` : ""}.`);
