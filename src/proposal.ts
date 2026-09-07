import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { createTwoFilesPatch } from "diff";
import { parseDocument } from "yaml";
import { delta } from "./git.js";
import { markdown, validateDocuments } from "./markdown.js";
import { assertSafeContent, generated, hash, isDocument, isNavigation, relativePath, Repository } from "./repository.js";
import { FactoryError, type Change, type Issue, type Proposal } from "./types.js";

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function validHash(value: unknown): value is string { return typeof value === "string" && /^[a-f0-9]{64}$/u.test(value); }

export function parseProposal(value: unknown): Proposal {
  if (!object(value) || value.version !== 1 || !["init", "update"].includes(String(value.workflow)) || !Array.isArray(value.changes)
    || !Array.isArray(value.entrypoints) || !value.entrypoints.length || !value.entrypoints.every(item => typeof item === "string")) {
    throw new FactoryError("invalid_proposal", "Expected version 1, workflow, changes, and nonempty entrypoints.");
  }
  if (value.scope !== undefined && (!object(value.scope) || Object.keys(value.scope).some(key => !["base", "range"].includes(key))
    || Object.values(value.scope).some(item => typeof item !== "string" || !item))) throw new FactoryError("invalid_proposal", "Invalid scope.");
  if (value.workflow === "update" && !validHash(value.scopeFingerprint)) throw new FactoryError("invalid_proposal", "Update requires the fingerprint from diff.");
  if (value.gaps !== undefined && (!Array.isArray(value.gaps) || !value.gaps.every(item => typeof item === "string"))) throw new FactoryError("invalid_proposal", "Gaps must be strings.");
  const seen = new Set<string>();
  for (const item of value.changes) {
    if (!object(item) || typeof item.path !== "string" || typeof item.content !== "string" || typeof item.reason !== "string" || !item.reason.trim()
      || !(item.expectedHash === null || validHash(item.expectedHash)) || !Array.isArray(item.evidence) || !item.evidence.length
      || item.evidence.some(ref => !object(ref) || typeof ref.path !== "string" || !validHash(ref.hash) || ref.revision !== undefined && typeof ref.revision !== "string")
      || item.kind !== undefined && !["document", "navigation"].includes(String(item.kind))
      || Object.keys(item).some(key => !["path", "expectedHash", "content", "reason", "evidence", "kind"].includes(key))) {
      throw new FactoryError("invalid_proposal", "Every change needs a path, expectedHash (null for new files), content, reason, and nonempty evidence; deletion operations are unsupported.");
    }
    relativePath(item.path);
    if (seen.has(item.path)) throw new FactoryError("duplicate_path", "A proposal contains duplicate output paths.");
    seen.add(item.path);
    assertSafeContent(item.content);
    assertSafeContent(item.reason);
  }
  for (const file of value.entrypoints) relativePath(file as string);
  for (const gap of (value.gaps ?? []) as string[]) assertSafeContent(gap);
  return value as unknown as Proposal;
}

function staticData(file: string, content: string): Record<string, unknown> {
  try {
    const parsed = file.endsWith(".json") ? JSON.parse(content) as unknown : (() => {
      const result = parseDocument(content);
      if (result.errors.length || result.warnings.length) throw new Error("unsupported YAML");
      return result.toJS() as unknown;
    })();
    if (!object(parsed)) throw new Error("not a map");
    return parsed;
  } catch { throw new FactoryError("navigation_format", "Navigation must be a static JSON/YAML mapping without custom tags."); }
}

function verifyNavigation(file: string, oldContent: string, content: string): void {
  if (!isNavigation(file) || file.endsWith(".md") || !/(?:^|\/)(?:docs?|documentation)\//u.test(file) && !/^mkdocs\.ya?ml$/u.test(file)) {
    throw new FactoryError("navigation_scope", "Only root mkdocs nav and documentation _meta/_category_ JSON files are writable as navigation.");
  }
  const previous = staticData(file, oldContent);
  const next = staticData(file, content);
  if (/mkdocs\.ya?ml$/u.test(file)) {
    delete previous.nav;
    delete next.nav;
    if (JSON.stringify(previous) !== JSON.stringify(next)) throw new FactoryError("navigation_scope", "Only the mkdocs nav field may change.");
  }
}

