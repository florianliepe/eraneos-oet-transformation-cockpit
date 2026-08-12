import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const workflowPath = resolve("docs/n8n-pmo-orchestrator.workflow.json");
const manifestPath = resolve("docs/n8n/agents/manifest.json");
const workflow = JSON.parse(readFileSync(workflowPath, "utf8"));
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const governedPublisherPath = resolve("docs/n8n/agents/governed-publisher.workflow.json");

const liveIds = Object.fromEntries(
  manifest.workflows.map((item) => [item.workflowId, item.liveWorkflowId || `UNBOUND:${item.workflowId}`]),
);
const workflowIds = manifest.workflows.map((item) => item.workflowId);

const upsertNode = (node) => {
  const index = workflow.nodes.findIndex((item) => item.name === node.name);
  if (index >= 0) workflow.nodes[index] = node;
  else workflow.nodes.push(node);
};

const buildCallsCode = `const source = $node['BuildAssistantInput'].json;
const allowed = ${JSON.stringify(workflowIds)};
const bindings = ${JSON.stringify(liveIds)};
const executionId = String(source.runId || ('agent:' + source.meta?.idempotency_key));
const correlationId = String(source.meta?.correlation_id || executionId);
const requestedAt = new Date().toISOString();
const evidence = source.extracted.map((item,index)=>({id:String(item.id || item.name || 'evidence-'+(index+1)),name:String(item.name || item.type || 'evidence'),type:String(item.type || 'text'),content:String(item.content || '')}));
const combined=evidence.map(item=>item.content).join('\\n')+'\\n'+String(source.meta?.text_update||source.meta?.title||'');
if(!combined.trim()&&!evidence.length) return [];
const rules=[['meeting.synthesise',/meeting|minutes|attendee|agenda|workshop|discussion/i,'Meeting evidence'],['risk.analyse',/risk|threat|probability|impact|mitigation|exposure/i,'Risk evidence'],['delivery.plan',/milestone|deliverable|deadline|schedule|plan|progress|delay/i,'Delivery evidence'],['controls.classify',/issue|action|decision|dependency|assumption|change request|approval/i,'PMO control evidence'],['governance.review',/audit|governance|evidence|review|compliance|approve/i,'Governance evidence']];
const requested=String(source.meta?.agent_workflows||'').split(',').map(value=>value.trim()).filter(value=>allowed.includes(value));
const manual=Boolean(String(source.meta?.manual_override_reason||'').trim());
if(manual&&(!String(source.meta?.manual_override_actor||'').trim()||!requested.length)) throw new Error('Manual routing requires actor, reason and specialists.');
let selected=manual?requested:rules.filter(rule=>rule[1].test(combined)).map(rule=>rule[0]);
if(evidence.length) selected.unshift('evidence.verify');
if(!selected.length) selected=['evidence.verify'];
if(selected.some(id=>id!=='evidence.verify')&&!selected.includes('governance.review')) selected.push('governance.review');
selected=[...new Set(selected)];
const order=['evidence.verify','meeting.synthesise','risk.analyse','delivery.plan','controls.classify','governance.review']; selected=order.filter(id=>selected.includes(id));
const maxSpecialists=Math.max(1,Math.min(6,Number(source.meta?.budget_max_specialists||4))); const maxTokens=Math.max(1800,Number(source.meta?.budget_max_tokens||9000)); const maxCost=Math.max(.018,Number(source.meta?.budget_max_cost_eur||.1)); const maxLatency=Math.max(150000,Number(source.meta?.budget_max_latency_ms||360000));
const routed=selected.filter((id,index)=>index<maxSpecialists&&(index+1)*1800<=maxTokens&&(index+1)*.018<=maxCost&&(index+1)*60000+90000<=maxLatency); const limited=routed.length<selected.length;
return routed.map((workflowId,index)=>({json:{contractVersion:'agent-run-1.0',executionId,correlationId,requestedAt,meta:source.meta,evidence,workflowId,liveWorkflowId:bindings[workflowId],routingPlan:{policyVersion:'smart-routing-1.1.0',workflowId,sequence:index+1,reason:manual?'Accountable manual override':workflowId==='evidence.verify'?'Evidence verification precedes dependent analysis':(rules.find(rule=>rule[0]===workflowId)?.[2]||'Final governance review'),budget:{maxTokens,maxCostEur:maxCost,maxLatencyMs:maxLatency,estimatedTokens:routed.length*1800,estimatedCostEur:routed.length*.018,estimatedLatencyMs:routed.length*60000+90000,limited},manualOverride:manual?{actor:String(source.meta.manual_override_actor),reason:String(source.meta.manual_override_reason)}:undefined}}}));`;

