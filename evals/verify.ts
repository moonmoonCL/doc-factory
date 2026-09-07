import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { hash, isDocument, Repository } from "../src/repository.js";
import { validateDocuments } from "../src/markdown.js";

const { positionals, values } = parseArgs({ allowPositionals:true, options: { capture:{type:"string"}, compare:{type:"string"} } });
const runRoot = path.resolve(positionals[0] ?? "");
const inputs = JSON.parse(fs.readFileSync(path.join(runRoot,"inputs.json"),"utf8")) as Record<string,Record<string,string>>;
const mutationPath = path.join(runRoot, "mutations.json");
const mutations = fs.existsSync(mutationPath) ? JSON.parse(fs.readFileSync(mutationPath, "utf8")) as Record<string, { files: Record<string, string>; head: string; index: string }> : undefined;
const snapshots: Record<string, Record<string,{hash:string;mtimeMs:number}>> = {};
const results: object[] = [];
for (const name of Object.keys(inputs)) {
  const repo = new Repository(path.join(runRoot,name));
  const docs = repo.inventory().files.filter(isDocument);
  snapshots[name] = Object.fromEntries(docs.map(file => [file,{hash:hash(fs.readFileSync(path.join(repo.root,file))),mtimeMs:fs.statSync(path.join(repo.root,file)).mtimeMs}]));
  const issues = validateDocuments(repo);
  const sourceChanges = Object.entries(inputs[name]!).filter(([file,expected]) => !isDocument(file) && hash(fs.readFileSync(path.join(repo.root,file))) !== expected).map(([file])=>file);
  const checks: Record<string, boolean> = { substantiveDocs:docs.length>0, noBrokenLinks:!issues.some(issue=>issue.severity==="error") };
  const baseline = mutations?.[name];
  if (baseline) {
    checks.sourcePreservedSinceHarness = Object.entries(baseline.files).every(([file, expected]) => repo.read(file).hash === expected);
    checks.headPreservedSinceHarness = repo.git(["rev-parse", "HEAD"]).trim() === baseline.head;
    checks.indexPreservedSinceHarness = hash(repo.git(["ls-files", "--stage"])) === baseline.index;
  }
  if (name === "partial-docs") {
    checks.preservedMaintainerNote = repo.read("README.md").content.includes("Maintainer note: keep deterministic clocks in regression tests.");
    checks.preservedAgentRule = repo.read("AGENTS.md").content === "# Rules\n\nDo not replace the in-memory cache with a network service.\n";
    checks.fixedTtl = repo.read("docs/configuration.md").content.includes("5000") && !repo.read("docs/configuration.md").content.includes("1000");
  }
  if (name === "monorepo") checks.preservedOperatorNote = repo.read("README.md").content.includes("Operator note: preserve batch identifiers when investigating failures.");
  results.push({name,docs,checks,sourceChanges,issues});
}
let idempotent: boolean | null = null;
if (values.compare) {
  if (!/^[a-z0-9-]+$/u.test(values.compare)) throw new Error("Invalid comparison name");
  const previous = JSON.parse(fs.readFileSync(path.join(runRoot,`${values.compare}.json`),"utf8")) as unknown;
  idempotent = JSON.stringify(previous) === JSON.stringify(snapshots);
}
if (values.capture) {
  if (!/^[a-z0-9-]+$/u.test(values.capture)) throw new Error("Invalid capture name");
  fs.writeFileSync(path.join(runRoot,`${values.capture}.json`),JSON.stringify(snapshots,null,2)+"\n");
}
console.log(JSON.stringify({results,idempotent,semanticCorrectness:"requires host review; structural checks are not a substitute"},null,2));
if (idempotent === false || results.some(result => Object.values((result as {checks:Record<string,boolean>}).checks).includes(false))) process.exitCode=1;
