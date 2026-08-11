import { expect, test } from "@playwright/test";
import { validateWorkspaceRuntime } from "../src/lib/workspace-runtime";

test("permits only explicitly labelled local adapters on GitHub Pages", () => {
  expect(validateWorkspaceRuntime({ deploymentTarget: "github_pages" })).toEqual({
    deploymentTarget: "github_pages",
    publicMode: "local_demo",
    identityAdapter: "local_browser",
    workspaceRepositoryAdapter: "local_browser",
    projectDataAdapter: "local_browser",
  });
  expect(() => validateWorkspaceRuntime({ deploymentTarget: "github_pages", publicMode: "production" })).toThrow("local demonstration adapters");
});

test("fails closed when App Service is missing a production adapter", () => {
  expect(() => validateWorkspaceRuntime({ deploymentTarget: "azure_app_service" })).toThrow();
  expect(() => validateWorkspaceRuntime({
    deploymentTarget: "azure_app_service",
    publicMode: "production",
    identityAdapter: "local_browser",
    workspaceRepositoryAdapter: "app_service_api",
    projectDataAdapter: "app_service_api",
  })).toThrow("Azure App Service must use production mode");
});

test("accepts the production-shaped App Service boundary", () => {
  expect(validateWorkspaceRuntime({
    deploymentTarget: "azure_app_service",
    publicMode: "production",
    identityAdapter: "entra_external_id",
    workspaceRepositoryAdapter: "app_service_api",
    projectDataAdapter: "app_service_api",
  }).publicMode).toBe("production");
});