const aggregateCode = `const calls=$input.all().map(item=>item.json);
if(!calls.length) throw new Error('No specialist result was returned.');
const source=$node['BuildAssistantInput'].json;
const arr=value=>Array.isArray(value)?value:[];
const steps=calls.map(call=>({workflowId:String(call.workflowId),workflowVersion:String(call.workflowVersion||'unknown'),promptVersion:String(call.promptVersion||'unknown'),model:String(call.model||'unknown'),status:['completed','needs_review','failed','skipped'].includes(call.status)?call.status:'failed',summary:String(call.summary||'No summary returned.'),confidence:['low','medium','high','not_assessed'].includes(call.confidence)?call.confidence:'not_assessed',evidenceIds:arr(call.evidenceIds).map(String),proposalIds:arr(call.proposalIds).map(String),startedAt:String(call.startedAt||new Date().toISOString()),completedAt:String(call.completedAt||new Date().toISOString())}));
const proposals=calls.flatMap(call=>arr(call.proposals));
const warnings=calls.flatMap(call=>arr(call.warnings));
const routingPlan=calls.map(call=>call.routingPlan).filter(Boolean);
const conflictKeys=[]; const grouped={}; for(const proposal of proposals){const key=String(proposal.entity||'unknown')+':'+String(proposal.objectId||'new');(grouped[key]??=[]).push(proposal);} for(const [key,items] of Object.entries(grouped)){if(new Set(items.map(item=>String(item.action)+':'+String(item.summary).trim().toLowerCase())).size>1) conflictKeys.push(key);}
const lowConfidence=steps.filter(step=>['low','not_assessed'].includes(step.confidence)).map(step=>step.workflowId); const budgetLimited=Boolean(routingPlan[0]?.budget?.limited);
if(conflictKeys.length) warnings.push({code:'SPECIALIST_CONFLICT',message:'Conflicting specialist proposals require accountable review: '+conflictKeys.join(', '),evidenceIds:[]});
if(lowConfidence.length) warnings.push({code:'LOW_CONFIDENCE_ESCALATION',message:'Low-confidence specialist outcomes require accountable review: '+lowConfidence.join(', '),evidenceIds:[]});
if(budgetLimited) warnings.push({code:'BUDGET_LIMIT_REACHED',message:'The run stopped within its configured budget; no canonical write is authorized.',evidenceIds:[]});
const selectedWorkflows=steps.map(step=>step.workflowId);
const specialistContext=JSON.stringify({steps,proposals,warnings},null,2);
const assistant_input=source.assistant_input+'\\n\\nTrusted specialist results (proposals only; not approved or persisted):\\n'+specialistContext;
return [{json:{meta:source.meta,extracted:source.extracted,assistant_input,executionId:String(calls[0].executionId||$node['BuildSpecialistCalls'].json.executionId),correlationId:String(calls[0].correlationId||$node['BuildSpecialistCalls'].json.correlationId),requestedAt:String(calls[0].requestedAt||$node['BuildSpecialistCalls'].json.requestedAt),selectedWorkflows,steps,proposals,warnings,routingPlan}}];`;

const workflowInputs = {
  mappingMode: "defineBelow",
  value: {
    contractVersion: "={{ $json.contractVersion }}",
    executionId: "={{ $json.executionId }}",
    correlationId: "={{ $json.correlationId }}",
    requestedAt: "={{ $json.requestedAt }}",
    meta: "={{ $json.meta }}",
    evidence: "={{ $json.evidence }}",
  },
  matchingColumns: [],
  schema: [
    ["contractVersion", "string"], ["executionId", "string"], ["correlationId", "string"], ["requestedAt", "string"], ["meta", "object"], ["evidence", "array"],
  ].map(([id, type]) => ({ id, displayName: id, required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type })),
  attemptToConvertTypes: false,
  convertFieldsToString: false,
};

