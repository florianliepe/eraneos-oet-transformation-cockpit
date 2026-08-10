# Governed data contracts

This directory contains product-neutral JSON Schemas for the canonical project document, reporting-module summaries, and Steering Committee reports.

Runtime project data is not committed to this repository. Protected services validate and persist tenant-specific records outside the frontend deployment artifact.

Every reporting module supplies a version, source revision, freshness timestamp, metrics, claims, and explicit evidence gaps. The reporting layer consumes only that neutral contract.
