# Implementation Plan: 股票模拟交易系统

## Overview

Implement the approved [SPEC.md](../SPEC.md) as a small npm-workspace monorepo. The plan validates the two highest-risk areas early: deterministic reservation-aware matching and authenticated real-time delivery. Work proceeds in thin slices and ends with production-runtime browser acceptance and an independent review loop.

## Planning baseline

- Existing codebase: greenfield; only the supplied requirement and Phase 1 documents exist.
- Existing task plan: none; no incomplete plan is being overwritten.
- Task tracking target: `tasks/todo.md`.
- Product-code freeze during planning: observed.
- Approval basis: the user explicitly authorized the Root Coding Agent to pass clear gates during continuous execution.

## Dependency graph

```text
T1 workspace/tooling
├── T2 identity/session API
├── T3 market simulation API/events
└── T4 reservation-aware matching engine
       └── T5 trading REST + authenticated WebSocket integration
              ├── T6 frontend authentication shell
              ├── T7 trading dashboard
              └── T8 realtime reconnect/recovery
                     └── T9 production delivery/docs
                            └── T10 final verification/review/browser gate
```

T2, T3, and T4 share only contracts after T1 but will be executed sequentially in this single-agent harness so every RED/GREEN result remains attributable. T6–T8 are ordered to preserve a working UI after every slice.

## Architecture decisions

1. **One repository, two npm workspaces.** Vue and Express retain clear boundaries while root scripts give reviewers one-command install, development, verification, build, and start.
2. **Framework-independent domain core.** Matching, reservations, settlement, and market state live below HTTP/WebSocket adapters, enabling deterministic unit tests and preventing route handlers from becoming business logic.
3. **REST snapshot + WebSocket invalidation/update.** REST supplies authoritative initial/recovery state; authenticated WebSocket events minimize latency. Reconnect always snapshots, so missed events cannot silently corrupt the UI.
4. **Integer minor units inside the server.** Cash and prices use integer cents internally; APIs expose decimal currency values. This avoids floating-point conservation errors without adding a decimal dependency.

Formal ADRs are created in T9 after implementation confirms these choices.

## Vertical slices and checkpoints

### Foundation and risky domain proof

- T1: workspace/tooling scaffold.
- T2: register/login/account bootstrap end to end at the API boundary.
- T3: market snapshot plus periodic event source.
- T4: limit-order matching and accounting as a deterministic domain slice.

Checkpoint A proves typecheck/lint/build infrastructure and the highest-risk domain invariants before UI investment.

### Integrated application

- T5: order endpoint, account snapshot, authenticated WebSocket fan-out.
- T6: browser authentication and protected application shell.
- T7: market/trade/orders/positions/trades dashboard.
- T8: live updates, reconnect, and recovery state.

Checkpoint B proves the complete runtime path with integration tests and a manual smoke check before delivery polish.

### Delivery gate

- T9: production serving, README, ADRs, prompts, and persistent verification record.
- T10: complete command gate, independent five-axis review/fix loop, and Playwright CLI acceptance.

## Verification strategy

- Focused RED/GREEN: `npm run test:unit -- --run <test-file>` or `npm run test:integration -- --run <test-file>` after the scripts exist.
- Per-slice gate: relevant focused test plus `npm run typecheck`; run lint/build when the slice changes their inputs.
- Checkpoints: `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`.
- Runtime: `npm run start`, `GET /api/health`, then Playwright CLI snapshots/interactions/screenshots/trace under `output/playwright/`.
- Failure routing: preserve the exact failing output in `docs/verification.md`, reproduce in isolation, localize, reduce, fix root cause, add regression coverage, and rerun focused + full + original scenario before continuing.

## Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Reservation/settlement double-counts money or shares | High | Integer cents, conservation assertions, unit tests before adapters/UI. |
| FIFO becomes nondeterministic within one millisecond | High | Server sequence number is the final ordering key; deterministic fixtures. |
| WebSocket leaks one user's account state to another | High | Bind each socket to validated session and integration-test user isolation. |
| Client misses events during reconnect | Medium | Fetch authoritative account/market snapshots after every reconnect. |
| Random market loop makes tests flaky/open handles | Medium | Injectable RNG/clock and explicit start/stop lifecycle. |
| SPA production fallback shadows API/WS routes | Medium | Mount API and upgrade handling first; integration health/start checks. |
| Dependency/network availability | Medium | Keep dependency set small, pin lockfile, request sandbox escalation only if install fails due to network restrictions. |
| Interview reviewer cannot reproduce quickly | High | Root scripts, one production process, exact README sequence, clean-install verification. |

## Scope controls

- No database, cancellation, market orders, real quote provider, admin, Docker, or deployment.
- No unrelated refactor because this is a greenfield repository.
- No GitHub creation/push without authorization.
- No generated large Playwright test suite; CLI runtime acceptance only.

## Gate decision

Every task in `tasks/todo.md` has acceptance criteria, explicit commands/manual checks, dependencies, and bounded files. High-risk engine and WebSocket isolation precede UI polish. The task set covers all capability-map modules and all required deliverables. The plan is approved for execution under the user's continuous-execution authorization.
