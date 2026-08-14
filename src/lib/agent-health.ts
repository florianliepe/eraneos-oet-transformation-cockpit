import type { AgentRunEnvelope } from "@/lib/agent-contracts";

export type AgentHealthSummary = {
  total: number;
  terminal: number;
  successRate: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  staleRuns: number;
  byFailureCode: Record<string, number>;
  byRuntimeClass: Record<string, number>;
  byWorkflowVersion: Record<string, number>;
};

const percentile = (values: number[], fraction: number) => values.length ? [...values].sort((a, b) => a - b)[Math.ceil(values.length * fraction) - 1] : 0;

export function summarizeAgentHealth(runs: AgentRunEnvelope[], now = Date.now()): AgentHealthSummary {
  const terminalRuns = runs.filter((run) => ["completed", "needs_review", "failed", "superseded"].includes(run.status));
  const successful = terminalRuns.filter((run) => ["completed", "needs_review"].includes(run.status));
  const latencies = terminalRuns.flatMap((run) => {
    const value = run.operations.latencyMs ?? (run.completedAt ? Date.parse(run.completedAt) - Date.parse(run.requestedAt) : NaN);
    return Number.isFinite(value) && value >= 0 ? [value] : [];
  });
  const byFailureCode: Record<string, number> = {};
  const byRuntimeClass: Record<string, number> = {};
  const byWorkflowVersion: Record<string, number> = {};
  for (const run of runs) {
    const runtimeClass = run.operations.runtimeClass || "unclassified";
    byRuntimeClass[runtimeClass] = (byRuntimeClass[runtimeClass] || 0) + 1;
    byWorkflowVersion[run.orchestrator.workflowVersion] = (byWorkflowVersion[run.orchestrator.workflowVersion] || 0) + 1;
    if (run.status === "failed") {
      const code = run.warnings[0]?.code || "UNCLASSIFIED_FAILURE";
      byFailureCode[code] = (byFailureCode[code] || 0) + 1;
    }
  }
  return {
    total: runs.length,
    terminal: terminalRuns.length,
    successRate: terminalRuns.length ? successful.length / terminalRuns.length : 1,
    p50LatencyMs: percentile(latencies, 0.5),
    p95LatencyMs: percentile(latencies, 0.95),
    staleRuns: runs.filter((run) => ["waiting", "running"].includes(run.status) && now - Date.parse(run.requestedAt) >= 120000).length,
    byFailureCode,
    byRuntimeClass,
    byWorkflowVersion,
  };
}
