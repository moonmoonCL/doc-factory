export interface Evidence {
  path: string;
  hash: string;
  revision?: string;
}

export interface Change {
  path: string;
  expectedHash: string | null;
  content: string;
  reason: string;
  evidence: Evidence[];
  kind?: "document" | "navigation";
}

export interface GitScope {
  base?: string;
  range?: string;
}

export interface Proposal {
  version: 1;
  workflow: "init" | "update";
  scope?: GitScope;
  scopeFingerprint?: string;
  changes: Change[];
  entrypoints: string[];
  gaps?: string[];
}

export interface Issue {
  severity: "error" | "warning" | "unverified";
  code: string;
  path: string;
  target?: string;
  message: string;
  existing?: boolean;
}

export class FactoryError extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
}
