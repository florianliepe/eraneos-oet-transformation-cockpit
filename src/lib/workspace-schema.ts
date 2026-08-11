import { z } from "zod";

export const WORKSPACE_CONTRACT_VERSION = "workspace-identity-1.0" as const;
const OpaqueIdSchema = z.string().min(8).max(160).regex(/^[a-zA-Z0-9:_-]+$/);
const DateTimeSchema = z.string().datetime();
export const WorkspaceRoleSchema = z.enum(["owner", "portfolio_lead", "project_lead", "contributor", "viewer"]);

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
export type OrganisationMembership = z.infer<typeof OrganisationMembershipSchema>;
export type Invitation = z.infer<typeof InvitationSchema>;
export type Session = z.infer<typeof SessionSchema>;
export type WorkspaceRole = z.infer<typeof WorkspaceRoleSchema>;
