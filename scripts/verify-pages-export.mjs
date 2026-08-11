import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const output = join(root, "out");
const repositoryName = process.env.GITHUB_REPOSITORY?.split("/")[1] || "eraneos-oet-transformation-cockpit";
const basePath = `/${repositoryName}`;
for (const required of ["index.html", "404.html", ".nojekyll"]) {
  if (!existsSync(join(output, required))) throw new Error(`GitHub Pages export is missing ${required}.`);
}
const files = [];
const walk = (directory) => {
  for (const name of readdirSync(directory)) {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) walk(path);
    else if ([".html", ".js", ".css", ".json", ".txt", ".map"].includes(extname(path).toLowerCase())) files.push(path);
  }
};
walk(output);
const bundle = files.map((file) => readFileSync(file, "utf8")).join("\n");
if (!readFileSync(join(output, "index.html"), "utf8").includes(`${basePath}/_next/`)) throw new Error(`GitHub Pages assets are not rooted at ${basePath}.`);
for (const pattern of [/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/, /gh[pousr]_[A-Za-z0-9_]{20,}/, /AZURE_CLIENT_SECRET/i]) {
  if (pattern.test(bundle)) throw new Error("GitHub Pages export contains a credential marker.");
}
console.log(`GitHub Pages export verified: ${files.length} assets under ${basePath}; ${relative(root, output)} is deployment-ready.`);
