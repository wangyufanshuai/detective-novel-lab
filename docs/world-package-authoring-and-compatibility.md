# WorldPackage Authoring and Compatibility

## 适用范围

v11 Alpha 注册表冻结为 12 Campaign / 24 routes / 72 treatments。新增 Campaign 只能在 Beta 前贡献流程中进入注册表，并必须在同一个变更中提供完整 WorldPackage、两条三章 route、六个 authored treatments、安全中文投影、Route Certificate 证明与可复现六案 playthrough evidence。

## Authoring template

在注册前把草稿放在工作树外或贡献分支的临时目录；不要把未注册目录留在 `world-packs/`，因为 Alpha gate 要求磁盘目录与注册表精确一致。正式贡献时一次性加入 `world-packs/<package-id>/` 和 Campaign registry binding。

一个完整 `world-package.v1` 目录必须包含：

```text
world-packs/<package-id>/
├── manifest.json
├── scenario-pack.json
├── map-pack.json
├── rule-catalog.json
├── agent-pack.json
├── ecosystem-catalog.json
├── expectations.json
├── README.md
├── ATTRIBUTION.md        # 非 project-local 许可时要求
└── asset-manifest.json   # 有模型、纹理、音频或房间资产时要求
```

`manifest.json` 从以下最小模板开始：

```json
{
  "id": "<lowercase-package-id>",
  "name": "<Public package name>",
  "version": "1.0.0",
  "schemaVersion": "world-package.v1",
  "description": "<Low-spoiler purpose>",
  "author": "<Contributor>",
  "createdAt": "<ISO-8601>",
  "license": "project-local-original",
  "scenarioPackPath": "scenario-pack.json",
  "mapPackPath": "map-pack.json",
  "ruleCatalogPath": "rule-catalog.json",
  "agentPackPath": "agent-pack.json",
  "ecosystemCatalogPath": "ecosystem-catalog.json",
  "expectationsPath": "expectations.json",
  "assetManifestPath": "asset-manifest.json"
}
```

如果包只包含世界规则和文本，可以省略 `assetManifestPath`；一旦包声明或导出可视资产，就必须提供 `asset-manifest.json`。其 schema 是 `world-asset-manifest.v1`，每个资产至少绑定相对路径、字节数、SHA-256、许可证、来源、状态、人工批准和运行时验证字段。`accepted` 资产必须同时满足 `humanApproval=true` 与 `runtimeVerified=true`；`candidate-only`、`blocked` 或 `missing` 只能作为候选或门禁输入，不能被当作已交付资产。

子包 schema 固定为 `scenario-pack.v1`、`town-map-pack.v1`、`agent-pack.v1`、`ecosystem-catalog.v1`。`rule-catalog.json` 必须提供 resources、institutions、professions、longActionDefinitions、randomEvents、casePressureRules，并应提供 evidenceRules。`agent-pack.json` 至少一个 agent，`ecosystem-catalog.json` 至少一个 faction；所有相互引用的 ID 必须在本包内可解析。

不得包含绝对路径、secret、token、runtime snapshot、checkpoint、hidden truth、culpritId 或原始玩家内容。README 只写低剧透用途、许可和作者说明。

## `world-package.v1` compatibility policy

| 变化 | `world-package.v1` 处理 | 版本动作 |
|---|---|---|
| 文案、权重、公开元数据修正 | 兼容 | patch |
| 新增可选字段，旧 reader 可安全忽略 | 兼容 | minor |
| 删除/重命名必填字段或文件 | 不兼容 | 新 schema major |
| 改变字段类型、ID 语义或引用规则 | 不兼容 | 新 schema major |
| 让包能够改变 truth / judgement authority | 禁止 | 不得进入任何版本 |

Reader 对 `schemaVersion` 使用精确匹配；当前只接受 `world-package.v1`。包自身 `version` 必须为 SemVer `1.x.y`。未知的可选字段可以被 reader 忽略，但贡献者不能依赖旧 reader 未声明的行为。任何 `world-package.v2` 提案必须先提供迁移文档、双读策略与回退测试，不能在 Alpha/Beta gate 中静默引入。

## Campaign admission contract

新 Campaign 必须同时满足：

1. 一个可独立验证、无 warning 的 primary WorldPackage。
2. route ID 精确为 `baseline` 与 `counter-route`，每条包含 ordinal 1 / 2 / 3。
3. 每章一个 authored treatment；每条 route 的三章都通过 Route Certificate、auto-solve、evidence coverage、non-culprit exclusion 和 timeline closure。
4. 双路线至少在 case family、lead rhythm、evidence frame、red herrings、causal bridge、finale family 中四项不同，并提供不同的 replay contrast。
5. 所有公开 Campaign / route / chapter / treatment 文案提供安全、非空、可读的 zh-CN 投影。
6. 完成两条 route 的六案 Server playthrough，并把完整性 hash 写入本地 evidence manifest。
7. presentation manifest 至少声明完整资产槽位；真实资产仍按 Alpha.2 license register 流程从 `planned` 切换为 `ready`。

贡献者验证：

```powershell
npm.cmd run test:seventy-two-case-campaign -- --json
npm.cmd run validate:campaign-contribution -- --campaign=<campaign-id> --json
npm.cmd run test:v11-world-packages -- --json
npm.cmd run test:noir-presentation -- --json
```

如果注册表已经扩展，playthrough suite 和 evidence manifest 的 expected campaign / route / case 数也必须在同一变更中升级；不能继续把 72 当作新总数。`validate:campaign-contribution` 会验证 evidence hash，并要求目标 Campaign 正好存在 `2 × 3` 个自动通过记录。

## Beta admission gate

自动验证通过只代表“可进入人工评审”，不代表可发布。Beta promotion 还要求 24-seed fairness、完整 nightly、浏览器矩阵、protected-public hash、5000 / 10000 tick gate、comprehension gate 与 art-direction approval 全部通过。任何一项为 `human-pending`、`not-run` 或 `failed`，promotion 都保持 held。
