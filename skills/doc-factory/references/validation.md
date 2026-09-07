# Validation and limits

## Semantic acceptance by the host

Before declaring completion, answer these from inspected evidence:

- Can a fresh agent find the entrypoint for the relevant development task and then reach its implementation and tests?
- Does each changed claim describe the selected actual code state, with explicit failure/ownership constraints where relevant?
- Were accurate existing paragraphs and unrelated edits preserved?
- Is a new page independently useful, rather than a directory inventory or duplicate explanation?
- Are current behavior, explicit rules and historical decisions distinguishable?
- Did the reported checks actually run, and are unresolved evidence and renderer gaps visible?

On repeat runs, compare actual output bytes. No change means no rewriting for style, date, headings or a regenerated file list. On code updates compare semantic claims and references before deciding to write. For an internal refactor, a zero-prose-diff result can be the correct outcome.

## Program checks

The helper parses CommonMark/GFM links, reference links, images and headings with GitHub-style slugs (including duplicate and Unicode headings). Fenced code is not parsed as links. It checks local targets, heading fragments, candidate navigation reachability, path restrictions and expected content hashes. Structural failures introduced by a candidate block writes; existing unrelated failures remain reported.

HTML attribute links, site-root routes, custom renderer extensions, and non-Markdown anchors are explicitly unverified. MDX/reST can be maintained in place, but the checker does not claim their full syntax or rendering is correct. Remote URLs are not fetched. A source filename existing does not prove the associated statement. Existing generated-file notices cause refusal; generators without a recognizable notice must still be detected by the host from configuration and rules.

## Operational limits

The supported environment is a local regular filesystem. The writer uses snapshot checks, an exclusive cooperating-writer lock and per-file replacement. It catches edits detected before replacement, but Node's portable filesystem API does not provide a compare-and-swap replacement against arbitrary external writers. An external editor or malicious process changing a path in the final check/replace interval remains a race; do not claim an absolute concurrency guarantee. Do not use against adversarially mutated directory trees. A multi-file update can be partial after I/O failure; written paths and patches are reported, and unrelated state is not rolled back.

Known secret filenames are excluded before reading. High-confidence embedded credential patterns withhold entire files before content reaches the host. Static patterns cannot discover every arbitrary embedded secret; never describe this as a complete secret scanner. Test credentials in fixtures are synthetic.

Symlinks and hardlinks are refused even when they point within the repository. Nested repositories, submodules, vendor trees, generated/build directories, archived records and runtime prompt/Skill assets are outside automatic writing. Unknown project conventions may require a coverage gap rather than a bypass. No script is executed just to resolve a documentation link.

No persistent maintenance metadata is written. Short-lived writer lock/temp files are operational artifacts, cleaned on normal completion. An interrupted process can leave them; inspect ownership and recover them deliberately rather than force-removing another process's lock. The helper does not auto-recover by deleting existing documents.
