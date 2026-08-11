import { z } from "zod";
import { AgentOperationRecordSchema, type AgentOperationRecord } from "./agent-operations";
import { LOCAL_IDENTITY_STORAGE_KEY, type StorageBoundary } from "./local-identity-provider";
import { LOCAL_WORKSPACE_STORAGE_KEY } from "./local-workspace-repository";
import { migratePmoDocument } from "./pmo-schema";
import { InvitationSchema, MembershipAuditEventSchema, OrganisationMembershipSchema, OrganisationSchema, ProjectMembershipSchema, ProjectWorkspaceSchema, SessionSchema, UserAccountSchema } from "./workspace-schema";

export const LOCAL_BACKUP_CONTRACT_VERSION = "local-workspace-backup-1.0" as const;
export const LOCAL_BACKUP_METADATA_KEY = "oet:workspace:v1:backup-metadata";
const PROJECT_KEY = /^oet:workspace:v1:organisation:([^:]+):project:([^:]+):pmo$/;
const SELECTION_KEY = /^oet:workspace:v1:selection:([^:]+):([^:]+)$/;
const ITERATIONS = 240_000;

export type EnumerableStorage = StorageBoundary & Pick<Storage, "length" | "key">;

const BackupPayloadSchema = z.object({
  contractVersion: z.literal(LOCAL_BACKUP_CONTRACT_VERSION),
  exportedAt: z.string().datetime(),
  entries: z.record(z.string(), z.string()),
  agentOperations: z.array(AgentOperationRecordSchema),
});

const EncryptedBackupSchema = z.object({
  contractVersion: z.literal(LOCAL_BACKUP_CONTRACT_VERSION),
  encryption: z.literal("PBKDF2-SHA256-AES-256-GCM"),
  iterations: z.literal(ITERATIONS),
  salt: z.string().min(20),
  iv: z.string().min(12),
  ciphertext: z.string().min(20),
  ciphertextDigest: z.string().regex(/^[a-f0-9]{64}$/),
});

export type BackupPreview = { exportedAt: string; accounts: number; organisations: number; projects: number; projectDocuments: number; agentOperations: number; conflicts: string[] };
type BackupPayload = z.infer<typeof BackupPayloadSchema>;

function toBase64(bytes: Uint8Array) { let binary = ""; for (let offset = 0; offset < bytes.length; offset += 0x8000) binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000)); return btoa(binary); }
function fromBase64(value: string) { const binary = atob(value); return Uint8Array.from(binary, (character) => character.charCodeAt(0)); }
function toHex(bytes: Uint8Array) { return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join(""); }
async function digest(bytes: Uint8Array) { return toHex(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes as BufferSource))); }
async function keyFor(passphrase: string, salt: Uint8Array) {
  if (passphrase.length < 12) throw new Error("Use at least 12 characters for the dedicated backup passphrase.");
  const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(passphrase), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations: ITERATIONS }, material, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}

function allowedKey(key: string) { return key === LOCAL_IDENTITY_STORAGE_KEY || key === LOCAL_WORKSPACE_STORAGE_KEY || key === LOCAL_BACKUP_METADATA_KEY || PROJECT_KEY.test(key) || SELECTION_KEY.test(key); }

function collectEntries(storage: EnumerableStorage) {
  const entries: Record<string, string> = {};
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index); if (!key || !allowedKey(key) || key === LOCAL_BACKUP_METADATA_KEY) continue;
    const value = storage.getItem(key); if (value !== null) entries[key] = value;
  }
  const identityRaw = entries[LOCAL_IDENTITY_STORAGE_KEY];
  if (identityRaw) {
    const identity = JSON.parse(identityRaw) as Record<string, unknown>;
    delete identity.session;
    entries[LOCAL_IDENTITY_STORAGE_KEY] = JSON.stringify(identity);
  }
  return entries;
}

