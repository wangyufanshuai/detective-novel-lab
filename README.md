# Deduction Engine

Deduction Engine 是一个中文本格推理游戏原型。系统先生成结构化真相，再用本地规则引擎检查凶手唯一、时间线、证据公平性和排除链，最后调用 DeepSeek 生成玩家可见案卷、角色回答和解答篇。

## 启动

```powershell
cd E:\xuexi\detective-novel-lab
npm install
npm run dev -- -p 3000
```

打开：

```text
http://localhost:3000
```

## 模型配置

复制 `.env.example` 为 `.env`，填入密钥。DeepSeek 示例：

```env
AI_PROVIDER=deepseek
DEEPSEEK_API_KEY=你的DeepSeek密钥
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-v4-flash
```

修改 `.env` 后需要重启开发服务器。

## Deduction Game 流程

1. 输入题材与约束。
2. 点击 `生成并校验案件`。
3. 系统生成结构化案件 JSON，并自动修复最多 2 次。
4. 本地规则校验唯一凶手、关键证据、排除链、时间线矛盾和公平推理链。
5. 系统生成玩家可见案卷，不泄露凶手和幕后真相。
6. 玩家搜索场景发现证据。
7. 玩家出示证据质询角色，系统先用规则判断是否命中矛盾，再调用模型生成回答。
8. 玩家查看证据图、人物关系图和时间线矛盾面板。
9. 玩家提交凶手、动机、手法和证据链。
10. 本地规则判定是否成立；通过后生成完整解答篇。

## 结构化模型

核心类型在 `lib/deduction.ts`：

- `CaseTruth`：凶手、动机、手法、机会、关键证据、真实时间线。
- `Character`：身份、公开信息、秘密、动机、手段、机会、证词、知识范围、撒谎策略、矛盾触发证据。
- `Evidence`：发现地点、可见描述、真实含义、关联人物、可反驳对象、支持结论、发现难度。
- `TimelineEvent`：真实事件、公开版本、来源、可反驳证据。
- `LogicPuzzle`：嫌疑人矩阵、排除链、关键推理链、误导线索、必要线索顺序。
- `PlayerTheory`：玩家提交的凶手、动机、手法和证据链。

## API 阶段

仍使用同一个接口：

```text
POST /api/generate
```

游戏阶段：

- `gameTruthSeed`：生成结构化真相 JSON，并自动触发修复。
- `gameLogicRepair`：修复未通过本地规则的案件结构。
- `gameCaseFile`：把结构化真相写成玩家可见案卷。
- `gameDialogue`：按角色和已知信息生成普通问答。
- `gameEvidenceChallenge`：按证据质询结果生成角色回答。
- `gameJudgement`：解释规则引擎的判定结果。
- `gameSolutionReveal`：玩家通过后生成完整解答篇。

小说生成阶段保留：

- `quickSynopsis`
- `quickOutline`
- `quickChapter`

## 测试

构建：

```powershell
npm run build
```

规则测试：

```powershell
node scripts/run-rule-tests.mjs
```

DeepSeek API 闭环测试，需要先运行开发服务器：

```powershell
npm run dev -- -p 3000
node scripts/run-deduction-game-test.mjs
```

API 测试输出位于：

```text
outputs/deduction-game-test-case.json
outputs/deduction-game-test-log.md
```

## 安全

`.env` 包含 API Key，已被 `.gitignore` 忽略，不要提交到 Git 仓库。
