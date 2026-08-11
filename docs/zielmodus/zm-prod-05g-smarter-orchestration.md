# ZM-PROD-05G — Smarter orchestration

## Objective

Reduce unnecessary model execution while improving routing quality, conflict handling and operational predictability.

## Work package

1. Add deterministic evidence-sufficiency and routing rules before model calls.
2. Execute only relevant specialists and sequence dependent specialists explicitly.
3. Add confidence-based escalation and specialist conflict detection.
4. Add per-run latency, token and cost budgets with safe termination behaviour.
5. Route low-confidence, conflicting or budget-limited outcomes to human review.
6. Evaluate routing precision, missed-specialist rate, cost and latency against the 05F baseline.
7. Add operator controls for routing explanation and approved manual overrides.

## Acceptance gate

- Unrelated specialists are not executed for representative fixtures.
- No required specialist is missed in the evaluation set.
- Conflicts and low confidence always reach human review.
- Budget limits stop safely without canonical writes or lost lineage.
- Quality does not regress while measured execution cost and latency improve.

## Deployment outcome

Deploy the optimized orchestrator only after live non-destructive routing and governance smoke tests pass.

## Execution record

- Status: implemented, evaluated and promoted to the live protected n8n endpoint.
- Deterministic policy `smart-routing-1.0` verifies evidence first, selects only relevant specialists and sequences governance review last.
- Default per-run limits are four specialists, 9,000 estimated tokens, EUR 0.10 and 45 seconds; budget exhaustion terminates proposal-only and requires human review.
- Conflicting proposals, low/not-assessed confidence, warnings and budget-limited runs cannot authorize canonical writes.
- Operators receive routing explanations, estimated token/cost/latency receipts and accountable manual overrides that require actor and rationale.
- Eight routing fixtures achieved 100% precision, 100% recall and zero missed specialists while reducing estimated calls, cost and latency by 47.6% against the six-specialist baseline.
- The checksummed release is `2026-08-11-zm-prod-05g`; the authoritative orchestrator is `IEv54E2lBQyd57hY` and the prior `pEIhI533jPQvvSzs` release is unpublished but retained for rollback evidence.
- Live non-destructive smoke workflow `i2XchZ7twtvKynC9` completed successfully across four routed sub-executions and asserted `canonicalWriteAllowed=false`.
