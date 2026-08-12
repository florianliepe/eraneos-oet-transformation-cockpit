import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const tracked = [
  "docs/n8n-pmo-orchestrator.workflow.json",
  "docs/n8n/agents/governed-publisher.workflow.json",
  "docs/n8n/agents/smoke-test.workflow.json",
];
const digest = () => createHash("sha256").update(tracked.map((file) => readFileSync(resolve(file), "utf8").replace(/\r\n/g, "\n")).join("\n---artifact---\n")).digest("hex");
const build = () => {
  const result = spawnSync(process.execPath, [resolve("scripts/build-agent-orchestrator.mjs")], { encoding: "utf8" });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || "Workflow build failed.");
};

build();
const first = digest();
build();
const second = digest();
if (first !== second) {
  console.error(`Workflow build is not repeatable: ${first} != ${second}`);
  process.exit(1);
}
console.log(`Workflow build is repeatable: ${second}.`);
