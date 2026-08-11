# GitHub Pages go-live

The live MVP frontend is a static Next.js export at:

`https://florianliepe.github.io/eraneos-oet-transformation-cockpit/`

The repository and application shell are public. Canonical PMO records remain in the separate private `florianliepe/eraneos-oet-transformation-cockpit-data` repository and are reachable only through the protected n8n orchestration boundary.

```text
GitHub Pages -> protected generic n8n webhook -> private generic data repository
       |                  |
  static frontend    validation, AI, audit and commits
```

## Runtime boundary

The approved production host is `eraneos-agentic-platform.azurewebsites.net`. The frontend accepts only HTTPS `/webhook/` endpoints on the explicit runtime allowlist. `NEXT_PUBLIC_*` configuration is always visible to site visitors and must never contain a credential.

The generic PMO workflow is versioned at `docs/n8n-pmo-orchestrator.workflow.json`. It supports:

- `pmo.read` for the schema-v2 canonical document;
- `pmo.save` for governed revision publication;
- `pmo.ingest` for evidence-bound specialist workflows: evidence verification, delivery planning, risk analysis, meeting synthesis, controls classification and governance review.
- `pmo.review` for immutable, field-level human review decisions;
- `pmo.publish` for the dedicated governed publisher, the only agent-path canonical writer.

Agent ingestion now stores proposal sets separately and returns the unchanged canonical document. The publisher revalidates authorization context, schema, canonical revision, object versions, evidence, review coverage, high-impact rationale, and idempotency immediately before a write.

Current ZM-PROD-05C live bindings are recorded in `docs/n8n/agents/manifest.json`. The non-destructive live smoke test covers rejected and duplicate publications and must return `shouldWrite: false` without changing the fixture revision.

The shared workspace credential is entered in the browser, retained only in React memory and sent as the `x-n8n-webhook-secret` header. Refreshing or closing the page clears it. Microsoft Entra ID remains the production identity target.

## Release

1. Import the generic workflow into n8n, bind a project-specific Header Auth credential, GitHub credential and OpenAI credential, then activate it.
2. Confirm the workflow writes only to the private generic data repository.
3. Configure the non-sensitive repository variable `NEXT_PUBLIC_N8N_PMO_WEBHOOK_URL` with the generic production webhook URL.
4. In **Settings > Pages**, choose **GitHub Actions** as the source.
5. Merge a validated pull request to `main`. Pull requests build the static export but never deploy it; pushes to `main` deploy through the protected `github-pages` environment.
6. Verify the public URL, asset prefix, invalid-credential rejection, valid read, governed save, evidence intake and exactly-one-revision persistence.

## Public MVP limitations

- The frontend code, Actions logs and site assets are public.
- The site must not be used for sensitive transactions or unrestricted production data.
- Users can inspect their own browser requests and extracted evidence payloads.
- The shared credential provides workspace access but not individual identity.
- SharePoint, Teams and Azure application infrastructure remain postponed.

## Rollback and unpublishing

- Roll back application code by reverting the release commit on `main`; Pages redeploys the prior static export.
- Disable deployment by disabling `deploy-pages.yml` or changing the Pages source in repository settings.
- Unpublish the site in **Settings → Pages** before removing a custom domain or changing visibility.
- On GitHub Free, changing the repository back to private unpublishes the Pages site. Keep the repository public until a private-repository Pages plan or another host is available.

## Verified release and recovery

The Pages workflow builds once, applies contract, security, accessibility, compatibility and performance gates, then uploads that exact `out` directory as the deployment artifact. Record the merge SHA and successful workflow run as the artifact signature. Verify the live asset prefix and release-specific UI marker after deployment; if they differ, stop workflow publication and revert the merge commit so the prior signed export is redeployed. The non-destructive rehearsal is recorded in `docs/operations/recovery-rehearsal.json`.
