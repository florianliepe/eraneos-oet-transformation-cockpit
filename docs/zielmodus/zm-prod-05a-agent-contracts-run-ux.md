# ZM-PROD-05A — Agent contracts and transparent run UX

## Objective

Introduce a versioned, validated contract for orchestrator and specialist-agent runs, then make the active run, routing, evidence, proposals and warnings visible in the cockpit.

## Work package

1. Define stable workflow identifiers for evidence, delivery, risk, meeting, controls and governance specialists.
2. Define Zod contracts for request metadata, specialist steps, evidence references, proposals, warnings and the run envelope.
3. Add correlation, execution, workflow, prompt and model-version fields without breaking the current n8n response.
4. Normalize legacy responses into the new envelope at the frontend boundary.
5. Replace the success-only intake message with a transparent agent-run panel.
6. Show selected specialists, status, summaries, proposal counts, evidence counts, warnings and trace identifiers.
7. Add responsive, accessibility, contract and interaction tests.

## Acceptance gate

- Invalid run envelopes fail validation at the boundary.
- Legacy live responses remain supported during migration.
- Every displayed proposal is attributable to a specialist and execution.
- The UI never claims that a proposal was approved when it was only generated or persisted by the legacy path.
- Existing PMO, n8n and Pages tests pass.

