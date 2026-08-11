import { z } from "zod";
import { AgentRunEnvelopeSchema, type AgentRunEnvelope } from "@/lib/agent-contracts";

export const AGENT_OPERATIONS_CONTRACT_VERSION = "agent-operations-1.0" as const;

export const AgentOperatorNoteSchema = z.object({
  id: z.string().min(1),
  author: z.string().min(1),
  message: z.string().min(1),
  createdAt: z.string().datetime(),
});

export const AgentOperationRecordSchema = z.object({
  contractVersion: z.literal(AGENT_OPERATIONS_CONTRACT_VERSION),
  recordVersion: z.number().int().positive(),
  executionId: z.string().min(1),
  run: AgentRunEnvelopeSchema,
  input: z.object({
    ref: z.string().min(1),
    workPackageId: z.string().min(1),
    textUpdatePresent: z.boolean(),
    evidence: z.array(z.object({
      name: z.string().min(1),
      mediaType: z.string().min(1),
      size: z.number().int().nonnegative(),
      contentHash: z.string().optional(),
    })),
  }),
  lineage: z.object({
    rootExecutionId: z.string().min(1),
    sourceExecutionId: z.string().optional(),
    recoveryMode: z.enum(["retry", "replay"]).optional(),
  }),
  versions: z.object({
    orchestrator: z.string().min(1),
    workflows: z.record(z.string(), z.string()),
  }),
  operator: z.object({
    state: z.enum(["unacknowledged", "acknowledged", "resolved"]),
    owner: z.string().optional(),
    acknowledgedAt: z.string().datetime().optional(),
    resolvedAt: z.string().datetime().optional(),
    notes: z.array(AgentOperatorNoteSchema),
  }),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type AgentOperationRecord = z.infer<typeof AgentOperationRecordSchema>;
export type AgentOperatorState = AgentOperationRecord["operator"]["state"];

export type RecoveryInputDescriptor = {
  workPackageId: string;
  textUpdatePresent: boolean;
  evidence: Array<{ name: string; mediaType: string; size: number; contentHash?: string }>;
};

const safeId = (value: string) => value.replace(/[^A-Za-z0-9._:-]/g, "-").slice(0, 140);

export function buildAgentOperationRecord(input: {
  run: AgentRunEnvelope;
  descriptor: RecoveryInputDescriptor;
  source?: AgentOperationRecord;
  recoveryMode?: "retry" | "replay";
}): AgentOperationRecord {
  const now = new Date().toISOString();
  const inputRef = `recovery:${safeId(input.run.executionId)}`;
  return AgentOperationRecordSchema.parse({
    contractVersion: AGENT_OPERATIONS_CONTRACT_VERSION,
    recordVersion: 1,
    executionId: input.run.executionId,
    run: input.run,
    input: { ref: inputRef, ...input.descriptor },
    lineage: {
      rootExecutionId: input.source?.lineage.rootExecutionId || input.run.executionId,
      sourceExecutionId: input.source?.executionId,
      recoveryMode: input.recoveryMode,
    },
    versions: {
      orchestrator: input.run.orchestrator.workflowVersion,
      workflows: Object.fromEntries(input.run.steps.map((step) => [step.workflowId, step.workflowVersion])),
    },
    operator: { state: "unacknowledged", notes: [] },
    createdAt: now,
    updatedAt: now,
  });
}

export function updateAgentOperationRecord(record: AgentOperationRecord, update: {
  state?: AgentOperatorState;
  owner?: string;
  note?: { author: string; message: string };
}): AgentOperationRecord {
  const now = new Date().toISOString();
  const state = update.state || record.operator.state;
  const notes = update.note ? [...record.operator.notes, {
    id: `note:${Date.now().toString(36)}:${record.operator.notes.length + 1}`,
    author: update.note.author.trim(),
    message: update.note.message.trim(),
    createdAt: now,
  }] : record.operator.notes;
  return AgentOperationRecordSchema.parse({
    ...record,
    recordVersion: record.recordVersion + 1,
    operator: {
      ...record.operator,
      state,
      owner: update.owner?.trim() || record.operator.owner,
      acknowledgedAt: state !== "unacknowledged" ? record.operator.acknowledgedAt || now : undefined,
      resolvedAt: state === "resolved" ? record.operator.resolvedAt || now : undefined,
      notes,
    },
    updatedAt: now,
  });
}

export function workflowVersionDifferences(record: AgentOperationRecord, current: AgentRunEnvelope) {
  const currentVersions = Object.fromEntries(current.steps.map((step) => [step.workflowId, step.workflowVersion]));
  return Object.entries(record.versions.workflows).flatMap(([workflowId, sourceVersion]) => {
    const currentVersion = currentVersions[workflowId];
    return currentVersion && currentVersion !== sourceVersion ? [{ workflowId, sourceVersion, currentVersion }] : [];
  });
}
