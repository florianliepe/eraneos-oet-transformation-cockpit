import { expect, test } from "@playwright/test";

async function register(page: import("@playwright/test").Page, name: string, email: string, password: string) {
  await page.goto("/?view=register");
  await page.getByLabel("Display name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Local demonstration password").fill(password);
  await page.getByLabel(/I accept the applicable terms/).check();
  await page.getByRole("button", { name: "Create local account" }).click();
}

test("creates an organisation, adds a second owner and protects the final owner", async ({ page }) => {
  await register(page, "First Owner", "first.owner@example.com", "first-owner-local-password");
  await page.getByLabel("Organisation name").fill("Shared Transformation Office");
  await page.getByRole("button", { name: "Create organisation" }).click();
  await expect(page.getByRole("heading", { name: "Shared Transformation Office" })).toBeVisible();

  await page.getByLabel("Email", { exact: true }).fill("second.owner@example.com");
  await page.locator(".invite-form select").selectOption("owner");
  await page.getByRole("button", { name: "Create invitation" }).click();
  const invitationCode = (await page.locator(".invitation-code code").innerText()).trim();
  expect(invitationCode.length).toBeGreaterThanOrEqual(8);
  await expect(page.getByText("Shown once. Send it through an approved channel.")).toBeVisible();

  await page.getByRole("button", { name: "Sign out" }).click();
  await page.getByRole("button", { name: "Create account" }).click();
  await page.getByLabel("Display name").fill("Second Owner");
  await page.getByLabel("Email").fill("second.owner@example.com");
  await page.getByLabel("Local demonstration password").fill("second-owner-local-password");
  await page.getByLabel(/I accept the applicable terms/).check();
  await page.getByRole("button", { name: "Create local account" }).click();
  await page.getByRole("button", { name: "Accept invitation" }).click();
  await page.getByLabel("Invitation code").fill(invitationCode);
  await page.getByRole("button", { name: "Accept invitation", exact: true }).click();

  await expect(page.getByRole("heading", { name: "Shared Transformation Office" })).toBeVisible();
  await expect(page.getByText("2 active")).toBeVisible();
  const roleSelectors = page.locator(".workspace-panel").first().locator("select");
  await roleSelectors.nth(0).selectOption("portfolio_lead");
  await expect(page.getByText("membership.role_changed", { exact: true })).toBeVisible();
  await roleSelectors.nth(1).selectOption("viewer");
  await expect(page.getByRole("alert").filter({ hasText: "at least one active owner" })).toBeVisible();
});

test("revokes a pending invitation without exposing its code again", async ({ page }) => {
  await register(page, "Workspace Owner", "workspace.owner@example.com", "workspace-owner-password");
  await page.getByLabel("Organisation name").fill("Governed Office");
  await page.getByRole("button", { name: "Create organisation" }).click();
  await page.getByLabel("Email", { exact: true }).fill("viewer@example.com");
  await page.getByRole("button", { name: "Create invitation" }).click();
  await page.getByRole("button", { name: "Revoke" }).click();
  await expect(page.getByText("Viewer · revoked")).toBeVisible();
  await expect(page.getByText("invitation.revoked", { exact: true })).toBeVisible();
});
