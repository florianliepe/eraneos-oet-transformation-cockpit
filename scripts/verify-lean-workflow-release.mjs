import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const release = JSON.parse(readFileSync(resolve("docs/n8n/releases/2026-08-14-zm-prod-27-release-safety.json"), "utf8"));
const capabilities = JSON.parse(readFileSync(resolve("docs/n8n/model-capabilities.json"), "utf8"));
const errors = [];
const fail = (message) => errors.push(message);
const canonical = (file) => readFileSync(resolve(file), "utf8").replace(/\r\n/g, "\n");

if (release.releaseContract !== "workflow-release-2.0" || release.status !== "candidate") fail("Lean release must use the candidate workflow-release-2.0 contract.");
if (!release.binding?.promotionRequiresCanary || !release.binding?.rollbackWorkflowId) fail("Candidate promotion lacks canary or rollback metadata.");
if (release.endpoint?.webhookPath !== "8d92d8ef-4267-4e67-88e8-8daab51c9361") fail("Lean webhook path changed.");
if (!release.endpoint?.contractModes?.includes("pmo.run.status")) fail("Run status mode is missing from the release contract.");

for (const artifact of release.artifacts || []) {
  const content = canonical(artifact.file);
  const digest = createHash("sha256").update(content).digest("hex");
  if (digest !== artifact.sha256) fail(`Checksum mismatch: ${artifact.file}`);
  if (!artifact.file.endsWith(".workflow.json")) continue;
  const workflow = JSON.parse(content);
  if (workflow.active !== false) fail(`Source workflow must be inactive: ${artifact.file}`);
  const nodes = workflow.nodes || [];
  const names = new Set(nodes.map((node) => node.name));
  const ids = new Set(nodes.map((node) => node.id));
  if (names.size !== nodes.length) fail(`Duplicate node name: ${artifact.file}`);
  if (ids.size !== nodes.length) fail(`Duplicate node id: ${artifact.file}`);
  const incoming = new Map(nodes.map((node) => [node.name, 0]));
  const outgoing = new Map(nodes.map((node) => [node.name, 0]));
  for (const [source, groups] of Object.entries(workflow.connections || {})) {
    if (!names.has(source)) fail(`Connection source is missing: ${artifact.file} / ${source}`);
    for (const outputs of Object.values(groups || {})) for (const branch of outputs || []) for (const edge of branch || []) {
      if (!names.has(edge.node)) fail(`Connection target is missing: ${artifact.file} / ${source} -> ${edge.node}`);
      outgoing.set(source, (outgoing.get(source) || 0) + 1);
      incoming.set(edge.node, (incoming.get(edge.node) || 0) + 1);
    }
  }
  for (const node of nodes) {
    const code = node.parameters?.jsCode;
    if (code) try { new Function(code); } catch (reason) { fail(`Invalid Code node: ${artifact.file} / ${node.name}: ${reason instanceof Error ? reason.message : String(reason)}`); }
    const isolated = (incoming.get(node.name) || 0) === 0 && (outgoing.get(node.name) || 0) === 0;
    if (isolated) fail(`Orphan runtime node: ${artifact.file} / ${node.name}`);
  }
}

const orchestrator = JSON.parse(canonical("docs/n8n/agents/lean-pmo-orchestrator.workflow.json"));
const model = orchestrator.nodes.find((node) => node.name === "OpenAI Chat Model");
const agent = orchestrator.nodes.find((node) => node.name === "Lean PMO Agent");
const modelName = "claude-sonnet-5";
const capability = capabilities.models?.[modelName];
if (capabilities.contractVersion !== "model-capabilities-1.0" || !capability) fail("Configured runtime model has no capability contract.");
if (model?.parameters?.options?.temperature !== capability?.sampling?.temperature?.value) fail("Model sampling temperature violates its capability contract.");
if (agent?.parameters?.options?.maxIterations !== capability?.maxAgentIterations) fail("Agent iteration budget violates its model capability contract.");
for (const obsolete of ["PMO Assistant", "AggregateSpecialistResults", "BuildRunningRunReceipt", "GitHubMarkRunRunning", "RespondIngest"]) if (JSON.stringify(orchestrator).includes(obsolete)) fail(`Obsolete runtime marker remains: ${obsolete}`);
const serialized = JSON.stringify(release);
for (const forbidden of ["apiKey", "accessToken", "clientSecret", "password", "webhookSecret"]) if (new RegExp(`\\"${forbidden}\\"\\s*:`, "i").test(serialized)) fail(`Forbidden credential value field: ${forbidden}`);

if (errors.length) { console.error(errors.join("\n")); process.exit(1); }
console.log(`Lean workflow release ${release.releaseId} verified: graph, checksums, model capabilities and rollback metadata are safe.`);
