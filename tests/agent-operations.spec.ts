import { expect, test } from "@playwright/test";
import { legacyAgentRun } from "../src/lib/agent-contracts";
import { AgentOperationRecordSchema, buildAgentOperationRecord, updateAgentOperationRecord } from "../src/lib/agent-operations";

function run() {
  return legacyAgentRun({
    meta: { wpId: "WP-05E", title: "Persistent operations", requested_at: "2026-08-11T12:00:00.000Z", agent_workflows: "risk.analyse" },
    evidence: [{ name: "status.txt", contentHash: "abc123" }],
    wpId: "WP-05E",
  });
}

test("builds a redacted persistent run index with immutable lineage", () => {
  const original = buildAgentOperationRecord({
    run: run(),
    descriptor: { workPackageId: "WP-05E", textUpdatePresent: true, evidence: [{ name: "status.txt", mediaType: "text/plain", size: 42, contentHash: "abc123" }] },
  });
  const retryRun = { ...run(), executionId: "agent:retry:05e", operations: { ...run().operations, attempt: 2, retryOf: original.executionId } };
  const retry = buildAgentOperationRecord({ run: retryRun, descriptor: original.input, source: original, recoveryMode: "retry" });

  expect(AgentOperationRecordSchema.parse(retry)).toEqual(retry);
  expect(retry.lineage).toMatchObject({ rootExecutionId: original.executionId, sourceExecutionId: original.executionId, recoveryMode: "retry" });
  expect(JSON.stringify(retry)).not.toContain("temporary workspace credential");
  expect(JSON.stringify(retry)).not.toContain("raw evidence content");
});

test("records ownership, acknowledgement, resolution and append-only notes", () => {
  const original = buildAgentOperationRecord({ run: run(), descriptor: { workPackageId: "WP-05E", textUpdatePresent: false, evidence: [] } });
  const acknowledged = updateAgentOperationRecord(original, { state: "acknowledged", owner: "Operations lead", note: { author: "Operations lead", message: "Reviewed failed step and evidence descriptors." } });
  const resolved = updateAgentOperationRecord(acknowledged, { state: "resolved", note: { author: "Operations lead", message: "Recovery completed under a linked execution." } });

  expect(original.operator.notes).toHaveLength(0);
  expect(acknowledged.operator.notes).toHaveLength(1);
  expect(resolved.operator.notes).toHaveLength(2);
  expect(resolved.operator).toMatchObject({ state: "resolved", owner: "Operations lead" });
  expect(resolved.recordVersion).toBe(3);
});
