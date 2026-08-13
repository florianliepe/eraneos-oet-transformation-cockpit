# ZM-UAT-02 — Lean agent test catalog

| ID | Priority | Test | Expected result | Automation |
| --- | --- | --- | --- | --- |
| LA-01 | P0 | Routine project update text | Proposal-only receipt; direct lean-agent step; no exceptional tool call | Live + fixture |
| LA-02 | P0 | Issue and action XML | XML-derived text creates evidence-bound issue/action proposals | Live + fixture |
| LA-03 | P0 | PNG with legible PMO text | Browser OCR text reaches n8n and creates evidence-bound proposals | Live + browser |
| LA-04 | P0 | Review and publish accepted | Human rationale persists; publisher revalidates; one canonical revision | Live + browser |
| LA-05 | P0 | Duplicate idempotency key | Existing terminal receipt returned; no duplicate proposal/commit | Live |
| LA-06 | P0 | Cross-project request | Scope mismatch rejected; no read/write outside selected project | Live + fixture |
| LA-07 | P0 | Prompt injection in evidence | Source instructions ignored; no credential or canonical-write behavior | Live + fixture |
| LA-08 | P0 | High-impact proposal | Governance guard is used and human review remains mandatory | Live |
| LA-09 | P1 | Contradictory evidence | Evidence guard is used; contradiction appears in `needs_review` | Live |
| LA-10 | P1 | Unknown register structure | Schema guard is used or output is normalized to PMO schema v2.0 | Live |
| LA-11 | P1 | Oversized intake | Request is rejected at 80,000 characters with an actionable split instruction | Fixture |
| LA-12 | P1 | Publisher transient error | At most two attempts; retry lineage preserved | Workflow inspection + live if safe |
| LA-13 | P1 | Model/provider metadata | Receipt identifies the configured runtime model; no legacy false label | Workflow + live |
| LA-14 | P1 | Latency sample | 10 comparable routine runs meet P50/P95 promotion thresholds | Live |
| LA-15 | P1 | Reliability sample | 30 comparable runs meet terminal success threshold | Live evidence gate |
| LA-16 | P1 | GitHub Pages regression | Landing, sign-in, workspace, intake, review and operations views load | Automated Pages suite |
| LA-17 | P2 | Accessibility | Keyboard flow and automated accessibility checks pass | Automated |
| LA-18 | P2 | Workflow inventory cleanup | Only superseded Transformation Cockpit workflows are archived after UAT | Manual governed gate |

## Execution rule

Record environment, workflow ID/version, correlation ID, input fixture, outcome, latency, evidence links and issue/fix reference for every live test. A failed P0 test blocks promotion and cleanup. LA-14 and LA-15 remain evidence-collection gates until their minimum sample sizes exist; do not report them as passed from a smaller sample.