function validateEntries(entries: Record<string, string>) {
  for (const key of Object.keys(entries)) if (!allowedKey(key) || key === LOCAL_BACKUP_METADATA_KEY) throw new Error(`Backup contains an unsupported storage key: ${key}`);
  if (!entries[LOCAL_IDENTITY_STORAGE_KEY] || !entries[LOCAL_WORKSPACE_STORAGE_KEY]) throw new Error("Backup is missing its identity or workspace governance boundary.");
  const identity = JSON.parse(entries[LOCAL_IDENTITY_STORAGE_KEY] || "{}") as { accounts?: unknown[]; verifiers?: Record<string, { salt?: string; digest?: string }>; session?: unknown };
  const accounts = (identity.accounts || []).map((item) => UserAccountSchema.parse(item));
  if (identity.session !== undefined) { SessionSchema.parse(identity.session); throw new Error("Backup must not contain an active local session."); }
  const verifiers = identity.verifiers || {};
  for (const account of accounts) if (!/^[a-f0-9]{32}$/.test(verifiers[account.id]?.salt || "") || !/^[a-f0-9]{64}$/.test(verifiers[account.id]?.digest || "")) throw new Error("Backup identity verifier integrity failed.");

  const governance = JSON.parse(entries[LOCAL_WORKSPACE_STORAGE_KEY] || "{}") as Record<string, unknown[]>;
  const organisations = (governance.organisations || []).map((item) => OrganisationSchema.parse(item));
  const memberships = (governance.memberships || []).map((item) => OrganisationMembershipSchema.parse(item));
  const invitations = (governance.invitations || []).map((item) => { const parsed = InvitationSchema.parse(item); const verifier = (item as { codeVerifier?: { salt?: string; digest?: string } }).codeVerifier; if (!/^[a-f0-9]{32}$/.test(verifier?.salt || "") || !/^[a-f0-9]{64}$/.test(verifier?.digest || "")) throw new Error("Backup invitation verifier integrity failed."); return parsed; });
  const projects = (governance.projects || []).map((item) => ProjectWorkspaceSchema.parse(item));
  const projectMemberships = (governance.projectMemberships || []).map((item) => ProjectMembershipSchema.parse(item));
  (governance.audit || []).forEach((item) => MembershipAuditEventSchema.parse(item));
  const accountIds = new Set(accounts.map((item) => item.id)); const organisationIds = new Set(organisations.map((item) => item.id)); const projectIds = new Set(projects.map((item) => item.id));
  if (memberships.some((item) => !accountIds.has(item.userId) || !organisationIds.has(item.organisationId))) throw new Error("Backup membership scope integrity failed.");
  if (invitations.some((item) => !organisationIds.has(item.organisationId))) throw new Error("Backup invitation scope integrity failed.");
  if (projects.some((item) => !organisationIds.has(item.organisationId))) throw new Error("Backup project scope integrity failed.");
  if (projectMemberships.some((item) => !accountIds.has(item.userId) || !organisationIds.has(item.organisationId) || !projectIds.has(item.projectId))) throw new Error("Backup project membership scope integrity failed.");
  let projectDocuments = 0;
  for (const [key, value] of Object.entries(entries)) {
    const match = key.match(PROJECT_KEY); if (!match) continue;
    const envelope = JSON.parse(value) as { contractVersion?: string; organisationId?: string; projectId?: string; document?: unknown };
    const project = projects.find((item) => item.id === match[2] && item.organisationId === match[1]);
    if (!project || envelope.contractVersion !== "project-data-1.0" || envelope.organisationId !== match[1] || envelope.projectId !== match[2]) throw new Error("Backup project document scope integrity failed.");
    migratePmoDocument(envelope.document); projectDocuments += 1;
  }
  return { accounts: accounts.length, organisations: organisations.length, projects: projects.length, projectDocuments, projectScopes: new Set(projects.map((item) => `${item.organisationId}:${item.id}`)) };
}

function validatePayload(payload: BackupPayload) { const result = validateEntries(payload.entries); if (payload.agentOperations.some((record) => !result.projectScopes.has(`${record.scope.organisationId}:${record.scope.projectId}`))) throw new Error("Backup agent operation scope integrity failed."); return result; }

export async function createEncryptedLocalBackup(storage: EnumerableStorage, passphrase: string, agentOperations: AgentOperationRecord[] = []) {
  const payload: BackupPayload = BackupPayloadSchema.parse({ contractVersion: LOCAL_BACKUP_CONTRACT_VERSION, exportedAt: new Date().toISOString(), entries: collectEntries(storage), agentOperations });
  validatePayload(payload);
  const salt = crypto.getRandomValues(new Uint8Array(16)); const iv = crypto.getRandomValues(new Uint8Array(12)); const key = await keyFor(passphrase, salt);
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(JSON.stringify(payload))));
  return JSON.stringify({ contractVersion: LOCAL_BACKUP_CONTRACT_VERSION, encryption: "PBKDF2-SHA256-AES-256-GCM", iterations: ITERATIONS, salt: toBase64(salt), iv: toBase64(iv), ciphertext: toBase64(ciphertext), ciphertextDigest: await digest(ciphertext) }, null, 2);
}

