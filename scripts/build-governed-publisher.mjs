import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const orchestratorPath = resolve("docs/n8n-pmo-orchestrator.workflow.json");
const publisherPath = resolve("docs/n8n/agents/governed-publisher.workflow.json");
const manifestPath = resolve("docs/n8n/agents/manifest.json");
const workflow = JSON.parse(readFileSync(orchestratorPath, "utf8"));
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const publisherLiveId = manifest.publisher?.liveWorkflowId || "UNBOUND:governed.publish";
const githubCredential = { id: "3V46mglu7fpoPISX", name: "GitHub data" };

const upsert = (node) => {
  const index = workflow.nodes.findIndex((item) => item.name === node.name);
  if (index >= 0) workflow.nodes[index] = node;
  else workflow.nodes.push(node);
};
const githubNode = (name, operation, filePath, position, extra = {}) => ({
  parameters: {
    authentication: "accessToken", resource: "file", operation,
    owner: { __rl: true, value: "florianliepe", mode: "name" },
    repository: { __rl: true, value: "eraneos-oet-transformation-cockpit-data", mode: "name" },
    filePath, binaryData: false,
    additionalParameters: operation === "get" ? { reference: "main" } : { branch: { branch: "main" } },
    ...extra,
  },
  type: "n8n-nodes-base.github", typeVersion: 1.1, position, id: name.toLowerCase().replace(/[^a-z0-9]+/g, "-"), name,
  credentials: { githubApi: githubCredential },
});

const buildProposalSetCode = `const candidate=$json.document;
const originalNode=$node['GitHubReadControlTowerForIngest'].json;
if(!originalNode.content) throw new Error('Canonical PMO source is missing.');
const original=JSON.parse(Buffer.from(originalNode.content,'base64').toString('utf8'));
const aggregate=$node['AggregateSpecialistResults'].json;
const normalized=$node['NormalizeCanonical'].json;
const source=$node['BuildAssistantInput'].json;
const collections={workstream:'workstreams',milestone:'milestones',deliverable:'deliverables',risk:'risks',issue:'issues',action:'actions',decision:'decisions',dependency:'dependencies',assumption:'assumptions',change_request:'changeRequests',meeting:'meetings'};
const workflows={project:'delivery.plan',workstream:'delivery.plan',milestone:'delivery.plan',deliverable:'delivery.plan',risk:'risk.analyse',issue:'controls.classify',action:'controls.classify',decision:'meeting.synthesise',dependency:'controls.classify',assumption:'controls.classify',change_request:'controls.classify',meeting:'meeting.synthesise'};
const eq=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const fields=(before,after)=>[...new Set([...Object.keys(before||{}),...Object.keys(after||{})])].filter(field=>field!=='governance'&&!eq(before?.[field],after?.[field])).map(field=>({field,before:before?.[field],after:after?.[field]}));
const record=(doc,type,id)=>type==='project'?doc.project:(doc[collections[type]]||[]).find(item=>item.id===id);
const risk=(type,action,after)=>action==='delete'||['project','decision','change_request'].includes(type)||after?.priority==='P1'||after?.criticality==='critical'||after?.status==='approved'?'high':action==='update'?'medium':'low';
const changes=[...($json.appliedChanges||[])];
if(fields(original.project,candidate.project).length) changes.unshift({entity:'project',action:'update',id:original.project.id,summary:'Update project profile'});
const evidenceIds=[...new Set((source.extracted||[]).map((item,index)=>'EVD-'+normalized.wpId+'-'+(index+1)))];
const evidence=(source.extracted||[]).map((item,index)=>({id:evidenceIds[index],label:String(item.name||'Evidence '+(index+1)),source:'workbench:'+normalized.wpId,verified:false}));
const proposals=changes.map((change,index)=>{const before=record(original,change.entity,change.id);const after=record(candidate,change.entity,change.id);const action=change.action==='delete'?'delete':before?'update':'create';const diff=fields(before,after);return {id:'PROP-'+String(index+1).padStart(3,'0'),sourceExecutionId:aggregate.executionId,workflowId:workflows[change.entity]||'governance.review',entity:change.entity,action,objectId:String(change.id),expectedObjectVersion:Number(before?.governance?.version||0),summary:String(change.summary||action+' '+change.entity+' '+change.id),risk:risk(change.entity,action,after),evidenceIds:[...new Set(after?.governance?.evidenceIds?.length?after.governance.evidenceIds:evidenceIds)],fieldChanges:diff.length?diff:[{field:'record',before,after}],proposedObject:after};});
const safeExecution=String(aggregate.executionId).replace(/[^A-Za-z0-9._-]/g,'-').slice(0,90);
const id='PS-'+safeExecution;
const createdAt=new Date().toISOString();
const proposalSet={contractVersion:'proposal-set-1.0',id,sourceExecutionId:aggregate.executionId,correlationId:aggregate.correlationId,sourceRevision:Number(original.revision),status:'pending_review',createdAt,proposals,evidence,audit:[{id:'PAUD-GENERATE-'+safeExecution,event:'proposal.generated',actor:'PMO Orchestrator',at:createdAt,sourceExecutionId:aggregate.executionId,rationale:proposals.length+' proposal(s) generated; canonical state unchanged.'}]};
return [{json:{proposalSet,document:original,proposalPath:'knowledge/pmo/proposals/'+id+'.json',fileContent:JSON.stringify(proposalSet,null,2)+'\\n',commitMessage:'pmo: store proposal set '+id}}];`;

