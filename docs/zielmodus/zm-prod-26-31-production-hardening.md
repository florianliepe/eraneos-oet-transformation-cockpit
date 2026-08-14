# ZM-PROD-26–31 — Agent production hardening

## System instruction

Execute ZM-PROD-26 through ZM-PROD-31 strictly in sequence. Treat every slice
as an independently reviewable and recoverable release. Preserve proposal-only
agent persistence, accountable review, exactly-once governed publication,
workspace isolation and credential secrecy. Run the slice-specific verifier,
the cumulative governance suite and the GitHub Pages deployment gate before
starting the next slice. Azure activation and destructive workflow cleanup are
out of scope.

## ZM-PROD-26 — Terminal lifecycle and recovery

Guarantee that every accepted run reaches an authoritative terminal result or
is reconciled into a safe terminal timeout. Bound browser polling, preserve one
correlation and idempotency identity, reject receipt scope/identity drift, and
persist stale accepted/running receipts as `RUN_TERMINAL_TIMEOUT` before
returning them.

Acceptance gate:

- terminal receipts require `completedAt` and a valid result or safe error;
- status polling is bounded to 120 seconds and three transient status errors;
- status receipts cannot change run, correlation, idempotency or workspace;
- stale receipts are persisted after three bounded GitHub retries;
- success, durable failure, reconciliation and request-boundary tests pass.

Implementation status: implemented locally on 2026-08-14. The workflow graph
contains a durable stale-run reconciliation branch and the browser client uses
the shared lifecycle policy.

## ZM-PROD-27 — Release-safe n8n promotion

Require a deterministic checksummed candidate release, a versioned model
capability contract, full graph validation, a recorded rollback workflow and a
non-destructive canary before promotion. Reject duplicate identities, dangling
edges, orphan runtime nodes, invalid Code nodes, unsupported model settings,
credential-shaped values and obsolete runtime markers.

Acceptance gate:

- workflow source artifacts remain inactive and checksummed;
- every connection resolves to a unique node identity;
- isolated runtime nodes and stale legacy references fail verification;
- the configured model and agent limits match the capability contract;
- candidate, rollback, endpoint and canary requirements are explicit.

Implementation status: implemented locally on 2026-08-14. Promotion remains a
governed live action after the candidate canary passes.

## ZM-PROD-28 — Publisher retry and exactly-once hardening

Separate terminal authorization, scope, lineage and revision validation from
the retrying integration boundary. Limit transient publisher execution to two
attempts with a two-second delay, reread canonical state inside every attempt,
and use the immutable publication idempotency audit to resolve an uncertain
first write without a second revision. Never retry the GitHub canonical-write
node independently.

Acceptance gate:

- terminal validation fails before the retrying subworkflow boundary;
- every publisher attempt records `publisher-retry-1.0` lineage;
- every retry validates against a freshly read canonical document;
- the integration uses at most two attempts and the write node has no nested
  retry policy;
- accepted, rejected, duplicate and cross-project publication tests pass.

Implementation status: implemented locally on 2026-08-14; LA-12 structural
recovery evidence is reproducible without mutating production data.

## ZM-PROD-29 — Agent accuracy and evidence evaluation

Completed in source and release gates. A sanitized ten-case evidence corpus now
covers text, XML, PNG/OCR, PDF and XLSX plus no-change, contradiction, prompt
injection and incomplete high-impact scenarios. The blocking evaluator requires
at least 90% critical-field accuracy, 100% evidence attribution, at least 95%
no-change accuracy, 100% fail-closed handling of incomplete high-impact input
and zero unauthorized canonical writes. The lean prompt and bounded governance
tool additionally require accountable owner roles and all five change-impact
fields before a high-impact proposal may proceed to review.

## ZM-PROD-30 — Latency and runtime efficiency

Completed in source and release gates. The runtime gate separates a fresh
30-run routine baseline from a mixed ten-run sample: releases require at least
99% routine success, routine P50/P95 below 6/10 seconds and mixed P95 below
20 seconds. The observed routine P50/P95 is 5.128/8.226 seconds with 100%
success; the mixed P95 is 18.742 seconds. The stricter 5/8-second improvement
targets remain visible as non-blocking gaps of 128/226 ms. Terminal envelopes
now record runtime class, tool-call count, evidence size and phase timings so
future optimization can distinguish model/tool time from persistence time.

## ZM-PROD-31 — Operational observability and canaries

Completed in source and release gates. Operational health now derives terminal
success rate, P50/P95 latency, stale-run count, runtime classes, failure codes
and workflow-version distribution from governed run envelopes, alongside the
committed accuracy and runtime baselines. A scheduled/manual GitHub Actions
canary validates a dedicated-project, no-change, zero-canonical-write contract
and retains its sanitized result. Live calls remain safely inactive until the
dedicated canary project variables and webhook secret are configured; contract
verification still runs without credentials. No Azure activation or workflow
archival is included.
