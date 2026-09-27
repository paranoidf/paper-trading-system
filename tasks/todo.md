# Execution Checklist: 股票模拟交易系统

Status legend: `[ ]` pending, `[~]` in progress, `[x]` complete, `[!]` blocked.

## Task 1: Create reproducible workspace and quality commands ✅

**Description:** Establish the npm workspaces, strict TypeScript, lint/test/build/dev/start scripts, and minimal server/web entry points without product behavior.

**Acceptance criteria:**
- [x] `npm ci` can reproduce dependencies from a committed lockfile.
- [x] Root scripts expose dev, typecheck, lint, unit/integration/full tests, build, and production start.
- [x] Both workspaces compile from minimal entry points with strict TypeScript.

**Verification:**
- [x] `npm install` created the lockfile; clean `npm ci` remains for the final gate.
- [x] `npm run typecheck`
- [x] `npm run lint`
- [x] `npm run build`

**Dependencies:** None.

**Files likely touched:** root package/config files; `apps/server/package.json`; `apps/web/package.json`; minimal workspace configs/entries.

**Estimated scope:** Medium (configuration grouped as one foundation slice). TDD exemption: static scaffold has no business behavior.

## Task 2: Deliver registration, login, and account bootstrap API ✅

**Description:** Add in-memory users/sessions with hashed passwords, unique usernames, bearer authentication, exact starting cash, seeded holdings, and normalized API errors.

**Acceptance criteria:**
- [x] Registration creates one user with 1,000,000 cash and seeded holdings; duplicate/invalid registration is rejected.
- [x] Login succeeds only for matching credentials and returns a new opaque token.
- [x] Protected account access rejects missing/invalid tokens and never exposes password material.

**Verification:**
- [x] RED/GREEN: focused Vitest auth integration suite (3 tests).
- [x] `npm run typecheck`

**Dependencies:** Task 1.

**Files likely touched:** server identity store/service, auth middleware/routes, app composition, auth integration test.

**Estimated scope:** Medium (5 focused files).

## Task 3: Deliver deterministic market snapshot and event source ✅

**Description:** Add at least three seeded symbols, percent-change calculation, injectable random price movement, and a stoppable one-second market loop exposed through REST/event callbacks.

**Acceptance criteria:**
- [x] Market snapshot contains at least three unique symbols with code, name, price, and signed percentage change.
- [x] A deterministic tick changes prices only by the configured small bound and never below one cent.
- [x] Timer lifecycle starts/stops without leaking handles; public REST returns the latest snapshot.

**Verification:**
- [x] RED/GREEN: focused market unit suite (3 tests).
- [x] RED/GREEN: focused market integration suite (1 test).
- [x] `npm run typecheck`

**Dependencies:** Task 1.

**Files likely touched:** market domain service/types, market route/composition, unit test, integration test.

**Estimated scope:** Medium (4–5 files).

## Task 4: Prove reservation-aware price-time matching ✅

**Description:** Implement the framework-independent order book and settlement flow using integer cents, resource reservations, price priority, FIFO sequence, partial fills, and resting-order execution prices.

**Acceptance criteria:**
- [x] Best prices match before worse prices and FIFO holds within one price.
- [x] Partial/full fills update order status, cash/reserved cash, positions/reserved positions, and per-user trades consistently.
- [x] Invalid or underfunded/underheld orders are rejected atomically; accounting conservation assertions pass.

**Verification:**
- [x] RED/GREEN: focused matching-engine unit suite (5 tests).
- [x] `npm run typecheck`
- [x] `npm run lint`

**Dependencies:** Tasks 1–3 (uses identity accounts and market symbols).

**Files likely touched:** trading domain types/errors, engine, in-memory state adapter, engine unit test.

**Estimated scope:** Medium (4–5 files).

## Checkpoint A: Foundation and domain

- [x] `npm test`
- [x] `npm run typecheck`
- [x] `npm run lint`
- [x] `npm run build`
- [x] `docs/verification.md` records RED/GREEN evidence and any resolved failures.

## Task 5: Integrate orders, account snapshots, and authenticated WebSocket events ✅

**Description:** Expose the engine through validated REST endpoints and push public market/user-private account updates over session-bound WebSockets.

**Acceptance criteria:**
- [x] Order submission and account snapshot conform to SPEC response/error contracts.
- [x] A crossing two-user scenario updates both accounts and emits account events to the correct sockets.
- [x] Unauthorized sockets are closed and no user's private payload reaches another user's socket.

**Verification:**
- [x] RED/GREEN: focused trading REST integration suite (2 tests).
- [x] RED/GREEN: focused WebSocket integration suite (2 tests).
- [x] `npm run typecheck`

**Dependencies:** Tasks 2–4.

**Files likely touched:** trading routes, WebSocket gateway, app/server composition, two integration tests.

**Estimated scope:** Medium (5 files).

## Task 6: Deliver browser authentication and protected shell ✅

**Description:** Build the Vue application shell, typed API client/store, registration/login form, session persistence for the tab, clear loading/error states, and logout.

**Acceptance criteria:**
- [x] A user can switch login/register mode, submit valid credentials, and reach the protected dashboard shell.
- [x] API errors are shown without exposing internal details; logout clears client credentials/state.
- [x] Page refresh restores the account through the saved token or returns to auth if invalid.