const formatIngestCode = `const stored=$node['BuildProposalSet'].json;const aggregate=$node['AggregateSpecialistResults'].json;const completedAt=new Date().toISOString();const proposals=stored.proposalSet.proposals.map(item=>({id:item.id,workflowId:item.workflowId,entity:item.entity,action:item.action,objectId:item.objectId,summary:item.summary,confidence:item.risk==='high'?'high':item.risk==='medium'?'medium':'low',evidenceIds:item.evidenceIds}));const warnings=aggregate.warnings;const agentRun={contractVersion:'agent-run-1.0',executionId:aggregate.executionId,correlationId:aggregate.correlationId,requestedAt:aggregate.requestedAt,completedAt,status:'needs_review',orchestrator:{workflowId:'pmo.orchestrate',workflowVersion:'1.2.0'},routing:{mode:String(aggregate.meta?.routing||'selected'),selectedWorkflows:aggregate.selectedWorkflows},steps:aggregate.steps,evidence:stored.proposalSet.evidence,proposals,warnings,persistence:{mode:'proposal_only',commitSha:$json.commit?.sha??$json.content?.sha}};return [{json:{ok:true,source:'github',storageConfigured:true,wpId:$node['NormalizeCanonical'].json.wpId,document:stored.document,proposalSet:stored.proposalSet,committedFiles:[stored.proposalPath],needs_review:proposals.map(item=>item.summary),appliedChanges:[],commit:{sha:$json.commit?.sha??$json.content?.sha,url:$json.commit?.html_url??$json.content?.html_url},agentRun}}];`;

upsert({ parameters: { jsCode: buildProposalSetCode }, type: "n8n-nodes-base.code", typeVersion: 2, position: [2048, 176], id: "build-proposal-set", name: "BuildProposalSet" });
upsert(githubNode("GitHubStoreProposalSet", "create", "={{ $json.proposalPath }}", [2304, 176], { fileContent: "={{ $json.fileContent }}", commitMessage: "={{ $json.commitMessage }}" }));
const formatIngest = workflow.nodes.find((node) => node.name === "FormatIngest");
formatIngest.parameters.jsCode = formatIngestCode;
formatIngest.position = [2560, 176];
const respondIngest = workflow.nodes.find((node) => node.name === "RespondIngest");
respondIngest.position = [2816, 176];
workflow.nodes = workflow.nodes.filter((node) => node.name !== "GitHubSaveControlTowerForIngest");
workflow.connections.MergeIntoControlTower = { main: [[{ node: "BuildProposalSet", type: "main", index: 0 }]] };
workflow.connections.BuildProposalSet = { main: [[{ node: "GitHubStoreProposalSet", type: "main", index: 0 }]] };
workflow.connections.GitHubStoreProposalSet = { main: [[{ node: "FormatIngest", type: "main", index: 0 }]] };

