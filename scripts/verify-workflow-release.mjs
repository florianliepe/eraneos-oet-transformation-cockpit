import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const release = JSON.parse(readFileSync(resolve("docs/n8n/releases/2026-08-12-zm-prod-18-1.json"), "utf8"));
const errors = [];
if (release.releaseContract !== "workflow-release-1.0") errors.push("Invalid release contract.");
if (release.endpoint.webhookPath !== "a2126107-4e70-4717-8f1c-545d7f310741") errors.push("Public endpoint contract changed.");
for (const artifact of release.artifacts) {
  const content = readFileSync(resolve(artifact.file), "utf8");
  const checksum = createHash("sha256").update(content.replace(/\r\n/g, "\n")).digest("hex");
  if (checksum !== artifact.sha256) errors.push(`Checksum mismatch: ${artifact.file}`);
  const workflow = JSON.parse(content);
  if (workflow.active !== false) errors.push(`Source workflow must be inactive: ${artifact.file}`);
  if (!workflow.name || !workflow.nodes?.length || !workflow.connections) errors.push(`Invalid workflow backup: ${artifact.file}`);
  for (const node of workflow.nodes || []) {
    const code = node.parameters?.jsCode;
    if (!code) continue;
    try { new Function(code); }
    catch (reason) { errors.push(`Invalid Code node syntax: ${artifact.file} / ${node.name}: ${reason instanceof Error ? reason.message : String(reason)}`); }
  }
}
const serialized = JSON.stringify(release);
for (const forbidden of ["apiKey", "accessToken", "clientSecret", "password", "webhookSecret"]) {
  if (new RegExp(`\\"${forbidden}\\"\\s*:`, "i").test(serialized)) errors.push(`Release inventory contains forbidden credential value field: ${forbidden}`);
}
for (const binding of release.credentialBindings) if (!binding.scope.includes("no credential value exported")) errors.push(`Credential scope disclaimer missing: ${binding.name}`);
if (release.recoveryEvidence.result !== "success" || !release.recoveryEvidence.assertion.includes("shouldWrite=false")) errors.push("Recovery rehearsal evidence is incomplete.");
const orchestrator = JSON.parse(readFileSync(resolve("docs/n8n-pmo-orchestrator.workflow.json"), "utf8"));
const names = new Set(orchestrator.nodes.map((node) => node.name));
for (const required of ["GitHubReadAgentRunReceipt", "GitHubStoreAcceptedRunReceipt", "RespondAgentRunAccepted", "GitHubCompleteRunReceipt", "IfRunStatus", "RespondRunStatus"]) if (!names.has(required)) errors.push(`Agent resilience node is missing: ${required}`);
if (!release.endpoint.contractModes.includes("pmo.run.status")) errors.push("Run status contract mode is missing.");
if (orchestrator.connections.RespondAgentRunAccepted?.main?.[0]?.[0]?.node !== "BuildRunningRunReceipt") errors.push("Accepted response does not continue into governed background processing.");
if (orchestrator.connections.FormatExistingAgentRun?.main?.[0]?.[0]?.node !== "RespondExistingAgentRun" || orchestrator.connections.RespondExistingAgentRun) errors.push("Existing idempotency receipts must respond without restarting specialists.");
if (orchestrator.connections.FormatIngest?.main?.[0]?.[0]?.node !== "BuildCompletedRunReceipt") errors.push("Completed results do not update the durable receipt.");
const buildCalls = orchestrator.nodes.find((node) => node.name === "BuildSpecialistCalls")?.parameters?.jsCode || "";
if (!buildCalls.includes("executionId = String(source.runId") || !buildCalls.includes("smart-routing-1.1.0")) errors.push("Stable execution identity or honest routing policy is missing.");
const assistantCode = orchestrator.nodes.find((node) => node.name === "BuildAssistantInput")?.parameters?.jsCode || "";
for (const identifier of ["correlationId", "idempotencyKey", "runId", "runPath"]) {
  if ((assistantCode.match(new RegExp(`const ${identifier}\\b`, "g")) || []).length !== 1) errors.push(`BuildAssistantInput must declare ${identifier} exactly once.`);
}
if (new Set(orchestrator.nodes.map((node) => node.name)).size !== orchestrator.nodes.length) errors.push("Orchestrator node names are not unique.");
if (errors.length) { console.error(errors.join("\n")); process.exit(1); }
console.log(`Workflow release ${release.releaseId} verified; endpoint and ${release.artifacts.length} backups are restorable.`);
