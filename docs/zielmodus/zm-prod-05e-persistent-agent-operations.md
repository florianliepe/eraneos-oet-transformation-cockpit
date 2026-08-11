# ZM-PROD-05E — Persistent agent operations

## Objective

Persist agent execution history and recovery state so operations survive browser refreshes without weakening canonical PMO governance.

## Work package

1. Define versioned run, recovery and dead-letter index contracts.
2. Persist run metadata, lineage, state transitions and recovery ownership outside canonical PMO data.
3. Load paginated run history into the cockpit with state, workflow, correlation and date filters.
4. Add acknowledgement, assignment, resolution and immutable operator notes.
5. Support bounded retry with original input and replay against current workflow versions.
6. Show version differences and require confirmation before replay.
7. Preserve original executions and record every recovery attempt as a new linked execution.

## Acceptance gate

- Run history survives reload and contains no credential or raw evidence values.
- Retry and replay create new records with immutable source lineage.
- Operators can search, own, acknowledge and resolve failed runs.
- Canonical PMO state is never used as the operations store.

## Deployment outcome

Merge and deploy after persistence, recovery and redaction tests pass.
