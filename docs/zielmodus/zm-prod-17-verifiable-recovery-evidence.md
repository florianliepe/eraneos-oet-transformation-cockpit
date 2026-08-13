# ZM-PROD-17 — Verifiable operational recovery evidence

## Zielmodus instruction

Treat operational readiness as a checked release contract, not a self-attested
boolean. Recovery evidence must use a current versioned schema, be no older than
30 days, contain unique passing scenarios, remain explicitly non-destructive,
and point to an existing repository artifact, an approved verification command
or a valid GitHub Actions run bound to a full commit SHA. Invalid, stale,
missing, duplicate or unapproved evidence must fail the release.

Keep diagnostics privacy-safe, telemetry disabled by default, workflow release
compatibility fail-closed, performance budgets enforced, and the GitHub Pages
plus n8n support boundary explicit. Azure production activation remains
deferred.

## Acceptance gate

- Recovery evidence older than 30 days or future-dated fails verification.
- Missing paths, unapproved commands, malformed run IDs and abbreviated commit
  hashes fail verification.
- Backup/restore, checksummed n8n recovery, Pages rollback, no-write publication
  smoke and the signed live Pages deployment are all represented.
- Release, security, accessibility, compatibility, performance and exported
  Pages gates remain green.

## Implementation status

Implemented locally on 2026-08-13. Operational and complete release
verification pass; the Pages export is within budget, accessibility passes 5/5,
Chromium/Firefox compatibility passes 2/2, the exported-path test passes and
the production dependency audit reports zero vulnerabilities. Final hosted
checks and deployment remain.
