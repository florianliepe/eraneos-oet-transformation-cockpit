import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const orchestratorPath = resolve("docs/n8n-pmo-orchestrator.workflow.json");
const publisherPath = resolve("docs/n8n/agents/governed-publisher.workflow.json");
const workflow = JSON.parse(readFileSync(orchestratorPath, "utf8"));
const publisher = JSON.parse(readFileSync(publisherPath, "utf8"));
const githubCredential = { id: "3V46mglu7fpoPISX", name: "GitHub data" };
const byName = (graph, name) => graph.nodes.find((node) => node.name === name);
const upsert = (graph, node) => {
  const index = graph.nodes.findIndex((item) => item.name === node.name);
  if (index >= 0) graph.nodes[index] = node;
  else graph.nodes.push(node);
};
const githubNode = (name, operation, filePath, position, extra = {}) => ({
  parameters: {
    authentication: "accessToken", resource: "file", operation,
    owner: { __rl: true, value: "florianliepe", mode: "name" },
    repository: { __rl: true, value: "eraneos-oet-transformation-cockpit-data", mode: "name" },
    filePath, ...(operation === "get" ? { asBinaryProperty: false } : { binaryData: false }),
    additionalParameters: operation === "get" ? { reference: "main" } : { branch: { branch: "main" } },
    ...extra,
  },
  type: "n8n-nodes-base.github", typeVersion: 1.1, position,
  id: name.toLowerCase().replace(/[^a-z0-9]+/g, "-"), name,
  credentials: { githubApi: githubCredential },
});
const ifNode = (name, leftValue, position) => ({
  parameters: { conditions: { options: { caseSensitive: true, leftValue: "", typeValidation: "strict", version: 2 }, conditions: [{ id: `${name}-condition`, leftValue, rightValue: true, operator: { type: "boolean", operation: "true", singleValue: true } }], combinator: "and" }, options: {} },
  type: "n8n-nodes-base.if", typeVersion: 2.2, position, id: name.toLowerCase(), name,
});

byName(workflow, "PrepareRequest").parameters.jsCode = `const body=$json.body??{};const mode=String(body.mode??'').trim();const allowed=['pmo.read','pmo.save','pmo.ingest','pmo.run.status','pmo.review','pmo.publish'];const workspace=body.workspace??{};const organisationId=String(workspace.organisationId||'');const projectId=String(workspace.projectId||'');if(!/^org_[A-Za-z0-9_-]{6,80}$/.test(organisationId)||!/^prj_[A-Za-z0-9_-]{6,80}$/.test(projectId))throw new Error('A valid organisation and project scope is required.');const scopeRoot='knowledge/pmo/workspaces/'+organisationId+'/'+projectId;return [{json:{mode,validMode:allowed.includes(mode),body,workspace:{organisationId,projectId},scopeRoot,canonicalPath:scopeRoot+'/control-tower.json',proposalRoot:scopeRoot+'/proposals',runRoot:scopeRoot+'/runs',workPackageRoot:scopeRoot+'/work-packages',receivedAt:new Date().toISOString()}}];`;

for (const name of ["GitHubReadControlTower", "GitHubReadControlTowerForIngest", "GitHubReadCanonicalForPublish"]) {
  const node = byName(workflow, name);
  node.parameters.filePath = "={{ $node['PrepareRequest'].json.canonicalPath }}";
  node.onError = "continueRegularOutput";
}
byName(workflow, "FormatRead").parameters.jsCode = `if(!$json.content)return [{json:{ok:true,source:'bootstrap',storageConfigured:false}}];const document=JSON.parse(Buffer.from($json.content,'base64').toString('utf8'));const request=$node['PrepareRequest'].json;if(document.project?.id!==request.workspace.projectId)throw new Error('Stored canonical project does not match the requested workspace.');return [{json:{ok:true,source:'github',storageConfigured:true,document}}];`;

