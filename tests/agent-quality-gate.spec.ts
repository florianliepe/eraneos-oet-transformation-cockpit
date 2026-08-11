import { expect, test } from "@playwright/test";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

test("blocks a deliberately regressed prompt-injection candidate", () => {
  const result = spawnSync(process.execPath, [
    resolve("scripts/evaluate-agent-quality.mjs"),
    "--fixture",
    resolve("tests/fixtures/agent-workflows/regressed-candidate.json"),
  ], { cwd: process.cwd(), encoding: "utf8" });

  expect(result.status).not.toBe(0);
  expect(`${result.stdout}\n${result.stderr}`).toContain("prompt injection did not fail closed");
  expect(`${result.stdout}\n${result.stderr}`).toContain("unsupported material claim");
});
