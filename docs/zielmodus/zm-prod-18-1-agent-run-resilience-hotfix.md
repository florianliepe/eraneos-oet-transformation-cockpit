# ZM-PROD-18.1 — Agent-run resilience hotfix

## Zielmodus instruction

Repair the ZM-PROD-18 release failure without widening the product or infrastructure scope. Make workflow generation deterministic and repeatable, reject syntactically invalid n8n Code nodes before release, handle empty and non-JSON webhook failures without masking their HTTP status, and remove remaining customer-specific credential naming from the neutral Transformation Cockpit binding.

Execute in this order:

1. Replace the mutable `BuildAssistantInput` patch with one canonical template so repeated builds produce byte-identical workflow artifacts.
2. Add release gates that syntax-compile every Code node, assert one resilience declaration block and run the orchestrator builder twice without changing its output.
3. Harden PMO and SteerCo clients so HTTP failure status is classified before body parsing and malformed success responses fail with a safe contract diagnostic.
4. Regenerate release `2026-08-12-zm-prod-18-1`, preserve proposal-only governance and retain prior n8n versions as rollback points.
5. Validate targeted regressions, the full release gate, browser tests and the GitHub Pages export; publish through reviewed GitHub change control.
6. Publish the authoritative n8n orchestrator as `ZM-PROD-18.1 agent run resilience hotfix`, then verify a safe retry of the failed input reaches accepted/running/completed or needs-review with one idempotency identity and one proposal set.
7. Treat live reconciliation as a release gate: GitHub receipt reads must return JSON metadata with base64 `content`, never a binary attachment that bypasses receipt classification.

## Acceptance gate

- Running `npm run build:agent-orchestrator` twice produces the same orchestrator bytes.
- Every checked-in n8n Code node parses successfully and the resilience identifiers are declared once.
- Empty 403/500 and malformed JSON responses never surface `Unexpected end of JSON input`.
- The authoritative workflow contains unique node names, the neutral credential binding and a restorable prior published version.
- The failed pre-receipt run can be retried safely; one run receipt and no duplicate proposal execution are observed.
- A completed receipt reconciles through `pmo.run.status`, and a repeated `pmo.ingest` with the same key returns that receipt without attempting a second create or specialist execution.
- Azure, Teams and SharePoint remain unchanged.