// Save is an upsert. A missing project file is initialized at its supplied revision;
// an existing project file receives the normal governed revision increment.
upsert(workflow, githubNode("GitHubReadControlTowerForSave", "get", "={{ $node['PrepareRequest'].json.canonicalPath }}", [768, -128]));
byName(workflow, "GitHubReadControlTowerForSave").onError = "continueRegularOutput";
byName(workflow, "PrepareSave").parameters.jsCode = `const request=$node['PrepareRequest'].json;const document=JSON.parse(JSON.stringify(request.body?.document??null));const required=['workstreams','milestones','deliverables','risks','issues','actions','decisions','dependencies','assumptions','changeRequests','meetings','evidence','reviews','audit','objectVersions'];if(!document||document.schemaVersion!=='2.0'||!document.project||required.some(key=>!Array.isArray(document[key])))throw new Error('Invalid PMO document. Expected schemaVersion 2.0 and every governed collection.');if(document.project.id!==request.workspace.projectId)throw new Error('Document project does not match the requested workspace.');let existing=null;if($json.content){try{existing=JSON.parse(Buffer.from($json.content,'base64').toString('utf8'));}catch{throw new Error('Stored canonical PMO document is invalid JSON.');}}if(existing?.project?.id&&existing.project.id!==request.workspace.projectId)throw new Error('Stored canonical project does not match the requested workspace.');const exists=Boolean(existing);const now=new Date().toISOString();document.revision=exists?Math.max(Number(existing.revision||1),Number(document.revision||1))+1:Math.max(1,Number(document.revision||1));document.project.updatedAt=now;document.project.governance={...document.project.governance,version:exists?Math.max(Number(existing.project?.governance?.version||1),Number(document.project.governance?.version||1))+1:Math.max(1,Number(document.project.governance?.version||1)),updatedAt:now,updatedBy:'n8n PMO Orchestrator'};return [{json:{document,exists,canonicalPath:request.canonicalPath,fileContent:JSON.stringify(document,null,2)+'\\n',commitMessage:(exists?'pmo: publish control tower revision ':'pmo: initialize project control tower revision ')+document.revision}}];`;
byName(workflow, "GitHubSaveControlTower").parameters.filePath = "={{ $json.canonicalPath }}";
upsert(workflow, githubNode("GitHubCreateControlTower", "create", "={{ $json.canonicalPath }}", [1280, 0], { fileContent: "={{ $json.fileContent }}", commitMessage: "={{ $json.commitMessage }}" }));
upsert(workflow, ifNode("IfCanonicalExistsForSave", "={{ $json.exists }}", [1024, 0]));
workflow.connections.IfSave.main[0] = [{ node: "GitHubReadControlTowerForSave", type: "main", index: 0 }];
workflow.connections.GitHubReadControlTowerForSave = { main: [[{ node: "PrepareSave", type: "main", index: 0 }]] };
workflow.connections.PrepareSave = { main: [[{ node: "IfCanonicalExistsForSave", type: "main", index: 0 }]] };
workflow.connections.IfCanonicalExistsForSave = { main: [[{ node: "GitHubSaveControlTower", type: "main", index: 0 }], [{ node: "GitHubCreateControlTower", type: "main", index: 0 }]] };
workflow.connections.GitHubCreateControlTower = { main: [[{ node: "FormatSave", type: "main", index: 0 }]] };

const assistant = byName(workflow, "BuildAssistantInput");
assistant.parameters.jsCode = assistant.parameters.jsCode
  .replace("const runId='agent:'+idempotencyKey;const runPath='knowledge/pmo/runs/'+idempotencyKey+'.json';", "const request=$node['PrepareRequest'].json;const runId='agent:'+idempotencyKey;const runPath=request.runRoot+'/'+idempotencyKey+'.json';")
  .replace("workspace: body.workspace", "workspace: request.workspace, scopeRoot: request.scopeRoot, canonicalPath: request.canonicalPath, workPackageRoot: request.workPackageRoot");
const normalize = byName(workflow, "NormalizeCanonical");
normalize.parameters.jsCode = normalize.parameters.jsCode.replace("const base = 'knowledge/work-packages/' + wpId + '/' + date + '-' + stamp;", "const base = $node['BuildAssistantInput'].json.workPackageRoot + '/' + wpId + '/' + date + '-' + stamp;");

const proposal = byName(workflow, "BuildProposalSet");
proposal.parameters.jsCode = proposal.parameters.jsCode
  .replace("const proposalSet={contractVersion:'proposal-set-1.0'", "const scope=source.workspace;const proposalSet={contractVersion:'proposal-set-1.0',scope")
  .replace("proposalPath:'knowledge/pmo/proposals/'+id+'.json'", "proposalPath:source.scopeRoot+'/proposals/'+id+'.json'");

