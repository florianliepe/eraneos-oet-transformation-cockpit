import type { Invitation, MembershipAuditEvent, Organisation, OrganisationMembership, ProjectWorkspace, UserAccount, WorkspaceRole } from "./workspace-schema";

export type IssuedInvitation = { invitation: Invitation; code: string };
export interface WorkspaceRepository {
  createOrganisation(actor: UserAccount, name: string): Promise<{ organisation: Organisation; membership: OrganisationMembership }>;
  listOrganisations(userId: string): Promise<Organisation[]>;
  listMemberships(organisationId: string, actorUserId: string): Promise<OrganisationMembership[]>;
  listInvitations(organisationId: string, actorUserId: string): Promise<Invitation[]>;
  createInvitation(organisationId: string, actorUserId: string, email: string, role: WorkspaceRole): Promise<IssuedInvitation>;
  revokeInvitation(organisationId: string, actorUserId: string, invitationId: string): Promise<Invitation>;
  acceptInvitation(account: UserAccount, code: string): Promise<{ invitation: Invitation; membership: OrganisationMembership }>;
  updateMembershipRole(organisationId: string, actorUserId: string, membershipId: string, role: WorkspaceRole): Promise<OrganisationMembership>;
  removeMembership(organisationId: string, actorUserId: string, membershipId: string): Promise<void>;
  listAudit(organisationId: string, actorUserId: string): Promise<MembershipAuditEvent[]>;
  listProjects(organisationId: string, actorUserId: string, includeArchived?: boolean): Promise<ProjectWorkspace[]>;
  createProject(organisationId: string, actorUserId: string, name: string): Promise<ProjectWorkspace>;
  renameProject(organisationId: string, actorUserId: string, projectId: string, name: string): Promise<ProjectWorkspace>;
  archiveProject(organisationId: string, actorUserId: string, projectId: string): Promise<ProjectWorkspace>;
  restoreProject(organisationId: string, actorUserId: string, projectId: string): Promise<ProjectWorkspace>;
}
