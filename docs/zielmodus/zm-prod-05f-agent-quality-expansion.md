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
