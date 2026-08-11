import { expect, test } from "@playwright/test";

test("loads the public product shell without browser errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Turn transformation signals into accountable decisions." })).toBeVisible();
  await expect(page.getByRole("button", { name: "Create account", exact: true }).first()).toBeVisible();
  expect(errors).toEqual([]);
});