upsertNode({ parameters: { jsCode: buildCallsCode }, type: "n8n-nodes-base.code", typeVersion: 2, position: [480, 176], id: "build-specialist-calls", name: "BuildSpecialistCalls" });
upsertNode({ parameters: { source: "database", workflowId: { __rl: true, value: "={{ $json.liveWorkflowId }}", mode: "id" }, workflowInputs, mode: "each", options: { waitForSubWorkflow: true } }, type: "n8n-nodes-base.executeWorkflow", typeVersion: 1.3, position: [720, 176], id: "execute-selected-specialists", name: "ExecuteSelectedSpecialists", retryOnFail: true, maxTries: 3, waitBetweenTries: 1500 });
upsertNode({ parameters: { jsCode: aggregateCode }, type: "n8n-nodes-base.code", typeVersion: 2, position: [960, 176], id: "aggregate-specialist-results", name: "AggregateSpecialistResults" });

const position = (name, value) => {
  const node = workflow.nodes.find((item) => item.name === name);
  if (node) node.position = value;
};
position("PMO Assistant", [1200, 176]);
position("OpenAI Chat Model", [1200, 416]);
for (const [index, name] of ["NormalizeCanonical", "GitHubCreateWorkPackageJson", "GitHubCreateWorkPackageMarkdown", "GitHubReadControlTowerForIngest", "MergeIntoControlTower", "GitHubSaveControlTowerForIngest", "FormatIngest", "RespondIngest"].entries()) {
  position(name, [1440 + index * 256, 176]);
}

workflow.connections.BuildAssistantInput = { main: [[{ node: "BuildSpecialistCalls", type: "main", index: 0 }]] };
workflow.connections.BuildSpecialistCalls = { main: [[{ node: "ExecuteSelectedSpecialists", type: "main", index: 0 }]] };
workflow.connections.ExecuteSelectedSpecialists = { main: [[{ node: "AggregateSpecialistResults", type: "main", index: 0 }]] };
workflow.connections.AggregateSpecialistResults = { main: [[{ node: "PMO Assistant", type: "main", index: 0 }]] };

const format = workflow.nodes.find((item) => item.name === "FormatIngest");
format.parameters.jsCode = `const normalized=$node['NormalizeCanonical'].json;
const merged=$node['MergeIntoControlTower'].json;
const aggregate=$node['AggregateSpecialistResults'].json;
const completedAt=new Date().toISOString();
const status=aggregate.steps.some(step=>step.status==='failed')?'failed':(aggregate.warnings.length||aggregate.steps.some(step=>step.status==='needs_review')?'needs_review':'completed');
const commitSha=$json.commit?.sha??$json.content?.sha;
const commitUrl=$json.commit?.html_url??$json.content?.html_url;
const committedFiles=[normalized.jsonPath,normalized.markdownPath,'knowledge/pmo/control-tower.json'];
const evidence=aggregate.extracted.map((item,index)=>({id:String(item.id||item.name||'evidence-'+(index+1)),label:String(item.name||item.type||'Evidence'),source:item.name?String(item.name):undefined,verified:false}));
const plan=aggregate.routingPlan||[];const budget=plan[0]?.budget;const agentRun={contractVersion:'agent-run-1.0',executionId:aggregate.executionId,correlationId:aggregate.correlationId,requestedAt:aggregate.requestedAt,completedAt,status,orchestrator:{workflowId:'pmo.orchestrate',workflowVersion:'1.3.1'},routing:{mode:String(aggregate.meta?.manual_override_reason?'manual':'smart_auto'),selectedWorkflows:aggregate.selectedWorkflows,policyVersion:'smart-routing-1.1.0',explanation:plan.map(item=>({workflowId:item.workflowId||aggregate.selectedWorkflows[item.sequence-1],reason:item.reason,sequence:item.sequence})),budget,manualOverride:plan[0]?.manualOverride},steps:aggregate.steps,evidence,proposals:aggregate.proposals,warnings:aggregate.warnings,persistence:{mode:'proposal_only'}};
return [{json:{ok:true,source:'github',storageConfigured:true,wpId:normalized.wpId,committedFiles,needs_review:normalized.needs_review,appliedChanges:merged.appliedChanges,document:merged.document,commit:{sha:commitSha,url:commitUrl},agentRun}}];`;

