# ZM-UAT-01 - Execution report

Date: 2026-08-12  
Tester: Codex with accountable user authorization  
Release under test: `d7afe88` plus the ZM-UAT-01 reconciliation fixes in this change
Disposable scope: `UAT Validation Project`  

## Summary

Live execution is substantially complete. Azure App Service activation, Teams and SharePoint are excluded by scope. XML, PNG and PDF live upload remains blocked by the Chrome extension file-URL permission; their browser extraction contracts pass automatically.

| Result | Count |
|---|---:|
| Pass | 20 |
| Automated extraction pass; live upload blocked | 3 |
| Pending deployment regression | 1 |
| Fail | 0 |
| Blocked | 3 |
| Not run | 0 |

## Evidence log

| Test IDs | Result | Evidence / notes |
|---|---|---|
| UAT-001, UAT-002, UAT-005-UAT-009, UAT-018-UAT-019, UAT-021-UAT-023 | Pass | Release gates and 108 browser/domain tests pass locally, including responsive, accessibility, identity, governance, recovery, scope-denial and Pages export coverage. Public Pages is reachable. |
| UAT-003 | Pass | Created and opened `UAT Validation Project` in organisation `Eraneos`; project ID is `prj_c03ec8e4c2f8cc6b73537868d71087e50225`. |
| UAT-004 | Pass | Switched from `UAT Validation Project` to `Test-Project`; `RISK-UAT-LIVE-1`, `ISS-UAT-LIVE-1`, `ACTN-UAT-LIVE-1` and `CR-UAT-LIVE-1` were absent. The reference project retained its own starter-data risk count. |
| UAT-010 | Blocked (automated extraction pass) | XML extraction sends labelled element/attribute paths and verified values before transfer. Live Chrome upload is blocked until the ChatGPT browser extension is allowed to access file URLs. |
| UAT-011 | Blocked (automated extraction pass) | Readable PNG extraction passes as `image_ocr` with confidence, gate date and owner text. Live upload has the same Chrome extension permission blocker. |
| UAT-012 | Blocked (automated extraction pass) | Text PDF extraction passes as `pdf_text` with page labels, risk statement and owner. Live upload has the same Chrome extension permission blocker. |
| UAT-013 | Pass | Live execution `agent:6bb20947-e852-4a2d-b7dd-c82b6937d596` selected evidence, risk, delivery and controls specialists under `smart-routing-1.1.0`; all four steps completed with evidence and correlation lineage. |
| UAT-014 | Pass | Live execution `agent:98c161f1-d23f-4ae6-8f96-25a88bd4ddcb` completed with zero proposals and `NO_MEANINGFUL_PMO_CHANGE`; canonical revision remained 2. |
| UAT-015-UAT-017 | Pass | Proposal set `PS-agent-6bb20947-e852-4a2d-b7dd-c82b6937d596` required decisions and high-impact rationale. Four proposals were accepted, three derivative risks rejected, and revision 2 contains only the accepted risk, issue, action and change request. |
| UAT-020 | Pass | Live retry reused the original idempotency key, was classified as a duplicate and retained retry lineage. UAT-ISSUE-003 records the discovered attempt-counter reconciliation defect and its regression fix. Replay and boundary-failure paths remain covered automatically. |
| UAT-024 | Pending | The current reconciliation fixes pass `npm run verify:release` and all 108 Playwright tests; merge, Pages deployment and public smoke retest remain. |

## Defects

### UAT-ISSUE-001 - Live canonical storage was not project-isolated

Severity: 1. Root cause: the frontend sent organisation and project IDs, but n8n used global repository paths. Resolution: validate scope once at the request boundary; derive project-rooted canonical, proposal, run and work-package paths; initialize a missing project store without incrementing its revision; bind proposal/review scope through the publisher; reject every cross-scope artifact. Automated and live cross-project retests pass.

### UAT-ISSUE-002 - Published runs remain labelled Needs Review

Severity: 3. After successful governed publication, canonical records and revision 2 were correct, but the run card remained `Needs Review` and the global banner still claimed canonical state was unchanged. Resolution: reconcile the matching run to `Completed`, persist its review outcome, and render published/rejected/no-change-specific status copy. Targeted and full regression pass; deployed retest remains.

### UAT-ISSUE-003 - Completed retry reverts to attempt 1

Severity: 3. A live idempotent retry correctly showed duplicate lineage while waiting, but the completed backend receipt replaced attempt 2 with the immutable original attempt 1. Resolution: overlay the client-owned recovery attempt plus `retryOf`/`replayOf` lineage after backend reconciliation. Targeted and full regression pass; deployed retest remains.

## Exit decision

Pending live XML/PNG/PDF upload after the Chrome extension permission is enabled, plus merge/Pages deployment and deployed retest of UAT-ISSUE-002 and UAT-ISSUE-003.
