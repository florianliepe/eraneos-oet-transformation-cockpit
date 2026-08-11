# Zielmodus delivery sequence

The active roadmap is delivered as small, independently verifiable work packages. Each completed slice is merged to `main`, deployed to GitHub Pages and verified before the next slice starts.

| Order | Zielmodus | Outcome | Deployment gate |
| --- | --- | --- | --- |
| 1 | [ZM-PROD-05A](zm-prod-05a-agent-contracts-run-ux.md) | Versioned agent contracts and transparent run UX | Contract, UI, build and Pages tests pass |
| 2 | [ZM-PROD-05B](zm-prod-05b-specialist-workflows.md) | Six independently versioned n8n specialist workflows | Workflows imported, credential bindings verified and activated |
| 3 | [ZM-PROD-05C](zm-prod-05c-governed-review-publisher.md) | Proposal, human review and controlled publisher boundary | No specialist can write canonical PMO state directly |
| 4 | [ZM-PROD-05D](zm-prod-05d-agent-quality-operations.md) | Evaluation, retry, replay and operational visibility | Evaluation and failure-recovery gates pass |
| 5 | [ZM-PROD-09A](zm-prod-09a-release-recovery.md) | Workflow release promotion, backup and recovery | Export, restore and rollback are rehearsed |
| 6 | [ZM-PROD-10](zm-prod-10-multi-tenant-workspace-foundation.md) | Landing page, local identity boundary, organisation governance and isolated multi-project workspaces | Identity, tenancy, accessibility, regression and Pages gates pass |

Azure production identity and persistence activation, SharePoint integration and Teams integration are explicitly deferred until they become relevant and the required platform access exists. ZM-PROD-10 prepares replaceable adapters without treating local browser identity as production security.

## Standing delivery rules

- Preserve PMO schema v2.0, evidence, audit and object-version guarantees.
- Agents produce traceable proposals. Canonical writes require the governed publisher introduced in ZM-PROD-05C.
- Do not expose credentials in the browser, repository, build output or logs.
- Keep the application client-neutral and independent from prior pilot repositories.
- Use the existing signed-in n8n browser session for live workflow administration; never request passwords or MFA codes.
- Auto-deploy every completed slice through a reviewed pull request to GitHub Pages.

