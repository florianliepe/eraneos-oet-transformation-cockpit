import { expect, test } from "@playwright/test";
import { LocalIdentityProvider, LOCAL_IDENTITY_STORAGE_KEY, type StorageBoundary } from "../src/lib/local-identity-provider";
import { LocalWorkspaceRepository, LOCAL_WORKSPACE_STORAGE_KEY } from "../src/lib/local-workspace-repository";
import { WORKSPACE_CONTRACT_VERSION } from "../src/lib/workspace-schema";

class MemoryStorage implements StorageBoundary {
  values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}

test("registers, signs in and stores no plaintext password", async () => {
  const storage = new MemoryStorage();
  const provider = new LocalIdentityProvider(storage, () => new Date("2026-08-11T10:00:00.000Z"));
  const registered = await provider.register({ displayName: "Alex Morgan", email: "Alex@example.com", password: "local-demo-password", termsAccepted: true });
  expect(registered.account.contractVersion).toBe(WORKSPACE_CONTRACT_VERSION);
  expect(registered.account.email).toBe("alex@example.com");
  expect(storage.getItem(LOCAL_IDENTITY_STORAGE_KEY)).not.toContain("local-demo-password");
  await provider.signOut();
  await expect(provider.signIn("alex@example.com", "wrong-password")).rejects.toThrow("Email or password is not valid.");
  expect((await provider.signIn("alex@example.com", "local-demo-password")).account.id).toBe(registered.account.id);
});

test("rejects duplicate accounts and clears expired sessions", async () => {
  const storage = new MemoryStorage();
  let now = new Date("2026-08-11T10:00:00.000Z");
  const provider = new LocalIdentityProvider(storage, () => now);
  const input = { displayName: "Jamie Lee", email: "jamie@example.com", password: "another-local-password", termsAccepted: true };
  await provider.register(input);
  await expect(provider.register(input)).rejects.toThrow("already exists");
  now = new Date("2026-08-11T18:00:01.000Z");
  expect(await provider.currentSession()).toBeNull();
});

test("accepts an email-bound invitation and rejects expired or mismatched codes", async () => {
  const storage = new MemoryStorage();
  const clock = () => new Date("2026-08-11T10:00:00.000Z");
  const workspace = new LocalWorkspaceRepository(storage, clock);
  const provider = new LocalIdentityProvider(storage, clock, workspace);
  const identity = await provider.register({ displayName: "Sam Owner", email: "sam@example.com", password: "invited-local-password", termsAccepted: true });
  const { organisation } = await workspace.createOrganisation(identity.account, "Invitation test");
  const valid = await workspace.createInvitation(organisation.id, identity.account.id, "sam@example.com", "viewer");
  const expired = await workspace.createInvitation(organisation.id, identity.account.id, "sam@example.com", "viewer");
  const stored = JSON.parse(storage.getItem(LOCAL_WORKSPACE_STORAGE_KEY)!) as { invitations: Array<{ id: string; expiresAt: string }> };
  stored.invitations.find((item) => item.id === expired.invitation.id)!.expiresAt = "2026-08-10T10:00:00.000Z";
  storage.setItem(LOCAL_WORKSPACE_STORAGE_KEY, JSON.stringify(stored));
  const accepted = await provider.acceptInvitation(valid.code);
  expect(accepted.membership).toMatchObject({ organisationId: organisation.id, role: "viewer", invitationId: accepted.invitation.id });
  await expect(provider.acceptInvitation(expired.code)).rejects.toThrow("not valid or is no longer available");
  await expect(provider.acceptInvitation("unknown-code-2026")).rejects.toThrow("not valid or is no longer available");
});
