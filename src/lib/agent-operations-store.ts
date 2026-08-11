import { AgentOperationRecordSchema, type AgentOperationRecord } from "@/lib/agent-operations";

const DATABASE_NAME = "eraneos-transformation-cockpit-operations";
const DATABASE_VERSION = 1;
const RECORDS_STORE = "run-records";
const INPUTS_STORE = "recovery-inputs";

export type RecoverySubmission = {
  meta: Record<string, string>;
  files: File[];
  textUpdate: string;
};

type EncryptedRecoveryInput = {
  ref: string;
  salt: string;
  iv: string;
  ciphertext: string;
  storedAt: string;
};

type SerializedRecoverySubmission = {
  meta: Record<string, string>;
  textUpdate: string;
  files: Array<{ name: string; type: string; lastModified: number; bytes: string }>;
};

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(RECORDS_STORE)) database.createObjectStore(RECORDS_STORE, { keyPath: "executionId" });
      if (!database.objectStoreNames.contains(INPUTS_STORE)) database.createObjectStore(INPUTS_STORE, { keyPath: "ref" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Unable to open the agent operations store."));
  });
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Agent operations storage failed."));
  });
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  return btoa(binary);
}

function base64ToBytes(value: string) {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function encryptionKey(secret: string, salt: Uint8Array) {
  const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations: 210_000 }, material, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}

export async function listAgentOperationRecords(scope: { organisationId: string; projectId: string }): Promise<AgentOperationRecord[]> {
  const database = await openDatabase();
  try {
    const raw = await requestResult(database.transaction(RECORDS_STORE, "readonly").objectStore(RECORDS_STORE).getAll());
    return raw.flatMap((item) => { const parsed = AgentOperationRecordSchema.safeParse(item); return parsed.success && parsed.data.scope.organisationId === scope.organisationId && parsed.data.scope.projectId === scope.projectId ? [parsed.data] : []; }).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } finally { database.close(); }
}

export async function saveAgentOperationRecord(record: AgentOperationRecord) {
  const parsed = AgentOperationRecordSchema.parse(record);
  const database = await openDatabase();
  try { await requestResult(database.transaction(RECORDS_STORE, "readwrite").objectStore(RECORDS_STORE).put(parsed)); }
  finally { database.close(); }
}

export async function saveEncryptedRecoveryInput(secret: string, ref: string, submission: RecoverySubmission) {
  if (!secret.trim()) throw new Error("The workspace credential is required to encrypt recovery input.");
  const serialized: SerializedRecoverySubmission = {
    meta: submission.meta,
    textUpdate: submission.textUpdate,
    files: await Promise.all(submission.files.map(async (file) => ({
      name: file.name,
      type: file.type,
      lastModified: file.lastModified,
      bytes: bytesToBase64(new Uint8Array(await file.arrayBuffer())),
    }))),
  };
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await encryptionKey(secret, salt);
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(JSON.stringify(serialized))));
  const payload: EncryptedRecoveryInput = { ref, salt: bytesToBase64(salt), iv: bytesToBase64(iv), ciphertext: bytesToBase64(ciphertext), storedAt: new Date().toISOString() };
  const database = await openDatabase();
  try { await requestResult(database.transaction(INPUTS_STORE, "readwrite").objectStore(INPUTS_STORE).put(payload)); }
  finally { database.close(); }
}

export async function loadEncryptedRecoveryInput(secret: string, ref: string): Promise<RecoverySubmission> {
  const database = await openDatabase();
  let payload: EncryptedRecoveryInput | undefined;
  try { payload = await requestResult(database.transaction(INPUTS_STORE, "readonly").objectStore(INPUTS_STORE).get(ref)); }
  finally { database.close(); }
  if (!payload) throw new Error("The encrypted original input is unavailable on this device. Reattach the evidence to continue.");
  try {
    const salt = base64ToBytes(payload.salt);
    const iv = base64ToBytes(payload.iv);
    const key = await encryptionKey(secret, salt);
    const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, base64ToBytes(payload.ciphertext));
    const decoded = JSON.parse(new TextDecoder().decode(plaintext)) as SerializedRecoverySubmission;
    return {
      meta: decoded.meta,
      textUpdate: decoded.textUpdate,
      files: decoded.files.map((file) => new File([base64ToBytes(file.bytes)], file.name, { type: file.type, lastModified: file.lastModified })),
    };
  } catch {
    throw new Error("The recovery input could not be decrypted with this workspace credential.");
  }
}
