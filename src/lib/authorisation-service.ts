import type { OrganisationMembership, WorkspaceRole } from "./workspace-schema";

export type OrganisationPermission = "organisation.read" | "organisation.manage" | "invitation.create" | "membership.manage" | "project.create";
export type AuthorisationDecision = { allowed: boolean; code: string; reason: string };
const grants: Record<WorkspaceRole, OrganisationPermission[]> = {
  owner: ["organisation.read", "organisation.manage", "invitation.create", "membership.manage", "project.create"],
  portfolio_lead: ["organisation.read", "invitation.create", "project.create"],
  project_lead: ["organisation.read"], contributor: ["organisation.read"], viewer: ["organisation.read"],
};
const roleRank: Record<WorkspaceRole, number> = { viewer: 1, contributor: 2, project_lead: 3, portfolio_lead: 4, owner: 5 };

export interface AuthorisationService {
  evaluate(membership: OrganisationMembership | undefined, permission: OrganisationPermission): AuthorisationDecision;
  canAssignRole(actorRole: WorkspaceRole, targetRole: WorkspaceRole): AuthorisationDecision;
}

export class WorkspaceAuthorisationService implements AuthorisationService {
  evaluate(membership: OrganisationMembership | undefined, permission: OrganisationPermission): AuthorisationDecision {
    if (!membership || membership.status !== "active") return { allowed: false, code: "MEMBERSHIP_REQUIRED", reason: "Active organisation membership is required." };
    if (!grants[membership.role].includes(permission)) return { allowed: false, code: "PERMISSION_DENIED", reason: `${membership.role} cannot perform ${permission}.` };
    return { allowed: true, code: "ALLOWED", reason: "Permission granted by active organisation role." };
  }
  canAssignRole(actorRole: WorkspaceRole, targetRole: WorkspaceRole): AuthorisationDecision {
    if (actorRole === "owner" || (actorRole === "portfolio_lead" && roleRank[targetRole] <= roleRank.project_lead)) return { allowed: true, code: "ALLOWED", reason: "Role assignment is within the actor's authority." };
    return { allowed: false, code: "ROLE_ASSIGNMENT_DENIED", reason: `${actorRole} cannot assign ${targetRole}.` };
  }
}
