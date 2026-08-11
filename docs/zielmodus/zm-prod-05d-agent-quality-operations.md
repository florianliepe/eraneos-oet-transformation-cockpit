# ZM-PROD-05D — Agent quality and operations

## Objective

Make agent quality measurable and failures recoverable without losing traceability.

## Work package

1. Add representative evaluation fixtures for all six specialists.
2. Score schema validity, evidence attribution, unsupported claims, routing and duplicate proposals.
3. Add execution states, latency, model/prompt/workflow versions and review outcomes to the run history.
4. Add central n8n error handling, bounded retries and a dead-letter/review path.
5. Support retry with the original input and replay against a newer workflow version while preserving lineage.
6. Add operator views for failed, waiting, completed and superseded runs.
7. Define release thresholds and block promotion when evaluation quality regresses.

## Acceptance gate

- Contract validity is 100% across the evaluation set.
- Unsupported or unattributed material claims fail evaluation.
- Retries and replays never overwrite the original execution record.
- Operators can identify the failed step and safe recovery action.