async function decryptBackup(serialized: string, passphrase: string): Promise<BackupPayload> {
  try {
    const envelope = EncryptedBackupSchema.parse(JSON.parse(serialized)); const ciphertext = fromBase64(envelope.ciphertext);
    if (await digest(ciphertext) !== envelope.ciphertextDigest) throw new Error("digest");
    const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromBase64(envelope.iv) }, await keyFor(passphrase, fromBase64(envelope.salt)), ciphertext);
    const payload = BackupPayloadSchema.parse(JSON.parse(new TextDecoder().decode(plaintext))); validatePayload(payload); return payload;
  } catch { throw new Error("The backup is invalid, corrupted or cannot be decrypted with this passphrase."); }
}

export async function previewEncryptedLocalBackup(storage: EnumerableStorage, serialized: string, passphrase: string): Promise<{ payload: BackupPayload; preview: BackupPreview }> {
  const payload = await decryptBackup(serialized, passphrase); const counts = validatePayload(payload);
  return { payload, preview: { exportedAt: payload.exportedAt, ...counts, agentOperations: payload.agentOperations.length, conflicts: Object.keys(collectEntries(storage)) } };
}

export async function restoreEncryptedLocalBackup(storage: EnumerableStorage, serialized: string, passphrase: string, conflictPolicy: "replace" | "empty_only" = "empty_only", restoreOperations?: (records: AgentOperationRecord[]) => Promise<void>) {
  const { payload, preview } = await previewEncryptedLocalBackup(storage, serialized, passphrase);
  if (conflictPolicy === "empty_only" && preview.conflicts.length) throw new Error("Local data already exists. Review conflicts and explicitly choose replacement.");
  const currentKeys = Object.keys(collectEntries(storage)); const affectedKeys = new Set([...currentKeys, ...Object.keys(payload.entries), LOCAL_BACKUP_METADATA_KEY]);
  const prior = new Map<string, string | null>(); for (const key of affectedKeys) prior.set(key, storage.getItem(key));
  try {
    if (conflictPolicy === "replace") for (const key of currentKeys) storage.removeItem(key);
    for (const [key, value] of Object.entries(payload.entries)) storage.setItem(key, value);
    storage.setItem(LOCAL_BACKUP_METADATA_KEY, JSON.stringify({ lastRestoredAt: new Date().toISOString(), sourceExportedAt: payload.exportedAt }));
    if (restoreOperations) await restoreOperations(payload.agentOperations);
  } catch (error) {
    for (const [key, value] of prior) { if (value === null) storage.removeItem(key); else storage.setItem(key, value); }
    throw error;
  }
  return preview;
}

export function localStorageStatus(storage: EnumerableStorage) {
  const entries = collectEntries(storage); const bytes = new TextEncoder().encode(Object.entries(entries).map(([key, value]) => key + value).join("")).byteLength;
  const metadata = storage.getItem(LOCAL_BACKUP_METADATA_KEY); let parsed: { lastBackupAt?: string; lastRestoredAt?: string } = {}; try { parsed = metadata ? JSON.parse(metadata) : {}; } catch { parsed = {}; }
  let accounts = 0; let organisations = 0; let projects = 0; try { const identity = JSON.parse(entries[LOCAL_IDENTITY_STORAGE_KEY] || "{}"); accounts = Array.isArray(identity.accounts) ? identity.accounts.length : 0; } catch {} try { const governance = JSON.parse(entries[LOCAL_WORKSPACE_STORAGE_KEY] || "{}"); organisations = Array.isArray(governance.organisations) ? governance.organisations.length : 0; projects = Array.isArray(governance.projects) ? governance.projects.length : 0; } catch {}
  return { keys: Object.keys(entries).length, bytes, metadata: parsed, inventory: { accounts, organisations, projects, projectDocuments: Object.keys(entries).filter((key) => PROJECT_KEY.test(key)).length } };
}

export function markLocalBackupCreated(storage: EnumerableStorage) { const existing = localStorageStatus(storage).metadata; storage.setItem(LOCAL_BACKUP_METADATA_KEY, JSON.stringify({ ...existing, lastBackupAt: new Date().toISOString() })); }
export function clearLocalWorkspaceStorage(storage: EnumerableStorage) { const keys: string[] = []; for (let index = 0; index < storage.length; index += 1) { const key = storage.key(index); if (key && allowedKey(key)) keys.push(key); } for (const key of keys) storage.removeItem(key); return keys.length; }