function verifyChange(repo: Repository, change: Change, ownWrites = new Map<string, string>()): string | null {
  const absolute = repo.resolve(change.path, true);
  if (repo.ignored(change.path)) throw new FactoryError("ignored_path", "A documentation target is ignored.");
  const exists = fs.existsSync(absolute);
  const previous = exists ? repo.read(change.path) : null;
  if ((previous?.hash ?? null) !== change.expectedHash) throw new FactoryError("conflict", `Document changed since it was read: ${change.path}`);
  if (previous && generated(previous.content)) throw new FactoryError("generated_document", "Generated documents must be maintained at their source.");
  if (change.kind === "navigation") {
    if (!previous) throw new FactoryError("navigation_scope", "Only existing recognized navigation configuration may be edited.");
    verifyNavigation(change.path, previous.content, change.content);
  } else {
    if (!isDocument(change.path)) throw new FactoryError("not_document", "Write target is not a supported project documentation path.");
    if (!markdown(change.path, change.content).meaningful) throw new FactoryError("empty_document", "Document needs substantive prose or working examples, not just headings.");
    if (!previous && /^(?:TODO|TBD|待填写|占位)(?:\s|[.:：]|$)/imu.test(change.content)) throw new FactoryError("placeholder", "New documentation must not contain placeholder sections.");
  }
  for (const evidence of change.evidence) {
    const actual = evidence.revision ? repo.readRevision(evidence.path, evidence.revision) : repo.read(evidence.path);
    const expected = evidence.revision ? evidence.hash : ownWrites.get(evidence.path) ?? evidence.hash;
    if (actual.hash !== expected) throw new FactoryError("evidence_conflict", `Evidence changed since it was read: ${evidence.path}`);
  }
  return previous?.content ?? null;
}

function checkScope(repo: Repository, proposal: Proposal, dryRun: boolean): void {
  if (proposal.workflow !== "update") return;
  const current = delta(repo, proposal.scope);
  if (current.fingerprint !== proposal.scopeFingerprint) throw new FactoryError("scope_conflict", "Git scope changed since diff was read. Inspect it again before writing.");
  if (!dryRun && !current.writeAllowed) throw new FactoryError("historical_scope", "Historical or dirty range cannot be written; use dry-run or a base comparison.");
  if (!dryRun && current.mode === "range") {
    for (const change of proposal.changes) {
      for (const evidence of change.evidence.filter(ref => !isDocument(ref.path))) {
        let content: string;
        try { content = repo.git(["show", `${current.to}:${relativePath(evidence.path)}`]); }
        catch { throw new FactoryError("historical_evidence", "Range evidence must exist at the selected end revision."); }
        if (hash(content) !== evidence.hash) throw new FactoryError("historical_evidence", "Range evidence differs from the selected end revision.");
      }
    }
  }
}

function issueKey(issue: Issue): string { return JSON.stringify([issue.code, issue.path, issue.target]); }

export function checkProposal(repo: Repository, proposal: Proposal, dryRun = true) {
  checkScope(repo, proposal, dryRun);
  const before = new Map<string, string | null>();
  const overlays = new Map<string, string>();
  for (const change of proposal.changes) {
    before.set(change.path, verifyChange(repo, change));
    overlays.set(change.path, change.content);
  }
  const baseline = new Set(validateDocuments(repo).map(issueKey));
  const issues = validateDocuments(repo, overlays, proposal.entrypoints).map(issue => ({ ...issue, existing: baseline.has(issueKey(issue)) }));
  for (const change of proposal.changes.filter(item => item.kind === "navigation")) {
    issues.push({ severity: "unverified", code: "navigation_renderer", path: change.path, message: "Static navigation editing is checked, but site route generation needs the project's renderer.", existing: false });
  }
  const patches = proposal.changes.filter(change => before.get(change.path) !== change.content).map(change => ({
    path: change.path, reason: change.reason, evidence: change.evidence,
    patch: createTwoFilesPatch(before.get(change.path) === null ? "/dev/null" : change.path, change.path, before.get(change.path) ?? "", change.content, "", ""),
  }));
  return { ok: !issues.some(issue => issue.severity === "error" && !issue.existing), issues, patches, unchanged: proposal.changes.filter(change => before.get(change.path) === change.content).map(change => change.path), gaps: proposal.gaps ?? [] };
}

