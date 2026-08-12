# ZM-UAT-01 — Execution report

Date: 2026-08-12  
Tester: Codex with accountable user authorization  
Release under test: `c4e21f0`  
Disposable scope: `UAT Validation Project`  

## Summary

Execution in progress. Azure App Service activation, Teams and SharePoint are excluded by scope.

| Result | Count |
|---|---:|
| Pass | 13 |
| Fail | 0 |
| Blocked | 0 |
| Not run | 11 |

## Evidence log

| Test IDs | Result | Evidence / notes |
|---|---|---|
| UAT-001, UAT-002, UAT-005–UAT-009, UAT-015, UAT-018–UAT-019, UAT-021–UAT-023 | Pass | Release gates, 103 browser/domain tests, one Pages export test, responsive snapshots, accessibility, identity, governance, recovery and scope-denial contracts passed locally. Public Pages deployment is reachable. |
| UAT-003 | Pass | Created and opened `UAT Validation Project` in organisation `Eraneos`; project ID begins `prj_c03ec8e4…`. |
| UAT-004, UAT-016 | Pass (automated), live retest pending | UAT-ISSUE-001 is patched: workflow artifacts derive every canonical, proposal, run and work-package path from validated organisation/project scope; the publisher rejects mismatched scope. Publisher acceptance/rejection/idempotency tests pass. |
| UAT-010–UAT-014, UAT-017, UAT-020, UAT-024 | Not run | Awaiting isolated live workflow path and subsequent live regression/deployment. |

## Resolved defects awaiting live retest

### UAT-ISSUE-001 — Live canonical storage is not project-isolated

Severity: 1. Root cause: the frontend sent organisation and project IDs, but n8n used global repository paths. Resolution: validate scope once at the request boundary; derive project-rooted canonical, proposal, run and work-package paths; initialize a missing project store without incrementing its revision; bind proposal/review scope through the publisher; reject every cross-scope artifact. Automated regression is green; live n8n and Pages deployment/retest remain.

## Exit decision

Pending execution and regression.
