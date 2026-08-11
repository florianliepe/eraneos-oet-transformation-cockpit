# ZM-PROD-09A — Workflow release and recovery

## Objective

Establish a production-operability baseline for the current GitHub Pages and n8n architecture without depending on Azure, SharePoint or Teams.

## Work package

1. Version workflow exports, manifest, checksums and compatibility metadata in Git.
2. Define development-to-production promotion and rollback procedures supported by the available n8n edition.
3. Add workflow backup, credential-binding inventory and restore verification without exporting credential values.
4. Run the n8n security audit where supported and document remediation.
5. Define execution-data retention, log redaction, rate limits and incident triage.
6. Rehearse workflow rollback and recovery using a non-production execution.
7. Document capacity triggers for queue mode and external binary storage; do not introduce them before measured demand.

## Acceptance gate

- A known workflow release can be restored and activated from the repository.
- Credential names and required scopes are documented without secret values.
- Recovery preserves endpoint contracts and canonical PMO data.
- Operational ownership, rollback criteria and evidence are recorded.

## Implementation record

Completed on 2026-08-11. The checksummed workflow release, credential-binding inventory, compatibility metadata, promotion/rollback procedure, recovery rehearsal evidence, security compensating controls, retention/redaction/rate-limit policy, incident triage, and capacity triggers are maintained in `docs/n8n/releases/2026-08-11-zm-prod-09a.json` and `docs/n8n/release-recovery-runbook.md`.
