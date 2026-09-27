# 澄明股票模拟交易系统

一个用于工程面试演示的全栈股票模拟交易 Web 应用。前端采用 Vue 3 + TypeScript，后端采用 Node.js + Express；全部业务数据保存在内存中，后端重启即清空。

> 仅用于模拟练习，不连接真实市场、不涉及真实资金，也不构成投资建议。

## 功能

- 本地注册 / 登录，密码经 scrypt 哈希后仅存于服务进程内存；每位新用户获得 1,000,000 虚拟资金与每支种子股票 1,000 股。
- 三支股票的行情看板，后端每秒产生不超过 ±0.5% 的小幅随机波动，并通过 WebSocket 推送。
- 限价买入 / 卖出委托，按“价格优先、同价时间优先”撮合，支持部分成交；成交价取先进入订单簿的挂单价。
- 下单时冻结买方资金或卖方持仓，成交后同步结算资金、持仓、委托状态与最近成交。
- REST 快照 + 鉴权 WebSocket 私有更新；断线后以 1–10 秒有界指数退避重连，并在重连后重新拉取权威快照。
- 响应式中文界面，包含资金、行情、交易面板、委托、持仓与成交记录。

## 环境要求

- Node.js `^22.12.0`、`^24.0.0` 或 `>=26.0.0`
- npm 10+

本项目实际验收环境为 Node.js 24.13.0、npm 11.6.2。依赖版本由 `package-lock.json` 固定。

## 三分钟启动

```powershell
npm ci
npm run dev
```

打开 <http://localhost:5173>。Vite 会把 `/api` 与 `/ws` 代理到后端 `http://localhost:3000`。一个命令同时启动前后端；按 `Ctrl+C` 一起停止。

建议在两个浏览器标签页分别注册不同用户：先在用户 A 提交 AAPL 限价卖单，再在用户 B 以相同或更高价格提交买单，即可观察成交与双方账户更新。

## 生产模式本地运行

```powershell
npm ci
npm run build
npm run start
```

打开 <http://localhost:3000>。生产模式由同一个 Node.js 进程提供前端静态文件、REST API 与 WebSocket。

## 验证命令

```powershell
npm run typecheck
npm run lint
npm run test:unit
npm run test:integration
npm test
npm run build
```

测试覆盖撮合价格优先、FIFO、部分成交、成交价、资金/持仓冻结、认证、REST 交易、WebSocket 鉴权与用户隔离、前端状态、重连和外部消息校验。真实浏览器验收证据位于 `output/playwright/`，完整执行记录见 [`docs/verification.md`](docs/verification.md)。

## 项目结构

```text
apps/server/src/domain/     行情、身份账户、撮合与结算领域逻辑
apps/server/src/http/       Express 组合、验证与 REST API
apps/server/src/realtime/   鉴权 WebSocket 网关
apps/server/tests/          单元与集成测试
apps/web/src/               Vue 页面、Pinia store、API 与实时客户端
docs/decisions/             架构决策记录
docs/prompts.md             代表性 AI Prompt 与人工调整
tasks/                      规格驱动的计划与执行清单
```

## 关键架构决策

1. **撮合内核与传输层分离。** 撮合器只接收账户接口和整数分值，不依赖 Express/WebSocket，因此价格—时间优先和结算可以确定性测试。详见 [ADR-001](docs/decisions/001-domain-core.md)。
2. **整数分记账并显式冻结资源。** 总资金/持仓与冻结量分开，避免浮点误差、超额买入和裸卖；成交时按委托限价释放冻结、按实际成交价扣款。详见 [ADR-002](docs/decisions/002-reservation-accounting.md)。
3. **REST 权威快照 + WebSocket 增量通知。** WebSocket 负责低延迟行情和私有账户更新，登录与每次重连都用 REST 恢复完整状态，避免消息缺口累积。详见 [ADR-003](docs/decisions/003-realtime-recovery.md)。

## API 摘要

- `POST /api/auth/register`、`POST /api/auth/login`
- `GET /api/market`
- `GET /api/account`（Bearer token）
- `POST /api/orders`（Bearer token）
- `GET /api/health`
- `WS /ws?token=...`

错误统一为 `{ "error": { "code": "...", "message": "..." } }`。外部输入由 Zod/运行时类型守卫校验。

## 已知限制

- 所有状态仅在单个 Node.js 进程内存中，重启后用户、会话、委托、持仓变化和成交都会清空。
- 不支持撤单、改单、市价单、做空、手续费、真实行情或数据库；行情变化不会主动触发订单，只撮合用户间交叉的限价单。
- 为便于展示卖出流程，新注册用户预置每支股票 1,000 股。
- 本地认证是演示实现：无 HTTPS、找回密码、限流、CSRF/OAuth 或多实例会话共享，不应直接用于公网生产环境。
- GitHub 公开仓库和部署尚未执行，需要用户明确授权和目标账号。

## 开发说明

详细产品/工程规格见 [`SPEC.md`](SPEC.md)，能力边界见 [`CAPABILITY_MAP.md`](CAPABILITY_MAP.md)，执行状态见 [`tasks/todo.md`](tasks/todo.md)。本仓库使用本地原子提交保存各个可验证切片，不会自动 push 或发布。
