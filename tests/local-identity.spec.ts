import { expect, test } from "@playwright/test";
import { LocalIdentityProvider, LOCAL_IDENTITY_STORAGE_KEY, type StorageBoundary } from "../src/lib/local-identity-provider";
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
  const provider = new LocalIdentityProvider(storage, () => new Date("2026-08-11T10:00:00.000Z"));
  const identity = await provider.register({ displayName: "Sam Owner", email: "sam@example.com", password: "invited-local-password", termsAccepted: true });
  await provider.provisionInvitation({ organisationId: "org_demo01", email: "sam@example.com", role: "owner", invitedByUserId: identity.account.id, expiresAt: "2026-08-12T10:00:00.000Z", code: "valid-code-2026" });
  await provider.provisionInvitation({ organisationId: "org_demo02", email: "sam@example.com", role: "viewer", invitedByUserId: identity.account.id, expiresAt: "2026-08-10T10:00:00.000Z", code: "expired-code-2026" });
  const accepted = await provider.acceptInvitation("valid-code-2026");
  expect(accepted.membership).toMatchObject({ organisationId: "org_demo01", role: "owner", invitationId: accepted.invitation.id });
  await expect(provider.acceptInvitation("expired-code-2026")).rejects.toThrow("not valid or is no longer available");
  await expect(provider.acceptInvitation("unknown-code-2026")).rejects.toThrow("not valid or is no longer available");
});
