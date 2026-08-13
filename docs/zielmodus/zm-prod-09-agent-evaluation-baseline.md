# ZM-PROD-09 — Live agent evaluation and accuracy baseline

## Zielmodus instruction

Establish a dual-layer release gate for every n8n agent change. Keep the deterministic 30-case specialist suite for fast negative-path regression and add sanitized captures from real executions against the authoritative n8n workflow. Score contract validity, object precision/recall, critical-field accuracy, evidence attribution, no-change accuracy, unauthorized canonical writes and latency. Never commit credentials, personal data, full canonical documents or confidential source content. A blocking regression prevents workflow promotion; latency above target remains visible as an optimization input for ZM-PROD-14.

## Acceptance gate

- Every specialist retains positive, incomplete, contradictory, duplicate and prompt-injection deterministic coverage.
- Live XML, PNG/OCR, PDF and no-change executions are represented by minimal sanitized captures.
- Live proposal identity and critical fields score at least 90%; evidence attribution is 100%.
- No live specialist execution increments canonical revision before accountable publication.
- The committed machine-readable and human-readable reports are reproducible and checked by CI.
- A real n8n canary is executed before promotion and bound to the recorded workflow release.

## Implementation status

Completed on 2026-08-13. The first live canary exposed an unselected-domain risk proposal, so promotion was blocked. The orchestrator now filters every proposal against the routing receipt. The identical rerun on authoritative workflow `2gICFodknzpc1WAc` produced only the selected issue and action, retained proposal-only persistence and left canonical revision 2 unchanged. The prior workflow remains unpublished as a rollback candidate.
