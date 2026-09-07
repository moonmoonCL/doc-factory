import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import ignore from "ignore";
import { FactoryError } from "./types.js";

export const MAX_FILE_BYTES = 2 * 1024 * 1024;
const excludedDirectories = new Set([".git", "node_modules", "vendor", "dist", "build", "coverage", ".next", ".cache", ".venv", "__pycache__"]);

export function hash(content: string | Buffer): string {
  return crypto.createHash("sha256").update(content).digest("hex");
}

export function relativePath(input: string): string {
  if (!input || /[\\\x00-\x1f\x7f]/u.test(input) || path.posix.isAbsolute(input) || /^[A-Za-z]:/u.test(input)) {
    throw new FactoryError("unsafe_path", "Expected a repository-relative POSIX path without control characters.");
  }
  if (input.split("/").some(part => !part || part === "." || part === "..")) {
    throw new FactoryError("unsafe_path", "Path contains an empty, dot, or parent segment.");
  }
  return input;
}

export function deniedPath(input: string): boolean {
  const parts = input.split("/");
  return parts.some(part => excludedDirectories.has(part.toLowerCase()) || /^\.doc-factory-/u.test(part)
    || /^\.env(?:\.|$)/iu.test(part) || /^(?:secrets?|credentials?)(?:\.|$)/iu.test(part)
    || /^(?:id_rsa|id_ed25519|\.npmrc|\.netrc)$/iu.test(part)
    || /\.(?:pem|key|p12|pfx|keystore)$/iu.test(part));
}

