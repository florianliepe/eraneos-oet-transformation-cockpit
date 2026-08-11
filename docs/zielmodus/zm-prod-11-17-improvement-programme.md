# ZM-PROD-11–17 — Live-use improvement programme

## Zielmodus system instruction

Execute ZM-PROD-11 through ZM-PROD-17 strictly in the order defined below. Treat each Zielmodus as an independently reviewable, tested and recoverable work package. Complete its acceptance gate, merge its pull request to `main`, let GitHub Pages deploy the cumulative application, and verify the live result before starting the next package.

Preserve the Eraneos Transformation Cockpit identity, its separation from every prior client pilot, PMO schema v2.0, organisation/project isolation, evidence lineage, review authority, immutable audit/object-version contracts and proposal-only agent boundary. Never expose passwords, recovery material, n8n credentials or confidential evidence in Git, URLs, logs, analytics or static bundles.

GitHub Pages remains an explicitly labelled browser-local MVP. Do not implement, simulate or activate Azure production identity, App Service APIs or managed persistence in this programme. SharePoint and Teams remain deferred. Prefer reversible operations, versioned contracts, migration of existing local data and fail-closed behavior. Do not silently discard browser-local accounts, organisations, projects or governance lineage.

For every package:

1. Inspect the current main branch and relevant live behavior before editing.
2. Define or extend stable contracts before UI behavior.
3. Add negative-path, isolation, accessibility and regression tests proportionate to the change.
4. Run type-check, lint, governance, production-profile build, Pages build and relevant browser tests.
5. Commit on a `florianliepe/codex/` branch, push, open a reviewed pull request and merge only after green checks.
6. Verify the deployed artifact and the live user journey before recording completion.
7. Continue automatically with the next package when the gate is proven.

## ZM-PROD-11 — Local account safety and portability

### Goal

Make repeated browser-local MVP usage recoverable and understandable without misrepresenting local identity as production security.

### Work package

1. Add an account and local-storage status surface with active identity, session expiry, storage mode, last backup and clear limitations.
2. Support password change only after verifying the current local password; never expose or recover the existing password.
3. Add explicit sign-out and destructive local-profile reset with typed confirmation and a precise impact preview.
4. Define a versioned portable workspace backup containing accounts only when safe, organisations, memberships, projects, scoped PMO documents and non-secret operational records.
5. Export backups as encrypted, integrity-checked files using a dedicated backup passphrase; never reuse the account or workflow password automatically.
6. Add import preview, contract validation, conflict policy and atomic restore. Reject malformed, downgraded, cross-tenant or secret-bearing payloads.
7. Preserve existing storage keys and migrate non-destructively.

### Acceptance gate

- A user can see which browser-local account and storage boundary are active.
- A current password can be changed and the old password stops working.
- No password can be displayed, recovered or reset insecurely.
- An encrypted export can be restored in a clean browser boundary with organisation, project and PMO isolation intact.
- Wrong passphrases, corrupted files, version conflicts and cross-scope payloads fail closed.
- Destructive reset requires an explicit backup warning and typed confirmation.

### Implementation record

Implemented and validated on 2026-08-11.

- The workspace safety centre shows active account, session expiry, browser-local storage size and last-backup state with explicit non-production limitations.
- Current-password verification supports safe local password change; old passwords stop working and no recovery/display shortcut exists.
- Versioned `.oetbackup` files use PBKDF2-SHA256 and AES-256-GCM with ciphertext integrity, exclude active sessions and recovery evidence, and encrypt local verifiers, governance, scoped PMO documents and non-secret agent-operation records.
- Restore preview validates contracts, account/organisation/project relationships, project document and agent scopes, corruption, passphrase and conflicts before an atomic replacement.
- Sign-in supports clean-boundary restore, while signed-in users can export, restore or invoke a typed, fully described destructive local reset.

## ZM-PROD-12 — Portfolio command centre

### Goal

Turn the organisation home into a decision-oriented multi-project command centre.

### Work package

1. Add portfolio summaries for project health, milestones, risks, issues, decisions, actions and pending reviews.
2. Derive all aggregation from authorised project-scoped repositories; do not create a tenant-wide data bypass.
3. Add filters for status, owner, reporting period and attention state, with clear empty and partial-data states.
4. Expose cross-project dependencies and capacity constraints with source project links.
5. Provide recent projects, onboarding progress, agent incidents and stale-data indicators.
6. Drill from each portfolio signal into the correct selected project and cockpit view.

### Acceptance gate

- At least two projects aggregate into a useful portfolio view without leaking another organisation.
- Every metric is traceable to authorised project data and handles missing data honestly.
- Filters and drill-down retain organisation/project context across reloads.
- Portfolio calculations and isolation have deterministic tests.

### Implementation record

Implemented and validated on 2026-08-11.

