import { SteercoSnapshotSchema, type SteercoEvidenceEnvelope, type SteercoSnapshot } from "./steerco-schema";
import { publicWorkflowEndpoint } from "./public-runtime";

export type SteercoWorkflowResponse = {
  ok?: boolean;
  error?: string;
  snapshot?: SteercoSnapshot;
  shareId?: string;
  readOnlyUrl?: string;
  message?: string;
};

function configuredEndpoint(variable: "NEXT_PUBLIC_N8N_STEERCO_WEBHOOK_URL" | "NEXT_PUBLIC_N8N_STEERCO_READ_WEBHOOK_URL") {
  return publicWorkflowEndpoint(process.env[variable]);
}
function endpoint() { return configuredEndpoint("NEXT_PUBLIC_N8N_STEERCO_WEBHOOK_URL"); }
function readEndpoint() { return configuredEndpoint("NEXT_PUBLIC_N8N_STEERCO_READ_WEBHOOK_URL"); }
function unwrap(raw: unknown): SteercoWorkflowResponse {
  if (Array.isArray(raw)) return ((raw[0] as { json?: SteercoWorkflowResponse } | undefined)?.json || raw[0] || {}) as SteercoWorkflowResponse;
  return (raw || {}) as SteercoWorkflowResponse;
}

async function request(body: Record<string, unknown>, secret?: string, target = endpoint()) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (secret?.trim()) headers["x-n8n-webhook-secret"] = secret.trim();
  const response = await fetch(target, { method: "POST", headers, body: JSON.stringify(body), cache: "no-store" });
  const raw = (response.headers.get("content-type") || "").includes("application/json") ? await response.json() : await response.text();
  const payload = unwrap(raw);
  if (!response.ok || payload.ok === false) throw new Error(payload.error || `SteerCo workflow returned HTTP ${response.status}.`);
  if (payload.snapshot) payload.snapshot = SteercoSnapshotSchema.parse(payload.snapshot);
  return payload;
}

export function generateSteercoDraft(secret: string, evidenceDraft: SteercoSnapshot, envelope: SteercoEvidenceEnvelope, actor: string, idempotencyKey = crypto.randomUUID()) {
  return request({ mode: "steerco.generate", evidenceDraft, envelope, actor, idempotencyKey }, secret);
}
export function reviseSteercoSection(secret: string, snapshot: SteercoSnapshot, section: string, instruction: string, actor: string, idempotencyKey = crypto.randomUUID()) {
  return request({ mode: "steerco.revise", snapshot, section, instruction, actor, idempotencyKey }, secret);
}
export function approveSteercoSnapshot(secret: string, snapshot: SteercoSnapshot, actor: string, reason: string, expectedRevision: number) {
  return request({ mode: "steerco.approve", snapshot, actor, reason, expectedRevision, idempotencyKey: crypto.randomUUID() }, secret);
}
export function rejectSteercoSnapshot(secret: string, snapshot: SteercoSnapshot, actor: string, reason: string, expectedRevision: number) {
  return request({ mode: "steerco.reject", snapshot, actor, reason, expectedRevision, idempotencyKey: crypto.randomUUID() }, secret);
}
export function publishSteercoSnapshot(secret: string, snapshot: SteercoSnapshot, expiresAt?: string) {
  return request({ mode: "steerco.publish", snapshot, expiresAt, expectedRevision: snapshot.revision, idempotencyKey: crypto.randomUUID() }, secret);
}
export function revokeSteercoShare(secret: string, shareId: string, actor: string, reason: string) {
  return request({ mode: "steerco.revoke", shareId, actor, reason, idempotencyKey: crypto.randomUUID() }, secret);
}
export function rollbackSteercoPublication(secret: string, snapshotId: string, targetRevision: number, actor: string, reason: string) {
  return request({ mode: "steerco.rollback", snapshotId, targetRevision, actor, reason, idempotencyKey: crypto.randomUUID() }, secret);
}
export function loadSteercoShare(shareId: string) {
  return request({ mode: "steerco.read", shareId }, undefined, readEndpoint());
}
