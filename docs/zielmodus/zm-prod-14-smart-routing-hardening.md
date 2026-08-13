# ZM-PROD-14 — Smart-routing latency hardening

## Zielmodus instruction

Use the authoritative n8n orchestrator and real specialist workflows, but select the smallest evidence-justified route. Evidence verification remains mandatory. Domain specialists run only when their PMO domain is present. The AI governance reviewer runs only for material audit findings, compliance breaches, policy exceptions, segregation-of-duties concerns or conflicts of interest; it is not a duplicate of the mandatory accountable human review gate. Every proposal remains evidence-bound, project-scoped and proposal-only.

Calibrate estimated latency from the live execution baseline, keep manual overrides accountable, retain conflict/low-confidence escalation, and block publication on binding, release, idempotency or scope drift. Promote through a new checksummed n8n release, preserve the prior workflow as unpublished rollback, and execute an identical live canary to compare route, accuracy, canonical revision and latency.

## Acceptance gate

- Routine issue/action intake selects `evidence.verify` and `controls.classify`, not `governance.review`.
- A material governance exception still selects `governance.review`.
- Deterministic routing precision and recall remain 100% while calls, tokens and cost fall.
- The identical live canary produces the expected issue/action proposals with no canonical write.
- The authoritative workflow binding, release manifest, source backup and live receipt agree on version and identity.
- The prior authoritative workflow remains unpublished and recoverable.

## Implementation status

Implemented locally on 2026-08-13; live promotion and canary evidence pending.
