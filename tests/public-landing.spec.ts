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

test("provides static-compatible sign-in, registration and browser-history routes", async ({ page }) => {
  await page.goto("/?view=register");
  await expect(page.getByRole("heading", { name: "Set up your transformation workspace." })).toBeVisible();
  await expect(page.getByText("Production email verification, recovery, MFA", { exact: false })).toBeVisible();

  await page.getByRole("button", { name: "Use current MVP access" }).click();
  await expect(page).toHaveURL(/view=signin/);
  await expect(page.getByLabel("Temporary workspace credential")).toBeVisible();
  await expect(page.getByText("Local demonstration access", { exact: false })).toBeVisible();

  await page.goBack();
  await expect(page.getByRole("heading", { name: "Set up your transformation workspace." })).toBeVisible();
  await page.getByRole("button", { name: "Back to overview" }).click();
  await expect(page.getByRole("heading", { name: "Turn transformation signals into accountable decisions." })).toBeVisible();
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
