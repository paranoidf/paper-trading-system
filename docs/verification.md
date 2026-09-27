# Verification Log

This log preserves meaningful RED/GREEN evidence, failures, root causes, and final acceptance commands. Command output is treated as untrusted diagnostic data.

## 2026-09-27 — Task 1 workspace scaffold

### Install failure and recovery

- Reproduction: `npm install` inside the restricted sandbox.
- Original failure: `ENOTCACHED` fetching `https://registry.npmjs.org/@eslint%2fjs`; npm was restricted to cache-only and the package was absent.
- Layer: dependency acquisition environment.
- Root-cause action: reran the same install with approved network access.
- Follow-up warning: latest `jsdom`/`@vue/test-utils` transitively required a newer Node patch than the available Node 24.13.0.
- Root-cause action: removed both unused dependencies instead of suppressing the warning. `npm install` then completed with 0 vulnerabilities and no engine warning.

### Lint/build failure and recovery

- Reproduction: `npm run typecheck`, `npm run lint`, `npm run build`.
- Original lint failures: typed ESLint attempted to parse its own JS config through the TS project service; `main.ts` lacked a standard TypeScript declaration for `.vue` imports.
- Root-cause action: excluded the lint config from typed linting, declared the root as ESM, and added the Vue module declaration.
- Original build failure: Vite dependency resolution failed with `spawn EPERM` in the restricted sandbox.
- Layer: process sandbox, not application source.
- Root-cause action: ran the unchanged build with approved build-process permissions.

### GREEN evidence

- `npm run typecheck` — PASS (server `tsc --noEmit`; web `vue-tsc --noEmit`).
- `npm run lint` — PASS (0 errors/warnings).
- `npm run build` — PASS (Vite 8.3.1: 19 modules; server TypeScript emit successful).
- Task 1 is configuration-only, so TDD is explicitly exempt; its executable quality gates are the proof.

## 2026-09-27 — Task 2 identity/session slice

### RED

- Focused command: `npm exec --workspace @paper-trading/server vitest -- run --config vitest.integration.config.ts tests/auth.integration.test.ts`.
- Expected failure: `Cannot find module '../src/http/app.js'`; the tested application boundary did not exist.
- A prior attempt was discarded as invalid RED because the sandbox raised `spawn EPERM` before test collection. The command was rerun with approved test-process permissions.

### GREEN and refactor

- Implemented in-memory registration/login, scrypt password hashing, opaque sessions, seeded 1,000-share positions, exact 1,000,000 cash, bearer-protected snapshots, validation, and normalized errors.
- Focused suite: PASS, 3/3 tests.
- `npm run typecheck`: PASS.
- Initial lint found eight unsafe Supertest `any` response accesses; test boundaries were explicitly narrowed instead of weakening lint.
- Final `npm run lint`: PASS.
- Focused regression after assertion tightening: PASS, 3/3 tests.

## 2026-09-27 — Task 3 market-data slice

### RED

- Unit suite failed because `src/domain/market.js` did not exist.
- Integration suite reached the app and failed `GET /api/market` with expected `404`, proving the endpoint contract was absent.

### GREEN and refactor

- Added cent-based quote state, bounded ±0.5% tick movement, previous-close percentage calculation, subscriptions, and idempotent timer lifecycle.
- Added public market REST snapshot and started the timer only in the production entry, keeping integration tests free of open handles.
- Focused unit suite: PASS, 3/3 tests.
- Focused integration suite: PASS, 1/1 test.
- `npm run typecheck`: PASS.
- `npm run lint`: PASS.