export function applyProposal(repo: Repository, proposal: Proposal, dryRun = false) {
  const checked = checkProposal(repo, proposal, dryRun);
  if (!checked.ok) return { ...checked, status: "invalid", written: [] as string[] };
  if (dryRun) return { ...checked, status: "dry_run", written: [] as string[] };
  const written: string[] = [];
  if (!checked.patches.length) return { ...checked, status: "no_change", written };
  const lockPath = path.join(repo.root, ".doc-factory-write.lock");
  let lock: number;
  try { lock = fs.openSync(lockPath, "wx", 0o600); }
  catch { throw new FactoryError("locked", "Another write or an interrupted run owns .doc-factory-write.lock; inspect it before retrying."); }
  const temporaryPaths = new Set<string>();
  const ownWrites = new Map<string, string>();
  const cleanupErrors: string[] = [];
  let outcome: typeof checked & { status: string; written: string[]; postWriteIssues?: Issue[]; error?: { code: string; message: string } };
  try {
    fs.writeFileSync(lock, JSON.stringify({ pid: process.pid }));
    checkScope(repo, proposal, false);
    for (const change of proposal.changes) verifyChange(repo, change);
    for (const change of proposal.changes) {
      if (!checked.patches.some(patch => patch.path === change.path)) continue;
      const previous = verifyChange(repo, change, ownWrites);
      const absolute = repo.resolve(change.path, true);
      fs.mkdirSync(path.dirname(absolute), { recursive: true });
      repo.resolve(change.path, true);
      const temp = path.join(path.dirname(absolute), `.doc-factory-${crypto.randomUUID()}.tmp`);
      const mode = previous === null ? 0o644 : fs.statSync(absolute).mode & 0o777;
      const fd = fs.openSync(temp, "wx", mode);
      temporaryPaths.add(temp);
      try { fs.writeFileSync(fd, change.content); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
      verifyChange(repo, change, ownWrites);
      if (previous === null) fs.linkSync(temp, absolute);
      else fs.renameSync(temp, absolute);
      written.push(change.path);
      ownWrites.set(change.path, hash(change.content));
      if (previous === null) fs.unlinkSync(temp);
      temporaryPaths.delete(temp);
      if (repo.read(change.path).hash !== hash(change.content)) throw new FactoryError("postwrite_conflict", "Document changed immediately after writing.");
    }
    const after = validateDocuments(repo, new Map(), proposal.entrypoints);
    const existingErrors = new Set(checked.issues.filter(issue => issue.existing).map(issueKey));
    if (after.some(issue => issue.severity === "error" && !existingErrors.has(issueKey(issue)))) {
      outcome = { ...checked, ok: false, status: "partial", written, postWriteIssues: after,
        error: { code: "postwrite_validation", message: "Documents were written but final structural validation found new errors; inspect concurrent changes before retrying." } };
    } else outcome = { ...checked, status: "success", written, postWriteIssues: after };
  } catch (error) {
    outcome = { ...checked, ok: false, status: written.length ? "partial" : "conflict", written,
      error: { code: error instanceof FactoryError ? error.code : "write_failed", message: error instanceof FactoryError ? error.message : "File write failed. Existing changes were not rolled back." } };
  } finally {
    for (const temporary of temporaryPaths) {
      try { fs.unlinkSync(temporary); }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") cleanupErrors.push(path.relative(repo.root, temporary)); }
    }
    try { fs.closeSync(lock); } catch { cleanupErrors.push("writer lock handle"); }
    try { fs.unlinkSync(lockPath); } catch { cleanupErrors.push(".doc-factory-write.lock"); }
  }
  if (cleanupErrors.length) return { ...outcome, ok: false, status: written.length ? "partial" : "conflict", cleanupErrors };
  return outcome;
}
