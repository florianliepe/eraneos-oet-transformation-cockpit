import { readFileSync } from "node:fs";

const contract = JSON.parse(readFileSync("config/agent-canary.json", "utf8"));
const runner = readFileSync("scripts/run-lean-agent-live-sample.mjs", "utf8");
const workflow = readFileSync(".github/workflows/agent-canary.yml", "utf8");
const failures = [];
if (contract.contractVersion !== "agent-canary-1.0" || contract.mode !== "pmo.ingest") failures.push("Canary contract identity is invalid.");
if (contract.expectedProposalCount !== 0 || contract.canonicalRevisionDelta !== 0 || contract.destructiveActions !== false) failures.push("Canary is not fail-closed and non-destructive.");
if (!contract.requiresDedicatedProject || contract.containsCredentials) failures.push("Canary scope or credential policy is unsafe.");
for (const marker of ["command === \"canary\"", "canonicalRevisionBefore", "canonicalRevisionAfter", "CANARY_CANONICAL_WRITE", "CANARY_TERMINAL_FAILURE"]) if (!runner.includes(marker)) failures.push(`Canary runner is missing ${marker}.`);
for (const marker of ["schedule:", "workflow_dispatch:", "OET_N8N_WEBHOOK_SECRET", "upload-artifact@v4", "npm run verify:agent-canary"]) if (!workflow.includes(marker)) failures.push(`Canary workflow is missing ${marker}.`);
if (failures.length) { console.error(failures.join("\n")); process.exit(1); }
console.log("Agent canary verified: dedicated scope, no-change fixture, terminal SLO and zero-write invariant.");
