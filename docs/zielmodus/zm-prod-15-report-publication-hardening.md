# ZM-PROD-15 — Executive-report publication hardening

## Zielmodus instruction

Treat each executive report as an immutable, evidence-linked decision package
inside one governed organisation and target scope. Approval, publication,
revocation and restoration must form a valid chronological state machine;
invalid, duplicate or out-of-order transitions fail closed. Project and
portfolio targets must be unique, source fingerprints must remain current, and
exports must retain reproducible provenance without exposing secrets.

Preserve the existing browser-local MVP boundary and do not activate Azure,
SharePoint or Teams. Keep AI narratives visibly sourced or marked as missing,
retain accountable reviewer rationale, and never mutate an approved snapshot.

## Acceptance gate

- A project report binds exactly one unique project and a portfolio binds each
  project at most once.
- Publication is possible only after assigned-review approval and a current
  source fingerprint.
- Receipt order is `approved -> published -> revoked -> restored`; unsupported
  transitions, missing revoke/restore rationale and backdated receipts fail.
- Portfolio packs include approved snapshots only and preserve missing-project
  states and project-level provenance.
- PowerPoint and print/PDF-ready outputs remain reproducible from the immutable
  snapshot and embedded provenance manifest.

## Implementation status

Implemented and locally validated on 2026-08-13. The slice also corrected a
stale ZM-PROD-14 browser assertion so routine dependency/milestone evidence now
expects the delivery and PMO-controls specialists and explicitly excludes the
governance model. Focused executive-reporting and cockpit regression tests pass
29/29; the complete browser suite passes 109/109 together with the release,
standalone build, Pages build, exported-path and zero-high-vulnerability gates.
