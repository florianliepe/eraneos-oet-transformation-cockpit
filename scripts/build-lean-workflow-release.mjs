import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const releasePath = resolve("docs/n8n/releases/2026-08-14-zm-prod-27-release-safety.json");
const files = [
  "docs/n8n/agents/lean-pmo-orchestrator.workflow.json",
  "docs/n8n/agents/governed-publisher.workflow.json",
  "docs/n8n/agents/error-handler.workflow.json",
  "docs/n8n/model-capabilities.json",
];
const canonical = (file) => readFileSync(resolve(file), "utf8").replace(/\r\n/g, "\n");
const artifacts = files.map((file) => ({ file, sha256: createHash("sha256").update(canonical(file)).digest("hex") }));
const release = {
  releaseContract: "workflow-release-2.0",
  releaseId: "2026-08-14-zm-prod-27-release-safety",
  createdAt: "2026-08-14T08:00:00.000Z",
  status: "candidate",
  endpoint: {
    method: "POST",
    webhookPath: "8d92d8ef-4267-4e67-88e8-8daab51c9361",
    contractModes: ["pmo.read", "pmo.save", "pmo.ingest", "pmo.run.status", "pmo.review", "pmo.publish"],
  },
  binding: {
    candidateWorkflowId: "hE0z1J0iB6F71oSv",
    rollbackWorkflowId: "KNwZZBkaTdAqwlyT",
    runtimeSelector: "lean",
    promotionRequiresCanary: true,
  },
  workflow: { name: "Eraneos Transformation Cockpit - Lean PMO Orchestrator v2", version: "2.0.0" },
  artifacts,
  modelCapabilityContract: "docs/n8n/model-capabilities.json",
  safetyGates: [
    "checksums",
    "unique-node-identities",
    "no-dangling-edges",
    "no-orphan-runtime-nodes",
    "code-node-syntax",
    "model-parameter-compatibility",
    "credential-value-exclusion",
    "non-destructive-canary-before-promotion"
  ],
};
writeFileSync(releasePath, `${JSON.stringify(release, null, 2)}\n`);
console.log(`Built ${release.releaseId} with ${artifacts.length} checksummed artifacts.`);
