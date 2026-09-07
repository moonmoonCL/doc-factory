import path from "node:path";
import fs from "node:fs";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import GithubSlugger from "github-slugger";
import { parseDocument } from "yaml";
import { isDocument, Repository } from "./repository.js";
import { FactoryError, type Issue } from "./types.js";

interface Node {
  type: string;
  value?: string;
  url?: string;
  identifier?: string;
  children?: Node[];
}

export interface Page {
  links: string[];
  anchors: Set<string>;
  meaningful: boolean;
  issues: Issue[];
}

export function markdown(file: string, content: string): Page {
  const issues: Issue[] = [];
  let body = content;
  const frontmatter = /^(?:\ufeff)?---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/u.exec(content);
  if (frontmatter) {
    const yaml = parseDocument(frontmatter[1]!);
    if (yaml.errors.length) issues.push({ severity: "error", code: "frontmatter", path: file, message: "Invalid YAML frontmatter." });
    body = content.slice(frontmatter[0].length);
  }
  const root = unified().use(remarkParse).use(remarkGfm).parse(body) as Node;
  const links: string[] = [];
  const anchors = new Set<string>();
  const definitions = new Map<string, string>();
  const references: string[] = [];
  const slugger = new GithubSlugger();
  let meaningful = false;
  const text = (node: Node): string => node.value ?? (node.children ?? []).map(text).join("");
  const walk = (node: Node): void => {
    if (node.type === "heading") anchors.add(slugger.slug(text(node)));
    if ((node.type === "paragraph" || node.type === "table") && text(node).trim().length >= 20) meaningful = true;
    if (node.type === "code" && (node.value ?? "").trim().length > 10) meaningful = true;
    if ((node.type === "link" || node.type === "image") && node.url) links.push(node.url);
    if (node.type === "definition" && node.identifier && node.url) definitions.set(node.identifier.toLowerCase(), node.url);
    if ((node.type === "linkReference" || node.type === "imageReference") && node.identifier) references.push(node.identifier.toLowerCase());
    if (node.type === "html") {
      for (const match of (node.value ?? "").matchAll(/\b(?:id|name)=["']([^"']+)["']/gu)) anchors.add(match[1]!);
      if (/\b(?:href|src)=/u.test(node.value ?? "")) issues.push({ severity: "unverified", code: "html_link", path: file, message: "HTML attribute links require renderer-specific verification." });
    }
    for (const child of node.children ?? []) walk(child);
  };
  walk(root);
  for (const ref of references) {
    const target = definitions.get(ref);
    if (target) links.push(target);
    else issues.push({ severity: "error", code: "reference", path: file, message: "Missing reference-link definition." });
  }
  if (/\.(?:mdx|rst|txt)$/iu.test(file)) issues.push({ severity: "unverified", code: "format", path: file, message: "Only static Markdown fragments are checked; this format needs its own renderer." });
  return { links, anchors, meaningful, issues };
}

export function validateDocuments(repo: Repository, overlays = new Map<string, string>(), entrypoints: string[] = []): Issue[] {
  const inventory = repo.inventory();
  const documents = [...new Set([...inventory.files.filter(isDocument), ...overlays.keys()].filter(file => /\.(?:md|mdx|rst|txt)$/iu.test(file)))].sort();
  const pages = new Map<string, Page>();
  const issues: Issue[] = [];
  for (const file of documents) {
    try {
      const page = markdown(file, overlays.get(file) ?? repo.read(file).content);
      pages.set(file, page);
      issues.push(...page.issues);
    } catch (error) {
      if (!(error instanceof FactoryError)) throw error;
      issues.push({ severity: "unverified", code: error.code, path: file, message: "Document contents could not be checked." });
    }
  }
  const edges = new Map<string, Set<string>>();
  for (const [file, page] of pages) {
    const outgoing = new Set<string>();
    edges.set(file, outgoing);
    for (const raw of page.links) {
      if (/^(?:https?:|mailto:|tel:)/iu.test(raw)) continue;
      if (/^[A-Za-z][A-Za-z0-9+.-]*:/u.test(raw)) {
        issues.push({ severity: "unverified", code: "link_scheme", path: file, target: raw, message: "Non-file link scheme is not checked." });
        continue;
      }
      if (raw.startsWith("/")) {
        issues.push({ severity: "unverified", code: "site_route", path: file, target: raw, message: "Site-root routes need the project's renderer." });
        continue;
      }
      let location: string;
      let fragment: string | undefined;
      try {
        const [rawLocation, rawFragment] = raw.split("#", 2);
        location = decodeURIComponent(rawLocation!.split("?")[0]!);
        fragment = rawFragment === undefined ? undefined : decodeURIComponent(rawFragment);
      } catch {
        issues.push({ severity: "error", code: "link_encoding", path: file, target: raw, message: "Invalid URL encoding." });
        continue;
      }
      let target = location ? path.posix.normalize(path.posix.join(path.posix.dirname(file), location)) : file;
      try {
        const absolute = repo.resolve(target, true);
        if (!overlays.has(target)) {
          if (!fs.existsSync(absolute)) throw new FactoryError("missing_link", "Missing link target.");
          if (fs.statSync(absolute).isDirectory()) {
            const next = ["README.md", "index.md"].map(name => `${target}/${name}`).find(name => pages.has(name));
            if (next) target = next;
            else if (fragment) throw new FactoryError("missing_anchor", "Directory link cannot resolve an anchor.");
          }
        }
        if (pages.has(target)) outgoing.add(target);
        if (fragment) {
          const targetPage = pages.get(target);
          if (!targetPage || /\.(?:mdx|rst|txt)$/iu.test(target)) {
            issues.push({ severity: "unverified", code: "anchor_format", path: file, target: raw, message: "Anchor semantics cannot be established for this target." });
          } else if (!targetPage.anchors.has(fragment)) throw new FactoryError("missing_anchor", "Missing heading or explicit anchor.");
        }
      } catch (error) {
        if (!(error instanceof FactoryError)) throw error;
        issues.push({ severity: "error", code: error.code, path: file, target: raw, message: "Internal link target is missing, unsafe, or has no matching anchor." });
      }
    }
  }
  const reached = new Set<string>();
  const queue = [...entrypoints];
  for (const entry of entrypoints) {
    if (!pages.has(entry)) issues.push({ severity: "error", code: "entrypoint", path: entry, message: "Entrypoint must be a readable documentation file." });
  }
  while (queue.length) {
    const file = queue.shift()!;
    if (reached.has(file)) continue;
    reached.add(file);
    queue.push(...edges.get(file) ?? []);
  }
  for (const [file] of overlays) {
    if (pages.has(file) && entrypoints.length && !reached.has(file)) issues.push({ severity: "error", code: "unreachable", path: file, message: "Changed document is not reachable from the declared entrypoints." });
  }
  return issues;
}
