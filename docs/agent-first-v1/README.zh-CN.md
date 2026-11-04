# 河湾手记：Agent-first P0 / P1

本包对应 `v12-agent-first-2d-roadmap.md` 的合同与探索外壳阶段。入口为 `/town-play/agent-first`。画面是原创 Canvas 2D 地图与简化角色，不加载 Blender / GLB。现有 `/town-play`、山庄 v1/v2/v3 和小说项目保留。

## 现在可以做什么

在广场、旅馆、车站、咖啡馆、旧书店之间寻路或用 WASD / 方向键行走，门前按 E 到访。到访由已有路网计算耗时，再调用已有世界引擎；画面上的每一步不写数据库。E 退出室内只改变画面。

六格工具为观察、询问、跟随、记录、地图、案件本。观察展示同地点的居民及其公开工作；离开后只保留最后目击，停止跟随并隐藏当前工作。询问目前展示身份和后续开放提示；案件本目前保存本机观察笔记与未立案说明。完整证词、搜证、理论提交和结案属于 P3。

“等一刻钟”提交一次 15 分钟命令。“继续世界”每隔 8 秒提交一次同类命令；面板、室内、页面隐藏、保存中或连接错误时暂停自动推进。刷新恢复最后到访地点；设备笔记按手记 ID 保存在当前浏览器，无法代替案件证据。

首版直接使用 `riverbend-world.v1` 的 12 名居民和既有日程；其中旧书修复师、车站员、旅馆主人接入现有普通工作策略。其他居民仍使用既有日程。默认规则策略，模型调用为零。UI 的“初冬”是本地图的美术设定，未实现动态天气系统。室内是共用简化示意，不代表已建成五套室内场景。

## P0 合同边界

| 合同 | 当前冻结内容 | 权威边界 |
| --- | --- | --- |
| `agent-first-observation.v1` | 世界/手记版本、当前地点、5 个公开地点、已观察或最后目击居民、规则策略标记 | 白名单投影；无隐藏真相、内部日程、全轨迹或作者字段 |
| `agent-first-intent.v1` | actionId、手记/世界预期版本、reason、sourceRefs、arrive/wait | 访客仅能到访 5 地点或等待 15 分钟 |
| `resident-intent.v1` | 当前决策上下文、候选选择、来源与理由 | 仅服务端；复用现有合法候选、预算预留与工作裁决，不向访客开放居民干预 |
| `agent-first-refusal.v1` | 稳定 code + 人类可读 message | 拒绝保持旧状态；并发写入沿用原引擎 CAS |
| `case-story-link.v1` | world/case/truth revision、branch/chapter、已发现事实来源与首次披露章节 | 仅合同校验；未连接小说生成或持久化；人物/地点映射与修订影响传播留给 P4 |

玩家 API 不返回作者/审计投影。作者干预、完整真相、内部记忆与决策 trace 仍属于原有独立权限接口；本适配层不新增这类权限。`sourceRef` 是观察依据，不是身份凭据。HTTP-only cookie 才选择权威存档。

### HTTP 接口

`GET /api/v1/town-play/agent-first` 返回 `{ok:true,data:{observation,replayed:false}}`；未开始时 observation 为 null。

`POST` 仅接受以下正文，并要求同源、JSON、正文不超过 4096 字符：

```json
{"kind":"start"}
```

```json
{
  "kind": "propose",
  "intent": {
    "schema": "agent-first-intent.v1",
    "actionId": "unique-action-id",
    "expectedSessionRevision": 1,
    "expectedWorldRevision": 1,
    "reason": "访客停留观察一刻钟",
    "sourceRefs": ["observation:CURRENT_SESSION:1:1"],
    "action": {"kind":"wait","minutes":15}
  }
}
```

版本与 sourceRef 必须从实际 GET 取得。`kind:"commit"` 使用相同意图执行；到访 action 为 `{"kind":"arrive","sceneId":"books"}`。可用地点 ID 为 town-square、inn、station、cafe、books。

propose 不推进或保存世界。commit 将引擎事件、手记版本和 v12 来源回执放入同一事务。相同 actionId 与规范化意图重试返回已存结果；同 ID 的不同内容被拒绝。重试查询先于旧版本拒绝，因此回应丢失后不会再次计时。

