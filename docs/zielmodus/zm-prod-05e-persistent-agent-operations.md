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

## Implementation record

- Added the versioned `agent-operations-1.0` run-index contract with immutable lineage, workflow-version snapshots, operator ownership, acknowledgement, resolution and append-only notes.
- Persisted operational records in a dedicated IndexedDB database rather than the canonical PMO document.
- Stored only filenames, media types, sizes, optional hashes and work-package references in the searchable run index.
- Encrypted original recovery submissions with AES-256-GCM using a PBKDF2-derived workspace key; the credential and plaintext evidence are never persisted in the run index.
- Added reload-safe retry and replay. Every recovery generates a new linked execution; replay shows recorded version differences and requires confirmation.
- Added state and free-text filters, ten-row pagination, assignment, resolution/reopen and immutable note controls.
- Added contract tests for redaction, lineage and append-only governance plus a browser test that reloads before replaying the encrypted original input.
