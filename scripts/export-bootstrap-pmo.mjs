import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { mkdirSync } from "node:fs";
import ts from "typescript";

const outputArg = process.argv[2];
if (!outputArg) throw new Error("Usage: node scripts/export-bootstrap-pmo.mjs <output.json>");
const source = readFileSync(resolve(import.meta.dirname, "..", "src", "lib", "pmo-fixtures.ts"), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const commonJsModule = { exports: {} };
new Function("exports", "module", "require", compiled)(commonJsModule.exports, commonJsModule, () => { throw new Error("Bootstrap fixture unexpectedly imported runtime code."); });
const document = commonJsModule.exports.bootstrapPmoData;
if (!document || document.schemaVersion !== "2.0") throw new Error("Bootstrap fixture did not produce a PMO v2.0 document.");
const output = resolve(outputArg);
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, `${JSON.stringify(document, null, 2)}\n`, "utf8");
console.log(`Exported neutral PMO bootstrap revision ${document.revision}.`);
