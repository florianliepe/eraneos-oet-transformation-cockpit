# Pilot support and incident runbook

## Service boundary and ownership

The supported pilot is the public GitHub Pages frontend plus the existing protected n8n workflow boundary. Browser-local accounts and projects are demonstration data, not production identity or durable multi-device storage. Azure, Entra, Teams and SharePoint activation are excluded.

- Product owner: OET Transformation Cockpit product owner.
- Release operator: OET AI Suite workflow administrator.
- Incident lead: designated PMO platform operator.
- User support receives only a correlation ID, UTC time, affected surface and visible safe error. Never request passwords, workflow credentials, document content, prompts or authentication headers.

## Incident triage

1. Protect data: pause publication when canonical-write integrity, tenant scope or credentials may be affected.
2. Record the correlation ID and time; locate only redacted operational metadata in n8n execution history.
3. Compare runtime release and live binding IDs with the signed agent catalogue. `stale_binding` stops publication; `unknown` requires the checked-in verifier and operator confirmation.
4. Classify availability, contract, authentication, data-integrity or privacy impact. Preserve immutable executions and audit records.
5. Restore the last green checksummed workflow release or revert the faulty Git commit. Run read and no-write smoke paths, then verify Pages.
6. Record impact, cause, recovery, owner and prevention without copying user data or secrets.

## Verification and recovery

Run `npm run verify:release` locally. Backup/restore, workflow rollback and failed-release recovery evidence is recorded in `recovery-rehearsal.json`; the detailed production migration rehearsal remains deferred in `workspace-migration-rollback-test-plan.md`. Analytics remains off unless an approved HTTPS endpoint and explicit enable flag are configured.
