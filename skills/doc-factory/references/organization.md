# Organize for agent retrieval

Start with the development tasks the repository supports. A useful document reduces the source exploration needed to make a correct change. It does not replace checking the live implementation.

## Determine the minimum useful knowledge

In the current conversation, associate each important task or cross-file behavior with its owner, evidence, and existing explanation. The association is a reasoning aid, not a persistent registry and not a required output table. Unexplained first-class behavior deserves further inspection; a helper reconstructible from its own short implementation may need no document.

Prefer these kinds of information when they exist:

- Capability ownership and implementation entrypoints.
- Cross-module dataflow, state transitions and failure propagation.
- Verified constraints, dependency direction and compatibility obligations.
- Relevant tests and how they exercise a behavior.
- Non-obvious configuration effects and supported deployment mechanisms.
- Existing, still-relevant decisions that prevent likely mistakes.

These are candidate subjects, not required files or headings. Avoid exhaustive listings of packages, tests, signatures or configuration values already represented by maintained code or generators.

## Place and connect

Reuse a module README for facts owned by that module. Use shared docs for cross-module understanding. Keep each fact at its lowest appropriate owner; link rather than restate. Split when independently useful tasks require different context or ownership. Combine when pages would mostly repeat one another. Do not choose a fixed file list from a project category or score.

An entrypoint should tell an agent when to read a page, for example: `Before changing retry behavior, read [delivery](delivery.md); its source and tests are linked there.` Use the actual path and capability, not this example literally. A page's opening explains its subject and applicability; stable headings and existing terminology aid search. A short page does not need frontmatter or its own table of contents. Long pages may benefit from a local contents list.

AGENTS.md is for necessary standing instructions and task routes. Preserve existing instructions, including user-maintained local rules. Add a local AGENTS.md only if a real local rule or retrieval need justifies it; do not create one for every directory. Keep architecture detail in its owning document. Do not generate vendor-specific aliases.

## Evidence and authority

Describe code-backed behavior as current fact. Describe explicit project rules as rules. A behavior test supports the exercised behavior, not unspecified production topology. A container file describes a build and startup configuration; it does not establish that the build succeeds or that production uses it.

Use ordinary relative links to evidence files and name stable symbols or tests in prose when useful. Prefer these over fragile line-number anchors. Reasons for historical decisions need an existing record or explicit user evidence. If sources conflict, inspect implementation and tests for behavior and preserve the distinction from intended policy; report unresolved conflict rather than silently choosing the newest prose.

Preserve current/proposed/archived distinctions already used in the project. Do not force Agent Notes, metadata schemas or lifecycle directories into a project lacking them. Do not generate a decision history during init. Current facts may be maintainable without knowing why they were originally chosen.
