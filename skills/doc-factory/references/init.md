# Init

1. Run `scan --root <target>`. Follow pagination and use `--prefix` for relevant subtrees. Read target AGENTS.md and applicable local rules before changing their areas. The host may already provide ancestor instructions; do not expand the target to read private parent files.
2. Read existing entrypoints, module docs, manifests, actual entry code, key implementations, tests, build/CI/deployment configuration. Prefer a focused sequence of `read` calls over loading every source file. Inspect related code until the important workflows and constraints are supported.
3. Decide what a future agent needs to know. Reuse the existing documentation system. Choose sections/pages from semantic ownership and retrieval tasks using [organization](organization.md), not fixed templates. An existing complete system can result in no changes.
4. Draft real content and necessary navigation. Preserve valuable accurate paragraphs and their language. Include evidence links for non-obvious claims. Do not add placeholder architecture, deployment, API or testing pages for absent capabilities.
5. Build a proposal using [tool protocol](tool-protocol.md). Declare Markdown entrypoints that actually route to changed pages. Every change includes a reason and evidence from `read`. Generated docs and runtime prompts are not writable targets. Unknown site navigation may require an ordinary documentation entry link plus an explicit renderer limitation; do not edit an executable config.
6. Run `check --proposal -`. Address new errors. For normal init, call `apply --proposal -`; for dry-run, call `apply --proposal - --dry-run`. Recheck the actual diff and perform the semantic acceptance in [validation](validation.md).

Initialization needs no Git history. Do not run git init on the user's repository. Ignore missing optional background information while documenting what the code proves. Report gaps instead of asking the user to choose structure.
