import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { hash } from "../src/repository.js";

export const cases: Record<string, Record<string, string>> = {
  "small-library": {
    "package.json": JSON.stringify({ name: "name-utils", private: true, type: "module", scripts: { test: "node --test" } }, null, 2) + "\n",
    "src/index.js": 'export function normalizeName(value) {\n  if (typeof value !== "string") throw new TypeError("Name must be a string");\n  return value.trim().replace(/\\s+/g, " ");\n}\n',
    "test/name.test.js": 'import assert from "node:assert/strict";\nimport { test } from "node:test";\nimport { normalizeName } from "../src/index.js";\ntest("trims and collapses whitespace", () => assert.equal(normalizeName("  Ada   Lovelace "), "Ada Lovelace"));\ntest("rejects nonstrings", () => assert.throws(() => normalizeName(null), TypeError));\n',
  },
  "monorepo": {
    "package.json": JSON.stringify({ name: "job-workspace", private: true, type: "module", workspaces: ["packages/*"] }, null, 2) + "\n",
    "pnpm-workspace.yaml": "packages:\n  - packages/*\n",
    "README.md": "# Job workspace\n\nOperator note: preserve batch identifiers when investigating failures.\n",
    "packages/core/package.json": '{"name":"@jobs/core","type":"module","exports":"./src/index.js"}\n',
    "packages/core/src/index.js": 'export function parseJob(input) {\n  const job = JSON.parse(input);\n  if (typeof job.id !== "string" || !job.id.trim()) throw new Error("Job id required");\n  return { id: job.id, payload: job.payload };\n}\n',
    "packages/worker/package.json": '{"name":"@jobs/worker","type":"module","dependencies":{"@jobs/core":"workspace:*"}}\n',
    "packages/worker/src/index.js": 'import { parseJob } from "../../core/src/index.js";\nexport async function runJob(input, handler) {\n  const job = parseJob(input);\n  const result = await handler(job.payload);\n  return { id: job.id, result };\n}\n',
    "test/worker.test.js": 'import assert from "node:assert/strict";\nimport { test } from "node:test";\nimport { runJob } from "../packages/worker/src/index.js";\ntest("passes payload and retains identity", async () => assert.deepEqual(await runJob(JSON.stringify({id:"j1",payload:2}), async x => x*2), {id:"j1",result:4}));\ntest("propagates handler failure", async () => assert.rejects(runJob(JSON.stringify({id:"j1"}), async () => {throw new Error("failed");}), /failed/));\n',
  },
  "application": {
    "package.json": '{"name":"greeting-service","type":"module","private":true,"scripts":{"start":"node src/server.js","test":"node --test"}}\n',
    "src/config.js": 'export function loadConfig(env = process.env) {\n  const port = Number(env.PORT ?? 3000);\n  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid PORT");\n  return { port, prefix: env.GREETING_PREFIX ?? "Hello" };\n}\n',
    "src/handler.js": 'export function handle(url, config) {\n  if (url.pathname === "/health") return {status:200,body:{ok:true}};\n  if (url.pathname === "/greet") return {status:200,body:{message:`${config.prefix}, ${url.searchParams.get("name") ?? "world"}`}};\n  return {status:404,body:{error:"Not found"}};\n}\n',
    "src/server.js": 'import http from "node:http";\nimport { loadConfig } from "./config.js";\nimport { handle } from "./handler.js";\nconst config = loadConfig();\nhttp.createServer((req,res) => {\n  const result = handle(new URL(req.url, "http://localhost"), config);\n  res.writeHead(result.status, {"content-type":"application/json"});\n  res.end(JSON.stringify(result.body));\n}).listen(config.port);\n',
    "test/service.test.js": 'import assert from "node:assert/strict";\nimport { test } from "node:test";\nimport { loadConfig } from "../src/config.js";\nimport { handle } from "../src/handler.js";\ntest("default config", () => assert.deepEqual(loadConfig({}), {port:3000,prefix:"Hello"}));\ntest("invalid port", () => assert.throws(() => loadConfig({PORT:"no"}), /Invalid PORT/));\ntest("greeting", () => assert.deepEqual(handle(new URL("http://local/greet?name=Ada"), loadConfig({})), {status:200,body:{message:"Hello, Ada"}}));\n',
    ".github/workflows/test.yml": "name: tests\non: [push, pull_request]\njobs:\n  unit:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - uses: actions/setup-node@v4\n        with:\n          node-version: 22\n      - run: npm test\n",
    "Dockerfile": "FROM node:22-alpine\nWORKDIR /app\nCOPY package.json ./\nCOPY src ./src\nEXPOSE 3000\nCMD [\"node\", \"src/server.js\"]\n",
  },
  "partial-docs": {
    "package.json": '{"name":"memo-cache","type":"module","scripts":{"test":"node --test"}}\n',
    "src/cache.js": 'export function createCache(ttl = 5000, now = Date.now) {\n  const values = new Map();\n  return {\n    getOrSet(key, make) {\n      const entry = values.get(key);\n      if (entry && entry.until > now()) return entry.value;\n      const value = make();\n      values.set(key, {value, until:now()+ttl});\n      return value;\n    },\n    clear() { values.clear(); }\n  };\n}\n',
    "test/cache.test.js": 'import assert from "node:assert/strict";\nimport { test } from "node:test";\nimport { createCache } from "../src/cache.js";\ntest("expires at the TTL boundary", () => {let clock=0; const cache=createCache(5000,()=>clock); assert.equal(cache.getOrSet("a",()=>1),1); clock=4999; assert.equal(cache.getOrSet("a",()=>2),1); clock=5000; assert.equal(cache.getOrSet("a",()=>3),3);});\n',
    "README.md": "# Memo cache\n\nValues are cached in memory for repeated synchronous reads.\n\n[Configuration](docs/configuration.md)\n\nMaintainer note: keep deterministic clocks in regression tests.\n",
    "docs/configuration.md": "# Configuration\n\nThe default cache TTL is 1000 milliseconds.\n\nPass a clock function as the second argument for deterministic tests.\n",
    "AGENTS.md": "# Rules\n\nDo not replace the in-memory cache with a network service.\n",
  },
};

fs.mkdirSync(".eval-work", { recursive: true });
const runRoot = fs.mkdtempSync(path.resolve(".eval-work/run-"));
const manifest: Record<string, Record<string, string>> = {};
for (const [name, files] of Object.entries(cases)) {
  const root = path.join(runRoot, name);
  fs.mkdirSync(root);
  manifest[name] = {};
  for (const [file, content] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root,file)), {recursive:true});
    fs.writeFileSync(path.join(root,file),content);
    manifest[name]![file] = hash(content);
  }
  const git = (...args: string[]) => execFileSync("git",args,{cwd:root,stdio:"pipe",env:{...process.env,GIT_CONFIG_GLOBAL:"/dev/null",GIT_CONFIG_NOSYSTEM:"1"}});
  git("init","-q"); git("config","user.name","Evaluation fixture"); git("config","user.email","eval@example.invalid"); git("config","commit.gpgsign","false");
  git("add","."); git("commit","-qm","Evaluation input");
}
fs.writeFileSync(path.join(runRoot,"inputs.json"),JSON.stringify(manifest,null,2)+"\n");
console.log(JSON.stringify({runRoot,cases:Object.keys(cases)},null,2));
