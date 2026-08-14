# Agent canary runbook

The canary submits a controlled no-change statement to a dedicated project,
waits for a governed terminal receipt, rereads the canonical document and
fails if the revision changes or terminal latency exceeds 30 seconds. It never
publishes proposals, archives workflows or uses production project evidence.

Configure these GitHub repository values before enabling live execution:

- variable `OET_N8N_CANARY_WEBHOOK`: the published lean webhook URL;
- variable `OET_N8N_CANARY_ORGANISATION_ID`: the governed UAT organisation;
- variable `OET_N8N_CANARY_PROJECT_ID`: a dedicated disposable canary project;
- secret `OET_N8N_CANARY_WEBHOOK_SECRET`: the webhook credential.

The scheduled workflow runs at minutes 17 and 47. Until all values are present,
it performs contract verification only and reports that live execution is
inactive. Inspect the retained `agent-canary-result` artifact for correlation,
terminal state, before/after revisions and latency. Rotate the secret outside
the repository; never paste it into an issue, artifact or workflow JSON.

On failure, preserve the result artifact, inspect Agent operations by
correlation ID, and follow the recovery runbook. Do not retry a receipt with an
unknown outcome until its original idempotency key has been reconciled.
