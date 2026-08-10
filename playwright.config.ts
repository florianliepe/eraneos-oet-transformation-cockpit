import { defineConfig } from "@playwright/test";

process.env.NEXT_PUBLIC_N8N_PMO_WEBHOOK_URL ??= "https://workflow.test/pmo";
process.env.NEXT_PUBLIC_N8N_STEERCO_WEBHOOK_URL ??= "https://workflow.test/steerco";
process.env.NEXT_PUBLIC_N8N_STEERCO_READ_WEBHOOK_URL ??= "https://workflow.test/steerco-read";

export default defineConfig({
  testDir: "./tests",
  use: {
    baseURL: "http://localhost:3107",
    headless: true,
    timezoneId: "Europe/Berlin",
  },
  webServer: {
    command: "node node_modules/next/dist/bin/next dev -p 3107",
    url: "http://localhost:3107",
    reuseExistingServer: false,
    timeout: 120000,
  },
});
