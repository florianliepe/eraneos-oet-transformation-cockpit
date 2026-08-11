const allowedWorkflowHosts = new Set(["eraneos-agentic-platform.azurewebsites.net", "workflow.test"]);

export const defaultPmoWorkflowUrl = "https://eraneos-agentic-platform.azurewebsites.net/webhook/a2126107-4e70-4717-8f1c-545d7f310741";

export function publicWorkflowEndpoint(configured: string | undefined, fallback?: string) {
  const value = configured?.trim() || fallback;
  if (!value) throw new Error("The requested Transformation Cockpit workflow endpoint is not configured.");
  let endpoint: URL;
  try { endpoint = new URL(value); }
  catch { throw new Error("The configured workflow endpoint is not a valid URL."); }
  if (endpoint.protocol !== "https:" || !allowedWorkflowHosts.has(endpoint.hostname) || !endpoint.pathname.startsWith("/webhook/")) {
    throw new Error("The configured workflow endpoint is outside the approved public orchestration boundary.");
  }
  return endpoint.toString();
}
