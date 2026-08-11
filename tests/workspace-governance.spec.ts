import { expect, test } from "@playwright/test";
import { LocalIdentityProvider, type StorageBoundary } from "../src/lib/local-identity-provider";
import { LocalWorkspaceRepository } from "../src/lib/local-workspace-repository";
import { WorkspaceAuthorisationService } from "../src/lib/authorisation-service";

class MemoryStorage implements StorageBoundary {
  values = new Map<string, string>(); getItem(key: string) { return this.values.get(key) ?? null; } setItem(key: string, value: string) { this.values.set(key, value); } removeItem(key: string) { this.values.delete(key); }
}
const clock = () => new Date("2026-08-11T12:00:00.000Z");

test("creates an organisation with one owner and enforces the last-owner invariant", async () => {
  const storage = new MemoryStorage(); const repo = new LocalWorkspaceRepository(storage, clock); const identity = new LocalIdentityProvider(storage, clock, repo);
  const owner = (await identity.register({ displayName: "First Owner", email: "first@example.com", password: "first-owner-password", termsAccepted: true })).account;
  const created = await repo.createOrganisation(owner, "OET Transformation Office");
  expect(created.membership.role).toBe("owner");
  await expect(repo.updateMembershipRole(created.organisation.id, owner.id, created.membership.id, "viewer")).rejects.toThrow("at least one active owner");
  await expect(repo.removeMembership(created.organisation.id, owner.id, created.membership.id)).rejects.toThrow("at least one active owner");
});

test("supports a second owner through a one-time invitation and audits governance changes", async () => {
  const storage = new MemoryStorage(); const repo = new LocalWorkspaceRepository(storage, clock); const identity = new LocalIdentityProvider(storage, clock, repo);
  const first = (await identity.register({ displayName: "First Owner", email: "first@example.com", password: "first-owner-password", termsAccepted: true })).account;
  const created = await repo.createOrganisation(first, "Shared Workspace");
  const issued = await repo.createInvitation(created.organisation.id, first.id, "second@example.com", "owner");
  await identity.signOut();
  const secondIdentity = await identity.register({ displayName: "Second Owner", email: "second@example.com", password: "second-owner-password", termsAccepted: true });
  const accepted = await identity.acceptInvitation(issued.code);
  const members = await repo.listMemberships(created.organisation.id, secondIdentity.account.id);
  expect(members.filter((item) => item.role === "owner")).toHaveLength(2);
  await repo.updateMembershipRole(created.organisation.id, secondIdentity.account.id, created.membership.id, "portfolio_lead");
  expect((await repo.listAudit(created.organisation.id, secondIdentity.account.id)).map((item) => item.event)).toEqual(expect.arrayContaining(["organisation.created", "invitation.created", "invitation.accepted", "membership.role_changed"]));
  expect(accepted.membership.role).toBe("owner");
});

test("denies access by default and limits role assignment authority", async () => {
  const service = new WorkspaceAuthorisationService();
  expect(service.evaluate(undefined, "organisation.read")).toMatchObject({ allowed: false, code: "MEMBERSHIP_REQUIRED" });
  expect(service.canAssignRole("portfolio_lead", "owner")).toMatchObject({ allowed: false, code: "ROLE_ASSIGNMENT_DENIED" });
  expect(service.canAssignRole("portfolio_lead", "project_lead")).toMatchObject({ allowed: true });
});

test("rejects cross-organisation project discovery", async () => {
  const storage = new MemoryStorage(); const repo = new LocalWorkspaceRepository(storage, clock); const identity = new LocalIdentityProvider(storage, clock, repo);
  const owner = (await identity.register({ displayName: "Owner", email: "owner@example.com", password: "owner-local-password", termsAccepted: true })).account;
  const outsider = (await identity.register({ displayName: "Outsider", email: "outsider@example.com", password: "outsider-password", termsAccepted: true })).account;
  const { organisation } = await repo.createOrganisation(owner, "Private Portfolio"); await repo.createProject(organisation.id, owner.id, "Restricted Project");
  await expect(repo.listProjects(organisation.id, outsider.id)).rejects.toThrow("Active organisation membership is required");
});
