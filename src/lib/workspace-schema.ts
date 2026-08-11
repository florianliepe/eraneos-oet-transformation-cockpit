import { z } from "zod";

export const WORKSPACE_CONTRACT_VERSION = "workspace-identity-1.0" as const;
const OpaqueIdSchema = z.string().min(8).max(160).regex(/^[a-zA-Z0-9:_-]+$/);
const DateTimeSchema = z.string().datetime();
export const WorkspaceRoleSchema = z.enum(["owner", "portfolio_lead", "project_lead", "contributor", "viewer"]);

export const OrganisationSchema = z.object({
  contractVersion: z.literal(WORKSPACE_CONTRACT_VERSION),
  id: OpaqueIdSchema,
  name: z.string().min(2).max(120),
  slug: z.string().min(2).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  status: z.enum(["active", "archived"]),
  createdByUserId: OpaqueIdSchema,
  createdAt: DateTimeSchema,
  updatedAt: DateTimeSchema,
});

export const MembershipAuditEventSchema = z.object({
  contractVersion: z.literal(WORKSPACE_CONTRACT_VERSION),
  id: OpaqueIdSchema,
  organisationId: OpaqueIdSchema,
  actorUserId: OpaqueIdSchema,
  event: z.enum(["organisation.created", "invitation.created", "invitation.revoked", "invitation.accepted", "membership.role_changed", "membership.removed"]),
  targetId: OpaqueIdSchema,
  at: DateTimeSchema,
  detail: z.string().max(240),
});

export const UserAccountSchema = z.object({
  contractVersion: z.literal(WORKSPACE_CONTRACT_VERSION),
  id: OpaqueIdSchema,
  email: z.string().email(),
  displayName: z.string().min(2).max(120),
  status: z.enum(["active", "suspended"]),
  createdAt: DateTimeSchema,
  updatedAt: DateTimeSchema,
});

export const OrganisationMembershipSchema = z.object({
  contractVersion: z.literal(WORKSPACE_CONTRACT_VERSION),
  id: OpaqueIdSchema,
  organisationId: OpaqueIdSchema,
  userId: OpaqueIdSchema,
  role: WorkspaceRoleSchema,
  status: z.enum(["active", "suspended"]),
  invitationId: OpaqueIdSchema.optional(),
  createdAt: DateTimeSchema,
  updatedAt: DateTimeSchema,
});

export const InvitationSchema = z.object({
  contractVersion: z.literal(WORKSPACE_CONTRACT_VERSION),
  id: OpaqueIdSchema,
  organisationId: OpaqueIdSchema,
  email: z.string().email(),
  role: WorkspaceRoleSchema,
  invitedByUserId: OpaqueIdSchema,
  status: z.enum(["pending", "accepted", "revoked", "expired"]),
  expiresAt: DateTimeSchema,
  acceptedAt: DateTimeSchema.optional(),
  createdAt: DateTimeSchema,
});

export const SessionSchema = z.object({
  contractVersion: z.literal(WORKSPACE_CONTRACT_VERSION),
  id: OpaqueIdSchema,
  userId: OpaqueIdSchema,
  identityProvider: z.literal("local_development"),
  issuedAt: DateTimeSchema,
  expiresAt: DateTimeSchema,
});

export type UserAccount = z.infer<typeof UserAccountSchema>;
export type Organisation = z.infer<typeof OrganisationSchema>;
export type OrganisationMembership = z.infer<typeof OrganisationMembershipSchema>;
export type MembershipAuditEvent = z.infer<typeof MembershipAuditEventSchema>;
export type Invitation = z.infer<typeof InvitationSchema>;
export type Session = z.infer<typeof SessionSchema>;
export type WorkspaceRole = z.infer<typeof WorkspaceRoleSchema>;