- A versioned portfolio command-centre contract derives health, delivery, RAID, decision, action, review and agent-incident signals only from authorised project-scoped repositories.
- Organisation, status, owner, reporting-period and attention filters persist locally; missing or invalid project documents remain explicitly unavailable instead of inheriting demonstration data.
- Recent work, onboarding completeness, stale updates, cross-project dependencies and constrained resource pools retain source-project and source-record references.
- Signal drill-down records the authorised organisation, project and target cockpit view in the route and restores that context after reload; sign-out clears it.
- Deterministic and browser tests cover two-project aggregation, cross-organisation rejection, partial data, filters, dependency/capacity lineage and reload-safe drill-down.

## ZM-PROD-13 — Project delivery workbench

### Goal

Make the selected project cockpit efficient for daily PMO control.

### Work package

1. Strengthen register tables with sorting, filters, saved views, configurable columns and bulk selection.
2. Add guided creation and bulk updates with schema validation, object-version checks and audit lineage.
3. Visualise relationships among risks, issues, actions, decisions, dependencies, assumptions and change requests.
4. Add milestone/dependency timeline and critical-path explanations.
5. Improve evidence attachment, relationship management and governance completeness prompts.
6. Add versioned project templates and a recoverable onboarding checklist.
7. Add governed CSV/Excel import preview and controlled export without bypassing review or scope.

### Acceptance gate

- Daily register tasks are faster without weakening evidence, review, audit or version contracts.
- Bulk and import actions preview changes and remain recoverable.
- Relationship and timeline views explain their source records.
- Existing project and agent workflows remain compatible.

### Implementation record

Implemented and validated on 2026-08-11.

- Register work now supports local saved views, text/owner/status filters, deterministic sorting, configurable columns and explicit multi-record selection.
- Bulk owner/status changes require a visible preview and expected object versions; application revalidates versions and creates normal governance, audit and object-version lineage.
- Controlled CSV and Excel import accepts updates to known records only, previews required fields, rejects stale versions and records import audit events; governed CSV export retains object versions, review state and evidence identifiers.
- The project workbench derives a recoverable onboarding checklist from canonical state, exposes a versioned starter template, maps cross-object relationships and explains the milestone/dependency critical path.
- Guided single-record creation and evidence/governance surfaces remain intact, with 84 browser and deterministic tests covering regression, stale writes, import/export and lineage.

## ZM-PROD-14 — n8n agent control plane

### Goal

Make the existing n8n agent system observable, governable and project-safe from the cockpit.

### Work package

1. Add a versioned agent catalogue with workflow purpose, live binding, release, data classification and availability.
2. Bind every request, run, retry, replay, review and publication to organisation/project scope and accountable actor.
3. Add health, progress, timeout, cancellation-request and recovery states without claiming unsupported n8n capabilities.
4. Enforce idempotency, duplicate protection and immutable execution lineage.
5. Expose latency, token, cost and specialist budgets with explainable routing decisions.
6. Escalate conflicts, low confidence and policy exceptions to human review.
7. Provide browser-session-based n8n activation guidance and automated binding verification without requesting credentials or MFA secrets.

### Acceptance gate

- Operators can identify which versioned workflows are available and why each agent was selected.
- Runs cannot cross project scope or write canonical state without governed review.
- Failure, retry and replay preserve original input lineage and idempotency.
- Live binding and workflow-release verification pass against the existing n8n endpoint.

### Implementation record

- `agent-control-plane-1.0` publishes nine unique, release-verified n8n bindings with purpose, workflow version, release, data classification, availability and explicit write boundary.
- New executions, retries and replays are bound to organisation, project and signed-in accountable actor; historical records receive an honest unattributed compatibility identity when parsed.
- Deterministic idempotency keys group recovery attempts under immutable root lineage, identify duplicates and leave each source execution unchanged.
- Operations now expose step progress, latency/timeout-budget state, routing explanations, budget escalation, low-confidence/policy review signals and request-only cancellation state. The UI explicitly states that the current binding does not expose remote cancellation.
- Canonical-write authorization fails closed on project-scope mismatch or absent accepted review; specialist workflows remain proposal-only and only the governed publisher declares a reviewed canonical-write boundary.
- Browser-session activation guidance uses the existing binding and verification scripts without requesting credentials or MFA. Workflow checksums, release alignment, nine unique bindings and the existing endpoint contract pass automated verification.
- TypeScript, lint, governance artifacts, 87 browser/deterministic tests, App Service-shaped build, Pages build and the deployed-path test pass.

## ZM-PROD-15 — Executive reporting and governance

### Goal

Produce repeatable, evidence-linked project and portfolio decision packs.

### Work package

1. Extend configurable reporting periods and project/portfolio report templates.
2. Generate narratives only from evidence-bound metrics, with visible missing-data and confidence states.
3. Add explicit decision requests, reviewer assignments, approval/rejection rationale and publication gates.
4. Compare baseline, forecast, actual and prior periods without mutating approved snapshots.
5. Produce accessible PowerPoint/PDF-ready outputs with provenance and immutable report versions.
6. Add publication history, expiry/revocation and rollback evidence.

