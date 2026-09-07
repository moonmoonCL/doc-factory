import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fixture } from "./helpers.js";
import { delta } from "../src/git.js";

test("diff distinguishes committed, staged, unstaged, and untracked changes", () => {
  const f = fixture(true);
  try {
    f.write("src/api.ts", "export const timeout = 1;\n"); f.command("add", "."); f.command("commit", "-qm", "initial");
    const base = f.command("rev-parse", "HEAD").trim();
    f.write("src/api.ts", "export const timeout = 2;\n"); f.command("add", "."); f.command("commit", "-qm", "second");
    f.write("src/api.ts", "export const timeout = 3;\n"); f.command("add", "src/api.ts");
    f.write("src/api.ts", "export const timeout = 4;\n"); f.write("new file.ts", "export const x = 1;\n");
    const result = delta(f.repo(), { base });
    assert.match(result.committed[0]!.patch!, /timeout = 2/u);
    assert.match(result.staged[0]!.patch!, /timeout = 3/u);
    assert.match(result.unstaged[0]!.patch!, /timeout = 4/u);
    assert.equal(result.untracked[0]!.path, "new file.ts");
    assert.equal(delta(f.repo()).committed.length, 0);
    assert.equal(result.fingerprint, delta(f.repo(), { base }).fingerprint);
  } finally { f.dispose(); }
});

test("opposing staged and unstaged changes remain visible", () => {
  const f = fixture(true);
  try {
    f.write("api.ts", "export const enabled = false;\n"); f.command("add", "."); f.command("commit", "-qm", "initial");
    f.write("api.ts", "export const enabled = true;\n"); f.command("add", "api.ts");
    f.write("api.ts", "export const enabled = false;\n");
    const result = delta(f.repo());
    assert.equal(result.staged.length, 1); assert.equal(result.unstaged.length, 1);
    assert.match(f.repo().read("api.ts").content, /false/u);
  } finally { f.dispose(); }
});

test("range uses snapshots, recognizes rename/delete, and blocks historical or dirty writes", () => {
  const f = fixture(true);
  try {
    f.write("old.ts", "export const value = 42;\n"); f.write("deleted.ts", "export const removed = true;\n");
    f.command("add", "."); f.command("commit", "-qm", "initial"); const base = f.command("rev-parse", "HEAD").trim();
    fs.renameSync(path.join(f.root,"old.ts"), path.join(f.root,"new.ts")); fs.unlinkSync(path.join(f.root,"deleted.ts"));
    f.command("add", "-A"); f.command("commit", "-qm", "move");
    const result = delta(f.repo(), { range: `${base}..HEAD` });
    assert.equal(result.writeAllowed, true);
    assert.ok(result.committed.some(item => item.oldPath === "old.ts" && item.path === "new.ts"));
    assert.ok(result.committed.some(item => item.status === "D"));
    assert.equal(f.repo().readRevision("old.ts", base).content, "export const value = 42;\n");
    f.write("new.ts", "export const value = 100;\n");
    assert.equal(delta(f.repo(), { range: `${base}..HEAD` }).writeAllowed, false);
    assert.equal(delta(f.repo(), { range: `${base}..${base}` }).writeAllowed, false);
  } finally { f.dispose(); }
});

test("empty HEAD is supported, missing refs and non-Git targets fail", () => {
  const f = fixture(true); const plain = fixture();
  try {
    f.write("new.ts", "export const fresh = 1;\n"); f.command("add", "new.ts");
    assert.equal(delta(f.repo()).staged.length, 1);
    assert.throws(() => delta(f.repo(), { base: "missing" }));
    assert.throws(() => delta(f.repo(), { range: "HEAD...HEAD" }), { code: "invalid_range" });
    assert.throws(() => delta(f.repo(), { base: "HEAD", range: "HEAD..HEAD" }), { code: "conflicting_scope" });
    assert.throws(() => delta(plain.repo()), { code: "git_root_required" });
  } finally { f.dispose(); plain.dispose(); }
});

test("secret values in diff history are never returned", () => {
  const f = fixture(true);
  try {
    const value = "abcdefghijk123456789";
    f.write("config.ts", `const apiKey = "${value}";\n`); f.command("add", "."); f.command("commit", "-qm", "fixture");
    f.write("config.ts", "export const value = 1;\n");
    const result = delta(f.repo());
    assert.equal(result.unstaged[0]!.withheld, "sensitive_content");
    assert.equal(JSON.stringify(result).includes(value), false);
  } finally { f.dispose(); }
});
