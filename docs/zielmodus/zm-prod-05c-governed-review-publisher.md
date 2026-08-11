# ZM-PROD-05C — Governed review and publisher

## Objective

Separate agent proposals from canonical PMO writes and require accountable human review for material changes.

## Work package

1. Add proposal-set and review-decision contracts with immutable source execution identifiers.
2. Store proposals without modifying canonical PMO objects.
3. Add a cockpit review inbox with field-level comparison and selective accept/reject actions.
4. Classify changes by risk and require explicit rationale for high-impact approval or rejection.
5. Create a dedicated publisher workflow as the only agent-path writer to canonical PMO state.
6. Validate authorization, schema, object version, evidence, idempotency and approval immediately before publishing.
7. Audit proposal generation, review and publication as separate events.

## Acceptance gate

- Specialist and governance workflows cannot write the canonical PMO document.
- Duplicate publication requests cannot create duplicate revisions.
- Every accepted change has evidence, review, audit and object-version lineage.
- Rejected changes leave canonical state unchanged.

