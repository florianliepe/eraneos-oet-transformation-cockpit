import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  use: { baseURL: "http://127.0.0.1:3108/eraneos-oet-transformation-cockpit/", headless: true, timezoneId: "Europe/Berlin" },
  webServer: { command: "node scripts/serve-pages-export.mjs", url: "http://127.0.0.1:3108/eraneos-oet-transformation-cockpit/", reuseExistingServer: false, timeout: 30000 },
});
