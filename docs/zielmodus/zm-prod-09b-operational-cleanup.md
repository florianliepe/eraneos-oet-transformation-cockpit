# ZM-PROD-09B — Operational cleanup and observability

## Objective

Remove operational ambiguity and make the current GitHub Pages and n8n production baseline observable and maintainable.

## Work package

1. Inventory authoritative and obsolete n8n workflow IDs without deleting anything automatically.
2. Add a safe cleanup procedure requiring explicit confirmation before archival or deletion.
3. Resolve actionable GitHub Actions runtime deprecation warnings by upgrading supported actions.
4. Define and verify execution-retention, pruning and log-redaction configuration for the managed n8n host.
5. Add availability, authentication-failure, dead-letter and repeated-execution-failure monitoring contracts.
6. Add an operator health view showing release, workflow bindings, evaluation status and actionable incidents.
7. Extend release verification to fail on stale bindings or missing operational ownership.

## Acceptance gate

- Every production workflow has exactly one authoritative live binding.
- Obsolete workflows are identified but not destructively removed without confirmation.
- CI contains no actionable deprecated-action warning owned by this repository.
- Retention, redaction and alert thresholds are source controlled and visible to operators.
- The operator health view identifies the affected workflow and response action.

## Deployment outcome

Merge through a green pull request and verify the GitHub Pages deployment before starting ZM-PROD-05E.

## Implementation record

Completed on 2026-08-11.

- Nine authoritative live workflow bindings are unique and release-aligned.
- Six obsolete or non-production workflow candidates are inventoried with destructive actions disabled; cleanup requires exact-ID confirmation.
- GitHub Pages actions use the current Node.js 24-compatible major releases.
- Retention, redaction, alert thresholds and operational owners are defined in `config/operational-policy.json`.
- The cockpit Operational health view shows release readiness, core bindings, quality status and actionable operator signals.
- `npm run verify:operations` blocks stale bindings, unsafe cleanup policy, missing ownership and deprecated Pages action versions.
