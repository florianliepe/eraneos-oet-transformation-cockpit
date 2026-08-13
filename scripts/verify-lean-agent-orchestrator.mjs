import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const workflow = JSON.parse(readFileSync(resolve("docs/n8n/agents/lean-pmo-orchestrator.workflow.json"), "utf8"));
const byName = new Map(workflow.nodes.map((node) => [node.name, node]));
const fail = (message) => { throw new Error(message); };
if (workflow.active) fail("Lean workflow must be imported as an inactive UAT candidate.");
if (workflow.name !== "Eraneos Transformation Cockpit - Lean PMO Orchestrator v2") fail("Unexpected workflow name.");
for (const obsolete of ["BuildSpecialistCalls", "ExecuteSelectedSpecialists", "AggregateSpecialistResults", "BuildRunningRunReceipt", "BuildResumedRunningRunReceipt", "GitHubMarkRunRunning", "PMO Assistant"]) if (byName.has(obsolete)) fail(`Obsolete runtime node remains: ${obsolete}`);
for (const required of ["BuildLeanRouting", "Lean PMO Agent", "BuildLeanRunContext", "BuildFailedRunReceipt", "GitHubFailRunReceipt", "Evidence Consistency Guard", "High Impact Governance Guard", "PMO Schema Guard"]) if (!byName.has(required)) fail(`Missing lean node: ${required}`);
const tools = workflow.nodes.filter((node) => node.type === "@n8n/n8n-nodes-langchain.toolWorkflow");
if (tools.length !== 3) fail(`Expected exactly 3 bounded workflow tools, found ${tools.length}.`);
for (const tool of tools) {
  if (tool.parameters.source !== "parameter") fail(`${tool.name} must be an inline workflow.`);
  const inline = JSON.parse(tool.parameters.workflowJson);
  const unsafe = inline.nodes.filter((node) => node.type !== "n8n-nodes-base.executeWorkflowTrigger" && node.type !== "n8n-nodes-base.code");
  if (unsafe.length) fail(`${tool.name} contains a side-effecting node.`);
  if (workflow.connections[tool.name]?.ai_tool?.[0]?.[0]?.node !== "Lean PMO Agent") fail(`${tool.name} is not connected as an AI tool.`);
}
const agent = byName.get("Lean PMO Agent");
const model = byName.get("OpenAI Chat Model");
if (model?.parameters?.options?.temperature !== 1) fail("Managed Claude route requires temperature=1.");
if (agent.onError !== "continueErrorOutput") fail("Lean agent failures must continue through the governed error output.");
if (workflow.connections["Lean PMO Agent"]?.main?.[1]?.[0]?.node !== "BuildFailedRunReceipt") fail("Lean agent error output does not persist a terminal failed receipt.");
if (!byName.get("BuildFailedRunReceipt").parameters.jsCode.includes("retryable:true")) fail("Failed receipts must satisfy the retryable contract.");
if (workflow.connections.RespondAgentRunAccepted?.main?.[0]?.[0]?.node !== "BuildLeanRouting") fail("Accepted runs must continue directly to lean routing without a consistency-prone intermediate write.");
if (JSON.stringify(workflow).includes("$node['PMO Assistant']")) fail("Lean workflow still references the removed PMO Assistant node.");
if (!JSON.stringify(byName.get("MergeIntoControlTower").parameters).includes("BuildLeanRunContext")) fail("Canonical merge must consume the lean run context.");
for (const name of ["GitHubCompleteRunReceipt", "GitHubFailRunReceipt"]) {
  const receiptStore = byName.get(name);
  if (!receiptStore.retryOnFail || receiptStore.maxTries !== 3 || receiptStore.waitBetweenTries !== 2000) fail(`${name} must use three bounded retries with a two-second delay.`);
}
for (const name of ["BuildLeanRunContext", "NormalizeCanonical", "GitHubCreateWorkPackageJson", "GitHubCreateWorkPackageMarkdown", "GitHubReadControlTowerForIngest", "MergeIntoControlTower", "BuildProposalSet", "GitHubStoreProposalSet", "FormatIngest", "BuildCompletedRunReceipt", "GitHubCompleteRunReceipt"]) {
  if (byName.get(name).onError !== "continueErrorOutput") fail(`${name} must continue into the terminal failure receipt.`);
  if (workflow.connections[name]?.main?.[1]?.[0]?.node !== "BuildFailedRunReceipt") fail(`${name} has no terminal failure-receipt edge.`);
}
if (agent.parameters.options.maxIterations > 4) fail("Agent iteration budget exceeds four.");
if (!agent.parameters.options.returnIntermediateSteps) fail("Tool-call receipts are disabled.");
const inputCode = byName.get("BuildAssistantInput").parameters.jsCode;
if (!inputCode.includes("80000") || !inputCode.includes("slice(0, 30000)")) fail("Evidence reliability caps are missing.");
const routingCode = byName.get("BuildLeanRouting").parameters.jsCode;
if (!routingCode.includes("work package") || !routingCode.includes("percent complete")) fail("Routine delivery language is missing from deterministic routing.");
const runContextCode = byName.get("BuildLeanRunContext").parameters.jsCode;
if (runContextCode.includes("workflowId:'pmo.orchestrate'") || runContextCode.includes("workflowId:'tool.")) fail("Lean run steps must remain compatible with the specialist workflow-id contract.");
if (!runContextCode.includes("latencyMs") || !runContextCode.includes("completedAt")) fail("Lean run context must measure terminal latency.");
const formatIngestCode = byName.get("FormatIngest").parameters.jsCode;
if (!formatIngestCode.includes("model:'claude-sonnet-5'") || !formatIngestCode.includes("promptVersion:'2.0.0'")) fail("Lean run metadata must identify the configured model and prompt version.");
if (!formatIngestCode.includes("operations:{") || !formatIngestCode.includes("latencyMs:Number(aggregate.latencyMs||0)")) fail("Lean terminal envelopes must expose measured latency through the operations contract.");
const publisher = byName.get("ExecuteGovernedPublisher");
if (publisher.maxTries !== 2 || publisher.waitBetweenTries !== 2000) fail("Publisher retry policy is not bounded.");
console.log(`Lean orchestrator verified: ${workflow.nodes.length} nodes, ${tools.length} read-only tools, bounded retries and evidence context.`);
