import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const manifest = JSON.parse(readFileSync(resolve("docs/n8n/agents/manifest.json"), "utf8"));
const publisherId = manifest.publisher?.liveWorkflowId || "UNBOUND:governed.publish";
const document = {
  schemaVersion: "2.0", revision: 7,
  project: { id: "PRJ-SMOKE", governance: { version: 1 } },
  workstreams: [], milestones: [], deliverables: [],
  risks: [{ id: "R-SMOKE", title: "Smoke test risk", impact: 3, governance: { version: 1, reviewIds: [], createdAt: "2026-08-11T11:00:00.000Z", createdBy: "Smoke test" } }],
  issues: [], actions: [], decisions: [], dependencies: [], assumptions: [], changeRequests: [], meetings: [],
  evidence: [], reviews: [], objectVersions: [],
  audit: [{ id: "AUD-PRIOR", timestamp: "2026-08-11T11:00:00.000Z", actor: "Smoke test", action: "publish", object: { type: "risk", id: "R-SMOKE" }, message: "Prior publication", correlationId: "publish:publisher-smoke-duplicate", changes: [], evidenceIds: [] }],
};
const buildCode = `const document=${JSON.stringify(document)};
const sourceExecutionId='agent:governed-smoke';
const proposalSet={contractVersion:'proposal-set-1.0',id:'PS-agent-governed-smoke',sourceExecutionId,correlationId:'governed-smoke',sourceRevision:document.revision,status:'pending_review',createdAt:'2026-08-11T11:00:00.000Z',evidence:[{id:'EVD-SMOKE-1',label:'Non-destructive smoke evidence',source:'checked-in fixture',verified:true}],proposals:[{id:'PROP-SMOKE-1',sourceExecutionId,workflowId:'risk.analyse',entity:'risk',action:'update',objectId:'R-SMOKE',expectedObjectVersion:1,summary:'Non-destructive governed smoke proposal',risk:'high',evidenceIds:['EVD-SMOKE-1'],fieldChanges:[{field:'impact',before:3,after:5}],proposedObject:{...document.risks[0],impact:5}}]};
const review=decision=>({contractVersion:'review-decision-1.0',id:'REV-SMOKE-'+decision,proposalSetId:proposalSet.id,sourceExecutionId,reviewer:'Automated non-destructive smoke test',decidedAt:'2026-08-11T11:05:00.000Z',decisions:[{proposalId:'PROP-SMOKE-1',sourceExecutionId,decision,reviewer:'Automated non-destructive smoke test',rationale:'Non-destructive governed acceptance test with accountable rationale.',decidedAt:'2026-08-11T11:05:00.000Z',expectedObjectVersion:1}],audit:[]});
return [{json:{case:'rejected',authorized:true,proposalSet,reviewBundle:review('reject'),canonicalDocument:structuredClone(document),expectedRevision:7,idempotencyKey:'publisher-smoke-rejected',actor:'Smoke test'}},{json:{case:'duplicate',authorized:true,proposalSet,reviewBundle:review('accept'),canonicalDocument:structuredClone(document),expectedRevision:7,idempotencyKey:'publisher-smoke-duplicate',actor:'Smoke test'}}];`;
const validateCode = `const results=$input.all().map(item=>item.json);const rejected=results.find(item=>!item.duplicate&&item.rejectedProposalIds?.includes('PROP-SMOKE-1'));const duplicate=results.find(item=>item.duplicate===true);if(!rejected||rejected.shouldWrite||rejected.revision!==7)throw new Error('Rejected publication changed canonical state.');if(!duplicate||duplicate.shouldWrite||duplicate.revision!==7)throw new Error('Duplicate publication was not idempotent.');return [{json:{ok:true,test:'ZM-PROD-05C non-destructive governed publisher',publisherWorkflowId:'${publisherId}',rejected:{shouldWrite:rejected.shouldWrite,revision:rejected.revision},duplicate:{shouldWrite:duplicate.shouldWrite,revision:duplicate.revision}}}];`;
const n8nSafeBuildCode = "const structuredClone=value=>JSON.parse(JSON.stringify(value));" + buildCode;
const schema = [["authorized","boolean"],["proposalSet","object"],["reviewBundle","object"],["canonicalDocument","object"],["expectedRevision","number"],["idempotencyKey","string"],["actor","string"]].map(([id,type])=>({id,displayName:id,required:true,defaultMatch:false,display:true,canBeUsedToMatch:true,type}));
const workflowInputs = { mappingMode: "defineBelow", value: { authorized: "={{ $json.authorized }}", proposalSet: "={{ $json.proposalSet }}", reviewBundle: "={{ $json.reviewBundle }}", canonicalDocument: "={{ $json.canonicalDocument }}", expectedRevision: "={{ $json.expectedRevision }}", idempotencyKey: "={{ $json.idempotencyKey }}", actor: "={{ $json.actor }}" }, matchingColumns: [], schema, attemptToConvertTypes: false, convertFieldsToString: false };
const workflow = {
  name: "OET PMO Agent - Governed Publisher Non-destructive Smoke Test",
  nodes: [
    { parameters: {}, type: "n8n-nodes-base.manualTrigger", typeVersion: 1, position: [-360, 0], id: "governed-smoke-trigger", name: "Run Governed Publisher Smoke Test" },
    { parameters: { jsCode: n8nSafeBuildCode }, type: "n8n-nodes-base.code", typeVersion: 2, position: [-120, 0], id: "governed-smoke-build", name: "Build Non-destructive Cases" },
    { parameters: { source: "database", workflowId: { __rl: true, value: publisherId, mode: "id" }, workflowInputs, mode: "each", options: { waitForSubWorkflow: true } }, type: "n8n-nodes-base.executeWorkflow", typeVersion: 1.3, position: [120, 0], id: "governed-smoke-execute", name: "Execute Governed Publisher" },
    { parameters: { jsCode: validateCode }, type: "n8n-nodes-base.code", typeVersion: 2, position: [360, 0], id: "governed-smoke-validate", name: "Validate No Canonical Write" },
  ],
  connections: {
    "Run Governed Publisher Smoke Test": { main: [[{ node: "Build Non-destructive Cases", type: "main", index: 0 }]] },
    "Build Non-destructive Cases": { main: [[{ node: "Execute Governed Publisher", type: "main", index: 0 }]] },
    "Execute Governed Publisher": { main: [[{ node: "Validate No Canonical Write", type: "main", index: 0 }]] },
  },
  active: false, settings: { executionOrder: "v1" }, versionId: "governed-publisher-smoke-v1", tags: [],
};
writeFileSync(resolve("docs/n8n/agents/governed-publisher-smoke.workflow.json"), `${JSON.stringify(workflow, null, 2)}\n`);
console.log(`Built non-destructive governed publisher smoke test (${publisherId}).`);