const prepareReview = byName(workflow, "PrepareReviewRequest");
prepareReview.parameters.jsCode = `const body=$json.body??{};const request=$node['PrepareRequest'].json;const setId=String(body.proposalSetId||'');const review=body.reviewBundle;if(!/^PS-[A-Za-z0-9._-]{4,100}$/.test(setId)||!review||review.contractVersion!=='review-decision-1.0')throw new Error('Invalid governed review request.');const safeReview=String(review.id||'').replace(/[^A-Za-z0-9._-]/g,'-').slice(0,110);if(!safeReview)throw new Error('Review bundle ID is required.');return [{json:{body,workspace:request.workspace,proposalSetId:setId,proposalPath:request.proposalRoot+'/'+setId+'.json',reviewPath:request.proposalRoot+'/'+setId+'.'+safeReview+'.review.json'}}];`;
byName(workflow, "ValidateReviewDecision").parameters.jsCode = `if(!$json.content)throw new Error('Stored proposal set is missing.');const proposalSet=JSON.parse(Buffer.from($json.content,'base64').toString('utf8'));const request=$node['PrepareReviewRequest'].json;const review=request.body.reviewBundle;if(!proposalSet.scope||proposalSet.scope.organisationId!==request.workspace.organisationId||proposalSet.scope.projectId!==request.workspace.projectId)throw new Error('Proposal workspace scope does not match the review request.');if(proposalSet.id!==request.proposalSetId||review.proposalSetId!==proposalSet.id||review.sourceExecutionId!==proposalSet.sourceExecutionId||!review.reviewer||!Array.isArray(review.decisions)||review.decisions.length!==proposalSet.proposals.length)throw new Error('Review lineage or decision coverage is invalid.');const byId=new Map(review.decisions.map(item=>[item.proposalId,item]));for(const proposal of proposalSet.proposals){const decision=byId.get(proposal.id);if(!decision||decision.sourceExecutionId!==proposalSet.sourceExecutionId||decision.expectedObjectVersion!==proposal.expectedObjectVersion||!['accept','reject'].includes(decision.decision))throw new Error('Invalid decision for '+proposal.id+'.');if(proposal.risk==='high'&&String(decision.rationale||'').trim().length<20)throw new Error('High-impact decision '+proposal.id+' requires accountable rationale.');}const storedReview={...review,scope:proposalSet.scope};return [{json:{reviewBundle:storedReview,reviewPath:request.reviewPath,fileContent:JSON.stringify(storedReview,null,2)+'\\n',commitMessage:'pmo: record review '+review.id}}];`;

const preparePublish = byName(workflow, "PreparePublishRequest");
preparePublish.parameters.jsCode = `const body=$json.body??{};const request=$node['PrepareRequest'].json;const setId=String(body.proposalSetId||'');const reviewId=String(body.reviewBundleId||'');const actor=String(body.actor||'').trim();const key=String(body.idempotencyKey||'');if(!/^PS-[A-Za-z0-9._-]{4,100}$/.test(setId)||!/^[A-Za-z0-9._-]{8,140}$/.test(reviewId)||!actor||!/^[A-Za-z0-9-]{8,80}$/.test(key)||!Number.isInteger(Number(body.expectedRevision)))throw new Error('Invalid governed publication request.');return [{json:{body,workspace:request.workspace,canonicalPath:request.canonicalPath,proposalPath:request.proposalRoot+'/'+setId+'.json',reviewPath:request.proposalRoot+'/'+setId+'.'+reviewId.replace(/[^A-Za-z0-9._-]/g,'-').slice(0,110)+'.review.json'}}];`;
byName(workflow, "BuildPublisherInput").parameters.jsCode = `const decode=node=>{const value=$node[node].json;if(!value.content)throw new Error(node+' content is missing.');return JSON.parse(Buffer.from(value.content,'base64').toString('utf8'));};const prepared=$node['PreparePublishRequest'].json;const request=prepared.body;const proposalSet=decode('GitHubReadProposalForPublish');const reviewBundle=decode('GitHubReadReviewForPublish');const canonicalDocument=decode('GitHubReadCanonicalForPublish');for(const artifact of [proposalSet,reviewBundle])if(!artifact.scope||artifact.scope.organisationId!==prepared.workspace.organisationId||artifact.scope.projectId!==prepared.workspace.projectId)throw new Error('Stored publication artifact does not match the requested workspace.');if(canonicalDocument.project?.id!==prepared.workspace.projectId)throw new Error('Canonical project does not match the requested workspace.');return [{json:{authorized:true,scope:prepared.workspace,canonicalPath:prepared.canonicalPath,proposalSet,reviewBundle,canonicalDocument,expectedRevision:Number(request.expectedRevision),idempotencyKey:String(request.idempotencyKey),actor:String(request.actor)}}];`;
const executePublisher = byName(workflow, "ExecuteGovernedPublisher");
for (const [id, type] of [["scope", "object"], ["canonicalPath", "string"]]) {
  executePublisher.parameters.workflowInputs.value[id] = `={{ $json.${id} }}`;
  if (!executePublisher.parameters.workflowInputs.schema.some((field) => field.id === id)) executePublisher.parameters.workflowInputs.schema.push({ id, displayName: id, required: true, defaultMatch: false, display: true, canBeUsedToMatch: true, type });
}

