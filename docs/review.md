# Independent Code Review

## Round 1 — 2026-09-27

Verdict: **Request changes**. No Critical findings; three Required findings must be fixed before browser acceptance.

### Critical

None.

### Required

1. **Normalize parser and unexpected server errors.** `express.json()` parse failures bypass route-level handlers and reach Express's default HTML error response. This violates the specified JSON error envelope and can expose internal details. Add an error-boundary middleware and a regression test for malformed JSON.
2. **Do not report realtime recovery before its REST snapshot succeeds.** `RealtimeClient` correctly awaits `onReconnect`, but the supplied callback is `trading.refresh()`, which catches errors and resolves. A failed account/market recovery therefore transitions to `connected`. Make refresh failure observable to the realtime client, handle the initial load separately, and test the rejected recovery path.
3. **Validate successful REST payloads at runtime.** `requestJson<T>` casts unknown successful JSON to `T`. A malformed server/proxy payload can enter account and market UI state despite the project's explicit untrusted-boundary policy. Introduce canonical runtime guards for auth, market, account, and order response payloads and regression-test malformed successful responses.

### Optional

- WebSocket bearer tokens are placed in the query string. This is practical for the local exercise but can leak through production proxy logs; a production design should use secure cookies or a short-lived WebSocket ticket.
- `scryptSync` blocks the event loop during login/registration. Low local-demo volume makes this acceptable; production should use async password hashing and rate limiting.
- Users, sessions, orders, and global trades grow without eviction for the lifetime of the process. The exercise explicitly uses ephemeral memory, but a long-running service would need bounds/persistence.
- Manifests use `latest`; `package-lock.json` and documented `npm ci` make this reproducible today, but pinned compatible ranges would make intentional upgrades clearer.

### Nit / dead-code inventory

- `IdentityStore.snapshot()` and `requireUserByToken()` are now only used by each other and have no application caller after system composition moved to `snapshotForUser()`. They are harmless; review policy requires asking before deletion, so they remain recorded rather than silently removed.

### Five-axis evidence

- **Correctness:** requirements/spec traced through 25 passing tests before review; matching and private-event isolation are explicitly covered.
- **Readability:** largest production files are 329 lines (dashboard), 250 (engine), and 242 (HTTP composition), below the review threshold; names and layer boundaries are direct.
- **Architecture:** domain → adapter dependency direction is clean; realtime recovery issue above is the only contract mismatch found.
- **Security:** no secrets committed, passwords hashed, external WebSocket data validated, private socket isolation tested; REST validation/error-boundary gaps are Required.
- **Performance:** quote fan-out and book scan are bounded enough for the three-symbol interview scope; synchronous password hashing and unbounded in-memory growth are documented Optional risks.
- **Dependencies:** `npm ls --depth=0` is clean, `npm audit --omit=dev` reports 0 vulnerabilities, lockfile was npm-generated, and no unnecessary UI test dependency remains.

## Round 2 — 2026-09-27

Verdict: **Approve**. No unresolved Critical or Required findings.

### Resolution of Required findings

1. **Resolved — server error normalization.** Added final Express error middleware. Malformed JSON now returns `400` with `INVALID_JSON`; unexpected errors return a fixed `500 INTERNAL_ERROR` envelope. Regression test passed 1/1.
2. **Resolved — reconnect snapshot gate.** `trading.refresh()` now records and rethrows failures. Initial page loading handles that rejection without an unhandled promise, while `RealtimeClient` closes/retries a reconnected socket when refresh rejects and only reports connected after success.
3. **Resolved — REST runtime contracts.** Added one canonical contract module for auth, market, account, order, position, and trade payloads. REST and WebSocket now reuse the same guards; malformed successful data throws `INVALID_RESPONSE` before Pinia mutation.

### Verification reviewed

- Focused server regression: PASS, 1/1.
- Focused web regression: PASS, 11/11.
- Full suite: PASS — server unit 8/8, web unit 11/11, server integration 11/11 (30 total).
- Typecheck and lint: PASS with no disables/skips found.
- Production build: PASS; web 32 modules, server TypeScript emit successful.
- `git diff --check`: clean. Review fix adds 91 changed lines and removes 37 duplicated/shallow-validation lines in tracked files, plus focused new contract/test/review files.

Optional risks and the dead-code inventory from Round 1 remain documented and do not block this local interview-scope delivery.
