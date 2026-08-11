import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const input = JSON.parse(readFileSync(resolve("tests/fixtures/agent-workflows/orchestration-evaluations.json"), "utf8"));
const order = ["evidence.verify", "meeting.synthesise", "risk.analyse", "delivery.plan", "controls.classify", "governance.review"];
const rules = [["meeting.synthesise", /meeting|minutes|attendee|agenda|workshop|discussion/i], ["risk.analyse", /risk|threat|probability|impact|mitigation|exposure/i], ["delivery.plan", /milestone|deliverable|deadline|schedule|plan|progress|delay/i], ["controls.classify", /issue|action|decision|dependency|assumption|change request|approval/i], ["governance.review", /audit|governance|evidence|review|compliance|approve/i]];
const route = (item) => {
  if (!item.text.trim() && !item.evidenceCount) return [];
  const selected = rules.filter(([, regex]) => regex.test(item.text)).map(([id]) => id);
  if (item.evidenceCount) selected.unshift("evidence.verify");
  if (!selected.length) selected.push("evidence.verify");
  if (selected.some((id) => id !== "evidence.verify") && !selected.includes("governance.review")) selected.push("governance.review");
  return order.filter((id) => new Set(selected).has(id)).slice(0, 4);
};
let tp = 0, fp = 0, fn = 0, calls = 0;
const results = input.cases.map((item) => { const actual = route(item); const expected = new Set(item.expected); const actualSet = new Set(actual); tp += actual.filter((id) => expected.has(id)).length; fp += actual.filter((id) => !expected.has(id)).length; fn += item.expected.filter((id) => !actualSet.has(id)).length; calls += actual.length; return { id: item.id, expected: item.expected, actual, pass: JSON.stringify(actual) === JSON.stringify(item.expected) }; });
const baselineCalls = input.cases.filter((item) => item.expected.length).length * input.baseline.specialistsPerRun;
const precision = tp / Math.max(1, tp + fp); const recall = tp / Math.max(1, tp + fn);
const report = { contractVersion: input.contractVersion, evaluatedAt: new Date().toISOString(), cases: results.length, precision, recall, missedSpecialistRate: fn / Math.max(1, tp + fn), baseline: { calls: baselineCalls, tokens: baselineCalls * input.baseline.tokensPerSpecialist, costEur: baselineCalls * input.baseline.costEurPerSpecialist, latencyMs: baselineCalls * input.baseline.latencyMsPerSpecialist }, candidate: { calls, tokens: calls * input.baseline.tokensPerSpecialist, costEur: calls * input.baseline.costEurPerSpecialist, latencyMs: calls * input.baseline.latencyMsPerSpecialist }, improvements: { callReduction: 1 - calls / baselineCalls, tokenReduction: 1 - calls / baselineCalls, costReduction: 1 - calls / baselineCalls, latencyReduction: 1 - calls / baselineCalls }, qualityGatePassed: precision === 1 && recall === 1 && results.every((item) => item.pass), results };
if (!report.qualityGatePassed || report.improvements.costReduction <= 0 || report.improvements.latencyReduction <= 0) throw new Error(`Smart orchestration gate failed: ${JSON.stringify(report)}`);
if (process.argv.includes("--write")) writeFileSync(resolve("src/data/orchestration-quality-report.json"), `${JSON.stringify(report, null, 2)}\n`);
console.log(`Smart orchestration gate passed: precision ${precision}, recall ${recall}, calls ${calls}/${baselineCalls}, cost and latency reduction ${(report.improvements.costReduction * 100).toFixed(1)}%.`);
