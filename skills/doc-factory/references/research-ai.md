# AI-era repository research

Research date: 2026-09-04. These are observations of repository instructions and implementation, not claims that every line of these projects was written by AI. The primary audience of doc-factory output is a coding agent. Read this reference for placement and retrieval tradeoffs, not during every initialization.

## Open Design

Repository: nexu-io/open-design. Snapshot: `d4138ea81832c792f28cb69f2637a35e52f20f5a`.

Inspected [root AGENTS](https://github.com/nexu-io/open-design/blob/d4138ea81832c792f28cb69f2637a35e52f20f5a/AGENTS.md), [apps AGENTS](https://github.com/nexu-io/open-design/blob/d4138ea81832c792f28cb69f2637a35e52f20f5a/apps/AGENTS.md), and [architecture](https://github.com/nexu-io/open-design/blob/d4138ea81832c792f28cb69f2637a35e52f20f5a/docs/architecture.md).

The entrypoint routes agents to directory-specific rules and named documents before particular changes. Module detail is kept out of the root by policy. Archived product specifications are identified as historical rather than current authority. Repository-maintenance notes must not enter prompt assets that are sent directly to the product's model.

Adopt conditional reading routes and explicit authority distinctions, especially for applications with multiple runtimes. Do not reproduce this project's extensive standing-rule body, directory count, rollout policies or product prompt stack. A Markdown file can be executable product input rather than maintainable project documentation.

## DeepSeek Harness

Repository: deepseek-ai/deepseek-harness. Snapshot: `76fda729799fe9b3848dbe2c211d4b231032b81e` (`master`).

Inspected [root rules](https://github.com/deepseek-ai/deepseek-harness/blob/76fda729799fe9b3848dbe2c211d4b231032b81e/AGENTS.md), [documentation standard](https://github.com/deepseek-ai/deepseek-harness/blob/76fda729799fe9b3848dbe2c211d4b231032b81e/docs/AGENTS.md), [dsh-doc Skill](https://github.com/deepseek-ai/deepseek-harness/blob/76fda729799fe9b3848dbe2c211d4b231032b81e/.agents/skills/dsh-doc/SKILL.md), [Agent Notes rules](https://github.com/deepseek-ai/deepseek-harness/blob/76fda729799fe9b3848dbe2c211d4b231032b81e/.agents/notes/README.md), and [executed-gate registration](https://github.com/deepseek-ai/deepseek-harness/blob/76fda729799fe9b3848dbe2c211d4b231032b81e/scripts/run-gates.ts).

Standing rules, architecture, subsystem references, package READMEs, decision records and generated catalogs have distinct ownership. The standard limits duplicated facts and uses links between owners. Agent Notes distinguish proposed, implemented, rejected and archived knowledge; decision alternatives must come from actual records. The documentation Skill considers targeted retrieval, terminology, stable headings and context length. The gate registration includes Markdown links, type equivalence, generated catalogs and document budgets; the research inspected their registration but did not execute them.

Adopt fact ownership, current/proposed/history distinctions, retrieval-oriented headings and mechanically verifiable references. This is especially useful for cross-module protocols and lifecycle behavior. Do not copy mandatory bilingual pairing, fixed README kinds, universal Notes-per-change requirements, specific word ceilings, automatic archiving/deletion or the project's execution policy. Its documentation system still includes human-facing tutorials, so it is not a pure model-only corpus.

## Pi

Repository: earendil-works/pi, as linked from the official pi.dev site. Snapshot: `2d41163332c1a6d11c45911a92100fd2a55e4d1a`.

Inspected [root rules](https://github.com/earendil-works/pi/blob/2d41163332c1a6d11c45911a92100fd2a55e4d1a/AGENTS.md), [Skills docs](https://github.com/earendil-works/pi/blob/2d41163332c1a6d11c45911a92100fd2a55e4d1a/packages/coding-agent/docs/skills.md), [system prompt](https://github.com/earendil-works/pi/blob/2d41163332c1a6d11c45911a92100fd2a55e4d1a/packages/coding-agent/src/core/system-prompt.ts), and [resource loader](https://github.com/earendil-works/pi/blob/2d41163332c1a6d11c45911a92100fd2a55e4d1a/packages/coding-agent/src/core/resource-loader.ts).

The runtime's own system prompt routes Pi-specific topics to concrete documentation and examples. Project context files are separately loaded; available Skills expose descriptions before their full instructions are read. Repository rules explicitly account for concurrent agent sessions and prohibit broad Git operations that could destroy others' changes.

Adopt task-to-document routing and separation between small standing context and on-demand knowledge. Documentation generation alone does not establish that a future agent will read the result. Validate the reading path with a real task. Do not embed Pi-specific loader configuration or assume another host automatically reads nested AGENTS files. The runtime's self-documentation route is evidence of a consumption mechanism, distinct from how contributors document Pi itself.

## llmdoc

Repository: TokenRollAI/llmdoc. Snapshot: `4f3fb929a1cf485a1c32f00410623f6cbc562e9c`.

Inspected [init](https://github.com/TokenRollAI/llmdoc/blob/4f3fb929a1cf485a1c32f00410623f6cbc562e9c/skills/init/SKILL.md), [update](https://github.com/TokenRollAI/llmdoc/blob/4f3fb929a1cf485a1c32f00410623f6cbc562e9c/skills/update/SKILL.md), [retrieval Skill](https://github.com/TokenRollAI/llmdoc/blob/4f3fb929a1cf485a1c32f00410623f6cbc562e9c/skills/llmdoc/SKILL.md), [context retrieval](https://github.com/TokenRollAI/llmdoc/blob/4f3fb929a1cf485a1c32f00410623f6cbc562e9c/cli/src/commands/context.ts), [delta state](https://github.com/TokenRollAI/llmdoc/blob/4f3fb929a1cf485a1c32f00410623f6cbc562e9c/cli/src/lib/state.ts), and [validation](https://github.com/TokenRollAI/llmdoc/blob/4f3fb929a1cf485a1c32f00410623f6cbc562e9c/cli/src/lib/workspace.ts).

Init investigates ownership before writing a small useful knowledge set. Update separates evidence-gathering depth from the decision to change prose; still-true documents can remain unchanged. Context lookup uses source mappings and prerequisite relations. Validation checks shapes, references and source paths. These support an investigate → decide → write → validate workflow.

Its own maintained MDX surface, revision ledger, commit-based finalization and clean-doc preconditions are intentionally not adopted. doc-factory reuses existing docs, reconstructs relationships in each session, tolerates unrelated dirty files and never commits or rolls back whole directories. Skipping a revision ledger costs automatic “since last verification” tracking: callers must select committed-history ranges explicitly.

## Synthesis for doc-factory

The common useful idea is selective context backed by authoritative evidence: a short route tells the agent which owner to read, and that owner links to exact implementation and verification. This synthesis is a doc-factory design judgment, not a universal standard declared by all four repositories. No fixed directory tree or file count follows from it.
