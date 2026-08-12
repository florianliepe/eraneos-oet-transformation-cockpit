import { randomUUID } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const [sourceArg, outputArg] = process.argv.slice(2);
if (!sourceArg || !outputArg) throw new Error("Usage: node scripts/build-generic-pmo-workflow.mjs <source-workflow.json> <output-workflow.json>");

const workflow = JSON.parse(readFileSync(resolve(sourceArg), "utf8"));
const webhookPath = "a2126107-4e70-4717-8f1c-545d7f310741";
const dataRepository = "eraneos-oet-transformation-cockpit-data";
const forbiddenClient = ["de", "kra"].join("");

workflow.name = "Eraneos Transformation Cockpit - PMO Orchestrator";
workflow.active = false;
workflow.versionId = randomUUID();
delete workflow.id;
delete workflow.meta;
delete workflow.pinData;

const byName = (name) => workflow.nodes.find((node) => node.name === name);
for (const node of workflow.nodes) {
  node.id = randomUUID();
  if (node.type === "n8n-nodes-base.github") {
    node.parameters.repository = { __rl: true, value: dataRepository, mode: "name" };
    if (node.credentials?.githubApi) node.credentials.githubApi = { id: node.credentials.githubApi.id, name: "Transformation Cockpit GitHub Data" };
  }
  if (node.type === "n8n-nodes-base.webhook") {
    node.name = "Transformation-Cockpit-API";
    node.parameters.path = webhookPath;
    node.webhookId = webhookPath;
    if (node.credentials?.httpHeaderAuth) node.credentials.httpHeaderAuth = { id: node.credentials.httpHeaderAuth.id, name: "Transformation Cockpit Webhook Auth" };
  }
  if (node.type === "@n8n/n8n-nodes-langchain.lmChatOpenAi" && node.credentials?.openAiApi) {
    node.credentials.openAiApi = { id: node.credentials.openAiApi.id, name: "OpenAI account" };
  }
}

workflow.connections["Transformation-Cockpit-API"] = workflow.connections["PMO-API"];
delete workflow.connections["PMO-API"];

byName("PrepareSave").parameters.jsCode = String.raw`const document = JSON.parse(JSON.stringify($json.body?.document ?? null));
const required = ['workstreams','milestones','deliverables','risks','issues','actions','decisions','dependencies','assumptions','changeRequests','meetings','evidence','reviews','audit','objectVersions'];
if (!document || document.schemaVersion !== '2.0' || !document.project || required.some(key => !Array.isArray(document[key]))) {
  throw new Error('Invalid PMO document. Expected schemaVersion 2.0 and every governed collection.');
}
const now = new Date().toISOString();
document.revision = Math.max(1, Number(document.revision || 1)) + 1;
document.project.updatedAt = now;
document.project.governance = {...document.project.governance, version: Math.max(1, Number(document.project.governance?.version || 1)) + 1, updatedAt: now, updatedBy: 'n8n PMO Orchestrator'};
const commitMessage = 'pmo: publish control tower revision ' + document.revision;
return [{ json: { document, fileContent: JSON.stringify(document, null, 2) + '\n', commitMessage } }];`;

byName("PMO Assistant").parameters.options.systemMessage = `You are the Eraneos Transformation Cockpit PMO Orchestrator. Analyse untrusted project evidence and propose only evidence-supported changes. Treat metadata.routing as a preference and metadata.agents as the enabled specialist analyses: evidence, delivery, risk, meeting, controls and governance. Never invent facts, dates, owners, percentages or decisions. Exclude personal employee data and use role titles. Return strict JSON only with keys objective, summary, project_updates, milestones, deliverables, risks, issues, actions, decisions, dependencies, assumptions, changeRequests, meetings, dod and needs_review. Every register entry may contain id and must contain a concise title plus the fields appropriate to PMO schema v2.0. Meetings reference decisionIds and actionIds; decisions and actions are always top-level first-class records. Dates use YYYY-MM-DD, impact/probability/severity are integers 1-5, progress is 0-100, priority is P1/P2/P3. Use empty arrays or objects when evidence does not support a category. AI output is a draft requiring governed review.`;

