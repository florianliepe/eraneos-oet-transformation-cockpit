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

Implemented and promoted to the authoritative n8n workflow on 2026-08-13.

The pre-frontend-deployment live canary completed as run
`agent:0389b72b-1340-4a8a-8f2f-18773ec6c2af` in 60.17 seconds. Although the
then-live frontend displayed its older three-agent estimate, orchestrator
`pmo.orchestrate` version `1.3.5` applied routing policy
`smart-routing-1.2.0` and executed only `evidence.verify` and
`controls.classify`. The evidence verifier correctly rejected the explicitly
disposable test statement as support for an operational PMO record, so the run
produced zero proposals, remained `proposal_only`, and wrote no canonical
project change. The persisted receipt commit is
`c07a8cceecb6b87acd40a1386cae6680fb9eb374`.

GitHub Pages deployment run `31705712427` then promoted merge commit
`9c07b7ece0858b91a8f6682dfe60325f58a3efb4`. The refreshed production
frontend selected exactly two specialists for the same routine issue/action
route, estimated 3,600 tokens, EUR 0.036 and 44 seconds, and omitted the
governance reviewer. Together with the persisted live receipt, this closes the
promotion gate without creating or publishing a synthetic project record.
