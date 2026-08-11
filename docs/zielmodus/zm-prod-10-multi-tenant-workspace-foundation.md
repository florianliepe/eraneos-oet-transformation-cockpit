# ZM-PROD-10 — Multi-tenant workspace foundation

## Objective

Introduce a public Eraneos Transformation Cockpit landing page and a production-shaped account, organisation and multi-project workspace foundation. Users can register directly or accept invitations, organisations can have multiple owners, and every project is isolated within its organisation. Until Azure access is available, authentication and persistence use explicit local development adapters behind stable interfaces and must never be represented as production identity security.

## Confirmed decisions

1. Support both open self-registration and invitation-based onboarding.
2. A newly registered user can create an organisation workspace.
3. Organisations support multiple owners and role-based membership.
4. Users can belong to multiple organisations and projects.
5. Implement a production-shaped local identity and persistence boundary now.
6. Defer Microsoft Entra External ID, managed database and App Service API integration until Azure access is available.
7. Keep GitHub Pages auto-deployment for the public frontend and demonstrable local-mode journeys.

## Target experience

### Public surface

- Present the Transformation Cockpit as part of the **OET AI Suite** using the approved Eraneos visual system.
- Explain the core value proposition, governed AI controls, PMO capabilities and data-handling posture.
- Provide clear **Sign in** and **Create account** calls to action.
- Include accessibility, privacy, legal and security placeholders without making unsupported compliance claims.
- Keep public content available without loading private workspace or project data.

### Account journeys

- Self-registration captures display name, email, password placeholder and acceptance of applicable terms.
- Sign-in supports a local development identity adapter and exposes a visible “development mode” notice.
- Invitation acceptance binds the invited email, organisation and intended role.
- Account recovery, email verification and MFA are represented as deferred production capabilities; do not implement insecure substitutes.
- Sessions are scoped, expire predictably and can be signed out from every authenticated screen.

### Authenticated workspace

- After sign-in, show an organisation and project switcher rather than opening one hard-coded project.
- Allow authorised members to create, rename, archive and restore projects.
- Show recent projects, portfolio health, pending reviews, agent incidents and onboarding guidance.
- Preserve the existing cockpit as the project workspace reached from a selected project.
- Retain the selected organisation and project across reloads without leaking data between memberships.

## Domain contracts

Add versioned contracts for:

- `UserAccount`: identity ID, email, display name, status and timestamps.
- `Organisation`: organisation ID, name, slug, status and governance metadata.
- `OrganisationMembership`: user, organisation, role, status, invitation lineage and timestamps.
- `Invitation`: organisation, invited email, intended role, inviter, expiry and acceptance status.
- `ProjectWorkspace`: organisation, project metadata, lifecycle state and canonical PMO document reference.
- `ProjectMembership`: project-specific access where it narrows organisation access.
- `Session`: adapter-issued session identity and expiry without persisted plaintext credentials.

Use opaque identifiers. Every project-owned record, proposal, agent run, evidence object, review, audit event and report must resolve to exactly one `organisationId` and `projectId`.

## Authorisation model

| Role | Organisation | Project access |
| --- | --- | --- |
| Owner | Manage organisation, owners, invitations and all projects | Full governance authority |
| Portfolio Lead | Create and steer projects, view portfolio reporting | Govern assigned/all projects according to membership |
| Project Lead | No organisation ownership changes | Govern assigned projects |
| Contributor | No membership administration | Create and revise assigned project content; publication still requires governed review |
| Viewer | Read permitted organisation metadata | Read-only assigned project views |

Rules:

- An organisation must always retain at least one active owner.
- Owner removal or downgrade is blocked when it would leave no active owner.
- Invitations cannot grant a role higher than the inviter is authorised to assign.
- Project and organisation access is denied by default.
- Agent execution never expands the initiating user’s permissions.
- Governed publication continues to require accountable review regardless of role.

## Architecture boundary

Define replaceable interfaces:

- `IdentityProvider`: register, sign in, sign out, current session and invitation acceptance.
- `WorkspaceRepository`: organisations, memberships, invitations and project lifecycle.
- `ProjectDataRepository`: load and save project-scoped PMO documents.
- `AuthorisationService`: evaluate organisation and project permissions.

Implement local adapters using browser-local development storage with seeded demo identities and deterministic fixtures. Namespace all keys by contract version, organisation and project. Never store plaintext passwords, reusable production tokens or n8n credentials. Use a one-way password verifier suitable only for the clearly labelled local demonstration boundary, or provide passwordless seeded demo access if secure verification is unavailable in the browser.

The later production adapters are:

- Microsoft Entra External ID for self-service sign-up, invitations, verification, recovery and MFA.
- App Service API for server-side session and authorisation enforcement.
- Managed PostgreSQL for organisation, membership and project metadata.
- Existing governed project and n8n boundaries scoped by organisation and project identifiers.

## Work packages

### ZM-PROD-10A — Public landing and navigation shell

1. Separate public and authenticated application states.
2. Build the responsive landing page in the current Eraneos design system.
3. Add sign-in and create-account entry points.
4. Preserve static GitHub Pages export and direct-link behaviour.
5. Add accessibility, responsive and visual regression coverage.

Execution status: **implemented and validated** on 2026-08-11.

