# ZM-UAT-01 - Execution report

Date: 2026-08-13
Tester: Codex with accountable user authorization
Release under test: `1b52717` plus the ZM-UAT-01 stale-run recovery release in this change
Disposable scope: `UAT Validation Project`

## Summary

Live execution is complete except for the final GitHub Pages deployment regression. Azure App Service activation, Teams and SharePoint are excluded by scope. XML, PNG and PDF were extracted in Chrome, processed by live n8n specialists, reviewed and rejected as synthetic evidence without changing canonical revision 2.

| Result | Count |
|---|---:|
| Pass | 23 |
| Automated extraction pass; live upload blocked | 0 |
| Pending deployment regression | 1 |
| Fail | 0 |
| Blocked | 0 |
| Not run | 0 |

## Evidence log

| Test IDs | Result | Evidence / notes |
|---|---|---|
| UAT-001, UAT-002, UAT-005-UAT-009, UAT-018-UAT-019, UAT-021-UAT-023 | Pass | Release gates and 108 browser/domain tests pass locally, including responsive, accessibility, identity, governance, recovery, scope-denial and Pages export coverage. Public Pages is reachable. |
| UAT-003 | Pass | Created and opened `UAT Validation Project` in organisation `Eraneos`; project ID is `prj_c03ec8e4c2f8cc6b73537868d71087e50225`. |
| UAT-004 | Pass | Switched from `UAT Validation Project` to `Test-Project`; `RISK-UAT-LIVE-1`, `ISS-UAT-LIVE-1`, `ACTN-UAT-LIVE-1` and `CR-UAT-LIVE-1` were absent. The reference project retained its own starter-data risk count. |
| UAT-010 | Pass | Live XML execution `agent:8ae9b15b-830f-4c52-94cf-339e57cc694b` extracted `ISS-UAT-XML-1` and `ACTN-UAT-XML-1`, produced the supported issue/action proposals and stored an accountable all-rejected review at revision 2. |
| UAT-011 | Pass | Live PNG execution `agent:caf61fb4-3018-4fdd-9567-d0ce39e96346` OCR-read both IDs, issue text, owner role and due date at 94% confidence; it produced two low-confidence proposals and stored an all-rejected review at revision 2. |
| UAT-012 | Pass | Live PDF execution `agent:0d468843-b58a-4d8d-a574-a4c8a9d0a800` extracted the issue/action IDs and 27 August 2026 due date. Its initial durable receipt was orphaned in `accepted`; orchestrator v1.3.4 safely resumed the same idempotency key and completed both specialists in 47,913 ms. The two proposals were reviewed and rejected at revision 2. |
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

### UAT-ISSUE-004 - Accepted receipt can be orphaned before specialist execution

Severity: 2. PDF intake created a durable `accepted` receipt, but the original n8n execution ended before marking it running or launching specialists. Status polling remained honest and timed out after eight minutes, but retry only returned the same stale receipt. Resolution: orchestrator v1.3.4 permits only an explicit source-version retry to resume a same-scope receipt that is still `accepted` after the full safety window; completed/running/wrong-scope or ordinary duplicate requests remain non-executable. Live recovery reused the same execution and idempotency key, completed two specialists in 47,913 ms and preserved attempt 3 lineage. The prior orchestrator remains unpublished as rollback evidence.

## Exit decision

Pending merge, GitHub Pages deployment and final public smoke regression only.
