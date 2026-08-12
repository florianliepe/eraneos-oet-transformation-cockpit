import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const readJson = (path) => JSON.parse(readFileSync(resolve(path), "utf8"));
const orchestrator = readJson("docs/n8n-pmo-orchestrator.workflow.json");
const publisher = readJson("docs/n8n/agents/governed-publisher.workflow.json");
const manifest = readJson("docs/n8n/agents/manifest.json");
const errors = [];
const requireNode = (workflow, name) => {
  const node = workflow.nodes.find((item) => item.name === name);
  if (!node) errors.push(`Missing node: ${name}`);
  return node;
};

if (orchestrator.nodes.some((node) => node.name === "GitHubSaveControlTowerForIngest")) {
  errors.push("Agent ingestion can still write the canonical PMO document directly.");
}
for (const name of [
  "BuildProposalSet", "GitHubStoreProposalSet", "PrepareReviewRequest",
  "ValidateReviewDecision", "GitHubStoreReviewBundle", "PreparePublishRequest",
  "BuildPublisherInput", "ExecuteGovernedPublisher",
]) requireNode(orchestrator, name);

for (const name of ["GitHubReadProposalForReview", "GitHubReadProposalForPublish", "GitHubReadReviewForPublish", "GitHubReadCanonicalForPublish"]) {
  const node = requireNode(orchestrator, name);
  if (node?.parameters?.asBinaryProperty !== false || "binaryData" in (node?.parameters || {})) {
    errors.push(`${name} does not use the supported decoded-content GitHub read contract.`);
  }
}

const proposalTarget = orchestrator.connections.MergeIntoControlTower?.main?.[0]?.[0]?.node;
if (proposalTarget !== "BuildProposalSet") errors.push("Ingestion does not terminate in proposal generation.");
const mergeCode = requireNode(orchestrator, "MergeIntoControlTower")?.parameters?.jsCode || "";
if (!mergeCode.includes("projectBefore!==projectAfter")) errors.push("Project metadata is still mutated without a meaningful project-field change.");
const proposalCode = requireNode(orchestrator, "BuildProposalSet")?.parameters?.jsCode || "";
if (!proposalCode.includes("status:proposals.length?'pending_review':'rejected'")) errors.push("Empty proposal sets can still enter human review.");
const formatIngestCode = requireNode(orchestrator, "FormatIngest")?.parameters?.jsCode || "";
if (!formatIngestCode.includes("NO_MEANINGFUL_PMO_CHANGE")) errors.push("No-change evidence runs do not expose an actionable warning.");
const prepareRequest = requireNode(orchestrator, "PrepareRequest")?.parameters?.jsCode || "";
for (const mode of ["pmo.review", "pmo.publish"]) {
  if (!prepareRequest.includes(mode)) errors.push(`PrepareRequest does not allow ${mode}.`);
}

const publishNode = requireNode(publisher, "GitHubPublishCanonicalPMO");
if (publishNode?.parameters?.operation !== "edit" || publishNode?.parameters?.filePath !== "knowledge/pmo/control-tower.json") {
  errors.push("The governed publisher is not bound to the canonical PMO document.");
}
const validator = requireNode(publisher, "ValidateGovernedPublication")?.parameters?.jsCode || "";
for (const marker of [
  "authorized!==true", "schemaVersion!=='2.0'", "sourceRevision", "expectedObjectVersion",
  "evidenceIds", "idempotencyKey", "review.decisions", "AUD-REVIEW", "AUD-PUBLISH", "objectVersions",
]) {
  if (!validator.includes(marker)) errors.push(`Publisher validation marker missing: ${marker}`);
}

const agentWorkflows = [orchestrator, publisher, ...manifest.workflows.map((item) => readJson(`docs/n8n/agents/${item.file}`))];
const canonicalWriters = agentWorkflows.flatMap((workflow) => workflow.nodes
  .filter((node) => node.type === "n8n-nodes-base.github" && node.parameters?.operation === "edit" && node.parameters?.filePath === "knowledge/pmo/control-tower.json" && node.name !== "GitHubSaveControlTower")
  .map((node) => `${workflow.name}:${node.name}`));
if (canonicalWriters.length !== 1 || canonicalWriters[0] !== `${publisher.name}:GitHubPublishCanonicalPMO`) {
  errors.push(`Expected exactly one agent-path canonical writer; found ${canonicalWriters.join(", ") || "none"}.`);
}

const executePublisher = requireNode(orchestrator, "ExecuteGovernedPublisher");
const boundId = executePublisher?.parameters?.workflowId?.value;
if (process.env.REQUIRE_LIVE_WORKFLOW_IDS === "1") {
  if (!manifest.publisher?.liveWorkflowId) errors.push("Publisher live workflow ID is not recorded in the manifest.");
  if (boundId !== manifest.publisher?.liveWorkflowId) errors.push("Orchestrator publisher binding differs from the manifest.");
}

if (errors.length) {
  console.error(errors.map((error) => `- ${error}`).join("\n"));
  process.exit(1);
}
console.log(`Governed publisher verified: ${canonicalWriters[0]}; binding=${boundId}.`);
