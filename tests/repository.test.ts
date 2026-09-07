import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fixture } from "./helpers.js";
import { hash, relativePath } from "../src/repository.js";

test("scan and read respect nested ignore rules, including tracked ignored files", () => {
  const f = fixture(true);
  try {
    f.write(".gitignore", "ignored/\n*.log\n");
    f.write("ignored/data.ts", "hidden");
    f.write("src/.gitignore", "private.ts\n");
    f.write("src/private.ts", "hidden");
    f.write("src/open.ts", "export const value = 42;\n");
    f.command("add", "-f", "src/private.ts");
    assert.deepEqual(f.repo().inventory().files, [".gitignore", "src/.gitignore", "src/open.ts"]);
    assert.throws(() => f.repo().read("src/private.ts"), { code: "ignored_path" });
    assert.equal(f.repo().read("src/open.ts").hash, hash("export const value = 42;\n"));
  } finally { f.dispose(); }
});

test("non-Git directory respects nested ignores", () => {
  const f = fixture();
  try {
    f.write(".gitignore", "ignored/\n"); f.write("ignored/code.ts", "hidden");
    f.write("ignored/.gitignore", "!code.ts\n");
    f.write("src/.gitignore", "*.log\n!keep.log\n"); f.write("src/a.log", "hidden"); f.write("src/keep.log", "visible");
    assert.deepEqual(f.repo().inventory().files, [".gitignore", "src/.gitignore", "src/keep.log"]);
    assert.throws(() => f.repo().read("ignored/code.ts"), { code: "ignored_path" });
  } finally { f.dispose(); }
});

test("unsafe paths, symlinks, hardlinks and subrepositories are rejected", () => {
  const f = fixture(); const outside = fixture();
  try {
    outside.write("data.md", "outside");
    f.write("good.md", "plain text");
    fs.symlinkSync(outside.root, path.join(f.root, "escape"));
    fs.symlinkSync("good.md", path.join(f.root, "alias.md"));
    fs.linkSync(path.join(outside.root, "data.md"), path.join(f.root, "hard.md"));
    f.write("nested/.git", "gitdir: elsewhere"); f.write("nested/README.md", "nested");
    for (const candidate of ["../outside", "/etc/passwd", "C:/escape", "a\\b", "a/../b", "a//b", "bad\nname"]) assert.throws(() => relativePath(candidate));
    assert.throws(() => f.repo().read("escape/data.md"), { code: "symlink" });
    assert.throws(() => f.repo().read("alias.md"), { code: "symlink" });
    assert.throws(() => f.repo().read("hard.md"), { code: "hardlink" });
    assert.throws(() => f.repo().read("nested/README.md"), { code: "nested_repository" });
  } finally { f.dispose(); outside.dispose(); }
});

test("secret paths and embedded credential values are withheld, binary and size limits apply", () => {
  const f = fixture();
  try {
    f.write(".env.example", "not read");
    f.write("config.ts", 'const apiKey = "abcdefghijk123456789";');
    f.write("binary.dat", "a\0b");
    f.write("large.txt", "x".repeat(2 * 1024 * 1024 + 1));
    assert.throws(() => f.repo().read(".env.example"), { code: "excluded_path" });
    assert.throws(() => f.repo().read("config.ts"), { code: "sensitive_content" });
    assert.throws(() => f.repo().read("binary.dat"), { code: "binary" });
    assert.throws(() => f.repo().read("large.txt"), { code: "too_large" });
  } finally { f.dispose(); }
});
