import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";

const endpoint = process.env.OET_N8N_WEBHOOK || "https://eraneos-agentic-platform.azurewebsites.net/webhook/8d92d8ef-4267-4e67-88e8-8daab51c9361";
const organisationId = process.env.OET_ORGANISATION_ID || "org_e01243088e4b2501a09f9efb52d1a16864c6";
const projectId = process.env.OET_PROJECT_ID || "prj_c03ec8e4c2f8cc6b73537868d71087e50225";
const command = process.argv[2] || "sample";
const count = Number(process.argv[3] || 1);
const output = process.argv.find((value) => value.startsWith("--output="))?.slice(9);
const webhookSecret = process.env.OET_N8N_WEBHOOK_SECRET || "";
const headers = {
  "content-type": "application/json",
  origin: "https://florianliepe.github.io",
  referer: "https://florianliepe.github.io/",
  "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/139 Safari/537.36",
  ...(webhookSecret ? { "x-n8n-webhook-secret": webhookSecret } : {}),
};

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const post = async (payload) => {
  const response = await fetch(endpoint, { method: "POST", headers, body: JSON.stringify(payload) });
  const text = await response.text();
  let body;
  try { body = JSON.parse(text); } catch { body = text; }
  return { status: response.status, body };
};

const evidenceByScenario = {
  baseline: "Controlled reliability sample. This evidence contains no new PMO fact, decision, action, risk, milestone, or requested canonical update.",
  contradictory: "Controlled UAT contradiction. Source statement A: migration design approval is complete. Source statement B: migration design approval remains pending. Preserve the contradiction, do not choose either statement, and request accountable review.",
  unknown: "Controlled UAT unknown register named readinessSignals with value amber. Normalize only supported facts to PMO schema v2.0 or use the schema guard. Do not create an unsupported collection.",
  collision: "Controlled UAT work-package collision. This evidence contains no supported PMO change and must remain proposal-only.",
};

async function run({ scenario = "baseline", wpId, metaProjectId = projectId }) {
  const id = randomUUID();
  const requestedAt = new Date().toISOString();
  const ingest = await post({
    mode: "pmo.ingest",
    workspace: { organisationId, projectId },
    meta: {
      wpId: wpId || `UAT-${scenario.toUpperCase()}-${id.slice(0, 8)}`,
      title: `Controlled ${scenario} UAT`,
      owner_role: "PMO Lead",
      project: "Transformation Workspace",
      status: "active",
      rag: "amber",
      routing: "auto",
      domain_schema: "pmo-2.0",
      agent_contract_version: "agent-run-1.0",
      correlation_id: id,
      idempotency_key: id,
      requested_at: requestedAt,
      organisation_id: organisationId,
      project_id: metaProjectId,
    },
    extracted: [{ name: `${scenario}.txt`, type: "text", content: evidenceByScenario[scenario] }],
  });
  if (ingest.status >= 400 || !ingest.body?.accepted) return { scenario, id, requestedAt, ingest, terminal: null };
  let terminal = ingest.body.run;
  for (let attempt = 0; attempt < 90 && ["accepted", "running"].includes(terminal?.state); attempt += 1) {
    await delay(2000);
    const status = await post({ mode: "pmo.run.status", workspace: { organisationId, projectId }, runId: `agent:${id}`, correlationId: id, idempotencyKey: id });
    if (status.body?.run) terminal = status.body.run;
    else if (status.status >= 400) return { scenario, id, requestedAt, ingest, status, terminal: null };
  }
  return { scenario, id, requestedAt, ingest: { status: ingest.status, body: ingest.body }, terminal };
}

let results = [];
if (command === "cross-project") {
  results = [await run({ scenario: "baseline", wpId: "LA-06-CROSS-PROJECT", metaProjectId: "prj_wrongscope0000000000000000000000000000" })];
} else if (command === "failure") {
  const wpId = `LA-FAIL-${Date.now().toString(36).toUpperCase()}`;
  results.push(await run({ scenario: "collision", wpId }));
  results.push(await run({ scenario: "collision", wpId }));
} else if (command === "contradictory" || command === "unknown") {
  results = [await run({ scenario: command })];
} else {
  for (let index = 0; index < count; index += 1) {
    const result = await run({ scenario: "baseline" });
    results.push(result);
    console.error(`${index + 1}/${count} ${result.id} ${result.terminal?.state || result.ingest.status}`);
  }
}

const artifact = { generatedAt: new Date().toISOString(), endpoint, organisationId, projectId, command, results };
if (output) writeFileSync(output, `${JSON.stringify(artifact, null, 2)}\n`);
console.log(JSON.stringify(artifact, null, 2));
