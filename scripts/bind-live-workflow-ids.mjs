import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const manifestPath = resolve("docs/n8n/agents/manifest.json");
const bindingsPath = process.argv[2];
if (!bindingsPath) throw new Error("Usage: node scripts/bind-live-workflow-ids.mjs <bindings.json>");

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const bindings = JSON.parse(readFileSync(resolve(bindingsPath), "utf8"));
const expected = new Set(manifest.workflows.map((item) => item.workflowId));

for (const [workflowId, liveWorkflowId] of Object.entries(bindings)) {
  if (!expected.has(workflowId)) throw new Error(`Unknown specialist workflow: ${workflowId}`);
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(String(liveWorkflowId))) throw new Error(`Invalid live workflow ID for ${workflowId}.`);
}
for (const workflowId of expected) {
  if (!bindings[workflowId]) throw new Error(`Missing live workflow ID for ${workflowId}.`);
}

manifest.workflows = manifest.workflows.map((item) => ({ ...item, liveWorkflowId: String(bindings[item.workflowId]) }));
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log("Bound six live specialist workflow IDs. Rebuild the orchestrator before import.");
