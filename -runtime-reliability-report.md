# Goal 12：Town runtime 命令可靠性

日期：2026-09-12

## 本轮交付

- `runtime/start` 与 `runtime/step` 支持 `Idempotency-Key` 或 `actionId`。
- 幂等键按 endpoint 命名空间隔离；相同 key 的相同命令返回原结果并标记 `replayed: true`，同 key 改变命令参数返回 409。
- 两个 runtime 命令支持 `sessionRevision`，过期版本在任何世界写入前返回 409。
- Persistent Town runtime 增加单调 `commandRevision`，零 tick 的世界决策也会推进 CAS 版本，不再只依赖 tick。
- 所有七条 `runtime/step` 变更路径统一经过幂等与版本检查：普通推进、案件 lead、arc directive、resource commitment、world offer、recovery、headquarters。
- 客户端生命周期、战役启动和世界选择操作生成稳定 actionId，并携带上次 runtime revision。
- 重放响应统一带 `x-idempotent-replay: true`，同时将 payload 的 `replayed` 标为 true。
- 新增真实生产服务器 API 测试，覆盖重复 start、重复 step、同 key 冲突、过期 revision 和玩家公开投影。

## 已测

- `npx tsc --noEmit`：通过
- `npm run build`：通过，Next.js 16.3.0，107 个静态页面生成完成
- `npm run test:town-runtime-idempotency`：通过
  - start 重放不重复推进 tick
  - 同 key 改参数返回 409
  - stale revision 返回 409
  - step 重放返回同一 tick 与 `replayed: true`
  - 玩家 runtime 不暴露内部 social/observation ledger
- `npm run test:world-projection`：13 项契约通过
- `npm run test:persistent-town`：通过
- `npm run test:world-session-boundaries`：通过
- `npm run test:investigation-workspace`：通过
- `npm run test:campaign-transition`：通过

## 边界与后续

幂等 receipt 当前保存在进程内存，服务重启后不会保留；本轮因此证明的是单进程重复请求与 CAS 边界，不宣称跨重启的 exactly-once。下一轮可将 receipt 持久化进 SQLite，并为 runtime command 增加明确的 session/player 授权策略。旧的 `run-persistent-town-api-smoke` 仍混合检查 admin 内部字段与玩家公开路由，需要拆分为 admin projection 与 player projection 两套契约。

## 下一轮建议

Goal 13：持久化幂等 receipt、runtime command 授权、条件保存事务，以及重新生成浏览器多尺寸截图，确认 City Pulse 在可靠性增强后仍保持无溢出和无控制台错误。
