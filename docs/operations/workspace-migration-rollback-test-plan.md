# Workspace migration, rollback and tenant-isolation test plan

## Purpose

Move the versioned local demonstration contracts to Entra External ID, App Service API and PostgreSQL without treating browser-local data as trusted production identity or silently mixing tenants. Azure execution is deferred; this is the mandatory runbook and evidence checklist for activation.

## Migration stages

1. Freeze and inventory the contract versions, local fixture lineage and target schema. Classify which demo records may be imported; never migrate local password verifiers, sessions, invitation verifiers or temporary workflow credentials.
2. Provision an isolated non-production environment with managed secrets, private database access, audit sinks and Entra test identities. Apply forward-only, checksum-controlled database migrations with a dedicated migration role.
3. Transform approved organisation, project and PMO records into a staging area. Generate new opaque production IDs, retain source-to-target lineage and validate every project resolves to exactly one organisation.
4. Reconcile record counts and hashes by tenant and object type. Verify evidence, reviews, audit events and object versions before allowing a project to be visible.
5. Run the isolation, authorisation, recovery and performance suites below. Obtain accountable security, product and operational sign-off.
6. Enable a bounded pilot organisation, observe error rate, latency, authorisation denials and audit completeness, then expand through an explicit change record.

## Backup and restore

- Take an encrypted database backup and record the restore point before every schema or data migration.
- Retain backups under the approved regional retention and deletion policy; restrict and audit restore permission.
- Quarterly, restore into an isolated environment, rotate restored secrets, verify schema checksums and reconcile tenant/object counts.
- Prove recovery point and recovery time objectives with timestamps and retained evidence. A backup is not accepted until restore validation succeeds.

## Rollback

Stop writes first, preserve API and database logs, and capture the failed migration identifier. For an application-only fault, route to the previous signed artifact while retaining the backward-compatible schema. For a data fault, restore to a new database from the verified recovery point, rerun reconciliation, then switch connection configuration through an approved change. Never run ad-hoc destructive SQL or delete migration history.

Rollback is complete only when session validation, tenant isolation, canonical PMO reads, proposal review/publication and audit continuity pass against the recovered environment. Document lost writes inside the measured recovery window and reconcile them through governed operations.

## Tenant-isolation suite

- Attempt organisation and project reads, writes, searches, exports and direct object lookups using another tenant's opaque IDs; expect indistinguishable deny/not-found responses.
- Exercise every role against organisation membership, invitations, owner changes, project lifecycle, PMO mutation, agent execution, review and publication. Confirm the final owner cannot be removed or downgraded.
- Modify client scope, URL parameters, request bodies, pagination cursors, idempotency keys and cached project selections. Confirm server-derived scope prevails.
- Verify PostgreSQL composite foreign keys and row-level policies reject cross-organisation project children, including bulk import and background jobs.
- Confirm n8n executions, evidence, recovery references, agent operations, review bundles, reports, logs, metrics and support tooling never expose another project or organisation.
- Run concurrent requests that switch memberships or archive projects while writes execute; confirm transactionally consistent denial and object-version conflict handling.

## Security and resilience suite

Test invitation expiry/revocation/replay, generic account lookup errors, email verification, MFA and recovery, session expiry/revocation, CSRF, CORS, input limits, abuse throttling and secret redaction. Exercise database outage, n8n timeout, partial publication, duplicate delivery and stale object versions. All agent output remains proposal-only and requires accountable review before canonical publication.

## Release evidence

Attach migration checksums, reconciliation output, isolation test results, restore evidence, rollback rehearsal, vulnerability results, data-protection approval, identity-policy approval, observability dashboards and named operational owners to the release record. Any missing item keeps production activation closed.
