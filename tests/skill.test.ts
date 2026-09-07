import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { parseDocument } from "yaml";
import { markdown } from "../src/markdown.js";

test("Skill follows open-format frontmatter and its progressive references are packaged", () => {
  const root = fileURLToPath(new URL("../skills/doc-factory/", import.meta.url));
  const content = fs.readFileSync(path.join(root, "SKILL.md"), "utf8");
  const frontmatter = /^---\n([\s\S]+?)\n---\n/u.exec(content);
  assert.ok(frontmatter);
  const document = parseDocument(frontmatter[1]!);
  assert.deepEqual(document.errors, []);
  const metadata = document.toJS() as Record<string, string>;
  assert.equal(metadata.name, path.basename(root));
  assert.match(metadata.name!, /^[a-z0-9]+(?:-[a-z0-9]+)*$/u);
  assert.ok(metadata.name!.length <= 64);
  assert.ok(metadata.description!.length > 0 && metadata.description!.length <= 1024);
  assert.ok(metadata.compatibility!.length > 0 && metadata.compatibility!.length <= 500);
  assert.ok(Object.keys(metadata).every(key => ["name", "description", "compatibility", "license", "metadata", "allowed-tools"].includes(key)));
  assert.ok(content.split("\n").length < 500);
  const references = fs.readdirSync(path.join(root, "references")).filter(file => file.endsWith(".md"));
  const rootLinks = markdown("SKILL.md", content).links;
  for (const reference of references) assert.ok(rootLinks.includes(`references/${reference}`), reference);
  for (const file of ["SKILL.md", ...references.map(file => `references/${file}`)]) {
    const page = markdown(file, fs.readFileSync(path.join(root, file), "utf8"));
    assert.deepEqual(page.issues, []);
    for (const link of page.links.filter(link => !/^https?:/u.test(link))) {
      const target = path.resolve(root, path.dirname(file), link.split("#")[0]!);
      assert.ok(target.startsWith(root));
      assert.ok(fs.existsSync(target), `${file} -> ${link}`);
    }
  }
  assert.ok(fs.existsSync(path.join(root, "scripts/doc-factory.mjs")));
});
