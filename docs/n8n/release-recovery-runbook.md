# n8n workflow release and recovery runbook

## Ownership and release evidence

- Product owner: OET Transformation Cockpit product owner.
- Release operator: OET AI Suite workflow administrator.
- Incident lead: designated PMO platform operator.
- Canonical release evidence: `docs/n8n/releases/2026-08-11-zm-prod-09a.json`, the merge commit, GitHub Actions run, n8n version name, and a non-destructive smoke execution.
- Credential owners rotate values in n8n. Values, tokens, passwords, and MFA material are never exported to Git.

## Promotion

1. Build and verify workflow exports: `npm run build:workflow-release` and `npm run verify:workflow-release`.
2. Require lint, type check, static build, agent evaluations, workflow verifiers, and browser tests on the pull request.
3. Import each changed workflow into a blank n8n canvas. Never import onto an existing canvas because n8n appends nodes.
4. Publish dependencies first: specialists, governed publisher, then error handler. Record live IDs in `docs/n8n/agents/manifest.json` and rebuild the orchestrator.
5. Unpublish the previous orchestrator, import the new orchestrator, and publish it with the release ID as version name. The webhook path must remain unchanged.
6. Run the checked-in non-destructive smoke workflows. Merge only after the assertions pass, then verify GitHub Pages.

## Rollback and restore

Rollback criteria include invalid contracts, evaluation regression, failed webhook reads, unexpected canonical writes, repeated dead letters, or security exposure. Preserve canonical PMO data: workflow rollback never restores or overwrites `knowledge/pmo/control-tower.json`.

1. Select the last green release manifest and verify every SHA-256 checksum.
2. Import the checksummed dependency workflows into blank canvases and bind the credential names listed in the release manifest; never copy credential values.
3. Update live IDs, rebuild, and verify the orchestrator. Confirm webhook method/path and all five modes are unchanged.
4. Unpublish the faulty orchestrator, publish the restored orchestrator, and run read plus non-destructive rejection/duplicate smoke tests.
5. Record old/new workflow IDs, operator, reason, timestamps, smoke result, Git commit, and incident reference. Keep the faulty executions and dead letters immutable.

Recovery rehearsal evidence: checked-in smoke workflow restored as non-production workflow `i7R67pfWGa9C7fFD`; rejection and duplicate cases completed successfully without a canonical write or revision change.

## Security and data handling

The managed n8n host does not expose server CLI access, so `n8n audit` cannot be executed from this project. Compensating verification scans release metadata for credential-value fields, keeps credentials bound by name/ID only, requires header authentication, uses a private data repository, and validates the public bundle. A platform administrator should run the native n8n security audit after upgrades and attach its report to the release record.

- Redact authorization headers, source document bodies, model prompts, extracted evidence, and credential-shaped values from incident excerpts.
- Retain successful execution metadata for 30 days, failed executions/dead letters for 90 days, and approved audit/object-version records according to business retention policy. Confirm host settings with the platform owner.
- Until an edge gateway is available, treat the shared-secret webhook as MVP-only. Alert at 30 requests/minute per workspace or 10 failed authentications in 5 minutes; immediately rotate the header credential after suspected disclosure.
- Triage: protect data and disable the affected workflow, preserve execution IDs/logs, classify canonical-write impact, restore a green release, validate read and no-write smoke paths, then document root cause and remediation.

## Capacity triggers

Remain in regular execution mode until measurement shows any trigger for two consecutive weeks: p95 workflow latency above 30 seconds, more than 20 concurrent executions, more than 2% retry rate, or more than 1 GB/day of binary evidence. At that point assess queue mode, worker isolation, Redis, and external binary storage. Do not introduce this infrastructure without measured demand and an operations owner.
