import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const manifest = JSON.parse(readFileSync(resolve("docs/n8n/agents/manifest.json"), "utf8"));
const files = [
  "docs/n8n-pmo-orchestrator.workflow.json",
  "docs/n8n/agents/governed-publisher.workflow.json",
  "docs/n8n/agents/error-handler.workflow.json",
  "docs/n8n/agents/smoke-test.workflow.json",
  "docs/n8n/agents/governed-publisher-smoke.workflow.json",
  ...manifest.workflows.map((item) => `docs/n8n/agents/${item.file}`),
];
const canonicalBytes = (file) => readFileSync(resolve(file), "utf8").replace(/\r\n/g, "\n");
const artifacts = files.map((file) => ({ file, sha256: createHash("sha256").update(canonicalBytes(file)).digest("hex") }));
const release = {
  releaseContract: "workflow-release-1.0",
  releaseId: "2026-08-13-zm-prod-09-agent-evaluation",
  createdAt: new Date().toISOString(),
  compatibility: { n8nEdition: "cloud-compatible community feature set", executionOrder: "v1", executeSubWorkflowNode: "1.3", githubNode: "1.1", codeNode: "2", nodeRuntime: "22.x" },
  endpoint: { method: "POST", webhookPath: manifest.orchestrator.webhookPath, contractModes: ["pmo.read", "pmo.save", "pmo.ingest", "pmo.run.status", "pmo.review", "pmo.publish"] },
  bindings: { orchestrator: manifest.orchestrator.liveWorkflowId, publisher: manifest.publisher.liveWorkflowId, errorHandler: manifest.operations.errorWorkflowLiveId, specialists: Object.fromEntries(manifest.workflows.map((item) => [item.workflowId, item.liveWorkflowId])) },
  artifacts,
  credentialBindings: [
    { name: "GitHub data", id: "3V46mglu7fpoPISX", scope: "contents read/write on the private PMO data repository; no credential value exported" },
    { name: "OpenAI account", id: "jGlNDqeYEbc5DwVT", scope: "model invocation for specialist workflows; no credential value exported" },
    { name: "Transformation Cockpit Webhook Auth", id: "XeRspTWURk5bdcPi", scope: "webhook header authentication; no credential value exported" }
  ],
  recoveryEvidence: { nonProductionWorkflowId: "2gICFodknzpc1WAc", result: "success", assertion: "The live selected-domain canary must preserve canonicalWriteAllowed=false; proposals from specialists absent from the routing receipt are dropped, and rejected or duplicate publication remains shouldWrite=false" }
};
mkdirSync(resolve("docs/n8n/releases"), { recursive: true });
writeFileSync(resolve("docs/n8n/releases/2026-08-13-zm-prod-09-agent-evaluation.json"), `${JSON.stringify(release, null, 2)}\n`);
console.log(`Built ${release.releaseId} with ${artifacts.length} checksummed workflow artifacts.`);
