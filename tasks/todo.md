# Todo: Decouple Conformance Suite from Vitest

Companion to `tasks/plan.md`. Each task is self-contained: description, acceptance criteria, verification, dependencies, files, scope.

---

## Phase 1 — Define Interface & Decouple Core Module

### Task 1: Define `ConformanceTestRunner` interface; make `runner` required; remove vitest import

**Description:** Add `ConformanceTestRunner` and `ConformanceAssertions` interfaces to `adapter-conformance.ts`. Add `runner: ConformanceTestRunner` as a required field in `AdapterConformanceOptions`. Remove `import { describe, it, expect } from "vitest"` and replace every usage with `opts.runner.describe`, `opts.runner.it`, `opts.runner.expect`.

**Acceptance criteria:**

- [ ] `adapter-conformance.ts` has no `import ... from "vitest"` (grep passes).
- [ ] `ConformanceTestRunner` and `ConformanceAssertions` interfaces are exported from the file.
- [ ] `AdapterConformanceOptions.runner` is a required field typed as `ConformanceTestRunner`.
- [ ] All 35 `describe`/`it`/`expect` usages go through `opts.runner.*`.
- [ ] `pnpm --filter @decorify/core build` fails (expected — call sites now missing `runner`).

**Verification:**

- [ ] `grep -r "from \"vitest\"" packages/core/src/testing/adapter-conformance.ts` → no match
- [ ] `pnpm --filter @decorify/core build` → TS errors at call sites only (not inside the conformance file)

**Dependencies:** None

**Files:**

- `packages/core/src/testing/adapter-conformance.ts`

**Scope:** Small (1 file, mechanical change)

---

## Phase 2 — Update Call Sites

### Task 2: Update `node-http-adapter.test.ts` to pass vitest runner

**Description:** Add `import { describe, it, expect } from "vitest"` and pass `runner: { describe, it, expect }` to `runAdapterConformance`.

**Acceptance criteria:**

- [ ] File imports `describe`, `it`, `expect` from `"vitest"`.
- [ ] `runAdapterConformance` call includes `runner: { describe, it, expect }`.
- [ ] 35 conformance tests for `NodeHttpAdapter` pass.

**Dependencies:** Task 1

**Files:**

- `packages/core/src/testing/node-http-adapter.test.ts`

**Scope:** XS (1 file, 2 line change)

---

### Task 3: Update Express adapter conformance test to pass vitest runner

**Description:** Add `import { describe, it, expect } from "vitest"` and pass `runner: { describe, it, expect }` to `runAdapterConformance` in the Express test.

**Acceptance criteria:**

- [ ] File imports `describe`, `it`, `expect` from `"vitest"`.
- [ ] `runAdapterConformance` call includes `runner: { describe, it, expect }`.
- [ ] 35 conformance tests for `ExpressAdapter` pass.

**Verification:**

- [ ] `pnpm --filter @decorify/express test` → 35/35 pass
- [ ] `pnpm --filter @decorify/core test` → 91/91 pass (56 core + 35 node-http conformance)
- [ ] `pnpm test` (root) → 232 tests pass
- [ ] `pnpm build` succeeds

**Dependencies:** Task 1, Task 2

**Files:**

- `packages/adapters/express/test/adapter-conformance.test.ts`

**Scope:** XS (1 file, 2 line change)

---

### Checkpoint: Phase 2 Complete

- [ ] All 232 tests pass
- [ ] `pnpm build` clean
- [ ] No `vitest` import in `packages/core/src/testing/adapter-conformance.ts`

---

## Phase 3 — Documentation

### Task 4: Update README Quick Start and Options table

**Description:** Update `packages/core/src/testing/README.md` to show the new `runner` field in the Quick Start example and add a `runner` row to the Options table. Add a brief note that `runner` must be supplied — and that both vitest and Jest satisfy the interface.

**Acceptance criteria:**

- [ ] Quick Start code block includes `runner: { describe, it, expect }` with vitest import.
- [ ] Options table has a `runner` row with type, description, and "required" note.
- [ ] A "Using with Jest" snippet shows `import { describe, it, expect } from "@jest/globals"`.

**Dependencies:** Task 3

**Files:**

- `packages/core/src/testing/README.md`

**Scope:** Small (1 file, doc only)

---

### Task 5: Re-export `ConformanceTestRunner` from `testing/index.ts`

**Description:** Add `ConformanceTestRunner` and `ConformanceAssertions` to the re-exports in `packages/core/src/testing/index.ts` so consumers can type-check their own runner implementations without importing from the internal file path.

**Acceptance criteria:**

- [ ] `ConformanceTestRunner` is importable from `@decorify/core/testing`.
- [ ] `ConformanceAssertions` is importable from `@decorify/core/testing`.
- [ ] `pnpm build` succeeds.

**Dependencies:** Task 1

**Files:**

- `packages/core/src/testing/index.ts`

**Scope:** XS (1 file, 1 line change)

---

### Checkpoint: Phase 3 Complete ✅

- [ ] All 232 tests pass
- [ ] `pnpm build` clean
- [ ] README Quick Start correct with runner injection
- [ ] `ConformanceTestRunner` exported from public API
