import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const workflow = JSON.parse(readFileSync(resolve("docs/n8n/agents/lean-pmo-orchestrator.workflow.json"), "utf8"));
const byName = new Map(workflow.nodes.map((node) => [node.name, node]));
const fail = (message) => { throw new Error(message); };
if (workflow.active) fail("Lean workflow must be imported as an inactive UAT candidate.");
if (workflow.name !== "Eraneos Transformation Cockpit - Lean PMO Orchestrator v2") fail("Unexpected workflow name.");
for (const obsolete of ["BuildSpecialistCalls", "ExecuteSelectedSpecialists", "AggregateSpecialistResults", "PMO Assistant"]) if (byName.has(obsolete)) fail(`Obsolete runtime node remains: ${obsolete}`);
for (const required of ["BuildLeanRouting", "Lean PMO Agent", "BuildLeanRunContext", "Evidence Consistency Guard", "High Impact Governance Guard", "PMO Schema Guard"]) if (!byName.has(required)) fail(`Missing lean node: ${required}`);
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
if (agent.parameters.options.maxIterations > 4) fail("Agent iteration budget exceeds four.");
if (!agent.parameters.options.returnIntermediateSteps) fail("Tool-call receipts are disabled.");
const inputCode = byName.get("BuildAssistantInput").parameters.jsCode;
if (!inputCode.includes("80000") || !inputCode.includes("slice(0, 30000)")) fail("Evidence reliability caps are missing.");
const publisher = byName.get("ExecuteGovernedPublisher");
if (publisher.maxTries !== 2 || publisher.waitBetweenTries !== 2000) fail("Publisher retry policy is not bounded.");
console.log(`Lean orchestrator verified: ${workflow.nodes.length} nodes, ${tools.length} read-only tools, bounded retries and evidence context.`);
