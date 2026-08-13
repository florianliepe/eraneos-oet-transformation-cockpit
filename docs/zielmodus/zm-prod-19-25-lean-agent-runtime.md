# ZM-PROD-19–25 — Lean agent runtime programme

## Zielmodus instruction

Strengthen the Transformation Cockpit agent runtime without activating Azure production identity or persistence. Preserve the current published orchestrator as rollback. Build and publish a separate UAT orchestrator, promote it only after all acceptance gates pass, then archive only confirmed superseded Transformation Cockpit workflows.

Execute the slices in order:

1. **ZM-PROD-19 — Reliability baseline and dependency map.** Freeze the current workflow inventory, latency evidence, known failure modes, credential boundaries and rollback IDs. Do not infer a production failure rate from fewer than 30 comparable live executions.
2. **ZM-PROD-20 — Lean orchestration contract.** Establish one proposal-only PMO agent, deterministic routing, bounded context, explicit model/prompt versions, evidence attribution and a separate governed publisher. Canonical writes remain inaccessible to the agent.
3. **ZM-PROD-21 — Evidence normalization and routing.** Normalize browser-extracted text once, cap one intake at 80,000 characters and one source at 30,000, route domains deterministically, reject unsafe scope/idempotency metadata and require evidence-focused follow-up runs for oversized material.
4. **ZM-PROD-22 — Tool-enabled PMO agent.** Attach only read-only inline n8n workflow tools. Routine evidence uses a direct agent pass. Tools are exceptional guards for ambiguity, high-impact proposals and uncertain PMO schema mapping. Limit the agent to four iterations and record tool usage.
5. **ZM-PROD-23 — Specialist refactor.** Stop executing six nested specialist agents on the normal path. Preserve their domain labels in routing and receipts while the lean agent performs one coherent extraction. Keep the old specialists published only as rollback dependencies through UAT.
6. **ZM-PROD-24 — Runtime resilience.** Preserve accepted/running/completed receipts, idempotent reconciliation and proposal-only persistence. Bound publisher retries to two attempts with a two-second delay. Never retry validation, authorization or schema failures blindly.
7. **ZM-PROD-25 — Security and observability.** Keep workflow tools side-effect free, record actual runtime model identity, correlation, tool calls and latency, retain the human review/publisher boundary and verify no credential appears in browser bundles, repository files or logs.
8. **ZM-UAT-02 — Lean-agent production UAT.** Test text, XML and PNG-derived evidence; domain routing; ambiguity guard; high-impact guard; PMO schema output; proposal review; governed publication; duplicate idempotency; transient recovery; invalid boundary rejection; cross-project isolation; prompt injection resistance; accessibility and GitHub Pages regression. Fix every blocking defect and rerun the affected tests.

## Promotion gates

- Routine text runs: P50 ≤30 seconds and P95 ≤45 seconds across at least 10 comparable executions.
- Reliability: at least 95% successful terminal receipts across at least 30 comparable executions, excluding intended validation and authorization rejections.
- Quality: 100% schema-valid output, at least 90% object precision/recall/material-field accuracy and 100% evidence attribution for material proposals.
- Governance: zero unauthorized canonical writes, zero cross-project leaks and idempotent duplicate requests.
- Runtime: no six-specialist fan-out on the normal path; exceptional tool calls are visible in receipts; no more than four agent iterations.
- Delivery: local release suite, Pages build and hosted smoke tests pass before endpoint promotion.

## Rollback and cleanup

The current webhook and workflow IDs remain authoritative until UAT passes. Promotion changes the frontend endpoint to the new webhook in a separate reviewed slice. Archive old Transformation Cockpit workflows only after the new endpoint has passed UAT and a rollback export is stored. Never archive unrelated MeIDs or other tenant workflows.
