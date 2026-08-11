import type { IdentityProvider, IdentityResult, InvitationAcceptance, RegistrationInput } from "./identity-provider";
import { SessionSchema, UserAccountSchema, WORKSPACE_CONTRACT_VERSION, type Session, type UserAccount } from "./workspace-schema";
import { createOpaqueId, deriveLocalVerifier, matchesLocalVerifier, type LocalVerifier } from "./local-secret-verifier";
import { LocalWorkspaceRepository } from "./local-workspace-repository";
import type { WorkspaceRepository } from "./workspace-repository";

export const LOCAL_IDENTITY_STORAGE_KEY = "oet:workspace:v1:identity";
const SESSION_HOURS = 8;

export type StorageBoundary = Pick<Storage, "getItem" | "setItem" | "removeItem">;
type LocalIdentityState = { accounts: UserAccount[]; verifiers: Record<string, LocalVerifier>; session?: Session };

function normaliseEmail(email: string) { return email.trim().toLowerCase(); }

export class LocalIdentityProvider implements IdentityProvider {
  private readonly workspace: WorkspaceRepository;
  constructor(private readonly storage: StorageBoundary, private readonly now: () => Date = () => new Date(), workspace?: WorkspaceRepository) { this.workspace = workspace || new LocalWorkspaceRepository(storage, now); }

  private read(): LocalIdentityState {
    const raw = this.storage.getItem(LOCAL_IDENTITY_STORAGE_KEY);
    if (!raw) return { accounts: [], verifiers: {} };
    try {
      const parsed = JSON.parse(raw) as LocalIdentityState;
      return {
        accounts: (parsed.accounts || []).map((item) => UserAccountSchema.parse(item)),
        verifiers: parsed.verifiers || {},
        session: parsed.session ? SessionSchema.parse(parsed.session) : undefined,
      };
    } catch {
      return { accounts: [], verifiers: {} };
    }
  }
  private write(state: LocalIdentityState) { this.storage.setItem(LOCAL_IDENTITY_STORAGE_KEY, JSON.stringify(state)); }
  private issueSession(state: LocalIdentityState, userId: string) {
    const issuedAt = this.now();
    const session = SessionSchema.parse({ contractVersion: WORKSPACE_CONTRACT_VERSION, id: createOpaqueId("ses"), userId, identityProvider: "local_development", issuedAt: issuedAt.toISOString(), expiresAt: new Date(issuedAt.getTime() + SESSION_HOURS * 60 * 60 * 1000).toISOString() });
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
    const account = UserAccountSchema.parse({ contractVersion: WORKSPACE_CONTRACT_VERSION, id: createOpaqueId("usr"), email, displayName: input.displayName.trim(), status: "active", createdAt: stamp, updatedAt: stamp });
    state.accounts.push(account);
    state.verifiers[account.id] = await deriveLocalVerifier(input.password);
    return { account, session: this.issueSession(state, account.id) };
  }

  async signIn(emailInput: string, password: string): Promise<IdentityResult> {
    const state = this.read();
    const account = state.accounts.find((item) => item.email === normaliseEmail(emailInput) && item.status === "active");
    const verifier = account ? state.verifiers[account.id] : undefined;
    if (!account || !verifier || !(await matchesLocalVerifier(password, verifier))) throw new Error("Email or password is not valid.");
    return { account, session: this.issueSession(state, account.id) };
  }

  async signOut() { const state = this.read(); delete state.session; this.write(state); }

  async changePassword(currentPassword: string, newPassword: string) {
    const state = this.read();
    const session = state.session;
    const account = session && new Date(session.expiresAt).getTime() > this.now().getTime() ? state.accounts.find((item) => item.id === session.userId && item.status === "active") : undefined;
    const verifier = account ? state.verifiers[account.id] : undefined;
    if (!account || !verifier || !(await matchesLocalVerifier(currentPassword, verifier))) throw new Error("The current local password is not valid.");
    if (newPassword.length < 10) throw new Error("Use at least 10 characters for the new local password.");
    if (newPassword === currentPassword) throw new Error("Choose a different local password.");
    state.verifiers[account.id] = await deriveLocalVerifier(newPassword);
    account.updatedAt = this.now().toISOString();
    this.write(state);
  }

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

  async acceptInvitation(code: string): Promise<InvitationAcceptance> {
    const active = await this.currentSession();
    if (!active) throw new Error("Sign in before accepting an invitation.");
    const accepted = await this.workspace.acceptInvitation(active.account, code);
    return { account: active.account, ...accepted, session: active.session };
  }
}
