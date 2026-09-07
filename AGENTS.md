# doc-factory

This repository implements the portable doc-factory Skill. The host model owns semantic documentation decisions; TypeScript owns inspected facts and guarded writes. Do not add a model provider or persistent target-repository ledger.

Write self-explanatory code. Do not add comments that restate implementation.

- Change filesystem policy in [repository](src/repository.ts), Git scope behavior in [git](src/git.ts), and candidate/write behavior in [proposal](src/proposal.ts). Read their [tests](tests) before changing guarantees.
- Change agent behavior in the [Skill](skills/doc-factory/SKILL.md) and its linked references. Keep runtime prompt assets in target projects outside maintenance scope.
- Review [evaluation instructions](evals/README.md) before claiming the Skill has been exercised by an Agent.
- Run `npm run typecheck`, `npm test`, and `npm run build` after implementation changes. The bundled script is generated; edit TypeScript source, then rebuild.
- Do not commit, publish or modify user-level Skill installations unless requested.