byName(workflow, "PrepareRunStatusRequest").parameters.jsCode = `const body=$json.body||{};const request=$node['PrepareRequest'].json;const key=String(body.idempotencyKey||'');const runId=String(body.runId||'');if(!/^[A-Za-z0-9-]{8,80}$/.test(key)||runId!=='agent:'+key)throw new Error('Invalid run status request.');return [{json:{runId,idempotencyKey:key,runPath:request.runRoot+'/'+key+'.json',workspace:request.workspace}}];`;
byName(workflow, "FormatRunStatus").parameters.jsCode = `let receipt=null;if($json.content){try{receipt=JSON.parse(Buffer.from($json.content,'base64').toString('utf8'));}catch{receipt=null;}}if(!receipt)return [{json:{ok:false,error:'Run receipt was not found.'}}];const request=$node['PrepareRunStatusRequest'].json;if(receipt.organisationId!==request.workspace.organisationId||receipt.projectId!==request.workspace.projectId)throw new Error('Run receipt does not match the requested workspace.');return [{json:{ok:true,run:receipt}}];`;

// Publisher receives a validated scoped path; it has no global fallback.
const trigger = byName(publisher, "Called by PMO Orchestrator");
for (const [name, type] of [["scope", "object"], ["canonicalPath", "string"]]) if (!trigger.parameters.workflowInputs.values.some((field) => field.name === name)) trigger.parameters.workflowInputs.values.push({ name, type });
const validator = byName(publisher, "ValidateGovernedPublication");
validator.parameters.jsCode = validator.parameters.jsCode.replace("const set=input.proposalSet;", "const scope=input.scope??{};const canonicalPath=String(input.canonicalPath||'');if(!/^org_[A-Za-z0-9_-]{6,80}$/.test(String(scope.organisationId||''))||!/^prj_[A-Za-z0-9_-]{6,80}$/.test(String(scope.projectId||''))||canonicalPath!=='knowledge/pmo/workspaces/'+scope.organisationId+'/'+scope.projectId+'/control-tower.json')throw new Error('Publisher workspace scope is invalid.');const set=input.proposalSet;")
  .replace("const required=['workstreams'", "if(!set.scope||set.scope.organisationId!==scope.organisationId||set.scope.projectId!==scope.projectId||!review.scope||review.scope.organisationId!==scope.organisationId||review.scope.projectId!==scope.projectId||document.project?.id!==scope.projectId)throw new Error('Publisher artifacts do not share the authorized workspace scope.');const required=['workstreams'");
byName(publisher, "GitHubPublishCanonicalPMO").parameters.filePath = "={{ $json.canonicalPath || $node['Called by PMO Orchestrator'].json.canonicalPath }}";

workflow.versionId = "pmo-orchestrator-workspace-isolation-v1-3-4";
publisher.versionId = "governed-publisher-workspace-isolation-v1-0-2";
writeFileSync(orchestratorPath, `${JSON.stringify(workflow, null, 2)}\n`);
writeFileSync(publisherPath, `${JSON.stringify(publisher, null, 2)}\n`);
console.log("Applied organisation/project workspace isolation to orchestrator and publisher.");
