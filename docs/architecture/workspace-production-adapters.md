# Workspace production adapter contracts

## Status and activation gate

This document defines the production boundary for the Eraneos Transformation Cockpit. It does not activate Azure. GitHub Pages remains an explicitly labelled local demonstrator; an Azure App Service artifact is built in fail-closed `production` mode and cannot instantiate browser-local identity or persistence.

Production activation requires an Azure subscription and target environment, approved identity/privacy configuration, OIDC deployment access, database connectivity, operational ownership and completed security tests.

## Runtime profiles

| Target | Public mode | Identity | Workspace and project data |
| --- | --- | --- | --- |
| Local development | `local_demo` | `local_browser` | `local_browser` |
| GitHub Pages MVP | `local_demo` | `local_browser` | `local_browser` |
| Azure App Service | `production` | `entra_external_id` | `app_service_api` |

The build gate rejects every other combination. Runtime mode is not an authorisation decision: the API must validate the authenticated principal, organisation membership, project membership and requested operation on every request.

## Microsoft Entra External ID adapter

The production `IdentityProvider` adapter delegates self-service sign-up, invitation redemption, email verification, recovery and MFA to Microsoft Entra External ID. The browser receives only standards-based session material appropriate to the chosen confidential web application pattern. Account passwords, recovery secrets and reusable invitation secrets never enter cockpit persistence, logs, analytics or n8n requests.

Required claims are a stable external subject, tenant/issuer, verified email state and display name. Application organisation and project roles remain server-owned domain data; they are not trusted from mutable browser claims. Sign-out terminates the application session and invokes the configured identity-provider logout. Disabled identities and revoked memberships fail closed.

## App Service API adapter

The API implements the existing `IdentityProvider`, `WorkspaceRepository` and `ProjectDataRepository` behaviours over authenticated endpoints. Each mutation requires CSRF protection where cookie sessions are used, an idempotency key, expected object version and accountable actor. Responses use generic identity and invitation errors, bounded pagination and a stable error contract. The API applies per-principal and per-IP rate limits to registration, sign-in, recovery and invitation attempts.

Every request carries a server-derived `organisationId` and `projectId` scope. Client-supplied scope is treated only as a requested resource and is checked against active membership. n8n credentials and workflow endpoints remain server-side; agent execution inherits the initiating user's effective project authority and returns proposal-only output for governed review.

Minimum operational endpoints cover session context, organisations, memberships, invitations, project lifecycle, scoped PMO documents, agent runs, reviews, audit events and reports. Health endpoints must not expose secrets or tenant data.

## PostgreSQL adapter

Use opaque identifiers and composite tenant keys. Organisation-owned tables include `organisation_id`; project-owned tables include both `organisation_id` and `project_id`. Foreign keys bind projects to their organisation and all project children to the same composite project key. Membership, invitation, PMO object, evidence, review, audit, object-version and agent-operation tables preserve the contract versions and lineage already used by the application.

Database roles expose no public access. The API uses parameterised queries, least-privilege credentials from managed configuration, encrypted transport and an explicit transaction for membership, publication and audit changes. Row-level security is recommended as defence in depth, with transaction-local tenant context set only after server authorisation. Unique constraints enforce normalised account email within the selected identity model, organisation slugs, invitation verifier hashes and idempotency keys.

Audit and immutable object-version records are append-only to normal application roles. Deletion uses recoverable lifecycle states and retention policy; it does not silently remove evidence or governance lineage.

## Configuration and secrets

The repository validates these non-secret build selectors: `DEPLOYMENT_TARGET`, `NEXT_PUBLIC_WORKSPACE_RUNTIME_MODE`, `WORKSPACE_IDENTITY_ADAPTER`, `WORKSPACE_REPOSITORY_ADAPTER` and `PROJECT_DATA_ADAPTER`. The App Service profile only accepts `production`, `entra_external_id` and `app_service_api`.

Tenant IDs, client IDs, private credentials, database connection material, cookie keys and n8n credentials belong in approved Azure configuration or Key Vault references. They must not use `NEXT_PUBLIC_` names, Git history, build artifacts or browser storage. Startup validation must reject missing, placeholder, malformed or non-TLS production endpoints before serving authenticated routes.

## Production acceptance

Activation requires verified sign-up and invitation journeys, MFA/recovery policy, session expiry and revocation, last-owner protection, cross-tenant negative tests, rate-limit tests, security logging, backup/restore evidence, privacy and retention approval, monitored health/SLOs, and a rehearsed rollback. Until then the production sign-in route deliberately reports that secure identity is not activated.
