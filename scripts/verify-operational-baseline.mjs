import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path) => JSON.parse(readFileSync(resolve(path), "utf8"));
const manifest = read("docs/n8n/agents/manifest.json");
const release = read("docs/n8n/releases/2026-08-11-zm-prod-05g.json");
const policy = read("config/operational-policy.json");
const cleanup = read("docs/n8n/obsolete-workflow-candidates.json");
const errors = [];
const authoritative = [manifest.orchestrator.liveWorkflowId, manifest.publisher.liveWorkflowId, manifest.operations.errorWorkflowLiveId, ...manifest.workflows.map((item) => item.liveWorkflowId)];
if (new Set(authoritative).size !== authoritative.length) errors.push("Authoritative live workflow bindings are not unique.");
if (release.bindings.orchestrator !== manifest.orchestrator.liveWorkflowId || release.bindings.publisher !== manifest.publisher.liveWorkflowId || release.bindings.errorHandler !== manifest.operations.errorWorkflowLiveId) errors.push("Release and live binding manifests disagree.");
if (cleanup.destructiveActionAllowed !== false || policy.destructiveCleanupRequiresConfirmation !== true) errors.push("Workflow cleanup is not fail-closed.");
for (const id of Object.values(cleanup.authoritative)) if (!authoritative.includes(id)) errors.push(`Cleanup inventory has stale authoritative ID ${id}.`);
for (const candidate of cleanup.candidates) if (authoritative.includes(candidate.workflowId)) errors.push(`Authoritative workflow listed as obsolete: ${candidate.workflowId}.`);
if (!policy.owner || !policy.incidentLead) errors.push("Operational ownership is incomplete.");
for (const key of ["successfulExecutionDays", "failedExecutionDays", "deadLetterDays"]) if (!(policy.retention[key] > 0)) errors.push(`Missing retention value ${key}.`);
for (const key of ["availabilityFailureCount", "authenticationFailures", "deadLetters", "repeatedWorkflowFailures"]) if (!(policy.alerts[key] > 0)) errors.push(`Missing alert threshold ${key}.`);
if (policy.redaction.length < 5) errors.push("Log-redaction policy is incomplete.");
const pages = readFileSync(resolve(".github/workflows/deploy-pages.yml"), "utf8");
for (const action of ["actions/configure-pages@v6", "actions/upload-pages-artifact@v5", "actions/deploy-pages@v5"]) if (!pages.includes(action)) errors.push(`Pages workflow is missing ${action}.`);
const healthView = readFileSync(resolve("src/components/operational-health.tsx"), "utf8");
const controlPlane = readFileSync(resolve("src/lib/agent-control-plane.ts"), "utf8");
if (!healthView.includes("AGENT_CATALOGUE")) errors.push("Operational health view is not bound to the versioned agent catalogue.");
for (const source of ["manifest.json", "2026-08-11-zm-prod-05g.json"]) if (!controlPlane.includes(source)) errors.push(`Agent control plane is missing authoritative source ${source}.`);
if (errors.length) { console.error(errors.join("\n")); process.exit(1); }
console.log(`Operational baseline verified: ${authoritative.length} unique live bindings, ${cleanup.candidates.length} non-destructive cleanup candidates.`);