### Acceptance gate

- Every material claim resolves to evidence or is visibly marked missing/proposed.
- No report can be published without accountable approval and current source versions.
- Project and portfolio outputs preserve tenant/project scope.
- Exports and published views are reproducible from an immutable snapshot.

### Implementation record

- `executive-reporting-1.0` defines project Steering Committee and portfolio review templates with governed organisation/target scope, assigned reviewer, explicit decision requests and deterministic source fingerprints.
- Project publication fails closed unless exactly one project is bound, the immutable snapshot is approved, the assigned reviewer has recorded rationale and the reviewed source fingerprint still matches.
- Portfolio decision packs include only approved project snapshots, preserve per-project source fingerprints and approval identities, derive evidence-linked attention signals and state every missing/unapproved project explicitly.
- Approval, publication, revocation and restore actions append linked immutable receipts; the cockpit exposes their actor, revision, source fingerprint and rationale without mutating prior receipts.
- Existing period selection, evidence-bound/missing claims, baseline/forecast/actual comparison, AI/human labelling, source-drift gates, expiry/revocation and rollback remain intact.
- PowerPoint output adds document title/language/description, content descriptions and `_provenance/report-manifest.json`; print styling remains the accessible PDF-ready path.
- TypeScript, lint, governance artifacts, 90 browser/deterministic tests, App Service-shaped build, Pages build and deployed-path test pass.

## ZM-PROD-16 — Design and usability hardening

### Goal

Deliver a coherent, accessible Eraneos product experience across public, workspace, project and operational surfaces.

### Work package

1. Consolidate design tokens, typography, spacing, status semantics and reusable components.
2. Improve navigation hierarchy, dashboard density and responsive behavior at mobile, tablet and desktop widths.
3. Add guided first use, contextual help and plain-language governance explanations.
4. Meet WCAG 2.2 AA for keyboard access, focus, contrast, form errors, landmarks and reduced motion.
5. Add explainable charts, timelines and relationship visuals only where they improve decisions.
6. Expand visual regression coverage across normal, empty, loading, error, conflict and recovery states.

### Acceptance gate

- All core journeys are usable by keyboard and at supported responsive breakpoints.
- Visual hierarchy is consistent with the current Eraneos look and feel.
- Accessibility and visual regression gates cover every major application surface.
- Design changes do not hide governance state or reduce information accuracy.

### Implementation record

- The canonical design/status/component contract is documented in `docs/design-system.md`; the cockpit continues to use the central Eraneos ink, warm-neutral and orange token layer while semantic health colours remain independent and text-labelled.
- A responsive, non-modal contextual help drawer explains every major cockpit view, the draft/proposal/review/publish sequence, status meaning and keyboard controls in plain language.
- First use now presents a dismissible three-step evidence, review and publication guide. Its browser-local preference changes no governed project data and can be rediscovered through contextual help.
- Navigation moves keyboard focus to the new page heading; the help drawer opens with focus, closes on Escape and restores focus to its trigger.
- Desktop, tablet and mobile layout retain governance content; reduced-motion and forced-colour behavior remain explicit, and contextual help has visual regression coverage.
- Focused accessibility/visual tests cover named controls, landmarks, shortcuts, heading focus, help focus restoration, AA token contrast, reduced motion and normal/empty/loading/error/recovery surfaces.
- TypeScript, lint, governance artifacts, 92 browser/deterministic tests, App Service-shaped build, Pages build and deployed-path test pass.

## ZM-PROD-17 — Operational quality

### Goal

Establish a dependable, observable and recoverable GitHub Pages plus n8n pilot operating baseline.

### Work package

1. Centralise typed client errors, correlation IDs, retry guidance and privacy-safe diagnostics.
2. Add workflow availability, release compatibility and stale-binding diagnostics.
3. Define privacy-safe product telemetry contracts with analytics disabled until explicitly configured.
4. Enforce performance budgets for public load, cockpit interaction and exported assets.
5. Expand automated accessibility, browser compatibility, security and dependency gates.
6. Rehearse backup, restore, workflow rollback and failed-release recovery.
7. Publish release notes, support ownership, incident triage and live-service verification procedures.

### Acceptance gate

- Main and Pages releases fail on broken contracts, unsafe bundles, accessibility regression or performance-budget breach.
- Operators can diagnose a failed workflow or stale release without exposing user data or secrets.
- Backup/restore and rollback evidence is current and reproducible.
- The live GitHub Pages pilot matches the signed release artifact and has a documented support boundary.

## Explicitly excluded

- Microsoft Entra External ID activation.
- Azure App Service API deployment or credentials.
- Managed PostgreSQL provisioning or migration execution.
- Teams and SharePoint integration.
- Any claim that browser-local identity or persistence is production secure.
