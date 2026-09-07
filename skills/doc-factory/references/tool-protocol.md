# Tool protocol

Run `node <installed-skill>/scripts/doc-factory.mjs --help`. Every response is JSON. Commands operate only inside `--root`. Exit 1 means validation, input, conflict or operational failure; read the returned status and error code, not just the process status.

## Read-only commands

```sh
node <helper> scan --root <repo> --limit 200 --offset 0
node <helper> scan --root <repo> --prefix packages
node <helper> read --root <repo> AGENTS.md README.md src/index.ts
node <helper> read --root <repo> --revision HEAD~1 src/index.ts
node <helper> diff --root <repo>
node <helper> diff --root <repo> --base main
node <helper> diff --root <repo> --range HEAD~1..HEAD
node <helper> check --root <repo>
```

`read` returns path, SHA-256 and full safe UTF-8 content. Historical reads also return a resolved revision. Reading is bounded to 2 MiB per file. `scan` reports filenames, candidate kinds and skipped paths; it does not establish the meaning or safety of file contents. Read the necessary candidates to obtain evidence.

`diff` reports `from`, `to`, `head`, committed/staged/unstaged/untracked entries, `writeAllowed`, and `fingerprint`. For untracked files `patch` is the complete safe content, not a Git patch. A `withheld` reason means the file was not inspected semantically. Use `--summary` to omit patch bodies and `--offset`/`--limit` to retrieve the entry stream in pages; the fingerprint always covers the complete selected scope. No ref is inferred from a previous run.

## Candidate input

`check --proposal -` and `apply --proposal - [--dry-run]` read this versioned JSON from stdin. Generate the candidate in the host's current context; use a quoted heredoc or a host process API to transmit it without shell interpolation. Do not save a proposal, mapping or checkpoint inside the target repository.

```json
{
  "version": 1,
  "workflow": "init",
  "entrypoints": ["README.md"],
  "changes": [
    {
      "path": "README.md",
      "expectedHash": null,
      "content": "# Name utilities\n\n`normalizeName` trims surrounding spaces; see [implementation](src/index.ts).\n",
      "reason": "Document the public normalization behavior verified in source.",
      "evidence": [{ "path": "src/index.ts", "hash": "<SHA-256 returned by read>" }]
    }
  ],
  "gaps": []
}
```

The example hash is illustrative; replace it with an observed hash. For an existing output use its hash, never null. Evidence may include `revision` from a historical read. For update add `scope` (`{}`, `{"base":"main"}` or `{"range":"A..B"}`) and `scopeFingerprint` from the exact corresponding `diff`.

`kind` defaults to `document`. `navigation` allows changes to the `nav` field of an existing root mkdocs YAML or existing documentation `_meta.json`/`_category_.json`; other fields of mkdocs cannot change. These inputs must be static mappings. Dynamic/custom YAML tags, executable configurations and creating a new site configuration are unsupported. Static navigation syntax is inspected, but route generation remains unverified. Declare a Markdown entrypoint linking every changed page even when a site menu also exists.

All changed documents must be reachable from declared entrypoints. Use the project's actual README/AGENTS/index pages; do not manufacture a separate index if the existing one suffices. Empty `changes` is a valid verified no-op and still requires real readable entrypoints.

## Results

- `success`: planned changed files written; inspect `postWriteIssues` and complete semantic review.
- `no_change`: no candidate differs from existing bytes.
- `dry_run`: validated proposed diffs returned; no writes.
- `invalid`: new structural errors blocked the candidate.
- `conflict` / `partial`: writing or final validation/cleanup was incomplete; `written` identifies completed files and `cleanupErrors`, when present, identifies operational leftovers. No destructive rollback occurs.
- A top-level `error` can reject the request before any write (e.g. invalid path, changed evidence, missing ref).

The report includes unified patches, evidence and reasons, unchanged candidate paths, pre-existing issues and explicit gaps. Application errors do not echo raw filesystem or Git exception output, which can contain private information.
