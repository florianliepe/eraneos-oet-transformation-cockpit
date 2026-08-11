import type { Invitation, OrganisationMembership, Session, UserAccount, WorkspaceRole } from "./workspace-schema";

export type RegistrationInput = { displayName: string; email: string; password: string; termsAccepted: boolean };
export type IdentityResult = { account: UserAccount; session: Session };
export type InvitationAcceptance = { account: UserAccount; invitation: Invitation; membership: OrganisationMembership; session: Session };

export interface IdentityProvider {
  register(input: RegistrationInput): Promise<IdentityResult>;
  signIn(email: string, password: string): Promise<IdentityResult>;
  signOut(): Promise<void>;
  currentSession(): Promise<IdentityResult | null>;
  acceptInvitation(code: string): Promise<InvitationAcceptance>;
}

export interface DevelopmentIdentityAdministration {
  provisionInvitation(input: { organisationId: string; email: string; role: WorkspaceRole; invitedByUserId: string; expiresAt: string; code: string }): Promise<Invitation>;
}