**Verification:**
- [x] RED/GREEN: focused session-store unit suite (3 tests).
- [x] `npm run typecheck`
- [x] `npm run build`
- [ ] Manual check: consolidated into the required Task 10 Playwright browser flow.

**Dependencies:** Tasks 2 and 5.

**Files likely touched:** Vue app shell, API client, Pinia session store/test, auth component, base styles.

**Estimated scope:** Medium (5 files; styling may be colocated).

## Task 7: Deliver market and trading dashboard

**Description:** Render quotes, balances, trade ticket, orders, positions, and recent fills; submit buy/sell limits with accessible validation and responsive layout.

**Acceptance criteria:**
- [ ] At least three quote cards show symbol/name/price/change; tables expose all required order, position, and trade fields.
- [ ] Trade form validates symbol/price/integer quantity and displays accepted/rejected server outcomes.
- [ ] A two-session crossing flow results in visible filled/partial statuses, changed balances/positions, and recent trades.

**Verification:**
- [ ] RED/GREEN: `npm run test:unit -- --run apps/web/src/stores/trading.test.ts`
- [ ] `npm run typecheck`
- [ ] `npm run lint`
- [ ] `npm run build`
- [ ] Manual check: place non-crossing then crossing orders from two sessions.

**Dependencies:** Tasks 5–6.

**Files likely touched:** trading store/test, dashboard view, trade form, market/account tables, dashboard styles.

**Estimated scope:** Split internally into focused UI increments; no individual increment may exceed ~5 files.

## Task 8: Deliver live updates and reconnect recovery

**Description:** Add a typed WebSocket client, public/private event handling, connection indicator, bounded reconnect backoff, cleanup, and authoritative snapshot refresh after reconnection.

**Acceptance criteria:**
- [ ] Quote/account events update visible state without refresh and malformed events are ignored safely.
- [ ] Disconnect triggers visible reconnecting state and bounded retries; reconnect fetches fresh market/account snapshots.
- [ ] Logout destroys timers/socket and prevents stale updates into the next session.

**Verification:**
- [ ] RED/GREEN: `npm run test:unit -- --run apps/web/src/services/realtime.test.ts`
- [ ] `npm run typecheck`
- [ ] `npm test`
- [ ] Manual check: stop/restart backend and observe recovery.

**Dependencies:** Tasks 5–7.

**Files likely touched:** realtime client/test, session/trading store integration, connection status UI.

**Estimated scope:** Medium (4–5 files).

## Checkpoint B: Integrated application

- [ ] `npm test`
- [ ] `npm run typecheck`
- [ ] `npm run lint`
- [ ] `npm run build`
- [ ] Development runtime completes auth, quote, order, match, and reconnect smoke flow.

## Task 9: Complete production delivery and durable documentation

**Description:** Serve the built SPA from Express, finalize root scripts, initialize the local Git repository if still absent, and write README, ADRs, prompt record, limitations, and verification log.

**Acceptance criteria:**
- [ ] `npm run start` serves `/`, `/api/health`, REST, and WebSocket from one process after build.
- [ ] README gives exact clean install/dev/test/build/start steps, features, 2–3 decisions, and in-memory limitations.
- [ ] ADRs, 3–5 representative prompts, verification evidence, and known limitations are complete and consistent with code.

**Verification:**
- [ ] `npm run build`
- [ ] `npm run start` then HTTP health/home checks.
- [ ] Follow README commands from a clean dependency install.

**Dependencies:** Tasks 1–8.

**Files likely touched:** server production entry/config, root scripts, `README.md`, `docs/decisions/*`, `docs/prompts.md`, `docs/verification.md`.

**Estimated scope:** Documentation/config slices; behavioral production fallback uses an integration test first.

## Task 10: Run final gate, independent review loop, and Playwright acceptance

**Description:** Execute every required command, perform a read-only five-axis review of requirements/spec/full diff/tests/dependencies/docs/evidence, fix all Critical/Required findings through TDD/debugging, then run real-browser acceptance with artifacts.

**Acceptance criteria:**
- [ ] Install, typecheck, lint, unit, integration, full test, web/server build, production start, and README walkthrough all pass with recorded output.
- [ ] Final review records Critical/Required/Optional/Nit findings and ends with zero unresolved Critical/Required issues.
- [ ] Playwright verifies registration/login, live quotes, rejected invalid trade, two-user crossing trade, visible account updates, and reconnect recovery; console/network checks have no unexplained failures.

**Verification:**
- [ ] `npm ci`
- [ ] `npm run typecheck`
- [ ] `npm run lint`
- [ ] `npm run test:unit`
- [ ] `npm run test:integration`
- [ ] `npm test`
- [ ] `npm run build`
- [ ] `npm run start` and README smoke commands.
- [ ] Playwright CLI snapshot after every navigation/major DOM change, screenshots/trace in `output/playwright/`.

**Dependencies:** Tasks 1–9.

**Files likely touched:** review/verification records and only files required by findings; `output/playwright/*` artifacts.

**Estimated scope:** Verification/review task; fixes are split into separate focused increments.

## Checkpoint C: Complete

- [ ] All numbered tasks and acceptance criteria are checked.
- [ ] All SPEC success criteria are traced to evidence.
- [ ] No unresolved Critical or Required review finding.
- [ ] No uncommitted accidental/generated files; intentional deliverables are listed.
- [ ] External GitHub push/publication remains explicitly pending authorization.
