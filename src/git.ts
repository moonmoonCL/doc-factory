import { assertSafeContent, deniedPath, hash, Repository } from "./repository.js";
import { FactoryError, type GitScope } from "./types.js";

export interface DeltaEntry {
  status: string;
  path: string;
  oldPath?: string;
  patch?: string;
  withheld?: string;
}

export interface Delta {
  mode: "worktree" | "base" | "range";
  from: string;
  to: string;
  head: string | null;
  committed: DeltaEntry[];
  staged: DeltaEntry[];
  unstaged: DeltaEntry[];
  untracked: DeltaEntry[];
  writeAllowed: boolean;
  fingerprint: string;
}

function revision(repo: Repository, ref: string): string {
  if (!ref || ref.startsWith("-") || /[\x00-\x20]/u.test(ref)) throw new FactoryError("invalid_ref", "Invalid Git revision.");
  return repo.git(["rev-parse", "--verify", "--end-of-options", `${ref}^{commit}`]).trim();
}

function entries(repo: Repository, args: string[], before: string, after?: string): DeltaEntry[] {
  const tokens = repo.git(["diff", "--no-ext-diff", "--no-textconv", "--name-status", "-z", "--find-renames", ...args, "--"]).split("\0");
  const results: DeltaEntry[] = [];
  for (let i = 0; i < tokens.length && tokens[i];) {
    const status = tokens[i++]!;
    const first = tokens[i++]!;
    const moved = /^[RC]/u.test(status);
    const file = moved ? tokens[i++]! : first;
    const result: DeltaEntry = { status, path: file, ...(moved ? { oldPath: first } : {}) };
    try {
      for (const name of [first, file]) {
        repo.resolve(name, true);
        if (deniedPath(name) || repo.ignored(name)) throw new FactoryError("excluded_path", "Excluded");
      }
      if (!status.startsWith("A")) assertSafeContent(repo.git(["show", before === "INDEX" ? `:${first}` : `${before}:${first}`]));
      if (!status.startsWith("D")) {
        if (after) assertSafeContent(repo.git(["show", after === "INDEX" ? `:${file}` : `${after}:${file}`]));
        else repo.read(file);
      }
      const patch = repo.git(["diff", "--no-ext-diff", "--no-textconv", "--unified=3", ...args, "--", first, ...(moved ? [file] : [])]);
      assertSafeContent(patch);
      result.patch = patch;
    } catch (error) {
      if (!(error instanceof FactoryError)) throw error;
      result.withheld = error.code;
    }
    result.path = result.path.replace(/[\x00-\x1f\x7f]/gu, "?");
    if (result.oldPath) result.oldPath = result.oldPath.replace(/[\x00-\x1f\x7f]/gu, "?");
    results.push(result);
  }
  return results;
}

export function delta(repo: Repository, scope: GitScope = {}): Delta {
  if (!repo.gitRoot) throw new FactoryError("git_root_required", "Update requires --root to be the Git repository root.");
  if (scope.base && scope.range) throw new FactoryError("conflicting_scope", "Use either base or range.");
  let head: string | null;
  try { head = revision(repo, "HEAD"); } catch { head = null; }
  const empty = repo.git(["hash-object", "-t", "tree", "--stdin"], "").trim();
  const baseHead = head ?? empty;
  let from = baseHead;
  let to = "WORKTREE";
  let mode: Delta["mode"] = "worktree";
  if (scope.base) { from = revision(repo, scope.base); mode = "base"; }
  if (scope.range) {
    const pair = scope.range.split("..");
    if (pair.length !== 2 || !pair[0] || !pair[1] || pair[1].startsWith(".")) throw new FactoryError("invalid_range", "Use an explicit A..B range, not triple-dot syntax.");
    from = revision(repo, pair[0]);
    to = revision(repo, pair[1]);
    mode = "range";
  }
  const committed = mode === "range" ? entries(repo, [from, to], from, to)
    : mode === "base" ? entries(repo, [from, baseHead], from, baseHead) : [];
  const allStaged = entries(repo, ["--cached", baseHead], baseHead, "INDEX");
  const allUnstaged = entries(repo, [], "INDEX");
  const untracked: DeltaEntry[] = [];
  if (mode !== "range") {
    for (const file of repo.git(["ls-files", "--others", "--exclude-standard", "-z"]).split("\0").filter(Boolean)) {
      if (file.split("/").some(part => part.startsWith(".doc-factory-"))) continue;
      try {
        const text = repo.read(file);
        untracked.push({ status: "?", path: file, patch: text.content });
      } catch (error) {
        if (!(error instanceof FactoryError)) throw error;
        untracked.push({ status: "?", path: file.replace(/[\x00-\x1f\x7f]/gu, "?"), withheld: error.code });
      }
    }
  }
  const paths = new Set(committed.flatMap(item => [item.path, ...(item.oldPath ? [item.oldPath] : [])]));
  const clean = ![...allStaged, ...allUnstaged].some(item => paths.has(item.path) || item.oldPath && paths.has(item.oldPath));
  const result = {
    mode, from, to, head, committed,
    staged: mode === "range" ? [] : allStaged,
    unstaged: mode === "range" ? [] : allUnstaged,
    untracked,
    writeAllowed: mode !== "range" || to === head && clean,
  };
  return { ...result, fingerprint: hash(JSON.stringify(result)) };
}