拒绝统一返回 `{ok:false,error:{schema:"agent-first-refusal.v1",code,message}}`。P0 代码包括 BAD_INTENT、FORBIDDEN_FIELD、MISSING_SOURCE、UNKNOWN_SOURCE、STATE_CHANGED、ACTION_REUSED、PLACE_CLOSED；会话与传输层另有 SESSION_REQUIRED / SESSION_FORBIDDEN、ORIGIN_MISMATCH、BAD_COMMAND、SAVE_UNAVAILABLE。既有引擎还可返回 BINDING_CHANGED、WORLD_UNAVAILABLE、MAP_UNAVAILABLE、WORK_BUSY、DAY_COMPLETE 等。客户端按错误正文显示原因，并提供恢复连接；不以提示文字冒充成功。

### 居民与案件合同

`admitResidentIntent` 重新生成当前观察上下文，核对确定性 decisionId 和来源，再交给既有 `queueResidentWorkDecision`。候选、预算或已有决定不通过时统一返回 `RESIDENT_REFUSED`，不把旧引擎异常文字作为新合同。调用者必须在原世界写入事务与 CAS 下提交。测试选择休息而非当前工作，并检查真实工作事件及跨墙钟时间的回放 digest；这不是 LLM 接入或 12 名居民完整认知系统的验收。

`validateCaseStoryLink` 只允许当前世界、案件与真相版本，事实必须在 `discoveredEvidenceIds` 中，来源须为 `evidence:<id>`，披露章节为正整数。它不读取未发现证据，不生成小说。P4 需要增加作者身份验证、人物/地点映射、稿件依赖与候选修订流程。

## 复现检查

从仓库根目录运行：

```powershell
node scripts/run-agent-first-checks.mjs
node node_modules/typescript/bin/tsc -p docs/agent-first-v1/runtime/tsconfig.json --noEmit
node scripts/next-cli.mjs dev --webpack -H 127.0.0.1 -p 3187
npx --yes --package @playwright/cli playwright-cli -s=agent-first open http://127.0.0.1:3187/town-play/agent-first --headed
npx --yes --package @playwright/cli playwright-cli -s=agent-first run-code --filename scripts/review-agent-first-browser.cjs
npx --yes --package @playwright/cli playwright-cli -s=agent-first run-code --filename scripts/review-agent-first-cadence.cjs
npx --yes --package @playwright/cli playwright-cli -s=agent-first run-code --filename scripts/review-agent-first-routes.cjs
```

浏览器脚本在自己创建的临时浏览器上下文中建立新手记；第一项包含有意丢弃服务器已提交回应的检查，会产生一条预期网络错误。第二项从前项保存的书店存档继续。合同脚本使用独立 SQLite 测试库，不修改用户存档。

证据索引：`contract-review.json`（8 组合同/引擎检查及摘要）、`browser-review.json`（实际浏览器操作与图像）、`completion-audit.json`（逐项范围核对）；`runtime/typecheck.log` 为本路由及依赖的严格类型检查。没有宣称整个脏工作区完整构建通过。

## 尚未放行

P2 的三日生活、5 seed 回放、需求/记忆/关系完整行为覆盖与 12/24/100 居民负载尚未实现或验收。当前复用世界上限为 288 个 5 分钟 tick，不能声称三日运行。

P3 完整公平案件与余波、P4 小说工作台联动、P5 Windows 包与可替换 3D 皮肤仍待开发。后台标签页隐藏/恢复的真实浏览器验收也未闭合：当前 CLI 即使最小化窗口仍报告 document.hidden=false，不能将这种测试计为通过；面板暂停、明确的世界暂停及前台自动推进已验证。现阶段不新增付费模型接入；没有模型质量对比或成本长跑结果。截图、合同测试和桌面窄窗口检查均不代表人工试玩通过、真实手机验收或“顶级 Agent”已经实现。

下一阶段应先完成 12 名居民的三日规则生活与来源一致的记忆/关系事件，再接有限预算的 Agent 提案并比较其行为质量，随后闭合一宗可公平推理的案件。建模继续暂缓。
