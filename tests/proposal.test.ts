import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fixture, proposal } from "./helpers.js";
import { applyProposal, checkProposal, parseProposal } from "../src/proposal.js";
import { delta } from "../src/git.js";
import type { Proposal } from "../src/types.js";

test("cleanup failure still reports a newly created document and its remaining temporary path", context => {
  const f = fixture();
  const unlink = fs.unlinkSync;
  try {
    f.write("src/index.ts", "export const value = 1;\n");
    context.mock.method(fs, "unlinkSync", (file: fs.PathLike) => {
      if (String(file).endsWith(".tmp")) throw new Error("simulated cleanup failure");
      unlink(file);
    });
    const result = applyProposal(f.repo(), proposal(f.repo()));
    assert.equal(result.status, "partial");
    assert.equal(result.ok, false);
    assert.deepEqual(result.written, ["README.md"]);
    assert.ok("cleanupErrors" in result && result.cleanupErrors.length === 1);
    assert.equal(fs.existsSync(path.join(f.root, "README.md")), true);
  } finally { context.mock.restoreAll(); f.dispose(); }
});

test("partial I/O failure reports completed files and cleans temporary files without rollback", context => {
  const f = fixture();
  try {
    f.write("src/index.ts", "export const value = 1;\n");
    f.write("docs/api.md", "# API\n\nExisting explanation of the exported value.\n");
    const p = proposal(f.repo(), "# Library\n\nRead the exported value [reference](docs/api.md).\n");
    p.changes.push({ ...p.changes[0]!, path: "docs/api.md", expectedHash: f.repo().read("docs/api.md").hash, content: "# API\n\nThe exported value is 1, as defined in [source](../src/index.ts).\n" });
    context.mock.method(fs, "renameSync", () => { throw new Error("simulated I/O failure"); });
    const result = applyProposal(f.repo(), p);
    assert.equal(result.status, "partial");
    assert.deepEqual(result.written, ["README.md"]);
    assert.match(f.repo().read("docs/api.md").content, /Existing explanation/u);
    assert.deepEqual(fs.readdirSync(path.join(f.root, "docs")), ["api.md"]);
    assert.equal(fs.existsSync(path.join(f.root, ".doc-factory-write.lock")), false);
  } finally { context.mock.restoreAll(); f.dispose(); }
});

test("dry-run produces real diff with no writes; apply is byte and mtime idempotent", () => {
  const f = fixture();
  try {
    f.write("src/index.ts", "export const format = (s: string) => s.trim();\n");
    const p = proposal(f.repo());
    const dry = applyProposal(f.repo(), p, true);
    assert.equal(dry.status, "dry_run"); assert.match(dry.patches[0]!.patch, /\+This library/u);
    assert.equal(fs.existsSync(path.join(f.root,"README.md")), false);
    assert.equal(applyProposal(f.repo(), p).status, "success");
    p.changes[0]!.expectedHash = f.repo().read("README.md").hash;
    const time = fs.statSync(path.join(f.root,"README.md")).mtimeMs;
    assert.equal(applyProposal(f.repo(), p).status, "no_change");
    assert.equal(fs.statSync(path.join(f.root,"README.md")).mtimeMs, time);
    assert.equal(f.repo().inventory().files.some(file => file.startsWith(".doc-factory-")), false);
  } finally { f.dispose(); }
});

test("existing edits and evidence conflicts stop before writes", () => {
  const f = fixture();
  try {
    f.write("src/index.ts", "export const value = 1;\n"); const p = proposal(f.repo());
    f.write("README.md", "Human concurrently authored this document.\n");
    assert.throws(() => applyProposal(f.repo(), p), { code: "conflict" });
    assert.match(f.repo().read("README.md").content, /Human/u);
    p.changes[0]!.expectedHash = f.repo().read("README.md").hash;
    f.write("src/index.ts", "export const value = 2;\n");
    assert.throws(() => applyProposal(f.repo(), p), { code: "evidence_conflict" });
  } finally { f.dispose(); }
});

test("unrelated dirty files are preserved and index is untouched by update", () => {
  const f = fixture(true);
  try {
    f.write("src/index.ts", "export const value = 1;\n"); f.command("add", "."); f.command("commit", "-qm", "initial");
    f.write("unrelated.txt", "user edits");
    const d = delta(f.repo());
    const p = proposal(f.repo()); p.workflow = "update"; p.scopeFingerprint = d.fingerprint;
    const index = f.command("ls-files", "--stage");
    assert.equal(applyProposal(f.repo(), p).status, "success");
    assert.equal(f.repo().read("unrelated.txt").content, "user edits");
    assert.equal(f.command("ls-files", "--stage"), index);
    assert.equal(f.command("rev-list", "--count", "HEAD").trim(), "1");
  } finally { f.dispose(); }
});

test("Git scope drift and historical writes are rejected", () => {
  const f = fixture(true);
  try {
    f.write("src/index.ts", "export const value = 1;\n"); f.command("add", "."); f.command("commit", "-qm", "initial");
    const first = f.command("rev-parse", "HEAD").trim();
    f.write("src/index.ts", "export const value = 2;\n"); f.command("add", "."); f.command("commit", "-qm", "second");
    const p = proposal(f.repo()); p.workflow = "update"; p.scope = { range: `${first}..${first}` }; p.scopeFingerprint = delta(f.repo(), p.scope).fingerprint;
    assert.equal(applyProposal(f.repo(), p, true).status, "dry_run");
    assert.throws(() => applyProposal(f.repo(), p), { code: "historical_scope" });
    p.scope = {}; p.scopeFingerprint = delta(f.repo()).fingerprint;
    f.write("new.ts", "new concurrent work\n");
    assert.throws(() => applyProposal(f.repo(), p), { code: "scope_conflict" });
  } finally { f.dispose(); }
});

