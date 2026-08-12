# ZM-PROD-18 — Agent-run resilience and reconciliation

## Zielmodus instruction

Eliminate false agent failures and duplicate proposal sets when n8n execution exceeds the synchronous HTTP request boundary. Preserve the proposal-only governance boundary, private data repository, signed workflow catalogue and current GitHub Pages pilot. Do not activate Azure, Teams or SharePoint.

Execute in this order:

1. Establish one stable, privacy-safe correlation ID and idempotency key before submission. Carry them through the browser request, webhook, n8n execution, run receipt, proposal set, retry/replay lineage and support diagnostics.
2. Replace the long synchronous ingestion response with an accepted-run contract. Persist a scoped run receipt before acknowledging the request, continue orchestration after the response, and expose a bounded status-read mode.
3. Reconcile accepted, running, completed, failed and stale/unknown outcomes. A timeout or interrupted poll must never be attributed to the first specialist and must not prove backend failure.
4. Make retries idempotent. The same idempotency key must resolve to the existing run and proposal set; it must not start another specialist execution or create another proposal artifact.
5. Reduce elapsed time without weakening governance: verify evidence first, run independent analysis specialists in parallel where supported, then consolidate and retain accountable human review before canonical publication. Calibrate routing budgets from observed rather than nominal latency.
6. Provide honest cockpit progress, recovery guidance and operator diagnostics. Users must be able to resume status reconciliation after a transient client interruption without exposing evidence, credentials or personal data.
7. Add deterministic contract, workflow, browser and recovery tests; publish release evidence; deploy GitHub Pages after reviewed merge; activate only the checksummed n8n workflow release and execute a non-destructive live smoke test.

## Acceptance gate

- Initial ingestion returns an accepted run reference well below the hosting timeout while n8n continues processing.
- Repeated submission with the same idempotency key returns the same run/proposal result and creates no additional proposal set.
- Completed backend work is reconciled as completed even when the original browser request or polling session was interrupted.
- The UI uses `outcome unknown` or `reconciliation required` for an unconfirmed boundary failure and never fabricates `Failed: evidence.verify`.
- Correlation and idempotency references match across the browser, run receipt, agent contract and proposal set without storing secrets or raw evidence in diagnostics.
- Evidence verification precedes dependent analysis; independent specialists do not add avoidable serial latency; all agent output remains proposal-only.
- Static release, workflow checksums, governance, accessibility, compatibility, performance, recovery and live Pages verification pass.

## Explicit exclusions

- Azure/Entra production activation and managed persistence.
- Teams and SharePoint integration.
- Deletion of the two UAT proposal sets; accountable reviewers decide which result to retain.
- Any claim that browser-local identity is production authentication.
