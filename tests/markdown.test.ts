import assert from "node:assert/strict";
import { test } from "node:test";
import { fixture } from "./helpers.js";
import { markdown, validateDocuments } from "../src/markdown.js";

test("Markdown parser handles Chinese/repeated headings, references, images and fenced examples", () => {
  const f = fixture();
  try {
    f.write("README.md", "# Example\n\nRead [配置](docs/setup.md#配置) and [again][duplicate].\n\n[duplicate]: docs/setup.md#配置-1\n\n![diagram](docs/diagram.svg)\n\n```md\n[not a link](missing.md)\n```\n");
    f.write("docs/setup.md", "# 配置\n\nConfiguration is explicit and testable.\n\n# 配置\n\nThe second configuration example.\n");
    f.write("docs/diagram.svg", "<svg />");
    f.write("docs/a#b?.md", "# Encoded\n\nNames may contain encoded URL separators.\n");
    f.write("encoded.md", "# Encoded link\n\nRead [encoded name](docs/a%23b%3F.md#encoded).\n");
    assert.deepEqual(validateDocuments(f.repo()), []);
    assert.deepEqual([...markdown("x.md", "# 配置\n# 配置\n").anchors], ["配置", "配置-1"]);
  } finally { f.dispose(); }
});

test("missing targets, anchors, and encoded path escapes are errors", () => {
  const f = fixture();
  try {
    f.write("README.md", "# Root\n\n[missing](none.md) [anchor](#absent) [escape](%2e%2e/outside.md)\n");
    assert.deepEqual(validateDocuments(f.repo()).map(issue => issue.code), ["missing_link", "missing_anchor", "unsafe_path"]);
  } finally { f.dispose(); }
});

test("candidate files participate in links and navigation before they exist", () => {
  const f = fixture();
  try {
    const docs = new Map([["README.md", "# Root\n\n[Architecture](docs/architecture.md)\n"], ["docs/architecture.md", "# Architecture\n\nThis describes the actual request flow.\n"]]);
    assert.deepEqual(validateDocuments(f.repo(), docs, ["README.md"]), []);
    docs.set("docs/orphan.md", "# Orphan\n\nThis page cannot be found from the entrypoint.\n");
    assert.ok(validateDocuments(f.repo(), docs, ["README.md"]).some(issue => issue.code === "unreachable"));
  } finally { f.dispose(); }
});

test("renderer-dependent links and formats are explicitly unverified", () => {
  const f = fixture();
  try {
    f.write("README.md", "# Root\n\n[Site](/guide/) and [component](component.mdx#dynamic).\n<a href=\"dynamic\">external renderer</a>\n");
    f.write("component.mdx", "# Component\n\n<Generated />\n");
    const issues = validateDocuments(f.repo());
    assert.ok(issues.some(issue => issue.code === "site_route"));
    assert.ok(issues.some(issue => issue.code === "anchor_format"));
    assert.ok(issues.some(issue => issue.code === "html_link"));
    assert.ok(issues.every(issue => issue.severity === "unverified"));
  } finally { f.dispose(); }
});
