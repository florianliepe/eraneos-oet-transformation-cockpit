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