const ifNode = (name, mode, position) => ({ parameters: { conditions: { options: { caseSensitive: true, leftValue: "", typeValidation: "strict", version: 2 }, conditions: [{ id: `${name}-condition`, leftValue: "={{ $json.mode }}", rightValue: mode, operator: { type: "string", operation: "equals" } }], combinator: "and" }, options: {} }, type: "n8n-nodes-base.if", typeVersion: 2.2, position, id: name.toLowerCase(), name });
upsert(ifNode("IfReview", "pmo.review", [256, 384]));
upsert(ifNode("IfPublish", "pmo.publish", [512, 512]));
workflow.connections.IfIngest.main[1] = [{ node: "IfReview", type: "main", index: 0 }];
workflow.connections.IfReview = { main: [[{ node: "PrepareReviewRequest", type: "main", index: 0 }], [{ node: "IfPublish", type: "main", index: 0 }]] };
workflow.connections.IfPublish = { main: [[{ node: "PreparePublishRequest", type: "main", index: 0 }], [{ node: "RespondInvalidMode", type: "main", index: 0 }]] };

const prepareReviewCode = `const body=$json.body??{};const setId=String(body.proposalSetId||'');const review=body.reviewBundle;if(!/^PS-[A-Za-z0-9._-]{4,100}$/.test(setId)||!review||review.contractVersion!=='review-decision-1.0')throw new Error('Invalid governed review request.');const safeReview=String(review.id||'').replace(/[^A-Za-z0-9._-]/g,'-').slice(0,110);if(!safeReview)throw new Error('Review bundle ID is required.');return [{json:{body,proposalSetId:setId,proposalPath:'knowledge/pmo/proposals/'+setId+'.json',reviewPath:'knowledge/pmo/proposals/'+setId+'.'+safeReview+'.review.json'}}];`;
const validateReviewCode = `if(!$json.content)throw new Error('Stored proposal set is missing.');const proposalSet=JSON.parse(Buffer.from($json.content,'base64').toString('utf8'));const request=$node['PrepareReviewRequest'].json;const review=request.body.reviewBundle;if(proposalSet.id!==request.proposalSetId||review.proposalSetId!==proposalSet.id||review.sourceExecutionId!==proposalSet.sourceExecutionId||!review.reviewer||!Array.isArray(review.decisions)||review.decisions.length!==proposalSet.proposals.length)throw new Error('Review lineage or decision coverage is invalid.');const byId=new Map(review.decisions.map(item=>[item.proposalId,item]));for(const proposal of proposalSet.proposals){const decision=byId.get(proposal.id);if(!decision||decision.sourceExecutionId!==proposalSet.sourceExecutionId||decision.expectedObjectVersion!==proposal.expectedObjectVersion||!['accept','reject'].includes(decision.decision))throw new Error('Invalid decision for '+proposal.id+'.');if(proposal.risk==='high'&&String(decision.rationale||'').trim().length<20)throw new Error('High-impact decision '+proposal.id+' requires accountable rationale.');}return [{json:{reviewBundle:review,reviewPath:request.reviewPath,fileContent:JSON.stringify(review,null,2)+'\\n',commitMessage:'pmo: record review '+review.id}}];`;
const formatReviewCode = `return [{json:{ok:true,reviewBundle:$node['ValidateReviewDecision'].json.reviewBundle,commit:{sha:$json.commit?.sha??$json.content?.sha,url:$json.commit?.html_url??$json.content?.html_url}}}];`;
upsert({ parameters: { jsCode: prepareReviewCode }, type: "n8n-nodes-base.code", typeVersion: 2, position: [512, 336], id: "prepare-review-request", name: "PrepareReviewRequest" });
upsert(githubNode("GitHubReadProposalForReview", "get", "={{ $json.proposalPath }}", [768, 336]));
upsert({ parameters: { jsCode: validateReviewCode }, type: "n8n-nodes-base.code", typeVersion: 2, position: [1024, 336], id: "validate-review-decision", name: "ValidateReviewDecision" });
upsert(githubNode("GitHubStoreReviewBundle", "create", "={{ $json.reviewPath }}", [1280, 336], { fileContent: "={{ $json.fileContent }}", commitMessage: "={{ $json.commitMessage }}" }));
upsert({ parameters: { jsCode: formatReviewCode }, type: "n8n-nodes-base.code", typeVersion: 2, position: [1536, 336], id: "format-review", name: "FormatReview" });
upsert({ parameters: { respondWith: "json", responseBody: "={{ $json }}", options: {} }, type: "n8n-nodes-base.respondToWebhook", typeVersion: 1.4, position: [1792, 336], id: "respond-review", name: "RespondReview" });
workflow.connections.PrepareReviewRequest = { main: [[{ node: "GitHubReadProposalForReview", type: "main", index: 0 }]] };
workflow.connections.GitHubReadProposalForReview = { main: [[{ node: "ValidateReviewDecision", type: "main", index: 0 }]] };
workflow.connections.ValidateReviewDecision = { main: [[{ node: "GitHubStoreReviewBundle", type: "main", index: 0 }]] };
workflow.connections.GitHubStoreReviewBundle = { main: [[{ node: "FormatReview", type: "main", index: 0 }]] };
workflow.connections.FormatReview = { main: [[{ node: "RespondReview", type: "main", index: 0 }]] };

