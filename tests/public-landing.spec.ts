import { expect, test } from "@playwright/test";

for (const viewport of [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 },
]) {
  test(`presents the public product surface at ${viewport.name} width`, async ({ page }, testInfo) => {
    const workflowRequests: string[] = [];
    page.on("request", (request) => {
      if (request.url().includes("/webhook/")) workflowRequests.push(request.url());
    });
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto("/");

    await expect(page.getByRole("heading", { name: "Turn transformation signals into accountable decisions." })).toBeVisible();
    if (viewport.name === "desktop") await expect(page.getByLabel("Public navigation")).toBeVisible();
    else await expect(page.getByLabel("Public navigation")).toBeHidden();
    await expect(page.getByRole("button", { name: "Create account", exact: true }).first()).toBeVisible();
    await expect(page.getByText("AI proposes. Accountable people decide.")).toBeVisible();
    expect(workflowRequests).toEqual([]);

    await testInfo.attach(`public-landing-${viewport.name}`, {
      body: await page.screenshot({ fullPage: true }),
      contentType: "image/png",
    });
  });
}

test("provides self-registration, sign-out and sign-in on static-compatible routes", async ({ page }) => {
  await page.goto("/?view=register");
  await expect(page.getByRole("heading", { name: "Start your transformation workspace." })).toBeVisible();
  await expect(page.getByText("not Microsoft Entra authentication", { exact: false })).toBeVisible();
  await page.getByLabel("Display name").fill("Public Journey");
  await page.getByLabel("Email").fill("public@example.com");
  await page.getByLabel("Local demonstration password").fill("public-local-password");
  await page.getByLabel(/I accept the applicable terms/).check();
  await page.getByRole("button", { name: "Create local account" }).click();
  await expect(page.getByLabel("Temporary workspace credential")).toBeVisible();
  await expect(page.getByText("Public Journey · local demonstration identity")).toBeVisible();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByRole("heading", { name: "Sign in to your cockpit." })).toBeVisible();
  await page.getByLabel("Email").fill("public@example.com");
  await page.getByLabel("Local demonstration password").fill("public-local-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByLabel("Temporary workspace credential")).toBeVisible();
});

test("supports public skip navigation and named visible controls", async ({ page }) => {
  await page.goto("/");
  const skipLink = page.getByRole("link", { name: "Skip to main content" });
  await skipLink.focus();
  await expect(skipLink).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#public-content")).toBeFocused();
  const unnamed = await page.locator("button:visible").evaluateAll((buttons) => buttons.filter((button) => !(button.getAttribute("aria-label") || button.textContent?.trim() || button.getAttribute("title"))).length);
  expect(unnamed).toBe(0);
});
