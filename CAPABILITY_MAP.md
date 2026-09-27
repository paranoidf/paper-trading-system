# Capability Map: 股票模拟交易系统

| Module id | Responsibility | Depends on |
|---|---|---|
| `identity-session` | 注册、登录、内存用户与会话、初始资金 | — |
| `market-data` | 三支以上股票、每秒模拟行情、行情查询与广播 | — |
| `trading-engine` | 限价订单、价格/时间优先撮合、资金与持仓结算、成交历史 | `identity-session`, `market-data` |
| `realtime-portfolio` | 用户状态快照、WebSocket 鉴权推送、前端重连与恢复 | `identity-session`, `market-data`, `trading-engine` |
| `delivery-quality` | README、架构决策、Prompt 记录、测试/构建/浏览器验收证据 | all modules |

Build order: `identity-session`, `market-data` → `trading-engine` → `realtime-portfolio` → `delivery-quality`.

## Gate decision

The requirement groups have separate data and acceptance criteria, so a capability map is required. The user authorized the Root Coding Agent to pass clear phase gates without waiting. The module boundaries are acyclic, cover every mandatory deliverable, and avoid optional deployment scope; this map is therefore accepted as the initiative index on 2026-09-27.
