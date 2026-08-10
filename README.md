# eraneos Transformation Cockpit
_part of OET AI Suite_

A product-neutral project and transformation cockpit for governed delivery data, executive reporting, and controlled automation.

## MVP architecture

- Frontend: Next.js on Azure App Service
- Policy API: protected workflow/API boundary on a separate Azure App Service
- Source control: private GitHub repository with a credential-free deployment workflow
- Authentication: temporary workspace credential seam; Microsoft Entra ID is the production target
- Data: versioned PMO document plus neutral reporting-module summaries
- Reporting: evidence-backed Steering Committee snapshots with approval and publication states

SharePoint and Teams integrations are intentionally deferred. Azure infrastructure-as-code is also deferred for the current delivery slice.

## Local development

Requirements: Node.js 22 and npm.

```bash
npm ci
npm run dev
```

Open http://localhost:3000.

## Verification

```bash
npm run lint
npm run typecheck
npm run verify:governance-artifacts
npm run build
npm run test:e2e
```

The governance check validates required product-neutral contracts and rejects inherited client or legacy capability artifacts.

## Deployment

The workflow in `.github/workflows/deploy-app-service.yml` builds and deploys without stored Azure credentials. Configure GitHub environments and Azure workload-identity values when the App Services exist:

- `AZURE_CLIENT_ID`
- `AZURE_TENANT_ID`
- `AZURE_SUBSCRIPTION_ID`
- `AZURE_WEBAPP_NAME`

Production readiness still requires Entra ID, environment separation, managed secrets, persistence, observability, security testing, backup and recovery, operational runbooks, and an approved release gate.