export function sensitive(content: string): boolean {
  if (/-----BEGIN (?:[A-Z ]+ )?PRIVATE KEY-----|\bAKIA[0-9A-Z]{16}\b|\b(?:gh[pousr]_|github_pat_|sk-proj-)[A-Za-z0-9_\-]{16,}|\bBearer\s+[A-Za-z0-9._\-]{24,}/u.test(content)) return true;
  const assignment = /(?:["']?)(?:password|passwd|api[_-]?key|access[_-]?token|client[_-]?secret|secret[_-]?key)(?:["']?)\s*[:=]\s*["']([^"'\n]{8,})["']/giu;
  return [...content.matchAll(assignment)].some(match => !/^(?:<[^>]+>|\$\{[^}]+\}|process\.env\..+|example.*|placeholder.*|your[-_ ].*|test[-_ ].*|changeme.*)$/iu.test(match[1]!));
}

export function assertSafeContent(content: string): void {
  if (Buffer.byteLength(content) > MAX_FILE_BYTES) throw new FactoryError("too_large", "File exceeds the 2 MiB reading/writing limit.");
  if (content.includes("\0") || content.includes("\ufffd")) throw new FactoryError("binary", "Only valid UTF-8 text is supported.");
  if (sensitive(content)) throw new FactoryError("sensitive_content", "Content resembles a secret; it was withheld.");
}

export function isDocument(file: string): boolean {
  if (/(?:^|\/)(?:skills|prompts|assets|fixtures|snapshots|generated|\.generated|archives?|archived)(?:\/|$)/iu.test(file)) return false;
  if (/^(?:\.agents|\.claude|\.codex|\.pi)\//u.test(file) && !/^\.agents\/notes\//u.test(file)) return false;
  return /\.(?:md|mdx|rst)$/iu.test(file) && !/(?:^|\/)(?:SKILL|SYSTEM|CHANGELOG|LICENSE)(?:\.|$)/iu.test(file)
    || /(?:^|\/)(?:README|AGENTS)\.txt$/iu.test(file)
    || /^(?:docs?|documentation)\/.*\.txt$/iu.test(file);
}

export function isNavigation(file: string): boolean {
  return /(?:^|\/)(?:mkdocs\.ya?ml|_meta\.json|_category_\.json|SUMMARY\.md)$/u.test(file);
}

export function generated(content: string): boolean {
  return /(?:auto[- ]generated|generated (?:file|by|from)|do not edit|@generated)/iu.test(content.slice(0,1500));
}

export class Repository {
  readonly root: string;
  readonly gitRoot: boolean;

  constructor(root: string) {
    this.root = fs.realpathSync(root);
    if (!fs.statSync(this.root).isDirectory()) throw new FactoryError("not_directory", "Target must be a directory.");
    let top: string | undefined;
    try { top = this.git(["rev-parse", "--show-toplevel"]).trim(); } catch { top = undefined; }
    this.gitRoot = top !== undefined && fs.realpathSync(top) === this.root;
  }

  git(args: string[], input?: string | Buffer): string {
    try {
      return execFileSync("git", ["-c", "core.fsmonitor=false", "-c", "core.untrackedCache=false", ...args], {
        cwd: this.root, encoding: "utf8", input, maxBuffer: 32 * 1024 * 1024,
        env: { ...process.env, GIT_OPTIONAL_LOCKS: "0", GIT_TERMINAL_PROMPT: "0" }, stdio: ["pipe", "pipe", "pipe"],
      });
    } catch {
      throw new FactoryError("git_failed", "Git inspection failed; verify the repository, refs, and available history.");
    }
  }

  resolve(file: string, allowMissing = false): string {
    relativePath(file);
    if (deniedPath(file)) throw new FactoryError("excluded_path", "Path is excluded by the file policy.");
    let current = this.root;
    for (const part of file.split("/")) {
      current = path.join(current, part);
      let stat: fs.Stats;
      try { stat = fs.lstatSync(current); }
      catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT" && allowMissing) continue;
        throw new FactoryError("missing_path", "A requested path does not exist.");
      }
      if (stat.isSymbolicLink()) throw new FactoryError("symlink", "Symbolic links are not followed.");
      if (stat.isFile() && stat.nlink > 1) throw new FactoryError("hardlink", "Hard-linked files are not read or replaced.");
      if (!stat.isDirectory() && !stat.isFile()) throw new FactoryError("special_file", "Only regular files and directories are supported.");
      if (stat.isDirectory() && fs.existsSync(path.join(current, ".git"))) throw new FactoryError("nested_repository", "Nested repositories and submodules are not traversed.");
    }
    return current;
  }

  ignored(file: string): boolean {
    relativePath(file);
    if (this.gitRoot) {
      const result = spawnSync("git", ["-c", "core.fsmonitor=false", "check-ignore", "--no-index", "--quiet", "--", file], {
        cwd: this.root, env: { ...process.env, GIT_OPTIONAL_LOCKS: "0" }, stdio: "pipe",
      });
      if (result.status === 0) return true;
      if (result.status === 1) return false;
      throw new FactoryError("ignore_failed", "Could not inspect Git ignore rules.");
    }
    const segments = file.split("/");
    let decision = false;
    const inherited: { depth: number; matcher: ReturnType<typeof ignore> }[] = [];
    for (let depth = 0; depth < segments.length; depth++) {
      let parentIgnored = false;
      for (const rule of inherited) {
        const result = rule.matcher.test(`${segments.slice(rule.depth, depth).join("/")}/`);
        if (result.ignored) parentIgnored = true;
        if (result.unignored) parentIgnored = false;
      }
      if (parentIgnored) return true;
      const directory = segments.slice(0, depth).join("/");
      const candidate = directory ? `${directory}/.gitignore` : ".gitignore";
      try {
        const location = this.resolve(candidate);
        const rules = fs.readFileSync(location, "utf8");
        assertSafeContent(rules);
        const matcher = ignore().add(rules);
        inherited.push({ depth, matcher });
        const result = matcher.test(segments.slice(depth).join("/"));
        if (result.ignored) decision = true;
        if (result.unignored) decision = false;
      } catch (error) {
        if (!(error instanceof FactoryError && error.code === "missing_path")) throw error;
      }
    }
    return decision;
  }

  read(file: string): { path: string; hash: string; content: string } {
    const absolute = this.resolve(file);
    if (this.ignored(file)) throw new FactoryError("ignored_path", "Path is ignored by project rules.");
    const fd = fs.openSync(absolute, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
    try {
      const stat = fs.fstatSync(fd);
      if (!stat.isFile() || stat.nlink !== 1) throw new FactoryError("special_file", "Expected an unlinked regular text file.");
      if (stat.size > MAX_FILE_BYTES) throw new FactoryError("too_large", "File exceeds the 2 MiB reading limit.");
      const raw = fs.readFileSync(fd);
      const content = raw.toString("utf8");
      assertSafeContent(content);
      return { path: file, hash: hash(raw), content };
    } finally { fs.closeSync(fd); }
  }

  readRevision(file: string, ref: string): { path: string; hash: string; content: string; revision: string } {
    if (!this.gitRoot) throw new FactoryError("git_root_required", "Historical reads require the Git root.");
    this.resolve(file, true);
    if (this.ignored(file)) throw new FactoryError("ignored_path", "Path is ignored.");
    if (!ref || ref.startsWith("-") || /[\x00-\x20]/u.test(ref)) throw new FactoryError("invalid_ref", "Invalid revision.");
    const revision = this.git(["rev-parse", "--verify", "--end-of-options", `${ref}^{commit}`]).trim();
    const listing = this.git(["ls-tree", "-z", revision, "--", file]);
    if (!/^100(?:644|755) blob /u.test(listing)) throw new FactoryError("historical_file", "Historical target must be a regular file.");
    const content = this.git(["show", `${revision}:${file}`]);
    assertSafeContent(content);
    return { path: file, hash: hash(content), content, revision };
  }

  inventory(): { files: string[]; skipped: { path: string; reason: string }[] } {
    const files: string[] = [];
    const skipped: { path: string; reason: string }[] = [];
    const visit = (dir: string): void => {
      for (const entry of fs.readdirSync(path.join(this.root, dir), { withFileTypes: true })) {
        const file = dir ? `${dir}/${entry.name}` : entry.name;
        try {
          this.resolve(file);
          if (this.ignored(entry.isDirectory() ? `${file}/_` : file)) throw new FactoryError("ignored_path", "Ignored");
          if (entry.isDirectory()) visit(file);
          else files.push(file);
        } catch (error) {
          if (!(error instanceof FactoryError)) throw error;
          skipped.push({ path: file.replace(/[\x00-\x1f\x7f]/gu, "?"), reason: error.code });
        }
      }
    };
    visit("");
    return { files: files.sort(), skipped };
  }
}
