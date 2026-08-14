import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const path = resolve("docs/n8n/agents/governed-publisher.workflow.json");
const workflow = JSON.parse(readFileSync(path, "utf8"));
const byName = (name) => workflow.nodes.find((node) => node.name === name);
const upsert = (node) => {
  const index = workflow.nodes.findIndex((item) => item.name === node.name);
  if (index >= 0) workflow.nodes[index] = node;
  else workflow.nodes.push(node);
};

const publish = byName("GitHubPublishCanonicalPMO");
const prepareCode = `const input=$json??{};const scope=input.scope??{};const canonicalPath=String(input.canonicalPath||'');if(input.authorized!==true)throw new Error('Publisher authorization context is missing.');if(!/^org_[A-Za-z0-9_-]{6,80}$/.test(String(scope.organisationId||''))||!/^prj_[A-Za-z0-9_-]{6,80}$/.test(String(scope.projectId||''))||canonicalPath!=='knowledge/pmo/workspaces/'+scope.organisationId+'/'+scope.projectId+'/control-tower.json')throw new Error('Publisher workspace scope is invalid.');const attemptId=String($execution?.id||'unavailable');const retryOf=String($execution?.retryOf||'')||undefined;return [{json:{...input,publicationAttempt:{policyVersion:'publisher-retry-1.0',attempt:retryOf?2:1,maxAttempts:2,attemptId,retryOf}}}];`;
const freshInputCode = `if(!$json.content)throw new Error('Current canonical PMO document is missing.');const original=$node['PreparePublisherAttempt'].json;const canonicalDocument=JSON.parse(Buffer.from($json.content,'base64').toString('utf8'));return [{json:{...original,canonicalDocument}}];`;
upsert({ parameters: { jsCode: prepareCode }, type: "n8n-nodes-base.code", typeVersion: 2, position: [-720, 0], id: "prepare-publisher-attempt", name: "PreparePublisherAttempt" });
upsert({
  parameters: {
    authentication: "accessToken", resource: "file", operation: "get",
    owner: publish.parameters.owner, repository: publish.parameters.repository,
    filePath: "={{ $json.canonicalPath }}", asBinaryProperty: false,
    additionalParameters: { reference: "main" },
  },
  type: "n8n-nodes-base.github", typeVersion: 1.1, position: [-480, 0],
  id: "github-read-current-canonical-for-publication", name: "GitHubReadCurrentCanonicalForPublication",
  credentials: publish.credentials,
});
upsert({ parameters: { jsCode: freshInputCode }, type: "n8n-nodes-base.code", typeVersion: 2, position: [-240, 0], id: "build-fresh-publisher-input", name: "BuildFreshPublisherInput" });

byName("ValidateGovernedPublication").position = [0, 0];
byName("IfCanonicalWriteRequired").position = [240, 0];
publish.position = [480, -96];
delete publish.retryOnFail;
delete publish.maxTries;
delete publish.waitBetweenTries;
byName("FormatPublisherWrite").position = [720, -96];
byName("FormatPublisherWrite").parameters.jsCode = "const result=$node['ValidateGovernedPublication'].json;return [{json:{...result,publicationAttempt:$node['BuildFreshPublisherInput'].json.publicationAttempt,commit:{sha:$json.commit?.sha??$json.content?.sha,url:$json.commit?.html_url??$json.content?.html_url}}}];";
byName("FormatPublisherNoWrite").position = [480, 96];
byName("FormatPublisherNoWrite").parameters.jsCode = "return [{json:{...$json,publicationAttempt:$node['BuildFreshPublisherInput'].json.publicationAttempt}}];";

workflow.connections["Called by PMO Orchestrator"] = { main: [[{ node: "PreparePublisherAttempt", type: "main", index: 0 }]] };
workflow.connections.PreparePublisherAttempt = { main: [[{ node: "GitHubReadCurrentCanonicalForPublication", type: "main", index: 0 }]] };
workflow.connections.GitHubReadCurrentCanonicalForPublication = { main: [[{ node: "BuildFreshPublisherInput", type: "main", index: 0 }]] };
workflow.connections.BuildFreshPublisherInput = { main: [[{ node: "ValidateGovernedPublication", type: "main", index: 0 }]] };
workflow.versionId = "governed-publisher-v1-1-0";
writeFileSync(path, `${JSON.stringify(workflow, null, 2)}\n`);
console.log("Hardened governed publisher with fresh-canonical idempotent retry lineage.");
