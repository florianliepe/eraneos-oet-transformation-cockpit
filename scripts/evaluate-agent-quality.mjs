import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const fixture = JSON.parse(readFileSync(resolve("tests/fixtures/agent-workflows/specialist-evaluations.json"), "utf8"));
const thresholds = JSON.parse(readFileSync(resolve("config/agent-quality-thresholds.json"), "utf8"));
const allowed = new Set(["evidence.verify", "delivery.plan", "risk.analyse", "meeting.synthesise", "controls.classify", "governance.review"]);
let valid = 0, attributed = 0, claims = 0, unsupported = 0, routed = 0, proposals = 0, duplicates = 0;
const failures = [];
for (const item of fixture.cases) {
  const output = item.output || {};
  const evidence = new Set(item.evidence.map((entry) => entry.id));
  const contractOk = allowed.has(item.workflowId) && output.workflowId === item.workflowId && output.workflowVersion && output.promptVersion && ["completed", "needs_review", "failed"].includes(output.status) && output.summary && ["low", "medium", "high", "not_assessed"].includes(output.confidence) && Array.isArray(output.proposals);
  if (contractOk) valid++; else failures.push(`${item.id}: invalid contract`);
  if (JSON.stringify(item.expectedRouting) === JSON.stringify([item.workflowId])) routed++; else failures.push(`${item.id}: routing mismatch`);
  const seen = new Set();
  for (const proposal of output.proposals || []) {
    proposals++;
    const key = `${proposal.entity}:${proposal.action}:${proposal.objectId || ""}:${proposal.summary}`;
    if (seen.has(key)) duplicates++; else seen.add(key);
    const ok = proposal.evidenceIds?.length && proposal.evidenceIds.every((id) => evidence.has(id));
    if (ok) attributed++; else failures.push(`${item.id}: unattributed proposal ${proposal.id}`);
  }
  for (const claim of output.materialClaims || []) {
    claims++;
    if (!claim.evidenceIds?.length || claim.evidenceIds.some((id) => !evidence.has(id))) { unsupported++; failures.push(`${item.id}: unsupported material claim`); }
  }
}
const total = fixture.cases.length;
const scores = {
  contractValidity: valid / total,
  evidenceAttribution: proposals ? attributed / proposals : 1,
  unsupportedMaterialClaims: unsupported,
  routingAccuracy: routed / total,
  duplicateProposalRate: proposals ? duplicates / proposals : 0,
};
for (const [metric, threshold] of Object.entries(thresholds)) {
  const passes = metric === "unsupportedMaterialClaims" || metric === "duplicateProposalRate" ? scores[metric] <= threshold : scores[metric] >= threshold;
  if (!passes) failures.push(`${metric}=${scores[metric]} threshold=${threshold}`);
}
if (claims === 0) failures.push("No material claims were evaluated.");
if (failures.length) { console.error(failures.join("\n")); process.exit(1); }
console.log(`Agent evaluation gate passed (${total} specialists): ${JSON.stringify(scores)}.`);
