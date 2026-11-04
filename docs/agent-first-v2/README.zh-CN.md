# Agent-first 第二轮：三日居民生活

日期：2026-10-30。延续轻量 2D 界面，工作集中在规则生活与持久化内核，未制作新的 Blender 模型。入口仍为 `http://127.0.0.1:3187/town-play/agent-first`。

## 如何体验

开始或恢复河湾手记，打开“街坊”“地图”或“案件本”，在面板下方点击 **启用三日生活**。旧目击与笔记保留；启用不推进时间，只为当前手记安装新生活策略，将运行窗口设为接下来的 72 小时。重复启用不会延长窗口。

关闭面板后可以“等一刻钟”，或“继续世界”让时间逐段推进。人物观察中会显示同地点居民的真实当前活动；离开后只保留最后目击。界面不会显示别人的私有需求值、目标、完整行程、记忆或关系账本。

## 本轮实际实现

- 12 名居民各自有饥饿、精力、社交需求与当前目标。不同种子的初始需求与行动排序有差异。
- 需求会改变计划：饥饿时去咖啡馆/旅馆或在家吃饭，低精力时回家睡觉，夜间回家；社交需求过高时主动去咖啡馆并短暂等候，需求更迫切的人优先获得交流机会。目的地改变仍经既有道路逐分钟通勤，不瞬移。
- 进食、睡眠、歇脚、交谈和职业事务都有持续时间。双方实际在场且空闲时才能交谈，路上的人不能参与。外部约定和持续行动可打断生活活动。
- 咖啡店、邮务、警务、花摊、木工、采访、钟表等有职业活动描述；这些是占用游戏时间的规则事务，尚未模拟每项职业的完整物品生产。
- 旧书修复、车次记录、旅馆登记继续使用原来的工作动作与材料预留。每日六份材料补给是明确的作者规则并产生补给事件；没有把库存静默改成无限。
- 活动产生世界事件；直接记忆引用事件，交谈完成后双方的信任变化引用同一完成事件。现有 Agent 的已知事实会收到这些记忆。信任会影响后续可用交谈对象的选择。
- “读取旧存档”不安装新策略。明确启用、提案校验、权威写入、幂等重试、存档恢复继续使用既有身份、事务和版本检查。

规则策略负责本轮的选择；没有调用模型、没有模型账单。尚未实现自然语言反思、长期记忆摘要或模型驱动的多步计划，不能把这轮结果称为已完成顶级认知 Agent。

## 源码与合同

新增 `packages/engine/src/town/resident-life.ts`。它作为现有时钟阶段的规划与结果步骤，复用 `daily-routine` 的道路、`resident-work` 的专业工作、已有世界事件/记忆/社交资料与回放。生活策略拥有的居民不再同时执行旧版通用动作，避免一人同一时段执行两套决策。

`TownResidentLife` 使用 `town-resident-life.v1`，含启用/结束 tick、需求、目标、活动、最近决策和有来源的信任变化。最近决策与信任变化各保留 240 条；世界事件与记忆仍按原有持久化链保存，不因这个显示上限删除。

P0 的 `agent-first-intent.v1` 增加可选动作 `{"kind":"life-enable"}`；既有 arrive/wait 字段及含义不变。它仍要求当前版本和观察来源，拒绝附带 needs、seed、目标或自选运行时长。`agent-first-observation.v1` 增加可选公开字段：

```json
{"life":{"schema":"town-resident-life.v1","elapsedMinutes":15,"remainingMinutes":4305}}
```

未启用时该字段缺省，旧世界保持原行为。72 小时为滚动区间，例如第 1 日 08:00 至第 4 日 08:00，共 864 个 5 分钟 tick；它并不意味着只出现日期编号 1、2、3。一天开始边界产生的材料交付在下一时钟区间处理，因此这个半开窗口中包含第 2 日和第 3 日两次补给。

## 验证证据与复现

以 `review.json` 为当前源码绑定的汇总，旧 `agent-first-v1` 包保留为上一阶段历史记录，不能用其中的旧哈希代表当前代码。

| 记录 | 覆盖 |
| --- | --- |
| `life-review.json` | 5 个 seed 各 72 小时；从头重跑及中途恢复；每名居民进食/睡眠/社交覆盖、需求边界、事件/记忆来源、材料守恒、零模型调用 |
| `edge-review.json` | 疲劳回家恢复、输入不变、双方交谈与记忆、在途居民排除、完整 checkpoint 回滚 |
| `api-review.json` | 明确启用、无写入提案、幂等、越权字段/旧版本拒绝、SQLite 重开、私有字段非干扰与离屏活动隐藏 |
| `contract-review.json` | 上轮 8 组合同回归 |
| `runtime/resident-work-regression.log` | 原有 17 组专业工作回归 |
| `runtime/daily-routine-regression.log` | 原有 8 组道路/午夜/约定检查 |
| `runtime/session-regression.log` | 原有 14 组身份隔离、事务、恢复和旧接口边界检查 |
| `runtime/typecheck.log` | 此路由及传递依赖的严格类型检查 |
| `browser-review.json` | 桌面 1280×720、窄窗口 390×844，实际启用、等待、人物活动、刷新恢复及截图 |

从仓库根目录运行：

```powershell
node scripts/run-resident-life-checks.mjs
node scripts/run-resident-life-edge-checks.mjs
node scripts/run-resident-life-api-checks.mjs
$env:AGENT_FIRST_REVIEW_DIR='docs/agent-first-v2'
node scripts/run-agent-first-checks.mjs
Remove-Item Env:AGENT_FIRST_REVIEW_DIR
node scripts/run-resident-work-checks.mjs
node scripts/run-town-daily-routine-checks.mjs
node scripts/run-town-play-session-checks.mjs
node node_modules/typescript/bin/tsc -p docs/agent-first-v1/runtime/tsconfig.json --noEmit
```

本轮第一次材料总量断言误把第 4 日 08:00 边界的补给计入区间，失败日志保留在 `runtime/life-first-failure.log`。随后根据实际交付事件检查守恒，仍要求窗口内两次交付、全部材料可核对。休息事件过密的中间版本记录保留在 `runtime/life-pre-idle-refinement.log`，不算最终通过证据。

第五个种子还曾暴露旅馆老板三天没有完成社交，见 `runtime/life-social-starvation-failure.log`。修正为高社交需求会主动改道、短时等待，并优先安排需求更迫切的居民；原“每人至少一次社交”的检查保留，使用修正版重跑五个种子。

## 仍待开发与验收

本轮的记忆是直接事件记忆，关系变化是日常交谈产生的有界信任增加。还没有谣言失真、长期反思、偏好学习、复杂冲突或人物基于旧谈话内容重新规划。进食假定本地有可用餐食；尚未做食物生产、金钱、饥饿伤害或完整经济系统。

5 seed 的 12 人离线引擎检查不代表 24/100 人负载，也不代表浏览器连续运行 72 小时。性能数值是批次平均每 tick 的 p95，不能称为单帧 GPU 或逐 tick p95。窄窗口来自 Windows Chromium 调整视口，没有真实手机、Windows 安装包、人工试玩或美术通过。上一轮的后台标签页隐藏/恢复验收限制仍保留。

完整公平案件、证词推理、结案余波、小说工作台实际联动都未在本轮接入。Blender v1/v2/v3 仍保留，未重新进行艺术验收。

下一轮应先增强记忆检索和有来源的行动候选，比较规则策略与有限预算 Agent 提案的行为差异，再把案件压力带入这个可回放生活循环；建模继续暂缓。
