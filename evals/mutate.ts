import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { hash, isDocument, Repository } from "../src/repository.js";

const runRoot = path.resolve(process.argv[2] ?? "");
const inputs = JSON.parse(fs.readFileSync(path.join(runRoot, "inputs.json"), "utf8")) as Record<string, Record<string, string>>;
for (const [name, files] of Object.entries(inputs)) {
  for (const [file, expected] of Object.entries(files).filter(([file]) => !isDocument(file))) {
    if (hash(fs.readFileSync(path.join(runRoot, name, file))) !== expected) throw new Error(`Fixture input changed: ${name}/${file}`);
  }
}
const replace = (name: string, file: string, from: string, to: string) => {
  const absolute = path.join(runRoot, name, file);
  const content = fs.readFileSync(absolute, "utf8");
  if (!content.includes(from)) throw new Error(`Mutation precondition failed: ${name}/${file}`);
  fs.writeFileSync(absolute, content.replace(from, to));
};
replace("small-library", "src/index.js", '  return value.trim().replace(/\\s+/g, " ");', '  const trimmed = value.trim();\n  return trimmed.replace(/\\s+/g, " ");');
replace("monorepo", "packages/core/src/index.js", "id: job.id,", "id: job.id.trim(),");
replace("monorepo", "test/worker.test.js", 'id:"j1",payload:2', 'id:"  j1  ",payload:2');
const git = (name: string, ...args: string[]) => execFileSync("git", args, { cwd: path.join(runRoot, name), encoding: "utf8", stdio: "pipe", env: { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1" } });
git("monorepo", "add", "--", "packages/core/src/index.js", "test/worker.test.js");
git("monorepo", "commit", "-qm", "Evaluation mutation: normalize job identity");
replace("application", "src/config.js", "env.PORT ?? 3000", "env.PORT ?? 3100");
git("application", "add", "--", "src/config.js");
replace("application", "src/handler.js", "body:{message:", "body:{greeting:");
replace("application", "test/service.test.js", "port:3000", "port:3100");
replace("application", "test/service.test.js", 'body:{message:"Hello, Ada"}', 'body:{greeting:"Hello, Ada"}');
replace("partial-docs", "src/cache.js", "    clear() { values.clear(); }", "    size() { return values.size; },\n    clear() { values.clear(); }");
fs.appendFileSync(path.join(runRoot, "partial-docs/test/cache.test.js"), 'test("size includes expired entries until clear", () => {let clock=0; const cache=createCache(5000,()=>clock); cache.getOrSet("a",()=>1); clock=5000; assert.equal(cache.size(),1); cache.clear(); assert.equal(cache.size(),0);});\n');
fs.writeFileSync(path.join(runRoot, "partial-docs/user-edits.txt"), "Unrelated human scratch work must survive documentation maintenance.\n");
const snapshot = Object.fromEntries(Object.keys(inputs).map(name => {
  const repo = new Repository(path.join(runRoot, name));
  const files = Object.fromEntries(repo.inventory().files.filter(file => !isDocument(file)).map(file => [file, repo.read(file).hash]));
  return [name, { files, head: git(name, "rev-parse", "HEAD").trim(), index: hash(git(name, "ls-files", "--stage")) }];
}));
fs.writeFileSync(path.join(runRoot, "mutations.json"), JSON.stringify(snapshot, null, 2) + "\n");
console.log(JSON.stringify({ runRoot, mutated: Object.keys(inputs), mutationOwner: "evaluation harness; never the Skill" }, null, 2));
