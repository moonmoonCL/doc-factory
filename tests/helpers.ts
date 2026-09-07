import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { Repository } from "../src/repository.js";
import type { Proposal } from "../src/types.js";

export function fixture(git = false) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "doc-factory-test-"));
  const command = (...args: string[]) => execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"], env: { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1" } });
  const write = (file: string, content: string) => { fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true }); fs.writeFileSync(path.join(root, file), content); };
  if (git) {
    command("init", "-q");
    command("config", "user.name", "Fixture");
    command("config", "user.email", "fixture@example.invalid");
    command("config", "commit.gpgsign", "false");
  }
  return { root, write, command, repo: () => new Repository(root), dispose: () => fs.rmSync(root, { recursive: true, force: true }) };
}

export function proposal(repo: Repository, content = "# Library\n\nThis library formats names. See [implementation](src/index.ts).\n"): Proposal {
  return { version: 1, workflow: "init", entrypoints: ["README.md"], changes: [{ path: "README.md", expectedHash: null, content, reason: "Explain the verified public entrypoint.", evidence: [{ path: "src/index.ts", hash: repo.read("src/index.ts").hash }] }] };
}
