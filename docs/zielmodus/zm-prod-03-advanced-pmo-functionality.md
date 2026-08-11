# ZM-PROD-03 — Advanced PMO functionality

## Objective

Extend the governed cockpit from project control to programme and portfolio decision support.

## Work package

1. Add portfolio, programme, benefit, outcome, resource, financial and scenario contracts.
2. Add portfolio/programme hierarchy and governed cross-level references.
3. Add dependency-network and critical-path calculations with explainable assumptions.
4. Add baselines, forecasts, actuals and variance analysis for schedule, cost and benefits.
5. Add capacity and resource-demand views without personal workforce profiling.
6. Add scenario comparison and governed impact assessment.
7. Migrate fixtures, schemas, editors, audit, review, versioning and tests.

## Acceptance gate

- New objects are first-class, evidence-linked, reviewed, versioned and audited.
- Broken hierarchy and dependency references fail validation.
- Forecast and variance calculations are deterministic and tested.
- Scenario changes never overwrite the approved baseline without review.

## Deployment outcome

Deploy the expanded governed domain and decision views before executive reporting expansion.

## Implementation record

- Added first-class portfolio, programme, outcome, benefit, aggregate resource-pool, financial and scenario schemas with evidence, review, audit and object-version contracts.
- Added governed portfolio → programme → project hierarchy references and cross-level validation.
- Added deterministic dependency-network and longest-path calculation with explicit provider-to-consumer and governed-date assumptions; cycles block validation.
- Added deterministic cost baseline/forecast/actual variance, benefit target/forecast gap and non-personal capability capacity calculations.
- Added candidate-versus-approved scenario comparison; the approved baseline is immutable and candidate revisions remain pending review.
- Added a governed scenario editor that creates a new audit event and object version without changing the approved baseline.
- Added a responsive Programme decisions view covering hierarchy, value, capacity, finance, critical path and scenario impact.
- Migrated product-neutral fixtures and added validation, calculation, cycle, baseline-immutability and UI tests.
