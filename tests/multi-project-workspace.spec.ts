import { expect, test } from "@playwright/test";
import { bootstrapPmoData } from "../src/lib/pmo-fixtures";
import { LocalIdentityProvider, type StorageBoundary } from "../src/lib/local-identity-provider";
import { LocalProjectDataRepository, projectDataKey } from "../src/lib/local-project-data-repository";
import { LocalWorkspaceRepository } from "../src/lib/local-workspace-repository";

class MemoryStorage implements StorageBoundary { values = new Map<string, string>(); getItem(key: string) { return this.values.get(key) ?? null; } setItem(key: string, value: string) { this.values.set(key, value); } removeItem(key: string) { this.values.delete(key); } }

test("creates, renames, archives and restores isolated projects", async () => {
  const storage = new MemoryStorage(); const workspace = new LocalWorkspaceRepository(storage); const identity = new LocalIdentityProvider(storage, () => new Date(), workspace);
  const account = (await identity.register({ displayName: "Portfolio Owner", email: "portfolio@example.com", password: "portfolio-owner-password", termsAccepted: true })).account;
  const { organisation } = await workspace.createOrganisation(account, "Portfolio Office");
  const first = await workspace.createProject(organisation.id, account.id, "Project Alpha"); const second = await workspace.createProject(organisation.id, account.id, "Project Beta");
  expect((await workspace.listProjects(organisation.id, account.id)).map((item) => item.name)).toEqual(["Project Alpha", "Project Beta"]);
  await workspace.renameProject(organisation.id, account.id, first.id, "Project Alpha Prime"); await workspace.archiveProject(organisation.id, account.id, second.id);
  expect((await workspace.listProjects(organisation.id, account.id)).map((item) => item.name)).toEqual(["Project Alpha Prime"]);
  await workspace.restoreProject(organisation.id, account.id, second.id); expect(await workspace.listProjects(organisation.id, account.id)).toHaveLength(2);
});

test("namespaces PMO documents and rejects cross-project writes", async () => {
  const storage = new MemoryStorage(); const repository = new LocalProjectDataRepository(storage);
  const alpha = { organisationId: "org_isolation01", projectId: "prj_alpha01", projectName: "Alpha" }; const beta = { organisationId: "org_isolation01", projectId: "prj_beta001", projectName: "Beta" };
  const alphaDocument = await repository.load(alpha, bootstrapPmoData); alphaDocument.project.subtitle = "Alpha-only confidential state"; await repository.save(alpha, alphaDocument);
  const betaDocument = await repository.load(beta, bootstrapPmoData);
  expect(betaDocument.project.name).toBe("Beta"); expect(betaDocument.project.subtitle).not.toContain("Alpha-only");
  expect(storage.getItem(projectDataKey(alpha))).toContain("Alpha-only confidential state"); expect(storage.getItem(projectDataKey(beta))).toBeNull();
  await expect(repository.save(beta, alphaDocument)).rejects.toThrow("outside the selected workspace");
});

test("steers two projects from the organisation dashboard", async ({ page }) => {
  await page.goto("/?view=register"); await page.getByLabel("Display name").fill("Portfolio Tester"); await page.getByLabel("Email").fill("portfolio.ui@example.com"); await page.getByLabel("Local demonstration password").fill("portfolio-ui-password"); await page.getByLabel(/I accept/).check(); await page.getByRole("button", { name: "Create local account" }).click();
  await page.getByLabel("Organisation name").fill("Portfolio UI Office"); await page.getByRole("button", { name: "Create organisation" }).click();
  await page.getByLabel("Project name").fill("Project Alpha"); await page.getByRole("button", { name: "Create project" }).click(); await page.getByLabel("Project name").fill("Project Beta"); await page.getByRole("button", { name: "Create project" }).click();
  const workspaces = page.locator(".project-workspaces"); await expect(workspaces.getByRole("heading", { name: "Project Alpha" })).toBeVisible(); await expect(workspaces.getByRole("heading", { name: "Project Beta" })).toBeVisible();
  const beta = workspaces.getByRole("article").filter({ hasText: "Project Beta" }); await beta.getByRole("button", { name: "Open cockpit" }).click(); await expect(page.getByText("Project Beta", { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "Organisation workspace" }).click(); const alpha = workspaces.getByRole("article").filter({ hasText: "Project Alpha" }); await alpha.getByRole("button", { name: "Archive" }).click(); await expect(alpha.getByText("archived")).toBeVisible(); await alpha.getByRole("button", { name: "Restore" }).click(); await expect(alpha.getByText("active")).toBeVisible();
});

test("aggregates stored project signals, persists filters and drills into the correct view", async ({ page }) => {
  await page.goto("/?view=register"); await page.getByLabel("Display name").fill("Command Centre Owner"); await page.getByLabel("Email").fill("command.centre@example.com"); await page.getByLabel("Local demonstration password").fill("command-centre-password"); await page.getByLabel(/I accept/).check(); await page.getByRole("button", { name: "Create local account" }).click();
  await page.getByLabel("Organisation name").fill("Command Centre Office"); await page.getByRole("button", { name: "Create organisation" }).click();
  await page.getByLabel("Project name").fill("Project Alpha"); await page.getByRole("button", { name: "Create project" }).click(); await page.getByLabel("Project name").fill("Project Beta"); await page.getByRole("button", { name: "Create project" }).click();
  await page.evaluate((seed) => {
    const state = JSON.parse(localStorage.getItem("oet:workspace:v1:governance") || "{}"); const [alpha, beta] = state.projects;
    for (const project of [alpha, beta]) { const document = structuredClone(seed); document.project.id = project.id; document.project.name = project.name; if (project === alpha) document.dependencies[0].relatedObjects.push({ type: "project", id: beta.id }); const key = `oet:workspace:v1:organisation:${project.organisationId}:project:${project.id}:pmo`; localStorage.setItem(key, JSON.stringify({ contractVersion: "project-data-1.0", organisationId: project.organisationId, projectId: project.id, document })); }
  }, bootstrapPmoData);
  await page.reload(); await expect(page.getByRole("heading", { name: "Decision signals across authorised projects" })).toBeVisible(); await expect(page.locator(".portfolio-project")).toHaveCount(2); await expect(page.locator(".portfolio-partial")).toHaveCount(0);
  await page.getByLabel("Reporting period").selectOption("all"); await page.reload(); await expect(page.getByLabel("Reporting period")).toHaveValue("all");
  const alpha = page.locator(".portfolio-project").filter({ hasText: "Project Alpha" }); await alpha.getByRole("button", { name: "Open issues" }).click();
  await expect(page).toHaveURL(/project=.*&cockpit=registers/); await expect(page.getByText("Project Alpha", { exact: true }).first()).toBeVisible(); await page.reload(); await expect(page).toHaveURL(/cockpit=registers/); await expect(page.getByText("Project Alpha", { exact: true }).first()).toBeVisible();
});
