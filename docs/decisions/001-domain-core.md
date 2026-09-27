# ADR-001: 将撮合内核与传输层分离

- Status: Accepted
- Date: 2026-09-27

## Context

价格—时间优先、部分成交和双边结算是系统风险最高的逻辑。如果这些规则写在 Express handler 或 WebSocket 回调中，测试会依赖网络时序，错误也难以定位。

## Decision

`TradingEngine` 只依赖股票代码集合、账户查询函数和可注入时钟。HTTP 负责认证、输入转换和错误映射；WebSocket 只负责发布引擎完成后的账户快照。

## Consequences

- 撮合测试是毫秒级、确定性的小型测试。
- REST/WebSocket 测试聚焦边界合同和隔离，而不复制撮合规则。
- 当前内存账户是可变接口；若未来持久化，需要在同一边界提供事务语义。
