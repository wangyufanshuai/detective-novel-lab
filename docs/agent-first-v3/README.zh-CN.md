# Agent-first 第三轮：记忆检索与候选裁决

日期：2026-10-30。本轮在三日居民生活基础上增加“居民为什么选择这一步”的可回放候选层。它仍然不制作新的 Blender 资产，也不把语言模型直接接入世界写入。

## 本轮交付

`packages/engine/src/town/resident-cognition.ts` 冻结了 `resident-life-proposal.v1`：

- `npcId`、tick、预期 world revision 和候选 ID；
- 规则模式或离线 Agent 模式；
- 候选所需的 `life-policy:<world>:<tick>:<revision>` 以及本居民自己的 `memory:<id>` 来源；
- 有界检索记忆 ID、理由、置信度；
- 48 次离线 Agent 候选预算、512 条最近接受提案和稳定拒绝原因。

记忆检索只读当前居民自己的事件记忆，最多返回 8 条，按时间、置信度和记忆类型做确定性排序。它不做向量服务或模型调用；每条记忆来源必须确实属于该居民和当前世界。候选由服务器从当前合法生活选项构造，客户端不能注入 `needs`、目标、秘密、候选 ID 或来源。

默认三日生活仍使用 `rules` 模式。每个真正开始的进食、睡眠、休息、交谈或职业活动都会先留下一个提案回执，再写入活动事件。`/town-play/agent-first` 的“街坊”面板会显示已记录的有来源候选数量，但不会显示私有需求、记忆全文或内部评分。

`offline-agent` 是一个本地确定性比较臂：在同一合法候选集合上使用需求、来源记忆和种子排序选择候选，预算每次只消耗一个槽位。它的形状与未来模型提案相同，便于以后接入模型；本轮 `modelCalls` 永远为 0。它不是模型质量结论，也不是 LLM 已经接入的证明。

## 裁决边界

| 入口 | 会发生什么 | 不允许什么 |
| --- | --- | --- |
| `retrieveResidentMemories` | 返回当前居民的有界记忆命中和 `memory:` 来源 | 读取别的居民私密记忆、返回未绑定来源 |
| `buildResidentLifeOptions` | 为当前世界位置、需求和同伴生成合法候选 | 由客户端任意添加新地点、时间或居民 |
| `proposeResidentLifeOption` | 规则或离线 Agent 在候选内选择并生成版本化提案 | 直接写世界、跳过候选或超预算调用 |
| `admitResidentLifeProposal` | 核对 tick、world revision、候选身份、政策来源和记忆归属 | 接受过期、伪造 memory、非法 candidate 或重复改写 |
| `beginResidentLifeInterval` | 将通过的提案转成原有生活活动，再由原时钟/道路/事件系统提交 | 另起一套时间、道路或事件数据库 |

拒绝包括 `STALE_CONTEXT`、`UNKNOWN_SOURCE`、`ILLEGAL_CANDIDATE`、`BUDGET_EXHAUSTED` 和 `ACTION_REUSED`。生活事件、直接记忆和信任变化仍沿上一轮的 source event 链回放；候选回执只是意图依据，不是证据本身。

## 验证

当前证据：

- `life-review.json`：当前源码下 5 个 seed 各 72 小时的完整生活、回放和中途恢复报告；
- `cognition-review.json`：5 组候选/记忆/预算/拒绝/规则与离线模式回放检查；
- `runtime/edge.log`：上一轮 5 组生活边界检查；
- `runtime/api.log`：上一轮 3 组真实 Route/SQLite/公开投影检查；
- `runtime/life-regression.log`：候选层接入后的 5 seed × 72 小时生活回归；
- `runtime/typecheck.log`：本路由及传递依赖严格类型检查；
- `runtime/browser.log`：真实浏览器启用、等待、页面显示候选摘要、刷新恢复和无页面错误检查；
- `output/playwright/resident-cognition-panel.png`：页面显示“已记录有来源候选”的实际截图。

复现：

```powershell
node scripts/run-resident-cognition-checks.mjs
node scripts/run-resident-life-edge-checks.mjs
node scripts/run-resident-life-api-checks.mjs
node node_modules/typescript/bin/tsc -p docs/agent-first-v1/runtime/tsconfig.json --noEmit
node scripts/run-resident-life-checks.mjs
npx --yes --package @playwright/cli playwright-cli -s=agent-cognition run-code --filename scripts/review-resident-cognition-browser.cjs
```

本轮回归仍是 12 名居民、规则生活 72 小时和短窗口离线候选比较。它没有模型网络调用，没有 24/100 人负载，没有完整案件公平性，没有小说工作台写回，也没有人工试玩或物理移动设备验收。

## 下一步

下一轮可以在不改变 Referee 的前提下接入一个可替换的模型提案提供者：先为单个居民设置严格预算、超时、缓存和规则回退，再比较规则/离线/模型三臂的候选接受率、来源覆盖、行动多样性和回放一致性。只有这些指标稳定，才把案件压力、证词记忆和公平推理接入生活循环。Blender 候选继续保留，建模仍然不是当前瓶颈。