workflow.versionId = "pmo-orchestrator-smart-routing-v1";
writeFileSync(workflowPath, `${JSON.stringify(workflow, null, 2)}\n`);
const smokeFixture = JSON.parse(readFileSync(resolve("tests/fixtures/agent-workflows/selected-specialists.json"), "utf8"));
const smokeSelected = smokeFixture.expectedSelectedWorkflows;
const smokeCode = `const fixture=${JSON.stringify(smokeFixture)};
const bindings=${JSON.stringify(liveIds)};
const text=fixture.evidence.map(item=>item.content).join('\\n');const selected=['evidence.verify'];if(/meeting|minutes|attendee|agenda|workshop|discussion/i.test(text))selected.push('meeting.synthesise');if(/risk|threat|probability|impact|mitigation|exposure/i.test(text))selected.push('risk.analyse');if(/milestone|deliverable|deadline|schedule|plan|progress|delay/i.test(text))selected.push('delivery.plan');if(/issue|action|decision|dependency|assumption|change request|approval/i.test(text))selected.push('controls.classify');if(selected.some(id=>id!=='evidence.verify'))selected.push('governance.review');
return [...new Set(selected)].map((workflowId,index)=>({json:{contractVersion:fixture.contractVersion,executionId:fixture.executionId,correlationId:fixture.correlationId,requestedAt:fixture.requestedAt,meta:{...fixture.meta,routing_policy:'smart-routing-1.0',sequence:index+1},evidence:fixture.evidence,workflowId,liveWorkflowId:bindings[workflowId]}}));`;
const validateSmokeCode = `const results=$input.all().map(item=>item.json);
const expected=${JSON.stringify(smokeSelected)};
if(results.length!==expected.length) throw new Error('Smoke test returned '+results.length+' specialists; expected '+expected.length+'.');
for(const workflowId of expected){const result=results.find(item=>item.workflowId===workflowId);if(!result) throw new Error('Missing '+workflowId+' result.');if(result.contractVersion!=='agent-run-1.0'||result.workflowVersion!=='1.0.0'||result.promptVersion!=='1.0.0'||result.executionId!=='${smokeFixture.executionId}'||result.correlationId!=='${smokeFixture.correlationId}') throw new Error('Contract mismatch for '+workflowId+'.');}
return [{json:{ok:true,test:'ZM-PROD-05G non-destructive smart-routing contract',policyVersion:'smart-routing-1.0',canonicalWriteAllowed:false,selectedWorkflows:expected,unselectedWorkflows:${JSON.stringify(workflowIds.filter((id) => !smokeSelected.includes(id)))},steps:results.map(item=>({workflowId:item.workflowId,workflowVersion:item.workflowVersion,promptVersion:item.promptVersion,status:item.status,confidence:item.confidence,evidenceIds:item.evidenceIds,warnings:item.warnings}))}}];`;
const smokeWorkflow = {
  name: "OET PMO Agent - Non-destructive Contract Smoke Test",
  nodes: [
    { parameters: {}, type: "n8n-nodes-base.manualTrigger", typeVersion: 1, position: [-480, 0], id: "smoke-manual-trigger", name: "Run Non-destructive Smoke Test" },
    { parameters: { jsCode: smokeCode }, type: "n8n-nodes-base.code", typeVersion: 2, position: [-240, 0], id: "smoke-build-inputs", name: "Build Checked-in Fixture" },
    { parameters: { source: "database", workflowId: { __rl: true, value: "={{ $json.liveWorkflowId }}", mode: "id" }, workflowInputs, mode: "each", options: { waitForSubWorkflow: true } }, type: "n8n-nodes-base.executeWorkflow", typeVersion: 1.3, position: [0, 0], id: "smoke-execute-specialists", name: "Execute Selected Specialists" },
    { parameters: { jsCode: validateSmokeCode }, type: "n8n-nodes-base.code", typeVersion: 2, position: [240, 0], id: "smoke-validate-contract", name: "Validate Live Contract" },
  ],
  connections: {
    "Run Non-destructive Smoke Test": { main: [[{ node: "Build Checked-in Fixture", type: "main", index: 0 }]] },
    "Build Checked-in Fixture": { main: [[{ node: "Execute Selected Specialists", type: "main", index: 0 }]] },
    "Execute Selected Specialists": { main: [[{ node: "Validate Live Contract", type: "main", index: 0 }]] },
  },
  active: false,
  settings: { executionOrder: "v1" },
  versionId: "smart-routing-contract-smoke-v1",
  tags: [],
};
writeFileSync(resolve("docs/n8n/agents/smoke-test.workflow.json"), `${JSON.stringify(smokeWorkflow, null, 2)}\n`);
if (existsSync(governedPublisherPath)) {
  console.log("Reapplying governed publisher protections after specialist bindings.");
  await import(`./build-governed-publisher.mjs?build=${Date.now()}`);
}
await import(`./build-agent-resilience.mjs?build=${Date.now()}`);
console.log(`Built specialist orchestrator with ${workflowIds.length} workflow bindings.`);
