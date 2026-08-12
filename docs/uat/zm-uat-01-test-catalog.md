# ZM-UAT-01 — Transformation Cockpit UAT catalog

## Purpose and release boundary

This catalog validates the public GitHub Pages MVP and its live n8n/GitHub data path. The disposable test scope is **UAT Validation Project**. Azure App Service activation, Teams and SharePoint are excluded.

Release under test: `c4e21f0` or later. Browser: current stable Chrome on Windows, plus automated responsive emulation. Evidence must not contain credentials, authentication codes or confidential client information.

## Status and severity

- Status: `Not run`, `Pass`, `Fail`, `Blocked`, `Not applicable`.
- Severity 1: data loss, cross-project disclosure, unauthorized canonical write or unusable core journey.
- Severity 2: major function fails without a safe workaround.
- Severity 3: partial function, misleading state or accessible-usage failure with a workaround.
- Severity 4: cosmetic or low-impact usability issue.

## Entry and exit criteria

Entry requires a green main-branch build, reachable GitHub Pages frontend, authenticated n8n editor and permission to create a disposable project. Exit requires all Severity 1–2 tests passing, no untriaged failures, regression green, Pages deployed, and every accepted AI change traceable to evidence, review, audit and object version.

## Test catalog

| ID | Area | Test and expected outcome | Method | Status |
|---|---|---|---|---|
| UAT-001 | Deployment | Open the public URL. Branded landing page loads without console or network errors; the deployed revision is the current main release. | Live Chrome + CI | Pass |
| UAT-002 | Identity | Create a disposable local account, sign out and sign in. Password is never displayed or recoverable; invalid credentials fail safely. | Automated + manual | Pass |
| UAT-003 | Workspace | Create or select an organisation workspace and create **UAT Validation Project**. The creator is an owner and the project opens successfully. | Live Chrome | Pass |
| UAT-004 | Isolation | Create/select a second project, add a unique record, switch projects and verify that the record cannot be discovered outside its project. | Automated + live Chrome | Automated pass; live retest pending |
| UAT-005 | Navigation | Open every primary cockpit view. Correct heading, help text and navigation state are visible; no page error occurs. | Automated + live Chrome | Pass |
| UAT-006 | Responsive | Validate landing, workspace and cockpit at desktop, tablet and mobile widths. Content remains operable without unintended horizontal clipping. | Automated | Pass |
| UAT-007 | Accessibility | Validate keyboard navigation, visible focus, skip link, accessible names, reduced motion and WCAG AA status/brand contrast. | Automated + manual spot check | Pass |
| UAT-008 | PMO registers | Create and edit an issue, action, decision, dependency, assumption and change request. Each update increments governance version and adds audit evidence. | Automated + live Chrome | Pass |
| UAT-009 | Bulk controls | Preview and apply a version-checked bulk update and CSV import; export the governed register. Stale or invalid input fails closed. | Automated | Pass |
| UAT-010 | XML intake | Upload valid XML. The browser extracts labelled element/attribute paths and n8n proposes only supported, meaningful PMO changes. Invalid XML produces an actionable error. | Automated + live n8n | Browser extraction pass; live agent pending |
| UAT-011 | PNG intake | Upload a readable PNG. English/German OCR returns non-empty text and confidence; unreadable images fail with guidance. No timestamp-only proposal is created. | OCR fixture + live n8n | Browser extraction pass; live agent pending |
| UAT-012 | PDF intake | Upload a text PDF. Page-labelled text reaches n8n and produces evidence-bound proposals; empty/scanned content is reported honestly. | Automated/live n8n | Browser extraction pass; live agent pending |
| UAT-013 | Agent routing | Submit evidence relevant to a known PMO domain. Only justified specialists run within budget, with visible execution, correlation and evidence lineage. | Automated + live n8n | Automated pass; live retest pending |
| UAT-014 | No-change handling | Submit readable evidence containing no supported PMO update. Run completes with `NO_MEANINGFUL_PMO_CHANGE`; no review item or canonical write is created. | Workflow contract + live n8n | Automated pass; live retest pending |
| UAT-015 | Review validation | A proposal cannot be submitted without an explicit accept/reject decision. High-impact proposals additionally require at least 20 rationale characters. | Automated + live Chrome | Automated pass; live retest pending |
| UAT-016 | Governed publish | Accept one valid proposal. Review bundle persists, publisher revalidates lineage/version/evidence, canonical revision increments exactly once, and review/audit/object-version records appear. | Automated + live n8n | Automated pass; live retest pending |
| UAT-017 | Rejection | Reject a proposal with required rationale. The immutable review persists but canonical PMO revision and object remain unchanged. | Automated + live n8n | Automated pass; live retest pending |
| UAT-018 | Idempotency | Retry the same governed publication. It is classified as duplicate and cannot create another revision or object version. | Automated workflow contract | Pass |
| UAT-019 | Concurrency | Change canonical revision after proposal generation and attempt publication. Publisher rejects the stale proposal and requests regeneration. | Automated workflow contract | Pass |
| UAT-020 | Recovery | Simulate failed/unknown agent boundaries, inspect run operations, retry original input and replay current version. Lineage is retained and duplicate execution is prevented. | Automated + live Chrome | Automated pass; live retest pending |
| UAT-021 | Reporting | Build a SteerCo snapshot with evidence-bound narrative; review and approve it. Unsupported claims and stale revisions are blocked. | Automated | Pass |
| UAT-022 | Backup | Export an encrypted local workspace, reject wrong passphrase, restore it, and verify project isolation and governance. | Automated | Pass |
| UAT-023 | Security boundary | Verify public bundles contain no configured credentials or client markers; unsafe webhook endpoints and cross-scope reads/writes fail closed. | Automated release gates | Pass |
| UAT-024 | Deployment regression | Merge approved fixes and verify main CI, Pages deployment, public URL, and critical smoke journey. | CI + live Chrome | Pass |

## Manual UAT checklist

- [ ] Use only the disposable **UAT Validation Project** for destructive or canonical-write scenarios.
- [ ] Confirm the organisation and project name before every agent run and publication.
- [ ] For XML/PNG/PDF, confirm the proposed fields reflect source facts rather than filenames or timestamps.
- [ ] Inspect every proposal's evidence count, before/after values, object ID and expected version.
- [ ] Enter an accountable rationale that states what evidence was reviewed and why the decision is justified.
- [ ] After publication, confirm the intended cockpit view changed and unrelated views/projects did not.
- [ ] Confirm Activity log, Evidence register, Review queue and Object versions contain the same lineage.
- [ ] Refresh and sign in again to prove the accepted state survives a new browser session.
- [ ] Record screenshots only when they contain no credentials or confidential content.
- [ ] Record every discrepancy in the execution record below before attempting a fix.

## Defect and execution record

| Issue | Test | Severity | Observation | Resolution | Retest |
|---|---|---:|---|---|---|
| UAT-ISSUE-001 | UAT-004, UAT-016 | 1 | Live n8n reads and publishes one global `knowledge/pmo/control-tower.json`; organisation/project scope is present in requests but not used in the canonical path. A disposable-project publication could therefore alter shared project control. | Fixed locally — project-rooted paths, first-use upsert, stored proposal/review scope and publisher scope validation added. | Automated pass; live retest pending |

## Execution evidence

Results are recorded in `docs/uat/zm-uat-01-execution-report.md`. Automated evidence is the referenced CI run or local command output; live evidence records the public URL, workflow/version, disposable project, proposal/review IDs and resulting canonical revision without secrets.
