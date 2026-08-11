# ZM-PROD-05F — Agent quality expansion

## Objective

Turn the initial six-fixture gate into a representative regression and comparison system for safe prompt, model and workflow evolution.

## Work package

1. Add positive, incomplete, contradictory, duplicate and prompt-injection fixtures for every specialist.
2. Score precision, recall, false-positive proposals, evidence attribution, unsupported claims and reviewer acceptance.
3. Add per-agent and aggregate thresholds with explicit blocking and warning levels.
4. Produce machine-readable and human-readable evaluation reports.
5. Add controlled baseline-versus-candidate prompt/model comparisons.
6. Display quality trends, regression causes and release readiness in the operator health view.
7. Prevent promotion when a blocking metric regresses beyond threshold.

## Acceptance gate

- Every specialist is covered by all required scenario classes.
- Prompt-injection and unsupported material claims fail closed.
- Baseline and candidate comparisons are reproducible.
- CI blocks a deliberately regressed candidate fixture.

## Deployment outcome

Deploy the evaluation dashboard and green baseline report before ZM-PROD-04.

## Implementation record

- Expanded coverage from six happy-path fixtures to 30 deterministic cases: positive, incomplete, contradictory, duplicate and prompt-injection scenarios for every specialist.
- Added baseline and candidate outputs with reproducible prompt/model metadata and per-case reviewer decisions.
- Added aggregate and per-specialist precision, recall, false-positive, attribution, unsupported-claim, duplicate, reviewer-acceptance, routing and prompt-injection fail-closed metrics.
- Versioned blocking, warning, per-agent and regression-budget thresholds in `config/agent-quality-thresholds.json`.
- Added machine-readable `src/data/agent-quality-report.json` and human-readable `docs/agent-quality-report.md`; the evaluator blocks stale reports.
- Added a deliberately regressed prompt-injection candidate and a CI test proving that promotion is rejected.
- Replaced the hard-coded health claim with a live evaluation dashboard showing candidate-versus-baseline scores, specialist coverage, regression causes and release readiness.
