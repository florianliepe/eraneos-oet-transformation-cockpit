import type { DevelopmentIdentityAdministration, IdentityProvider, IdentityResult, InvitationAcceptance, RegistrationInput } from "./identity-provider";
import { InvitationSchema, OrganisationMembershipSchema, SessionSchema, UserAccountSchema, WORKSPACE_CONTRACT_VERSION, type Invitation, type OrganisationMembership, type Session, type UserAccount } from "./workspace-schema";

export const LOCAL_IDENTITY_STORAGE_KEY = "oet:workspace:v1:identity";
const ITERATIONS = 120_000;
const SESSION_HOURS = 8;
const encoder = new TextEncoder();

export type StorageBoundary = Pick<Storage, "getItem" | "setItem" | "removeItem">;
type Verifier = { salt: string; digest: string };
type StoredInvitation = Invitation & { codeVerifier: Verifier };
type LocalIdentityState = { accounts: UserAccount[]; verifiers: Record<string, Verifier>; invitations: StoredInvitation[]; memberships: OrganisationMembership[]; session?: Session };

function randomId(prefix: string) {
  const bytes = crypto.getRandomValues(new Uint8Array(18));
  return `${prefix}_${Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("")}`;
}
function normaliseEmail(email: string) { return email.trim().toLowerCase(); }
function bytesToHex(bytes: Uint8Array) { return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join(""); }

async function deriveVerifier(secret: string, saltHex?: string): Promise<Verifier> {
  const salt = saltHex ? Uint8Array.from(saltHex.match(/.{2}/g) || [], (value) => parseInt(value, 16)) : crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), "PBKDF2", false, ["deriveBits"]);
  const digest = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: ITERATIONS }, key, 256);
  return { salt: bytesToHex(salt), digest: bytesToHex(new Uint8Array(digest)) };
}
async function matchesVerifier(secret: string, verifier: Verifier) {
  const candidate = await deriveVerifier(secret, verifier.salt);
  if (candidate.digest.length !== verifier.digest.length) return false;
  let difference = 0;
  for (let index = 0; index < candidate.digest.length; index += 1) difference |= candidate.digest.charCodeAt(index) ^ verifier.digest.charCodeAt(index);
  return difference === 0;
}

export class LocalIdentityProvider implements IdentityProvider, DevelopmentIdentityAdministration {
  constructor(private readonly storage: StorageBoundary, private readonly now: () => Date = () => new Date()) {}

  private read(): LocalIdentityState {
    const raw = this.storage.getItem(LOCAL_IDENTITY_STORAGE_KEY);
    if (!raw) return { accounts: [], verifiers: {}, invitations: [], memberships: [] };
    try {
      const parsed = JSON.parse(raw) as LocalIdentityState;
      return {
        accounts: (parsed.accounts || []).map((item) => UserAccountSchema.parse(item)),
        verifiers: parsed.verifiers || {},
        invitations: (parsed.invitations || []).map((item) => ({ ...InvitationSchema.parse(item), codeVerifier: item.codeVerifier })),
        memberships: (parsed.memberships || []).map((item) => OrganisationMembershipSchema.parse(item)),
        session: parsed.session ? SessionSchema.parse(parsed.session) : undefined,
      };
    } catch {
      return { accounts: [], verifiers: {}, invitations: [], memberships: [] };
    }
  }
  private write(state: LocalIdentityState) { this.storage.setItem(LOCAL_IDENTITY_STORAGE_KEY, JSON.stringify(state)); }
  private issueSession(state: LocalIdentityState, userId: string) {
    const issuedAt = this.now();
    const session = SessionSchema.parse({ contractVersion: WORKSPACE_CONTRACT_VERSION, id: randomId("ses"), userId, identityProvider: "local_development", issuedAt: issuedAt.toISOString(), expiresAt: new Date(issuedAt.getTime() + SESSION_HOURS * 60 * 60 * 1000).toISOString() });
    state.session = session;
    this.write(state);
    return session;
  }

  async register(input: RegistrationInput): Promise<IdentityResult> {
    const state = this.read();
    const email = normaliseEmail(input.email);
    if (!input.termsAccepted) throw new Error("Accept the applicable terms to create an account.");
    if (input.password.length < 10) throw new Error("Use at least 10 characters for the local demonstration password.");
    if (state.accounts.some((account) => account.email === email)) throw new Error("An account already exists for this email.");
    const stamp = this.now().toISOString();
    const account = UserAccountSchema.parse({ contractVersion: WORKSPACE_CONTRACT_VERSION, id: randomId("usr"), email, displayName: input.displayName.trim(), status: "active", createdAt: stamp, updatedAt: stamp });
    state.accounts.push(account);
    state.verifiers[account.id] = await deriveVerifier(input.password);
    return { account, session: this.issueSession(state, account.id) };
  }

  async signIn(emailInput: string, password: string): Promise<IdentityResult> {
    const state = this.read();
    const account = state.accounts.find((item) => item.email === normaliseEmail(emailInput) && item.status === "active");
    const verifier = account ? state.verifiers[account.id] : undefined;
    if (!account || !verifier || !(await matchesVerifier(password, verifier))) throw new Error("Email or password is not valid.");
    return { account, session: this.issueSession(state, account.id) };
  }

  async signOut() { const state = this.read(); delete state.session; this.write(state); }

  async currentSession(): Promise<IdentityResult | null> {
    const state = this.read();
    if (!state.session || new Date(state.session.expiresAt).getTime() <= this.now().getTime()) {
      if (state.session) { delete state.session; this.write(state); }
      return null;
    }
    const account = state.accounts.find((item) => item.id === state.session?.userId && item.status === "active");
    if (!account) return null;
    return { account, session: state.session };
  }

  async provisionInvitation(input: { organisationId: string; email: string; role: Invitation["role"]; invitedByUserId: string; expiresAt: string; code: string }) {
    const state = this.read();
    const stamp = this.now().toISOString();
    const invitation = InvitationSchema.parse({ contractVersion: WORKSPACE_CONTRACT_VERSION, id: randomId("inv"), organisationId: input.organisationId, email: normaliseEmail(input.email), role: input.role, invitedByUserId: input.invitedByUserId, status: "pending", expiresAt: input.expiresAt, createdAt: stamp });
    state.invitations.push({ ...invitation, codeVerifier: await deriveVerifier(input.code) });
    this.write(state);
    return invitation;
  }

  async acceptInvitation(code: string): Promise<InvitationAcceptance> {
    const active = await this.currentSession();
    if (!active) throw new Error("Sign in before accepting an invitation.");
    const refreshed = this.read();
    let match: StoredInvitation | undefined;
    for (const invitation of refreshed.invitations.filter((item) => item.status === "pending")) if (await matchesVerifier(code, invitation.codeVerifier)) { match = invitation; break; }
    if (!match || match.email !== active.account.email || new Date(match.expiresAt).getTime() <= this.now().getTime()) throw new Error("The invitation is not valid or is no longer available.");
    const stamp = this.now().toISOString();
    match.status = "accepted"; match.acceptedAt = stamp;
    const membership = OrganisationMembershipSchema.parse({ contractVersion: WORKSPACE_CONTRACT_VERSION, id: randomId("mem"), organisationId: match.organisationId, userId: active.account.id, role: match.role, status: "active", invitationId: match.id, createdAt: stamp, updatedAt: stamp });
    refreshed.memberships.push(membership); refreshed.session = active.session; this.write(refreshed);
    return { account: active.account, invitation: InvitationSchema.parse(match), membership, session: active.session };
  }
}
