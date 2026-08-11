import { expect, test } from "@playwright/test";
import { legacyAgentRun } from "../src/lib/agent-contracts";
import { AgentOperationRecordSchema, buildAgentOperationRecord, updateAgentOperationRecord } from "../src/lib/agent-operations";
import { AGENT_CATALOGUE, assertScopedCanonicalWrite, classifyDuplicates, runEscalations, runProgress } from "../src/lib/agent-control-plane";

function run() {
  return legacyAgentRun({
    meta: { wpId: "WP-05E", title: "Persistent operations", requested_at: "2026-08-11T12:00:00.000Z", agent_workflows: "risk.analyse" },
    evidence: [{ name: "status.txt", contentHash: "abc123" }],
    wpId: "WP-05E",
  });
}

test("builds a redacted persistent run index with immutable lineage", () => {
  const original = buildAgentOperationRecord({
    scope: { organisationId: "org_test01", projectId: "prj_test01" },
    run: run(),
    descriptor: { workPackageId: "WP-05E", textUpdatePresent: true, evidence: [{ name: "status.txt", mediaType: "text/plain", size: 42, contentHash: "abc123" }] },
    actor: { userId: "usr_test01", displayName: "PMO Lead" },
  });
  const retryRun = { ...run(), executionId: "agent:retry:05e", operations: { ...run().operations, attempt: 2, retryOf: original.executionId } };
  const retry = buildAgentOperationRecord({ run: retryRun, scope: original.scope, descriptor: original.input, source: original, recoveryMode: "retry" });

  expect(AgentOperationRecordSchema.parse(retry)).toEqual(retry);
  expect(retry.lineage).toMatchObject({ rootExecutionId: original.executionId, sourceExecutionId: original.executionId, recoveryMode: "retry" });
  expect(retry.idempotency).toMatchObject({ key: original.idempotency.key, duplicateOf: original.executionId });
  expect(original.accountableActor.displayName).toBe("PMO Lead");
  expect(JSON.stringify(retry)).not.toContain("temporary workspace credential");
  expect(JSON.stringify(retry)).not.toContain("raw evidence content");
});

test("exposes release-bound catalogue and honest run control state", () => {
  expect(AGENT_CATALOGUE).toHaveLength(9);
  expect(new Set(AGENT_CATALOGUE.map((item) => item.liveBindingId)).size).toBe(9);
  expect(AGENT_CATALOGUE.every((item) => item.availability === "release_verified")).toBe(true);
  expect(runProgress(run())).toMatchObject({ completed: 0, total: 1, percent: 0, timeoutState: "within_budget" });
  expect(runEscalations(run())).toEqual([]);
});

test("fails closed on cross-scope publication and classifies duplicate recovery", () => {
  const original = buildAgentOperationRecord({ run: run(), scope: { organisationId: "org_test01", projectId: "prj_test01" }, descriptor: { workPackageId: "WP-05E", textUpdatePresent: false, evidence: [] } });
  const replay = buildAgentOperationRecord({ run: { ...run(), executionId: "agent:replay" }, scope: original.scope, descriptor: original.input, source: original, recoveryMode: "replay" });
  expect(classifyDuplicates([original, replay])[1]).toMatchObject({ duplicateOf: original.executionId });
  expect(() => assertScopedCanonicalWrite({ record: original, organisationId: "org_other1", projectId: original.scope.projectId, reviewOutcome: "accepted" })).toThrow(/scope/);
  expect(() => assertScopedCanonicalWrite({ record: original, ...original.scope, reviewOutcome: "pending" })).toThrow(/accepted review/);
  expect(assertScopedCanonicalWrite({ record: original, ...original.scope, reviewOutcome: "accepted" })).toBe(true);
});

test("records cancellation as a local operator request without claiming remote cancellation", () => {
  const original = buildAgentOperationRecord({ run: run(), scope: { organisationId: "org_test01", projectId: "prj_test01" }, descriptor: { workPackageId: "WP-05E", textUpdatePresent: false, evidence: [] } });
  const requested = updateAgentOperationRecord(original, { cancellation: { actor: "Operations lead", reason: "Execution exceeded the expected business window." } });
  expect(requested.cancellation).toMatchObject({ capability: "request_only", state: "requested", requestedBy: "Operations lead" });
});

test("records ownership, acknowledgement, resolution and append-only notes", () => {
  const original = buildAgentOperationRecord({ run: run(), scope: { organisationId: "org_test01", projectId: "prj_test01" }, descriptor: { workPackageId: "WP-05E", textUpdatePresent: false, evidence: [] } });
  const acknowledged = updateAgentOperationRecord(original, { state: "acknowledged", owner: "Operations lead", note: { author: "Operations lead", message: "Reviewed failed step and evidence descriptors." } });
  const resolved = updateAgentOperationRecord(acknowledged, { state: "resolved", note: { author: "Operations lead", message: "Recovery completed under a linked execution." } });

  expect(original.operator.notes).toHaveLength(0);
  expect(acknowledged.operator.notes).toHaveLength(1);
  expect(resolved.operator.notes).toHaveLength(2);
  expect(resolved.operator).toMatchObject({ state: "resolved", owner: "Operations lead" });
  expect(resolved.recordVersion).toBe(3);
});
