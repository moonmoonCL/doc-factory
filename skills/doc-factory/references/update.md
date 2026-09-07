# Update

## Comparison contract

- Default: HEAD versus the final working tree. The helper separately exposes HEAD → index, index → working tree and untracked files; no committed history is implicitly included.
- `--base REF`: REF → HEAD plus staged, unstaged and untracked changes. REF resolves to a commit. It is a two-endpoint diff, not an implicit merge-base calculation.
- `--range A..B`: only the selected committed snapshots. Both endpoints are explicit; triple-dot syntax is rejected. Normal writes require B = HEAD and related implementation evidence to match B. Otherwise use dry-run or a base comparison that includes current changes.
- No HEAD: compare the index to the empty tree and include untracked/unstaged files. No Git repository: update fails; init remains available.

The tool is stateless. There is no “since last run” baseline. Invalid refs and shallow-history gaps fail without fallback or automatic fetch. Record resolved commits and exclusions in the report.

## Execute

1. Read applicable project rules and existing documentation routes. Run `diff` for the requested range and retain its fingerprint in the current conversation. Use `--summary` for a large change set, then inspect paginated patches. Do not confuse skipped patches with no change.
2. Find document candidates from existing entry links, names, source references and the affected capabilities. For unmapped changes, inspect their callers, tests and configuration; absence of a source link is not evidence of no documentation impact.
3. Read relevant full implementations and docs with `read`. For range previews use `read --revision B` for code and record the returned revision in its evidence. Normally document the final working-tree behavior, not an intermediate staged state; staged and unstaged changes can cancel each other.
4. Classify each affected claim: false/incomplete, newly necessary, routing-only, still accurate, or unsupported. A refactor may require updating a moved source link while leaving explanatory prose unchanged. Skip internal implementation changes that do not affect documented meaning or references.
5. Draft the smallest justified edit. Retain truthful paragraphs byte-for-byte. New capability documentation goes to an existing owner when possible. Update inbound links for changed headings. No automated deletion or rename of existing docs.
6. Send a proposal with `workflow: update`, the exact scope, the original `scopeFingerprint`, entrypoints and evidence. Empty `changes` is valid when investigation found no semantic or link change. Run candidate check and apply (or dry-run).
7. On conflict, reread and reassess; do not just refresh the hash on stale prose. At most two retries. Report incomplete or partial work if the repository keeps moving.

Existing dirty docs are valid inputs and must be preserved where unrelated. A new code change signals investigation; it is not a mandatory write list. Excluded evidence remains a named coverage gap. Structural passing does not certify all current documents or unexamined commits.