- The default route renders only the public product surface; the cockpit and project fixture are loaded from a separate lazy chunk after explicit sign-in navigation.
- Static-compatible `?view=signin` and `?view=register` entry routes retain browser-history behaviour at both root and GitHub Pages base paths.
- The registration entry is intentionally informational until ZM-PROD-10B supplies the versioned local identity adapter and onboarding journeys.
- Desktop and mobile product-surface tests prove that the public route makes no workflow request; accessibility, full cockpit regression, governance and Pages export gates pass.

### ZM-PROD-10B — Local identity and onboarding contracts

1. Add versioned identity, session, invitation and membership schemas.
2. Implement the local development identity adapter.
3. Add self-registration, sign-in, sign-out and invitation-acceptance journeys.
4. Make development-mode limitations explicit in the UI.
5. Test invalid credentials, expired invitations, duplicate accounts and session expiry.

Execution status: **implemented and validated** on 2026-08-11.

- Versioned account, session, invitation, membership and role schemas now define the stable identity boundary, with a replaceable `IdentityProvider` interface.
- Browser-local registration derives a per-account verifier with Web Crypto PBKDF2; plaintext passwords are neither persisted nor reused as the separate workflow credential.
- Self-registration, sign-in, sign-out and signed-in invitation acceptance are available through static-compatible entry routes and carry an explicit local-development warning.
- Sessions expire after eight hours, invitation codes are email-bound and one-time, and neither valid invitation codes nor seeded account credentials are embedded in the public application.
- Domain and browser tests cover duplicate accounts, invalid credentials, expired and unknown invitation codes, session expiry, static Pages onboarding and retained cockpit access.

### ZM-PROD-10C — Organisation and role governance

1. Add organisation creation and membership management.
2. Support multiple owners and enforce the last-owner invariant.
3. Add invitation creation, revocation and acceptance.
4. Centralise authorisation decisions and denial reasons.
5. Audit membership and role changes without storing sensitive credential material.

Execution status: **implemented and validated** on 2026-08-11.

- Self-registered users can create organisation workspaces and become the first owner through the replaceable `WorkspaceRepository` boundary.
- Central authorisation decisions deny access by default, constrain assignable roles and expose stable denial codes and reasons.
- Owners can create and revoke email-bound invitations; generated codes are displayed once, persisted only as one-way verifiers and never written to audit events.
- Invitation acceptance can add a second owner, while downgrade and removal operations enforce the invariant that every active organisation retains an owner.
- Organisation, invitation and membership mutations produce versioned local audit events; domain and browser journeys cover second-owner onboarding, revocation, authority limits and final-owner protection.

### ZM-PROD-10D — Multi-project workspace

1. Add project creation, selection, rename, archive and restore.
2. Scope PMO data, agent operations, reviews and reports to organisation and project.
3. Add organisation/project switchers and an authenticated home dashboard.
4. Migrate the current single demo project into a neutral seeded workspace without losing fixtures or governance lineage.
5. Prove that switching projects cannot expose another project’s data.

### ZM-PROD-10E — Production adapter readiness

1. Document the Entra External ID, API and PostgreSQL adapter contracts.
2. Add configuration validation and fail-closed production mode.
3. Ensure local/demo adapters cannot be enabled accidentally in a production App Service deployment.
4. Add migration, rollback, backup and tenant-isolation test plans.
5. Keep Azure deployment deferred until credentials, subscription and target environment are available.

## Security and privacy requirements

- Treat browser-local mode as a demonstrator, not production authentication.
- Never place passwords, password hashes, invitation secrets, session tokens or API credentials in Git, static bundles, URLs, logs or analytics.
- Do not persist the existing temporary workspace credential as an account password.
- Prevent cross-organisation and cross-project reads and writes at repository and authorisation boundaries.
- Use generic responses for failed sign-in and invitation lookup to limit account discovery.
- Add rate-limit and abuse-control contracts for the later API implementation.
- Keep all destructive project operations recoverable during the local slice.
- Preserve evidence, review, audit, object-version and proposal-only agent guarantees.

## Acceptance gate

- A visitor can move from the public landing page to sign-in or self-registration.
- A self-registered user can create an organisation and become its first owner.
- An owner can invite another user as a second owner, and the invitation can be accepted.
- The system blocks removal or downgrade of the final active owner.
- An authorised user can create and switch between at least two isolated projects.
- Project A data, agent runs, reviews and reports are not visible while Project B is selected unless explicitly available at organisation portfolio level.
- Unauthorised organisation and project access fails closed in domain and UI tests.
- Existing cockpit functionality remains available inside the selected project.
- Static build, accessibility, responsive layout, governance, security and GitHub Pages tests pass.
- The UI clearly labels local identity as non-production and makes no false security claim.

## Deployment outcome

Deliver 10A–10D sequentially through reviewed pull requests, deploying and verifying GitHub Pages after each completed slice. Deliver 10E as production-readiness contracts and documentation only. Do not enable Azure identity, database or API deployment until platform access is explicitly provided.

## Deferred production activation

Production account creation is not complete until Entra External ID, server-side authorisation, managed persistence, email verification, recovery, MFA, abuse protection, monitoring and privacy operations are configured and tested. These capabilities remain an explicit later activation gate rather than being simulated insecurely in the static frontend.
