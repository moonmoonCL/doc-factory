# Traditional-project comparison

Research date: 2026-09-04. These examples cover a framework, a library, a CLI and a multi-module application. They establish useful content-ownership and validation practices; they are not the primary audience model for doc-factory. Branches were read during research; commit links below pin the recorded revision for review.

## Django — framework

Snapshot `026b005f3dc43a98557ce5a546b5e4938d06fed1`. Read [docs tree](https://github.com/django/django/tree/026b005f3dc43a98557ce5a546b5e4938d06fed1/docs), [navigation](https://github.com/django/django/blob/026b005f3dc43a98557ce5a546b5e4938d06fed1/docs/index.txt), [writing rules](https://github.com/django/django/blob/026b005f3dc43a98557ce5a546b5e4938d06fed1/docs/internals/contributing/writing-documentation.txt), and [docs CI](https://github.com/django/django/blob/026b005f3dc43a98557ce5a546b5e4938d06fed1/.github/workflows/docs.yml).

Tutorials, how-tos, topic explanations and reference material serve different reading tasks; contributor guidance has its own area. Writing rules encourage references rather than repeated technical detail. CI runs documentation-specific style and spelling checks. Useful when content has distinct task and lookup needs. A tiny library can express those needs in sections rather than reproducing Django's tree. No claim is made that Django's docs are primarily model-facing.

## Pydantic — library

Snapshot `74a852ea4838a03519e09a9dae4806dcdc026bf5`. Read [docs tree](https://github.com/pydantic/pydantic/tree/74a852ea4838a03519e09a9dae4806dcdc026bf5/docs), [MkDocs navigation](https://github.com/pydantic/pydantic/blob/74a852ea4838a03519e09a9dae4806dcdc026bf5/mkdocs.yml), and [contribution/documentation rules](https://github.com/pydantic/pydantic/blob/74a852ea4838a03519e09a9dae4806dcdc026bf5/docs/contributing.md).

Concepts, examples, API references and internals have distinct destinations. API documentation derives from docstrings; examples are tested. The site also exposes selected existing content for LLM consumption. Useful for avoiding duplicate API facts and grounding runnable examples. doc-factory does not edit source docstrings or run generators without inspecting them; source-generated reference drift may remain an explicitly reported out-of-scope correction.

## GitHub CLI — command-line application

Snapshot `400c0844954c8f42507b1d967c5bdcb1ee958a77`. Read [docs entry](https://github.com/cli/cli/blob/400c0844954c8f42507b1d967c5bdcb1ee958a77/docs/README.md), [command syntax rules](https://github.com/cli/cli/blob/400c0844954c8f42507b1d967c5bdcb1ee958a77/docs/command-line-syntax.md), [agent rules](https://github.com/cli/cli/blob/400c0844954c8f42507b1d967c5bdcb1ee958a77/AGENTS.md), and [manual generator](https://github.com/cli/cli/blob/400c0844954c8f42507b1d967c5bdcb1ee958a77/cmd/gen-docs/main.go).

The docs entry distinguishes contributor material from the user manual. The manual generator consumes the command tree for website/man-page output, while agent rules orient code changes and testing. Useful when command definitions already own flags and examples: link to that authority instead of generating a competing handwritten catalog. This does not require separate user/contributor sites in small projects.

## Grafana — multi-module application

Snapshot `4a508887aaeb21f05eb0374e565edea973ed1364`. Read [docs maintenance](https://github.com/grafana/grafana/blob/4a508887aaeb21f05eb0374e565edea973ed1364/docs/README.md), [documentation agent rules](https://github.com/grafana/grafana/blob/4a508887aaeb21f05eb0374e565edea973ed1364/docs/AGENTS.md), and [config-change reminder](https://github.com/grafana/grafana/blob/4a508887aaeb21f05eb0374e565edea973ed1364/.github/workflows/defaults-ini-docs-reminder.yml).

Product docs use an existing site hierarchy and frontmatter navigation. Some pages derive from TypeScript source and must not be hand-edited. Configuration changes trigger a reminder that explicitly exempts internal-only changes. Useful for separating change detection from semantic documentation impact and for preserving site ownership. Neither a changed filename nor passing a docs build proves the prose is current.

## Format sources

[Agent Skills specification](https://agentskills.io/specification) and [Open-Dot-Agents/SKILL.md](https://github.com/Open-Dot-Agents/SKILL.md) were read on 2026-09-04. Standard name/description YAML frontmatter and progressive disclosure define the package format; they do not prescribe a generated project documentation tree. doc-factory keeps model execution with the host and distributes its auxiliary JavaScript runtime with TypeScript source.
