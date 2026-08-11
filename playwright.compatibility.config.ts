import base from "./playwright.config";
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  ...base,
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
  ],
});
