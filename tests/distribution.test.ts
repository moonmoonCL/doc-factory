import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { test } from "node:test";
import { fixture, proposal } from "./helpers.js";

test("copied distribution runs without node_modules, validates YAML and applies stdin proposals", () => {
  const target = fixture(); const installation = fixture();
  try {
    const bundle = path.join(installation.root, "doc-factory.mjs");
    fs.copyFileSync(new URL("../skills/doc-factory/scripts/doc-factory.mjs", import.meta.url), bundle);
    target.write("src/index.ts", "export const format = (s: string) => s.trim();\n");
    const run = (args: string[], input?: string) => JSON.parse(execFileSync(process.execPath, [bundle, ...args, "--root", target.root], { cwd: installation.root, input, encoding: "utf8", env: { ...process.env, NODE_PATH: "" } })) as Record<string, unknown>;
    assert.equal(run(["scan"]).total, 1);
    const p = proposal(target.repo(), "---\ntitle: Library\n---\n\n# Library\n\nThis library trims names; see [source](src/index.ts).\n");
    assert.equal(run(["apply", "--proposal", "-", "--dry-run"], JSON.stringify(p)).status, "dry_run");
    assert.equal(fs.existsSync(path.join(target.root, "README.md")), false);
    assert.equal(run(["apply", "--proposal", "-"], JSON.stringify(p)).status, "success");
    assert.deepEqual(run(["check"]).issues, []);
  } finally { target.dispose(); installation.dispose(); }
});
