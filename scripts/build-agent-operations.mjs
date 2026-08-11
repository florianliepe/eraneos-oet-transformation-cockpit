import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const manifestPath = resolve("docs/n8n/agents/manifest.json");
const orchestratorPath = resolve("docs/n8n-pmo-orchestrator.workflow.json");
const errorPath = resolve("docs/n8n/agents/error-handler.workflow.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const orchestrator = JSON.parse(readFileSync(orchestratorPath, "utf8"));
const existingErrorId = manifest.operations?.errorWorkflowLiveId;

for (const name of ["ExecuteSelectedSpecialists", "ExecuteGovernedPublisher"]) {
  const node = orchestrator.nodes.find((item) => item.name === name);
  if (!node) throw new Error(`Missing retry target ${name}.`);
  node.retryOnFail = true;
  node.maxTries = 3;
  node.waitBetweenTries = 1500;
  node.onError = "stopWorkflow";
}
orchestrator.settings = { ...orchestrator.settings, ...(existingErrorId ? { errorWorkflow: existingErrorId } : {}) };
writeFileSync(orchestratorPath, `${JSON.stringify(orchestrator, null, 2)}\n`);

const githubCredential = { id: "3V46mglu7fpoPISX", name: "GitHub data" };
const normalizeCode = `const error=$json.execution?.error||$json.error||{};const executionId=String($json.execution?.id||'unknown');const workflowId=String($json.workflow?.id||'unknown');const failedAt=new Date().toISOString();const safe=(workflowId+'-'+executionId+'-'+failedAt).replace(/[^A-Za-z0-9._-]/g,'-');const record={contractVersion:'agent-dead-letter-1.0',id:'DLQ-'+safe,executionId,workflowId,workflowName:String($json.workflow?.name||'Unknown workflow'),failedAt,status:'waiting',failedStep:String($json.execution?.lastNodeExecuted||'unknown'),error:{name:String(error.name||'WorkflowError'),message:String(error.message||'Unknown workflow failure')},recovery:{retryLimit:3,safeActions:['retry_original_input','replay_current_workflow'],originalExecutionImmutable:true},source:$json};return [{json:{record,path:'knowledge/pmo/dead-letter/'+safe+'.json',fileContent:JSON.stringify(record,null,2)+'\\n',commitMessage:'ops: dead-letter agent execution '+executionId}}];`;
const workflow = {
  name: "OET PMO Agent - Central Error and Dead-letter Handler",
  nodes: [
    { parameters: {}, type: "n8n-nodes-base.errorTrigger", typeVersion: 1, position: [-300, 0], id: "agent-error-trigger", name: "Agent Workflow Error" },
    { parameters: { jsCode: normalizeCode }, type: "n8n-nodes-base.code", typeVersion: 2, position: [-60, 0], id: "normalize-agent-error", name: "Normalize Failed Execution" },
    { parameters: { authentication: "accessToken", resource: "file", operation: "create", owner: { __rl: true, value: "florianliepe", mode: "name" }, repository: { __rl: true, value: "eraneos-oet-transformation-cockpit-data", mode: "name" }, filePath: "={{ $json.path }}", fileContent: "={{ $json.fileContent }}", commitMessage: "={{ $json.commitMessage }}", binaryData: false, additionalParameters: { branch: { branch: "main" } } }, type: "n8n-nodes-base.github", typeVersion: 1.1, position: [180, 0], id: "store-agent-dead-letter", name: "Store Agent Dead Letter", credentials: { githubApi: githubCredential } },
    { parameters: { jsCode: "return [{json:{ok:true,deadLetter:$node['Normalize Failed Execution'].json.record,commitSha:$json.commit?.sha??$json.content?.sha}}];" }, type: "n8n-nodes-base.code", typeVersion: 2, position: [420, 0], id: "format-agent-dead-letter", name: "Format Dead Letter" },
  ],
  connections: { "Agent Workflow Error": { main: [[{ node: "Normalize Failed Execution", type: "main", index: 0 }]] }, "Normalize Failed Execution": { main: [[{ node: "Store Agent Dead Letter", type: "main", index: 0 }]] }, "Store Agent Dead Letter": { main: [[{ node: "Format Dead Letter", type: "main", index: 0 }]] } },
  active: false, settings: { executionOrder: "v1" }, versionId: "agent-error-handler-v1", tags: [],
};
writeFileSync(errorPath, `${JSON.stringify(workflow, null, 2)}\n`);
manifest.operations = { contractVersion: "agent-operations-1.0", errorWorkflowFile: "error-handler.workflow.json", boundedRetries: { maxTries: 3, waitBetweenTriesMs: 1500 }, ...(existingErrorId ? { errorWorkflowLiveId: existingErrorId } : {}) };
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Built agent operations controls (error workflow ${existingErrorId || "UNBOUND"}).`);
