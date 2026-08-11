import { z } from "zod";

export const OPERATIONAL_ERROR_VERSION = "operational-error-1.0" as const;

export const OperationalErrorSchema = z.object({
  contractVersion: z.literal(OPERATIONAL_ERROR_VERSION),
  code: z.enum(["credential_required", "network_unavailable", "workflow_rejected", "workflow_unavailable", "invalid_response"]),
  category: z.enum(["input", "network", "workflow", "contract"]),
  safeMessage: z.string().min(1),
  retryable: z.boolean(),
  retryGuidance: z.string().min(1),
  correlationId: z.string().uuid(),
  component: z.enum(["pmo_workflow", "steerco_workflow"]),
  occurredAt: z.string().datetime(),
  privacy: z.literal("operational_metadata_only"),
});

export type OperationalError = z.infer<typeof OperationalErrorSchema>;

export class CockpitClientError extends Error {
  readonly diagnostic: OperationalError;
  constructor(diagnostic: OperationalError) {
    super(`${diagnostic.safeMessage} ${diagnostic.retryGuidance} Reference: ${diagnostic.correlationId}`);
    this.name = "CockpitClientError";
    this.diagnostic = OperationalErrorSchema.parse(diagnostic);
  }
}

export function newCorrelationId() {
  return crypto.randomUUID();
}

export function workflowError(input: {
  component: OperationalError["component"];
  correlationId: string;
  status?: number;
  cause?: unknown;
}) {
  const unavailable = input.cause instanceof TypeError || !input.status || input.status >= 500;
  const code = unavailable ? (input.cause instanceof TypeError ? "network_unavailable" : "workflow_unavailable") : "workflow_rejected";
  return new CockpitClientError({
    contractVersion: OPERATIONAL_ERROR_VERSION,
    code,
    category: input.cause instanceof TypeError ? "network" : "workflow",
    safeMessage: unavailable ? "The workflow is temporarily unavailable." : "The workflow rejected the request.",
    retryable: unavailable || input.status === 429,
    retryGuidance: unavailable || input.status === 429 ? "Retry once; if it persists, give support the reference ID." : "Review the request and contact support with the reference ID.",
    correlationId: input.correlationId,
    component: input.component,
    occurredAt: new Date().toISOString(),
    privacy: "operational_metadata_only",
  });
}

export function credentialRequired(component: OperationalError["component"]) {
  return new CockpitClientError({
    contractVersion: OPERATIONAL_ERROR_VERSION,
    code: "credential_required",
    category: "input",
    safeMessage: "Enter the temporary workspace credential to continue.",
    retryable: false,
    retryGuidance: "Use the credential issued by the workspace owner.",
    correlationId: newCorrelationId(),
    component,
    occurredAt: new Date().toISOString(),
    privacy: "operational_metadata_only",
  });
}
