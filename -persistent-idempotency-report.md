# Goal 13：持久化幂等记录与条件保存事务

日期：2026-09-12

## 本轮交付

- SQLite 新增 `idempotency_receipts` 表，receipt 不再只依赖进程内 Map；服务进程内存清空后，已提交的幂等结果仍可从数据库读取。
- SQLite schema version 从 4 升至 5。
- 新增 `saveWorldBundleIfRuntimeRevision`：以 `persistentRuntime.commandRevision` 为条件执行 world、events、activeCase 同一事务保存。
- runtime persistence 每次成功命令推进 `commandRevision`；条件失败返回明确的 `RUNTIME_REVISION_CONFLICT` 409。
- 案件抽取改为 world、事件和 activeCase 同事务提交，避免世界已切换但 cases 行未落盘。
- 幂等键加入 worldId scope，避免不同世界复用同 key 互相冲突。
- start/step 支持可选 sessionId/playerId 归属校验；错误契约增加明确 CAS code。
- `loadRuntimeWorld` replay 之前的 start 路径已调整，已完成 receipt 的重复请求不会再次触发 runtime normalization。

## 已测

- `npx tsc --noEmit`：通过
- `npm run build`：通过，Next.js 16.3.0，107 个静态页面生成完成
- `npm run test:town-runtime-idempotency`：通过
- `npm run test:storage`：通过
- `npm run test:world-projection`：14 项通过
- `npm run test:persistent-town`：通过

## 可靠性边界

当前 receipt 已持久化，但 receipt 写入发生在 world CAS 提交之后，服务在这两个提交之间崩溃时仍存在极窄的重复执行窗口。因此本轮不宣称跨崩溃 exactly-once；已证明的是持久 receipt 重放、同 key 参数冲突和 runtime CAS。下一轮可引入 pending/committed receipt 状态，把 receipt claim 与 world commit 合并到同一事务。

开发工具类 pause/reset、agent intervention、scenario 和 snapshot 路由仍需单独迁入 admin projection 或加入明确的 admin 权限门禁；本轮只收紧了玩家默认的 start/step/extract 路径。

## 下一轮建议

Goal 14：pending/committed 幂等事务、跨进程重启回放测试、admin/player 路由分层，以及重新生成 City Pulse 多尺寸浏览器截图。
