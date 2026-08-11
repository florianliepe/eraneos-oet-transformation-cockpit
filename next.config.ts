import type { NextConfig } from "next";

const pagesBuild = process.env.GITHUB_PAGES === "true";
const appServiceBuild = process.env.DEPLOYMENT_TARGET === "azure_app_service" || process.env.GITHUB_WORKFLOW === "Validate and deploy frontend to Azure App Service" || Boolean(process.env.WEBSITE_SITE_NAME);
const repositoryName = process.env.GITHUB_REPOSITORY?.split("/")[1] || "eraneos-oet-transformation-cockpit";
const basePath = pagesBuild ? `/${repositoryName}` : "";

const nextConfig: NextConfig = {
  output: pagesBuild ? "export" : "standalone",
  basePath,
  trailingSlash: pagesBuild,
  images: { unoptimized: pagesBuild },
  env: {
    NEXT_PUBLIC_WORKSPACE_RUNTIME_MODE: process.env.NEXT_PUBLIC_WORKSPACE_RUNTIME_MODE || (appServiceBuild ? "production" : "local_demo"),
  },
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
