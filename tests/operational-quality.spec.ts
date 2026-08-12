import { expect, test } from "@playwright/test";
import { CockpitClientError, OperationalErrorSchema, newCorrelationId, readWorkflowResponse, workflowError } from "../src/lib/operational-quality";
import { ProductTelemetryEventSchema, telemetryConfigured } from "../src/lib/product-telemetry";
import { AGENT_CATALOGUE, diagnoseWorkflowCompatibility } from "../src/lib/agent-control-plane";

test("creates privacy-safe correlation diagnostics without reflecting a server body", () => {
  const correlationId = newCorrelationId();
  const error = workflowError({ component: "pmo_workflow", correlationId, status: 503, cause: "secret payload" });
  expect(error).toBeInstanceOf(CockpitClientError);
  expect(error.message).toContain(correlationId);
  expect(error.message).not.toContain("secret payload");
  expect(OperationalErrorSchema.parse(error.diagnostic).privacy).toBe("operational_metadata_only");
});

test("classifies an empty forbidden response before attempting JSON parsing", async () => {
  const correlationId = newCorrelationId();
  await expect(readWorkflowResponse(new Response("", { status: 403, headers: { "content-type": "application/json" } }), "pmo_workflow", correlationId))
    .rejects.toMatchObject({ diagnostic: { code: "workflow_rejected", correlationId } });
});

test("fails safely when a successful workflow response contains malformed JSON", async () => {
  const correlationId = newCorrelationId();
  await expect(readWorkflowResponse(new Response("{", { status: 200, headers: { "content-type": "application/json" } }), "pmo_workflow", correlationId))
    .rejects.toMatchObject({ diagnostic: { code: "invalid_response", correlationId } });
});

test("keeps analytics disabled unless both explicit settings are safe", () => {
  expect(telemetryConfigured({})).toBe(false);
  expect(telemetryConfigured({ NEXT_PUBLIC_PRODUCT_TELEMETRY_ENABLED: "true", NEXT_PUBLIC_PRODUCT_TELEMETRY_ENDPOINT: "http://example.test" })).toBe(false);
  expect(telemetryConfigured({ NEXT_PUBLIC_PRODUCT_TELEMETRY_ENABLED: "true", NEXT_PUBLIC_PRODUCT_TELEMETRY_ENDPOINT: "https://telemetry.example.test/events" })).toBe(true);
  expect(() => ProductTelemetryEventSchema.parse({ contractVersion: "product-telemetry-1.0", event: "public_load", surface: "public", outcome: "success", occurredAt: new Date().toISOString(), email: "forbidden@example.test" })).toThrow();
});

test("diagnoses matching, stale and unavailable workflow bindings", () => {
  const entry = AGENT_CATALOGUE[0];
  expect(diagnoseWorkflowCompatibility(entry, { releaseId: entry.releaseId, liveBindingId: entry.liveBindingId }).status).toBe("compatible");
  expect(diagnoseWorkflowCompatibility(entry, { releaseId: "old", liveBindingId: entry.liveBindingId }).status).toBe("stale_binding");
  expect(diagnoseWorkflowCompatibility(entry, {}).status).toBe("unknown");
});
