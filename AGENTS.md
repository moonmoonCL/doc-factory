# doc-factory

This repository implements the portable doc-factory Skill. The host model owns semantic documentation decisions; TypeScript owns inspected facts and guarded writes. Do not add a model provider or persistent target-repository ledger.

Write self-explanatory code. Do not add comments that restate implementation.

## Architecture

Six TypeScript modules cooperate:

- [CLI](src/cli.ts): entry point; dispatches `scan`, `read`, `diff`, `check`, `apply` commands.
- [Repository](src/repository.ts): safe file reading, path validation, secret detection, ignore rules.
- [Git](src/git.ts): diff computation with committed/staged/unstaged/untracked layers.
- [Markdown](src/markdown.ts): link/anchor validation and document traversal.
- [Proposal](src/proposal.ts): candidate parsing, structural checks, guarded writes with snapshot locks.
- [Types](src/types.ts): shared interfaces (`Proposal`, `Change`, `Issue`, `FactoryError`).

Data flow: CLI parses arguments → Repository reads files → Git computes diff → Proposal validates and writes. All modules throw `FactoryError` on failure.

## Key constraints

- Cannot write source code, runtime prompts, Skill assets, or generated documents.
- Snapshot checks and cooperative exclusive lock (`.doc-factory-write.lock`).
- Static secret detection withholds files containing credentials.
- Documents must be meaningful (prose or examples), not just headings.

## Development

- Change filesystem policy in [repository](src/repository.ts), Git scope behavior in [git](src/git.ts), and candidate/write behavior in [proposal](src/proposal.ts). Read their [tests](tests) before changing guarantees.
- Change agent behavior in the [Skill](skills/doc-factory/SKILL.md) and its linked references. Keep runtime prompt assets in target projects outside maintenance scope.
- Review [evaluation instructions](evals/README.md) before claiming the Skill has been exercised by an Agent.
- Run `npm run typecheck`, `npm test`, and `npm run build` after implementation changes. The bundled script is generated; edit TypeScript source, then rebuild.
- Do not commit, publish or modify user-level Skill installations unless requested.

## Testing

Tests verify:
- [Repository](tests/repository.test.ts): ignore rules, path safety, secret detection.
- [Git](tests/git.test.ts): diff layers, rename tracking, range validation.
- [Proposal](tests/proposal.test.ts): snapshot conflicts, partial I/O, dry-run idempotency.
- [Markdown](tests/markdown.test.ts): link validation, anchor resolution.
- [Skill](tests/skill.test.ts): Skill format compliance.
- [Distribution](tests/distribution.test.ts): bundled script execution.
