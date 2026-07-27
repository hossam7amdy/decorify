# AI Instructions

Decorify is a decorator-based HTTP routing framework.

## Project Structure

| Directory           | Package             | Purpose                                           |
| ------------------- | ------------------- | ------------------------------------------------- |
| `core/`             | `@decorify/core`    | Server-agnostic core. **Most work happens here.** |
| `adapters/express/` | `@decorify/express` | Express adapter.                                  |
| `adapters/fastify/` | `@decorify/fastify` | Fastify adapter.                                  |
| `adapters/koa/`     | `@decorify/koa`     | Koa adapter.                                      |

Adapters depend on the core via `workspace:^`.

## Essential Commands

```bash
pnpm install    # Install deps
pnpm test       # Run all tests
pnpm check      # Lint + format check (Biome code/JSON, Prettier md/yaml)
pnpm check:fix  # Auto-fix Biome + Prettier
pnpm build      # Build dist/ for publishing
pnpm typecheck  # Typecheck, no emit
```

## Code Style

- Prefer `interface` for object shapes; use `type` for unions and aliases.
- Never log (`console.*`, `debugger`) in tests or production.
- Reassign parameters only for performance (Biome allows it).

## Testing Instructions

### Layout

Three locations, one per tier. Each package owns its own.

```text
<pkg>/
├── src/
│   ├── thing.ts
│   └── thing.test.ts        ← unit, co-located
├── test/                    ← integration
└── test-types/              ← static, compile-only
    └── thing.type-test.ts
```

### Principles

- Prefer **integration tests** by default. Test behavior through public APIs, mocking only true external boundaries.
- Test **behavior, not implementation**. Avoid asserting internal state, private methods, or function calls unless they are part of the public contract.
- Write **unit tests** only for isolated, deterministic logic such as pure functions, algorithms, parsers, formatters, and validators.
- Rely on **static analysis** (TypeScript, ESLint, linters) to catch errors that don't require runtime tests. Don't duplicate these checks with tests.
- Optimize for **confidence over coverage**. Prefer a few focused, high-value tests that prove behavior over many redundant assertions.

### Project Conventions

- Name runtime tests `*.test.ts` and compile-only fixtures `*.type-test.ts`. Only the former are executed. `tsc` is the only gate on the latter, so they contain no runtime assertions.
- Exclude `src/**/*.test.ts`, `test/`, and `test-types/` from each package's `tsconfig.build.json`. Anything not excluded is compiled into `dist/` and published.
- Use Node's test runner: `import { describe, it } from "node:test"` and `import assert from "node:assert/strict"`.
- Set a `timeout` (ms) on every `describe`. The timeout applies to the entire suite. Add `{ concurrency: true }` only when tests share no mutable state.
- Import the metadata polyfill first in any test that defines decorated classes.
- New features and bug fixes should include tests covering expected behavior, failures, and relevant edge cases.
- Don't disable or skip type tests to work around type errors. Fix the types instead.

## Documentation

- Add JSDoc to exported functions and APIs (first overload only for overload
  sets).
- Comment _why_, not _what_ — let names and types carry intent.
- Document interfaces and per-field JSDoc only for non-obvious invariants.
- Tag internal utilities `@internal`.
- Source is the single source of truth; keep docs matching it (including this
  one).

## PR Instructions

- Use the `gh` CLI for GitHub info. Never web search or guess.
- Commit messages follow [Conventional Commits](https://www.conventionalcommits.org)
  (`feat`, `fix`, `build`, `ci`, `chore`, `docs`, …), optionally scoped —
  e.g. `feat(core): add module system with graph resolution`.
- PRs merge as merge commits (not squashed) — branch history is preserved.

### Pushing to a new branch (don't push to main)

A "new PR" or "new branch" must land on a non-`main` ref. Footgun:
`git worktree add <path> -b <branch> origin/main` (and
`git checkout -b <branch> origin/main`) set the new branch's upstream to
`refs/heads/main`, so a later `git push -u origin <branch>` pushes to main.

Be explicit on the first push:

```bash
git push -u origin <branch>:refs/heads/<branch>
```

Confirm the output reads:

```
* [new branch]      <branch> -> <branch>
```

If the right side says `main`, abort or revert. Don't rely on
`git push -u origin <branch>` alone — its behavior depends on the upstream
config, which `worktree add -b … origin/main` sets wrong. For later pushes
without `-u`, use `git push origin HEAD:refs/heads/<branch>`.
