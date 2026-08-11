import { z } from "zod";

export const ProductTelemetryEventSchema = z.object({
  contractVersion: z.literal("product-telemetry-1.0"),
  event: z.enum(["public_load", "cockpit_open", "workflow_request", "export_created"]),
  surface: z.enum(["public", "workspace", "cockpit", "operations", "reporting"]),
  outcome: z.enum(["success", "failure", "cancelled"]),
  durationBucket: z.enum(["under_250ms", "under_1s", "under_5s", "over_5s"]).optional(),
  correlationId: z.string().uuid().optional(),
  occurredAt: z.string().datetime(),
}).strict();

export type ProductTelemetryEvent = z.infer<typeof ProductTelemetryEventSchema>;

export function telemetryConfigured(env: Record<string, string | undefined> = process.env) {
  if (env.NEXT_PUBLIC_PRODUCT_TELEMETRY_ENABLED !== "true") return false;
  try {
    const endpoint = new URL(env.NEXT_PUBLIC_PRODUCT_TELEMETRY_ENDPOINT || "");
    return endpoint.protocol === "https:";
  } catch { return false; }
}

export async function recordProductTelemetry(event: ProductTelemetryEvent) {
  const payload = ProductTelemetryEventSchema.parse(event);
  if (!telemetryConfigured()) return { sent: false as const, reason: "disabled" as const };
  await fetch(process.env.NEXT_PUBLIC_PRODUCT_TELEMETRY_ENDPOINT!, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), keepalive: true,
  });
  return { sent: true as const };
}
