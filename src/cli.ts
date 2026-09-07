#!/usr/bin/env node
import fs from "node:fs";
import { parseArgs } from "node:util";
import { delta } from "./git.js";
import { validateDocuments } from "./markdown.js";
import { applyProposal, checkProposal, parseProposal } from "./proposal.js";
import { isDocument, isNavigation, Repository } from "./repository.js";
import { FactoryError } from "./types.js";

const help = {
  name: "doc-factory helper", version: "0.1.0",
  usage: "node <skill>/scripts/doc-factory.mjs <command> --root <repository> [options]",
  commands: {
    scan: "List eligible files and document candidates; --prefix <directory> --offset N --limit N",
    read: "Read safe UTF-8 files: read <path...> [--revision <ref>]",
    diff: "Inspect Git: diff [--base REF | --range A..B] [--summary] [--offset N --limit N]; default HEAD -> worktree",
    check: "Check current Markdown; with --proposal - read a candidate JSON from stdin",
    apply: "Apply candidate JSON from stdin: apply --proposal - [--dry-run]",
  },
  semantics: "init/update are host Agent Skill workflows, not model-powered CLI commands. All helper output is JSON. No API keys or persistent state.",
};

try {
  const { positionals, values } = parseArgs({ allowPositionals: true, options: {
    root: { type: "string", default: process.cwd() },
    base: { type: "string" }, range: { type: "string" }, revision: { type: "string" },
    proposal: { type: "string" }, "dry-run": { type: "boolean", default: false },
    prefix: { type: "string" }, offset: { type: "string", default: "0" }, limit: { type: "string", default: "200" },
    help: { type: "boolean" }, summary: { type: "boolean" },
  } });
  const command = positionals[0];
  if (values.help || !command) console.log(JSON.stringify(help, null, 2));
  else {
    const repo = new Repository(values.root!);
    let output: unknown;
    const proposal = () => {
      if (values.proposal !== "-") throw new FactoryError("stdin_required", "Use --proposal - and pipe JSON via stdin; proposals are not persisted in target repositories.");
      const raw = fs.readFileSync(0, "utf8");
      if (Buffer.byteLength(raw) > 32 * 1024 * 1024) throw new FactoryError("too_large", "Proposal exceeds 32 MiB.");
      let parsed: unknown;
      try { parsed = JSON.parse(raw); } catch { throw new FactoryError("invalid_json", "Proposal is not valid JSON."); }
      return parseProposal(parsed);
    };
    switch (command) {
      case "scan": {
        const offset = Number(values.offset);
        const limit = Number(values.limit);
        if (!Number.isSafeInteger(offset) || offset < 0 || !Number.isSafeInteger(limit) || limit < 1 || limit > 2000) throw new FactoryError("pagination", "Offset must be nonnegative; limit must be between 1 and 2000.");
        const inventory = repo.inventory();
        const files = inventory.files.filter(file => !values.prefix || file === values.prefix || file.startsWith(`${values.prefix}/`));
        output = { root: repo.root, gitRoot: repo.gitRoot, total: files.length, nextOffset: offset + limit < files.length ? offset + limit : null,
          files: files.slice(offset, offset + limit).map(file => ({ path: file, kind: isNavigation(file) ? "navigation" : isDocument(file) ? "document" : "evidence" })), skipped: inventory.skipped,
          reading: "Read applicable AGENTS.md first, then current documentation and task-specific source/tests. Classifications are candidates, not semantic ownership decisions." };
        break;
      }
      case "read":
        if (positionals.length < 2) throw new FactoryError("paths_required", "Pass at least one repository-relative path.");
        output = { files: positionals.slice(1).map(file => values.revision ? repo.readRevision(file, values.revision) : repo.read(file)) };
        break;
      case "diff": {
        const result = delta(repo, { base: values.base, range: values.range });
        const offset = Number(values.offset);
        const limit = Number(values.limit);
        if (!Number.isSafeInteger(offset) || offset < 0 || !Number.isSafeInteger(limit) || limit < 1 || limit > 2000) throw new FactoryError("pagination", "Offset must be nonnegative; limit must be between 1 and 2000.");
        const layers = ["committed", "staged", "unstaged", "untracked"] as const;
        const stream = layers.flatMap(layer => result[layer].map(entry => ({ layer, entry })));
        const selected = stream.slice(offset, offset + limit);
        for (const layer of layers) result[layer] = selected.filter(item => item.layer === layer).map(({ entry }) => {
          if (!values.summary) return entry;
          const { patch, ...rest } = entry;
          return { ...rest, ...(patch === undefined ? {} : { patchOmitted: true }) };
        });
        output = { ...result, pagination: { total: stream.length, offset, limit, nextOffset: offset + limit < stream.length ? offset + limit : null } };
        break;
      }
      case "check": output = values.proposal ? checkProposal(repo, proposal()) : { issues: validateDocuments(repo), semanticCorrectness: "not_proven" }; break;
      case "apply": output = applyProposal(repo, proposal(), values["dry-run"]); break;
      default: throw new FactoryError("unknown_command", "Unknown helper command. init/update are Skill workflows; use --help.");
    }
    const serialized = JSON.stringify(output, null, 2);
    console.log(serialized);
    if (typeof output === "object" && output !== null && "ok" in output && output.ok === false) process.exitCode = 1;
    if (command === "check" && !values.proposal && (output as { issues: { severity: string }[] }).issues.some(issue => issue.severity === "error")) process.exitCode = 1;
  }
} catch (error) {
  console.log(JSON.stringify({ ok: false, error: { code: error instanceof FactoryError ? error.code : "operation_failed", message: error instanceof FactoryError ? error.message : "Operation failed; no sensitive exception details are emitted." } }));
  process.exitCode = 1;
}