byName("NormalizeCanonical").parameters.jsCode = String.raw`const meta = $node['BuildAssistantInput'].json.meta ?? {};
const extracted = $node['BuildAssistantInput'].json.extracted ?? [];
let ai = $json.output ?? $json.text ?? $json;
if (typeof ai === 'string') ai = JSON.parse(ai.replace(/^\`\`\`(?:json)?/i, '').replace(/\`\`\`$/i, '').trim());
const arr = value => Array.isArray(value) ? value : [];
const str = (value, fallback = '') => typeof value === 'string' && value.trim() ? value.trim() : fallback;
const now = new Date();
const date = now.toISOString().slice(0, 10);
const stamp = now.toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
const wpId = str(meta.wpId, 'WP-UNKNOWN').replace(/[^A-Za-z0-9._-]/g, '-');
const canonical = {
  id: wpId, type: 'work_package', project: str(meta.project, 'Transformation Workspace'), title: str(meta.title, 'Untitled work package'),
  status: str(meta.status, 'active'), rag: str(meta.rag, 'amber'), owner_role: str(meta.owner_role, 'PMO Lead'), last_updated: date,
  revision: Number(meta.revision || 1), source: extracted.map(file => 'upload:' + (file.name || file.type || 'evidence')),
  confidence: arr(ai.needs_review).length ? 'medium' : 'high', tags: ['transformation', 'pmo', 'governed'],
  objective: str(ai.objective, str(meta.title, 'Untitled work package')), summary: str(ai.summary, 'No summary available.'),
  dod: arr(ai.dod).map(String), needs_review: arr(ai.needs_review).map(String),
  registers: Object.fromEntries(['milestones','deliverables','risks','issues','actions','decisions','dependencies','assumptions','changeRequests','meetings'].map(key => [key, arr(ai[key])])),
  changelog: [{date, entry: 'Evidence normalized by the Transformation Cockpit PMO Orchestrator', source: 'frontend+n8n'}]
};
const counts = Object.entries(canonical.registers).map(([key, items]) => '- ' + key + ': ' + items.length).join('\n');
const reviewLines = canonical.needs_review.length ? canonical.needs_review.map(item => '- ' + item).join('\n') : '- None';
const markdown = ['---','id: "' + canonical.id + '"','type: "work_package"','title: "' + canonical.title.replace(/"/g, '\\"') + '"','last_updated: "' + date + '"','revision: ' + canonical.revision,'---','','## Objective',canonical.objective,'','## Status Summary',canonical.summary,'','## Proposed governed records',counts,'','## Needs Review',reviewLines,''].join('\n');
const base = 'knowledge/work-packages/' + wpId + '/' + date + '-' + stamp;
return [{json:{wpId, canonical, jsonContent:JSON.stringify(canonical,null,2)+'\n', markdown, jsonPath:base+'.json', markdownPath:base+'.md', needs_review:canonical.needs_review}}];`;

