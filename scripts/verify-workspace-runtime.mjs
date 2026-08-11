const APP_SERVICE_WORKFLOW = "Validate and deploy frontend to Azure App Service";
const inferredTarget = process.env.GITHUB_PAGES === "true"
  ? "github_pages"
  : process.env.GITHUB_WORKFLOW === APP_SERVICE_WORKFLOW || process.env.WEBSITE_SITE_NAME
    ? "azure_app_service"
    : "local_development";
const target = process.env.DEPLOYMENT_TARGET || inferredTarget;
const local = target !== "azure_app_service";
const config = {
  target,
  mode: process.env.NEXT_PUBLIC_WORKSPACE_RUNTIME_MODE || (local ? "local_demo" : "production"),
  identity: process.env.WORKSPACE_IDENTITY_ADAPTER || (local ? "local_browser" : "entra_external_id"),
  workspace: process.env.WORKSPACE_REPOSITORY_ADAPTER || (local ? "local_browser" : "app_service_api"),
  project: process.env.PROJECT_DATA_ADAPTER || (local ? "local_browser" : "app_service_api"),
};

if (!["local_development", "github_pages", "azure_app_service"].includes(config.target)) throw new Error(`Unknown deployment target: ${config.target}`);
if (config.target === "azure_app_service") {
  const expected = config.mode === "production" && config.identity === "entra_external_id" && config.workspace === "app_service_api" && config.project === "app_service_api";
  if (!expected) throw new Error("Refusing App Service artifact: production mode, Entra External ID and App Service API adapters are mandatory.");
} else {
  const expected = config.mode === "local_demo" && config.identity === "local_browser" && config.workspace === "local_browser" && config.project === "local_browser";
  if (!expected) throw new Error("Local development and GitHub Pages require the explicitly labelled local demonstration adapters.");
}

console.log(`Workspace runtime verified: ${config.target} -> ${config.mode}; identity=${config.identity}; repositories=${config.workspace}/${config.project}.`);
