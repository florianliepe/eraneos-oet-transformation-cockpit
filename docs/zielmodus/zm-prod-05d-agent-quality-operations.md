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

## Implementation record

Completed on 2026-08-11.

- Six representative specialist fixtures are evaluated for contract validity, evidence attribution, unsupported material claims, routing accuracy, and duplicate proposals.
- Release thresholds are source controlled in `config/agent-quality-thresholds.json`; `npm run verify:governance-artifacts` blocks promotion on regression.
- Run contracts and the Agent operations view expose execution state, attempts, latency, workflow/prompt/model versions, review outcome, failed step, and safe recovery guidance.
- Retry reuses the original input and correlation lineage. Replay uses the original input against current workflow bindings and records the source execution without mutating it.
- Specialist dispatch and governed publication use three bounded attempts with a 1.5-second delay.
- The central n8n error workflow stores immutable `agent-dead-letter-1.0` records outside canonical PMO state with explicit retry/replay actions.
- Live error handler: `BkHWDRmPvXOepELU`; live public orchestrator: `pEIhI533jPQvvSzs`.