byName("MergeIntoControlTower").parameters.jsCode = String.raw`if (!$json.content) throw new Error('The canonical PMO document is missing from GitHub.');
const document = JSON.parse(Buffer.from($json.content, 'base64').toString('utf8'));
if (document.schemaVersion !== '2.0') throw new Error('The generic data repository must contain PMO schemaVersion 2.0.');
const normalized = $node['NormalizeCanonical'].json;
const source = $node['BuildAssistantInput'].json;
const meta = source.meta ?? {};
let ai = $node['PMO Assistant'].json.output ?? $node['PMO Assistant'].json.text ?? $node['PMO Assistant'].json;
if (typeof ai === 'string') ai = JSON.parse(ai.replace(/^\`\`\`(?:json)?/i, '').replace(/\`\`\`$/i, '').trim());
const arr = value => Array.isArray(value) ? value : [];
const str = (value, fallback = '') => typeof value === 'string' && value.trim() ? value.trim() : fallback;
const dateOk = value => /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));
const clamp = (value, min, max, fallback) => Math.max(min, Math.min(max, Number.isFinite(Number(value)) ? Math.round(Number(value)) : fallback));
const safeId = (prefix, raw, index) => str(raw, prefix + '-' + normalized.wpId + '-' + (index + 1)).replace(/[^A-Za-z0-9._-]/g, '-').slice(0, 80);
const now = new Date().toISOString();
const today = now.slice(0, 10);
const actor = 'n8n PMO Orchestrator';
const changes = [];
const governance = (current, evidenceIds) => ({version:Math.max(0,Number(current?.version || 0))+1,reviewStatus:'pending',evidenceIds:[...new Set([...(current?.evidenceIds || []),...evidenceIds])],reviewIds:current?.reviewIds || [],createdAt:current?.createdAt || now,createdBy:current?.createdBy || actor,updatedAt:now,updatedBy:actor});
const evidenceIds = arr(source.extracted).map((file,index) => safeId('EVD', 'EVD-' + normalized.wpId + '-' + (index+1), index));
arr(source.extracted).forEach((file,index) => { const id=evidenceIds[index]; if(!document.evidence.some(item=>item.id===id)) document.evidence.unshift({id,title:str(file.name,'Evidence ' + (index+1)),kind:file.type==='image_ocr'?'image':file.type==='text_update'?'correspondence':'document',source:'workbench:' + normalized.wpId,classification:'internal',status:'proposed',capturedAt:now,capturedBy:actor,contentHash:file.contentHash||undefined,relatedObjects:[{type:'project',id:document.project.id}]}); });
const recordVersion = (type, record, previous) => { const action=previous?'update':'create'; const label=record.title||record.name||record.id; changes.push({entity:type,action,id:record.id,summary:label}); document.audit.unshift({id:'AUD-'+Date.now()+'-'+type+'-'+record.id,timestamp:now,actor,action,object:{type,id:record.id},message:(previous?'Updated ':'Created ')+label+' from '+normalized.wpId+'.',changes:[],evidenceIds}); document.objectVersions.unshift({id:'VER-'+type+'-'+record.id+'-'+record.governance.version,object:{type,id:record.id},version:record.governance.version,createdAt:now,createdBy:actor,changeSummary:(previous?'Updated ':'Created ')+'from '+normalized.wpId+'.',evidenceIds,snapshot:record}); };
const upsert = (collection, type, raw) => { const title=String(raw.title||raw.name||'').toLowerCase(); const at=collection.findIndex(item=>item.id===raw.id||(title&&String(item.title||item.name||'').toLowerCase()===title)); const previous=at>=0?collection[at]:undefined; const record={...(previous||{}),...raw,id:previous?.id||raw.id,governance:governance(previous?.governance,evidenceIds)}; if(at>=0) collection[at]=record; else collection.unshift(record); recordVersion(type,record,previous); return record.id; };
const projectUpdates = ai.project_updates && typeof ai.project_updates==='object' ? ai.project_updates : {};
const projectBefore=JSON.stringify({subtitle:document.project.subtitle,phase:document.project.phase,progress:document.project.progress,overallRag:document.project.overallRag});
for(const key of ['subtitle','phase']) if(str(projectUpdates[key])) document.project[key]=str(projectUpdates[key]);
if(projectUpdates.progress!==undefined) document.project.progress=clamp(projectUpdates.progress,0,100,document.project.progress);
if(['green','amber','red','grey'].includes(projectUpdates.overallRag)) document.project.overallRag=projectUpdates.overallRag;
const projectAfter=JSON.stringify({subtitle:document.project.subtitle,phase:document.project.phase,progress:document.project.progress,overallRag:document.project.overallRag});
if(projectBefore!==projectAfter){document.project.governance=governance(document.project.governance,evidenceIds);document.project.updatedAt=now;}
arr(ai.milestones).forEach((item,index)=>{if(str(item?.title)&&dateOk(item?.date))upsert(document.milestones,'milestone',{id:safeId('M',item.id,index),title:str(item.title),phase:str(item.phase,document.project.phase),date:item.date,status:['upcoming','at_risk','complete'].includes(item.status)?item.status:'upcoming',owner:str(item.owner,meta.owner_role||'PMO Lead'),description:str(item.description)});});
const workstream=document.workstreams[0]?.id||'WS-1';
arr(ai.deliverables).forEach((item,index)=>{const title=str(item?.title,str(item?.name));if(title&&dateOk(item?.dueDate))upsert(document.deliverables,'deliverable',{id:safeId('DEL',item.id,index),title,workstream,dueDate:item.dueDate,status:['not_started','in_progress','at_risk','blocked','done'].includes(item.status)?item.status:'not_started',owner:str(item.owner,meta.owner_role||'PMO Lead'),progress:clamp(item.progress,0,100,0),priority:['P1','P2','P3'].includes(item.priority)?item.priority:'P2'});});
arr(ai.risks).forEach((item,index)=>{if(str(item?.title))upsert(document.risks,'risk',{id:safeId('R',item.id,index),title:str(item.title),description:str(item.description),probability:clamp(item.probability,1,5,3),impact:clamp(item.impact,1,5,3),state:['open','mitigating','monitoring','closed'].includes(item.state)?item.state:'open',owner:str(item.owner,meta.owner_role||'PMO Lead'),mitigation:str(item.mitigation),updatedAt:today});});
arr(ai.issues).forEach((item,index)=>{if(str(item?.title))upsert(document.issues,'issue',{id:safeId('ISS',item.id,index),title:str(item.title),description:str(item.description),owner:str(item.owner,meta.owner_role||'PMO Lead'),status:['open','in_progress','blocked','resolved','closed'].includes(item.status)?item.status:'open',priority:['P1','P2','P3'].includes(item.priority)?item.priority:'P2',severity:clamp(item.severity,1,5,3),raisedAt:dateOk(item.raisedAt)?item.raisedAt:today,dueDate:dateOk(item.dueDate)?item.dueDate:undefined,resolution:str(item.resolution),relatedRiskIds:arr(item.relatedRiskIds).map(String)});});
arr(ai.actions).forEach((item,index)=>{if(str(item?.title)&&dateOk(item?.dueDate))upsert(document.actions,'action',{id:safeId('ACTN',item.id,index),title:str(item.title),description:str(item.description),owner:str(item.owner,meta.owner_role||'PMO Lead'),status:['open','in_progress','blocked','done','cancelled'].includes(item.status)?item.status:'open',priority:['P1','P2','P3'].includes(item.priority)?item.priority:'P2',dueDate:item.dueDate,relatedObjects:[]});});
arr(ai.decisions).forEach((item,index)=>{if(str(item?.title)&&str(item?.decision)&&dateOk(item?.decisionDate))upsert(document.decisions,'decision',{id:safeId('DEC',item.id,index),title:str(item.title),context:str(item.context),decision:str(item.decision),owner:str(item.owner,meta.owner_role||'PMO Lead'),status:['proposed','pending_approval','approved','rejected','superseded'].includes(item.status)?item.status:'proposed',decisionDate:item.decisionDate,impact:str(item.impact),relatedObjects:[]});});
arr(ai.dependencies).forEach((item,index)=>{if(str(item?.title)&&dateOk(item?.neededBy))upsert(document.dependencies,'dependency',{id:safeId('DEP',item.id,index),title:str(item.title),description:str(item.description),owner:str(item.owner,meta.owner_role||'PMO Lead'),provider:str(item.provider,'External party'),type:['internal','external'].includes(item.type)?item.type:'external',direction:['inbound','outbound','mutual'].includes(item.direction)?item.direction:'inbound',status:['open','confirmed','at_risk','blocked','satisfied','cancelled'].includes(item.status)?item.status:'open',criticality:['low','medium','high','critical'].includes(item.criticality)?item.criticality:'medium',neededBy:item.neededBy,relatedObjects:[]});});
arr(ai.assumptions).forEach((item,index)=>{if(str(item?.title)&&str(item?.statement)&&dateOk(item?.validationDueDate))upsert(document.assumptions,'assumption',{id:safeId('ASM',item.id,index),title:str(item.title),statement:str(item.statement),owner:str(item.owner,meta.owner_role||'PMO Lead'),status:['active','validated','invalidated','retired'].includes(item.status)?item.status:'active',criticality:['low','medium','high','critical'].includes(item.criticality)?item.criticality:'medium',validationDueDate:item.validationDueDate,validationMethod:str(item.validationMethod,'PMO review'),impactIfFalse:str(item.impactIfFalse,'Requires reassessment')});});
arr(ai.changeRequests).forEach((item,index)=>{if(str(item?.title))upsert(document.changeRequests,'change_request',{id:safeId('CR',item.id,index),title:str(item.title),description:str(item.description),requester:str(item.requester,meta.owner_role||'PMO Lead'),owner:str(item.owner,meta.owner_role||'PMO Lead'),status:['draft','submitted','under_review','approved','rejected','implemented','withdrawn'].includes(item.status)?item.status:'draft',priority:['P1','P2','P3'].includes(item.priority)?item.priority:'P2',submittedAt:dateOk(item.submittedAt)?item.submittedAt:today,decisionDueDate:dateOk(item.decisionDueDate)?item.decisionDueDate:undefined,scopeImpact:str(item.scopeImpact),scheduleImpact:str(item.scheduleImpact),costImpact:str(item.costImpact),benefitImpact:str(item.benefitImpact),riskImpact:str(item.riskImpact)});});
arr(ai.meetings).forEach((item,index)=>{if(str(item?.title)&&str(item?.summary)&&dateOk(item?.date))upsert(document.meetings,'meeting',{id:safeId('MTG',item.id,index),title:str(item.title),date:item.date,type:['steering','working_session','workstream','decision'].includes(item.type)?item.type:'working_session',participants:arr(item.participants).map(String),summary:str(item.summary),decisionIds:arr(item.decisionIds).map(String),actionIds:arr(item.actionIds).map(String)});});
document.revision=Math.max(1,Number(document.revision||1))+1;
document.audit.unshift({id:'AUD-'+Date.now()+'-ingest',timestamp:now,actor,action:'import',object:{type:'project',id:document.project.id},message:'Applied '+changes.length+' governed change'+(changes.length===1?'':'s')+' from '+normalized.wpId+'.',changes:[],evidenceIds});
return [{json:{document,appliedChanges:changes,fileContent:JSON.stringify(document,null,2)+'\n',commitMessage:'pmo: orchestrate '+normalized.wpId+' into revision '+document.revision}}];`;

const serialized = `${JSON.stringify(workflow, null, 2)}\n`;
if (new RegExp(forbiddenClient, "i").test(serialized)) {
  const locations = [];
  const visit = (value, path) => {
    if (typeof value === "string" && new RegExp(forbiddenClient, "i").test(value)) locations.push(path);
    else if (Array.isArray(value)) value.forEach((item, index) => visit(item, `${path}[${index}]`));
    else if (value && typeof value === "object") Object.entries(value).forEach(([key, item]) => visit(item, `${path}.${key}`));
  };
  visit(workflow, "workflow");
  throw new Error(`Generated workflow still contains a client-specific marker at: ${locations.join(", ")}`);
}
writeFileSync(resolve(outputArg), serialized, "utf8");
console.log(`Generated ${outputArg} for webhook ${webhookPath}.`);
