# Playwright acceptance evidence

These screenshots were captured from the production build at `http://127.0.0.1:3000` on 2026-09-27. The full command/results narrative is in `docs/verification.md`.

- `01-dashboard-live.png` — registered Alice dashboard with three live quote cards.
- `02-rejected-order.png` — insufficient-cash order rejection; no account mutation.
- `03-alice-crossing.png` — seller after settlement: ¥1,000,400 cash, 996 AAPL, filled order, 4-share fill at ¥100.
- `04-bob-crossing-reconnected.png` — buyer after settlement and recovery: ¥999,600 cash, 1004 AAPL, filled order, 4-share fill at ¥100.
- `05-reconnecting.png` — visible `正在重连` state after a forced native WebSocket close.
- `06-reconnected.png` — visible `实时已连接` state after reconnect and authoritative REST refresh.

Raw Playwright session internals remain excluded by `.gitignore`; they were approximately 114 MB and were not necessary to reproduce or understand the acceptance result.
