# Goal 11：世界公开状态投影与内核可靠性

日期：2026-09-12

## 本轮交付

- 新增 `city-pulse.world-projection.v1` 公开投影，包含稳定 `revision`、世界/运行时状态、当前阶段、目标、压力摘要、聚合指标和无真相泄漏的公开信号。
- `TownSituationBrief` 增加稳定版本号，使用 `world.seed + tick`，同一确定性世界的重复生成保持相同版本。
- 玩家 Town 查询与 runtime start/step 路由改用显式安全投影：运行时、候选队列、世界和事件都不再默认返回完整内核账本。
- 候选队列移除 culprit/victim、source/memory/goal/risk 链字段，只保留玩家需要的成熟度、状态和聚合验证结果。
- 案件抽取返回玩家案件投影：隐藏 truth、sourceMap、generation profile 的身份/事件链、角色秘密、证据真义、关键证据标记和开发逻辑链均被遮蔽；公开场景、嫌疑人、公开描述和既有调查流程形状保留。
- `/api/ai/live-eval/latest` 在没有报告时返回 200 空状态，避免 City Pulse 首屏产生无意义 404 控制台错误。
- 增强公开投影契约测试，覆盖版本、schema、玩家路由接线、队列脱敏、案件抽取脱敏和 live-eval 空状态。

## 已测

- `npx tsc --noEmit`：通过
- `npm run build`：通过，Next.js 16.3.0，107 个静态页面生成完成
- `npm run test:world-projection`：10/10 checks 通过
- `npm run test:persistent-town`：通过
- `npm run test:world-session-boundaries`：通过
- `npm run test:world-console`：通过
- `npm run test:first-case-loop`：通过；理论证明 62/62，首案闭环 28/28，边界与行动结果套件通过
- `npm run test:investigation-workspace`：通过
- `npm run test:campaign-transition`：通过
- 新鲜生产服务器网络检查：`/api/ai/live-eval/latest` 返回 200，`{"ok":true,"report":null,"available":false}`

## 尚未宣称

- 本轮没有把 admin/review 路由全部迁移到 player projection；开发、作者和审计路径仍保留独立的内部投影边界。
- 还没有完成真实浏览器多尺寸视觉验收的新一轮截图；Goal 10 的旧截图仍带有旧服务器 404 记录，不能作为本轮视觉证明。
- runtime start/step 的跨 HTTP 重试幂等与 sessionRevision CAS 仍应作为下一轮内核可靠性目标单独补齐；案件调查命令已有既有边界测试，不把它们扩大解释为 Town runtime 全部幂等。

## 下一轮建议

Goal 12 优先做 Town runtime command 的 `Idempotency-Key/actionId + sessionRevision`、事务/outbox 结算和网络并发回归；随后重新跑浏览器截图，确认 City Pulse 消费版本化公开投影且无 404。
