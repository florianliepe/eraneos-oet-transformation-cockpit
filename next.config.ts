import type { NextConfig } from "next";

const pagesBuild = process.env.GITHUB_PAGES === "true";
const repositoryName = process.env.GITHUB_REPOSITORY?.split("/")[1] || "eraneos-oet-transformation-cockpit";
const basePath = pagesBuild ? `/${repositoryName}` : "";

const nextConfig: NextConfig = {
  output: pagesBuild ? "export" : "standalone",
  basePath,
  trailingSlash: pagesBuild,
  images: { unoptimized: pagesBuild },
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
