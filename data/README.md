# Governed data contracts

This directory contains product-neutral JSON Schemas for the canonical project document, reporting-module summaries, and Steering Committee reports. PMO document v2.0 promotes issues, actions, decisions, dependencies, assumptions, and change requests to first-class registers.

Runtime project data is not committed to this repository. Protected services validate and persist tenant-specific records outside the frontend deployment artifact.

Evidence, review, audit-event, and immutable object-version records have standalone contracts and are referenced by the canonical PMO schema. Every reporting module supplies a version, source revision, freshness timestamp, metrics, claims, and explicit evidence gaps. The reporting layer consumes only those neutral contracts.