const preparePublishCode = `const body=$json.body??{};const setId=String(body.proposalSetId||'');const reviewId=String(body.reviewBundleId||'');const actor=String(body.actor||'').trim();const key=String(body.idempotencyKey||'');if(!/^PS-[A-Za-z0-9._-]{4,100}$/.test(setId)||!/^[A-Za-z0-9._-]{8,140}$/.test(reviewId)||!actor||!/^[A-Za-z0-9-]{8,80}$/.test(key)||!Number.isInteger(Number(body.expectedRevision)))throw new Error('Invalid governed publication request.');return [{json:{body,proposalPath:'knowledge/pmo/proposals/'+setId+'.json',reviewPath:'knowledge/pmo/proposals/'+setId+'.'+reviewId.replace(/[^A-Za-z0-9._-]/g,'-').slice(0,110)+'.review.json'}}];`;
const publisherInputCode = `const decode=node=>{const value=$node[node].json;if(!value.content)throw new Error(node+' content is missing.');return JSON.parse(Buffer.from(value.content,'base64').toString('utf8'));};const request=$node['PreparePublishRequest'].json.body;return [{json:{authorized:true,proposalSet:decode('GitHubReadProposalForPublish'),reviewBundle:decode('GitHubReadReviewForPublish'),canonicalDocument:decode('GitHubReadCanonicalForPublish'),expectedRevision:Number(request.expectedRevision),idempotencyKey:String(request.idempotencyKey),actor:String(request.actor)}}];`;
const publisherInputs = { mappingMode: "defineBelow", value: { authorized: "={{ $json.authorized }}", proposalSet: "={{ $json.proposalSet }}", reviewBundle: "={{ $json.reviewBundle }}", canonicalDocument: "={{ $json.canonicalDocument }}", expectedRevision: "={{ $json.expectedRevision }}", idempotencyKey: "={{ $json.idempotencyKey }}", actor: "={{ $json.actor }}" }, matchingColumns: [], schema: [["authorized","boolean"],["proposalSet","object"],["reviewBundle","object"],["canonicalDocument","object"],["expectedRevision","number"],["idempotencyKey","string"],["actor","string"]].map(([id,type])=>({id,displayName:id,required:true,defaultMatch:false,display:true,canBeUsedToMatch:true,type})), attemptToConvertTypes: false, convertFieldsToString: false };
upsert({ parameters: { jsCode: preparePublishCode }, type: "n8n-nodes-base.code", typeVersion: 2, position: [768, 512], id: "prepare-publish-request", name: "PreparePublishRequest" });
upsert(githubNode("GitHubReadProposalForPublish", "get", "={{ $json.proposalPath }}", [1024, 512]));
upsert(githubNode("GitHubReadReviewForPublish", "get", "={{ $node['PreparePublishRequest'].json.reviewPath }}", [1280, 512]));
upsert(githubNode("GitHubReadCanonicalForPublish", "get", "knowledge/pmo/control-tower.json", [1536, 512]));
upsert({ parameters: { jsCode: publisherInputCode }, type: "n8n-nodes-base.code", typeVersion: 2, position: [1792, 512], id: "build-publisher-input", name: "BuildPublisherInput" });
upsert({ parameters: { source: "database", workflowId: { __rl: true, value: publisherLiveId, mode: "id" }, workflowInputs: publisherInputs, mode: "once", options: { waitForSubWorkflow: true } }, type: "n8n-nodes-base.executeWorkflow", typeVersion: 1.3, position: [2048, 512], id: "execute-governed-publisher", name: "ExecuteGovernedPublisher", retryOnFail: true, maxTries: 3, waitBetweenTries: 1500 });
upsert({ parameters: { jsCode: "return [{json:{...$json,ok:true}}];" }, type: "n8n-nodes-base.code", typeVersion: 2, position: [2304, 512], id: "format-publication", name: "FormatPublication" });
upsert({ parameters: { respondWith: "json", responseBody: "={{ $json }}", options: {} }, type: "n8n-nodes-base.respondToWebhook", typeVersion: 1.4, position: [2560, 512], id: "respond-publication", name: "RespondPublication" });
workflow.connections.PreparePublishRequest = { main: [[{ node: "GitHubReadProposalForPublish", type: "main", index: 0 }]] };
workflow.connections.GitHubReadProposalForPublish = { main: [[{ node: "GitHubReadReviewForPublish", type: "main", index: 0 }]] };
workflow.connections.GitHubReadReviewForPublish = { main: [[{ node: "GitHubReadCanonicalForPublish", type: "main", index: 0 }]] };
workflow.connections.GitHubReadCanonicalForPublish = { main: [[{ node: "BuildPublisherInput", type: "main", index: 0 }]] };
workflow.connections.BuildPublisherInput = { main: [[{ node: "ExecuteGovernedPublisher", type: "main", index: 0 }]] };
workflow.connections.ExecuteGovernedPublisher = { main: [[{ node: "FormatPublication", type: "main", index: 0 }]] };
workflow.connections.FormatPublication = { main: [[{ node: "RespondPublication", type: "main", index: 0 }]] };

