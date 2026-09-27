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

## 2026-09-27 — Task 4 matching-engine slice

### RED

- Focused engine suite failed because `src/domain/trading.js` did not exist.
- The tests defined externally observable invariants before implementation: cross-price priority, same-price FIFO, partial fills, resting-price execution, price-improvement release, and atomic rejection.

### GREEN and refactor

- Added integer-cent limit orders, explicit sequence ordering, resource reservation, crossing selection, resting-price settlement, order/trade history, and average-cost updates.
- Connected identity accounts to the trading boundary through an explicit `TradingAccount` interface; password/session details remain outside the engine.
- Focused unit suite: PASS, 5/5 tests.
- `npm run typecheck`: PASS.
- `npm run lint`: PASS.
- The partial-fill assertions prove total cash conservation (76,000 + 24,000 cents equals the initial 100,000) while reservations reduce only available, not total, cash.

### Checkpoint A

- `npm test`: PASS — server unit 8/8, server integration 4/4; web correctly reported no tests because no frontend behavior exists yet.
- `npm run typecheck`: PASS.
- `npm run lint`: PASS.
- `npm run build`: PASS — web and server production outputs emitted.

## 2026-09-27 — Task 5 REST/WebSocket integration slice

### RED

- Trading integration reached the running Express app but `POST /api/orders` returned expected `404` in both cases.
- WebSocket suite failed import because `src/realtime/websocket.js` did not exist.

### GREEN

- Added system composition, order validation/error mapping, serialized account/order/trade snapshots, affected-user notifications, authenticated WebSocket connections, market broadcasts, and user-scoped account events.
- REST focused suite: PASS, 2/2 tests.
- Initial WebSocket run exposed a test race: `connected` could arrive between the client `open` event and later listener registration; timeout then left sockets open and blocked teardown.

### Debugging and regression guard

- Reproduced the timeout, localized it to test event capture, and registered the first-message promise before awaiting `open`.
- Added explicit socket termination and WebSocket-server closure in teardown.
- Original WebSocket scenario: PASS, 2/2 tests.
- Full integration suite after fix: PASS, 8/8 tests across 4 files.
- Strict lint then found three untyped test-boundary conversions; explicit response and `RawData` conversion replaced unsafe access.
- Final focused REST/WebSocket suite: PASS, 4/4 tests; `npm run lint`: PASS; typecheck had already passed before the lint-only findings.

## 2026-09-27 — Task 6 frontend authentication slice

### RED

- Focused web suite failed because `src/stores/session` did not exist.

### GREEN and refactor

- Added typed API boundary, Pinia session store, tab-scoped token persistence, refresh restoration, invalid-session clearing, logout, accessible login/register form, protected shell, and responsive visual foundation.
- Focused session suite: PASS, 3/3 tests.
- Initial lint found three unnecessary async test stubs, two redundant state assertions, and Vue template formatting warnings.
- Removed the semantic issues and applied ESLint's mechanical Vue formatting; no rules were disabled.
- Regression session suite: PASS, 3/3 tests.
- `npm run typecheck`: PASS; `npm run lint`: PASS.
- `npm run build`: PASS — 26 web modules transformed; server emitted successfully.
- Interactive auth/logout/login verification is intentionally consolidated into Task 10's required real-browser flow after the full UI exists.

## 2026-09-27 — Task 7 trading-dashboard slice

### RED

- Focused web suite failed because `src/stores/trading` did not exist.

### GREEN and refactor

- Added typed market/order API calls, trading store, authoritative snapshot replacement, client-side numeric validation, responsive market cards, trade ticket, account metrics, holdings, orders, and recent trades.
- Focused store suite: PASS, 3/3 tests.
- Vue template was mechanically formatted with ESLint; a remaining unsafe test URL stringification was replaced with explicit union narrowing.
- Regression store suite: PASS, 3/3 tests.
- `npm run typecheck`: PASS; `npm run lint`: PASS.
- `npm run build`: PASS — 30 web modules transformed; web CSS 6.70 kB and JS 83.65 kB before gzip; server emitted successfully.
- Two-user settlement is already proven by backend integration; the actual visible two-tab flow remains part of Task 10 Playwright acceptance.

## 2026-09-27 — Task 8 realtime/recovery slice

### RED, GREEN, and debug loop

- Initial RED: focused suite failed because `src/services/realtime` did not exist.
- Added runtime event validation, bounded 1–10 second exponential reconnect, authoritative refresh after reconnect, stale-socket checks, and cleanup.
- First GREEN attempt exposed a cross-runtime bug: `instanceof MessageEvent` rejected structurally valid events in the test realm. Replaced constructor identity with a `data` boundary check; focused suite passed 3/3.
- Full web suite then exposed a microtask assertion race after async reconnect refresh. The test now awaits a real Promise microtask; full web suite passed 9/9.
- Slice self-review added a malicious nested account payload. It first failed as expected because shallow array validation invoked the account callback twice; deep position/order/trade guards fixed the boundary and returned the suite to 3/3.

### Checkpoint B

- `npm test`: PASS — server unit 8/8, web unit 9/9, server integration 8/8 (25 total tests).
- `npm run typecheck`: PASS.
- `npm run lint`: PASS.
- `npm run build`: PASS — web 31 modules, CSS 6.97 kB, JS 87.00 kB before gzip; server emit successful.
- Real runtime smoke/reconnect remains intentionally gated on production serving and the final Playwright phase.

## 2026-09-27 — Task 9 production delivery

### TDD production serving

- RED: production-serving integration returned `404` for `/` while the unknown API JSON test already passed.
- GREEN: optional static directory now serves assets and SPA fallback only for non-API HTML GET requests; unknown APIs retain normalized JSON 404.
- Focused production suite: PASS, 2/2 tests.
- Full integration suite after change: PASS, 10/10 tests across 5 files.

### Documentation and runtime

- Added README with exact install/dev/test/build/start commands, feature list, architecture summary, API, scope, and known limitations.
- Added three ADRs and four representative prompt records. These are static documentation changes and are TDD-exempt.
- Dependency engine contract was aligned with the installed Vite/Vitest packages: Node `^22.12.0 || ^24.0.0 || >=26.0.0`.
- `npm install`: PASS, lockfile current, 305 packages audited, 0 vulnerabilities.
- `npm run typecheck`: PASS; `npm run lint`: PASS; `npm run build`: PASS.
- `npm run start`: PASS; production server listened on `http://localhost:3000`.
- `GET /api/health`: 200 with `status=ok`; `GET /`: 200 with expected title; `GET /portfolio`: 200 with expected SPA title.
- The first root-page diagnostic attempt used PowerShell's reserved `$HOME` variable and was invalid; the corrected `$homeResponse` command produced the recorded 200 result. No product change was needed.
