# ZM-PROD-05B — Specialist n8n workflows

## Objective

Replace prompt-only specialist selection with six independently versioned n8n sub-workflows coordinated by one orchestrator.

## Work package

1. Create specialist workflow JSON for `evidence.verify`, `delivery.plan`, `risk.analyse`, `meeting.synthesise`, `controls.classify` and `governance.review`.
2. Give every workflow the ZM-PROD-05A input/output contract and deterministic validation nodes.
3. Add orchestrator fan-out/fan-in through Execute Sub-workflow nodes.
4. Preserve untrusted-evidence boundaries and existing credential references.
5. Add fixture-driven workflow contract verification.
6. Import the workflows into the signed-in n8n project, bind existing credentials, activate specialists and activate the orchestrator.
7. Run a non-destructive evidence test and compare the live response with the checked-in contract.

## Acceptance gate

- Each selected specialist executes as a distinct n8n workflow.
- Unselected specialists do not execute.
- Every result contains workflow and prompt versions, confidence, evidence references and warnings.
- The active live workflow matches the checked-in export.