const prepareRequest = workflow.nodes.find((node) => node.name === "PrepareRequest");
prepareRequest.parameters.jsCode = prepareRequest.parameters.jsCode.replace("['pmo.read', 'pmo.save', 'pmo.ingest']", "['pmo.read', 'pmo.save', 'pmo.ingest', 'pmo.review', 'pmo.publish']");
const prepareSave = workflow.nodes.find((node) => node.name === "PrepareSave");
prepareSave.parameters.jsCode = prepareSave.parameters.jsCode.replace("structuredClone($json.body?.document ?? null)", "JSON.parse(JSON.stringify($json.body?.document ?? null))");
workflow.versionId = "pmo-orchestrator-governed-publisher-v1";
writeFileSync(orchestratorPath, `${JSON.stringify(workflow, null, 2)}\n`);

const validatePublisherCode = `const input=$json??{};if(input.authorized!==true)throw new Error('Publisher authorization context is missing.');const set=input.proposalSet;const review=input.reviewBundle;const document=structuredClone(input.canonicalDocument);const actor=String(input.actor||'').trim();const key=String(input.idempotencyKey||'');if(!set||set.contractVersion!=='proposal-set-1.0'||!review||review.contractVersion!=='review-decision-1.0'||review.proposalSetId!==set.id||review.sourceExecutionId!==set.sourceExecutionId||!actor||!/^[A-Za-z0-9-]{8,80}$/.test(key))throw new Error('Publisher lineage or authorization validation failed.');const required=['workstreams','milestones','deliverables','risks','issues','actions','decisions','dependencies','assumptions','changeRequests','meetings','evidence','reviews','audit','objectVersions'];if(!document||document.schemaVersion!=='2.0'||required.some(name=>!Array.isArray(document[name])))throw new Error('Canonical PMO schema validation failed.');if(Number(input.expectedRevision)!==Number(document.revision)||Number(set.sourceRevision)!==Number(document.revision))throw new Error('Canonical revision changed after proposal generation. Regenerate proposals.');const correlation='publish:'+key;const prior=document.audit.find(item=>item.correlationId===correlation);const decisions=new Map(review.decisions.map(item=>[item.proposalId,item]));if(review.decisions.length!==set.proposals.length)throw new Error('Review decision coverage is incomplete.');const collections={workstream:'workstreams',milestone:'milestones',deliverable:'deliverables',risk:'risks',issue:'issues',action:'actions',decision:'decisions',dependency:'dependencies',assumption:'assumptions',change_request:'changeRequests',meeting:'meetings'};const allowed=new Set(['project',...Object.keys(collections)]);const accepted=[];const rejected=[];for(const proposal of set.proposals){const decision=decisions.get(proposal.id);if(!decision||decision.sourceExecutionId!==set.sourceExecutionId||decision.expectedObjectVersion!==proposal.expectedObjectVersion||!['accept','reject'].includes(decision.decision))throw new Error('Invalid review decision for '+proposal.id+'.');if(proposal.risk==='high'&&String(decision.rationale||'').trim().length<20)throw new Error('High-impact proposal requires accountable rationale.');if(decision.decision==='reject'){rejected.push(proposal.id);continue;}if(!allowed.has(proposal.entity)||!Array.isArray(proposal.evidenceIds)||!proposal.evidenceIds.length||proposal.evidenceIds.some(id=>!set.evidence.some(item=>item.id===id)))throw new Error('Proposal schema or evidence validation failed for '+proposal.id+'.');const current=proposal.entity==='project'?document.project:document[collections[proposal.entity]].find(item=>item.id===proposal.objectId);const version=Number(current?.governance?.version||0);if(version!==proposal.expectedObjectVersion)throw new Error('Object version conflict for '+proposal.objectId+'.');if(proposal.action==='create'&&current)throw new Error('Create target already exists: '+proposal.objectId);if(proposal.action!=='create'&&!current)throw new Error('Target does not exist: '+proposal.objectId);if(proposal.action!=='delete'&&(!proposal.proposedObject||proposal.proposedObject.id!==proposal.objectId))throw new Error('Proposed object payload is invalid.');accepted.push(proposal.id);}if(prior)return [{json:{shouldWrite:false,duplicate:true,proposalSetId:set.id,reviewBundleId:review.id,idempotencyKey:key,acceptedProposalIds:accepted,rejectedProposalIds:rejected,revision:document.revision,document}}];if(!accepted.length)return [{json:{shouldWrite:false,duplicate:false,proposalSetId:set.id,reviewBundleId:review.id,idempotencyKey:key,acceptedProposalIds:[],rejectedProposalIds:rejected,revision:document.revision,document}}];const now=new Date().toISOString();for(const proposal of set.proposals.filter(item=>accepted.includes(item.id))){const decision=decisions.get(proposal.id);const ref={type:proposal.entity,id:proposal.objectId};const current=proposal.entity==='project'?document.project:document[collections[proposal.entity]].find(item=>item.id===proposal.objectId);const version=proposal.expectedObjectVersion+1;const reviewId=review.id+'-'+proposal.id;for(const evidenceId of proposal.evidenceIds){if(!document.evidence.some(item=>item.id===evidenceId)){const source=set.evidence.find(item=>item.id===evidenceId);document.evidence.unshift({id:evidenceId,title:source?.label||evidenceId,kind:'other',source:source?.source||'agent proposal '+set.id,classification:'internal',status:source?.verified?'verified':'proposed',capturedAt:set.createdAt,capturedBy:'PMO Orchestrator',relatedObjects:[ref]});}}document.reviews.unshift({id:reviewId,object:ref,objectVersion:version,status:'approved',requestedAt:set.createdAt,requestedBy:'PMO Orchestrator',reviewer:review.reviewer,reviewedAt:review.decidedAt,rationale:String(decision.rationale||'Reviewed and accepted.'),evidenceIds:proposal.evidenceIds});if(proposal.action==='delete'){document[collections[proposal.entity]]=document[collections[proposal.entity]].filter(item=>item.id!==proposal.objectId);}else{const governance={version,reviewStatus:'approved',evidenceIds:proposal.evidenceIds,reviewIds:[...(current?.governance?.reviewIds||[]),reviewId],createdAt:current?.governance?.createdAt||now,createdBy:current?.governance?.createdBy||actor,updatedAt:now,updatedBy:actor};const next={...proposal.proposedObject,governance};if(proposal.entity==='project')document.project={...next,updatedAt:now};else{const collection=document[collections[proposal.entity]];const index=collection.findIndex(item=>item.id===proposal.objectId);if(index>=0)collection[index]=next;else collection.unshift(next);}document.objectVersions.unshift({id:'VER-'+proposal.entity+'-'+proposal.objectId+'-'+version,object:ref,version,createdAt:now,createdBy:actor,changeSummary:proposal.summary,reviewId,evidenceIds:proposal.evidenceIds,snapshot:next});}document.audit.unshift({id:'AUD-REVIEW-'+key+'-'+proposal.id,timestamp:review.decidedAt,actor:review.reviewer,action:'approve',object:ref,message:'Approved '+proposal.id+' from '+set.id+'.',correlationId:set.sourceExecutionId,changes:proposal.fieldChanges,evidenceIds:proposal.evidenceIds});document.audit.unshift({id:'AUD-PUBLISH-'+key+'-'+proposal.id,timestamp:now,actor,action:'publish',object:ref,message:'Published '+proposal.id+' through governed publisher.',correlationId:correlation,changes:proposal.fieldChanges,evidenceIds:proposal.evidenceIds});}document.revision=Number(document.revision)+1;const output={shouldWrite:true,duplicate:false,proposalSetId:set.id,reviewBundleId:review.id,idempotencyKey:key,acceptedProposalIds:accepted,rejectedProposalIds:rejected,revision:document.revision,document,fileContent:JSON.stringify(document,null,2)+'\\n',commitMessage:'pmo: publish governed proposal set '+set.id+' revision '+document.revision};return [{json:output}];`;
const n8nSafeValidatePublisherCode = "const structuredClone=value=>JSON.parse(JSON.stringify(value));" + validatePublisherCode;
const ifWrite = { parameters: { conditions: { options: { caseSensitive: true, leftValue: "", typeValidation: "strict", version: 2 }, conditions: [{ id: "publisher-write-condition", leftValue: "={{ $json.shouldWrite }}", rightValue: true, operator: { type: "boolean", operation: "true", singleValue: true } }], combinator: "and" }, options: {} }, type: "n8n-nodes-base.if", typeVersion: 2.2, position: [0, 0], id: "if-publisher-write", name: "IfCanonicalWriteRequired" };
const publisherWorkflow = {
  name: "OET PMO Agent - Governed Publisher",
  nodes: [
    { parameters: { workflowInputs: { values: [["authorized","boolean"],["proposalSet","object"],["reviewBundle","object"],["canonicalDocument","object"],["expectedRevision","number"],["idempotencyKey","string"],["actor","string"]].map(([name,type])=>({name,type})) } }, type: "n8n-nodes-base.executeWorkflowTrigger", typeVersion: 1.1, position: [-480, 0], id: "publisher-trigger", name: "Called by PMO Orchestrator" },
    { parameters: { jsCode: n8nSafeValidatePublisherCode }, type: "n8n-nodes-base.code", typeVersion: 2, position: [-240, 0], id: "validate-governed-publication", name: "ValidateGovernedPublication" },
    ifWrite,
    githubNode("GitHubPublishCanonicalPMO", "edit", "knowledge/pmo/control-tower.json", [240, -96], { fileContent: "={{ $json.fileContent }}", commitMessage: "={{ $json.commitMessage }}" }),
    { parameters: { jsCode: "const result=$node['ValidateGovernedPublication'].json;return [{json:{...result,commit:{sha:$json.commit?.sha??$json.content?.sha,url:$json.commit?.html_url??$json.content?.html_url}}}];" }, type: "n8n-nodes-base.code", typeVersion: 2, position: [480, -96], id: "format-publisher-write", name: "FormatPublisherWrite" },
    { parameters: { jsCode: "return [{json:$json}];" }, type: "n8n-nodes-base.code", typeVersion: 2, position: [240, 96], id: "format-publisher-no-write", name: "FormatPublisherNoWrite" },
  ],
  connections: {
    "Called by PMO Orchestrator": { main: [[{ node: "ValidateGovernedPublication", type: "main", index: 0 }]] },
    ValidateGovernedPublication: { main: [[{ node: "IfCanonicalWriteRequired", type: "main", index: 0 }]] },
    IfCanonicalWriteRequired: { main: [[{ node: "GitHubPublishCanonicalPMO", type: "main", index: 0 }], [{ node: "FormatPublisherNoWrite", type: "main", index: 0 }]] },
    GitHubPublishCanonicalPMO: { main: [[{ node: "FormatPublisherWrite", type: "main", index: 0 }]] },
  },
  active: false, settings: { executionOrder: "v1" }, versionId: "governed-publisher-v1", tags: [],
};
writeFileSync(publisherPath, `${JSON.stringify(publisherWorkflow, null, 2)}\n`);
console.log(`Built governed publisher and proposal-only orchestrator (${publisherLiveId}).`);
