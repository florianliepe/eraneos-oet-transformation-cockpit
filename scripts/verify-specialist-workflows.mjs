import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve("docs/n8n/agents");
const manifest = JSON.parse(readFileSync(resolve(root, "manifest.json"), "utf8"));
const fixture = JSON.parse(readFileSync(resolve("tests/fixtures/agent-workflows/selected-specialists.json"), "utf8"));
const expected = new Set(["evidence.verify", "delivery.plan", "risk.analyse", "meeting.synthesise", "controls.classify", "governance.review"]);
if (manifest.contractVersion !== "agent-run-1.0" || manifest.workflows.length !== expected.size) throw new Error("Invalid specialist workflow manifest.");
if (manifest.orchestrator?.workflowId !== "pmo.orchestrate" || manifest.orchestrator?.webhookPath !== "a2126107-4e70-4717-8f1c-545d7f310741") throw new Error("Invalid orchestrator binding manifest.");
for (const entry of manifest.workflows) {
  if (!expected.delete(entry.workflowId)) throw new Error(`Unexpected or duplicate workflow ${entry.workflowId}.`);
  const workflow = JSON.parse(readFileSync(resolve(root, entry.file), "utf8"));
  const types = new Set(workflow.nodes.map((node) => node.type));
  for (const type of ["n8n-nodes-base.executeWorkflowTrigger", "n8n-nodes-base.code", "@n8n/n8n-nodes-langchain.agent", "@n8n/n8n-nodes-langchain.lmChatOpenAi"]) {
    if (!types.has(type)) throw new Error(`${entry.file} is missing ${type}.`);
  }
  const serialized = JSON.stringify(workflow);
  for (const marker of [entry.workflowId, entry.workflowVersion, entry.promptVersion, "agent-run-1.0", "untrusted-source", "Invalid fenced specialist JSON"]) {
    if (!serialized.includes(marker)) throw new Error(`${entry.file} is missing contract marker ${marker}.`);
  }
  if (workflow.active) throw new Error(`${entry.file} must be inactive in source control.`);
}
if (expected.size) throw new Error(`Missing specialist workflows: ${[...expected].join(", ")}`);
if (fixture.contractVersion !== manifest.contractVersion || !fixture.executionId || !fixture.correlationId || !Array.isArray(fixture.evidence) || !fixture.evidence.length) {
  throw new Error("Invalid specialist input fixture.");
}
const selected = String(fixture.meta.agent_workflows).split(",").map((item) => item.trim()).filter(Boolean);
if (JSON.stringify(selected) !== JSON.stringify(fixture.expectedSelectedWorkflows)) throw new Error("Fixture routing expectation is inconsistent.");
const orchestrator = JSON.parse(readFileSync(resolve("docs/n8n-pmo-orchestrator.workflow.json"), "utf8"));
const orchestratorTypes = new Set(orchestrator.nodes.map((node) => node.type));
if (!orchestratorTypes.has("n8n-nodes-base.executeWorkflow")) throw new Error("Orchestrator is missing Execute Sub-workflow.");
for (const nodeName of ["BuildSpecialistCalls", "ExecuteSelectedSpecialists", "AggregateSpecialistResults"]) {
  if (!orchestrator.nodes.some((node) => node.name === nodeName)) throw new Error(`Orchestrator is missing ${nodeName}.`);
}
const buildCalls = orchestrator.nodes.find((node) => node.name === "BuildSpecialistCalls").parameters.jsCode;
for (const workflowId of fixture.expectedSelectedWorkflows) {
  if (!buildCalls.includes(workflowId)) throw new Error(`Orchestrator routing is missing ${workflowId}.`);
}
const smoke = JSON.parse(readFileSync(resolve(root, "smoke-test.workflow.json"), "utf8"));
const smokeTypes = new Set(smoke.nodes.map((node) => node.type));
for (const type of ["n8n-nodes-base.manualTrigger", "n8n-nodes-base.executeWorkflow", "n8n-nodes-base.code"]) {
  if (!smokeTypes.has(type)) throw new Error(`Smoke workflow is missing ${type}.`);
}
const smokeSerialized = JSON.stringify(smoke);
for (const marker of [fixture.executionId, fixture.correlationId, ...fixture.expectedSelectedWorkflows, "Validate Live Contract"]) {
  if (!smokeSerialized.includes(marker)) throw new Error(`Smoke workflow is missing ${marker}.`);
}
const executeNodes = [orchestrator, smoke].map((candidate) => candidate.nodes.find((node) => node.type === "n8n-nodes-base.executeWorkflow"));
for (const node of executeNodes) {
  if (node.typeVersion !== 1.3 || node.parameters.workflowId?.mode !== "id" || node.parameters.workflowId?.value !== "={{ $json.liveWorkflowId }}") {
    throw new Error(`${node.name} does not use the n8n 1.3 workflow resource locator contract.`);
  }
}
for (const name of ["ExecuteSelectedSpecialists", "ExecuteGovernedPublisher"]) {
  const node = orchestrator.nodes.find((item) => item.name === name);
  if (!node?.retryOnFail || node.maxTries !== 3 || node.waitBetweenTries !== 1500) throw new Error(`${name} is missing the bounded retry policy.`);
}
const errorWorkflow = JSON.parse(readFileSync(resolve(root, manifest.operations?.errorWorkflowFile || "error-handler.workflow.json"), "utf8"));
for (const type of ["n8n-nodes-base.errorTrigger", "n8n-nodes-base.github"]) {
  if (!errorWorkflow.nodes.some((node) => node.type === type)) throw new Error(`Central error workflow is missing ${type}.`);
}
const errorSerialized = JSON.stringify(errorWorkflow);
for (const marker of ["agent-dead-letter-1.0", "retry_original_input", "replay_current_workflow", "originalExecutionImmutable"]) {
  if (!errorSerialized.includes(marker)) throw new Error(`Central error workflow is missing ${marker}.`);
}
if (process.env.REQUIRE_LIVE_WORKFLOW_IDS === "1") {
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(String(manifest.orchestrator.liveWorkflowId || ""))) throw new Error("Missing live orchestrator binding.");
  for (const entry of manifest.workflows) {
    if (!/^[A-Za-z0-9_-]{8,64}$/.test(String(entry.liveWorkflowId || ""))) throw new Error(`Missing live workflow binding for ${entry.workflowId}.`);
    if (!buildCalls.includes(entry.liveWorkflowId)) throw new Error(`Orchestrator does not contain the live binding for ${entry.workflowId}.`);
  }
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(String(manifest.operations?.errorWorkflowLiveId || ""))) throw new Error("Missing live central error workflow binding.");
  if (orchestrator.settings?.errorWorkflow !== manifest.operations.errorWorkflowLiveId) throw new Error("Orchestrator is not bound to the central error workflow.");
}
console.log("Six specialist workflow contracts and selected-routing fixture verified.");
