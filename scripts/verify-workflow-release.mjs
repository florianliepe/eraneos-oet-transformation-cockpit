import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const release = JSON.parse(readFileSync(resolve("docs/n8n/releases/2026-08-11-zm-prod-05g.json"), "utf8"));
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
}
const serialized = JSON.stringify(release);
for (const forbidden of ["apiKey", "accessToken", "clientSecret", "password", "webhookSecret"]) {
  if (new RegExp(`\\"${forbidden}\\"\\s*:`, "i").test(serialized)) errors.push(`Release inventory contains forbidden credential value field: ${forbidden}`);
}
for (const binding of release.credentialBindings) if (!binding.scope.includes("no credential value exported")) errors.push(`Credential scope disclaimer missing: ${binding.name}`);
if (release.recoveryEvidence.result !== "success" || !release.recoveryEvidence.assertion.includes("shouldWrite=false")) errors.push("Recovery rehearsal evidence is incomplete.");
if (errors.length) { console.error(errors.join("\n")); process.exit(1); }
console.log(`Workflow release ${release.releaseId} verified; endpoint and ${release.artifacts.length} backups are restorable.`);
