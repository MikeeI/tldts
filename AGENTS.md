# Repository Guidelines

<essential-rule>
AGENTS.md is the sole authoritative project context file.
Read and edit AGENTS.md directly.
</essential-rule>

## Project Overview

`tldts` is a TypeScript monorepo for high-performance hostname, URL, domain, and public-suffix parsing.
It publishes full, ICANN-only, experimental, core, utility, and shared-test packages.
Generated lookup data is derived from the `publicsuffix` submodule and consumed by package-specific lookup implementations.

## Fork & Upstream Contribution Intent

- Official upstream: [remusao/tldts](https://github.com/remusao/tldts).
- This checkout is the [MikeeI/tldts](https://github.com/MikeeI/tldts) fork, not an independently owned product.
- The goal is to support upstream with evidence-backed, high-ROI issues, comments, and pull requests.
- `ISSUES.md` provides the compact finding overview and global ID allocator.
- `issues/ISSUE-NNN.md` owns the complete durable record for one root cause.
- `FORMAT.md` owns research, drafting, implementation authorization, approval, and publication rules.
- High ROI means meaningful user or maintainer value for limited implementation, regression, and review cost.
- Prioritize small, well-scoped corrections with outsized benefit.
- Prefer a pull request when a bounded verified fix is ready and no active implementation owns it.
- Otherwise comment when a thread owns the same problem or root cause and new evidence advances it.
- Otherwise open a new issue when durable maintainer discussion is useful.
- Otherwise keep the finding Investigating.
- Easy performance wins are valuable, but research and contributions MUST NOT be limited to performance.
- Also consider correctness, reliability, compatibility, cross-platform behavior, build and test tooling, APIs, and UI.
- Apply `skill-fork-contribution-tracking` for ledger, lifecycle, personal-branch, and upstream handoff work.
- Apply `skill-maintainer-communication` before external issues, pull requests, reviews, comments, or discussions.
- Search existing work first, follow upstream templates and disclosure rules, and avoid duplicate or low-evidence posts.
- Apply `skill-semantic-compression-3-0` when authoring or restructuring tracking content.
- Apply `skill-git-commit-format` while respecting explicit upstream contribution and commit conventions.
- Never choose Authorized-Work on the user's behalf.
- Research-and-Reporting permits issues and comments but no source implementation.
- Pull-Request-Implementation authorizes only the scoped implementation recorded for that finding.
- Base upstream contribution branches on current `upstream/master`.
- Keep fork-only context, ledgers, configuration, and personal commits out of upstream contribution diffs.
- Reproduce claimed bugs against current upstream and run the narrowest conclusive verification.
- Publish one coherent root cause per issue, comment, or pull request.
- Avoid speculative churn, broad cleanup, benchmark-free performance claims, and generic AI-generated submissions.

## Finding and Contribution Ledger

- At the start of every agent session, agents MUST read root `ISSUES.md` before repository work.
- `ISSUES.md` owns the global `Next-Finding-ID` allocator and compact cross-finding overview.
- Each `issues/ISSUE-NNN.md` owns one finding's fields, evidence, Next-Action, drafts, and archive record.
- `FORMAT.md` is authoritative for research, drafting, implementation boundaries, and publication format.
- This file exclusively owns which external repository actions require user approval.
- Before adding a finding, search the index and every relevant issue record for the same symptom or root cause.
- Update an existing record when it already owns the root cause.
- New findings MUST use `Next finding ID`.
- Create the issue file, add its index row, and increment the allocator together.
- Finding IDs use `ISSUE-NNN`, start at `ISSUE-001`, and remain permanent.
- Never reuse, renumber, or scope IDs by subsystem, status, session, or contribution type.
- Update the issue file and `ISSUES.md` together after any projected field, Next-Action, or Archive change.
- Every issue record MUST use the field and section contract in `FORMAT.md`.
- New findings start with `State: Investigating` and `Authorized-Work: Not-Selected`.
- They also start with `Publication-Target: Not-Selected` and `External-Reference: Not published.`.
- Keep findings Investigating until currentness, prior art, impact, and correction costs are honest.
- Clone detectors, AST matches, text similarity, shared names, and TODOs produce candidates only.
- A DRY finding requires shared change pressure, realistic drift, and consolidation simpler than synchronization.
- The user selects Authorized-Work for each finding.
- Research-and-Reporting MUST NOT implement the finding.
- Pull-Request-Implementation MAY implement only the recorded scope after research resolves callers and failure modes.
- Pull-request work MUST verify behavior, commit, push, and reach PR-Ready before external publication.
- Show the exact Publication-Draft and Publication-Target before publishing to official upstream.
- Publish to official upstream only after the user approves the exact current Publication-Draft and Publication-Target.
- Any Publication-Draft or Publication-Target change requires showing the complete current Publication-Draft and Publication-Target again.
- Run the read-only validator bundled with `skill-fork-contribution-tracking` after every ledger mutation.
- Record the final external URL in `External-Reference` immediately after publication.
- Keep `FORMAT.md`, `ISSUES.md`, `issues/`, and fork-only `AGENTS.md` changes out of upstream contribution diffs.

### External publication approval

Only an external issue, comment, review, discussion, or pull request write is approval-gated.
Before publication, read current contribution guidance and explain any applicable project policy.
The human must be able to review and own every submission statement.
Fork commits, pushes, tracking updates, and source implementation follow the active repository contract.

## Architecture & Data Flow

Public packages expose typed parser functions through each package-root `index.ts`.
`tldts-core` owns hostname extraction, option defaults, result construction, and the parser factory.
`tldts`, `tldts-icann`, and `tldts-experimental` bind the core parser to package-specific suffix lookup data.
The full and ICANN packages use generated tries; the experimental package uses generated packed hashes.
`tldts-utils` parses the Public Suffix List and generates the checked-in lookup structures.
`tldts-tests` owns shared test helpers used across implementations.

The main parse path is:

1. A package entry point selects requested result flags and its suffix lookup implementation.
2. `tldts-core` extracts or accepts the hostname and applies parsing options.
3. The package lookup resolves ICANN and private suffix metadata from generated data.
4. The core parser derives the public suffix, registrable domain, subdomain, and related result fields.

Generated data changes start from the pinned `publicsuffix` submodule.
Run the repository-owned generator instead of editing generated trie or hash files manually.

## Key Directories

- `packages/tldts/` owns the primary public package with ICANN and private suffix data.
- `packages/tldts-icann/` owns the smaller ICANN-only package.
- `packages/tldts-experimental/` owns the packed-hash implementation.
- `packages/tldts-core/` owns shared parsing primitives and contracts.
- `packages/tldts-utils/` owns Public Suffix List parsing and data generation.
- `packages/tldts-tests/` owns reusable cross-implementation test helpers.
- `publicsuffix/` is the pinned Public Suffix List Git submodule.
- `bench/` and `comparison/` own performance and comparison tooling.
- `patches/` contains the `patch-package` compatibility patch applied after install.

## Development Commands

- `yarn install --immutable` installs the exact Yarn 4 dependency graph.
- `yarn build` builds project references and every package.
- `yarn bundle` creates package bundles through Lerna.
- `yarn lint` runs the repository ESLint configuration.
- `yarn test` runs package tests through Lerna with concurrency two.
- `yarn format` writes Prettier formatting across the repository.
- `yarn generate-data` regenerates suffix lookup data from `publicsuffix`.
- `yarn update:check` regenerates data and fails when tracked generated output changes.
- `make -C bench` runs the repository benchmark owner.

## Code Conventions

- Preserve the existing strict TypeScript project-reference and package-boundary structure.
- Use two-space indentation, LF endings, UTF-8, final newlines, single quotes, and trailing commas.
- Keep public package APIs in package-root `index.ts` files and implementation details under `src/`.
- Treat generated files under package `src/data/` as generator-owned.
- Preserve rationale comments around allocation avoidance, parser fast paths, and packed lookup structures.
- Add behavior tests beside the owning package under `test/`.

## Important Files

- `package.json` owns workspace membership, Yarn version, and root commands.
- `tsconfig.project.json` owns the TypeScript project-reference build.
- `lerna.json` owns the shared release version and Yarn-backed package orchestration.
- `nx.json` owns package task dependencies, outputs, and caching.
- `.mocharc.cjs` owns the shared Mocha configuration.
- `eslint.config.mjs` owns repository lint policy.
- `.github/workflows/` owns CI and release automation.
- `.gitmodules` pins the Public Suffix List source location.

## Runtime and Tooling Preferences

- This upstream repository requires `yarn@4.12.0`; do not replace its package manager with Bun.
- Use repository scripts instead of invoking binaries from `node_modules` directly.
- Preserve the current Node, Yarn, Lerna, Nx, TypeScript, Rollup, Mocha, NYC, ESLint, and Prettier toolchain.
- Do not apply greenfield template changes to inherited manifests or compiler settings without finding-specific evidence.
- Initialize and update `publicsuffix` through Git submodule commands.

## Testing & QA

- Run the narrowest package test that proves a changed parser or generator contract.
- Run `yarn lint` for TypeScript or JavaScript changes.
- Run `yarn build` when package exports, project references, generated types, or bundling inputs change.
- Run `yarn update:check` when Public Suffix List parsing or generated lookup data changes.
- Benchmark representative inputs before making performance claims.
- Compare output behavior across affected implementations when changing `tldts-core`.

## Development Rules

Before launching agents, apply skill-xray, skill-expert, and skill-brutal to the task.
Surface expert-level issues, non-obvious issues, blindspots, stale assumptions, and hidden dependencies.
Also surface missed constraints, edge cases, false positives, verification gaps, overclaims, and weak assumptions.
Identify improvement potential, inefficiencies, and what is wrong without softening.
Use these findings to design safe slices, sequencing, checks, and boundaries for complete agent results.

Every agent prompt must require skill-xray, skill-expert, and skill-brutal for the assigned scope before acting.
It must surface non-obvious issues, blindspots, stale assumptions, hidden dependencies, and edge cases.
It must also surface verification gaps, overclaims, failure modes, weak assumptions, and what is wrong.
The agent must adjust its approach, challenge its assumptions, and flag misleading or incomplete output risks.

Implementation assignments must cover existing patterns, callers, exported-symbol consumers, and failure modes.
They must also cover concurrency safety and lifecycle cleanup.
Each assignment must state `Test decision: none` or `Test decision: update`.
`update` must name the exact existing test that follows an intentional contract change.
Never request new tests.
Prohibit broad edits, unrelated cleanup, and unassigned files.

No vague agents.
Each assignment needs exact targets, non-goals, evidence anchors, acceptance criteria, and an output contract.

Commit completed units continuously.
Before each commit, use skill-git-commit-format to determine whether staged effects are one coherent unit.
The skill owns commit-message format and evidence.
After the boundary is valid, run the repository-owned commit and push workflow.
Do not commit every trivial edit immediately or defer unrelated work into one end-of-session commit.

Every project-level quality command is quiet by default and verbose on demand.
This policy applies regardless of language or toolchain.
It covers Make targets, package scripts, Python CLIs, shell quality gates, and test runners.
Successful checks print only compact status such as `format: ok`, `lint: ok`, `test: ok`, or `check: ok`.
On failure, exit non-zero and print the failing step, exit code, and enough output to act without rerunning.
Full raw output must remain available through `--verbose`, `VERBOSE=1`, or the underlying tool's verbose mode.
New quality commands and future language setup must follow this policy instead of inventing another logging contract.

## TypeScript Rules

- Load `skill-typescript-standards` before TypeScript or Bun implementation and repository work.
- Load `skill-typescript-tools` before choosing or changing TypeScript, Node.js, Bun, or frontend dependencies.
- Load `skill-static-tsc` before changing type-checking configuration or fixing type errors.
- Load the matching static-analysis skill before lint, dead-code, cycle, or complexity work.
- Load `skill-cli` before changing CLI grammar, flags, help, or output.
- The repository-owned Yarn workflow overrides the general Bun default.
- Scripts SHOULD invoke other scripts through the repository's existing Yarn grammar.
- Do not introduce `npm`, `pnpm`, `npx`, Bun, or local binary paths unless the repository contract requires them.
- Project config owns runtime and operational values.
- `constants.ts` owns compile-time invariants and config keys only.
- Do not scatter timeouts, limits, endpoints, switches, or provider settings through components or handlers.
- Keep CLI parsing, public package APIs, parser rules, lookup data, and generators under separate owners.
- Read-only verification uses the narrowest repository-owned Yarn command for the affected package or contract.
- Preserve inherited compiler targets and module formats unless a finding explicitly authorizes their migration.
- Add import aliases only when a runtime owner such as `package.json#imports` requires them.
