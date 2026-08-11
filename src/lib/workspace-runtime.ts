import { z } from "zod";

export const DeploymentTargetSchema = z.enum(["local_development", "github_pages", "azure_app_service"]);
export const PublicWorkspaceModeSchema = z.enum(["local_demo", "production"]);
export const IdentityAdapterSchema = z.enum(["local_browser", "entra_external_id"]);
export const RepositoryAdapterSchema = z.enum(["local_browser", "app_service_api"]);

export const WorkspaceRuntimeConfigSchema = z.object({
  deploymentTarget: DeploymentTargetSchema,
  publicMode: PublicWorkspaceModeSchema,
  identityAdapter: IdentityAdapterSchema,
  workspaceRepositoryAdapter: RepositoryAdapterSchema,
  projectDataAdapter: RepositoryAdapterSchema,
});

export type WorkspaceRuntimeConfig = z.infer<typeof WorkspaceRuntimeConfigSchema>;
export type BrowserWorkspaceMode = z.infer<typeof PublicWorkspaceModeSchema>;

export function validateWorkspaceRuntime(input: Partial<WorkspaceRuntimeConfig>): WorkspaceRuntimeConfig {
  const deploymentTarget = input.deploymentTarget ?? "local_development";
  const local = deploymentTarget !== "azure_app_service";
  const config = WorkspaceRuntimeConfigSchema.parse({
    deploymentTarget,
    publicMode: input.publicMode ?? (local ? "local_demo" : undefined),
    identityAdapter: input.identityAdapter ?? (local ? "local_browser" : undefined),
    workspaceRepositoryAdapter: input.workspaceRepositoryAdapter ?? (local ? "local_browser" : undefined),
    projectDataAdapter: input.projectDataAdapter ?? (local ? "local_browser" : undefined),
  });

  if (deploymentTarget === "azure_app_service") {
    if (config.publicMode !== "production" || config.identityAdapter !== "entra_external_id" || config.workspaceRepositoryAdapter !== "app_service_api" || config.projectDataAdapter !== "app_service_api") {
      throw new Error("Azure App Service must use production mode with Entra External ID and App Service API adapters.");
    }
  } else if (config.publicMode !== "local_demo" || config.identityAdapter !== "local_browser" || config.workspaceRepositoryAdapter !== "local_browser" || config.projectDataAdapter !== "local_browser") {
    throw new Error("Local development and GitHub Pages may only use the explicitly labelled local demonstration adapters.");
  }
  return config;
}

export function browserWorkspaceMode(): BrowserWorkspaceMode {
  const configured = process.env.NEXT_PUBLIC_WORKSPACE_RUNTIME_MODE;
  if (configured === "production") return "production";
  if (configured === undefined || configured === "local_demo") return "local_demo";
  throw new Error("The public workspace runtime mode is invalid.");
}
