import { expect, test } from "@playwright/test";
import { LocalIdentityProvider, type StorageBoundary } from "../src/lib/local-identity-provider";
import { LocalWorkspaceRepository } from "../src/lib/local-workspace-repository";
import { LocalProjectDataRepository, projectDataKey } from "../src/lib/local-project-data-repository";
import { bootstrapPmoData } from "../src/lib/pmo-fixtures";
import { createEncryptedLocalBackup, previewEncryptedLocalBackup, restoreEncryptedLocalBackup, type EnumerableStorage } from "../src/lib/local-workspace-backup";

class MemoryStorage implements StorageBoundary, EnumerableStorage {
  values = new Map<string, string>();
  get length() { return this.values.size; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}

async function populatedStorage() {
  const storage = new MemoryStorage(); const workspace = new LocalWorkspaceRepository(storage); const identity = new LocalIdentityProvider(storage, () => new Date("2026-08-11T10:00:00.000Z"), workspace);
  const account = (await identity.register({ displayName: "Backup Owner", email: "backup@example.com", password: "original-local-password", termsAccepted: true })).account;
  const { organisation } = await workspace.createOrganisation(account, "Backup Portfolio"); const project = await workspace.createProject(organisation.id, account.id, "Backup Project");
  const scope = { organisationId: organisation.id, projectId: project.id, projectName: project.name }; const document = structuredClone(bootstrapPmoData); document.project.id = project.id; document.project.name = project.name; document.project.subtitle = "Backup-specific governed state"; await new LocalProjectDataRepository(storage).save(scope, document);
  return { storage, account, organisation, project };
}

test("encrypts and restores accounts, organisation governance and isolated PMO data", async () => {
  const source = await populatedStorage(); const serialized = await createEncryptedLocalBackup(source.storage, "dedicated-backup-passphrase");
  expect(serialized).not.toContain("backup@example.com"); expect(serialized).not.toContain("original-local-password"); expect(serialized).not.toContain("Backup-specific governed state");
  const target = new MemoryStorage(); const { preview } = await previewEncryptedLocalBackup(target, serialized, "dedicated-backup-passphrase");
  expect(preview).toMatchObject({ accounts: 1, organisations: 1, projects: 1, projectDocuments: 1, conflicts: [] });
  await restoreEncryptedLocalBackup(target, serialized, "dedicated-backup-passphrase");
  const restoredIdentity = new LocalIdentityProvider(target); expect(await restoredIdentity.currentSession()).toBeNull();
  await expect(restoredIdentity.signIn("backup@example.com", "original-local-password")).resolves.toBeTruthy();
  expect(target.getItem(projectDataKey({ organisationId: source.organisation.id, projectId: source.project.id, projectName: source.project.name }))).toContain("Backup-specific governed state");
});

test("rejects wrong passphrases, corruption and implicit replacement", async () => {
  const source = await populatedStorage(); const serialized = await createEncryptedLocalBackup(source.storage, "dedicated-backup-passphrase");
  await expect(previewEncryptedLocalBackup(new MemoryStorage(), serialized, "incorrect-backup-passphrase")).rejects.toThrow("invalid, corrupted");
  const corrupted = serialized.replace(/"ciphertext": "(.{8})/, '"ciphertext": "$1Z'); await expect(previewEncryptedLocalBackup(new MemoryStorage(), corrupted, "dedicated-backup-passphrase")).rejects.toThrow("invalid, corrupted");
  const preview = await previewEncryptedLocalBackup(source.storage, serialized, "dedicated-backup-passphrase"); expect(preview.preview.conflicts.length).toBeGreaterThan(0);
  await expect(restoreEncryptedLocalBackup(source.storage, serialized, "dedicated-backup-passphrase")).rejects.toThrow("Local data already exists");
  await expect(restoreEncryptedLocalBackup(source.storage, serialized, "dedicated-backup-passphrase", "replace")).resolves.toBeTruthy();
});

test("rejects a project document whose key does not resolve to governed project scope", async () => {
  const source = await populatedStorage(); const validKey = [...source.storage.values.keys()].find((key) => key.endsWith(":pmo"))!; const value = source.storage.getItem(validKey)!;
  source.storage.removeItem(validKey); source.storage.setItem("oet:workspace:v1:organisation:org_wrong:project:prj_wrong:pmo", value);
  await expect(createEncryptedLocalBackup(source.storage, "dedicated-backup-passphrase")).rejects.toThrow("project document scope integrity");
});