test("broken new links and placeholders fail; existing unrelated errors remain visible", () => {
  const f = fixture();
  try {
    f.write("src/index.ts", "export const value = 1;\n"); f.write("old.md", "# Old\n\nExisting [broken link](missing.md).\n");
    const p = proposal(f.repo());
    const checked = checkProposal(f.repo(),p);
    assert.equal(checked.ok, true); assert.ok(checked.issues.some(issue => issue.existing));
    p.changes[0]!.content += "\n[New broken link](bad.md)\n";
    assert.equal(applyProposal(f.repo(), p).status, "invalid");
    assert.equal(fs.existsSync(path.join(f.root,"README.md")), false);
    p.changes[0]!.content = "# Heading\n\nTODO: write the documentation later.\n";
    assert.throws(() => applyProposal(f.repo(),p), { code: "placeholder" });
  } finally { f.dispose(); }
});

test("code, runtime prompts, generated documents, and unsafe paths cannot be written", () => {
  const f = fixture(); const outside = fixture();
  try {
    f.write("src/index.ts", "export const value = 1;\n"); const p = proposal(f.repo());
    for (const file of ["new.ts", "prompts/system.md", "skills/tool/SKILL.md", "../outside.md"]) {
      p.changes[0]!.path = file; assert.throws(() => applyProposal(f.repo(),p));
    }
    p.changes[0]!.path = "README.md"; f.write("README.md", "<!-- auto-generated -->\n\nContent generated from a schema.\n"); p.changes[0]!.expectedHash = f.repo().read("README.md").hash;
    assert.throws(() => applyProposal(f.repo(),p), { code: "generated_document" });
    fs.symlinkSync(outside.root, path.join(f.root,"docs")); p.changes[0]!.path = "docs/new.md"; p.changes[0]!.expectedHash = null;
    assert.throws(() => applyProposal(f.repo(),p), { code: "symlink" });
  } finally { f.dispose(); outside.dispose(); }
});

test("a document read as evidence can be updated before its dependent navigation", () => {
  const f = fixture();
  try {
    f.write("src/index.ts", "export const value = 1;\n"); f.write("docs/api.md", "# API\n\nThe existing API has one exported constant.\n");
    const p = proposal(f.repo(), "# Library\n\nRead [API](docs/api.md) before changing its implementation.\n");
    p.changes[0]!.evidence.push({ path: "docs/api.md", hash: f.repo().read("docs/api.md").hash });
    p.changes.unshift({ path: "docs/api.md", expectedHash: f.repo().read("docs/api.md").hash, content: "# API\n\nThe API exports value equal to 1 from [source](../src/index.ts).\n", reason: "Clarify actual value.", evidence: [{ path: "src/index.ts", hash: f.repo().read("src/index.ts").hash }] });
    assert.equal(applyProposal(f.repo(),p).status, "success");
  } finally { f.dispose(); }
});

test("navigation edits cannot change mkdocs plugins or execute YAML tags", () => {
  const f = fixture();
  try {
    f.write("src/index.ts", "export const value = 1;\n"); f.write("README.md", "# Library\n\nThe library has one documented entrypoint.\n");
    f.write("mkdocs.yml", "site_name: Example\nnav:\n  - Home: index.md\n");
    const p: Proposal = { ...proposal(f.repo()), changes: [{ path: "mkdocs.yml", kind: "navigation", expectedHash: f.repo().read("mkdocs.yml").hash,
      content: "site_name: Example\nnav:\n  - Guide: guide.md\n", reason: "Update navigation.", evidence: [{ path: "README.md", hash: f.repo().read("README.md").hash }] }] };
    assert.equal(checkProposal(f.repo(),p).ok,true);
    p.changes[0]!.content += "plugins: [evil]\n";
    assert.throws(() => checkProposal(f.repo(),p), { code: "navigation_scope" });
    p.changes[0]!.content = "site_name: !!js/function 'function() {}'\n";
    assert.throws(() => checkProposal(f.repo(),p), { code: "navigation_format" });
  } finally { f.dispose(); }
});

test("proposal validation rejects duplicate paths, deletion operations, missing evidence and malformed hashes", () => {
  const f = fixture();
  try {
    f.write("src/index.ts", "export const value = 1;\n"); const p = proposal(f.repo());
    assert.equal(parseProposal(p).version,1);
    assert.throws(() => parseProposal({ ...p, changes: [p.changes[0],p.changes[0]] }), { code: "duplicate_path" });
    assert.throws(() => parseProposal({ ...p, changes: [{ ...p.changes[0], delete: true }] }), { code: "invalid_proposal" });
    assert.throws(() => parseProposal({ ...p, changes: [{ ...p.changes[0], evidence: [] }] }), { code: "invalid_proposal" });
    assert.throws(() => parseProposal({ ...p, workflow: "update" }), { code: "invalid_proposal" });
  } finally { f.dispose(); }
});

test("an existing writer lock prevents writes and remains owned by its creator", () => {
  const f = fixture();
  try {
    f.write("src/index.ts", "export const value = 1;\n"); f.write(".doc-factory-write.lock", "another process");
    assert.throws(() => applyProposal(f.repo(),proposal(f.repo())), { code: "locked" });
    assert.equal(fs.readFileSync(path.join(f.root,".doc-factory-write.lock"),"utf8"),"another process");
    assert.equal(fs.existsSync(path.join(f.root,"README.md")),false);
  } finally { f.dispose(); }
});
